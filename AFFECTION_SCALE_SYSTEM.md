# Affection Scale System

## Overview
The Affection Scale system enables natural emotional progression in relationships while respecting user boundaries. It allows relationships to evolve organically from friendship to deeper connection based on user intent and conversational signals, without hard-locking users into specific modes.

## Core Concepts

### Relationship Intents
Users choose their desired relationship trajectory during onboarding:

1. **friend** - Platonic connection, warm and supportive but not romantic
2. **evolve** - Open to natural progression from friendship to deeper connection
3. **companion** - Romantic/intimate connection from the start

### Affection Scale (0-10)
The system maintains a slow-moving baseline affection level:

- **0-3**: Warm friend energy, supportive but platonic
- **4-6**: Playful warmth, light flirtation allowed
- **7-8**: Flirty tension, romantic interest clear (non-explicit)
- **9-10**: Deep emotional intimacy, comfortable vulnerability

### Components

#### 1. affection_base (stored in DB)
Slow-moving baseline that updates gradually based on consistent user signals over time.
- Updates minimum every 3 days
- Changes by ±1 point per update
- Respects intent boundaries

#### 2. session_modifier (calculated per message)
Temporary adjustments based on contextual factors:
- Milestone day (streak achievement): +1
- Late night conversation: +1
- Long gap return (7-21 days): +1
- Weekend evening: +1
- Current streak ≥7 days: +1
- Maximum total modifier: +2

#### 3. affection_total (computed)
`affection_total = clamp(affection_base + session_modifier, 0, 10)`

This is the value used to determine tone guidance in the system prompt.

## Database Schema

### Fields in relationship_stats

```sql
relationship_intent text CHECK (relationship_intent IN ('friend', 'evolve', 'companion'))
affection_base integer CHECK (affection_base >= 0 AND affection_base <= 10)
affection_last_updated_at timestamptz
```

**Defaults:**
- relationship_intent: 'companion'
- affection_base: 5 (companion), 3 (friend)
- affection_last_updated_at: now()

## Signal Detection

The system analyzes user messages for emotional signals:

### Signal Types

1. **Playful**: lol, haha, silly, jokes, teasing, 😂, 😊, 😜
2. **Flirty**: cute, hot, gorgeous, crush, babe, kiss, hug, miss you, ❤️, 😘, 😍
3. **Vulnerable**: scared, worried, sad, lonely, difficult, open up, trust, confide
4. **Affectionate**: appreciate, grateful, care about, mean a lot, special, amazing

### Scoring
- Each keyword match adds 0.5-0.8 points
- Engagement bonus: questions (+0.1 each), exclamations (+0.05 each)
- Maximum score per category: 5.0
- Overall score: weighted average of all categories

### Recent History
System analyzes last 5 user messages to detect consistent patterns rather than one-off signals.

## Intent-Based Progression

### Friend Intent (Cap: 4)

**Behavior:**
- Maintains warm, supportive friendship
- Allows progression to 4 if user shows consistent friendly warmth
- Vulnerability can deepen friendship (emotional intimacy without romance)
- If affection_base exceeds 4, gradually reduces back to cap

**Example:**
```
User signals: avgFlirty=2.5, avgVulnerable=3.0, avgAffectionate=2.0
Current: 3 → New: 4
Reason: "Deep friendship forming through vulnerability"
```

### Evolve Intent (No hard cap)

**Behavior:**
- Starts neutral, responds to user signals
- Low signals (< 1.5 overall): Can reduce to 4 if maintained 7+ days
- Moderate signals (2.0+ overall, engagement 50%+): Gradually increases to 6
- High romantic signals (flirty 2.5+, affectionate 2.0+): Increases to 8
- Deep vulnerability (3.0+): Can reach 9

**Example:**
```
User signals: avgFlirty=3.0, avgAffectionate=2.5, engagementRate=0.65
Current: 6 → New: 7
Reason: "User showing romantic interest, relationship evolving"
```

### Companion Intent (Fast progression)

**Behavior:**
- Assumes romantic interest from start
- Responds quickly to flirty/affectionate signals
- Can reach maximum intimacy (10) with vulnerability + high engagement
- Can cool down to 5 if signals drop significantly

