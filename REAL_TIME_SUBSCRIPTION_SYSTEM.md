# Real-Time Subscription Detection System

## Overview

Implemented a comprehensive real-time subscription tracking system that automatically detects and displays subscription changes across the entire application.

## Key Features

### 1. Real-Time Subscription Hook (`useSubscription`)

Created a custom React hook that:
- Automatically loads subscription info on mount
- Listens for real-time database changes using Supabase subscriptions
- Updates the UI immediately when subscription tier or message count changes
- Provides subscription status, tier, and remaining messages to any component

**Location**: `src/hooks/useSubscription.ts`

**What it monitors**:
- `user_profiles.subscription_tier` - Detects plan upgrades/downgrades
- `message_tracking` - Detects message count changes

**Example usage**:
```typescript
const { subscriptionInfo, tier, messagesRemaining } = useSubscription();
```

### 2. Fixed Subscription Banner

Updated the subscription banner to:
- Remove non-existent "Premium" tier
- Use exact tier names from the subscription system:
  - `free` → "Free"
  - `unlimited` → "Velvet Essential"
  - `starter` → "Velvet Plus"
  - `plus` → "Velvet Pro"
  - `elite` → "Velvet Elite"

**Location**: `src/components/SubscriptionBanner.tsx`

### 3. Prominent Back Button on Pricing Page

Added two navigation options on the pricing page:
- **Left side**: "Back" button with arrow icon - returns to previous page
- **Right side**: X button - also returns to previous page

Both buttons use a `returnTo` query parameter to ensure users can navigate back to where they came from:
- From chat: Returns to chat with companion
- From lobby: Returns to lobby
- Default: Returns to lobby

**Location**: `src/pages/PricingPageRoute.tsx`

**Usage**:
```typescript
navigate(`/pricing?returnTo=/chat?companion=${companionId}`);
```

### 4. Automatic Subscription Updates

The system now:
- **Detects immediately** when a user completes a Stripe purchase
- **Updates the banner** in real-time without page refresh
- **Reflects new tier** across all pages (lobby, chat, pricing)
- **Updates message count** after each message sent

### 5. Integration Points

Updated these pages to use the new system:

**Companion Lobby Page** (`src/pages/CompanionLobbyPage.tsx`):
- Shows full subscription banner
- Updates automatically when subscription changes
- Uses `useSubscription()` hook

**Chat Interface** (`src/App.tsx`):
- Shows compact subscription banner at top center
- Updates message count in real-time
- Redirects to pricing with return path when out of messages
- "Manage Plan" button returns to chat after use

**Pricing Page** (`src/pages/PricingPageRoute.tsx`):
- Shows current tier with "Current Plan" button
- Updates immediately when subscription changes
- Returns to previous page when closed
- Uses `useSubscription()` hook

## Technical Implementation

### Database Monitoring

The system uses Supabase Realtime to subscribe to PostgreSQL changes:

```typescript
supabase
  .channel('subscription-changes')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'user_profiles',
    filter: `id=eq.${userId}`
  }, handleUpdate)
  .subscribe();
```

### State Synchronization

When a subscription change is detected:
1. Realtime listener fires
2. `useSubscription` hook fetches latest data
3. React state updates
4. All components using the hook re-render with new data
5. Banner displays new tier and message count

### Flow Example

**User upgrades from Free to Velvet Essential:**
1. User clicks "Select Plan" on pricing page
2. Stripe checkout completes
3. Webhook updates `user_profiles.subscription_tier`
4. Realtime listener detects change
5. `useSubscription` refetches data
6. Banner changes from gray "Free" to cyan "Velvet Essential"
7. Message counter changes to "Unlimited Messages"
8. User sees update without page refresh

## Benefits

1. **No guesswork** - System knows exactly what tier the user is on
2. **Instant feedback** - Changes appear immediately after purchase
3. **Consistent UX** - Same subscription info everywhere
4. **Easy to use** - Single hook provides all subscription data
5. **Reliable navigation** - Users never get stuck on pricing page

## Files Modified

- `src/hooks/useSubscription.ts` - NEW
- `src/components/SubscriptionBanner.tsx` - Fixed tier names
- `src/pages/CompanionLobbyPage.tsx` - Uses new hook
- `src/pages/PricingPageRoute.tsx` - Added back button and return path
- `src/App.tsx` - Uses new hook, adds return paths

## Testing

To verify the system works:
1. Start as free user - should see gray "Free" banner
2. Navigate to pricing page from chat
3. Click back button - should return to chat
4. Complete a purchase (or update DB directly for testing)
5. Banner should update automatically without refresh
6. New tier name and message count should display correctly
