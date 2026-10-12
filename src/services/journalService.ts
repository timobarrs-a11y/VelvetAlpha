import { supabase } from '../shared/supabase/client';

export interface JournalSession {
  id: string;
  user_id: string;
  session_date: string;
  phase: 'questions' | 'ratings' | 'revealed' | 'skipped';
  mood_rating: number | null;
  energy_rating: number | null;
  focus_rating: number | null;
  journal_entry: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface JournalQA {
  id: string;
  session_id: string;
  question: string;
  question_key: string | null;
  answer: string | null;
  display_order: number;
  created_at: string;
  answered_at: string | null;
}

export interface JournalSessionWithQA extends JournalSession {
  qa_pairs: JournalQA[];
}

const BASE_QUESTIONS = [
  { key: 'sleep', text: "How did you sleep last night? Did you wake up rested or dragging?" },
  { key: 'priority', text: "What's the one thing that matters most to you today?" },
  { key: 'energy_block', text: "Is anything weighing on your mind or draining your energy before the day even starts?" },
  { key: 'intention', text: "If today went exactly the way you wanted, how would you feel when your head hits the pillow tonight?" },
];

const CONTEXTUAL_QUESTION_BANK = [
  { key: 'weekend_plan', text: "It's the weekend — what would make today feel well-spent?" },
  { key: 'monday_reset', text: "Fresh start to the week — what are you carrying over from last week that you want to handle differently?" },
  { key: 'friday_close', text: "End of the work week — what's something you're proud of from the last few days?" },
  { key: 'social_check', text: "Anyone you've been meaning to reach out to? What's been holding you back?" },
  { key: 'goal_progress', text: "What's one small step you could take toward a goal today?" },
  { key: 'stress_check', text: "What's your stress level telling you right now? Is there a specific source?" },
  { key: 'gratitude', text: "Name one thing you're genuinely grateful for this morning. It can be small." },
];

function pickContextualQuestions(count: number): typeof BASE_QUESTIONS {
  const shuffled = [...CONTEXTUAL_QUESTION_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function getQuestionsForSession(): { key: string; text: string }[] {
  const contextual = pickContextualQuestions(2);
  return [...BASE_QUESTIONS, ...contextual];
}

class JournalService {
  async getOrCreateTodaySession(): Promise<JournalSession> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    const today = new Date().toISOString().split('T')[0];

    const { data: existing } = await supabase
      .from('journal_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_date', today)
      .maybeSingle();

    if (existing) return existing as JournalSession;

    const { data, error } = await supabase
      .from('journal_sessions')
      .insert({
        user_id: user.id,
        session_date: today,
        phase: 'questions',
      })
      .select()
      .maybeSingle();

    if (error) throw new Error(`Failed to create journal session: ${error.message}`);
    if (!data) throw new Error('Journal session creation returned no data');

    return data as JournalSession;
  }

  async createQAEntries(
    sessionId: string,
    questions: { key: string; text: string }[]
  ): Promise<JournalQA[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    const rows = questions.map((q, i) => ({
      session_id: sessionId,
      user_id: user.id,
      question: q.text,
      question_key: q.key,
      display_order: i,
    }));

    const { data, error } = await supabase
      .from('journal_qa')
      .insert(rows)
      .select()
      .order('display_order', { ascending: true });

    if (error) throw new Error(`Failed to create Q&A entries: ${error.message}`);
    return (data || []) as JournalQA[];
  }

  async answerQuestion(qaId: string, answer: string): Promise<void> {
    const { error } = await supabase
      .from('journal_qa')
      .update({
        answer,
        answered_at: new Date().toISOString(),
      })
      .eq('id', qaId);

    if (error) throw new Error(`Failed to save answer: ${error.message}`);
  }

  async saveRatings(
    sessionId: string,
    ratings: { mood: number; energy: number; focus: number }
  ): Promise<void> {
    const { error } = await supabase
      .from('journal_sessions')
      .update({
        mood_rating: ratings.mood,
        energy_rating: ratings.energy,
        focus_rating: ratings.focus,
        phase: 'revealed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) throw new Error(`Failed to save ratings: ${error.message}`);
  }

  async saveJournalEntry(sessionId: string, entry: string): Promise<void> {
    const { error } = await supabase
      .from('journal_sessions')
      .update({
        journal_entry: entry,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) throw new Error(`Failed to save journal entry: ${error.message}`);
  }

  async getSessionWithQA(sessionId: string): Promise<JournalSessionWithQA | null> {
    const { data: session } = await supabase
      .from('journal_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (!session) return null;

    const { data: qa } = await supabase
      .from('journal_qa')
      .select('*')
      .eq('session_id', sessionId)
      .order('display_order', { ascending: true });

    return {
      ...session,
      qa_pairs: (qa || []) as JournalQA[],
    } as JournalSessionWithQA;
  }

  async getTodaySessionWithQA(): Promise<JournalSessionWithQA | null> {
    const session = await this.getOrCreateTodaySession();
    return this.getSessionWithQA(session.id);
  }

  async getRecentSessions(limit: number = 10): Promise<JournalSession[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
      .from('journal_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('session_date', { ascending: false })
      .limit(limit);

    return (data || []) as JournalSession[];
  }

  async getSessionHistory(limit: number = 20): Promise<JournalSessionWithQA[]> {
    const sessions = await this.getRecentSessions(limit);
    const completed = sessions.filter(s => s.journal_entry);

    const result: JournalSessionWithQA[] = [];
    for (const s of completed) {
      const full = await this.getSessionWithQA(s.id);
      if (full) result.push(full);
    }
    return result;
  }

  async generateJournalEntry(sessionId: string): Promise<string> {
    const session = await this.getSessionWithQA(sessionId);
    if (!session) throw new Error('Session not found');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession?.access_token) throw new Error('Not authenticated');

    const response = await fetch(`${supabaseUrl}/functions/v1/generate-journal-entry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authSession.access_token}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        qa_pairs: session.qa_pairs.map(qa => ({
          question: qa.question,
          answer: qa.answer,
        })),
        ratings: {
          mood: session.mood_rating,
          energy: session.energy_rating,
          focus: session.focus_rating,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Journal generation failed (${response.status}): ${errText}`);
    }

    const result = await response.json();
    if (!result.entry || typeof result.entry !== 'string') {
      throw new Error('Journal generation returned invalid data');
    }

    await this.saveJournalEntry(sessionId, result.entry);
    return result.entry;
  }
}

export const journalService = new JournalService();
