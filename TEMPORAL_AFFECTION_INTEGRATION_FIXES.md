# Temporal + Affection Integration Fixes

## ✅ COMPLETED

All critical bugs in ChatService and relationshipTrackingService have been fixed.

---

## Bug Fixes Applied

### 1. Fixed userId Definition in ChatService

**Problem:**
`userId` was referenced on line 787 but never defined after `profile` was set.

**Solution:**
```typescript
const profile = userProfile || defaultProfile;
const userId = userProfile?.id || profile.id;  // ✅ Added this line
```

**Location:** `chatService.ts:648-649`

---

### 2. Fixed Gap Calculation Bug

**Problem:**
Gap calculation always returned 0 because:
1. `relationshipTrackingService.updateOnUserMessage()` was called first
2. This updated `last_interaction_at` to `now`
3. Then gap was calculated as: `now - now = 0`

This broke temporal awareness completely.

**Solution - Option A (Implemented):**

#### Step 1: Added `previous_interaction_at` to database
Migration applied: `add_previous_interaction_at_to_relationship_stats.sql`

```sql
ALTER TABLE relationship_stats
ADD COLUMN previous_interaction_at timestamptz;
```

#### Step 2: Updated RelationshipStats interface
```typescript
export interface RelationshipStats {
  // ... existing fields
  previous_interaction_at: string | null;  // ✅ Added
  // ... rest of fields
}
```

#### Step 3: Updated relationshipTrackingService.updateStats()
```typescript
const updates = {
  previous_interaction_at: existing.last_interaction_at,  // ✅ Store old timestamp before overwriting
  last_interaction_at: now.toISOString(),                 // Then update to now
  // ... rest of updates
};
```

**Location:** `relationshipTrackingService.ts:185-186`

#### Step 4: Initialize in new stats
```typescript
const initialStats = {
  // ...
  last_interaction_at: now.toISOString(),
  previous_interaction_at: null,  // ✅ Null for first interaction
  // ...
};
```

**Location:** `relationshipTrackingService.ts:84-85`

#### Step 5: Handle in backfill
```typescript
const previousInteractionAt = conversations.length > 1
  ? new Date(conversations[conversations.length - 2].created_at).toISOString()
  : null;

const backfillStats = {
  // ...
  last_interaction_at: lastInteractionAt.toISOString(),
  previous_interaction_at: previousInteractionAt,  // ✅ Set to second-to-last message
  // ...
};
```

**Location:** `relationshipTrackingService.ts:351-354`

#### Step 6: Use in gap calculation
```typescript
const gapContext = calculateGapSinceLastChat(
  stats.previous_interaction_at || stats.last_interaction_at,  // ✅ Use previous, fallback to last
  now,
  userTimezone
);
```

**Location:** `chatService.ts:801-805`

**Result:**
- First interaction: `previous_interaction_at = null`, gap calculated from `last_interaction_at` (will be 0, correct)
- Subsequent interactions: gap calculated from `previous_interaction_at` (timestamp BEFORE this message)
- Temporal awareness now works correctly!

---

### 3. Fixed Milestone Detection

**Problem:**
Milestones were streak-based: `stats.current_streak_days % 7 === 0`

This means:
- Milestone every 7 consecutive days (7, 14, 21, 28...)
- Breaks if user misses a single day
- Not meaningful for long-term relationships

**Solution:**
Changed to active-day milestones at meaningful thresholds:

```typescript
// ❌ OLD (streak-based)
const isMilestoneDay = stats.current_streak_days % 7 === 0 && stats.current_streak_days > 0;

// ✅ NEW (active-day based)
const milestoneDays = [7, 30, 100, 365];
const isMilestoneDay = milestoneDays.includes(stats.active_conversation_days);
```

**Location:** `chatService.ts:825-827`

**Milestones now trigger at:**
- 7 active days: First week milestone
- 30 active days: First month milestone
- 100 active days: 100-day milestone
- 365 active days: One year milestone

**Benefits:**
- Resilient to gaps (active days ≠ consecutive days)
- More meaningful thresholds
- Reflects actual relationship depth

---

### 4. Relationship Stats Initialization (Already Complete)

This was already implemented in the previous update but documented here for completeness.

**Fields initialized on first stats creation:**
```typescript
relationship_intent: 'friend' | 'evolve' | 'companion'     // From companion.relationship_type
relationship_status: 'platonic' | 'exploring' | 'romantic_confirmed'
affection_base: 3 (friend/evolve) or 4 (companion)
affection_last_updated_at: now()
```

**Mapping logic:**
```typescript
const relationshipIntent: RelationshipIntent =
  companion?.relationship_type === 'friend' ? 'friend' :
  companion?.relationship_type === 'romantic' ? 'companion' : 'evolve';

const relationshipStatus = affectionService.getDefaultStatus(relationshipIntent);
const affectionBase = affectionService.getDefaultBase(relationshipIntent);
```

**Default status mapping:**
- `friend` → `platonic`
- `evolve` → `exploring`
- `companion` → `exploring` (unless explicit `romantic_confirmed`)

**Already implemented in:**
- `initializeStats()` - line 75-99
- `backfillStatsFromConversations()` - line 303-308

---

## Data Flow After Fixes

