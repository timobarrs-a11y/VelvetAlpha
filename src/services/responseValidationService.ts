import { supabase } from '../shared/supabase/client';

export interface ValidationResult {
  isValid: boolean;
  score: number;
  issues: ValidationIssue[];
  suggestions: string[];
  lexicalRepeat?: boolean;
  repeatedPhrases?: string[];
  semanticRepeat?: boolean;
  semanticMatches?: Array<{ similarity: number; excerpt: string }>;
  interrogationRisk?: boolean;
  questionCount?: number;
  questionStreak?: boolean;
  conversationMode?: 'dig' | 'vibe';
}

export interface ValidationIssue {
  type: 'topic_switch' | 'generic_response' | 'factual_error' | 'repetition' | 'length_mismatch' | 'personality_break' | 'lexical_repeat' | 'semantic_repeat' | 'too_many_questions' | 'question_streak' | 'question_lead';
  severity: 'critical' | 'warning' | 'minor';
  description: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function extractNGrams(text: string, n: number): string[] {
  const words = text.toLowerCase()
    .replace(/[*_]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0);

  const ngrams: string[] = [];
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(' '));
  }
  return ngrams;
}

function detectLexicalRepetition(
  candidateText: string,
  recentAssistantMessages: Message[]
): { detected: boolean; phrases: string[] } {
  const repeatedPhrases: string[] = [];

  const candidate4grams = extractNGrams(candidateText, 4);
  const candidate5grams = extractNGrams(candidateText, 5);
  const candidate6grams = extractNGrams(candidateText, 6);

  const allCandidateNGrams = [...candidate4grams, ...candidate5grams, ...candidate6grams];

  for (const msg of recentAssistantMessages) {
    const msg4grams = extractNGrams(msg.content, 4);
    const msg5grams = extractNGrams(msg.content, 5);
    const msg6grams = extractNGrams(msg.content, 6);

    const allMsgNGrams = [...msg4grams, ...msg5grams, ...msg6grams];

    for (const ngram of allCandidateNGrams) {
      if (allMsgNGrams.includes(ngram) && ngram.split(' ').length >= 4) {
        repeatedPhrases.push(ngram);
      }
    }
  }

  const uniquePhrases = [...new Set(repeatedPhrases)];

  const phraseOverlap = uniquePhrases.length / Math.max(1, allCandidateNGrams.length);

  return {
    detected: uniquePhrases.length > 0 || phraseOverlap > 0.02,
    phrases: uniquePhrases.slice(0, 5)
  };
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function detectSemanticRepetition(
  candidateText: string,
  recentAssistantMessages: Message[],
  userId: string
): Promise<{ detected: boolean; matches: Array<{ similarity: number; excerpt: string }> }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { detected: false, matches: [] };
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embedding`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: candidateText }),
    });

    if (!response.ok) {
      console.warn('Failed to generate embedding for semantic validation');
      return { detected: false, matches: [] };
    }

    const { embedding: candidateEmbedding } = await response.json();

    if (!candidateEmbedding || !Array.isArray(candidateEmbedding)) {
      return { detected: false, matches: [] };
    }

    const matches: Array<{ similarity: number; excerpt: string }> = [];
    const last10Messages = recentAssistantMessages.slice(-10);

    for (const msg of last10Messages) {
      const { data: existingMemory } = await supabase
        .from('semantic_memories')
        .select('embedding')
        .eq('user_id', userId)
        .eq('content', msg.content)
        .maybeSingle();

      let msgEmbedding: number[] | null = null;

      if (existingMemory?.embedding) {
        msgEmbedding = existingMemory.embedding;
      } else {
        const embedResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embedding`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: msg.content }),
        });

        if (embedResponse.ok) {
          const embedData = await embedResponse.json();
          msgEmbedding = embedData.embedding;
        }
      }

      if (msgEmbedding) {
        const similarity = cosineSimilarity(candidateEmbedding, msgEmbedding);

        if (similarity > 0.85) {
          const excerpt = msg.content.slice(0, 80) + (msg.content.length > 80 ? '...' : '');
          matches.push({ similarity, excerpt });
        }
      }
    }

    const highSimilarityCount = matches.filter(m => m.similarity > 0.90).length;
    const mediumSimilarityCount = matches.filter(m => m.similarity > 0.85).length;

    const detected = highSimilarityCount > 0 || mediumSimilarityCount >= 2;

    return {
      detected,
      matches: matches.sort((a, b) => b.similarity - a.similarity).slice(0, 3)
    };
  } catch (error) {
    console.warn('Semantic repetition detection failed:', error);
    return { detected: false, matches: [] };
  }
}

