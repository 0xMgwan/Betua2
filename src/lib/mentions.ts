import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notify";
import { sendPushToUser } from "@/lib/push";

// Matches @username tokens (letters, digits, underscore, dot, dash; 2–32 chars).
// The @ must start the string or follow a non-word char so emails
// (test@example.com) don't count as mentions. (No lookbehind — older iOS
// Safari parses this file's client-shared regex.)
export const MENTION_REGEX = /(^|[^\w@])@([a-zA-Z0-9_.-]{2,32})/g;

/**
 * Find @mentions in a comment and notify the mentioned users — both an in-app
 * notification (bell) and a web-push notification for installed-app users.
 * Non-blocking: never throws; caps at 10 mentions per comment; skips
 * self-mentions and unknown usernames.
 */
export async function notifyMentions(opts: {
  body: string;
  authorId: string;
  authorUsername: string;
  contextTitle: string; // market or event title for the notification message
  link: string;         // where tapping the notification lands
}) {
  try {
    const tokens = [...new Set(
      [...opts.body.matchAll(MENTION_REGEX)].map((m) => m[2])
    )].slice(0, 10);
    if (tokens.length === 0) return;

    // Case-insensitive username match (Prisma `in` has no insensitive mode)
    const users = await prisma.user.findMany({
      where: { OR: tokens.map((u) => ({ username: { equals: u, mode: "insensitive" as const } })) },
      select: { id: true, username: true },
    });
    const targets = users.filter((u) => u.id !== opts.authorId);
    if (targets.length === 0) return;

    const excerpt = opts.body.length > 90 ? `${opts.body.slice(0, 90)}…` : opts.body;
    const title = `@${opts.authorUsername} mentioned you`;
    const message = `On "${opts.contextTitle}": ${excerpt}`;

    await createNotifications(
      targets.map((u) => ({ userId: u.id, type: "MENTION" as const, title, message, link: opts.link }))
    );

    // Web push (installed app / PWA). Fire per-user; failures are non-fatal.
    await Promise.allSettled(
      targets.map((u) =>
        sendPushToUser(u.id, {
          title,
          body: message,
          url: opts.link,
          tag: `mention-${opts.link}`,
        })
      )
    );
  } catch (err) {
    console.error("[Mentions] notify failed:", err);
  }
}
