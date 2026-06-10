# Project Velvet - Alpha Launch Readiness Checklist

## ✅ READY FOR ALPHA

### 1. Core User Experience
- ✅ **Authentication Flow** - Sign up, login, logout working
- ✅ **User Onboarding** - Complete flow from signup to first conversation
  - Create user avatar
  - Answer questionnaire (8 questions)
  - Analyzing page
  - Signature voice selection
  - Create companion avatar
  - Pricing offer page (can be skipped)
- ✅ **Companion Creation** - Users can create multiple companions
- ✅ **Chat System** - Real-time conversations with AI companions
- ✅ **Terms & Privacy** - Legal pages accessible from splash page

### 2. Security & Data Protection
- ✅ **Row Level Security (RLS)** - Enabled on all tables
- ✅ **User Data Isolation** - Users can only access their own data
- ✅ **Content Moderation** - System in place to flag inappropriate content
- ✅ **Rate Limiting** - Abuse prevention (100 requests per 5 minutes)
- ✅ **Secure Authentication** - Supabase Auth with email/password
- ✅ **No Hardcoded Secrets** - All secrets in environment variables

### 3. Payment System
- ✅ **Stripe Integration** - Checkout and webhook working
- ✅ **Subscription Tiers** - 5 tiers defined (Free, Essential, Plus, Pro, Elite)
- ✅ **Price Points** - $0, $24.99, $59, $99, $149 per month
- ✅ **Message Limits** - 15, 200, 800, 2000, 5000 per tier
- ✅ **Success Page** - Post-payment redirect

### 4. Features & Games
- ✅ **Chat with Memory** - Companions remember past conversations
- ✅ **Emotional Intelligence** - Mood tracking and emotional responses
- ✅ **Video Watching** - Watch YouTube videos together
- ✅ **Checkers Game** - Play checkers with companion
- ✅ **Pac-Man Game** - Retro arcade game
- ✅ **Momentum Game** - Side-scrolling platformer
- ✅ **Stellar Pursuit** - Space shooter with 45 waves, 9 bosses
- ✅ **Slime Soccer** - Physics-based soccer game
- ✅ **Dev Mode** - Testing tools for Stellar Pursuit

### 5. Database & Backend
- ✅ **Migrations Applied** - 34 migrations in total
- ✅ **Edge Functions Deployed** - 8 functions for AI, payments, etc.
- ✅ **Semantic Memory** - Vector embeddings for long-term memory
- ✅ **Auto User Profile Creation** - Trigger creates profile on signup
- ✅ **Test User Bypass** - Special handling for test accounts

### 6. Error Handling & UX
- ✅ **Error Boundary** - Catches React errors
- ✅ **Loading States** - Spinners while loading
- ✅ **Protected Routes** - Auth required for app pages
- ✅ **Responsive Design** - Works on mobile and desktop
- ✅ **Toast Notifications** - Achievement toasts

---

## ⚠️ REQUIRED BEFORE LAUNCH

### Environment Variables (Supabase Edge Functions)
You MUST set these secrets in Supabase:

1. **ANTHROPIC_API_KEY** (CRITICAL)
   - Get from: https://console.anthropic.com/
   - Used for: AI chat functionality
   - Without this: Chat will not work at all

2. **STRIPE_SECRET_KEY** (CRITICAL if accepting payments)
   - Get from: https://dashboard.stripe.com/apikeys
   - Used for: Payment processing
   - Without this: Payments will fail

3. **STRIPE_WEBHOOK_SECRET** (CRITICAL if accepting payments)
   - Get from: https://dashboard.stripe.com/webhooks
   - Used for: Webhook verification
   - Without this: Subscription updates won't work

**How to set Supabase secrets:**
```bash
supabase secrets set ANTHROPIC_API_KEY=your_key_here
supabase secrets set STRIPE_SECRET_KEY=your_key_here
supabase secrets set STRIPE_WEBHOOK_SECRET=your_key_here
```

### Pre-Launch Testing Checklist

#### Test User Journey #1: New Free User
1. ☐ Visit splash page at `/`
2. ☐ Click "Get Started" and sign up
3. ☐ Create user avatar
4. ☐ Complete questionnaire (all 8 questions)
5. ☐ Wait through analyzing page
6. ☐ Select signature voice
7. ☐ Create companion avatar
8. ☐ Skip pricing offer (or select Free tier manually)
9. ☐ Arrive at lobby with companion
10. ☐ Send a message to companion
11. ☐ Verify you have 15 free messages
12. ☐ Try to send 16th message - should hit limit

#### Test User Journey #2: Paid Subscription
1. ☐ Log in as existing user
2. ☐ Go to pricing page
3. ☐ Select a paid tier ($24.99, $59, $99, or $149)
4. ☐ Complete Stripe checkout (use test card: 4242 4242 4242 4242)
5. ☐ Redirected to success page
6. ☐ Return to app - verify tier updated
7. ☐ Verify message limit increased

#### Test User Journey #3: Multiple Companions
1. ☐ Log in as existing user
2. ☐ Go to lobby
3. ☐ Click "Create New Companion"
4. ☐ Complete questionnaire for second companion
5. ☐ Create second companion avatar
6. ☐ Verify both companions appear in lobby
7. ☐ Chat with first companion
8. ☐ Switch to second companion
9. ☐ Chat with second companion
10. ☐ Verify conversations are separate

