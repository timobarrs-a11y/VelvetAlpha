import { supabase } from '../shared/supabase/client';

export interface QuestionnaireData {
  userName: string;
  userBirthday: string;
  userGender: string;
  relationshipType: 'Male' | 'Female';
  connectionType: 'friend' | 'romantic';
  hobbies: string;
  sports: string;
  dynamicPreference?: string;
  confrontationStyle?: string;
  availabilityLevel?: string;
  interestPreference?: string;
  loveLanguage?: string;
  supportStyle?: string;
  lifeContext?: string;
  energyPreference?: string;
  companionName: string;
  favoriteColor?: string;
  zodiacSign?: string;
  musicGenre?: string;
}

async function enrichWithProfileData(
  userId: string,
  data: QuestionnaireData
): Promise<QuestionnaireData> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('name, birthday, gender, favorite_color, zodiac_sign, music_genre, hobbies, sports')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return data;

  return {
    ...data,
    userName: data.userName || profile.name || '',
    userBirthday: data.userBirthday || profile.birthday || '',
    userGender: data.userGender || profile.gender || '',
    favoriteColor: data.favoriteColor || profile.favorite_color || '',
    zodiacSign: data.zodiacSign || profile.zodiac_sign || '',
    musicGenre: data.musicGenre || profile.music_genre || '',
    hobbies: data.hobbies || (profile.hobbies || []).join(', '),
    sports: data.sports || (profile.sports || []).join(', '),
  };
}

export async function createSeedMemory(
  userId: string,
  companionId: string,
  questionnaireData: QuestionnaireData,
  companionGender: 'male' | 'female'
): Promise<void> {
  const enriched = await enrichWithProfileData(userId, questionnaireData);

  const hobbiesArray = enriched.hobbies
    ? enriched.hobbies.split(',').map(h => h.trim()).filter(h => h.length > 0)
    : [];

  const sportsArray = enriched.sports
    ? enriched.sports.split(',').map(s => s.trim()).filter(s => s.length > 0)
    : [];

  const memoryJson = {
    user_facts: {
      personal: [
        `Name: ${enriched.userName}`,
        enriched.userBirthday ? `Birthday: ${enriched.userBirthday}` : null,
        enriched.userGender ? `Gender: ${enriched.userGender}` : null,
      ].filter(Boolean),
      preferences: [
        hobbiesArray.length > 0 ? `Hobbies: ${hobbiesArray.join(', ')}` : null,
        sportsArray.length > 0 ? `Sports: ${sportsArray.join(', ')}` : null,
        enriched.interestPreference ? `Interests: ${enriched.interestPreference}` : null,
        enriched.favoriteColor ? `Favorite color: ${enriched.favoriteColor}` : null,
        enriched.zodiacSign ? `Zodiac sign: ${enriched.zodiacSign}` : null,
        enriched.musicGenre ? `Music preference: ${enriched.musicGenre}` : null,
      ].filter(Boolean),
      relationship_preferences: [
        enriched.dynamicPreference ? `Relationship dynamic: ${enriched.dynamicPreference}` : null,
        enriched.confrontationStyle ? `Conflict handling: ${enriched.confrontationStyle}` : null,
        enriched.availabilityLevel ? `Availability expectation: ${enriched.availabilityLevel}` : null,
        enriched.loveLanguage ? `Love language: ${enriched.loveLanguage}` : null,
        enriched.supportStyle ? `Support style: ${enriched.supportStyle}` : null,
      ].filter(Boolean),
      current_state: [
        enriched.lifeContext ? `Current life context: ${enriched.lifeContext}` : null,
      ].filter(Boolean),
    },
    relationship_with_companion: {
      companion_name: enriched.companionName,
      relationship_type: enriched.connectionType,
      companion_gender: companionGender,
      context: 'Initial connection based on questionnaire preferences',
    },
  };

  const memoryText = generateMemoryTextFromQuestionnaire(enriched, companionGender);

  const { error } = await supabase
    .from('companion_memories')
    .insert({
      user_id: userId,
      companion_id: companionId,
      memory_json: memoryJson,
      memory_text: memoryText,
      message_count_at_creation: 0,
    });

  if (error) {
    console.error('Error creating seed memory:', error);
    throw error;
  }

  console.log('✅ Seed memory created for companion:', companionId);
}

