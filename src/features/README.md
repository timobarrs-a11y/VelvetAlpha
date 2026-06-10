# Feature-Sliced Architecture

This directory contains feature modules organized by domain. Each feature is self-contained with its own components, hooks, services, and types.

## Structure

```
src/
├── features/
│   ├── chat/          - Chat functionality (messages, conversations, UI)
│   ├── onboarding/    - User onboarding flow (questionnaires, setup)
│   ├── subscription/  - Subscription management and pricing
│   ├── video/         - Video watching and reactions
│   └── rituals/       - Daily rituals and routines
└── shared/           - Shared utilities, clients, and common types
```

## Guidelines

### Feature Structure
Each feature should follow this internal structure:
```
feature/
├── index.ts           - Public API exports
├── components/        - Feature-specific components
├── hooks/             - Feature-specific hooks
├── services/          - Feature-specific business logic
├── types.ts           - Feature-specific types
└── utils/             - Feature-specific utilities
```

### Shared Module
The `shared/` directory contains:
- Common utilities (date formatting, validation, etc.)
- API clients (Supabase, external services)
- Common types used across features
- UI primitives and base components

### Rules
1. Features should NOT import from other features directly
2. Cross-feature communication should go through shared interfaces
3. Each feature exports a clean public API via index.ts
4. Keep features as independent as possible
5. Shared code goes in `shared/`, not duplicated across features

## Migration Status

Currently in Phase 1: Structure creation
- Placeholder files created
- No behavior changes
- Existing code unchanged

Next steps:
- Move components into features
- Extract services into features
- Refactor App.tsx to use feature modules
