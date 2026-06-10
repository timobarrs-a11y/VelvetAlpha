# ChatService.ts Key Fixes - Code Snippets

## Location: src/services/chatService.ts

### Fix 1: Define userId (Line 648-649)
```typescript
const profile = userProfile || defaultProfile;
const userId = userProfile?.id || profile.id;  // ✅ FIXED: Define userId

if (userProfile) {
  await this.saveMessage('user', message, companionId);
}
```

**Why:** `userId` was referenced later (line 789) but never defined, causing runtime errors.

---

### Fix 2: Use previous_interaction_at for Gap (Line 797-805)
```typescript
if (stats) {
  const dateParts = getUserLocalDateParts(now, userTimezone);
  const todayContext = formatTodayContext(dateParts);

  // ✅ FIXED: Use previous_interaction_at (timestamp BEFORE this message)
  const gapContext = calculateGapSinceLastChat(
    stats.previous_interaction_at || stats.last_interaction_at,  // Changed
    now,
    userTimezone
  );

  const temporalPromptContext = formatTemporalPromptContext({
    todayContext,
    gapContext,
    activeDays: stats.active_conversation_days,
    elapsedDays: stats.elapsed_days_since_creation,
    currentStreak: stats.current_streak_days,
    longestStreak: stats.longest_streak_days,
    companionName
  });
```

**Why:**
- Before: Used `stats.last_interaction_at` which was just set to `now` → gap always 0
- After: Uses `previous_interaction_at` (old timestamp) → accurate gap calculation

**Flow:**
```
updateOnUserMessage() → last_interaction_at = NOW, previous_interaction_at = OLD_TIME
getRelationshipStats() → returns stats with previous_interaction_at
calculateGapSinceLastChat(OLD_TIME, NOW) → correct gap!
```

---

### Fix 3: Active-Day Milestone Detection (Line 825-827)
```typescript
const userSignals = affectionService.detectUserSignals(message, recentUserMessages);

// ✅ FIXED: Changed from streak-based to active-day based
const milestoneDays = [7, 30, 100, 365];
const isMilestoneDay = milestoneDays.includes(stats.active_conversation_days);

const sessionModifier = affectionService.computeSessionModifier({
  timeOfDay: dateParts.timeOfDay,
  isWeekend: dateParts.isWeekend,
  milestoneToday: isMilestoneDay,
  gapDays: gapContext.gapDays,
  currentStreak: stats.current_streak_days
});
```

**Before:**
```typescript
// ❌ OLD: Streak-based (consecutive days only)
const isMilestoneDay = stats.current_streak_days % 7 === 0 && stats.current_streak_days > 0;
// Triggers: 7, 14, 21, 28, 35... (breaks if user misses 1 day)
```

**After:**
```typescript
// ✅ NEW: Active-day based (total conversation days)
const milestoneDays = [7, 30, 100, 365];
const isMilestoneDay = milestoneDays.includes(stats.active_conversation_days);
// Triggers: 7, 30, 100, 365 (resilient to gaps)
```

**Why:**
- Streak-based: Penalizes users for missing days, breaks long relationships
- Active-day: Celebrates cumulative engagement, meaningful thresholds
- More appropriate for measuring relationship depth

---

## Complete Context Flow

```typescript
// Line 786: Update relationship stats (sets previous_interaction_at)
await relationshipTrackingService.updateOnUserMessage(
  userId,           // ✅ Now defined properly
  companionId,
  now,
  userTimezone
);

// Line 793: Get updated stats
const stats = await relationshipTrackingService.getRelationshipStats(userId, companionId);

if (stats) {
  // Line 796-797: Get current date/time info
  const dateParts = getUserLocalDateParts(now, userTimezone);
  const todayContext = formatTodayContext(dateParts);

  // Line 799-803: Calculate gap using OLD timestamp ✅
  const gapContext = calculateGapSinceLastChat(
    stats.previous_interaction_at || stats.last_interaction_at,
    now,
    userTimezone
  );

  // Line 817-821: Get recent messages for affection signals
  const recentUserMessages = await affectionService.getRecentUserMessages(
    userId,
    companionId,
    5
  );

  // Line 823: Detect user signals
  const userSignals = affectionService.detectUserSignals(message, recentUserMessages);

  // Line 825-827: Check milestones ✅
  const milestoneDays = [7, 30, 100, 365];
  const isMilestoneDay = milestoneDays.includes(stats.active_conversation_days);

  // Line 827-833: Compute session modifier
  const sessionModifier = affectionService.computeSessionModifier({
    timeOfDay: dateParts.timeOfDay,
    isWeekend: dateParts.isWeekend,
    milestoneToday: isMilestoneDay,
    gapDays: gapContext.gapDays,
    currentStreak: stats.current_streak_days
  });

  // Line 835-841: Get relationship intent/status/base
  const relationshipIntent = (stats as any).relationship_intent || 'evolve';
  const relationshipStatus = (stats as any).relationship_status || 'exploring';
  const affectionBase = (stats as any).affection_base || 3;
  const affectionLastUpdated = new Date((stats as any).affection_last_updated_at || stats.created_at);

  // Line 847-855: Compute affection update
  const affectionUpdate = affectionService.computeAffectionUpdate({
    intent: relationshipIntent,
    signals: userSignals,
    recentSignalsHistory: signalsHistory,
    currentAffectionBase: affectionBase,
    daysSinceLastUpdate,
    activeDays: stats.active_conversation_days,
    elapsedDays: stats.elapsed_days_since_creation
  });

  // Line 857-863: Update affection if needed
  if (affectionUpdate.shouldUpdate) {
    await affectionService.updateAffectionBase(
      userId,
      companionId,
      affectionUpdate.newAffectionBase
    );
  }

  // Line 870-877: Format affection context for prompt
  const affectionContext = affectionService.getAffectionContext(
    currentAffectionBase,
    sessionModifier,
    relationshipIntent,
    relationshipStatus
  );

  affectionContextString = affectionService.formatAffectionPromptContext(affectionContext);
}
```

---

## Testing Quick Commands

```typescript
// Test gap calculation
console.log('Previous interaction:', stats.previous_interaction_at);
console.log('Last interaction:', stats.last_interaction_at);
console.log('Gap calculated from:', stats.previous_interaction_at || stats.last_interaction_at);

// Test milestone detection
console.log('Active days:', stats.active_conversation_days);
console.log('Is milestone?', [7,30,100,365].includes(stats.active_conversation_days));

// Test affection context
console.log('Affection Context:', {
  intent: relationshipIntent,
  status: relationshipStatus,
  base: affectionBase,
  modifier: sessionModifier,
  signals: userSignals
});
```

---

## All Fixes Applied ✅

1. ✅ userId properly defined
2. ✅ Gap calculation uses previous_interaction_at
3. ✅ Milestone detection uses active days [7, 30, 100, 365]
4. ✅ Build passes successfully