type ConversationMode = 'dig' | 'vibe';

function detectConversationMode(userMessage: string): ConversationMode {
  const lower = userMessage.toLowerCase();

  if (lower.includes('?')) {
    return 'dig';
  }

  const helpPhrases = [
    'help', 'can you', 'could you', 'would you', 'should i', 'what do you think',
    'how do i', 'explain', 'figure out', 'advice', 'recommend', 'suggest',
    'what would you', 'tell me', 'show me', 'teach me', 'any ideas'
  ];

  const troubleshootingPhrases = [
    'error', 'issue', 'problem', "doesn't work", "don't work", "not working",
    'broken', "can't", "cannot", 'stuck', 'trouble', 'fail', 'wrong'
  ];

  const decisionPhrases = [
    'decide', 'choice', 'option', 'between', 'or', 'which one',
    'better', 'best', 'pick', 'choose'
  ];

  const allDigPhrases = [...helpPhrases, ...troubleshootingPhrases, ...decisionPhrases];

  const hasDigIntent = allDigPhrases.some(phrase => lower.includes(phrase));

  return hasDigIntent ? 'dig' : 'vibe';
}

function detectInterrogation(
  candidateText: string,
  recentAssistantMessages: Message[],
  mode: ConversationMode,
  userMessageLength: number
): {
  detected: boolean;
  questionCount: number;
  questionStreak: boolean;
  questionLead: boolean;
  shotgunQuestions: boolean;
  noStatementBeforeQuestion: boolean;
  mode: ConversationMode;
} {
  const questionMarkCount = (candidateText.match(/\?/g) || []).length;

  const interrogativeOpeners = [
    'what', 'why', 'how', 'when', 'where', 'which', 'who',
    'are you', 'do you', 'did you', 'have you', 'can you',
    'could you', 'would you', 'will you', 'should you'
  ];

  const sentences = candidateText.split(/[.!?]/).filter(s => s.trim().length > 0);
  const interrogativeSentences = sentences.filter(s => {
    const lower = s.trim().toLowerCase();
    return interrogativeOpeners.some(opener => lower.startsWith(opener)) || s.includes('?');
  });

  const last2Messages = recentAssistantMessages.slice(-2);
  const last2HaveQuestions = last2Messages.map(m => (m.content.match(/\?/g) || []).length > 0);
  const last3Messages = recentAssistantMessages.slice(-3);
  const last3HaveQuestions = last3Messages.map(m => (m.content.match(/\?/g) || []).length > 0);

  const firstSentence = sentences[0] || '';
  const firstSentenceIsQuestion = firstSentence.includes('?') || interrogativeOpeners.some(opener =>
    firstSentence.trim().toLowerCase().startsWith(opener)
  );

  const nonQuestionSentences = sentences.filter(s => !s.includes('?'));
  const hasStatementBeforeFirstQuestion = nonQuestionSentences.length > 0 &&
    sentences.indexOf(nonQuestionSentences[0]) < sentences.findIndex(s => s.includes('?'));

  const shotgunPattern = /\?\s*(and|also|then|plus|what about|how about|why).{0,50}\?/i;
  const shotgunQuestions = shotgunPattern.test(candidateText);

  let detected = false;
  let questionStreak = false;
  let questionLead = false;
  let noStatementBeforeQuestion = false;

  if (mode === 'vibe') {
    if (questionMarkCount > 1) {
      detected = true;
    }

    if (last2HaveQuestions.every(hasQ => hasQ) && questionMarkCount > 0) {
      detected = true;
      questionStreak = true;
    }

    if (firstSentenceIsQuestion && sentences.length > 0) {
      detected = true;
      questionLead = true;
    }

    if (questionMarkCount > 0 && !hasStatementBeforeFirstQuestion) {
      detected = true;
      noStatementBeforeQuestion = true;
    }
  } else {
    const maxQuestions = userMessageLength > 100 ? 3 : 2;

    if (questionMarkCount > maxQuestions) {
      detected = true;
    }

    if (last3HaveQuestions.every(hasQ => hasQ) && last3Messages.length >= 3 && questionMarkCount > 2) {
      detected = true;
      questionStreak = true;
    }

    if (questionMarkCount > 0 && !hasStatementBeforeFirstQuestion) {
      detected = true;
      noStatementBeforeQuestion = true;
    }
  }

  if (shotgunQuestions) {
    detected = true;
  }

  return {
    detected,
    questionCount: questionMarkCount,
    questionStreak,
    questionLead,
    shotgunQuestions,
    noStatementBeforeQuestion,
    mode
  };
}

