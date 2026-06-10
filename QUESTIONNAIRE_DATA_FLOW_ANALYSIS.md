# Questionnaire Data Flow Analysis

## SUMMARY

**Questionnaire Data:** ✅ Working - Injected into system prompts
**Memory System:** ❌ NOT WORKING - Built but never called
**Integration Status:** 🔴 BROKEN - Need to connect them

---

## 1. QUESTIONNAIRE DATA STORAGE

### Where it's stored:
```typescript
// QuestionnairePage.tsx:327
const matchData = {
  userName: newAnswers.name,
  userBirthday: newAnswers.birthday,
  userGender: newAnswers.gender,
  relationshipType: newAnswers.relationshipType,
  connectionType,
  selectedAvatar,
  dynamicPreference: newAnswers.dynamic,
  confrontationStyle: newAnswers.confrontation,
  availabilityLevel: newAnswers.availability,
  interestPreference: newAnswers.interests,
  hobbies: newAnswers.hobbies || '',
  sports: newAnswers.sports || '',
  companionName: newAnswers.companionName || ''
};

localStorage.setItem('matchAnswers', JSON.stringify(matchData));
```

### What's stored in database:
```typescript
// companionService.ts:31-43
// Only these fields from questionnaire:
- custom_name (companionName)
- hobbies (array)
- sports (array)
- character_type (selectedAvatar)
- relationship_type (connectionType)

// NOT stored in database:
❌ userName
❌ userBirthday
❌ userGender
❌ dynamicPreference
❌ confrontationStyle
❌ availabilityLevel
❌ interestPreference
```

---

## 2. SYSTEM PROMPT INJECTION

### ✅ WORKING: Questionnaire data IS being injected

**Location:** `src/prompts/systemPrompts.ts`

```typescript
// Line 270-282
export function buildPersonalityTunedPrompt(chatMode: 'chat' | 'assistant' = 'chat'): string {
  const matchData: MatchData = JSON.parse(localStorage.getItem('matchAnswers') || '{}');
  const avatar = getAvatar(matchData.selectedAvatar || 'riley');
  const displayName = matchData.companionName || avatar.name;

  let basePrompt = `You are ${displayName}, a ${avatar.age}-year-old from ${avatar.location}.
Your personality: ${avatar.personality.join(', ')}.
Bio: "${avatar.bio}"

User's name: ${matchData.userName || 'there'}
User's birthday: ${matchData.userBirthday || 'not provided'}
${matchData.hobbies ? `User's favorite hobbies: ${matchData.hobbies}` : ''}
${matchData.sports ? `User's favorite sports: ${matchData.sports}` : ''}
`;

  // Then adds preferences:
  if (matchData.dynamicPreference === 'She takes the lead') {
    basePrompt += "\nYou are confident and often take initiative...";
  }
  // ... etc for all preferences
}
```

**Used in:** `chatService.ts:463`
```typescript
const optimizedPrompt = getSystemPrompt(modelType, userContext, subscriptionTier, relationshipType);
```

**Result:** ✅ The companion DOES know the questionnaire answers during conversations

---

## 3. MEMORY SYSTEM ACCESS

### ❌ BROKEN: Memory system NOT being used

**Built but never called:**

1. **contextAssembler.ts** - Created in Phase 2
   - `assembleContext()` - Loads memory and builds full context
   - `triggerSummarizationIfNeeded()` - Triggers background summarization

2. **memoryService.ts** - Created in Phase 2
   - `getCompanionMemory()` - Retrieves stored memories
   - `saveCompanionMemory()` - Saves new memories
   - 6 functions total, all working

3. **Problem:**
   ```typescript
   // chatService.ts:23 - Imported
   import { assembleContext, triggerSummarizationIfNeeded } from './contextAssembler';

   // ❌ NEVER CALLED anywhere in chatService.ts
   ```

4. **Current flow:**
   ```
   User sends message
       ↓
   chatService.sendMessage()
       ↓
   Builds context WITHOUT memory ❌
       ↓
   Uses getSystemPrompt() with matchAnswers ✅
       ↓
   Sends to Claude API
       ↓
   Returns response
       ↓
   Memory NOT triggered ❌
   ```

5. **Intended flow:**
   ```
   User sends message
       ↓
   chatService.sendMessage()
       ↓
   Call assembleContext(userId, companionId, systemPrompt, message) ✅
       ↓
   assembleContext loads companion memory ✅
       ↓
   Injects memory into system prompt ✅
       ↓
   Sends to Claude API with full context
       ↓
   Returns response
       ↓
   Call triggerSummarizationIfNeeded() ✅
       ↓
   If 75+ messages: Summarize in background ✅
   ```

---

## 4. THE PROBLEM

### Questionnaire data as "seed memory"

**Question:** Should questionnaire answers be treated as initial context?

**Current state:**
- ✅ Questionnaire data IS in system prompt (via `getSystemPrompt()`)
- ✅ Companion knows user's name, birthday, hobbies, sports
- ✅ Companion knows user's preferences (dynamic, confrontation style, etc.)
- ❌ Memory system NOT connected
- ❌ As conversations grow, questionnaire context might get lost

