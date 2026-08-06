import { supabase } from '../shared/supabase/client';

export type NaviVoice = 'masculine' | 'feminine';

export interface LocalExplorerConversation {
  id: string;
  user_id: string;
  title: string;
  location_snapshot: string | null;
  voice: NaviVoice | null;
  created_at: string;
  updated_at: string;
}

export interface LocalExplorerMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  structured_results: LocalResult[];
  created_at: string;
}

export interface LocalResult {
  type: 'event' | 'restaurant' | 'news' | 'activity';
  title: string;
  url?: string;
  description?: string;
  date?: string;
  location?: string;
  source?: string;
}

export interface LocalCalendarEvent {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
  location?: string;
}

export interface LocalMeta {
  searchPerformed: boolean;
  searchQueries: string[];
  intentType: string;
  locationCity: string;
  searchAreaLabel: string;
  activeSearchCity: string;
}

export interface UserLocation {
  city: string;
  lat?: number;
  lng?: number;
}

export const localExplorerService = {
  async getConversations(): Promise<LocalExplorerConversation[]> {
    const { data, error } = await supabase
      .from('local_explorer_conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createConversation(title: string, locationCity?: string, voice?: NaviVoice): Promise<LocalExplorerConversation> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('local_explorer_conversations')
      .insert({
        user_id: user.id,
        title: title || 'Local Explorer',
        location_snapshot: locationCity || null,
        voice: voice || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateConversationVoice(id: string, voice: NaviVoice): Promise<void> {
    const { error } = await supabase
      .from('local_explorer_conversations')
      .update({ voice })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getDefaultVoice(): Promise<NaviVoice | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('user_profiles')
      .select('navi_default_voice')
      .eq('id', user.id)
      .maybeSingle();
    return (data?.navi_default_voice as NaviVoice | null) ?? null;
  },

  async saveDefaultVoice(voice: NaviVoice | null): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('user_profiles')
      .update({ navi_default_voice: voice })
      .eq('id', user.id);
  },

  async updateConversationTitle(id: string, title: string): Promise<void> {
    const { error } = await supabase
      .from('local_explorer_conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async touchConversation(id: string): Promise<void> {
    await supabase
      .from('local_explorer_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);
  },

  async deleteConversation(id: string): Promise<void> {
    const { error } = await supabase
      .from('local_explorer_conversations')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getMessages(conversationId: string): Promise<LocalExplorerMessage[]> {
    const { data, error } = await supabase
      .from('local_explorer_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async insertMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    structuredResults: LocalResult[] = [],
  ): Promise<LocalExplorerMessage> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('local_explorer_messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role,
        content,
        structured_results: structuredResults,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async saveLocation(location: UserLocation): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('user_profiles')
      .update({
        location_city: location.city,
        location_lat: location.lat ?? null,
        location_lng: location.lng ?? null,
      })
      .eq('id', user.id);
  },

  async getSavedLocation(): Promise<UserLocation | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('user_profiles')
      .select('location_city, location_lat, location_lng')
      .eq('id', user.id)
      .maybeSingle();
    if (!data?.location_city) return null;
    return {
      city: data.location_city,
      lat: data.location_lat ?? undefined,
      lng: data.location_lng ?? undefined,
    };
  },

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    const STATE_ABBR: Record<string, string> = {
      Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
      Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
      Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
      Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
      Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS',
      Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH',
      'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC',
      'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA',
      'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN',
      Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA',
      'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY', 'District of Columbia': 'DC',
    };
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'User-Agent': 'VelvetApp/1.0' } },
      );
      if (!res.ok) throw new Error('Nominatim error');
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || '';
      const stateFull = addr.state || '';
      const country = addr.country_code?.toUpperCase() || '';
      if (city && stateFull && country === 'US') {
        const stateAbbr = STATE_ABBR[stateFull] || stateFull;
        return `${city}, ${stateAbbr}`;
      }
      if (city && country) return `${city}, ${country}`;
      return data.display_name?.split(',').slice(0, 2).join(',').trim() || 'Unknown location';
    } catch {
      return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
    }
  },

  async sendMessage(
    _conversationId: string,
    userMessage: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    location: UserLocation,
    userName?: string,
    onChunk?: (chunk: string) => void,
    onMeta?: (meta: LocalMeta) => void,
    onCalendarEvent?: (event: LocalCalendarEvent) => void,
    personProfile?: {
      name?: string;
      relationship?: string;
      birthday?: string | null;
      city?: string | null;
      state?: string | null;
      favorite_color?: string | null;
      hobbies?: string[];
      favorite_foods?: string[];
      dietary_restrictions?: string[];
      favorite_tv_shows?: string[];
      movie_genres?: string[];
      sports_teams?: string[];
      music_genres?: string[];
      travel_destinations?: string[];
      clothing_size_shirt?: string | null;
      clothing_size_shoe?: string | null;
      clothing_size_dress?: string | null;
      ring_size?: string | null;
      things_mentioned_wanting?: string | null;
    } | null,
  ): Promise<{ text: string; meta: LocalMeta }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Authentication required');

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/local-explorer`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        history: history.slice(-16),
        locationCity: location.city,
        locationLat: location.lat,
        locationLng: location.lng,
        userName,
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        personProfile: personProfile || undefined,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(err.error || `Request failed: ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let meta: LocalMeta = {
      searchPerformed: false,
      searchQueries: [],
      intentType: 'general',
      locationCity: location.city,
      searchAreaLabel: location.city,
      activeSearchCity: location.city,
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed);
          if (event.type === 'meta') {
            meta = {
              searchPerformed: event.searchPerformed === true,
              searchQueries: event.searchQueries || [],
              intentType: event.intentType || 'general',
              locationCity: event.locationCity || location.city,
              searchAreaLabel: event.searchAreaLabel || event.locationCity || location.city,
              activeSearchCity: event.activeSearchCity || event.locationCity || location.city,
            };
            onMeta?.(meta);
          } else if (event.type === 'text') {
            fullText += event.chunk;
            onChunk?.(event.chunk);
          } else if (event.type === 'calendar_event_added' && event.event) {
            onCalendarEvent?.(event.event as LocalCalendarEvent);
          }
        } catch {
          // skip malformed
        }
      }
    }

    return { text: fullText, meta };
  },
};
