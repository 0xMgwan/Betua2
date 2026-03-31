/**
 * Kenya Withdrawal API
 * Burns NKES tokens and disburses KES via Pretium to M-Pesa
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { pretium } from '@/lib/pretium';
import { nkes } from '@/lib/nkes';
import { ntzs } from '@/lib/ntzs';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amountKes, phone } = await req.json();

    // Validation
    if (!amountKes || amountKes < 100) {
      return NextResponse.json(
        { error: 'Minimum withdrawal is 100 KES' },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check KES balance
    if (user.balanceKes < amountKes) {
      return NextResponse.json(
        { error: 'Insufficient KES balance' },
        { status: 400 }
      );
    }

    // Get user's wallet address
    if (!user.ntzsUserId) {
      return NextResponse.json(
        { error: 'Wallet not configured' },
        { status: 400 }
      );
    }

    const ntzsUser = await ntzs.users.get(user.ntzsUserId);
    const walletAddress = ntzsUser.walletAddress;

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address not found' },
        { status: 400 }
      );
    }

    // Format phone number
    const cleanPhone = phone.replace(/\D/g, '');

    // 1. Burn NKES tokens
    const burnTxHash = await nkes.burn(walletAddress, amountKes);

    // 2. Deduct balance immediately
    await prisma.user.update({
      where: { id: user.id },
      data: {
        balanceKes: { decrement: amountKes },
      },
    });

    // 3. Initiate Pretium offramp (M-Pesa disbursement)
    const result = await pretium.offramp({
      phone: cleanPhone,
      amountKes,
    });

    // 4. Create transaction record
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'WITHDRAWAL',
        amountKes,
        currency: 'KES',
        status: 'PROCESSING',
        externalRef: result.transactionCode,
        txHash: burnTxHash,
        phone: cleanPhone,
        description: 'M-Pesa withdrawal (Kenya)',
      },
    });

    return NextResponse.json({
      success: true,
      transactionCode: result.transactionCode,
      message: 'Withdrawal processing. You will receive M-Pesa shortly.',
    });
  } catch (error) {
    console.error('[Withdraw KE] Error:', error);
    return NextResponse.json(
      { error: 'Withdrawal failed. Please try again.' },
      { status: 500 }
    );
  }
}