**What's missing:**
1. `assembleContext()` is never called
2. Memory never gets loaded into system prompt
3. Summarization never gets triggered
4. The entire memory system we built is dormant

---

## 5. INTEGRATION ISSUES

### Issue #1: assembleContext not used

**File:** `src/services/chatService.ts:380-550` (sendMessage function)

**Current:** Builds system prompt manually with `getSystemPrompt()`

**Needed:** Replace manual context building with:
```typescript
// After building the base system prompt
const assembled = await assembleContext(
  userId,
  companionId,
  baseSystemPrompt,
  userMessage
);

// Use assembled.systemPrompt (includes memory)
// Use assembled.messages (includes recent history)
// Track assembled.shouldTriggerSummarization
```

### Issue #2: Summarization never triggered

**File:** `src/services/chatService.ts:380-550`

**Current:** After getting response, just saves message and returns

**Needed:** After saving response:
```typescript
await triggerSummarizationIfNeeded(
  userId,
  companionId,
  shouldTriggerSummarization
);
```

### Issue #3: Questionnaire data not in database

**Issue:** All questionnaire answers are in localStorage only

**Risks:**
- Data lost if user clears browser cache
- Can't access from other devices
- Not available for memory system to use as "seed"

**Consider:** Creating a `user_questionnaire_data` table to persist:
- userName
- userBirthday
- userGender
- All preference answers

---

## 6. RECOMMENDED FIX

### Option A: Quick Fix (Use existing structure)

**Just connect what we built:**

1. Modify `chatService.ts` to call `assembleContext()`
2. Modify `chatService.ts` to call `triggerSummarizationIfNeeded()`
3. Memory system starts working immediately

**Pros:**
- Quick to implement (30 min)
- Uses all the code we already built
- Questionnaire data still works via `getSystemPrompt()`

**Cons:**
- Questionnaire data stays in localStorage
- Memory system learns from conversations but doesn't start with questionnaire data

### Option B: Full Integration (Recommended)

**Integrate questionnaire as seed memory:**

1. Save questionnaire answers to database on companion creation
2. When companion is first created, create initial `companion_memories` entry with questionnaire data
3. Memory system has questionnaire data as "seed memory"
4. Connect `assembleContext()` as in Option A
5. All context (questionnaire + memories) comes from database

**Pros:**
- Questionnaire data persists in database
- Memory system has full context from day 1
- More robust and scalable
- Cross-device support

**Cons:**
- More work (2-3 hours)
- Needs database migration
- Needs to refactor questionnaire storage

---

## 7. WHAT'S ACTUALLY HAPPENING NOW

### Current Reality:

```
Conversation #1-10:
✅ Companion remembers questionnaire answers
✅ Uses user's name, birthday, preferences
✅ System prompt includes all matchAnswers

Conversation #11-75:
✅ Still has questionnaire context
❌ NOT building conversation memory
❌ Only has last 20-30 messages in context

After 75+ messages:
✅ Still has questionnaire context
❌ Memory summarization NOT triggered
❌ Might start losing context (too many messages)
❌ Companion doesn't "remember" earlier conversations
```

### What SHOULD happen:

```
Conversation #1-10:
✅ Companion knows questionnaire answers
✅ Building conversation context

Conversation #11-75:
✅ Has questionnaire context
✅ Building conversation memory
✅ Remembers patterns, inside jokes, important facts

After 75+ messages:
✅ Questionnaire context preserved
✅ Automatic summarization triggered
✅ Old messages converted to memory
✅ Companion has full relationship context
✅ Can recall things from 100+ messages ago
```

---

## 8. CODE LOCATIONS

### Where questionnaire data flows:

1. **Input:** `QuestionnairePage.tsx:327` → `localStorage.setItem('matchAnswers')`
2. **Companion creation:** `SplashPage.tsx` → Reads matchAnswers → Creates companion with name/hobbies/sports
3. **System prompt:** `systemPrompts.ts:270` → Reads matchAnswers → Builds personality prompt
4. **Chat service:** `chatService.ts:447` → Reads matchAnswers → Builds userContext
5. **Used in:** `chatService.ts:463` → `getSystemPrompt()` includes questionnaire data

### Where memory should flow (but doesn't):

1. **❌ Never called:** `contextAssembler.ts:10` → `assembleContext()`
2. **❌ Never called:** `contextAssembler.ts:45` → `triggerSummarizationIfNeeded()`
3. **✅ Works:** `memoryService.ts` → All 6 functions work
4. **✅ Works:** `supabase/functions/summarize-memory` → Edge function works
5. **✅ Ready:** `companion_memories` table exists and is ready

---

## CONCLUSION

**Questionnaire Integration:** ✅ WORKING
- Data stored in localStorage
- Injected into every system prompt
- Companion knows all answers

**Memory Integration:** ❌ NOT WORKING
- All code is built and ready
- Just needs to be called from chatService
- 2 function calls to connect everything

**Fix Required:**
- Connect `assembleContext()` in chatService
- Connect `triggerSummarizationIfNeeded()` in chatService
- Estimated time: 30-60 minutes
