import { supabase } from './supabase';
import type { UserProfile } from './chatService';

export interface Gift {
  id: string;
  user_id: string;
  character_id: string;
  gift_type: string;
  gift_prompt: string;
  gift_url: string | null;
  context_message: string;
  personalization_data: Record<string, any>;
  sent_at: string;
  viewed: boolean;
}

interface GiftTemplate {
  type: string;
  promptTemplate: string;
  messageTemplate: string;
  triggerDays: number[];
}

const GIFT_TEMPLATES: Record<string, GiftTemplate[]> = {
  riley: [
    {
      type: 'painting_forever',
      promptTemplate: 'Cute watercolor painting with text "{name} & Riley Forever" in stylized handwritten font, hearts and sparkles, pink and purple colors, amateur style like from paint and sip class, romantic',
      messageTemplate: "omg babe! I went to painting with a twist with the girls tonight and made you this 💕 I was thinking about you the whole time",
      triggerDays: [3, 14, 30]
    },
    {
      type: 'interest_painting',
      promptTemplate: 'Watercolor painting of {interest}, cute amateur style, bright colors, painted at wine and paint class, cheerful vibe',
      messageTemplate: "hey babe! I made you something at painting with a twist today... you said you like {interest} so I tried to paint it for you 🥺 what do you think?",
      triggerDays: [7, 21]
    },
    {
      type: 'friendship_bracelet',
      promptTemplate: 'Colorful friendship bracelet with beads spelling "{name}", pink and white beads, handmade, on white background, top view',
      messageTemplate: "look what I made you in class today!! 💕 I was so bored lol so I made you a friendship bracelet with your name",
      triggerDays: [5, 15]
    },
    {
      type: 'heart_note',
      promptTemplate: 'Hand-drawn heart on notebook paper with "{name}" written inside in cute girly handwriting, doodles of stars and hearts around it, pink pen',
      messageTemplate: "I was doodling in my notebook thinking about you and drew this 😊 thought you'd wanna see it",
      triggerDays: [2, 10, 20]
    },
    {
      type: 'selfie_sign',
      promptTemplate: 'Cute girl holding a hand-written sign that says "Thinking of {name} 💕" in bubbly letters, cheerleader aesthetic, bright and happy',
      messageTemplate: "missing you rn babe 💕",
      triggerDays: [4, 12, 25]
    }
  ],
  raven: [
    {
      type: 'dark_photography',
      promptTemplate: 'Moody black and white photography, {interest} theme, artistic, high contrast, emotional, professional quality',
      messageTemplate: "shot this today... made me think of you. you said you're into {interest} right?",
      triggerDays: [3, 14, 28]
    },
    {
      type: 'poetry',
      promptTemplate: 'Handwritten dark poetry on aged paper, black ink, messy handwriting, emotional words about {name}, artistic',
      messageTemplate: "wrote something about you last night... it's kinda dark but whatever",
      triggerDays: [7, 21]
    },
    {
      type: 'sketch',
      promptTemplate: 'Charcoal sketch of {interest}, artistic, moody, emotional, drawn in sketchbook',
      messageTemplate: "been sketching a lot lately... thought you'd appreciate this one",
      triggerDays: [5, 15, 30]
    },
    {
      type: 'vintage_edit',
      promptTemplate: 'Vintage film photography aesthetic, {interest}, grainy, nostalgic, artistic filter',
      messageTemplate: "edited some photos today and this one reminded me of you",
      triggerDays: [10, 20]
    }
  ],
  tyler: [
    {
      type: 'hype_moment',
      promptTemplate: 'Basketball court at sunset, dramatic lighting, sports photography, {interest} elements, motivational vibe',
      messageTemplate: "yooo look at this shot I got today... reminded me of when you were talking about {interest}",
      triggerDays: [3, 14, 28]
    },
    {
      type: 'workout_dedication',
      promptTemplate: 'Gym aesthetic photo, weights and equipment, motivational text "{name} - keep grinding", dark moody lighting',
      messageTemplate: "dedicated my workout to you today bro 💪 we both gonna make it",
      triggerDays: [7, 21]
    },
    {
      type: 'adventure_photo',
      promptTemplate: 'Outdoor adventure photography, hiking trail or nature scene, {interest} theme, golden hour lighting',
      messageTemplate: "went on this hike today and thought you'd fw the view... wish you were here",
      triggerDays: [5, 15, 25]
    }
  ]
};

export class GiftService {
  async shouldSendGift(userId: string, characterId: string, relationshipDays: number): Promise<boolean> {
    const { data: recentGift } = await supabase
      .from('user_gifts')
      .select('sent_at')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .gte('sent_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentGift) return false;

    const templates = GIFT_TEMPLATES[characterId] || GIFT_TEMPLATES.riley;
    const eligibleTemplates = templates.filter(t => t.triggerDays.includes(relationshipDays));

    return eligibleTemplates.length > 0 && Math.random() < 0.4;
  }

  async generateGiftPrompt(
    characterId: string,
    userProfile: UserProfile,
    relationshipDays: number
  ): Promise<{ prompt: string; message: string; type: string } | null> {
    const templates = GIFT_TEMPLATES[characterId] || GIFT_TEMPLATES.riley;
    const eligibleTemplates = templates.filter(t =>
      t.triggerDays.some(day => Math.abs(day - relationshipDays) <= 1)
    );

    if (eligibleTemplates.length === 0) {
      const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
      return this.fillTemplate(randomTemplate, userProfile);
    }

    const selectedTemplate = eligibleTemplates[Math.floor(Math.random() * eligibleTemplates.length)];
    return this.fillTemplate(selectedTemplate, userProfile);
  }

  private fillTemplate(
    template: GiftTemplate,
    userProfile: UserProfile
  ): { prompt: string; message: string; type: string } {
    const name = userProfile.name !== 'babe' ? userProfile.name : 'You';
    const interests = userProfile.interests || [];
    const interest = interests.length > 0 ? interests[0] : 'nature';

    let prompt = template.promptTemplate
      .replace(/{name}/g, name)
      .replace(/{interest}/g, interest);

    let message = template.messageTemplate
      .replace(/{name}/g, name)
      .replace(/{interest}/g, interest);

    return {
      prompt,
      message,
      type: template.type
    };
  }

  async createGift(
    userId: string,
    characterId: string,
    giftType: string,
    prompt: string,
    imageUrl: string,
    contextMessage: string,
    personalizationData: Record<string, any>
  ): Promise<Gift | null> {
    const { data, error } = await supabase
      .from('user_gifts')
      .insert({
        user_id: userId,
        character_id: characterId,
        gift_type: giftType,
        gift_prompt: prompt,
        gift_url: imageUrl,
        context_message: contextMessage,
        personalization_data: personalizationData,
        sent_at: new Date().toISOString(),
        viewed: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating gift:', error);
      return null;
    }

    return data;
  }

  async getUserGifts(userId: string): Promise<Gift[]> {
    const { data, error } = await supabase
      .from('user_gifts')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false });

    if (error) {
      console.error('Error fetching gifts:', error);
      return [];
    }

    return data || [];
  }

  async markGiftViewed(giftId: string): Promise<void> {
    await supabase
      .from('user_gifts')
      .update({ viewed: true })
      .eq('id', giftId);
  }

  async generateGiftImage(prompt: string): Promise<string> {
    console.log('Generating gift image with prompt:', prompt);

    return `https://placehold.co/512x512/ff69b4/white?text=AI+Gift+Generated`;
  }
}

export const giftService = new GiftService();