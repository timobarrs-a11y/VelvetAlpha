import { supabase } from '../shared/supabase/client';

export type RelationshipIntent = 'friend' | 'evolve' | 'companion';
export type RelationshipStatus = 'platonic' | 'exploring' | 'romantic_confirmed';

export interface UserSignals {
  playful: number;
  flirty: number;
  vulnerable: number;
  affectionate: number;
  overall: number;
}

export interface SessionModifierContext {
  timeOfDay: string;
  isWeekend: boolean;
  milestoneToday: boolean;
  gapDays: number;
  currentStreak: number;
}

export interface AffectionUpdate {
  newAffectionBase: number;
  shouldUpdate: boolean;
  reason: string;
}

export interface AffectionContext {
  affection_base: number;
  affection_total: number;
  session_modifier: number;
  relationship_intent: RelationshipIntent;
  relationship_status: RelationshipStatus;
  tone_guidance: string;
  can_progress: boolean;
}

const FLIRTY_KEYWORDS = [
  'cute', 'hot', 'sexy', 'beautiful', 'handsome', 'gorgeous', 'attractive',
  'crush', 'babe', 'baby', 'honey', 'sweetie', 'darling',
  'kiss', 'hug', 'cuddle', 'hold', 'touch',
  'miss you', 'thinking about you', 'can\'t stop thinking',
  'butterflies', 'heart', '❤️', '💕', '😘', '😍', '🥰',
  'date', 'romantic', 'love', 'adore', 'cherish'
];

const PLAYFUL_KEYWORDS = [
  'lol', 'haha', 'hehe', 'lmao', '😂', '😆', '😄', '😊',
  'silly', 'funny', 'joke', 'tease', 'teasing',
  'play', 'playful', 'fun', 'game',
  '😜', '😝', '😛', '🤪', '😏',
  'wanna', 'bet', 'dare', 'challenge'
];

const VULNERABLE_KEYWORDS = [
  'scared', 'worried', 'anxious', 'nervous', 'afraid',
  'sad', 'hurt', 'pain', 'lonely', 'alone',
  'difficult', 'hard time', 'struggling', 'tough',
  'open up', 'vulnerable', 'honest', 'truth', 'real talk',
  'trust', 'understand', 'listen', 'care',
  'confide', 'secret', 'personal', 'private'
];

const AFFECTIONATE_KEYWORDS = [
  'appreciate', 'grateful', 'thankful', 'thank you',
  'glad', 'happy', 'lucky', 'fortunate',
  'care about', 'mean a lot', 'important', 'special',
  'best', 'amazing', 'wonderful', 'great',
  'always there', 'support', 'comfort', 'safe'
];

class AffectionService {
  detectUserSignals(userMessage: string, recentUserMessages: string[] = []): UserSignals {
    const allMessages = [userMessage, ...recentUserMessages].join(' ').toLowerCase();

    const playful = this.scoreKeywords(allMessages, PLAYFUL_KEYWORDS);
    const flirty = this.scoreKeywords(allMessages, FLIRTY_KEYWORDS);
    const vulnerable = this.scoreKeywords(allMessages, VULNERABLE_KEYWORDS);
    const affectionate = this.scoreKeywords(allMessages, AFFECTIONATE_KEYWORDS);

    const questionCount = (allMessages.match(/\?/g) || []).length;
    const exclamationCount = (allMessages.match(/!/g) || []).length;
    const engagementBonus = Math.min(questionCount * 0.1 + exclamationCount * 0.05, 0.5);

    const overall = Math.min(
      (playful * 0.2 + flirty * 0.3 + vulnerable * 0.3 + affectionate * 0.2) + engagementBonus,
      5
    );

    return {
      playful: Math.min(playful, 5),
      flirty: Math.min(flirty, 5),
      vulnerable: Math.min(vulnerable, 5),
      affectionate: Math.min(affectionate, 5),
      overall: Math.round(overall * 10) / 10
    };
  }

