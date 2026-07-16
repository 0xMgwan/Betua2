import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "TRADE"
  | "MARKET_CREATED"
  | "MARKET_RESOLVED"
  | "FUNDS_RECEIVED"
  | "FUNDS_SENT"
  | "DEPOSIT"
  | "WITHDRAW"
  | "WINNINGS"
  | "REDEEM"
  | "REFERRAL_REWARD"
  | "CREATOR_FEE"
  | "MENTION";

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

/**
 * Create a database notification for a user.
 * Non-blocking — errors are logged but never thrown.
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
      },
    });
  } catch (err) {
    console.error("[Notification] Failed to create:", err);
  }
}

/**
 * Create notifications for multiple users at once.
 * Non-blocking — errors are logged but never thrown.
 */
export async function createNotifications(inputs: CreateNotificationInput[]) {
  try {
    await prisma.notification.createMany({
      data: inputs.map((n) => ({
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link,
      })),
    });
  } catch (err) {
    console.error("[Notification] Failed to create batch:", err);
  }
}

/**
 * Announce a newly-created market to every other user — in-app bell + web push,
 * mirroring how market resolution notifies traders. Non-blocking; skips the
 * creator and deleted accounts. Meant to be fired-and-forgotten (not awaited)
 * so it never slows the create response.
 */
export async function broadcastNewMarket(opts: {
  marketId: string;
  title: string;
  creatorId: string;
  category?: string | null;
}) {
  try {
    const users = await prisma.user.findMany({
      where: {
        id: { not: opts.creatorId },
        NOT: { username: { startsWith: "deleted_" } },
      },
      select: { id: true },
    });
    if (users.length === 0) return;

    const title = "New Market";
    const message = `New market: "${opts.title}"${opts.category ? ` · ${opts.category}` : ""}. Place your prediction!`;
    const link = `/markets/${opts.marketId}`;

    await createNotifications(
      users.map((u) => ({ userId: u.id, type: "MARKET_CREATED" as const, title, message, link }))
    );

    const { sendPushToUsers } = await import("@/lib/push");
    await sendPushToUsers(
      users.map((u) => u.id),
      { title, body: message, url: link, tag: `new-market-${opts.marketId}` }
    );
  } catch (err) {
    console.error("[broadcastNewMarket] failed:", err);
  }
}
