# Companion System Database Report

## Companions Table Structure
**Table Name:** `companions`

**Fields:**
- `id` (uuid, primary key) - Unique ID for this companion instance
- `user_id` (uuid, foreign key → auth.users) - Links to authenticated user
- `character_type` (text, CHECK constraint) - 'riley', 'raven', or 'jake'
- `relationship_type` (text, CHECK constraint, default: 'romantic') - 'friend' or 'romantic'
- `created_at` (timestamptz, default: now()) - When companion was created
- `last_message_at` (timestamptz, default: now()) - Last interaction time
- `is_active` (boolean, default: true) - Whether companion is still active (soft delete flag)
- `first_message_sent` (boolean, default: false) - Whether first message has been sent
- `custom_name` (text, default: '') - User's chosen name for their companion
- `hobbies` (text[], default: []) - User's favorite hobbies for conversation context
- `sports` (text[], default: []) - User's favorite sports for conversation context

**Foreign Keys:**
- `user_id` → references `auth.users(id)` ON DELETE CASCADE

**Indexes:**
- `idx_companions_user_id` - Standard lookup by user
- `idx_companions_active` - Fast filtering for active companions: `(user_id, is_active) WHERE is_active = true`

**Row Level Security:** ✅ ENABLED
- Users can only view/create/update/delete their own companions
- All policies check: `auth.uid() = user_id`

## How Active Companion is Determined

**Important:** There is NO "selected_companion_id" field or special flag for the "active" companion.

The app determines which companion is "active" using **URL query parameters**:
- Route: `/chat?companion=<companion_id>`
- The `companion` query parameter specifies which companion the user is currently chatting with
- When a user clicks a companion in the lobby, it navigates to `/chat?companion={companionId}`

**The `is_active` boolean field serves a different purpose:**
- It's a soft-delete flag
- When `is_active = false`, the companion is hidden from the lobby
- It doesn't indicate which companion is currently being used
- Users can have multiple companions with `is_active = true` simultaneously

**Example Flow:**
1. User visits `/lobby`
2. Lobby fetches all companions where `user_id = current_user AND is_active = true`
3. User clicks a companion card
4. App navigates to `/chat?companion=abc-123-def-456`
5. Chat page loads messages for that specific `companion_id`

**Example Query from App.tsx:**
```typescript
const [searchParams] = useSearchParams();
const companionId = searchParams.get('companion'); // Gets companion ID from URL

const companionData = await getCompanion(companionId); // Fetches specific companion
```

## Related Tables

### `conversations`
**Purpose:** Stores all chat messages between user and companions
**Key Fields:**
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key → auth.users)
- `companion_id` (uuid, foreign key → companions, NOT NULL) - Links message to specific companion
- `role` (text) - 'user' or 'assistant'
- `content` (text) - Message text
- `created_at` (timestamptz)

**Index:** `idx_conversations_companion` on `(companion_id, created_at DESC)`

### `relationship_memories`
**Purpose:** Stores key facts, moments, and emotional context from conversations
**Key Fields:**
- `user_id` (uuid) - References user_profiles
- `memory_type` (text) - 'user_fact', 'relationship_moment', 'emotional_context', 'inside_joke', 'shared_experience'
- `content` (text) - The actual memory
- `emotional_valence` (text) - 'positive', 'negative', 'neutral', 'mixed'
- `importance_score` (integer, 1-10) - For retrieval prioritization
- `context_tags` (text[]) - Searchable tags
- `reference_count` (integer) - Usage tracking

### `conversation_threads`
**Purpose:** Tracks ongoing topics and unresolved threads across conversations
**Key Fields:**
- `user_id` (uuid)
- `topic` (text)
- `status` (text) - 'active', 'resolved', 'dormant'
- `context_summary` (text)
- `unresolved_questions` (text[])
- `key_points` (text[])

### `emotional_profile`
**Purpose:** Builds a profile of user's emotional patterns and communication style
**Key Fields:**
- `user_id` (uuid, UNIQUE)
- `baseline_mood` (text)
- `stress_triggers` (text[])
- `joy_triggers` (text[])
- `communication_style` (text)
- `support_preferences` (text)
- `humor_style` (text)

### `personality_consistency_log`
**Purpose:** Logs AI responses and user reactions to build consistency
**Key Fields:**
- `user_id` (uuid)
- `message_context` (text)
- `ai_response` (text)
- `response_style` (text)
- `user_reaction` (text) - 'positive', 'negative', 'neutral'
- `engagement_score` (integer, 1-10)
- `worked_well` (boolean)

## Current Usage in Codebase

**Files that reference companions:**

- **src/services/companionService.ts** - Core companion CRUD operations
  - `createCompanion()` - Creates new companion with customization
  - `getCompanions()` - Fetches all active companions for lobby
  - `getCompanion()` - Gets single companion by ID
  - `updateLastMessageTime()` - Updates interaction timestamp
  - `markFirstMessageSent()` - Tracks initial message
  - `deactivateCompanion()` - Soft delete
  - `getUserDefaultCompanion()` - Gets oldest companion (fallback)

