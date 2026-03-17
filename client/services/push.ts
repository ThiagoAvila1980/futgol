import api from './api';

const VAPID_PUBLIC_KEY = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const pushService = {
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  async getPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  },

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  },

  async subscribe(playerId: string): Promise<boolean> {
    try {
      if (!this.isSupported() || !VAPID_PUBLIC_KEY) return false;

      const granted = await this.requestPermission();
      if (!granted) return false;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      await api.post('/api/push/subscribe', {
        playerId,
        subscription: subscription.toJSON(),
      });

      return true;
    } catch (error) {
      console.error('Push subscription error:', error);
      return false;
    }
  },

  async sendToGroup(groupId: string, title: string, body: string): Promise<void> {
    await api.post('/api/push/send', { groupId, title, body });
  },

  async sendToPlayers(playerIds: string[], title: string, body: string): Promise<void> {
    await api.post('/api/push/send', { targetPlayerIds: playerIds, title, body });
  },
};
