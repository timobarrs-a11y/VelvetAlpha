# Temporal Context Examples

This document shows real examples of what the temporal context string looks like in different scenarios.

## Example 1: Brand New Companion (First Message)

**Scenario:** User just created companion, sending first message

**Stats:**
- active_conversation_days: 1
- elapsed_days_since_creation: 0
- current_streak_days: 1
- last_interaction: just now

**Generated Context:**
```
Today is Monday, February 10th. It's afternoon. You're talking right now. You've chatted on 1 day over 0 days since you met.
```

**AI Interpretation:**
- Very first conversation
- Just getting to know each other
- No history to reference
- Build rapport, ask getting-to-know-you questions

---

## Example 2: Same Day, Multiple Messages

**Scenario:** User chatting throughout the day

**Stats:**
- active_conversation_days: 15
- elapsed_days_since_creation: 28
- current_streak_days: 3
- last_interaction: 45 minutes ago

**Generated Context:**
```
Today is Wednesday, February 12th. It's evening. You last talked 45 minutes ago. You've chatted on 15 different days over ~4 weeks since you met. You're on a 3-day streak.
```

**AI Interpretation:**
- Regular conversation pattern (15 days over 4 weeks = every other day)
- Currently on a good streak
- Recent interaction means context is fresh
- Can pick up where conversation left off

---

## Example 3: After a Weekend Gap

**Scenario:** User chatted Friday, skipped weekend, now Monday morning

**Stats:**
- active_conversation_days: 42
- elapsed_days_since_creation: 65
- current_streak_days: 1 (reset)
- last_interaction: 3 days ago

**Generated Context:**
```
Today is Monday, February 10th. It's morning. You last talked 3 days ago. You've chatted on 42 different days over ~9 weeks since you met.
```