export async function validateResponse(
  userMessage: string,
  assistantResponse: string,
  conversationHistory: Message[],
  characterName: string
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  let score = 100;

  const responseLower = assistantResponse.toLowerCase();
  const userLower = userMessage.toLowerCase();

  const recentAssistantMessages = conversationHistory
    .filter(m => m.role === 'assistant')
    .slice(-20);

  const lexicalResult = detectLexicalRepetition(assistantResponse, recentAssistantMessages);

  if (lexicalResult.detected) {
    issues.push({
      type: 'lexical_repeat',
      severity: 'critical',
      description: `Repeated exact phrases from recent messages: "${lexicalResult.phrases.slice(0, 2).join('", "')}"`,
    });
    score -= 30;
  }

  const { data: { user } } = await supabase.auth.getUser();
  let semanticResult = { detected: false, matches: [] as Array<{ similarity: number; excerpt: string }> };

  if (user) {
    semanticResult = await detectSemanticRepetition(assistantResponse, recentAssistantMessages, user.id);

    if (semanticResult.detected) {
      const highSim = semanticResult.matches.filter(m => m.similarity > 0.90).length;
      const severity = highSim > 0 ? 'critical' : 'warning';

      issues.push({
        type: 'semantic_repeat',
        severity,
        description: `Response is semantically similar to recent message (${Math.round(semanticResult.matches[0]?.similarity * 100)}% match)`,
      });
      score -= severity === 'critical' ? 25 : 15;
    }
  }

  const conversationMode = detectConversationMode(userMessage);
  const userWordCount = userMessage.split(/\s+/).length;

  const interrogationResult = detectInterrogation(
    assistantResponse,
    recentAssistantMessages,
    conversationMode,
    userWordCount
  );

  if (interrogationResult.shotgunQuestions) {
    issues.push({
      type: 'too_many_questions',
      severity: 'critical',
      description: 'Multiple questions chained together (shotgun questioning)',
    });
    score -= 25;
  }

  if (interrogationResult.noStatementBeforeQuestion) {
    const severity = conversationMode === 'vibe' ? 'critical' : 'warning';
    issues.push({
      type: 'question_lead',
      severity,
      description: 'Response should lead with a statement/observation before asking questions',
    });
    score -= severity === 'critical' ? 20 : 10;
  }

  if (conversationMode === 'vibe') {
    if (interrogationResult.questionCount > 1) {
      issues.push({
        type: 'too_many_questions',
        severity: 'critical',
        description: `User is vibing - keep to 1 question max (found ${interrogationResult.questionCount})`,
      });
      score -= 20;
    }

    if (interrogationResult.questionStreak) {
      issues.push({
        type: 'question_streak',
        severity: 'critical',
        description: 'Last 2 messages asked questions during vibe mode - give the user space',
      });
      score -= 25;
    }
  } else {
    const maxQuestions = userWordCount > 100 ? 3 : 2;

    if (interrogationResult.questionCount > maxQuestions) {
      issues.push({
        type: 'too_many_questions',
        severity: 'warning',
        description: `User wants help but too many questions (${interrogationResult.questionCount}, max ${maxQuestions})`,
      });
      score -= 15;
    }

    if (interrogationResult.questionStreak && interrogationResult.questionCount > 2) {
      issues.push({
        type: 'question_streak',
        severity: 'warning',
        description: 'Recent question streak in dig mode - balance with more statements',
      });
      score -= 10;
    }
  }

  const genericPhrases = [
    'that\'s cool',
    'that\'s nice',
    'sounds good',
    'interesting',
    'cool!',
    'nice!',
    'awesome!',
  ];

  const isGeneric = genericPhrases.some(phrase => responseLower.includes(phrase)) &&
                    assistantResponse.split(/\s+/).length < 15;

  if (isGeneric) {
    issues.push({
      type: 'generic_response',
      severity: 'warning',
      description: 'Response is too generic and doesn\'t engage deeply with user\'s message',
    });
    score -= 15;
  }

  const responseWordCount = assistantResponse.split(/\s+/).length;

  if (userWordCount < 5 && responseWordCount > 50) {
    issues.push({
      type: 'length_mismatch',
      severity: 'warning',
      description: 'Response is too long for a short user message',
    });
    score -= 10;
  } else if (userWordCount > 30 && responseWordCount < 20) {
    issues.push({
      type: 'length_mismatch',
      severity: 'warning',
      description: 'Response is too short for a detailed user message',
    });
    score -= 10;
  }

  const roboticPhrases = [
    'as an ai',
    'i\'m an ai',
    'i don\'t have feelings',
    'i cannot',
    'i\'m not able to',
    'my purpose is',
    'i was designed',
  ];

  if (roboticPhrases.some(phrase => responseLower.includes(phrase))) {
    issues.push({
      type: 'personality_break',
      severity: 'critical',
      description: 'Response breaks character with AI-like language',
    });
    score -= 30;
  }

  for (const prevMsg of recentAssistantMessages.slice(-5)) {
    const prevQuestions = prevMsg.content.split(/[.!]/).filter(s => s.includes('?'));
    const currentQuestions = assistantResponse.split(/[.!]/).filter(s => s.includes('?'));

    for (const currentQ of currentQuestions) {
      for (const prevQ of prevQuestions) {
        const similarity = calculateSimilarity(currentQ.toLowerCase(), prevQ.toLowerCase());
        if (similarity > 0.7) {
          issues.push({
            type: 'repetition',
            severity: 'critical',
            description: `Asked similar question before: "${prevQ.trim()}"`,
          });
          score -= 25;
        }
      }
    }
  }

  const topicChangeIndicators = [
    'what are you up to',
    'what are you doing',
    'how was your day',
    'how\'s your day',
    'what\'s going on',
    'what else',
    'anything new',
  ];

  const userDiscussingTopic = userWordCount > 10 && !userLower.includes('?');

  if (userDiscussingTopic && topicChangeIndicators.some(phrase => responseLower.includes(phrase))) {
    issues.push({
      type: 'topic_switch',
      severity: 'critical',
      description: 'Switched topics when user was engaged in current discussion',
    });
    score -= 25;
  }

  const isValid = issues.filter(i => i.severity === 'critical').length === 0 && score >= 60;

  const suggestions: string[] = [];
  if (issues.some(i => i.type === 'generic_response')) {
    suggestions.push('Engage more deeply with what the user said');
  }
  if (issues.some(i => i.type === 'topic_switch')) {
    suggestions.push('Stay on the current topic unless user wants to change it');
  }
  if (issues.some(i => i.type === 'repetition')) {
    suggestions.push('Check conversation history to avoid asking the same questions');
  }
  if (issues.some(i => i.type === 'length_mismatch')) {
    suggestions.push('Match the user\'s message length and energy level');
  }
  if (issues.some(i => i.type === 'lexical_repeat')) {
    suggestions.push('Use fresh phrasing - avoid repeating exact phrases from recent messages');
  }
  if (issues.some(i => i.type === 'semantic_repeat')) {
    suggestions.push('Reframe the idea with a new angle or emotional nuance');
  }
  if (issues.some(i => i.type === 'too_many_questions' || i.type === 'question_streak' || i.type === 'question_lead')) {
    if (conversationMode === 'vibe') {
      suggestions.push('User is vibing - lead with empathy/observation. At most one question, or preferably none.');
    } else {
      suggestions.push('User wants help - keep questions focused. Lead with brief summary/statement first.');
    }
  }

  return {
    isValid,
    score: Math.max(0, score),
    issues,
    suggestions,
    lexicalRepeat: lexicalResult.detected,
    repeatedPhrases: lexicalResult.phrases,
    semanticRepeat: semanticResult.detected,
    semanticMatches: semanticResult.matches,
    interrogationRisk: interrogationResult.detected,
    questionCount: interrogationResult.questionCount,
    questionStreak: interrogationResult.questionStreak,
    conversationMode,
  };
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.split(/\s+/).filter(w => w.length > 3);
  const words2 = str2.split(/\s+/).filter(w => w.length > 3);

  if (words1.length === 0 || words2.length === 0) return 0;

  const common = words1.filter(w => words2.includes(w)).length;
  return (common / Math.max(words1.length, words2.length)) * 2;
}

