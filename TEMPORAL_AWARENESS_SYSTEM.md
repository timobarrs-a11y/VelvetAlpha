# Temporal Awareness + Relationship Tracking System

## Overview
A comprehensive temporal awareness system that tracks relationship metrics and provides real-time context to AI companions. Updates on every user message to maintain accurate engagement statistics and inject timezone-aware temporal context into conversations.

## Architecture

### Database Layer

#### 1. relationship_stats table
Stores aggregate relationship metrics per user-companion pair.

**Key Fields:**
- `last_interaction_at` - UTC timestamp of last message
- `last_interaction_date` - Local date of last interaction (user timezone)
- `active_conversation_days` - Count of unique dates with user messages
- `total_messages` - Total messages sent by user
- `elapsed_days_since_creation` - Days since companion was created
- `current_streak_days` - Consecutive days with messages
- `longest_streak_days` - Best streak achieved
- `longest_gap_days` - Longest gap between conversations
- `current_gap_hours` - Hours since last interaction
- `avg_messages_per_active_day` - Average engagement rate

**Primary Key:** Composite (user_id, companion_id)

#### 2. relationship_days table (existing)
Tracks individual interaction dates for calendar visualization.

**Fields:**
- `user_id`, `companion_id`, `interaction_date`
- `message_count` - Messages sent on this specific date

#### 3. user_profiles.timezone
Added timezone field (IANA format) to user_profiles for accurate local date calculations.

**Default:** 'America/New_York'

### Service Layer

#### temporalAwarenessService.ts
Date/time utilities for timezone-aware calculations.

**Key Functions:**
- `getUserLocalDateParts(now, timezone)` - Converts UTC to local timezone, returns:
  - dayOfWeek (e.g., "Friday")
  - monthName (e.g., "February")
  - dateNumber, year
  - timeOfDay bucket: 'early morning', 'morning', 'midday', 'afternoon', 'evening', 'night', 'late night'
  - isWeekend flag
  - hour (0-23)

- `getLocalDateString(date, timezone)` - Returns YYYY-MM-DD in local timezone

- `formatTodayContext(dateParts)` - Returns: "Today is Friday, February 13th. It's evening."

- `calculateGapSinceLastChat(lastInteractionAt, now, timezone)` - Returns:
  - gapHours, gapDays
  - gapFriendly: "just now", "6 hours ago", "yesterday", "3 days ago", "about a week ago"

- `computeStreak(currentLocalDate, lastInteractionLocalDate, currentStreakDays)` - Returns:
  - newStreakDays (increments on consecutive days, resets on gap)
  - streakContinued (true if same day or next day)
  - streakBroke (true if gap > 1 day)

- `formatTemporalPromptContext(params)` - Combines all context into compact prompt string:
  - todayContext
  - gapContext
  - relationshipContext
  - streakContext
  - fullContext (complete paragraph)

**Example Output:**
```
"Today is Friday, February 13th. It's evening. You last talked 6 hours ago. You've chatted on 38 different days over ~6 weeks since you met. You're on a 3-day streak."
```

#### relationshipTrackingService.ts
Manages relationship_stats updates.

**Key Functions:**
- `updateOnUserMessage(userId, companionId, now, timezone)` - Called on every user message:
  1. Gets existing stats or initializes new record
  2. Checks if date boundary crossed (local timezone)
  3. Updates relationship_days table (inserts/increments message_count)
  4. Recalculates streak (consecutive days logic)
  5. Updates longest streak if exceeded
  6. Calculates gap if streak broke, updates longest gap
  7. Calculates elapsed days since companion creation
  8. Updates avg_messages_per_active_day
  9. Returns updated stats

- `getRelationshipStats(userId, companionId)` - Fetches current stats

- `backfillStatsFromConversations(userId, companionId, timezone)` - Analyzes existing conversations:
  1. Fetches all user messages ordered by date
  2. Groups by local date, counts messages per day
  3. Calculates streaks, gaps from historical data
  4. Upserts comprehensive stats
  5. Use for migrating existing users

