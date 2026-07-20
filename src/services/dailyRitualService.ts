import { supabase } from '../shared/supabase/client';
import { ProactiveMessageService } from './proactiveMessageService';

type RitualType = 'morning' | 'evening' | 'night';

interface DailyRitual {
  id: string;
  user_id: string;
  companion_id: string;
  ritual_type: RitualType;
  last_triggered_at: string | null;
  enabled: boolean;
}

export class DailyRitualService {
  static getCurrentTimeSlot(): RitualType | null {
    const hour = new Date().getHours();

    if (hour >= 6 && hour < 10) return 'morning';
    if (hour >= 18 && hour < 22) return 'evening';
    if (hour >= 22 || hour < 6) return 'night';

    return null;
  }

  static async initializeRitualsForCompanion(userId: string, companionId: string): Promise<void> {
    const ritualTypes: RitualType[] = ['morning', 'evening', 'night'];

    for (const ritualType of ritualTypes) {
      const { data: existing } = await supabase
        .from('daily_rituals')
        .select('id')
        .eq('user_id', userId)
        .eq('companion_id', companionId)
        .eq('ritual_type', ritualType)
        .maybeSingle();

      if (!existing) {
        await supabase
          .from('daily_rituals')
          .insert({
            user_id: userId,
            companion_id: companionId,
            ritual_type: ritualType,
            enabled: true,
          });
      }
    }
  }

  static async shouldTriggerRitual(
    userId: string,
    companionId: string,
    ritualType: RitualType
  ): Promise<boolean> {
    const { data: ritual } = await supabase
      .from('daily_rituals')
      .select('*')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .eq('ritual_type', ritualType)
      .eq('enabled', true)
      .maybeSingle();

    if (!ritual) {
      return false;
    }

    if (!ritual.last_triggered_at) {
      return true;
    }

    const lastTriggered = new Date(ritual.last_triggered_at);
    const now = new Date();

    const hoursSinceLastTrigger = (now.getTime() - lastTriggered.getTime()) / (1000 * 60 * 60);

    return hoursSinceLastTrigger >= 20;
  }

  static async markRitualTriggered(
    userId: string,
    companionId: string,
    ritualType: RitualType
  ): Promise<void> {
    await supabase
      .from('daily_rituals')
      .update({
        last_triggered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .eq('ritual_type', ritualType);
  }

  static async checkAndTriggerRituals(
    userId: string,
    companionId: string,
    companionName: string
  ): Promise<{ shouldSendMessage: boolean; message: string | null; ritualType: RitualType | null }> {
    await this.initializeRitualsForCompanion(userId, companionId);

    const currentTimeSlot = this.getCurrentTimeSlot();

    if (!currentTimeSlot) {
      return { shouldSendMessage: false, message: null, ritualType: null };
    }

    const shouldTrigger = await this.shouldTriggerRitual(userId, companionId, currentTimeSlot);

    if (!shouldTrigger) {
      return { shouldSendMessage: false, message: null, ritualType: null };
    }

    const { data: lastMessage } = await supabase
      .from('conversations')
      .select('created_at')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastMessage) {
      const hoursSinceLastMessage = (Date.now() - new Date(lastMessage.created_at).getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastMessage < 4) {
        return { shouldSendMessage: false, message: null, ritualType: null };
      }
    }

    // Coaches (mentors) get goal-oriented check-ins instead of companion-style
    // ("miss you" / flirty) proactive messages.
    const { data: companionRow } = await supabase
      .from('companions')
      .select('relationship_type, signature_expert, signature_expert_source')
      .eq('id', companionId)
      .maybeSingle();

    let message: string;
    if (companionRow?.relationship_type === 'mentor') {
      let domain: string | undefined;
      try {
        if (companionRow.signature_expert) {
          const { resolveExpert } = await import('./expertService');
          const cfg = await resolveExpert(
            companionRow.signature_expert,
            companionRow.signature_expert_source,
            userId
          );
          domain = cfg?.domain;
        }
      } catch {
        // best-effort domain personalization; fall back to a neutral phrasing
      }
      message = ProactiveMessageService.getCoachScheduledMessage(currentTimeSlot, { domain });
    } else {
      message = ProactiveMessageService.getScheduledMessage(currentTimeSlot);
    }

    await this.markRitualTriggered(userId, companionId, currentTimeSlot);

    return {
      shouldSendMessage: true,
      message,
      ritualType: currentTimeSlot,
    };
  }

  static async deliverRitualMessage(
    userId: string,
    companionId: string,
    message: string
  ): Promise<void> {
    await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        companion_id: companionId,
        role: 'assistant',
        content: message,
      });
  }

  static async scheduleNudge(
    userId: string,
    companionId: string,
    hoursFromNow: number,
    message: string
  ): Promise<void> {
    const scheduledFor = new Date();
    scheduledFor.setHours(scheduledFor.getHours() + hoursFromNow);

    await supabase
      .from('scheduled_messages')
      .insert({
        user_id: userId,
        companion_id: companionId,
        message_content: message,
        scheduled_for: scheduledFor.toISOString(),
        message_type: 'nudge',
      });
  }

  static async checkPendingMessages(
    userId: string,
    companionId: string
  ): Promise<string[]> {
    const { data: messages } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .is('delivered_at', null)
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });

    if (!messages || messages.length === 0) {
      return [];
    }

    const pendingMessages: string[] = [];

    for (const msg of messages) {
      pendingMessages.push(msg.message_content);

      await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          companion_id: companionId,
          role: 'assistant',
          content: msg.message_content,
        });

      await supabase
        .from('scheduled_messages')
        .update({ delivered_at: new Date().toISOString() })
        .eq('id', msg.id);
    }

    return pendingMessages;
  }
}
