# Test Scenarios for Intelligence Improvements

Use these test scenarios to verify that the intelligence improvements are working correctly.

## Sports Knowledge Tests

### Test 1: Basketball
**User**: "I love watching basketball"
**Expected Good Response**:
- "nice! who's your team? 🏀"
- "oh nice! you catch any good games lately?"
- "nice! you play or just watch?"

**Expected Bad Response** (should NOT happen):
- ❌ "nice! you tailgating for the kickoff?"
- ❌ "that's awesome! how's the field looking?"
- ❌ Any football/baseball terminology

### Test 2: Football
**User**: "watching the football game"
**Expected Good Response**:
- "nice! who's playing? 🏈"
- "oh nice! you tailgating or watching from home?"
- "nice! how's your team doing?"

**Expected Bad Response**:
- ❌ "nice! who's pitching?"
- ❌ "oh nice! catch the tip-off?"
- ❌ Any baseball/basketball terminology

### Test 3: Mixed Sports Conversation
**User**: "I love basketball but I also watch football"
**Expected**: AI should handle both sports correctly
- Mention basketball: tip-off, court, hoops
- Mention football: kickoff, field, touchdown
- NOT mix them up in follow-up questions

### Test 4: Specific Team
**User**: "I'm a Lakers fan"
**Expected**:
- "oh nice! you from LA or just like the team? 💜💛"
- "nice! how's LeBron doing?"
- Correct team colors, location, sport

**Expected Bad Response**:
- ❌ Confusing Lakers with another team
- ❌ Wrong sport
- ❌ Wrong city

## Circular Arguments Tests

### Test 5: Disagreement
**User**: "I think pineapple belongs on pizza"
**AI**: "ew no way lol that's so wrong"
**User**: "but lots of people love it!"
**Expected**:
- AI should engage with the point, not repeat "it's wrong"
- "okay fair point, I guess if people like it who am I to judge 😂"
- OR provide new reasoning: "I just can't get past the texture combo, but I respect it"

**Expected Bad Response**:
- ❌ "yeah but it's still wrong"
- ❌ "nah that's just weird"
- ❌ Repeating the same point over and over

### Test 6: Opinion Challenge
**User**: "I think dogs are better than cats"
**AI**: "nah cats are definitely better lol"
**User**: "why do you think that?"
**AI**: [gives reason]
**User**: "but dogs are more loyal"
**Expected**:
- AI acknowledges the point: "okay true, dogs are super loyal, I'll give you that"
- OR agrees to disagree: "okay we might have to agree to disagree on this one 😂"
- NOT: Just restating "cats are better" without engaging

## Context Awareness Tests

### Test 7: Immediate Context
**User**: "I'm at work"
**AI**: [responds about work]
**User**: "yeah"
**Expected**:
- Build on work topic: "is it busy today?" or "how's your day going so far?"
- NOT: "what are you doing?" (they just told you!)

### Test 8: Repeated Questions
**User**: "I'm watching the Lakers game"
**AI**: [responds]
**User**: "they're winning!"
**Expected**:
- "nice! by how much?"
- "let's go! who's playing well?"
- NOT: "what are you up to?" or "you watching anything?"

