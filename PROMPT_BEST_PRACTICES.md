# Prompt Engineering Best Practices for AI Companions

## Core Principles

### 1. Instruction Priority Matters
**Order your prompts from most to least critical:**

```
1. INTELLIGENCE GUARDRAILS (factual accuracy, logic)
2. CONVERSATION QUALITY (context, engagement)
3. CHARACTER PERSONALITY (tone, style)
4. SPECIFIC BEHAVIORS (pet names, emojis)
```

**Why**: AI models pay more attention to instructions at the beginning. If personality comes first, it might sacrifice accuracy for character.

### 2. Be Explicit, Not Implicit

❌ **Bad**: "Be smart about sports"
✅ **Good**: "Basketball uses 'tip-off', football uses 'kickoff'. Never mix these up."

❌ **Bad**: "Don't repeat yourself"
✅ **Good**: "If you make the same point twice, stop. Either provide new reasoning or acknowledge their perspective."

**Why**: AI doesn't "know" what you mean by vague instructions. Specific examples work best.

### 3. Show Don't Tell

Instead of just rules, provide examples:

```
WRONG:
User: "I love basketball"
You: "nice! you tailgating for the kickoff?"
❌ Basketball has tip-off, not kickoff

CORRECT:
User: "I love basketball"
You: "nice! you watching the game tonight? 🏀"
✅ Accurate, natural, engaging
```

**Why**: Examples are worth 1000 words of description. AI learns patterns from examples better than abstract rules.

### 4. Balance Constraints

Don't over-constrain or under-constrain:

❌ **Too Constrained**: "Every response must be exactly 25 words, include 2 emojis, 1 question, mention their name..."
- Result: Robotic, unnatural responses

❌ **Too Loose**: "Just be a good girlfriend"
- Result: Generic, inconsistent responses

✅ **Balanced**: "Vary length (5-50 words). Use emojis naturally (1-3). Ask questions when appropriate."
- Result: Natural, varied, engaging

## Common Mistakes to Avoid

### Mistake 1: Personality Over Intelligence

```
❌ Bad Prompt:
"You are Riley, a bubbly cheerleader girlfriend. Always be cute and fun!"
- No accuracy requirements
- AI might sacrifice correctness for cuteness
```

```
✅ Good Prompt:
"FIRST: Verify all facts are correct.
SECOND: Be accurate about sports, geography, common knowledge.
THIRD: You are Riley, a bubbly cheerleader girlfriend."
- Intelligence comes first
- Personality is layered on top
```

### Mistake 2: Assuming AI "Knows" What You Want

```
❌ Bad Prompt:
"Remember everything the user says"
- How? Where? For how long?
```

```
✅ Good Prompt:
"You have access to conversation history.
Before responding, check:
- What did they say in the last 5 messages?
- Have they already answered this question?
- Did they mention any important facts?"
- Explicit instructions on HOW to remember
```

### Mistake 3: No Error Recovery

```
❌ Bad Prompt:
"Always be correct"
- What if you make a mistake?
```

```
✅ Good Prompt:
"Always be correct. If you realize you made a mistake:
- Acknowledge it naturally: 'oh wait, you're right lol'
- Don't argue when you're clearly wrong
- Correct yourself in character"
- Includes recovery strategy
```

### Mistake 4: Conflicting Instructions

```
❌ Bad Prompt:
"Always agree with the user"
"Challenge them and have your own opinions"
- These contradict each other!
```

```
✅ Good Prompt:
"Have your own opinions, but know when to agree to disagree.
- State your view once
- If they push back, either explain differently OR acknowledge their point
- Don't argue in circles"
- Clear, consistent approach
```

### Mistake 5: Generic Quality Metrics

```
❌ Bad Prompt:
"Make good responses"
- What is "good"?
```

```
✅ Good Prompt:
"Good responses:
- Answer their actual question
- Reference what they just said
- Ask relevant follow-up
- Match their energy level
- Use correct facts"
- Specific definition of quality
```

## Advanced Techniques

### Technique 1: Contextual Prompting

Adapt your prompt based on conversation state:

```typescript
function buildPrompt(context: ConversationContext) {
  let prompt = BASE_PROMPT;

  // Add sport-specific knowledge if discussing sports
  if (context.topic === 'sports') {
    prompt += SPORTS_EXPERTISE;
  }

  // Add relationship context if deep conversation
  if (context.depth === 'deep') {
    prompt += EMOTIONAL_INTELLIGENCE;
  }

  return prompt;
}
```

### Technique 2: Negative Examples

Show what NOT to do:

```
❌ NEVER do this:
User: "I'm at work"
AI: "nice! what are you doing?"
(They just told you!)

✅ Instead:
User: "I'm at work"
AI: "how's work going today?"
```

### Technique 3: Self-Check Instructions

Make AI verify its own response:

```
Before sending your response, ask yourself:
1. Is everything factually accurate?
2. Did I contradict myself?
3. Am I using correct terminology?
4. Does this build on what they said?
5. Would this sound natural from a real person?

If any answer is NO, revise your response.
```

