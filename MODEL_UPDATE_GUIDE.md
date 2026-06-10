# AI Model Update Guide

This guide explains how to update AI models across all edge functions when Anthropic releases new versions.

## Centralized Configuration

All AI models are managed through a single configuration file:

```
supabase/functions/_shared/modelConfig.ts
```

## Quick Update Process

When Anthropic releases new models, follow these steps:

### 1. Update Model Config

Edit `supabase/functions/_shared/modelConfig.ts`:

```typescript
export const MODEL_CONFIG = {
  SONNET: "claude-sonnet-4-5-20250929",  // Update this
  HAIKU: "claude-haiku-4-5-20251001",    // Update this

  VERSION_INFO: {
    sonnet: "4.5 (2025-09-29)",          // Update this
    haiku: "4.5 (2025-10-01)",           // Update this
    lastChecked: "2026-02-10"            // Update this
  }
};
```

### 2. Deploy All Functions

The edge functions are automatically deployed when changes are saved. No manual deployment needed.

### 3. Verify

Test key functionality:
- Article chat (article-chat)
- Main companion chat (chat)
- Group chat (group-chat)
- Video reactions (generate-video-reaction)

## Which Functions Use Which Models

### SONNET (Complex Tasks)
- `article-chat` - Article discussions
- `chat` - Main companion conversations
- `group-chat` - Multi-companion discussions
- `generate-video-reaction` - Live video reactions

### HAIKU (Simple Tasks)
- `summarize-memory` - Memory summarization
- `smart-video-search` - Video search analysis
- `generate-momentum-theme` - Game theme generation
- `generate-video-reaction` - Video wrap-up comments

## Checking for New Models

Visit Anthropic's model documentation:
https://docs.anthropic.com/en/docs/models-overview

Look for:
- Performance improvements
- Cost reductions
- New capabilities
- Deprecation notices

## Troubleshooting

If you see 404 errors with model names in the console:
1. Check Anthropic's documentation for the latest model IDs
2. Update `modelConfig.ts`
3. Edge functions will auto-deploy with the changes

## Benefits of This System

- **Single Source of Truth**: Update models in one place
- **Consistency**: All functions use the same version
- **Easy Rollback**: Just revert the config file
- **Documentation**: Version info tracked in code
