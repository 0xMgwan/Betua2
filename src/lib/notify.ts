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
  | "REFERRAL_REWARD";

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
