# YouTube API Setup Guide

The Smart Video Search feature requires a YouTube Data API v3 key to function. Follow these steps to set it up:

## Step 1: Get a YouTube Data API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **YouTube Data API v3**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "YouTube Data API v3"
   - Click on it and press "Enable"
4. Create credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the generated API key
5. (Optional but recommended) Restrict the API key:
   - Click on the API key you just created
   - Under "Application restrictions", you can restrict it to HTTP referrers
   - Under "API restrictions", restrict it to "YouTube Data API v3"

## Step 2: Add the API Key to Supabase

You need to add the YouTube API key as a secret in your Supabase project:

### Using Supabase Dashboard:
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to "Settings" > "Edge Functions"
4. Under "Secrets", add a new secret:
   - Name: `YOUTUBE_API_KEY`
   - Value: Your YouTube API key from Step 1

### Using Supabase CLI:
```bash
supabase secrets set YOUTUBE_API_KEY=your_api_key_here
```

## Step 3: Redeploy the Edge Function

After adding the secret, the smart-video-search edge function needs to be redeployed to pick up the new environment variable. It will automatically use the secret once it's set.

## API Quota Information

The YouTube Data API has a daily quota limit:
- Free tier: 10,000 units per day
- Each search costs approximately 100 units
- Each video details request costs approximately 1 unit per video

This should be more than enough for typical usage (around 100 searches per day).

## Troubleshooting

If the search feature still doesn't work after setup:
1. Verify the API key is correctly set in Supabase secrets
2. Check that the YouTube Data API v3 is enabled in your Google Cloud project
3. Ensure the API key isn't restricted in a way that blocks the requests
4. Check the Supabase Edge Function logs for specific error messages