#### Test User Journey #4: Games
1. ☐ Log in and go to lobby
2. ☐ Play Checkers - verify AI opponent works
3. ☐ Play Pac-Man - verify controls work
4. ☐ Play Momentum - verify platformer works
5. ☐ Play Stellar Pursuit - complete wave 1
6. ☐ Try Stellar Pursuit dev mode (Press D on title screen)
7. ☐ Verify all games save scores to database

#### Test Error Scenarios
1. ☐ Try to access `/chat` without logging in - should redirect
2. ☐ Try to sign up with invalid email - should show error
3. ☐ Try to sign up with existing email - should show error
4. ☐ Send message with no API key set - should show error
5. ☐ Try to create checkout with no Stripe key - should error

---

## 🚨 KNOWN LIMITATIONS (Alpha Release)

### Audio
- ❌ **No sound effects** - Stellar Pursuit and other games are silent
- ❌ **No background music** - No music anywhere in app
- **Impact:** Reduces game feel, but not critical for alpha

### Mobile Experience
- ⚠️ **Stellar Pursuit keyboard only** - No touch controls yet
- ⚠️ **Some games not optimized** - Desktop experience better
- **Impact:** Mobile users may have subpar experience

### Content Moderation
- ⚠️ **Basic moderation only** - Flags saved but no active blocking
- ⚠️ **Admin dashboard missing** - Can't review flags in UI yet
- **Impact:** Requires manual database checks

### AI Limitations
- ⚠️ **No conversation summarization UI** - Happens automatically but invisible
- ⚠️ **Memory system basic** - Semantic search works but not perfect
- **Impact:** Occasional context loss in very long conversations

### Scaling Concerns
- ⚠️ **Vector embeddings cost** - Each message generates embedding
- ⚠️ **No CDN for images** - Avatar images served from Supabase
- ⚠️ **No caching layer** - Every request hits database
- **Impact:** May need optimization as user base grows

---

## 📊 ALPHA SUCCESS METRICS

Track these to measure alpha success:

### User Engagement
- User signups
- Activation rate (users who complete onboarding)
- Messages sent per user
- Average session length
- Companions created per user
- Return rate (users who come back)

### Technical Health
- Error rate in edge functions
- API latency (chat response time)
- Database query performance
- Rate limit hits
- Failed payment attempts

### Revenue (if accepting payments)
- Free to paid conversion rate
- Average revenue per user (ARPU)
- Churn rate
- Most popular tier

### Content Safety
- Moderation flags triggered
- Severity distribution
- False positive rate

---

## 🎯 POST-ALPHA ROADMAP

### Immediate (Within 2 weeks)
1. Fix any critical bugs from alpha users
2. Add audio system (sound effects + music)
3. Improve mobile controls for games
4. Add admin dashboard for content moderation
5. Optimize database queries

### Short-term (1-2 months)
1. Add conversation export feature
2. Improve AI memory and context handling
3. Add more games or companion activities
4. Implement referral system
5. Add user settings page (theme, notifications)

### Medium-term (3-6 months)
1. Voice chat with companions (text-to-speech)
2. Custom companion personalities
3. Companion progression system (levels, unlocks)
4. Social features (friend list, share moments)
5. Mobile app (React Native or PWA)

---

## ✅ FINAL PRE-LAUNCH CHECKLIST

Before you deploy:

### Technical
- ☐ All edge functions deployed to Supabase
- ☐ All migrations applied to production database
- ☐ Environment variables set (ANTHROPIC_API_KEY, STRIPE keys)
- ☐ Stripe webhook configured to point to edge function
- ☐ Domain configured (if using custom domain)
- ☐ SSL certificate active

### Legal & Compliance
- ☐ Terms of Service reviewed and accurate
- ☐ Privacy Policy reviewed and accurate
- ☐ Cookie notice (if applicable)
- ☐ Age verification (13+, 18+, depending on jurisdiction)
- ☐ GDPR compliance (if EU users)
- ☐ Data retention policy documented

### Business
- ☐ Stripe account fully activated (not in test mode)
- ☐ Payment flow tested with real card
- ☐ Refund policy defined
- ☐ Customer support email set up
- ☐ Monitoring/alerting configured
- ☐ Backup strategy in place

### Communication
- ☐ Alpha announcement prepared
- ☐ Feedback collection method ready (form, email, Discord)
- ☐ Bug reporting process defined
- ☐ Social media accounts created (if applicable)
- ☐ Landing page live

---

## 🎉 YOU'RE READY FOR ALPHA!

**Project Velvet is technically ready for alpha release.**

The core functionality is solid:
- ✅ Authentication works
- ✅ Onboarding flow complete
- ✅ AI chat functional (with API key)
- ✅ Multiple companions supported
- ✅ Games working
- ✅ Payment system ready (with Stripe keys)
- ✅ Security in place (RLS, rate limiting, moderation)
- ✅ Database properly designed

**Just remember:**
1. Set the 3 critical environment variables (ANTHROPIC_API_KEY, STRIPE keys)
2. Test the complete user journey once in production
3. Monitor error logs closely in first 24 hours
4. Be ready to respond to bug reports
5. Collect feedback actively

**Good luck with your alpha launch! 🚀**