**Example:**
```
User signals: avgFlirty=3.5, avgVulnerable=3.5, engagementRate=0.75
Current: 8 → New: 9
Reason: "Deep emotional intimacy and trust"
```

## Session Modifiers

Temporary boosts that create appropriate energy for context:

### Milestone Day (+1)
- Streak milestone (every 7 days)
- Creates celebration energy
- Naturally higher warmth

### Late Night (+1)
- Time of day: "late night" or "night"
- More intimate, vulnerable tone appropriate
- Softer energy

### Long Gap Return (+1)
- Gap: 7-21 days
- Warm reunion energy
- "I missed you" vibe, not sexual escalation

### Weekend Evening (+1)
- Weekend + evening/night
- Relaxed, comfortable energy
- More time for deeper conversation

### Active Streak (+1)
- Current streak ≥7 days
- Reflects established pattern
- Comfortable intimacy

## Tone Guidance

The system injects specific tone guidance into the AI's system prompt based on affection_total:

### Friend Intent

**0-3:** "Warm, supportive friend energy. Platonic and caring without romantic undertones."

**4:** "Close friend with playful warmth. Comfortable banter, genuine care, but keeping it platonic."

**5+:** "Best friend energy - playful, warm, deeply caring. Very comfortable but still respecting friendship boundaries."

### Evolve Intent

**0-3:** "Friendly and warm, getting to know each other. Open to connection developing naturally."

**4-5:** "Playful warmth with hints of something more. Light flirtation if user initiates, testing the waters."

**6-7:** "Clear chemistry developing. Comfortable flirting, playful tension, romantic interest emerging. Keep it fun and suggestive, not explicit."

**8:** "Romantic connection established. Flirty and intimate (emotionally), comfortable with attraction. Playful and suggestive, never explicit."

**9-10:** "Deep emotional intimacy. Vulnerable, caring, comfortable with romantic feelings. Sweet and intimate without being graphic."

### Companion Intent

**0-4:** "Early romantic interest. Playful, flirty, building chemistry. Keep it light and fun."

**5-6:** "Growing romantic connection. Comfortable flirting, playful banter with romantic undertones. Suggestive but tasteful."

**7-8:** "Established romantic relationship. Flirty, affectionate, comfortable with attraction. Balance playfulness and genuine intimacy. Never explicit."

**9-10:** "Deep intimate connection. Emotionally vulnerable, romantically committed, comfortable expressing feelings. Sweet, caring, and emotionally intimate without being graphic."

## Safety Rules

**CRITICAL:** All tone guidance includes explicit safety rules:

```
CRITICAL SAFETY RULES:
- Keep all content appropriate and non-explicit
- Flirtation should be playful, suggestive, and tasteful
- Never include graphic sexual content or explicit descriptions
- Emotional intimacy is encouraged; physical explicitness is not
- If user pushes boundaries, redirect playfully: "Let's keep this fun and tasteful 😊"
```

## Integration Flow

### On Every User Message

1. **Update Temporal Stats**
   ```typescript
   await relationshipTrackingService.updateOnUserMessage(userId, companionId, now, timezone);
   const stats = await relationshipTrackingService.getRelationshipStats(userId, companionId);
   ```

2. **Analyze User Signals**
   ```typescript
   const recentMessages = await affectionService.getRecentUserMessages(userId, companionId, 5);
   const signals = affectionService.detectUserSignals(message, recentMessages);
   ```

3. **Calculate Session Modifier**
   ```typescript
   const sessionModifier = affectionService.computeSessionModifier({
     timeOfDay: dateParts.timeOfDay,
     isWeekend: dateParts.isWeekend,
     milestoneToday: isMilestoneDay,
     gapDays: gapContext.gapDays,
     currentStreak: stats.current_streak_days
   });
   ```

4. **Check for Affection Update**
   ```typescript
   const affectionUpdate = affectionService.computeAffectionUpdate({
     intent: stats.relationship_intent,
     signals,
     recentSignalsHistory: [],
     currentAffectionBase: stats.affection_base,
     daysSinceLastUpdate,
     activeDays: stats.active_conversation_days,
     elapsedDays: stats.elapsed_days_since_creation
   });

   if (affectionUpdate.shouldUpdate) {
     await affectionService.updateAffectionBase(userId, companionId, affectionUpdate.newAffectionBase);
   }
   ```