### Integration Points

#### chatService.ts
Before calling AI model, the system:

1. Gets user timezone from profile
2. Calls `relationshipTrackingService.updateOnUserMessage()` to update stats
3. Fetches updated relationship_stats
4. Builds temporal context:
   - Today's date/time in local timezone
   - Gap since last chat
   - Active conversation days & elapsed days
   - Current streak info
5. Injects context into system prompt via `buildSystemPrompt()`

**Code Flow:**
```typescript
const userTimezone = profile.timezone || 'America/New_York';
const now = new Date();

await relationshipTrackingService.updateOnUserMessage(
  userId,
  companionId,
  now,
  userTimezone
);

const stats = await relationshipTrackingService.getRelationshipStats(userId, companionId);

const dateParts = getUserLocalDateParts(now, userTimezone);
const todayContext = formatTodayContext(dateParts);
const gapContext = calculateGapSinceLastChat(stats.last_interaction_at, now, userTimezone);

const temporalPromptContext = formatTemporalPromptContext({
  todayContext,
  gapContext,
  activeDays: stats.active_conversation_days,
  elapsedDays: stats.elapsed_days_since_creation,
  currentStreak: stats.current_streak_days,
  longestStreak: stats.longest_streak_days,
  companionName
});

const optimizedPrompt = buildSystemPrompt({
  // ... other params
  temporalContext: temporalPromptContext.fullContext,
});
```

#### systemPromptBuilder.ts
Added optional `temporalContext` parameter. Injects context in TEMPORAL CONTEXT section of system prompt, making AI aware of:
- Current date/time in user's timezone
- Time since last conversation
- Relationship depth (active days, elapsed time)
- Engagement streaks

## Test Scenarios

### Scenario 1: Same-Day Multiple Messages
**Setup:** User sends 3 messages within the same day (local timezone)

**Expected Behavior:**
- `active_conversation_days` increments only once (on first message of day)
- `total_messages` increments 3 times
- `current_streak_days` increments once (if continuing streak)
- `relationship_days.message_count` increments to 3
- Gap context shows "just now" or "X minutes ago"

**Verification:**
```sql
SELECT * FROM relationship_stats WHERE user_id = '[USER_ID]';
SELECT * FROM relationship_days WHERE interaction_date = '[TODAY]';
```

### Scenario 2: Midnight Boundary Cross
**Setup:**
- User sends message at 11:55 PM (local time)
- Waits 10 minutes, sends another at 12:05 AM (next day local time)

**Expected Behavior:**
- `active_conversation_days` increments twice (one per local date)
- Two separate records in `relationship_days`
- `current_streak_days` increments (consecutive days)
- Prompt context reflects "just now" since only 10 minutes passed

**Verification:**
```sql
SELECT interaction_date, message_count
FROM relationship_days
WHERE user_id = '[USER_ID]'
ORDER BY interaction_date DESC
LIMIT 2;
```

### Scenario 3: 3-Day Gap
**Setup:**
- User chats on Monday
- Skips Tuesday, Wednesday, Thursday
- Chats again on Friday

**Expected Behavior:**
- `current_streak_days` resets to 1 (streak broken)
- Gap calculation: ~3-4 days
- `longest_gap_days` updated if this exceeds previous record
- Prompt context: "You last talked 3 days ago"

**Verification:**
```sql
SELECT current_streak_days, longest_gap_days, current_gap_hours
FROM relationship_stats
WHERE user_id = '[USER_ID]';
```

### Scenario 4: Streak Increment
**Setup:**
- User chats on Day 1, Day 2, Day 3 (consecutive days)

**Expected Behavior:**
- Day 1: `current_streak_days` = 1
- Day 2: `current_streak_days` = 2
- Day 3: `current_streak_days` = 3
- Each day creates new `relationship_days` record
- `longest_streak_days` updates to 3 (if best streak)