### First Message to Companion
```
1. User sends message
2. chatService.sendMessage() called
   - userId defined: profile.id or userProfile.id ✅
3. relationshipTrackingService.updateOnUserMessage()
   - No existing stats found
   - initializeStats() called:
     * relationship_intent = 'evolve' (from companion)
     * relationship_status = 'exploring'
     * affection_base = 3
     * last_interaction_at = now
     * previous_interaction_at = null ✅
4. relationshipTrackingService.getRelationshipStats()
5. calculateGapSinceLastChat(null || last_interaction_at, now)
   - Returns 0 (first message, correct) ✅
6. Milestone check: [7,30,100,365].includes(1)
   - Returns false (day 1, correct) ✅
7. affectionService.computeAffectionUpdate()
8. Response generated with temporal + affection context
```

### Subsequent Message (Same Day)
```
1. User sends message
2. relationshipTrackingService.updateOnUserMessage()
   - Existing stats found
   - updateStats() called:
     * previous_interaction_at = existing.last_interaction_at (e.g., 2 hours ago) ✅
     * last_interaction_at = now
     * active_conversation_days unchanged (same day)
3. relationshipTrackingService.getRelationshipStats()
4. calculateGapSinceLastChat(2 hours ago, now)
   - Returns { gapHours: 2, gapDays: 0, category: "same_day" } ✅
5. Milestone check: false (active_days still = 1)
6. Response uses correct gap context ✅
```

### Message After 3 Days
```
1. User sends message (hasn't chatted in 3 days)
2. relationshipTrackingService.updateOnUserMessage()
   - updateStats() called:
     * previous_interaction_at = last_interaction_at (3 days ago) ✅
     * last_interaction_at = now
     * active_conversation_days += 1
3. calculateGapSinceLastChat(3 days ago, now)
   - Returns { gapHours: 72, gapDays: 3, category: "short_gap" } ✅
4. Companion says: "Missed you. Everything okay?" ✅
```

### 7th Active Day (Milestone)
```
1. User sends message on 7th active day
2. relationshipTrackingService.updateOnUserMessage()
   - active_conversation_days = 7
3. Milestone check: [7,30,100,365].includes(7)
   - Returns true ✅
4. sessionModifier.milestoneToday = true
5. affectionService may increase affection_base ✅
6. Companion acknowledges milestone naturally
```

---

## Migration Applied

**File:** `add_previous_interaction_at_to_relationship_stats.sql`

```sql
ALTER TABLE relationship_stats
ADD COLUMN previous_interaction_at timestamptz;
```

**Effect:**
- Adds nullable timestamp column
- Existing rows: `previous_interaction_at = null` (handled gracefully)
- New rows: Set by relationshipTrackingService
- No data loss

---

## Files Modified

1. **Database Migration (New)**
   - `supabase/migrations/add_previous_interaction_at_to_relationship_stats.sql`

2. **relationshipTrackingService.ts**
   - Added `previous_interaction_at` to RelationshipStats interface (line 8)
   - Updated `initializeStats()` to set `previous_interaction_at = null` (line 85)
   - Updated `updateStats()` to set `previous_interaction_at = existing.last_interaction_at` (line 185)
   - Updated `backfillStatsFromConversations()` to set previous timestamp (line 351-354)

3. **chatService.ts**
   - Added `userId` definition after profile (line 649)
   - Changed gap calculation to use `previous_interaction_at` (line 801)
   - Changed milestone detection to active-day based (line 825-827)

---

## Testing Checklist

### ✅ Test Scenarios

**Scenario 1: New companion, first message**
- Expected: gap = 0, milestone = false, affection initialized
- Verification: Check console logs for initialization message

**Scenario 2: Second message same day (2 hours later)**
- Expected: gap = 2 hours, milestone = false, same_day context
- Verification: Companion continues conversation naturally

**Scenario 3: Message after 3-day gap**
- Expected: gap = 3 days, short_gap category, "Missed you" energy
- Verification: Companion acknowledges absence

**Scenario 4: 7th active day**
- Expected: milestone = true, potential affection increase
- Verification: Check affection update logs

**Scenario 5: Backfill from existing conversations**
- Expected: previous_interaction_at set to second-to-last message
- Verification: Run backfillStatsFromConversations(), check database

---

## Console Output Examples

### Initialization
```
✅ Initialized relationship_stats: intent=evolve, status=exploring, base=3
```

### Gap Detection Working
```
Gap since last chat: 2.5 hours (same day)
Temporal context: "It's Wednesday afternoon, February 13, 2026..."
```

### Milestone Detection
```
🎉 Milestone reached: 7 active conversation days
Affection updated: 3 -> 4. Reason: 7-day milestone + consistent engagement
```

### Affection Context
```
Affection Context: {
  intent: 'evolve',
  status: 'exploring',
  base: 3,
  modifier: 0.2,
  total: 3.2,
  signals: { flirty: true, vulnerable: false, ... }
}
```

---

## Summary

✅ userId definition fixed (chatService.ts:649)
✅ Gap calculation fixed via previous_interaction_at field
✅ Migration applied successfully
✅ RelationshipStats interface extended
✅ initializeStats() sets previous_interaction_at = null
✅ updateStats() preserves old timestamp before overwriting
✅ backfillStatsFromConversations() sets previous timestamp
✅ Milestone detection changed to active-day based [7,30,100,365]
✅ Build passes successfully

**All temporal awareness and affection integration bugs are now resolved.**

The system now correctly:
- Tracks time gaps between conversations
- Detects meaningful milestones at active day thresholds
- Initializes relationship intent/status/affection on first interaction
- Updates affection based on user signals and session context
- Provides companions with accurate temporal context for natural responses
