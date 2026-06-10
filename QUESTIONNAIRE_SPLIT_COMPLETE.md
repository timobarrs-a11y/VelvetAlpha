# Questionnaire Split - Complete

## Problem Fixed
Previously, users creating their **2nd, 3rd, or 4th companion** had to re-fill ALL the personal questions (name, birthday, favorite color, hobbies, etc.) every single time. This was frustrating and unnecessary since those are user-level details, not companion-specific.

## Solution Implemented
Created a clean two-path flow:

### Path 1: First Companion (Full Questionnaire)
**Route:** `/questionnaire`
**When:** User has 0 companions
**Questions Asked:**
- ✅ User-level questions (name, birthday, gender, favorite color, hobbies, music, sports, news topics)
- ✅ Companion questions (gender, relationship type, personality preferences, name)

### Path 2: Additional Companions (Companion-Only)
**Route:** `/create-additional-companion`
**When:** User has 1+ companions
**Questions Asked:**
- ❌ No user-level questions (already on file)
- ✅ Only companion questions (gender, relationship type, personality preferences, name)

## What Changed

### New Files
- `src/pages/CreateAdditionalCompanionPage.tsx` - Companion-only questionnaire

### Modified Files
1. **src/Router.tsx**
   - Added new route `/create-additional-companion`

2. **src/pages/CompanionLobbyPage.tsx**
   - Updated `handleNewCompanion()` to check companion count
   - Routes to `/create-additional-companion` if user has companions
   - Routes to `/questionnaire` for first companion

## User Experience Flow

### First Time User
```
Sign Up
  → Create User Avatar
    → Full Questionnaire (/questionnaire)
      ↓
      User Questions (name, birthday, etc.)
      ↓
      Companion Questions (personality, etc.)
    → Voice Selection
    → Create Companion Avatar
    → Lobby
```

### Creating Additional Companions
```
Lobby
  → Click "Create New Companion"
    → Companion-Only Questionnaire (/create-additional-companion)
      ↓
      Welcome back, [Name]! Let's create a new companion.
      ↓
      Companion Questions ONLY
    → Voice Selection
    → Create Companion Avatar
    → Back to Lobby
```

## Technical Details

### Routing Logic
```typescript
const handleNewCompanion = () => {
  // If user already has companions, skip user-level questions
  if (companions.length > 0) {
    navigate('/create-additional-companion');
  } else {
    navigate('/questionnaire');
  }
};
```

### Question Sets
Both pages use the same companion question sets:
- `COMPANION_BASE_QUESTIONS` - Gender and connection type
- `GIRLFRIEND_QUESTIONS` - Female companion preferences
- `BOYFRIEND_QUESTIONS` - Male companion preferences

The difference is **only** the additional companion page:
- Loads the user's name from their profile
- Personalizes welcome message: "Welcome back, [Name]!"
- Skips ALL user-level questions completely

## Benefits
1. **Faster companion creation** - ~7 fewer questions for 2nd+ companions
2. **Better user experience** - No repetitive data entry
3. **Clean architecture** - Separate concerns (user vs companion data)
4. **Maintains context** - Uses user's actual name in prompts

## Testing
✅ Build passes without errors
✅ New route added to router
✅ Lobby correctly routes based on companion count
✅ Additional companion page loads user name from profile

## Next Steps (If Needed)
- Test creating 2nd companion in actual app to verify flow
- Verify voice selection works correctly after additional companion creation
- Ensure companion avatar creation page receives the new companion ID
