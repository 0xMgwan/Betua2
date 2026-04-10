/**
 * Kenya Withdrawal API
 * Burns bKES tokens and sends KES to M-Pesa via Bpesa
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bkes } from '@/lib/bkes';
import { ntzs } from '@/lib/ntzs';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amountKes, phone } = await req.json();

    if (!amountKes || amountKes < 100) {
      return NextResponse.json({ error: 'Minimum withdrawal is 100 KES' }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (user.balanceKes < amountKes) {
      return NextResponse.json({ error: 'Insufficient KES balance' }, { status: 400 });
    }

    if (!user.ntzsUserId) {
      return NextResponse.json({ error: 'Wallet not configured' }, { status: 400 });
    }

    const ntzsUser = await ntzs.users.get(user.ntzsUserId);
    const walletAddress = ntzsUser.walletAddress;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address not found' }, { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, '');

    // Get fee preview
    const fees = await bkes.getFees(amountKes, 'offramp');

    // Check on-chain bKES balance
    const bkesBalance = await bkes.getBalance(walletAddress);
    if (bkesBalance < amountKes) {
      return NextResponse.json({ error: 'Insufficient bKES balance on-chain' }, { status: 400 });
    }

    // Deduct balance immediately
    await prisma.user.update({
      where: { id: user.id },
      data: { balanceKes: { decrement: amountKes } },
    });

    // Initiate bKES offramp (burns bKES, sends KES to M-Pesa)
    const result = await bkes.offramp({
      walletAddress,
      phoneNumber: cleanPhone,
      amount: amountKes,
      mobileNetwork: 'Safaricom',
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'WITHDRAWAL',
        amountKes,
        currency: 'KES',
        status: 'PROCESSING',
        externalRef: result.reference,
        phone: cleanPhone,
        description: `M-Pesa withdrawal (Kenya) - You receive: ${fees.netAmount} KES`,
      },
    });

    return NextResponse.json({
      success: true,
      reference: result.reference,
      netAmount: fees.netAmount,
      fee: fees.totalFeeAmount,
      message: 'Withdrawal processing. You will receive M-Pesa shortly.',
    });
  } catch (error) {
    console.error('[Withdraw KE] Error:', error);
    return NextResponse.json({ error: 'Withdrawal failed. Please try again.' }, { status: 500 });
  }
}
