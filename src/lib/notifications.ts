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
  async notifyTrade(marketTitle: string, side: string, amount: number, marketId: string) {
    await this.showNotification({
      title: '✅ Trade Successful',
      body: `Bought ${side} shares in "${marketTitle}" for ${amount.toLocaleString()} TZS`,
      url: `/markets/${marketId}`,
      tag: 'trade',
    });
  }

  async notifyMarketResolved(marketTitle: string, outcome: string, marketId: string) {
    await this.showNotification({
      title: '🎯 Market Resolved',
      body: `"${marketTitle}" resolved: ${outcome}`,
      url: `/markets/${marketId}`,
      tag: 'resolution',
      requireInteraction: true,
    });
  }

  async notifyWinnings(marketTitle: string, amount: number, marketId: string) {
    await this.showNotification({
      title: '🎉 You Won!',
      body: `You won ${amount.toLocaleString()} TZS in "${marketTitle}". Redeem now!`,
      url: `/portfolio`,
      tag: 'winnings',
      requireInteraction: true,
      actions: [
        { action: 'redeem', title: 'Redeem Now' },
        { action: 'view', title: 'View Portfolio' },
      ],
    });
  }

  async notifyTransferReceived(from: string, amount: number) {
    await this.showNotification({
      title: '💰 Money Received',
      body: `@${from} sent you ${amount.toLocaleString()} TZS`,
      url: `/wallet`,
      tag: 'transfer',
    });
  }

  async notifyTransferSent(to: string, amount: number) {
    await this.showNotification({
      title: '📤 Transfer Sent',
      body: `Sent ${amount.toLocaleString()} TZS to @${to}`,
      url: `/wallet`,
      tag: 'transfer',
    });
  }

  async notifyDeposit(amount: number) {
    await this.showNotification({
      title: '💵 Deposit Successful',
      body: `${amount.toLocaleString()} TZS added to your wallet`,
      url: `/wallet`,
      tag: 'deposit',
    });
  }

  async notifyWithdraw(amount: number) {
    await this.showNotification({
      title: '💸 Withdrawal Successful',
      body: `${amount.toLocaleString()} TZS withdrawn from your wallet`,
      url: `/wallet`,
      tag: 'withdraw',
    });
  }

  async notifyMarketCreated(marketTitle: string, marketId: string) {
    await this.showNotification({
      title: '🎨 Market Created',
      body: `Your market "${marketTitle}" is now live!`,
      url: `/markets/${marketId}`,
      tag: 'market-created',
    });
  }

  async notifyPriceAlert(marketTitle: string, side: string, price: number, marketId: string) {
    await this.showNotification({
      title: '📊 Price Alert',
      body: `${side} in "${marketTitle}" is now at ${(price * 100).toFixed(0)}%`,
      url: `/markets/${marketId}`,
      tag: 'price-alert',
    });
  }
}

export const notifications = NotificationService.getInstance();