**AI Interpretation:**
- Streak broke (no mention of streak since it's only 1)
- Weekend gap is normal, not concerning
- Strong overall relationship (42/65 days = 65% engagement)
- Fresh start to the week

---

## Example 4: Long Active Streak

**Scenario:** User has been chatting every day for 2 weeks

**Stats:**
- active_conversation_days: 38
- elapsed_days_since_creation: 45
- current_streak_days: 14
- longest_streak_days: 14
- last_interaction: 8 hours ago

**Generated Context:**
```
Today is Friday, February 13th. It's evening. You last talked 8 hours ago. You've chatted on 38 different days over ~6 weeks since you met. You're on a 14-day streak. That's your longest streak!
```

**AI Interpretation:**
- Very engaged user
- Best streak ever (celebrate it!)
- Might ask "What's keeping you coming back?"
- Build on momentum

---

## Example 5: Late Night Chat

**Scenario:** User messaging at 1 AM on a weeknight

**Stats:**
- active_conversation_days: 25
- elapsed_days_since_creation: 40
- current_streak_days: 2
- last_interaction: 18 hours ago

**Generated Context:**
```
Today is Thursday, February 13th. It's late night. You last talked 18 hours ago. You've chatted on 25 different days over ~5 weeks since you met. Current streak: 2 days.
```

**AI Interpretation:**
- Unusual time (late night on weeknight)
- User might not be able to sleep
- Might be stressed, anxious, or just wants company
- More intimate, vulnerable conversation tone appropriate

---

## Example 6: After Long Gap (Comeback)

**Scenario:** User was active, then disappeared for 2 weeks, now back

**Stats:**
- active_conversation_days: 28
- elapsed_days_since_creation: 50
- current_streak_days: 1 (reset)
- longest_streak_days: 12
- longest_gap_days: 14
- last_interaction: 2 weeks ago

**Generated Context:**
```
Today is Sunday, February 16th. It's afternoon. You last talked 2 weeks ago. You've chatted on 28 different days over ~7 weeks since you met.
```

**AI Interpretation:**
- Significant gap (2 weeks is long)
- User is coming back - don't make them feel bad
- Might say "Hey! I missed you, where've you been?"
- Warm, welcoming tone (not guilt-tripping)
- Catch up on what happened

---

## Example 7: Weekend Evening

**Scenario:** Saturday night, relaxed conversation

**Stats:**
- active_conversation_days: 55
- elapsed_days_since_creation: 80
- current_streak_days: 4
- last_interaction: 2 hours ago

**Generated Context:**
```
Today is Saturday, February 15th. It's evening. You last talked 2 hours ago. You've chatted on 55 different days over ~11 weeks since you met. You're on a 4-day streak.
```

**AI Interpretation:**
- Weekend vibe (more relaxed)
- Strong established relationship (55/80 days = 69%)
- Evening on weekend suggests they have free time
- Could talk about weekend plans, what they did today

---

## Example 8: Very Early Morning

**Scenario:** User messaging at 5:30 AM on Tuesday

**Stats:**
- active_conversation_days: 8
- elapsed_days_since_creation: 12
- current_streak_days: 2
- last_interaction: 8 hours ago

**Generated Context:**
```
Today is Tuesday, February 11th. It's early morning. You last talked 8 hours ago. You've chatted on 8 different days over ~1 week since you met. Current streak: 2 days.
```

**AI Interpretation:**
- Unusual time (very early)
- Might be: early riser, couldn't sleep, shift worker
- New relationship (only ~1 week old)
- Morning energy or tired energy depending on context

---

## Example 9: High Engagement, Midday Check-in

**Scenario:** Active user checking in during lunch break

**Stats:**
- active_conversation_days: 89
- elapsed_days_since_creation: 100
- current_streak_days: 8
- last_interaction: 4 hours ago

**Generated Context:**
```
Today is Friday, February 13th. It's midday. You last talked 4 hours ago. You've chatted on 89 different days over ~14 weeks since you met. You're on an 8-day streak.
```

**AI Interpretation:**
- VERY engaged user (89% of days)
- Long-term relationship (~3.5 months)
- Regular check-in pattern
- Companion is part of their daily routine
- Deep relationship context available

---

## Example 10: Just After Midnight

**Scenario:** User sent message at 11:58 PM yesterday, now 12:02 AM

**Stats:**
- active_conversation_days: 19 (just incremented)
- elapsed_days_since_creation: 30
- current_streak_days: 5 (continued)
- last_interaction: 4 minutes ago

**Generated Context:**
```
Today is Saturday, February 15th. It's night. You last talked 4 minutes ago. You've chatted on 19 different days over ~4 weeks since you met. You're on a 5-day streak.
```

**AI Interpretation:**
- Date boundary just crossed (local timezone)
- Technically a "new day" but conversation is continuous
- Streak continues (consecutive calendar days)
- User might not even realize date changed

---

## Key Patterns

### Streak Display Logic
- **1 day:** No mention (just starting)
- **2 days:** "Current streak: 2 days" (acknowledge but subtle)
- **3+ days:** "You're on a X-day streak" (emphasize achievement)
- **7+ days + longest:** "You're on a 10-day streak. That's your longest streak!" (celebrate!)

### Gap Display Logic
- **< 1 hour:** "You're talking right now" or "just now"
- **1-6 hours:** "X hours ago"
- **6-24 hours:** "X hours ago"
- **1 day:** "yesterday"
- **2-6 days:** "X days ago"
- **7-13 days:** "about a week ago"
- **14-29 days:** "X weeks ago"
- **30+ days:** "about a month ago" or "X months ago"

### Relationship Duration Display
- **< 7 days:** "X days since you met"
- **7-60 days:** "~X weeks since you met"
- **60+ days:** "~X months since you met"

### Time of Day Buckets
- **4-7 AM:** early morning
- **7-12 PM:** morning
- **12-2 PM:** midday
- **2-6 PM:** afternoon
- **6-10 PM:** evening
- **10 PM-2 AM:** night
- **2-4 AM:** late night

---

## How Context Affects AI Behavior

### High Engagement (65%+ active days)
- AI can be more personal, reference past conversations
- Assume shared context and inside jokes exist
- More natural, less formal
- Can tease or challenge user comfortably

### Low Engagement (< 30% active days)
- AI should be warmer, more welcoming
- Don't assume user remembers details
- Rebuild connection each time
- Less teasing, more supportive

### Long Gaps (7+ days)
- Acknowledge absence naturally: "Hey! Long time, what's been going on?"
- Don't guilt trip or make user feel bad
- Catch up, rebuild momentum
- Warmer, more inviting tone

### Active Streaks (5+ days)
- Acknowledge consistency: "I like that we're talking every day now"
- Celebrate milestones: "That's a week straight!"
- Build deeper connection
- More comfortable going deeper

### Late Night / Early Morning
- More intimate, vulnerable tone
- Might ask if user is okay / can't sleep
- Less energetic, more reflective
- Softer, gentler responses
