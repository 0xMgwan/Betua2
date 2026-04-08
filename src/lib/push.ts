import webpush from 'web-push';
import { prisma } from './prisma';

// VAPID keys for Web Push
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hello@guap.gold';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId, isActive: true },
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify({
          ...payload,
          icon: payload.icon || '/icon-192.png',
          badge: payload.badge || '/icon-192.png',
        })
      );
      sent++;
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      console.error(`Push failed for ${sub.id}:`, err);
      // If subscription is invalid (410 Gone or 404), deactivate it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { isActive: false },
        });
      }
      failed++;
    }
  }

  return { sent, failed };
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  for (const userId of userIds) {
    const result = await sendPushToUser(userId, payload);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { sent: totalSent, failed: totalFailed };
}

// Notification templates
export async function notifyTradePlaced(
  userId: string,
  marketTitle: string,
  side: string,
  amount: number,
  marketId: string,
  locale: string = 'en'
) {
  const isSw = locale === 'sw';
  await sendPushToUser(userId, {
    title: isSw ? '✅ Biashara Imefanikiwa' : '✅ Trade Placed',
    body: isSw
      ? `Umenunua ${side} katika "${marketTitle}" kwa ${amount.toLocaleString()} TZS`
      : `Bought ${side} in "${marketTitle}" for ${amount.toLocaleString()} TZS`,
    url: `/markets/${marketId}`,
    tag: 'trade',
  });
}

export async function notifyPositionExpiring(
  userId: string,
  marketTitle: string,
  hoursLeft: number,
  marketId: string,
  locale: string = 'en'
) {
  const isSw = locale === 'sw';
  await sendPushToUser(userId, {
    title: isSw ? '⏰ Soko Linakaribia Kufungwa' : '⏰ Market Expiring Soon',
    body: isSw
      ? `"${marketTitle}" itafungwa baada ya saa ${hoursLeft}. Angalia nafasi yako!`
      : `"${marketTitle}" expires in ${hoursLeft} hours. Check your position!`,
    url: `/markets/${marketId}`,
    tag: 'expiring',
    requireInteraction: true,
  });
}

export async function notifyPositionChange(
  userId: string,
  marketTitle: string,
  side: string,
  percentChange: number,
  currentPrice: number,
  marketId: string,
  locale: string = 'en'
) {
  const isSw = locale === 'sw';
  const direction = percentChange > 0 ? (isSw ? 'imepanda' : 'up') : (isSw ? 'imeshuka' : 'down');
  const emoji = percentChange > 0 ? '📈' : '📉';
  
  await sendPushToUser(userId, {
    title: isSw ? `${emoji} Nafasi Yako Imebadilika` : `${emoji} Position Update`,
    body: isSw
      ? `${side} katika "${marketTitle}" ${direction} ${Math.abs(percentChange).toFixed(0)}% (sasa ${(currentPrice * 100).toFixed(0)}%)`
      : `${side} in "${marketTitle}" is ${direction} ${Math.abs(percentChange).toFixed(0)}% (now ${(currentPrice * 100).toFixed(0)}%)`,
    url: `/markets/${marketId}`,
    tag: 'price-change',
  });
}

export async function notifyMarketResolved(
  userId: string,
  marketTitle: string,
  outcome: string,
  won: boolean,
  payout: number,
  marketId: string,
  locale: string = 'en'
) {
  const isSw = locale === 'sw';
  
  if (won) {
    await sendPushToUser(userId, {
      title: isSw ? '🎉 Umeshinda!' : '🎉 You Won!',
      body: isSw
        ? `Umeshinda ${payout.toLocaleString()} TZS katika "${marketTitle}"! Pokea sasa.`
        : `You won ${payout.toLocaleString()} TZS in "${marketTitle}"! Redeem now.`,
      url: `/portfolio`,
      tag: 'winnings',
      requireInteraction: true,
    });
  } else {
    await sendPushToUser(userId, {
      title: isSw ? '🎯 Soko Limetatuliwa' : '🎯 Market Resolved',
      body: isSw
        ? `"${marketTitle}" imetatuliwa: ${outcome}`
        : `"${marketTitle}" resolved: ${outcome}`,
      url: `/markets/${marketId}`,
      tag: 'resolution',
    });
  }
}

export async function notifyDeposit(userId: string, amount: number, locale: string = 'en') {
  const isSw = locale === 'sw';
  await sendPushToUser(userId, {
    title: isSw ? '💵 Amana Imefanikiwa' : '💵 Deposit Successful',
    body: isSw
      ? `${amount.toLocaleString()} TZS imeongezwa kwenye mkoba wako`
      : `${amount.toLocaleString()} TZS added to your wallet`,
    url: `/wallet`,
    tag: 'deposit',
  });
}

export async function notifyWithdrawal(userId: string, amount: number, locale: string = 'en') {
  const isSw = locale === 'sw';
  await sendPushToUser(userId, {
    title: isSw ? '💸 Uondoaji Umefanikiwa' : '💸 Withdrawal Successful',
    body: isSw
      ? `${amount.toLocaleString()} TZS imetolewa kwenye mkoba wako`
      : `${amount.toLocaleString()} TZS withdrawn from your wallet`,
    url: `/wallet`,
    tag: 'withdrawal',
  });
}
