import { supabase } from '../shared/supabase/client';
import type { RealPerson } from './realPeopleService';

export interface BriefOpportunity {
  type: 'gift' | 'event' | 'restaurant' | 'concert' | 'travel' | 'experience' | 'date_idea';
  title: string;
  description: string;
  url?: string;
  relevance: string;
  price_range?: string;
}

export interface BriefInsight {
  type: 'contact_gap' | 'upcoming_event' | 'preference_match' | 'health_trend';
  text: string;
  severity: 'info' | 'warning' | 'urgent';
}

export interface RelationshipBrief {
  id: string;
  user_id: string;
  person_id: string;
  brief_week: string;
  health_score: number;
  contact_gap_days: number;
  upcoming_event_type: string;
  upcoming_event_date: string | null;
  days_until_event: number | null;
  opportunities: BriefOpportunity[];
  insights: BriefInsight[];
  brief_summary: string;
  is_read: boolean;
  created_at: string;
  person?: RealPerson;
}

export interface ContactLogEntry {
  id: string;
  person_id: string;
  contact_type: 'call' | 'text' | 'visit' | 'gift' | 'social_media' | 'other';
  contact_date: string;
  notes: string | null;
  created_at: string;
}

export interface RelationshipHealth {
  person_id: string;
  health_score: number;
  contact_gap_days: number;
  total_contacts: number;
  contacts_last_30_days: number;
  avg_gap_days: number;
}

const BRIEF_ENGINE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/relationship-brief-engine`;

export const relationshipBriefService = {
  async getBriefs(): Promise<RelationshipBrief[]> {
    const { data: briefs, error } = await supabase
      .from('relationship_briefs')
      .select('*')
      .order('brief_week', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    if (!briefs || briefs.length === 0) return [];

    const personIds = [...new Set(briefs.map((b: RelationshipBrief) => b.person_id))];
    const { data: people } = await supabase
      .from('real_people')
      .select('*')
      .in('id', personIds);
    const peopleMap = new Map((people || []).map((p: RealPerson) => [p.id, p]));

    return briefs.map((b: RelationshipBrief) => ({
      ...b,
      person: peopleMap.get(b.person_id),
    })) as RelationshipBrief[];
  },

  async getLatestBriefs(): Promise<RelationshipBrief[]> {
    const { data, error } = await supabase
      .rpc('get_latest_briefs_per_person');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return [];

    const personIds = [...new Set(data.map((b: RelationshipBrief) => b.person_id))];
    const { data: people } = await supabase
      .from('real_people')
      .select('*')
      .in('id', personIds);
    const peopleMap = new Map((people || []).map((p: RealPerson) => [p.id, p]));

    return data.map((b: RelationshipBrief) => ({
      ...b,
      person: peopleMap.get(b.person_id),
    })) as RelationshipBrief[];
  },

  async markRead(briefId: string): Promise<void> {
    const { error } = await supabase
      .from('relationship_briefs')
      .update({ is_read: true })
      .eq('id', briefId);
    if (error) throw new Error(error.message);
  },

  async logAction(
    briefId: string,
    opportunityIndex: number,
    actionType: 'saved' | 'dismissed' | 'completed',
  ): Promise<void> {
    const { error } = await supabase
      .from('relationship_brief_actions')
      .insert({
        brief_id: briefId,
        opportunity_index: opportunityIndex,
        action_type: actionType,
      });
    if (error) throw new Error(error.message);
  },

  async getActions(briefId: string): Promise<Record<number, string>> {
    const { data, error } = await supabase
      .from('relationship_brief_actions')
      .select('opportunity_index, action_type')
      .eq('brief_id', briefId);
    if (error) throw new Error(error.message);
    const map: Record<number, string> = {};
    (data || []).forEach((a: { opportunity_index: number; action_type: string }) => {
      map[a.opportunity_index] = a.action_type;
    });
    return map;
  },

  async getContactLog(personId: string): Promise<ContactLogEntry[]> {
    const { data, error } = await supabase
      .from('relationship_contact_log')
      .select('*')
      .eq('person_id', personId)
      .order('contact_date', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []) as ContactLogEntry[];
  },

  async logContact(
    personId: string,
    contactType: ContactLogEntry['contact_type'],
    contactDate?: string,
    notes?: string,
  ): Promise<void> {
    const { error } = await supabase
      .from('relationship_contact_log')
      .insert({
        person_id: personId,
        contact_type: contactType,
        contact_date: contactDate || new Date().toISOString().split('T')[0],
        notes: notes || null,
      });
    if (error) throw new Error(error.message);
  },

  async deleteContactLog(entryId: string): Promise<void> {
    const { error } = await supabase
      .from('relationship_contact_log')
      .delete()
      .eq('id', entryId);
    if (error) throw new Error(error.message);
  },

  async getHealthForAllPeople(): Promise<RelationshipHealth[]> {
    const { data, error } = await supabase
      .rpc('compute_relationship_health_for_user');
    if (error) throw new Error(error.message);
    return (data || []) as RelationshipHealth[];
  },

  async generateBriefs(): Promise<{ generated: number; message: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(BRIEF_ENGINE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: 'generate' }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Engine failed (${response.status}): ${text}`);
    }
    const result = await response.json();
    return {
      generated: result.generated ?? 0,
      message: result.message ?? 'Briefs generated',
    };
  },
};
