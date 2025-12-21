import Anthropic from '@anthropic-ai/sdk';

export interface ValidationResult {
  isValid: boolean;
  score: number;
  issues: ValidationIssue[];
  suggestions: string[];
}

export interface ValidationIssue {
  type: 'topic_switch' | 'generic_response' | 'factual_error' | 'repetition' | 'length_mismatch' | 'personality_break';
  severity: 'critical' | 'warning' | 'minor';
  description: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
});

export async function validateResponse(
  userMessage: string,
  assistantResponse: string,
  conversationHistory: Message[],
  characterName: string
): Promise<ValidationResult> {
  const prompt = `You are a conversation quality validator. Analyze this AI companion response for quality issues.

CONVERSATION HISTORY (last 3 messages):
${conversationHistory.slice(-3).map(m => `${m.role === 'user' ? 'User' : characterName}: ${m.content}`).join('\n')}

USER'S LATEST MESSAGE:
${userMessage}

AI RESPONSE TO VALIDATE:
${assistantResponse}

Check for these CRITICAL issues:

1. TOPIC SWITCHING: Did the AI switch topics when the user was still engaged with the current topic?
   - Look for generic questions like "what are you up to?" when user is discussing something specific
   - Flag if AI changes subject without user prompting

2. GENERIC RESPONSES: Is the response too generic or low-effort?
   - Examples: "that's cool!", "nice!", "what else?" without substance
   - Flag if AI isn't actually engaging with what user said

3. FACTUAL ERRORS: Any factual mistakes, especially about sports, geography, or common knowledge?
   - Check for terminology errors (e.g., "kickoff" for basketball)
   - Flag any obvious mistakes

4. REPETITION: Did the AI ask a question that was already asked or answered?
   - Check if AI is forgetting context from recent messages
   - Flag redundant questions

5. LENGTH MISMATCH: Does response length match the user's energy?
   - If user says "hey", a paragraph response is wrong
   - If user shares something deep, a short response is wrong

6. PERSONALITY BREAK: Does the response feel robotic or break character?
   - Check for AI-like language patterns
   - Flag if it doesn't sound natural/human

Provide a JSON response with:
{
  "isValid": boolean (false if there are critical issues),
  "score": number (0-100, quality score),
  "issues": [
    {
      "type": "topic_switch" | "generic_response" | "factual_error" | "repetition" | "length_mismatch" | "personality_break",
      "severity": "critical" | "warning" | "minor",
      "description": "Brief description of the issue"
    }
  ],
  "suggestions": ["Specific suggestion on how to improve the response"]
}

If the response is good (score 80+), return isValid: true with empty issues array.

Return ONLY valid JSON, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    const result = JSON.parse(textContent.text);

    return {
      isValid: result.isValid !== false,
      score: result.score || 80,
      issues: result.issues || [],
      suggestions: result.suggestions || [],
    };
  } catch (error) {
    console.error('Validation failed:', error);
    return {
      isValid: true,
      score: 75,
      issues: [],
      suggestions: [],
    };
  }
}

export function shouldRetryResponse(validation: ValidationResult): boolean {
  if (!validation.isValid) {
    return true;
  }

  const criticalIssues = validation.issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
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

  const parts: string[] = ['PREVIOUS RESPONSE HAD ISSUES - AVOID THESE:'];

  for (const issue of validation.issues) {
    parts.push(`- ${issue.type.toUpperCase()}: ${issue.description}`);
  }

  if (validation.suggestions.length > 0) {
    parts.push('\nIMPROVEMENTS TO MAKE:');
    validation.suggestions.forEach(s => parts.push(`- ${s}`));
  }

  return parts.join('\n');
}
