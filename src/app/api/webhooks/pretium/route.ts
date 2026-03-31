/**
 * Pretium Webhook Handler
 * Receives payment notifications from Pretium
 * Auto-mints NKES when KES deposit is confirmed
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nkes } from '@/lib/nkes';
import { ntzs } from '@/lib/ntzs';
import { notify } from '@/lib/notify';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    const body = JSON.parse(payload);

    console.log('[Pretium Webhook] Received:', body);

    const {
      transaction_code,
      status,
      amount,
      shortcode, // Phone number
      type, // 'onramp' or 'offramp'
    } = body;

    // Only process successful transactions
    if (status !== 'SUCCESS') {
      console.log(`[Pretium Webhook] Ignoring status: ${status}`);
      return NextResponse.json({ received: true });
    }

    // Find user by phone number
    const phone = shortcode.startsWith('254') ? shortcode : `254${shortcode}`;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone },
          { phone: `+${phone}` },
          { phone: phone.replace('254', '0') },
        ],
      },
    });

    if (!user) {
      console.error(`[Pretium Webhook] User not found for phone: ${phone}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check for duplicate transaction
    const existingTx = await prisma.transaction.findFirst({
      where: { externalRef: transaction_code },
    });

    if (existingTx) {
      console.log(`[Pretium Webhook] Duplicate transaction: ${transaction_code}`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (type === 'onramp') {
      // DEPOSIT: Mint NKES to user's wallet
      await handleDeposit(user, amount, transaction_code);
    } else if (type === 'offramp') {
      // WITHDRAWAL: Already burned, just update status
      await handleWithdrawalComplete(user, amount, transaction_code);
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error('[Pretium Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleDeposit(
  user: { id: string; ntzsUserId: string | null; email: string },
  amountKes: number,
  transactionCode: string
) {
  console.log(`[Pretium] Processing deposit: ${amountKes} KES for user ${user.id}`);

  // Get user's nTZS wallet address
  if (!user.ntzsUserId) {
    throw new Error('User does not have nTZS wallet');
  }

  const ntzsUser = await ntzs.users.get(user.ntzsUserId);
  const walletAddress = ntzsUser.walletAddress;

  if (!walletAddress) {
    throw new Error('User wallet address not found');
  }

  // Mint NKES to user's wallet
  const mintTxHash = await nkes.mint(walletAddress, amountKes);

  // Create transaction record
  await prisma.transaction.create({
    data: {
      userId: user.id,
      type: 'DEPOSIT',
      amountKes,
      currency: 'KES',
      status: 'COMPLETED',
      externalRef: transactionCode,
      txHash: mintTxHash,
      description: 'M-Pesa deposit (Kenya)',
    },
  });

  // Update user's KES balance
  await prisma.user.update({
    where: { id: user.id },
    data: {
      balanceKes: { increment: amountKes },
    },
  });

  // Notify user
  await notify(user.id, 'DEPOSIT_COMPLETE', {
    amount: amountKes,
    currency: 'KES',
  });

  console.log(`[Pretium] Deposit complete: ${amountKes} KES minted as NKES`);
}

async function handleWithdrawalComplete(
  user: { id: string },
  amountKes: number,
  transactionCode: string
) {
  console.log(`[Pretium] Withdrawal complete: ${amountKes} KES for user ${user.id}`);

  // Update transaction status
  await prisma.transaction.updateMany({
    where: {
      userId: user.id,
      externalRef: transactionCode,
      type: 'WITHDRAWAL',
    },
    data: {
      status: 'COMPLETED',
    },
  });

  // Notify user
  await notify(user.id, 'WITHDRAWAL_COMPLETE', {
    amount: amountKes,
    currency: 'KES',
  });
}
