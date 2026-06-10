# Subscription Status Banner

## Overview

The subscription banner is a prominent, eye-catching component that displays the user's current subscription plan and remaining messages throughout the app.

## Features

### Visual Design
- **Gradient backgrounds** with unique colors for each tier
- **Glowing effects** that pulse for premium tiers
- **Animated icons** that rotate or bounce
- **Real-time message counter** that updates after each message
- **Responsive design** with both compact and full versions

### Tier Designs

#### Free Trial
- **Color**: Slate gray gradient
- **Icon**: Star
- **Style**: Basic, encouraging upgrade
- **Shows**: Message count with "Upgrade for unlimited" prompt

#### Velvet Essential (Unlimited)
- **Color**: Cyan to blue gradient
- **Icon**: Lightning bolt (Zap)
- **Style**: Bright, energetic
- **Shows**: "Unlimited Messages" with spinning sparkle icon
- **Glow**: Cyan glow effect

#### Velvet Plus (Starter)
- **Color**: Violet to purple gradient
- **Icon**: Sparkles
- **Style**: Magical, premium feel
- **Shows**: 800 messages with sparkle icon
- **Glow**: Purple glow effect

#### Velvet Pro (Plus)
- **Color**: Orange to red gradient
- **Icon**: Flame
- **Style**: Hot, passionate
- **Shows**: 2,000 messages with flame icon
- **Glow**: Orange glow effect

#### Velvet Elite
- **Color**: Yellow/gold gradient
- **Icon**: Crown
- **Style**: Luxurious, prestigious
- **Shows**: 5,000 messages with crown icon
- **Glow**: Golden glow effect

## Placement

### Lobby Page
- Full-size banner displayed prominently below the header
- Shows complete tier information and message count
- Includes upgrade prompt for free users

### Chat Interface
- Compact banner at top center of screen
- Minimal design to not interfere with chat
- Shows tier icon, name, and message count badge
- Always visible while chatting

## Behavior

### Message Counter
- Updates in real-time after each message sent
- Shows "Running low!" warning when < 50 messages remain
- Pulses when message count is low
- Shows infinity symbol (∞) for unlimited plans

### Animations
- Premium tier icons rotate/bounce continuously
- Glow effects pulse gently
- Compact banner fades in smoothly on page load
- Counter animates when updated

### Interactive States
- Hover effects on badges
- Smooth transitions between states
- Responsive to screen size changes

## Implementation

The banner is automatically shown on:
- Companion lobby page (`CompanionLobbyPage.tsx`)
- Chat interface (`App.tsx`)

The subscription data is fetched automatically from the database and updates when:
- User first loads the page
- User sends a message (counter decrements)
- User completes a purchase (tier upgrades)

## Technical Details

### Component Props
```typescript
interface SubscriptionBannerProps {
  tier: SubscriptionTier;           // Current subscription tier
  messagesRemaining: number;         // -1 for unlimited
  compact?: boolean;                 // Use compact version
}
```

### Tier Types
```typescript
type SubscriptionTier =
  | 'free'       // 15 messages
  | 'unlimited'  // Unlimited (Haiku model)
  | 'starter'    // 800 messages (Sonnet)
  | 'plus'       // 2,000 messages (Sonnet)
  | 'elite'      // 5,000 messages (Sonnet)
  | 'premium';   // Legacy tier
```

## User Experience Benefits

1. **Transparency**: Users always know their subscription status
2. **Motivation**: Visual appeal encourages upgrades
3. **Urgency**: Low message warnings prevent surprise limits
4. **Pride**: Premium users see their status prominently displayed
5. **Clarity**: Clear tier distinctions with unique branding