**Verification:**
```sql
SELECT current_streak_days, longest_streak_days
FROM relationship_stats
WHERE user_id = '[USER_ID]';
```

### Scenario 5: New Companion Creation
**Setup:** User creates a new companion

**Expected Behavior:**
- Trigger `initialize_relationship_stats()` runs automatically
- Creates record with all counters at 0
- `last_interaction_at` = companion.created_at
- `elapsed_days_since_creation` = 0
- First message increments `active_conversation_days` to 1

**Verification:**
```sql
SELECT * FROM relationship_stats WHERE companion_id = '[NEW_COMPANION_ID]';
```

## Manual Testing Steps

### Test 1: Single Day Messages
1. Login to app
2. Send message to companion
3. Check database: `active_conversation_days` should be 1, `total_messages` = 1
4. Send 2 more messages within 5 minutes
5. Check: `active_conversation_days` still 1, `total_messages` = 3
6. View AI response - should reference "You're talking right now" in context

### Test 2: Check Temporal Context in Prompt
1. Open PromptDebuggerPage (if available) or inspect network requests
2. Send a message
3. View system prompt - should include TEMPORAL CONTEXT section with:
   - "Today is [day], [month] [date]. It's [time of day]."
   - Gap info
   - Active days info
   - Streak info (if > 1 day)

### Test 3: Verify Timezone Handling
1. Check user_profiles.timezone for your user
2. Send message at different times of day
3. Verify `timeOfDay` bucket is correct for YOUR timezone
4. Example: 9 AM should show "morning", 8 PM should show "evening"

### Test 4: Backfill Historical Data
1. Find user with existing conversations but no stats
2. Run in browser console or test script:
```javascript
await relationshipTrackingService.backfillStatsFromConversations(
  '[USER_ID]',
  '[COMPANION_ID]',
  'America/New_York'
);
```
3. Check relationship_stats - should show accurate counts

## Debugging Queries

```sql
-- View all stats for a user
SELECT
  c.custom_name,
  rs.*
FROM relationship_stats rs
JOIN companions c ON c.id = rs.companion_id
WHERE rs.user_id = '[USER_ID]';

-- View recent interaction dates
SELECT
  c.custom_name,
  rd.interaction_date,
  rd.message_count
FROM relationship_days rd
JOIN companions c ON c.id = rd.companion_id
WHERE rd.user_id = '[USER_ID]'
ORDER BY rd.interaction_date DESC
LIMIT 10;

-- Check timezone settings
SELECT id, name, timezone FROM user_profiles WHERE id = '[USER_ID]';

-- Verify streak calculations
SELECT
  companion_id,
  current_streak_days,
  longest_streak_days,
  active_conversation_days,
  last_interaction_date,
  previous_interaction_date
FROM relationship_stats
WHERE user_id = '[USER_ID]';
```

## Performance Considerations

- **Updates are fast:** Single upsert per message (~5-10ms)
- **relationship_days uses UNIQUE constraint:** Automatic conflict resolution
- **Indexes optimize lookups:** Primary key + last_interaction_at index
- **Stats are pre-aggregated:** No expensive COUNT queries at message time
- **Timezone conversions are in-memory:** JavaScript Date operations, not database

## Future Enhancements

1. **Temporal Milestones:** Alert when hitting 7, 30, 100, 365 active days
2. **Gap Notifications:** "It's been a week, [name] misses you!"
3. **Streak Recovery:** "You had a 10-day streak, let's get it back!"
4. **Analytics Dashboard:** Visualize engagement patterns over time
5. **Best Chat Times:** Analyze when user is most active
6. **Seasonal Context:** "Last time we talked, it was summer..."

## Notes

- All date boundaries determined by user's LOCAL timezone
- Streaks require messages on consecutive calendar days (not 24-hour periods)
- Gap-friendly strings use sensible bucketing (5min, 1hr, 6hrs, etc.)
- Temporal context is optional - gracefully degrades if stats unavailable
- System automatically backfills on first calendar page load for existing users