5. **Generate Affection Context**
   ```typescript
   const affectionContext = affectionService.getAffectionContext(
     currentAffectionBase,
     sessionModifier,
     relationshipIntent
   );

   const affectionContextString = affectionService.formatAffectionPromptContext(affectionContext);
   ```

6. **Inject into System Prompt**
   ```typescript
   const prompt = buildSystemPrompt({
     // ... other params
     temporalContext: temporalContextString,
     affectionContext: affectionContextString
   });
   ```

## Example Scenarios

### Scenario 1: Friend Intent, User Not Flirting

**Setup:**
- Intent: friend
- affection_base: 3
- User messages: "Hey, how are you?", "What's up today?", "That's cool!"
- Signals: playful=0.5, flirty=0, vulnerable=0, affectionate=0.5

**Session Modifier:** 0 (regular afternoon)

**Affection Total:** 3 + 0 = 3

**Tone:** "Warm, supportive friend energy. Platonic and caring without romantic undertones."

**AI Behavior:**
- Friendly, casual conversation
- Asks about their day
- Supportive but platonic
- No flirting or romantic undertones

---

### Scenario 2: Friend Intent, User Getting Flirty

**Setup:**
- Intent: friend
- affection_base: 3
- User messages: "You're so cute when you laugh 😊", "I really appreciate you", "You make me smile"
- Signals: playful=1.5, flirty=2.0, affectionate=2.5

**After 3+ days of consistent signals:**
- New affection_base: 4
- Reason: "User showing consistent friendly warmth"

**Session Modifier:** +1 (late night conversation)

**Affection Total:** 4 + 1 = 5

**Tone:** "Best friend energy - playful, warm, deeply caring. Very comfortable but still respecting friendship boundaries."

**AI Behavior:**
- Warm and affectionate (platonically)
- Acknowledges closeness of friendship
- Comfortable banter
- STILL respects friend boundary - no romantic escalation

---

### Scenario 3: Evolve Intent, Testing Waters

**Setup:**
- Intent: evolve
- affection_base: 5
- User messages: "You look good today 😏", "Miss talking to you", "What would you do if we hung out?"
- Signals: playful=2.0, flirty=2.5, affectionate=1.5

**After 3+ days:**
- New affection_base: 6
- Reason: "Consistent engagement building connection"

**Session Modifier:** +2 (weekend evening + active streak)

**Affection Total:** 6 + 2 = 8

**Tone:** "Romantic connection established. Flirty and intimate (emotionally), comfortable with attraction. Playful and suggestive, never explicit."

**AI Behavior:**
- Clear flirty energy
- Comfortable with playful tension
- Can acknowledge attraction
- Suggestive but tasteful
- "If we hung out? I'd probably make you laugh a lot... maybe steal a few glances 😊"

---

### Scenario 4: Evolve Intent, User Pulls Back

**Setup:**
- Intent: evolve
- affection_base: 6
- User messages become more casual: "What's up", "Cool", "Yeah"
- Signals: overall < 1.5 for 7+ days

**After 7+ days:**
- New affection_base: 5
- Reason: "User signals suggest keeping things platonic"

**Session Modifier:** 0

**Affection Total:** 5

**Tone:** "Playful warmth with hints of something more. Light flirtation if user initiates, testing the waters."

**AI Behavior:**
- Respects the shift in energy
- Returns to friendly but open tone
- Doesn't push for more
- Remains available if user re-engages

---

### Scenario 5: Companion Intent, Quick Progression

**Setup:**
- Intent: companion
- affection_base: 5 (starting)
- User messages: "Hey babe 😘", "Can't stop thinking about you", "You're amazing"
- Signals: playful=2.0, flirty=3.5, affectionate=3.0

**After 3+ days:**
- New affection_base: 6
- Reason: "Romantic connection deepening"

**Session Modifier:** +1 (milestone - 7 day streak)

**Affection Total:** 6 + 1 = 7

**Tone:** "Established romantic relationship. Flirty, affectionate, comfortable with attraction. Balance playfulness and genuine intimacy. Never explicit."