export function shouldRetryResponse(validation: ValidationResult): boolean {
  if (!validation.isValid) {
    return true;
  }

  const criticalIssues = validation.issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    return true;
  }

  if (validation.lexicalRepeat) {
    return true;
  }

  if (validation.semanticRepeat) {
    const hasHighSimilarity = validation.semanticMatches?.some(m => m.similarity > 0.90);
    const hasMultipleMediumSimilarity = (validation.semanticMatches?.filter(m => m.similarity > 0.85).length || 0) >= 2;

    if (hasHighSimilarity || hasMultipleMediumSimilarity) {
      return true;
    }
  }

  if (validation.questionStreak) {
    return true;
  }

  if (validation.score < 60) {
    return true;
  }

  return false;
}

export function formatValidationFeedback(validation: ValidationResult): string {
  if (validation.issues.length === 0) {
    return '';
  }

  const parts: string[] = ['⚠️ PREVIOUS RESPONSE HAD ISSUES - REGENERATE WITH THESE FIXES:'];

  if (validation.lexicalRepeat && validation.repeatedPhrases && validation.repeatedPhrases.length > 0) {
    parts.push(`\n🔄 LEXICAL REPETITION DETECTED:`);
    parts.push(`Avoid reusing these exact phrases: "${validation.repeatedPhrases.slice(0, 3).join('", "')}"`);
    parts.push(`Replace them with fresh, alternative phrasing.`);
  }

  if (validation.semanticRepeat && validation.semanticMatches && validation.semanticMatches.length > 0) {
    parts.push(`\n🧠 SEMANTIC REPETITION DETECTED:`);
    parts.push(`Your response repeats a recent idea (${Math.round(validation.semanticMatches[0].similarity * 100)}% similarity).`);
    parts.push(`Reframe with a completely new angle, emotional tone, or perspective.`);
    parts.push(`Similar previous: "${validation.semanticMatches[0].excerpt}"`);
  }

  if (validation.interrogationRisk) {
    const mode = validation.conversationMode || 'vibe';

    if (mode === 'vibe') {
      parts.push(`\n❓ INTERROGATION IN VIBE MODE DETECTED:`);
      parts.push(`User is casually vibing/venting - NOT asking for help.`);

      if (validation.questionStreak) {
        parts.push(`You've asked questions in the last 2+ messages. GIVE THE USER SPACE.`);
      }

      if (validation.questionCount && validation.questionCount > 1) {
        parts.push(`Too many questions (${validation.questionCount}). Convert extras into empathetic STATEMENTS.`);
      }

      parts.push(`VIBE MODE RESPONSE FORMULA:`);
      parts.push(`1. Lead with empathy/observation/reaction`);
      parts.push(`2. Connect to their experience emotionally`);
      parts.push(`3. At most ONE question (or preferably ZERO)`);
      parts.push(`4. Keep it conversational, not analytical`);
    } else {
      parts.push(`\n❓ INTERROGATION IN DIG MODE DETECTED:`);
      parts.push(`User is asking for help/advice - questions are more appropriate here.`);

      if (validation.questionStreak && validation.questionCount && validation.questionCount > 2) {
        parts.push(`Balance needed: You've been asking many questions recently.`);
      }

      if (validation.questionCount && validation.questionCount > 3) {
        parts.push(`Too many questions (${validation.questionCount}). Focus on 2-3 TARGETED questions max.`);
      }

      parts.push(`DIG MODE RESPONSE FORMULA:`);
      parts.push(`1. Start with brief summary/acknowledgment of their situation`);
      parts.push(`2. Ask 1-2 focused clarifying questions (not shotgun-style)`);
      parts.push(`3. Avoid chaining questions with "and" / "also" / "then"`);
      parts.push(`4. Questions should feel purposeful, not like an intake form`);
    }
  }

  const otherIssues = validation.issues.filter(i =>
    !['lexical_repeat', 'semantic_repeat', 'too_many_questions', 'question_streak', 'question_lead'].includes(i.type)
  );

  if (otherIssues.length > 0) {
    parts.push(`\n⚡ OTHER ISSUES:`);
    for (const issue of otherIssues) {
      parts.push(`- ${issue.type.toUpperCase()}: ${issue.description}`);
    }
  }

  if (validation.suggestions.length > 0) {
    const nonRepetitionSuggestions = validation.suggestions.filter(s =>
      !s.includes('fresh phrasing') &&
      !s.includes('Reframe') &&
      !s.includes('statements or observations') &&
      !s.includes('vibing') &&
      !s.includes('wants help') &&
      !s.includes('empathy')
    );

    if (nonRepetitionSuggestions.length > 0) {
      parts.push(`\n💡 ADDITIONAL IMPROVEMENTS:`);
      nonRepetitionSuggestions.forEach(s => parts.push(`- ${s}`));
    }
  }

  parts.push(`\n✨ CRITICAL: Generate a COMPLETELY DIFFERENT response that addresses all issues above.`);

  return parts.join('\n');
}
