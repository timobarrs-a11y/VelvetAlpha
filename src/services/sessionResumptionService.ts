import { supabase } from '../shared/supabase/client';

interface LastSession {
  lastMessageTime: Date;
  lastMessageContent: string;
  lastMessageRole: 'user' | 'assistant';
  hoursSinceLastMessage: number;
}

export class SessionResumptionService {
  static async getLastSession(userId: string, companionId: string): Promise<LastSession | null> {
    const { data: messages } = await supabase
      .from('conversations')
      .select('content, role, created_at')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!messages || messages.length === 0) return null;

    const lastMessage = messages[0];
    const lastMessageTime = new Date(lastMessage.created_at);
    const now = new Date();
    const hoursSinceLastMessage = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);

    return {
      lastMessageTime,
      lastMessageContent: lastMessage.content,
      lastMessageRole: lastMessage.role,
      hoursSinceLastMessage,
    };
  }

  static shouldGenerateResumptionMessage(lastSession: LastSession): boolean {
    return lastSession.hoursSinceLastMessage >= 4;
  }

  static async handleSessionResumption(
    userId: string,
    companionId: string,
    companionName: string,
    companionGender: 'male' | 'female',
    userName: string,
    signatureVoice?: string
  ): Promise<string | null> {
    try {
      const lastSession = await this.getLastSession(userId, companionId);
      if (!lastSession || !this.shouldGenerateResumptionMessage(lastSession)) return null;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/resume-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companionId,
          companionName,
          companionGender,
          userName,
          signatureVoice,
        }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.message || null;
    } catch (error) {
      return null;
    }
  }
}
