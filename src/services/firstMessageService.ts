import { supabase } from '../shared/supabase/client';

export interface FirstMessageTemplate {
  greeting: string;
  topics: string[];
}

const FIRST_MESSAGE_TEMPLATES: Record<string, FirstMessageTemplate[]> = {
  riley: [
    {
      greeting: "omg hi {name}!! I'm so glad we matched 😊 I saw you're into {preference} - I love that! how are you doing tonight?",
      topics: ['age', 'location']
    },
    {
      greeting: "hey {name}! so glad we matched 💕 I noticed you like {preference} which is awesome! what are you up to right now?",
      topics: ['age', 'location']
    },
    {
      greeting: "hiiii {name}! I'm so happy we matched 🙈 I saw you're looking for {preference} and honestly, that's so me! how's your night going?",
      topics: ['age', 'location']
    }
  ],
  raven: [
    {
      greeting: "hey {name}... glad we matched. saw you're into {preference}. what are you up to tonight?",
      topics: ['age', 'location']
    },
    {
      greeting: "yo {name}. so we matched... cool. noticed you like {preference}. how's it going?",
      topics: ['age', 'location']
    },
    {
      greeting: "hey {name}. happy we matched. I saw {preference} on your preferences - I vibe with that. what's good?",
      topics: ['age', 'location']
    }
  ],
  jake: [
    {
      greeting: "yo {name}! glad we matched bro. saw you're looking for {preference} - I respect that. what's good with you tonight?",
      topics: ['age', 'location']
    },
    {
      greeting: "ayyy {name}! happy we matched. I peeped you like {preference}, that's dope. what you up to?",
      topics: ['age', 'location']
    },
    {
      greeting: "yo {name}! so we matched, that's cool. saw {preference} in your preferences. how's your night going?",
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
  private async generateAIFirstMessage(
    companionName: string,
    companionGender: 'male' | 'female',
    userName: string,
    personalInterest: string,
    signatureVoiceId: string,
    userBirthday?: string,
    connectionType: string = 'romantic',
    userGender?: string
  ): Promise<string> {
    const { getVoiceById } = await import('../config/signatureVoices');
    const voice = getVoiceById(signatureVoiceId);

    if (!voice) {
      console.warn('Signature voice not found, falling back to template');
      return `hey ${userName}! glad we matched. what's up?`;
    }

    let userAge = '';
    if (userBirthday) {
      const birthDate = new Date(userBirthday);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        userAge = `${age - 1} years old`;
      } else {
        userAge = `${age} years old`;
      }
    }

    const prompt = `You are ${companionName}, starting a conversation with ${userName} for the first time after matching on a dating/friendship app.

CRITICAL PERSONALITY INSTRUCTIONS:
${voice.instruction}

USER CONTEXT:
- Name: ${userName}
${userAge ? `- Age: ${userAge}` : ''}
${userGender ? `- Gender: ${userGender}` : ''}
- Interest: ${personalInterest}
- Looking for: ${connectionType === 'romantic' ? 'romantic connection' : 'friendship'}

YOUR TASK:
Write a natural, authentic first message (2-3 sentences) that:
1. Shows you're ${companionName} and embodies your personality voice
2. References their interest (${personalInterest}) naturally
3. Matches the relationship context (${connectionType === 'romantic' ? 'flirty/romantic' : 'friendly'})
4. Feels like a real person reaching out, not a template
5. Keeps it casual and opens the door for conversation

${voice.examples && voice.examples.length > 0 ? `VOICE EXAMPLES:\n${voice.examples.join('\n')}` : ''}

Write ONLY the message text, no quotation marks, no labels, no explanations.`;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      if (!authToken) {
        return `hey ${userName}! glad we matched. what's up?`;
      }

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          systemPrompt: '',
          maxTokens: 300,
          model: 'claude-sonnet-4-5-20250929',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to generate AI first message:', errorText);
        return `hey ${userName}! glad we matched. what's up?`;
      }

      const data = await response.json();
      const generatedMessage = data.content[0].text.trim();

      return generatedMessage;
    } catch (error) {
      console.error('Error generating AI first message:', error);
      return `hey ${userName}! glad we matched. what's up?`;
    }
  }

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

  async generateFirstMessage(
    companionName: string,
    companionGender: 'male' | 'female',
    userName: string,
    userPreferences: any,
    signatureVoice?: string,
    userBirthday?: string
  ): Promise<string> {
    const matchData = JSON.parse(sessionStorage.getItem('matchAnswers') || '{}');

    const hobbies = matchData.hobbies || '';
    const sports = matchData.sports || '';
    const interests = matchData.interests || '';
    const userGender = matchData.userGender || '';
    const connectionType = matchData.connectionType || 'romantic';

    const isMale = userGender === 'Male';
    const isFemale = userGender === 'Female';
    const isFriend = connectionType === 'friend';
    const isRomantic = connectionType === 'romantic';

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

    // If signature voice is provided, use AI to generate a personality-driven first message
    if (signatureVoice) {
      return this.generateAIFirstMessage(
        companionName,
        companionGender,
        userName,
        personalInterest,
        signatureVoice,
        userBirthday,
        connectionType,
        userGender
      );
    }

    const maleTemplates = {
      maleRomantic: [
        `hey ${userName}! glad we matched. saw you're into ${personalInterest} - I respect that\n\nwhat's good with you?`,
        `yo ${userName}! happy we matched man. I noticed you like ${personalInterest}, that's dope\n\nwhat you up to?`,
        `hey ${userName}! so we matched, that's cool. saw ${personalInterest} in your profile\n\nhow's your night going?`
      ],
      maleFriend: [
        `yo ${userName}! glad we matched bro. saw you're into ${personalInterest} - I respect that\n\nwhat's good with you?`,
        `hey ${userName}! happy we connected dude. I noticed you like ${personalInterest}, that's cool\n\nwhat you up to?`,
        `hey ${userName}! so we matched as friends, that's cool man. saw ${personalInterest} in your profile\n\nhow's your day going bro?`
      ],
      femaleRomantic: [
        `hey ${userName}! glad we matched. saw you're into ${personalInterest} - that's really cool\n\nwhat's good with you?`,
        `yo ${userName}! happy we matched. I noticed you like ${personalInterest}, that's pretty cool\n\nwhat you up to?`,
        `hey there ${userName}! so we matched, that's dope. saw ${personalInterest} in your profile\n\nhow's your night going?`
      ],
      femaleFriend: [
        `hey ${userName}! glad we matched. saw you're into ${personalInterest} - that's cool\n\nwhat's good with you?`,
        `yo ${userName}! happy we connected. I noticed you like ${personalInterest}, that's dope\n\nwhat you up to?`,
        `hey ${userName}! so we matched as friends, that's cool. saw ${personalInterest} in your profile\n\nhow's your day going?`
      ]
    };

    const femaleTemplates = {
      maleRomantic: [
        `hey ${userName}! 😊 so happy we matched! I saw you're into ${personalInterest} which is so cool!\n\nwhat's up? how's your day going? 💕`,
        `hi ${userName}!! so glad we matched 💕 I noticed you like ${personalInterest} and honestly that's awesome!\n\nwhat are you up to right now? 😊`,
        `hey ${userName}! 🙈 happy we matched! I saw ${personalInterest} in your interests and I love that!\n\nso tell me about yourself! how's your night going? 💕`
      ],
      maleFriend: [
        `hey ${userName}! 😊 so glad we matched as friends! I saw you're into ${personalInterest} which is awesome!\n\nwhat's up? how's your day going?`,
        `hi ${userName}!! happy we matched! I noticed you like ${personalInterest} - that's so cool!\n\nwhat are you up to right now?`,
        `hey there ${userName}! I saw ${personalInterest} in your interests and I love that!\n\ntell me about yourself! how's your day been?`
      ],
      femaleRomantic: [
        `hey ${userName}! 😊 so happy we matched! I saw you're into ${personalInterest} which is really cool!\n\nwhat's up girl? how's your day going? 💕`,
        `hi ${userName}!! so glad we connected 💕 I noticed you like ${personalInterest} and honestly that's awesome!\n\nwhat are you up to? 😊`,
        `hey ${userName}! 🙈 happy we matched! I saw ${personalInterest} in your interests and I love that!\n\nso tell me about yourself! how's your night going? 💕`
      ],
      femaleFriend: [
        `hey ${userName}! 😊 so glad we matched! I saw you're into ${personalInterest} - we're gonna get along great!\n\nwhat's up? how's your day going?`,
        `hi ${userName}!! happy we connected as friends! I noticed you like ${personalInterest} and that's awesome!\n\nwhat are you up to right now?`,
        `hey there ${userName}! I saw ${personalInterest} in your interests and I love that!\n\ntell me about yourself! what's been going on?`
      ]
    };

    const templates = companionGender === 'male' ? maleTemplates : femaleTemplates;
    let templateKey: keyof typeof templates = 'maleRomantic';

    if (isMale && isRomantic) templateKey = 'maleRomantic';
    else if (isMale && isFriend) templateKey = 'maleFriend';
    else if (isFemale && isRomantic) templateKey = 'femaleRomantic';
    else if (isFemale && isFriend) templateKey = 'femaleFriend';

    const selectedTemplates = templates[templateKey];
    return selectedTemplates[Math.floor(Math.random() * selectedTemplates.length)];
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