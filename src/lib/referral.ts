import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";
import { createNotification } from "@/lib/notify";

const REFERRAL_REWARD_PERCENT = 0.01; // 1% of first deposit
const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID;

/**
 * Process referral reward when a deposit completes.
 * Only pays out on the user's FIRST completed deposit.
 * Idempotent — uses depositTxId unique constraint to prevent double payouts.
 */
export async function processReferralReward(userId: string, depositTxId: string, depositAmountTzs: number) {
  try {
    // 1. Get user + check if they were referred
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, referredById: true },
    });
    if (!user?.referredById) return; // Not referred

    // 2. Check if this is the user's first completed deposit
    const completedDeposits = await prisma.transaction.count({
      where: {
        userId,
        type: "DEPOSIT",
        status: "COMPLETED",
      },
    });
    // Only reward on the very first deposit (count should be 1 — the one that just completed)
    if (completedDeposits > 1) return;

    // 3. Check if a reward was already created for this deposit (idempotency)
    const existing = await prisma.referralReward.findUnique({
      where: { depositTxId },
    });
    if (existing) return;

    // 4. Calculate reward
    const rewardAmount = Math.max(1, Math.round(depositAmountTzs * REFERRAL_REWARD_PERCENT));

    // 5. Get referrer's nTZS user ID
    const referrer = await prisma.user.findUnique({
      where: { id: user.referredById },
      select: { id: true, username: true, ntzsUserId: true },
    });
    if (!referrer?.ntzsUserId || !PLATFORM_NTZS_USER_ID) {
      // Can't pay out — create record as FAILED
      await prisma.referralReward.create({
        data: {
          referrerId: user.referredById,
          referredId: userId,
          depositTxId,
          amountTzs: rewardAmount,
          status: "FAILED",
        },
      });
      return;
    }

    // 6. Create the reward record first (as PENDING)
    const reward = await prisma.referralReward.create({
      data: {
        referrerId: user.referredById,
        referredId: userId,
        depositTxId,
        amountTzs: rewardAmount,
        status: "PENDING",
      },
    });

    // 7. Transfer from platform escrow to referrer's wallet
    try {
      const transfer = await ntzs.transfers.create({
        fromUserId: PLATFORM_NTZS_USER_ID,
        toUserId: referrer.ntzsUserId,
        amountTzs: rewardAmount,
      });

      await prisma.referralReward.update({
        where: { id: reward.id },
        data: { status: "COMPLETED", ntzsTransferId: transfer.id },
      });

      // 8. Record it as a transaction so it shows in wallet history
      await prisma.transaction.create({
        data: {
          userId: referrer.id,
          type: "REFERRAL_REWARD",
          amountTzs: rewardAmount,
          status: "COMPLETED",
          recipientUsername: user.username,
        },
      });

      // 9. Notify the referrer
      createNotification({
        userId: referrer.id,
        type: "REFERRAL_REWARD",
        title: "Referral Reward!",
        message: `You earned ${rewardAmount.toLocaleString()} TZS from @${user.username}'s first deposit!`,
        link: "/profile",
      });

      console.log(`[Referral] Paid ${rewardAmount} TZS to @${referrer.username} for referring @${user.username}`);
    } catch (err) {
      console.error("[Referral] Transfer failed:", err);
      await prisma.referralReward.update({
        where: { id: reward.id },
        data: { status: "FAILED" },
      });
    }
  } catch (err) {
    console.error("[Referral] processReferralReward error:", err);
  }
}
