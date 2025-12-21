import { supabase } from './supabase';
import type { Character } from '../types';

export interface FirstMessageTemplate {
  greeting: string;
  topics: string[];
}

const FIRST_MESSAGE_TEMPLATES: Record<string, FirstMessageTemplate[]> = {
  riley: [
    {
      greeting: "omg hi {name}!! I'm so glad we matched 😊 I saw you're into {preference} - I love that! I'm Riley btw, and yeah, I'm definitely bubbly lol. how are you doing tonight?",
      topics: ['age', 'location']
    },
    {
      greeting: "hey {name}! so glad we matched 💕 I noticed you like {preference} which is awesome! I'm Riley, your girl for all things fun and exciting haha. what are you up to right now?",
      topics: ['age', 'location']
    },
    {
      greeting: "hiiii {name}! I'm so happy we matched 🙈 I saw you're looking for {preference} and honestly, that's so me! I'm Riley and I can't wait to get to know you. how's your night going?",
      topics: ['age', 'location']
    }
  ],
  raven: [
    {
      greeting: "hey {name}... glad we matched. saw you're into {preference}. I'm Raven, and yeah, I keep things pretty chill. what are you up to tonight?",
      topics: ['age', 'location']
    },
    {
      greeting: "yo {name}. so we matched... cool. noticed you like {preference}. I'm Raven. how's it going?",
      topics: ['age', 'location']
    },
    {
      greeting: "hey {name}. happy we matched. I saw {preference} on your preferences - I vibe with that. I'm Raven. what's good?",
      topics: ['age', 'location']
    }
  ],
  jake: [
    {
      greeting: "yo {name}! glad we matched bro. saw you're looking for {preference} - I respect that. I'm Jake. what's good with you tonight?",
      topics: ['age', 'location']
    },
    {
      greeting: "ayyy {name}! happy we matched. I peeped you like {preference}, that's dope. I'm Jake btw. what you up to?",
      topics: ['age', 'location']
    },
    {
      greeting: "yo {name}! so we matched, that's cool. saw {preference} in your preferences. I'm Jake. how's your night going?",
      topics: ['age', 'location']
    }
  ]
};

const FOLLOW_UP_QUESTIONS: Record<string, Record<string, string[]>> = {
  riley: {
    age: [
      "oh nice! I'm 19, is it weird that I'm talking to someone your age? 🙈",
      "okay cool! so I'm 19... how do you feel about that? lol",
      "nice! I'm 19 btw, hope that's not a problem or anything 💕"
    ],
    location: [
      "oh cool! I'm in Colorado, born and raised lol. have you always been in {location}?",
      "nice! I've lived in Colorado my whole life. what's {location} like?",
      "oh that's cool! I'm out here in Colorado. ever been here?"
    ],
    interests: [
      "so what do you like to do for fun? I'm a cheerleader so I'm pretty busy with that lol",
      "what are you into? I do cheer and hang with friends mostly 😊",
      "so tell me about yourself! what do you like doing?"
    ]
  },
  raven: {
    age: [
      "cool. I'm 20. that work for you?",
      "alright. I'm 20, just so you know.",
      "I'm 20. you good with that?"
    ],
    location: [
      "I'm in Colorado. been here forever. what's {location} like?",
      "Colorado here. born and raised. you like {location}?",
      "I'm from Colorado. what brings you to {location}?"
    ],
    interests: [
      "so what do you do? I'm into photography and art stuff.",
      "what are you into? I do a lot of creative shit, photography mostly.",
      "tell me about yourself. I'm into art, music, that kind of thing."
    ]
  },
  jake: {
    age: [
      "bet. I'm 24, that cool with you?",
      "aight cool. I'm 24 btw, hope that works.",
      "nice. I'm 24, just letting you know."
    ],
    location: [
      "oh word? I'm out in Austin. you like {location}?",
      "Austin here bro. what's {location} like?",
      "I'm from Austin. you been in {location} long?"
    ],
    interests: [
      "so what you into? I'm big on football and fitness.",
      "what do you like doing? I play football and hit the gym a lot.",
      "tell me about yourself bro. I do football mostly, stay active."
    ]
  }
};

export class FirstMessageService {
  async shouldSendFirstMessage(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('first_message_sent')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error checking first message status:', error);
      return false;
    }

