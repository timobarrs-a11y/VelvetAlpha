import { supabase } from '../shared/supabase/client';
import { TutorialStep, OnboardingMessage, TourSource } from '../context/TutorialDirectorContext';

export interface OnboardingProgress {
  id: string;
  user_id: string;
  companion_id: string | null;
  companion_name: string;
  companion_personality_snapshot: Record<string, unknown>;
  steps_completed: TutorialStep[];
  current_step: TutorialStep;
  onboarding_complete: boolean;
  tutorial_conversation: OnboardingMessage[];
  tour_source: TourSource;
  last_tour_at: string | null;
  mini_tours_seen: string[];
  created_at: string;
  updated_at: string;
}

export const onboardingService = {
  async getProgress(userId: string): Promise<OnboardingProgress | null> {
    const { data, error } = await supabase
      .from('user_onboarding_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data as OnboardingProgress | null;
  },

  async initProgress(
    userId: string,
    companionId: string,
    companionName: string,
    personalitySnapshot: Record<string, unknown>,
    tourSource: TourSource = 'first_time',
  ): Promise<OnboardingProgress> {
    const { data, error } = await supabase
      .from('user_onboarding_progress')
      .upsert({
        user_id: userId,
        companion_id: companionId,
        companion_name: companionName,
        companion_personality_snapshot: personalitySnapshot,
        steps_completed: [],
        current_step: 'intro',
        onboarding_complete: false,
        tutorial_conversation: [],
        tour_source: tourSource,
        last_tour_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as OnboardingProgress;
  },

  async restartTour(userId: string, tourSource: TourSource = 'manual_replay'): Promise<void> {
    const { error } = await supabase
      .from('user_onboarding_progress')
      .update({
        steps_completed: [],
        current_step: 'intro',
        onboarding_complete: false,
        tutorial_conversation: [],
        tour_source: tourSource,
        last_tour_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  },

  async saveStep(userId: string, step: TutorialStep, stepsCompleted: TutorialStep[]): Promise<void> {
    const { error } = await supabase
      .from('user_onboarding_progress')
      .update({
        current_step: step,
        steps_completed: stepsCompleted,
      })
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  },

  async saveConversation(userId: string, conversation: OnboardingMessage[]): Promise<void> {
    const { error } = await supabase
      .from('user_onboarding_progress')
      .update({ tutorial_conversation: conversation })
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  },

  async markComplete(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_onboarding_progress')
      .update({
        onboarding_complete: true,
        current_step: 'complete',
      })
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  },

  async isComplete(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_onboarding_progress')
      .select('onboarding_complete')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return false;
    return data?.onboarding_complete ?? false;
  },

  async markMiniTourSeen(userId: string, tourId: string): Promise<void> {
    const { data } = await supabase
      .from('user_onboarding_progress')
      .select('mini_tours_seen')
      .eq('user_id', userId)
      .maybeSingle();

    const current = (data?.mini_tours_seen as string[] | null) ?? [];
    if (current.includes(tourId)) return;

    await supabase
      .from('user_onboarding_progress')
      .update({ mini_tours_seen: [...current, tourId] })
      .eq('user_id', userId);
  },
};
