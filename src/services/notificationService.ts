import { supabase } from '../shared/supabase/client';

export class NotificationService {
  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  static hasPermission(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  static async showNotification(title: string, body: string, icon?: string): Promise<void> {
    if (!this.hasPermission()) {
      console.log('Notification permission not granted');
      return;
    }

    try {
      new Notification(title, {
        body,
        icon: icon || '/images/riley-positive.jpg',
        badge: '/images/riley-positive.jpg',
        tag: 'velvet-companion',
        requireInteraction: false,
      } as any);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  static async checkForMissYouNotification(
    userId: string,
    companionId: string,
    companionName: string
  ): Promise<void> {
    const { data: lastMessage } = await supabase
      .from('conversations')
      .select('created_at')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastMessage) {
      return;
    }

    const hoursSinceLastMessage = (Date.now() - new Date(lastMessage.created_at).getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastMessage >= 24 && hoursSinceLastMessage < 48) {
      const hasShownRecently = localStorage.getItem(`notification_shown_${companionId}`);
      const lastShownTime = hasShownRecently ? parseInt(hasShownRecently) : 0;
      const hoursSinceLastNotification = (Date.now() - lastShownTime) / (1000 * 60 * 60);

      if (hoursSinceLastNotification >= 24) {
        await this.showNotification(
          companionName,
          "Hey, just checking in. Everything okay?",
        );
        localStorage.setItem(`notification_shown_${companionId}`, Date.now().toString());
      }
    }
  }

  static async scheduleNudge(
    userId: string,
    companionId: string,
    companionName: string,
    message: string,
    delayHours: number
  ): Promise<void> {
    const scheduledTime = Date.now() + (delayHours * 60 * 60 * 1000);

    const nudgeData = {
      companionId,
      companionName,
      message,
      scheduledFor: scheduledTime,
    };

    const existingNudges = JSON.parse(localStorage.getItem('scheduled_nudges') || '[]');
    existingNudges.push(nudgeData);
    localStorage.setItem('scheduled_nudges', JSON.stringify(existingNudges));
  }

  static async checkScheduledNudges(): Promise<void> {
    const nudges = JSON.parse(localStorage.getItem('scheduled_nudges') || '[]');
    const now = Date.now();
    const pendingNudges = [];

    for (const nudge of nudges) {
      if (nudge.scheduledFor <= now) {
        await this.showNotification(
          nudge.companionName,
          nudge.message
        );
      } else {
        pendingNudges.push(nudge);
      }
    }

    localStorage.setItem('scheduled_nudges', JSON.stringify(pendingNudges));
  }

  static clearAllNudges(companionId?: string): void {
    if (companionId) {
      const nudges = JSON.parse(localStorage.getItem('scheduled_nudges') || '[]');
      const filtered = nudges.filter((n: any) => n.companionId !== companionId);
      localStorage.setItem('scheduled_nudges', JSON.stringify(filtered));
    } else {
      localStorage.removeItem('scheduled_nudges');
    }
  }

  static async initializeNotifications(): Promise<void> {
    const permission = await this.requestPermission();
    if (permission) {
      console.log('✅ Notifications enabled');
      await this.checkScheduledNudges();
    } else {
      console.log('ℹ️ Notifications not enabled - user can enable later');
    }
  }
}
