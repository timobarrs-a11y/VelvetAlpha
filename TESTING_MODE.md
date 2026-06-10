# Testing Mode Guide

## Overview
Testing mode allows you to bypass all premium paywalls for development and testing purposes. This lets you test all signature voices and premium features without needing an actual subscription.

## Enabling Testing Mode

Testing mode is controlled by an environment variable in your `.env` file:

```
VITE_TESTING_MODE=true
```

### Current Status
**Testing mode is currently ENABLED** in your `.env` file.

## What Testing Mode Does

When enabled, testing mode:

1. **Unlocks All Premium Voices**: Access all signature voices regardless of subscription status
2. **Bypasses Paywall Checks**: The `canUseVoice()` function returns `true` for all voices
3. **Shows Testing Banner**: Displays a yellow banner indicating testing mode is active
4. **Removes Upgrade Prompts**: Hides upgrade messaging when testing mode is enabled

## Voice Organization

Signature voices are now organized into three categories:

### 1. Standard Voices
Core personality types suitable for most users:
- The Classic
- The Jock / Cheerleader
- The Therapist
- The Big Sister

### 2. Anime-Inspired Voices
Character archetypes from anime/manga culture:
- The Cold Prince
- The Determined Hero
- The Playful Trickster
- The Gentle Protector
- The Tsundere
- The Shy Sweetheart
- The Genki Girl
- The Cool Beauty

### 3. Cultural Voices
Distinct cultural and regional communication styles:
- The Brooklyn Native
- The French Romantic
- The 90s R&B Lover
- The Homie

## Before Going Live

**CRITICAL**: Before launching to production, you MUST disable testing mode:

1. Open `.env` file
2. Change `VITE_TESTING_MODE=true` to `VITE_TESTING_MODE=false`
3. Or remove the line entirely (false by default)
4. Rebuild the project: `npm run build`
5. Deploy the updated build

### Verification Checklist

Before going live, verify:
- [ ] `VITE_TESTING_MODE` is set to `false` or removed from `.env`
- [ ] Project has been rebuilt after the change
- [ ] Premium voices show "Premium" badge
- [ ] Selecting premium voice prompts upgrade flow
- [ ] Payment integration works correctly
- [ ] Free users can only access free voices

## Legal Note on IP Usage

**You CANNOT use copyrighted intellectual property** from other franchises:

### Not Allowed:
- Character names from existing IPs (Harry Potter, Marvel, etc.)
- Specific place names (Hogwarts, Westeros, etc.)
- Trademarked terminology (Muggle, Jedi, etc.)
- Character personalities/backstories from copyrighted works

### Allowed:
- Generic archetypes (mysterious wizard, not "Dumbledore")
- General fantasy elements (magic school, not "Hogwarts")
- Original characters inspired by tropes
- Cultural communication styles
- Generic personality types

## Testing Workflow

1. **Development**: Keep testing mode ON
2. **Test all voices**: Verify each voice works correctly
3. **Test paywall flow**: Temporarily disable testing mode to test upgrade flow
4. **Final testing**: Test complete user journey with testing mode OFF
5. **Deploy**: Ensure testing mode is OFF in production

## Support

If you encounter issues with testing mode:
1. Verify `.env` file has correct setting
2. Restart dev server after changing `.env`
3. Clear browser cache/localStorage
4. Check browser console for errors
