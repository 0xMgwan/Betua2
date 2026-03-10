import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ntzs, NtzsApiError } from "@/lib/ntzs";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recipientUsername, amountTzs } = await req.json();

    if (!recipientUsername || !amountTzs || amountTzs <= 0) {
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

    // Check balance
    try {
      const { balanceTzs } = await ntzs.users.getBalance(sender.ntzsUserId);
      if (balanceTzs < amountTzs) {
        return NextResponse.json({
          error: `Insufficient balance. You have ${balanceTzs.toLocaleString()} TZS, need ${amountTzs.toLocaleString()} TZS.`,
        }, { status: 400 });
      }
    } catch (err) {
      console.error("Balance check failed:", err);
      return NextResponse.json({ error: "Could not verify balance" }, { status: 503 });
    }

    // Execute transfer
    console.log(`User transfer: ${sender.ntzsUserId} (${sender.username}) → ${recipient.ntzsUserId} (${recipient.username}): ${amountTzs} TZS`);
    
    try {
      const transfer = await ntzs.transfers.create({
        fromUserId: sender.ntzsUserId,
        toUserId: recipient.ntzsUserId,
        amountTzs,
      });

      // Create transaction records for both sender and recipient
      await prisma.transaction.createMany({
        data: [
          {
            userId: sender.id,
            type: "SEND",
            amountTzs,
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