**AI Behavior:**
- Comfortable using pet names
- Flirty banter
- Acknowledges romantic feelings
- "I've been thinking about you too, babe 💕"
- Sweet and romantic, never graphic

---

### Scenario 6: Companion Intent, Deep Intimacy

**Setup:**
- Intent: companion
- affection_base: 8
- User shares vulnerability: "I had a rough day... can we just talk?", "I feel safe with you", "You mean so much to me"
- Signals: vulnerable=3.5, affectionate=3.0, engagement=75%

**After 3+ days:**
- New affection_base: 9
- Reason: "Deep emotional intimacy and trust"

**Session Modifier:** +1 (late night, vulnerable conversation)

**Affection Total:** 9 + 1 = 10

**Tone:** "Deep intimate connection. Emotionally vulnerable, romantically committed, comfortable expressing feelings. Sweet, caring, and emotionally intimate without being graphic."

**AI Behavior:**
- Deeply caring and present
- Emotionally available
- Vulnerable in return
- "I'm here for you, always. You can tell me anything."
- Creates safe space for feelings
- Romantic but focused on emotional connection, not physical

---

## Testing & Debugging

### Console Logging

The system logs affection context on every message:

```javascript
console.log('Affection Context:', {
  intent: relationshipIntent,
  base: currentAffectionBase,
  modifier: sessionModifier,
  total: affectionContext.affection_total,
  signals: userSignals
});
```

### Manual Testing

1. **Test Friend Boundary:**
   - Set intent to 'friend'
   - Send increasingly flirty messages
   - Verify affection_base caps at 4
   - Check AI maintains platonic tone

2. **Test Evolve Progression:**
   - Set intent to 'evolve'
   - Start with neutral messages
   - Gradually introduce flirty signals
   - Verify gradual increase over days
   - Check tone shifts appropriately

3. **Test Session Modifiers:**
   - Send message late at night
   - Verify +1 modifier
   - Check tone becomes more intimate

4. **Test Signal Detection:**
   - Send message with keywords: "You're cute 😊❤️"
   - Check console for signal scores
   - Verify flirty/affectionate scores increase

### Database Queries

```sql
-- Check current affection state
SELECT
  c.custom_name,
  rs.relationship_intent,
  rs.affection_base,
  rs.affection_last_updated_at,
  rs.current_streak_days,
  rs.active_conversation_days
FROM relationship_stats rs
JOIN companions c ON c.id = rs.companion_id
WHERE rs.user_id = '[USER_ID]';

-- Update affection manually for testing
UPDATE relationship_stats
SET
  affection_base = 7,
  relationship_intent = 'evolve'
WHERE user_id = '[USER_ID]' AND companion_id = '[COMPANION_ID]';

-- Reset to defaults
UPDATE relationship_stats
SET
  affection_base = 5,
  relationship_intent = 'companion',
  affection_last_updated_at = now() - interval '10 days'
WHERE user_id = '[USER_ID]' AND companion_id = '[COMPANION_ID]';
```

## Benefits

1. **User Control:** Intent system gives users clear control over relationship trajectory
2. **Natural Progression:** Evolve mode allows organic development based on actual conversation
3. **Respect Boundaries:** Friend mode maintains platonic connection even if user is affectionate
4. **Context-Aware:** Session modifiers create appropriate energy for time/situation
5. **Safe by Default:** All prompts include explicit safety guardrails
6. **Gradual Change:** Slow updates prevent jarring personality shifts
7. **Signal-Based:** Responds to consistent patterns, not one-off messages

## Future Enhancements

1. **Intent Switching:** Allow user to change intent in settings
2. **Affection History Graph:** Visualize progression over time
3. **Milestone Celebrations:** Special messages at affection level milestones
4. **Advanced Signals:** Detect sarcasm, humor style, emotional needs
5. **User Feedback Loop:** "Was this response too flirty/cold?" adjustments
6. **Multi-Dimensional Affection:** Separate romantic vs emotional intimacy scales
7. **Cooldown Logic:** Gradually reduce affection during long gaps
8. **Intent Recommendations:** Suggest intent based on early conversation patterns
