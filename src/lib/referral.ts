import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";

const REFERRAL_REWARD_PERCENT = 0.01; // 1% of first deposit

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

    // 5. Get referrer
    const referrer = await prisma.user.findUnique({
      where: { id: user.referredById },
      select: { id: true, username: true },
    });
    if (!referrer) return;

    // 6. Pooled custodial model: credit the referrer's DB balance (the reward
    // stays in the settlement pool as their claim) and record the reward +
    // transaction atomically. No on-chain transfer; no personal wallet needed.
    await prisma.$transaction([
      prisma.referralReward.create({
        data: {
          referrerId: user.referredById,
          referredId: userId,
          depositTxId,
          amountTzs: rewardAmount,
          status: "COMPLETED",
        },
      }),
      prisma.user.update({
        where: { id: referrer.id },
        data: { balanceTzs: { increment: rewardAmount } },
      }),
      prisma.transaction.create({
        data: {
          userId: referrer.id,
          type: "REFERRAL_REWARD",
          amountTzs: rewardAmount,
          status: "COMPLETED",
          recipientUsername: user.username,
        },
      }),
    ]);

    // 7. Notify the referrer
    createNotification({
      userId: referrer.id,
      type: "REFERRAL_REWARD",
      title: "Referral Reward!",
      message: `You earned ${rewardAmount.toLocaleString()} TZS from @${user.username}'s first deposit!`,
      link: "/profile",
    });

    console.log(`[Referral] Credited ${rewardAmount} TZS to @${referrer.username} for referring @${user.username}`);
  } catch (err) {
    console.error("[Referral] processReferralReward error:", err);
  }
}