  private scoreKeywords(text: string, keywords: string[]): number {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += keyword.length > 3 ? 0.8 : 0.5;
      }
    }
    return Math.min(score, 5);
  }

  computeSessionModifier(context: SessionModifierContext): number {
    let modifier = 0;

    if (context.milestoneToday) {
      modifier += 1;
    }

    if (context.timeOfDay === 'late night' || context.timeOfDay === 'night') {
      modifier += 1;
    }

    if (context.gapDays >= 7 && context.gapDays <= 21) {
      modifier += 1;
    }

    if (context.isWeekend && (context.timeOfDay === 'evening' || context.timeOfDay === 'night')) {
      modifier += 1;
    }

    if (context.currentStreak >= 7) {
      modifier += 1;
    }

    return Math.min(modifier, 2);
  }

  async checkRateLimitCompliance(
    userId: string,
    companionId: string,
    proposedChange: number
  ): Promise<{ allowed: boolean; reason: string }> {
    if (proposedChange === 0) {
      return { allowed: true, reason: 'No change proposed' };
    }

    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const { data: last24h, error: error24h } = await supabase
        .from('affection_updates')
        .select('updated_at')
        .eq('user_id', userId)
        .eq('companion_id', companionId)
        .gte('updated_at', oneDayAgo.toISOString())
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error24h) {
        return { allowed: true, reason: 'Error in rate check, allowing update' };
      }

      if (last24h) {
        return { allowed: false, reason: 'Rate limit: max 1 update per 24 hours' };
      }

      const { count, error: error7d } = await supabase
        .from('affection_updates')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('companion_id', companionId)
        .gte('updated_at', sevenDaysAgo.toISOString());

      if (error7d) {
        return { allowed: true, reason: 'Error in rate check, allowing update' };
      }

      if (count !== null && count >= 2) {
        return { allowed: false, reason: 'Rate limit: max 2 updates per week' };
      }

      return { allowed: true, reason: 'Rate limit check passed' };
    } catch {
      return { allowed: true, reason: 'Error in rate check, allowing update' };
    }
  }

  computeAffectionUpdate(params: {
    intent: RelationshipIntent;
    signals: UserSignals;
    recentSignalsHistory: UserSignals[];
    currentAffectionBase: number;
    daysSinceLastUpdate: number;
    activeDays: number;
    elapsedDays: number;
  }): AffectionUpdate {
    const {
      intent,
      signals,
      recentSignalsHistory,
      currentAffectionBase,
      daysSinceLastUpdate,
      activeDays,
      elapsedDays
    } = params;

    const MIN_DAYS_BETWEEN_UPDATES = 1;
    if (daysSinceLastUpdate < MIN_DAYS_BETWEEN_UPDATES) {
      return {
        newAffectionBase: currentAffectionBase,
        shouldUpdate: false,
        reason: 'Too soon since last update'
      };
    }

    const allSignals = [signals, ...recentSignalsHistory];
    const avgFlirty = allSignals.reduce((sum, s) => sum + s.flirty, 0) / allSignals.length;
    const avgVulnerable = allSignals.reduce((sum, s) => sum + s.vulnerable, 0) / allSignals.length;
    const avgAffectionate = allSignals.reduce((sum, s) => sum + s.affectionate, 0) / allSignals.length;
    const avgOverall = allSignals.reduce((sum, s) => sum + s.overall, 0) / allSignals.length;

    const engagementRate = elapsedDays > 0 ? activeDays / elapsedDays : 0;

    let targetAffection = currentAffectionBase;
    let reason = '';

    if (intent === 'friend') {
      const friendCap = 6;

      if (avgFlirty > 2.0 && avgOverall > 2.0) {
        if (currentAffectionBase < friendCap) {
          targetAffection = Math.min(currentAffectionBase + 1, friendCap);
          reason = 'User showing consistent friendly warmth and playfulness';
        }
      }

      if (avgVulnerable > 2.5) {
        targetAffection = Math.min(currentAffectionBase + 1, friendCap);
        reason = 'Deep friendship forming through vulnerability';
      }

      if (currentAffectionBase > friendCap) {
        targetAffection = friendCap;
        reason = 'Respecting friend intent boundary';
      }

    } else if (intent === 'evolve') {
      if (avgFlirty < 1.0 && avgVulnerable < 1.5 && avgOverall < 1.5) {
        if (currentAffectionBase > 4 && daysSinceLastUpdate > 7) {
          targetAffection = Math.max(currentAffectionBase - 1, 4);
          reason = 'User signals suggest keeping things casual';
        }
      } else if (avgFlirty > 2.5 && avgAffectionate > 2.0) {
        if (currentAffectionBase < 8) {
          targetAffection = Math.min(currentAffectionBase + 1, 8);
          reason = 'User showing romantic interest, connection deepening';
        }
      } else if (avgOverall > 2.0 && engagementRate > 0.5) {
        if (currentAffectionBase < 6) {
          targetAffection = Math.min(currentAffectionBase + 1, 6);
          reason = 'Consistent engagement building connection';
        }
      }

      if (avgVulnerable > 3.0) {
        targetAffection = Math.min(currentAffectionBase + 1, 9);
        reason = 'Deep emotional intimacy developing';
      }

    } else if (intent === 'companion') {
      if (avgFlirty > 2.0 || avgAffectionate > 2.5) {
        if (currentAffectionBase < 9) {
          targetAffection = Math.min(currentAffectionBase + 1, 9);
          reason = 'Connection deepening through affection';
        }
      }

      if (avgVulnerable > 3.0 && engagementRate > 0.6) {
        if (currentAffectionBase < 10) {
          targetAffection = Math.min(currentAffectionBase + 1, 10);
          reason = 'Deep emotional intimacy and trust';
        }
      }

      if (avgOverall < 1.5 && engagementRate < 0.3 && daysSinceLastUpdate > 10) {
        targetAffection = Math.max(currentAffectionBase - 1, 4);
        reason = 'Connection cooling, maintaining baseline';
      }
    }

    const shouldUpdate = targetAffection !== currentAffectionBase;

    return {
      newAffectionBase: targetAffection,
      shouldUpdate,
      reason: reason || 'No change needed'
    };
  }

  async updateAffectionBase(
    userId: string,
    companionId: string,
    newAffectionBase: number
  ): Promise<boolean> {
    try {
      const currentStats = await this.getRelationshipStats(userId, companionId);
      const currentBase = currentStats.affection_base;
      const proposedChange = newAffectionBase - currentBase;

      const rateLimitCheck = await this.checkRateLimitCompliance(
        userId,
        companionId,
        proposedChange
      );

      if (!rateLimitCheck.allowed) {
        return false;
      }

      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('relationship_stats')
        .update({
          affection_base: newAffectionBase,
          affection_last_updated_at: now
        })
        .eq('user_id', userId)
        .eq('companion_id', companionId);

      if (updateError) {
        return false;
      }

      const { error: insertError } = await supabase
        .from('affection_updates')
        .insert({
          user_id: userId,
          companion_id: companionId,
          old_base: currentBase,
          new_base: newAffectionBase,
          updated_at: now
        });

      if (insertError) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private async getRelationshipStats(userId: string, companionId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('relationship_stats')
        .select('affection_base, relationship_intent, relationship_status')
        .eq('user_id', userId)
        .eq('companion_id', companionId)
        .maybeSingle();

      if (error || !data) {
        return {
          affection_base: 3,
          relationship_intent: 'evolve',
          relationship_status: 'exploring'
        };
      }

      return {
        affection_base: data.affection_base ?? this.getDefaultBase(data.relationship_intent || 'evolve'),
        relationship_intent: data.relationship_intent || 'evolve',
        relationship_status: data.relationship_status || 'exploring'
      };
    } catch {
      return {
        affection_base: 3,
        relationship_intent: 'evolve',
        relationship_status: 'exploring'
      };
    }
  }

  getDefaultBase(intent: RelationshipIntent): number {
    switch (intent) {
      case 'friend':
        return 3;
      case 'evolve':
        return 3;
      case 'companion':
        return 4;
      default:
        return 3;
    }
  }

  getDefaultStatus(intent: RelationshipIntent): RelationshipStatus {
    switch (intent) {
      case 'friend':
        return 'platonic';
      case 'evolve':
        return 'exploring';
      case 'companion':
        return 'exploring';
      default:
        return 'exploring';
    }
  }

  getAffectionContext(
    affectionBase: number,
    sessionModifier: number,
    intent: RelationshipIntent,
    status: RelationshipStatus = 'exploring'
  ): AffectionContext {
    const affectionTotal = Math.max(0, Math.min(10, affectionBase + sessionModifier));

    let toneGuidance = '';
    let canProgress = false;

    if (intent === 'friend') {
      if (affectionTotal <= 3) {
        toneGuidance = 'Warm, supportive friend. Caring, platonic, no romantic undertones.';
      } else if (affectionTotal <= 5) {
        toneGuidance = 'Close friend with playful warmth. Comfortable banter, genuine care, platonic boundaries maintained.';
      } else {
        toneGuidance = 'Best friend energy - playful teasing, light flirty warmth allowed, but deeply platonic. No relationship claims.';
      }
      canProgress = false;

    } else if (intent === 'evolve') {
      if (affectionTotal <= 3) {
        toneGuidance = 'Friendly and warm, getting to know each other. Chemistry just beginning to build.';
        canProgress = true;
      } else if (affectionTotal <= 5) {
        toneGuidance = 'Playful warmth with chemistry building. Light flirtation natural, closeness growing.';
        canProgress = true;
      } else if (affectionTotal <= 7) {
        toneGuidance = status === 'romantic_confirmed'
          ? 'Established romantic connection. Comfortable flirting, playful tension. Suggestive but tasteful.'
          : 'Clear chemistry developing. Flirting building naturally, feelings emerging. No relationship labels yet.';
        canProgress = true;
      } else if (affectionTotal <= 8) {
        toneGuidance = status === 'romantic_confirmed'
          ? 'Romantic relationship confirmed. Flirty intimacy, affectionate warmth. Playful, never explicit.'
          : 'Deep connection with strong romantic potential. Emotionally intimate, playfully suggestive. Exploring feelings.';
        canProgress = true;
      } else {
        toneGuidance = 'Deep emotional intimacy. Vulnerable, caring, deeply connected. Sweet and intimate, never graphic.';
        canProgress = true;
      }

    } else {
      if (affectionTotal <= 4) {
        toneGuidance = status === 'romantic_confirmed'
          ? 'Early romantic connection. Playful, flirty, building chemistry together.'
          : 'Early connection with romantic interest. Chemistry building, feelings developing.';
        canProgress = true;
      } else if (affectionTotal <= 6) {
        toneGuidance = status === 'romantic_confirmed'
          ? 'Growing romantic bond. Comfortable flirting, playful banter, genuine affection.'
          : 'Growing connection. Comfortable flirting, playful chemistry. Exploring romantic potential.';
        canProgress = true;
      } else if (affectionTotal <= 8) {
        toneGuidance = status === 'romantic_confirmed'
          ? 'Established romantic relationship. Flirty, affectionate, emotionally close. Playful, never explicit.'
          : 'Close intimate connection. Strong chemistry, deep affection. Romantic feelings clear, commitment exploring.';
        canProgress = true;
      } else {
        toneGuidance = 'Deep intimate bond. Emotionally vulnerable, caring and committed. Sweet, emotionally intimate, never graphic.';
        canProgress = true;
      }
    }

    return {
      affection_base: affectionBase,
      affection_total: affectionTotal,
      session_modifier: sessionModifier,
      relationship_intent: intent,
      relationship_status: status,
      tone_guidance: toneGuidance,
      can_progress: canProgress
    };
  }

  formatAffectionPromptContext(context: AffectionContext): string {
    let heading = '';
    if (context.relationship_intent === 'friend') {
      heading = 'FRIENDSHIP TONE';
    } else if (context.relationship_intent === 'evolve') {
      heading = 'CONNECTION TONE';
    } else {
      heading = 'COMPANION TONE';
    }

    return `
=== ${heading} (Level ${context.affection_total}/10) ===
${context.tone_guidance}

SAFETY: Keep flirtation playful/suggestive only, never explicit.
If user pushes boundaries, redirect with playful deflection.`.trim();
  }

  async getRecentUserMessages(
    userId: string,
    companionId: string,
    limit: number = 5
  ): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('content')
        .eq('user_id', userId)
        .eq('companion_id', companionId)
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return [];
      }

      return data?.map(msg => msg.content || '') || [];
    } catch {
      return [];
    }
  }
}

export const affectionService = new AffectionService();