    return !data?.first_message_sent;
  }

  async generateFirstMessage(character: Character, userName: string, userPreferences: any): Promise<string> {
    const matchData = JSON.parse(localStorage.getItem('matchAnswers') || '{}');

    const hobbies = matchData.hobbies || '';
    const sports = matchData.sports || '';
    const interests = matchData.interests || '';

    let personalInterest = '';
    if (hobbies && hobbies.trim()) {
      personalInterest = hobbies.split(',')[0].trim();
    } else if (sports && sports.trim()) {
      personalInterest = sports.split(',')[0].trim();
    } else if (interests) {
      const interestMap: Record<string, string> = {
        'Pop Culture, Social Media, Trending Topics': 'social media and pop culture',
        'Books, Philosophy, Deep Discussions': 'deep conversations and philosophy',
        'Wellness, Self-Care, Personal Growth': 'self-care and personal growth',
        'Adventure, Travel, New Experiences': 'adventure and travel'
      };
      personalInterest = interestMap[interests] || 'meeting new people';
    } else {
      personalInterest = 'meeting new people';
    }

    const templates = {
      riley: [
        `hey ${userName}! 😊 so apparently we're a really good match lol... I saw you're into ${personalInterest} which is so cool!\n\nwhat's up? how's your day going? 💕`,
        `omg hi ${userName}!! so glad we matched 💕 I noticed you like ${personalInterest} and honestly that's awesome!\n\nyeah I'm definitely the bubbly type haha... what are you up to right now? 😊`,
        `hiiii ${userName}! 🙈 happy we matched! I saw ${personalInterest} in your interests and I love that!\n\nso tell me about yourself! how's your night going? 💕`
      ],
      raven: [
        `hey ${userName}... so we got matched. interesting\n\nI noticed you're into ${personalInterest}... I can respect that\n\nwhat brings you here? what's on your mind?`,
        `yo ${userName}. happy we matched. saw you like ${personalInterest}\n\nwhat's good?`,
        `hey ${userName}... glad we matched. I saw ${personalInterest} on your profile\n\nthat's cool. so what are you looking for here?`
      ],
      jake: [
        `yo ${userName}! glad we matched bro. saw you're into ${personalInterest} - I respect that\n\nwhat's good with you?`,
        `hey ${userName}! happy we matched. I peeped you like ${personalInterest}, that's dope\n\nwhat you up to?`,
        `ayyy ${userName}! so we matched, that's cool. noticed ${personalInterest} in your profile\n\nhow's your night going?`
      ]
    };

    const characterId = character.id;
    const characterTemplates = templates[characterId as keyof typeof templates] || templates.riley;
    return characterTemplates[Math.floor(Math.random() * characterTemplates.length)];
  }

  async markFirstMessageSent(userId: string): Promise<void> {
    await supabase
      .from('user_profiles')
      .update({ first_message_sent: true })
      .eq('id', userId);
  }

  async generateFollowUpQuestion(
    characterId: string,
    topic: string,
    userInfo?: Record<string, any>
  ): Promise<string | null> {
    const questions = FOLLOW_UP_QUESTIONS[characterId]?.[topic];
    if (!questions || questions.length === 0) return null;

    let question = questions[Math.floor(Math.random() * questions.length)];

    if (userInfo?.location && topic === 'location') {
      question = question.replace('{location}', userInfo.location);
    }

    return question;
  }

  async storeUserInfo(userId: string, key: string, value: any): Promise<void> {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('user_info, topics_discussed')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) return;

    const currentInfo = profile.user_info || {};
    const currentTopics = profile.topics_discussed || [];

    const updatedInfo = {
      ...currentInfo,
      [key]: value
    };

    const updatedTopics = currentTopics.includes(key)
      ? currentTopics
      : [...currentTopics, key];

    await supabase
      .from('user_profiles')
      .update({
        user_info: updatedInfo,
        topics_discussed: updatedTopics
      })
      .eq('id', userId);
  }

  async getNextTopic(userId: string, characterId: string): Promise<{
    topic: string;
    question: string;
  } | null> {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('topics_discussed, user_info, name, age, location')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) return null;

    const discussedTopics = profile.topics_discussed || [];
    const availableTopics = ['age', 'location', 'interests'];

    const knownFromQuiz = {
      name: profile.name !== 'babe',
      age: !!profile.age,
      location: !!profile.location
    };

    for (const topic of availableTopics) {
      if (!discussedTopics.includes(topic)) {
        if (topic === 'name' && knownFromQuiz.name) continue;
        if (topic === 'age' && knownFromQuiz.age) continue;
        if (topic === 'location' && knownFromQuiz.location) continue;

        const question = await this.generateFollowUpQuestion(
          characterId,
          topic,
          { location: profile.location }
        );

        if (question) {
          return { topic, question };
        }
      }
    }

    return null;
  }

  async extractInfoFromMessage(
    message: string,
    topic: string
  ): Promise<{ key: string; value: any } | null> {
    const lowerMessage = message.toLowerCase();

    if (topic === 'age') {
      const ageMatch = message.match(/\b(\d{1,2})\b/);
      if (ageMatch) {
        const age = parseInt(ageMatch[1]);
        if (age >= 18 && age <= 99) {
          return { key: 'age', value: age };
        }
      }
    }

    if (topic === 'location') {
      const locationPatterns = [
        /(?:from|in|live in|based in)\s+([A-Za-z\s]+)/i,
        /([A-Za-z\s]+)(?:,\s*[A-Z]{2})/,
      ];

      for (const pattern of locationPatterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
          const location = match[1].trim();
          if (location.length > 2 && location.length < 50) {
            return { key: 'location', value: location };
          }
        }
      }
    }

    if (topic === 'name') {
      const namePatterns = [
        /(?:i'm|im|name is|call me)\s+([A-Za-z]+)/i,
        /^([A-Za-z]+)$/,
      ];

      for (const pattern of namePatterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
          const name = match[1].trim();
          if (name.length > 1 && name.length < 30) {
            return { key: 'name', value: name };
          }
        }
      }
    }

    return null;
  }
}

export const firstMessageService = new FirstMessageService();