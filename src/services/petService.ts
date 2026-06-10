import { supabase } from '../shared/supabase/client';

export interface PetStats {
  hunger: number;
  mood:   number;
  clean:  number;
  xp:     number;
  level:  number;
}

export interface PetState extends PetStats {
  petName:    string;
  animalType: 'cat' | 'bunny';
}

export const DEFAULT_PET_STATE: PetState = {
  petName:    'Mochi',
  animalType: 'cat',
  hunger:     82,
  mood:       78,
  clean:      90,
  xp:         0,
  level:      1,
};

export const XP_THRESHOLDS = [0, 50, 150, 300, 500, 750, 1100, 1500, 2000, 2600];

export function xpToLevel(xp: number): number {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export const petService = {
  async load(userId: string, companionId: string): Promise<PetState | null> {
    const { data, error } = await supabase
      .from('pet_state')
      .select('*')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .maybeSingle();

    if (error) { console.error('[petService] load error', error); return null; }
    if (!data) return null;

    return {
      petName:    data.pet_name,
      animalType: data.animal_type as 'cat' | 'bunny',
      hunger:     data.hunger,
      mood:       data.mood,
      clean:      data.clean,
      xp:         data.xp,
      level:      data.level,
    };
  },

  async init(userId: string, companionId: string): Promise<PetState> {
    const { data, error } = await supabase
      .from('pet_state')
      .upsert({
        user_id:      userId,
        companion_id: companionId,
        pet_name:     DEFAULT_PET_STATE.petName,
        animal_type:  DEFAULT_PET_STATE.animalType,
        hunger:       DEFAULT_PET_STATE.hunger,
        mood:         DEFAULT_PET_STATE.mood,
        clean:        DEFAULT_PET_STATE.clean,
        xp:           DEFAULT_PET_STATE.xp,
        level:        DEFAULT_PET_STATE.level,
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'user_id,companion_id', ignoreDuplicates: true })
      .select()
      .maybeSingle();

    if (error) console.error('[petService] init error', error);
    if (data) {
      return {
        petName:    data.pet_name,
        animalType: data.animal_type as 'cat' | 'bunny',
        hunger:     data.hunger,
        mood:       data.mood,
        clean:      data.clean,
        xp:         data.xp,
        level:      data.level,
      };
    }
    return { ...DEFAULT_PET_STATE };
  },

  async save(userId: string, companionId: string, state: PetStats & { petName?: string; animalType?: string }): Promise<void> {
    const { error } = await supabase
      .from('pet_state')
      .upsert({
        user_id:      userId,
        companion_id: companionId,
        pet_name:     state.petName ?? DEFAULT_PET_STATE.petName,
        animal_type:  state.animalType ?? DEFAULT_PET_STATE.animalType,
        hunger:       Math.max(0, Math.min(100, state.hunger)),
        mood:         Math.max(0, Math.min(100, state.mood)),
        clean:        Math.max(0, Math.min(100, state.clean)),
        xp:           Math.max(0, state.xp),
        level:        Math.max(1, Math.min(10, state.level)),
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'user_id,companion_id' });

    if (error) console.error('[petService] save error', error);
  },

  async rename(userId: string, companionId: string, petName: string): Promise<void> {
    const { error } = await supabase
      .from('pet_state')
      .update({ pet_name: petName, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('companion_id', companionId);
    if (error) console.error('[petService] rename error', error);
  },
};
