# Stripe Payment Integration Setup

This guide will help you set up Stripe payments for your Velvet companion app.

## Prerequisites

- A Stripe account (sign up at https://stripe.com)
- Access to your Stripe Dashboard
- Your Supabase project deployed with the edge functions

## Step 1: Create Products and Prices in Stripe

1. Go to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Products** > **Add Product**
3. Create the following products:

### Product 1: Velvet Essential
- **Name**: Velvet Essential
- **Description**: Unlimited daily conversations with quick, responsive AI
- **Pricing**: $24.99/month recurring
- **Copy the Price ID** (starts with `price_`) and update `stripePriceId` for `unlimited` tier

### Product 2: Velvet Plus
- **Name**: Velvet Plus
- **Description**: Extended premium access with deep emotional conversations
- **Pricing**: $59/month recurring
- **Copy the Price ID** and update `stripePriceId` for `starter` tier

### Product 3: Velvet Pro
- **Name**: Velvet Pro
- **Description**: Generous premium access for meaningful connections
- **Pricing**: $99/month recurring
- **Copy the Price ID** and update `stripePriceId` for `plus` tier

### Product 4: Velvet Elite
- **Name**: Velvet Elite
- **Description**: Maximum premium access with unlimited sophisticated conversations
- **Pricing**: $149/month recurring
- **Copy the Price ID** and update `stripePriceId` for `elite` tier

## Step 2: Update Price IDs in Code

Open `src/types/subscription.ts` and replace the placeholder price IDs:

```typescript
unlimited: {
  // ... other fields
  stripePriceId: 'price_YOUR_ACTUAL_PRICE_ID_HERE',
},
starter: {
  // ... other fields
  stripePriceId: 'price_YOUR_ACTUAL_PRICE_ID_HERE',
},
plus: {
  // ... other fields
  stripePriceId: 'price_YOUR_ACTUAL_PRICE_ID_HERE',
},
elite: {
  // ... other fields
  stripePriceId: 'price_YOUR_ACTUAL_PRICE_ID_HERE',
}
```

## Step 3: Configure Stripe Webhook

1. In your Stripe Dashboard, go to **Developers** > **Webhooks**
2. Click **Add endpoint**
3. Set the endpoint URL to:
   ```
   https://YOUR_SUPABASE_PROJECT_ID.supabase.co/functions/v1/stripe-webhook
   ```
4. Select events to listen to:
   - `checkout.session.completed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add this as `STRIPE_WEBHOOK_SECRET` environment variable in your Supabase project

## Step 4: Add Stripe API Key

1. In Stripe Dashboard, go to **Developers** > **API keys**
2. Copy your **Secret key** (starts with `sk_test_` or `sk_live_`)
3. Add this as `STRIPE_SECRET_KEY` environment variable in your Supabase project

## Step 5: Test the Integration

1. In Stripe Dashboard, make sure you're in **Test mode** (toggle in top right)
2. Use test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC
   - Any ZIP code
3. Visit your pricing page and click on a plan
4. Complete the test checkout
5. Verify that:
   - The webhook is triggered (check Stripe Dashboard > Developers > Webhooks)
   - User's subscription tier is updated in database
   - User's message limit is updated correctly

## How It Works

1. **User clicks Subscribe**: The pricing page calls the `create-checkout-session` edge function
2. **Checkout Session Created**: Stripe creates a checkout session with metadata (userId, tier)
3. **User Completes Payment**: User enters payment details and completes checkout on Stripe
4. **Webhook Triggered**: Stripe sends `checkout.session.completed` event to your webhook
5. **Subscription Activated**: The `stripe-webhook` function updates the user's profile:
   - Sets `subscription_tier` to the purchased tier
   - Updates `messages_remaining` based on the tier
   - Enables appropriate AI model (Haiku or Sonnet)
   - Stores `stripe_customer_id` and `stripe_subscription_id`

## Subscription Tiers

| Tier | Price | Messages | Model | Features |
|------|-------|----------|-------|----------|
| Free | $0 | 15 | Haiku | Basic trial |
| Essential | $24.99 | 200/month | Haiku | Unlimited daily chats |
| Plus | $59 | 800/month | Sonnet | Deep conversations |
| Pro | $99 | 2000/month | Sonnet | Meaningful connections |
| Elite | $149 | 5000/month | Sonnet | Maximum access |

## Troubleshooting

### Webhook not triggering
- Verify the webhook URL is correct in Stripe Dashboard
- Check that the webhook secret is properly configured
- View webhook logs in Stripe Dashboard > Developers > Webhooks > [Your Endpoint]

### Payment succeeds but user not upgraded
- Check Supabase logs for the `stripe-webhook` function
- Verify metadata (userId, tier) is included in checkout session
- Ensure user_profiles table has necessary columns

### Test payments failing
- Ensure you're using Stripe test mode
- Use the test card number: 4242 4242 4242 4242
- Check that STRIPE_SECRET_KEY is the test key (starts with `sk_test_`)

## Production Deployment

Before going live:

1. Switch Stripe from Test mode to Live mode
2. Create the same products and prices in Live mode
3. Update the price IDs in your code with Live price IDs
4. Update webhook to use Live mode secret
5. Replace `sk_test_` key with `sk_live_` key
6. Test thoroughly with real (small amount) transactions

## Security Notes

- Never commit Stripe keys to version control
- Always verify webhook signatures (already implemented)
- Use HTTPS for all webhook endpoints (Supabase provides this)
- Store customer IDs securely in your database
- Implement proper error handling for failed payments