- **src/pages/CompanionLobbyPage.tsx** - Main lobby interface
  - Displays all active companions in grid layout
  - Shows last message preview, time ago, relationship type badge
  - Navigates to `/chat?companion={id}` on click

- **src/App.tsx** - Main chat interface
  - Extracts `companionId` from URL query params
  - Loads companion data and conversation history for that specific companion
  - Passes `companionId` and `relationship_type` to ChatService

- **src/services/chatService.ts** - AI messaging logic
  - Accepts optional `companionId` parameter
  - Fetches companion data to get `custom_name`, `hobbies`, `sports`
  - Includes companion info in AI system prompt for personalization
  - Saves messages with `companion_id` link

- **src/Router.tsx** - Routing configuration
  - Defines `/lobby` route for companion selection
  - Defines `/chat` route for actual conversations

- **src/pages/CheckersGame.tsx** - Game integration
  - References companion system for future integration

## Sample Companion Record

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "character_type": "riley",
  "relationship_type": "romantic",
  "created_at": "2025-12-21T10:30:00Z",
  "last_message_at": "2025-12-21T14:25:00Z",
  "is_active": true,
  "first_message_sent": true,
  "custom_name": "Baby",
  "hobbies": ["gaming", "cooking", "reading"],
  "sports": ["basketball", "hiking"]
}
```

## Recommendations for Game Integration

### To Fetch the Active Companion (from within a game page):

```typescript
import { useSearchParams } from 'react-router-dom';
import { getCompanion } from '../services/companionService';

// Inside your component:
const [searchParams] = useSearchParams();
const companionId = searchParams.get('companion');

// Then fetch the companion data:
const companion = await getCompanion(companionId);

// Access companion properties:
const characterName = companion.custom_name || 'Riley';
const characterType = companion.character_type; // 'riley', 'raven', or 'jake'
const relationshipType = companion.relationship_type; // 'friend' or 'romantic'
```

### To Link to a Game WITH Companion Context:

When navigating to your Money Grab game from the lobby or chat, pass the companion ID:

```typescript
// From lobby:
navigate(`/pacman?companion=${companionId}`);

// From chat (where companionId is already in URL):
const companionId = searchParams.get('companion');
navigate(`/pacman?companion=${companionId}`);
```

### Full Example Query for Game Page:

```typescript
// Get current user's companion for this session
async function getCurrentCompanion(): Promise<Companion | null> {
  const searchParams = new URLSearchParams(window.location.search);
  const companionId = searchParams.get('companion');

  if (!companionId) {
    // No companion specified - could redirect to lobby or use default
    return null;
  }

  return await getCompanion(companionId);
}

// Usage:
const companion = await getCurrentCompanion();
if (companion) {
  console.log(`Playing with ${companion.custom_name}!`);
  // Use companion.character_type for avatar images
  // Use companion.custom_name for displaying name
  // Use companion.relationship_type for tone adjustments
}
```

### To Save Game Results to Conversation History:

```typescript
import { supabase } from '../services/supabase';
import { updateLastMessageTime } from '../services/companionService';

async function saveGameMessage(companionId: string, message: string, role: 'user' | 'assistant') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('conversations')
    .insert({
      user_id: user.id,
      companion_id: companionId,
      role: role,
      content: message,
    });

  await updateLastMessageTime(companionId);
}

// Example usage after game:
await saveGameMessage(companionId, "just played money grab and got $850!", "user");
await saveGameMessage(companionId, "omg that's amazing babe! 🎉 you're getting so good at that game!", "assistant");
```

## Questions/Uncertainties

✅ **RESOLVED - All questions answered:**

1. ✅ How is "active companion" determined? **Answer:** Via URL query parameter `?companion=<id>`
2. ✅ Is there a "selected" or "current" companion field? **Answer:** No, it's URL-based routing
3. ✅ What does `is_active` actually mean? **Answer:** Soft delete flag, not selection indicator
4. ✅ Can users have multiple active companions? **Answer:** Yes, all with `is_active=true`
5. ✅ How do games get companion context? **Answer:** Pass `companionId` via URL params
6. ✅ Can game messages be saved to conversation history? **Answer:** Yes, insert into `conversations` with `companion_id`

## Architecture Summary

**Multi-Companion System:**
- Users can create unlimited companions (different characters, names, personalities)
- Each companion maintains separate conversation history
- Companion selection happens at navigation time (URL-based)
- No global "current companion" state - it's contextual per page
- Games can integrate by accepting `?companion=<id>` parameter
- All conversation messages are tied to specific `companion_id`

**Key Design Pattern:**
The companion system uses **contextual selection** rather than **stateful selection**. The "active" companion is determined by the URL context, not by a database flag or localStorage value. This allows for:
- Multiple browser tabs with different companions
- Clean separation of conversation histories
- Easy deep linking to specific companions
- No race conditions from state management
