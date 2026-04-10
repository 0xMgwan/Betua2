/**
 * Kenya Deposit API
 * Initiates M-Pesa KES deposit via bKES (Bpesa)
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
      return NextResponse.json({ error: 'Minimum deposit is 100 KES' }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('254') && !cleanPhone.startsWith('07') && !cleanPhone.startsWith('01')) {
      return NextResponse.json({ error: 'Invalid Kenya phone number' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!user.ntzsUserId) {
      return NextResponse.json({ error: 'Wallet not configured' }, { status: 400 });
    }

    const ntzsUser = await ntzs.users.get(user.ntzsUserId);
    const walletAddress = ntzsUser.walletAddress;

    // Get fee preview
    const fees = await bkes.getFees(amountKes, 'onramp');

    // Initiate bKES onramp (M-Pesa STK push -> bKES minted)
    const result = await bkes.onramp({
      walletAddress,
      phoneNumber: cleanPhone,
      amount: amountKes,
      mobileNetwork: 'Safaricom',
    });

    // Create pending transaction
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'DEPOSIT',
        amountKes: fees.netAmount,
        currency: 'KES',
        status: 'PENDING',
        externalRef: result.reference,
        phone: cleanPhone,
        description: `M-Pesa deposit (Kenya) - Fee: ${fees.totalFeeAmount} KES`,
      },
    });

    return NextResponse.json({
      success: true,
      reference: result.reference,
      netAmount: fees.netAmount,
      fee: fees.totalFeeAmount,
      message: 'Check your phone for M-Pesa prompt',
    });
  } catch (error) {
    console.error('[Deposit KE] Error:', error);
    return NextResponse.json({ error: 'Deposit failed. Please try again.' }, { status: 500 });
  }
}
