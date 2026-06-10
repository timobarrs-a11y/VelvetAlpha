import { supabase } from '../shared/supabase/client';

export interface EditorPreferences {
  font_family: string;
  font_size: string;
  font_color: string;
}

export interface CoAuthorSession {
  id: string;
  user_id: string;
  companion_id: string | null;
  title: string;
  purpose: 'Writing' | 'Research';
  length_preference: '1-2 sentences' | '3-4 sentences' | '1 paragraph' | '2-3 paragraphs';
  session_prompt: string | null;
  editor_preferences: EditorPreferences | null;
  created_at: string;
  last_accessed_at: string;
}

export interface CoAuthorBlock {
  id: string;
  session_id: string;
  block_order: number;
  author_type: 'user' | 'avatar';
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CoAuthorChatMessage {
  id: string;
  session_id: string;
  sender_type: 'user' | 'avatar';
  message_content: string;
  created_at: string;
}

class CoAuthorService {
  async createSession(
    companionId: string,
    title: string = 'Untitled Session',
    purpose: 'Writing' | 'Research' = 'Writing',
    sessionPrompt: string = '',
    lengthPreference: '1-2 sentences' | '3-4 sentences' | '1 paragraph' | '2-3 paragraphs' = '1-2 sentences'
  ): Promise<CoAuthorSession> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('co_author_sessions')
      .insert({
        user_id: user.id,
        companion_id: companionId,
        title,
        purpose,
        length_preference: lengthPreference,
        session_prompt: sessionPrompt || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getSession(sessionId: string): Promise<CoAuthorSession | null> {
    const { data, error } = await supabase
      .from('co_author_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async getUserSessions(): Promise<CoAuthorSession[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('co_author_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('last_accessed_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async updateSession(
    sessionId: string,
    updates: Partial<Pick<CoAuthorSession, 'title' | 'purpose' | 'length_preference' | 'session_prompt'>>
  ): Promise<CoAuthorSession> {
    const { data, error } = await supabase
      .from('co_author_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateLastAccessed(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('co_author_sessions')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) throw error;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('co_author_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;
  }

  async getSessionBlocks(sessionId: string): Promise<CoAuthorBlock[]> {
    const { data, error } = await supabase
      .from('co_author_blocks')
      .select('*')
      .eq('session_id', sessionId)
      .order('block_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createBlock(
    sessionId: string,
    authorType: 'user' | 'avatar',
    content: string,
    blockOrder: number
  ): Promise<CoAuthorBlock> {
    const { data, error } = await supabase
      .from('co_author_blocks')
      .insert({
        session_id: sessionId,
        author_type: authorType,
        content,
        block_order: blockOrder,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateBlock(blockId: string, content: string): Promise<CoAuthorBlock> {
    const { data, error } = await supabase
      .from('co_author_blocks')
      .update({ content })
      .eq('id', blockId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteBlock(blockId: string): Promise<void> {
    const { error } = await supabase
      .from('co_author_blocks')
      .delete()
      .eq('id', blockId);

    if (error) throw error;
  }

  async reorderBlocks(sessionId: string, blockIds: string[]): Promise<void> {
    const updates = blockIds.map((blockId, index) => ({
      id: blockId,
      block_order: index,
    }));

    for (const update of updates) {
      await supabase
        .from('co_author_blocks')
        .update({ block_order: update.block_order })
        .eq('id', update.id);
    }
  }

  async getChatMessages(sessionId: string): Promise<CoAuthorChatMessage[]> {
    const { data, error } = await supabase
      .from('co_author_chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getRecentChatMessages(sessionId: string, limit: number = 10): Promise<CoAuthorChatMessage[]> {
    const { data, error } = await supabase
      .from('co_author_chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).reverse();
  }

  async createChatMessage(
    sessionId: string,
    senderType: 'user' | 'avatar',
    messageContent: string
  ): Promise<CoAuthorChatMessage> {
    const { data, error } = await supabase
      .from('co_author_chat_messages')
      .insert({
        session_id: sessionId,
        sender_type: senderType,
        message_content: messageContent,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getMostRecentAvatarBlock(sessionId: string): Promise<CoAuthorBlock | null> {
    const { data, error } = await supabase
      .from('co_author_blocks')
      .select('*')
      .eq('session_id', sessionId)
      .eq('author_type', 'avatar')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async exportSession(sessionId: string): Promise<string> {
    const session = await this.getSession(sessionId);
    const blocks = await this.getSessionBlocks(sessionId);

    if (!session) throw new Error('Session not found');

    let exportText = `${session.title}\n`;
    exportText += `Purpose: ${session.purpose}\n`;
    exportText += `Created: ${new Date(session.created_at).toLocaleDateString()}\n\n`;
    exportText += '---\n\n';

    blocks.forEach((block) => {
      exportText += `${block.content}\n\n`;
    });

    return exportText;
  }
}

export const coAuthorService = new CoAuthorService();
