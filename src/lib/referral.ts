import { prisma } from "@/lib/prisma";

// Flat reward per referred user who onboards AND makes their first deposit.
// Recorded as PENDING (owed) and paid out manually from the admin Referrals tab.
export const REFERRAL_REWARD_TZS = 1000;

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

    // 4. Flat reward (paid manually)
    const rewardAmount = REFERRAL_REWARD_TZS;

    // 5. Ensure the referrer still exists
    const referrer = await prisma.user.findUnique({
      where: { id: user.referredById },
      select: { id: true, username: true },
    });
    if (!referrer) return;

    // 6. Record the reward as OWED (PENDING). Settlement is manual — the admin
    // reviews who deposited in the Referrals tab and pays via "Pay owed".
    await prisma.referralReward.create({
      data: {
        referrerId: user.referredById,
        referredId: userId,
        depositTxId,
        amountTzs: rewardAmount,
        status: "PENDING",
      },
    });

    console.log(`[Referral] Owed ${rewardAmount} TZS to @${referrer.username} for @${user.username}'s first deposit (pending manual payout)`);
  } catch (err) {
    console.error("[Referral] processReferralReward error:", err);
  }
}
