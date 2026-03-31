/**
 * Kenya Deposit API
 * Initiates M-Pesa KES deposit via Pretium
 * NKES tokens are minted via webhook when payment confirms
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { pretium } from '@/lib/pretium';

const WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL + '/api/webhooks/pretium';

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
        { error: 'Minimum deposit is 100 KES' },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number required' },
        { status: 400 }
      );
    }

    // Validate Kenya phone number
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('254') && !cleanPhone.startsWith('07') && !cleanPhone.startsWith('01')) {
      return NextResponse.json(
        { error: 'Invalid Kenya phone number' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Initiate Pretium onramp (M-Pesa STK push)
    const result = await pretium.onramp({
      phone: cleanPhone,
      amountKes,
      callbackUrl: WEBHOOK_URL,
    });

    // Create pending transaction
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'DEPOSIT',
        amountKes,
        currency: 'KES',
        status: 'PENDING',
        externalRef: result.transactionCode,
        phone: cleanPhone,
        description: 'M-Pesa deposit (Kenya)',
      },
    });

    return NextResponse.json({
      success: true,
      transactionCode: result.transactionCode,
      message: 'Check your phone for M-Pesa prompt',
    });
  } catch (error) {
    console.error('[Deposit KE] Error:', error);
    return NextResponse.json(
      { error: 'Deposit failed. Please try again.' },
      { status: 500 }
    );
  }
}
