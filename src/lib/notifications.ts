// Push Notification Helper Functions

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: Record<string, any>;
  actions?: Array<{ action: string; title: string }>;
}

export class NotificationService {
  private static instance: NotificationService;
  private registration: ServiceWorkerRegistration | null = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered');
      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission;
    }

    return Notification.permission;
  }

  async showNotification(payload: NotificationPayload): Promise<void> {
    const permission = await this.requestPermission();
    
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    if (!this.registration) {
      await this.initialize();
    }

    if (this.registration) {
      await this.registration.showNotification(payload.title, {
        body: payload.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: {
          url: payload.url || '/',
          ...payload.data,
        },
        tag: payload.tag || 'betua-notification',
        requireInteraction: payload.requireInteraction || false,
      });
    }
  }

  // Notification templates for different events
  async notifyTrade(marketTitle: string, side: string, amount: number, marketId: string, locale: string = 'en') {
    const title = locale === 'sw' ? '✅ Biashara Imefanikiwa' : '✅ Trade Successful';
    const body = locale === 'sw' 
      ? `Umenunua hisa za ${side} katika "${marketTitle}" kwa ${amount.toLocaleString()} TZS`
      : `Bought ${side} shares in "${marketTitle}" for ${amount.toLocaleString()} TZS`;
    
    await this.showNotification({
      title,
      body,
      url: `/markets/${marketId}`,
      tag: 'trade',
    });
  }

  async notifyMarketResolved(marketTitle: string, outcome: string, marketId: string, locale: string = 'en') {
    const title = locale === 'sw' ? '🎯 Soko Limetatuliwa' : '🎯 Market Resolved';
    const body = locale === 'sw' 
      ? `"${marketTitle}" imetatuliwa: ${outcome}`
      : `"${marketTitle}" resolved: ${outcome}`;
    
    await this.showNotification({
      title,
      body,
      url: `/markets/${marketId}`,
      tag: 'resolution',
      requireInteraction: true,
    });
  }

  async notifyWinnings(marketTitle: string, amount: number, marketId: string, locale: string = 'en') {
    const title = locale === 'sw' ? '🎉 Umeshinda!' : '🎉 You Won!';
    const body = locale === 'sw'
      ? `Umeshinda ${amount.toLocaleString()} TZS katika "${marketTitle}". Pokea sasa!`
      : `You won ${amount.toLocaleString()} TZS in "${marketTitle}". Redeem now!`;
    const redeemAction = locale === 'sw' ? 'Pokea Sasa' : 'Redeem Now';
    const viewAction = locale === 'sw' ? 'Angalia Portfolio' : 'View Portfolio';
    
    await this.showNotification({
      title,
      body,
      url: `/portfolio`,
      tag: 'winnings',
      requireInteraction: true,
      actions: [
        { action: 'redeem', title: redeemAction },
        { action: 'view', title: viewAction },
      ],
    });
  }

  async notifyTransferReceived(from: string, amount: number, locale: string = 'en') {
    const title = locale === 'sw' ? '💰 Pesa Imepokelewa' : '💰 Money Received';
    const body = locale === 'sw'
      ? `@${from} amekutumia ${amount.toLocaleString()} TZS`
      : `@${from} sent you ${amount.toLocaleString()} TZS`;
    
    await this.showNotification({
      title,
      body,
      url: `/wallet`,
      tag: 'transfer',
    });
  }

  async notifyTransferSent(to: string, amount: number, locale: string = 'en') {
    const title = locale === 'sw' ? '📤 Uhamisho Umetumwa' : '📤 Transfer Sent';
    const body = locale === 'sw'
      ? `Umetuma ${amount.toLocaleString()} TZS kwa @${to}`
      : `Sent ${amount.toLocaleString()} TZS to @${to}`;
    
    await this.showNotification({
      title,
      body,
      url: `/wallet`,
      tag: 'transfer',
    });
  }

  async notifyDeposit(amount: number, locale: string = 'en') {
    const title = locale === 'sw' ? '💵 Amana Imefanikiwa' : '💵 Deposit Successful';
    const body = locale === 'sw'
      ? `${amount.toLocaleString()} TZS imeongezwa kwenye mkoba wako`
      : `${amount.toLocaleString()} TZS added to your wallet`;
    
    await this.showNotification({
      title,
      body,
      url: `/wallet`,
      tag: 'deposit',
    });
  }

  async notifyWithdraw(amount: number, locale: string = 'en') {
    const title = locale === 'sw' ? '💸 Uondoaji Umefanikiwa' : '💸 Withdrawal Successful';
    const body = locale === 'sw'
      ? `${amount.toLocaleString()} TZS imetolewa kwenye mkoba wako`
      : `${amount.toLocaleString()} TZS withdrawn from your wallet`;
    
    await this.showNotification({
      title,
      body,
      url: `/wallet`,
      tag: 'withdraw',
    });
  }

  async notifyMarketCreated(marketTitle: string, marketId: string, locale: string = 'en') {
    const title = locale === 'sw' ? '🎨 Soko Limeundwa' : '🎨 Market Created';
    const body = locale === 'sw'
      ? `Soko lako "${marketTitle}" sasa liko hai!`
      : `Your market "${marketTitle}" is now live!`;
    
    await this.showNotification({
      title,
      body,
      url: `/markets/${marketId}`,
      tag: 'market-created',
    });
  }

  async notifyPriceAlert(marketTitle: string, side: string, price: number, marketId: string, locale: string = 'en') {
    const title = locale === 'sw' ? '📊 Arifa ya Bei' : '📊 Price Alert';
    const body = locale === 'sw'
      ? `${side} katika "${marketTitle}" sasa iko ${(price * 100).toFixed(0)}%`
      : `${side} in "${marketTitle}" is now at ${(price * 100).toFixed(0)}%`;
    
    await this.showNotification({
      title,
      body,
      url: `/markets/${marketId}`,
      tag: 'price-alert',
    });
  }
}

export const notifications = NotificationService.getInstance();