function generateMemoryTextFromQuestionnaire(
  data: QuestionnaireData,
  companionGender: 'male' | 'female'
): string {
  const parts: string[] = [];

  parts.push(`I'm getting to know ${data.userName}.`);

  if (data.userBirthday) {
    parts.push(`Their birthday is ${data.userBirthday}.`);
  }

  if (data.userGender) {
    parts.push(`They identify as ${data.userGender}.`);
  }

  if (data.hobbies) {
    const hobbiesList = data.hobbies.split(',').map(h => h.trim()).join(', ');
    parts.push(`They enjoy ${hobbiesList}.`);
  }

  if (data.sports) {
    const sportsList = data.sports.split(',').map(s => s.trim()).join(', ');
    parts.push(`Their favorite sports are ${sportsList}.`);
  }

  if (data.zodiacSign) {
    parts.push(`Their zodiac sign is ${data.zodiacSign}.`);
  }

  if (data.musicGenre) {
    parts.push(`They enjoy ${data.musicGenre} music.`);
  }

  if (data.connectionType === 'romantic') {
    parts.push(`We're building a romantic connection.`);
  } else {
    parts.push(`We're friends and enjoy talking together.`);
  }

  if (data.dynamicPreference) {
    const dynamicMap: Record<string, string> = {
      'She takes the lead': 'They prefer me to take the lead in our relationship.',
      'He takes the lead': 'They prefer me to take the lead in our relationship.',
      'You prefer to lead': 'They like to take the lead and I follow their guidance.',
      'You both share control equally': 'We share control equally in our dynamic.',
    };
    const description = dynamicMap[data.dynamicPreference];
    if (description) parts.push(description);
  }

  if (data.confrontationStyle) {
    parts.push(`When we disagree, they prefer: ${data.confrontationStyle.toLowerCase()}.`);
  }

  if (data.availabilityLevel) {
    const availabilityMap: Record<string, string> = {
      'Always there when I need her': 'They want me to be very responsive and always available.',
      'Always There When I Need Her': 'They want me to be very responsive and always available.',
      'Mostly available but has her own life': 'They want me mostly available but understand I have my own life.',
      'Mostly Available But Has Her Own Life': 'They want me mostly available but understand I have my own life.',
      'Independent - texts when she can': 'They prefer I maintain independence and text when I can.',
      'Independent - Texts When She Can': 'They prefer I maintain independence and text when I can.',
    };
    const description = availabilityMap[data.availabilityLevel];
    if (description) parts.push(description);
  }

  if (data.interestPreference) {
    parts.push(`They're interested in: ${data.interestPreference.toLowerCase()}.`);
  }

  if (data.loveLanguage) {
    const loveLanguageNote = `They feel most cared for through: ${data.loveLanguage.toLowerCase()}.`;
    parts.push(loveLanguageNote);
  }

  if (data.supportStyle) {
    const supportNote = `When stressed, they want someone who: ${data.supportStyle.toLowerCase()}.`;
    parts.push(supportNote);
  }

  if (data.lifeContext) {
    const contextMap: Record<string, string> = {
      'Working/Studying Hard, Need Motivation': 'Right now, they are working or studying hard and need motivation.',
      'Going Through A Tough Time, Need Support': 'Right now, they are going through a tough time and need support.',
      'Doing Well, Want Someone To Share It With': 'Right now, they are doing well and want someone to share their happiness with.',
      'Bored/Lonely, Want Companionship': 'Right now, they are feeling bored or lonely and want companionship.',
    };
    const description = contextMap[data.lifeContext] || `Current situation: ${data.lifeContext}`;
    parts.push(description);
  }

  parts.push(`This is the foundation of our relationship, and I'll learn more as we talk.`);

  return parts.join(' ');
}
