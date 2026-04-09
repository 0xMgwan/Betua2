import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ntzs, NtzsApiError } from "@/lib/ntzs";
import { createNotification } from "@/lib/notify";

const USDC_TO_TZS_RATE = 2630;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recipientUsername, amountTzs, amountUsdc, currency } = await req.json();

    // Support both TZS and USDC amounts
    const isUsdcSend = currency === 'USDC' && amountUsdc > 0;
    const requestedAmountTzs = isUsdcSend ? Math.round(amountUsdc * USDC_TO_TZS_RATE) : amountTzs;

    if (!recipientUsername || (!amountTzs && !amountUsdc) || requestedAmountTzs <= 0) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // Get sender
    const sender = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!sender || !sender.ntzsUserId) {
      return NextResponse.json({ error: "Sender wallet not provisioned" }, { status: 400 });
    }

    // Get recipient
    const recipient = await prisma.user.findUnique({
      where: { username: recipientUsername },
    });

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    if (!recipient.ntzsUserId) {
      return NextResponse.json({ error: "Recipient wallet not provisioned" }, { status: 400 });
    }

    if (sender.id === recipient.id) {
      return NextResponse.json({ error: "Cannot send to yourself" }, { status: 400 });
    }

    // Check balance and handle USDC swap if needed
    let actualAmountToSend = requestedAmountTzs;
    
    try {
      const { balanceTzs, balanceUsdc } = await ntzs.users.getBalance(sender.ntzsUserId);
      
      if (isUsdcSend) {
        // For USDC sends: check USDC balance, swap to nTZS, then send actual received amount
        if ((balanceUsdc || 0) < amountUsdc) {
          return NextResponse.json({
            error: `Insufficient USDC balance. You have $${(balanceUsdc || 0).toFixed(2)}, need $${amountUsdc.toFixed(2)}.`,
          }, { status: 400 });
        }
        
        // Swap USDC to nTZS first
        console.log(`[Send] Swapping $${amountUsdc} USDC → nTZS for user ${sender.ntzsUserId}`);
        try {
          const swapResult = await ntzs.swap.executeAndWait({
            userId: sender.ntzsUserId,
            fromToken: 'USDC',
            toToken: 'NTZS',
            amount: amountUsdc,
            slippageBps: 100,
          });
          console.log(`[Send] Swap completed: ${swapResult.txHash}`);
          
          // Get actual nTZS balance after swap (accounts for slippage)
          const { balanceTzs: newBalanceTzs } = await ntzs.users.getBalance(sender.ntzsUserId);
          actualAmountToSend = newBalanceTzs; // Send whatever we actually got from the swap
          console.log(`[Send] After swap, sending actual balance: ${actualAmountToSend} TZS (requested: ${requestedAmountTzs} TZS)`);
        } catch (swapErr) {
          console.error("[Send] USDC swap failed:", swapErr);
          return NextResponse.json({ error: "USDC swap failed. Please try again." }, { status: 500 });
        }
      } else {
        // For TZS sends: check nTZS balance directly
        if (balanceTzs < requestedAmountTzs) {
          return NextResponse.json({
            error: `Insufficient balance. You have ${balanceTzs.toLocaleString()} TZS, need ${requestedAmountTzs.toLocaleString()} TZS.`,
          }, { status: 400 });
        }
        actualAmountToSend = requestedAmountTzs;
      }
    } catch (err) {
      console.error("Balance check failed:", err);
      return NextResponse.json({ error: "Could not verify balance" }, { status: 503 });
    }

    // Execute transfer with actual available amount
    console.log(`User transfer: ${sender.ntzsUserId} (${sender.username}) → ${recipient.ntzsUserId} (${recipient.username}): ${actualAmountToSend} TZS`);
    
    try {
      const transfer = await ntzs.transfers.create({
        fromUserId: sender.ntzsUserId,
        toUserId: recipient.ntzsUserId,
        amountTzs: actualAmountToSend,
      });

      // Create transaction records for both sender and recipient
      await prisma.transaction.createMany({
        data: [
          {
            userId: sender.id,
            type: "SEND",
            amountTzs: actualAmountToSend,
            amountUsdc: isUsdcSend ? Math.round(amountUsdc * 1_000_000) : 0,
            currency: isUsdcSend ? 'USDC' : 'TZS',
            status: "COMPLETED",
            recipientUsername: recipient.username,
          },
          {
            userId: recipient.id,
            type: "RECEIVE",
            amountTzs: transfer.recipientAmountTzs, // Amount after fees
            status: "COMPLETED",
            recipientUsername: sender.username, // Store sender's username for "from" display
          },
        ],
      });

      // Notify sender
      const sentAmountDisplay = isUsdcSend 
        ? `$${amountUsdc.toFixed(2)}` 
        : `${actualAmountToSend.toLocaleString()} TZS`;
      createNotification({
        userId: sender.id,
        type: "FUNDS_SENT",
        title: "Transfer Sent",
        message: `Sent ${sentAmountDisplay} to @${recipient.username}`,
        link: `/wallet`,
      });

      // Notify recipient
      createNotification({
        userId: recipient.id,
        type: "FUNDS_RECEIVED",
        title: "Money Received!",
        message: `@${sender.username} sent you ${transfer.recipientAmountTzs.toLocaleString()} TZS`,
        link: `/wallet`,
      });

      return NextResponse.json({
        success: true,
        transfer: {
          id: transfer.id,
          amountTzs: transfer.amountTzs,
          recipientAmountTzs: transfer.recipientAmountTzs,
          feeAmountTzs: transfer.feeAmountTzs,
          status: transfer.status,
        },
        recipient: {
          username: recipient.username,
          displayName: recipient.displayName,
        },
      });
    } catch (err) {
      if (err instanceof NtzsApiError) {
        console.error("nTZS transfer error:", err.status, err.body);
        return NextResponse.json({
          error: err.body.message || "Transfer failed",
          details: err.body,
        }, { status: err.status });
      }
      throw err;
    }
  } catch (err) {
    console.error("Send error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