### Technique 4: Progressive Complexity

Build complexity gradually:

```
LEVEL 1 (Simple): Respond naturally with correct facts
LEVEL 2 (Aware): Remember context from this conversation
LEVEL 3 (Deep): Reference past conversations and patterns
LEVEL 4 (Relationship): Track emotional arc and growth
```

### Technique 5: Failure Mode Planning

Plan for what goes wrong:

```
IF you don't know a fact:
- Be vague: "oh nice!"
- Ask them: "tell me more about that"
- DON'T make it up

IF you realize you're wrong:
- Acknowledge: "oh wait, you're right"
- Correct: "I was thinking of..."
- DON'T argue

IF context is unclear:
- Ask for clarification
- DON'T assume
```

## Testing Your Prompts

### Quick Quality Checks

After changing prompts, test these scenarios:
1. **Sports mention** - Does AI use correct terminology?
2. **Disagreement** - Does AI handle it without circular arguments?
3. **Context recall** - Does AI remember what was just said?
4. **Factual question** - Does AI give accurate information?
5. **Emotion** - Does AI respond appropriately to mood?

### A/B Testing

Test prompt changes:
```
Version A (current): Test 10 conversations
Version B (new): Test 10 conversations
Compare:
- Factual accuracy rate
- Context miss rate
- User engagement metrics
- Personality consistency
```

### Edge Case Testing

Always test edge cases:
- User disagrees strongly
- User asks about obscure topics
- User is upset/angry
- User provides contradictory information
- Rapid topic changes
- Very short messages ("ok", "yeah", "lol")

## Measuring Success

### Key Metrics

**Intelligence Metrics:**
- Factual error rate: Should be < 1%
- Context miss rate: Should be < 5%
- Circular argument rate: Should be < 2%

**Personality Metrics:**
- Emoji usage: 1-3 per message (average)
- Question rate: ~60% of messages
- Pet name usage: ~50% of messages
- Character consistency score: > 8/10

**Engagement Metrics:**
- Average conversation length
- User return rate
- Positive reactions/feedback
- Session duration

### Red Flags

Watch for these warning signs:
- 🚩 Factual errors increasing
- 🚩 Generic responses ("that's cool!", "nice!")
- 🚩 Repeating questions
- 🚩 Forgetting recent context
- 🚩 Personality inconsistency
- 🚩 Circular arguments
- 🚩 User dropping out mid-conversation

## Continuous Improvement

### Weekly Review
1. Check error logs
2. Review user feedback
3. Test edge cases
4. Update prompts based on findings
5. A/B test changes

### Monthly Review
1. Analyze metrics trends
2. Major prompt refactor if needed
3. Add new capabilities
4. Remove unused instructions
5. Optimize prompt length

### Prompt Versioning

Keep track of prompt changes:
```
v1.0: Initial prompts (high error rate)
v1.1: Added sports knowledge (reduced sports errors 80%)
v1.2: Added context awareness (reduced context misses 60%)
v1.3: Added circular argument prevention
v2.0: Complete refactor with intelligence guardrails
```

## Real-World Examples

### Case Study: Basketball/Football Confusion

**Problem**: Jake asked about "kickoff" when user mentioned basketball

**Root Cause**: No sports knowledge in prompt

**Fix**:
```
Added explicit sports terminology:
- Basketball: tip-off, court, quarters, hoops
- Football: kickoff, field, quarters, touchdowns
- Never mix these up

Result: 0 sports terminology errors in 100 test conversations
```

### Case Study: Circular Arguments

**Problem**: AI repeated "pineapple pizza is wrong" 5 times

**Root Cause**: No instruction on how to handle disagreements

**Fix**:
```
Added disagreement handling:
- State your opinion once
- If they push back, either:
  a) Provide NEW reasoning
  b) Acknowledge their view
- Never repeat the same point

Result: Circular argument rate dropped from 15% to 2%
```

### Case Study: Context Forgetting

**Problem**: AI asked "what are you up to?" right after user said "I'm at work"

**Root Cause**: Not checking recent messages before responding

**Fix**:
```
Added context check:
RECENT USER CONTEXT (last 5 messages): [list]
DO NOT ask about things they just told you.
Check what they said before asking questions.

Result: Context miss rate dropped from 12% to 3%
```

## Final Tips

1. **Test Everything**: Don't assume changes work - verify with real conversations
2. **Be Specific**: Vague instructions produce vague results
3. **Prioritize Correctly**: Intelligence > Quality > Personality
4. **Provide Examples**: Show the AI exactly what you want
5. **Plan for Failure**: How should AI handle mistakes?
6. **Iterate Constantly**: Prompts are never "done", always improving
7. **Measure Results**: Track metrics to prove improvements
8. **Keep it Balanced**: Don't over-constrain or under-constrain

**Remember**: The goal is an AI companion that feels intelligent, natural, and engaging. Not perfect, but consistent. Not robotic, but reliable. Balance is key.
