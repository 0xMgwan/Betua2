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
 * Announce a newly-created market/event to every other user — in-app bell +
 * web push, mirroring how resolution notifies traders. Non-blocking; skips the
 * creator and deleted accounts. Fire-and-forget (don't await) so it never slows
 * the create response.
 */
async function broadcast(opts: {
  creatorId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  pushTag: string;
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

    await createNotifications(
      users.map((u) => ({ userId: u.id, type: opts.type, title: opts.title, message: opts.message, link: opts.link }))
    );

    const { sendPushToUsers } = await import("@/lib/push");
    await sendPushToUsers(users.map((u) => u.id), {
      title: opts.title,
      body: opts.message,
      url: opts.link,
      tag: opts.pushTag,
    });
  } catch (err) {
    console.error("[broadcast] failed:", err);
  }
}

export async function broadcastNewMarket(opts: {
  marketId: string;
  title: string;
  creatorId: string;
  category?: string | null;
}) {
  return broadcast({
    creatorId: opts.creatorId,
    type: "MARKET_CREATED",
    title: "New Market",
    message: `New market: "${opts.title}"${opts.category ? ` · ${opts.category}` : ""}. Place your prediction!`,
    link: `/markets/${opts.marketId}`,
    pushTag: `new-market-${opts.marketId}`,
  });
}

export async function broadcastNewEvent(opts: {
  eventId: string;
  title: string;
  creatorId: string;
  category?: string | null;
}) {
  return broadcast({
    creatorId: opts.creatorId,
    type: "MARKET_CREATED",
    title: "New Event",
    message: `New event: "${opts.title}"${opts.category ? ` · ${opts.category}` : ""}. Check out the markets!`,
    link: `/events/${opts.eventId}`,
    pushTag: `new-event-${opts.eventId}`,
  });
}
