/**
 * bKES (Bpesa) Webhook Handler
 * Receives transaction notifications from Bpesa
 * Updates user balance when bKES deposit/withdrawal is confirmed
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notify';
import { bkes } from '@/lib/bkes';

const BKES_WEBHOOK_SECRET = process.env.BKES_WEBHOOK_SECRET || '';

export async function POST(req: NextRequest) {
  try {
    // Verify webhook signature if secret is configured
    const signature = req.headers.get('x-bkes-signature');
    if (BKES_WEBHOOK_SECRET && signature !== BKES_WEBHOOK_SECRET) {
      console.error('[bKES Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = await req.json();
    console.log('[bKES Webhook] Received:', body);

    const {
      reference,
      type, // 'LOAD' (onramp) or 'WITHDRAW' (offramp)
      status, // 'PENDING', 'CONFIRMED', 'FAILED'
      amount, // wei (18 decimals)
      toAddress,
      errorMsg,
    } = body;

    // Only process confirmed or failed transactions
    if (status !== 'CONFIRMED' && status !== 'FAILED') {
      console.log(`[bKES Webhook] Ignoring status: ${status}`);
      return NextResponse.json({ received: true });
    }

    // Find transaction by reference
    const transaction = await prisma.transaction.findFirst({
      where: { externalRef: reference },
    });

    if (!transaction) {
      console.error(`[bKES Webhook] Transaction not found: ${reference}`);
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Convert wei to KES
    const amountKes = bkes.fromWei(amount);

    if (status === 'CONFIRMED') {
      if (type === 'LOAD') {
        // DEPOSIT confirmed: Update user balance
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'COMPLETED' },
          }),
          prisma.user.update({
            where: { id: transaction.userId },
            data: { balanceKes: { increment: amountKes } },
          }),
        ]);

        await createNotification({
          userId: transaction.userId,
          type: 'DEPOSIT',
          title: 'Deposit Confirmed',
          message: `Your deposit of ${amountKes.toLocaleString()} KES has been confirmed.`,
          link: '/wallet',
        });

        console.log(`[bKES Webhook] Deposit confirmed: ${amountKes} KES for user ${transaction.userId}`);
      } else if (type === 'WITHDRAW') {
        // WITHDRAWAL confirmed: Just update status (balance already deducted)
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'COMPLETED' },
        });

        await createNotification({
          userId: transaction.userId,
          type: 'WITHDRAW',
          title: 'Withdrawal Complete',
          message: `Your withdrawal of ${amountKes.toLocaleString()} KES has been sent to your M-Pesa.`,
          link: '/wallet',
        });

        console.log(`[bKES Webhook] Withdrawal confirmed: ${amountKes} KES for user ${transaction.userId}`);
      }
    } else if (status === 'FAILED') {
      // Transaction failed
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { 
          status: 'FAILED',
          description: errorMsg || 'Transaction failed',
        },
      });

      // Refund balance if it was a withdrawal
      if (type === 'WITHDRAW') {
        await prisma.user.update({
          where: { id: transaction.userId },
          data: { balanceKes: { increment: transaction.amountKes } },
        });
      }

      await createNotification({
        userId: transaction.userId,
        type: type === 'LOAD' ? 'DEPOSIT' : 'WITHDRAW',
        title: type === 'LOAD' ? 'Deposit Failed' : 'Withdrawal Failed',
        message: errorMsg || 'Transaction failed. Please try again.',
        link: '/wallet',
      });

      console.log(`[bKES Webhook] Transaction failed: ${reference} - ${errorMsg}`);
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error('[bKES Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