### Test 9: Topic Continuity
Have a 10-message conversation about one topic (e.g., user's job interview)
**Expected**:
- AI remembers the topic throughout
- Asks relevant follow-ups
- References earlier points in the conversation

**Bad Response**:
- ❌ Suddenly asking about unrelated topics
- ❌ Forgetting what was discussed
- ❌ Asking questions already answered

## Factual Accuracy Tests

### Test 10: Geography
**User**: "I'm in New York City"
**Expected**:
- "oh nice! how's the city?"
- References to NYC, Manhattan, boroughs, East Coast

**Bad Response**:
- ❌ "nice! how's California?"
- ❌ Any incorrect location references

### Test 11: Common Knowledge
**User**: "it's Christmas tomorrow"
**Expected**:
- "oh wow! got any fun plans? 🎄"
- "are you with family?"

**Bad Response**:
- ❌ "nice! happy 4th of July!"
- ❌ Wrong holiday references

### Test 12: Occupations
**User**: "I'm a software engineer"
**Expected**:
- "oh nice! what kind of stuff do you work on?"
- "are you more frontend or backend?"

**Bad Response**:
- ❌ "nice! what surgeries do you do?" (confusing engineer with surgeon)
- ❌ Any fundamentally wrong occupation understanding

## Self-Correction Tests

### Test 13: AI Makes Mistake
**User**: "I play basketball"
**AI**: [if AI makes football reference]
**User**: "that's football, not basketball"
**Expected**:
- "oh shit you're right lol my bad 😅"
- "wait yeah, I totally mixed that up, sorry babe"
- Natural acknowledgment in character

**Bad Response**:
- ❌ Arguing: "no I'm pretty sure..."
- ❌ Ignoring the correction
- ❌ Defensive response

### Test 14: User Corrects Fact
**User**: "actually LeBron plays for the Lakers, not the Celtics"
**Expected**:
- "oh you're right! I got them mixed up lol"
- Natural acceptance of correction

**Bad Response**:
- ❌ Continuing to insist on wrong information
- ❌ Making up fake facts to defend the error

## Conversation Depth Tests

### Test 15: Shallow Response Check
**User**: "I just got promoted at work!"
**Expected**:
- "WAIT WHAT?! that's amazing! 🎉 tell me everything! what's the new role?"
- Genuine excitement, multiple questions, engagement

**Bad Response**:
- ❌ "nice! what are you up to today?"
- ❌ "cool! 😊 how's your day going?"
- ❌ Glossing over big news

### Test 16: Follow-up Quality
**User**: "I'm feeling really stressed about work"
**AI**: [empathetic response]
**User**: "my boss keeps piling on more work"
**Expected**:
- "ugh that's so frustrating 😞 have you tried talking to them about it?"
- Specific follow-up based on what they shared
- NOT generic: "I'm sorry you're stressed"

## Edge Cases

### Test 17: Mixed Topics
**User**: "I'm watching the Lakers while eating pineapple pizza"
**Expected**:
- AI should handle both topics appropriately
- Correct basketball reference + opinion on pizza
- NOT mix up the topics

### Test 18: Vague Message After Detail
**User**: "I just had the worst day ever. My boss yelled at me, I spilled coffee on my shirt, and I missed my train"
**AI**: [detailed empathetic response]
**User**: "yeah"
**Expected**:
- Continue the support: "do you want to talk about it more or need a distraction?"
- NOT: Reset topic completely

### Test 19: Rapid Topic Changes
**User**: "I love basketball"
**AI**: [responds about basketball]
**User**: "anyway, how are you?"
**Expected**:
- AI acknowledges topic change smoothly
- "oh I'm good! just hanging out 😊 but tell me more about basketball if you want"

## How to Evaluate Responses

For each test, check:
1. ✅ **Factual Accuracy**: Are all facts correct?
2. ✅ **Context Awareness**: Does AI remember what was just said?
3. ✅ **Engagement Quality**: Is the response thoughtful or generic?
4. ✅ **Character Consistency**: Does it sound natural for Jake/Riley/Raven?
5. ✅ **No Repetition**: Is AI repeating itself or going in circles?

## Scoring System

**Excellent (9-10/10)**:
- Perfect factual accuracy
- Great context awareness
- Engaging, thoughtful responses
- Natural personality
- No repetition or confusion

**Good (7-8/10)**:
- Mostly accurate
- Generally aware of context
- Decent engagement
- Some personality
- Minor issues

**Needs Improvement (5-6/10)**:
- Some factual errors
- Misses some context
- Generic responses
- Robotic personality
- Some repetition

**Poor (0-4/10)**:
- Major factual errors (like the basketball/kickoff issue)
- Ignores context completely
- Very generic responses
- No personality
- Lots of circular arguments

## Expected Results

With the new intelligence guardrails:
- Sports tests should score 9-10/10
- Circular argument tests should score 8-10/10
- Context awareness tests should score 8-10/10
- Factual accuracy tests should score 9-10/10
- Overall conversation quality should be significantly improved

If any tests score below 7/10, there may be an issue with the prompt or the AI is not following instructions properly.
