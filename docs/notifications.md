# Phone notifications

Players can get a notification on their phone when a real person messages them and they are
away from the app. This is web push: it works on Android browsers, and on iPhone and iPad once
Velvet has been added to the Home Screen.

## What is built (phase 1: messages from people)

- **Settings:** Settings, Notifications. "Phone notifications" turns it on for this device (the
  browser asks permission when the player taps it). Then: messages from people, show message text
  (off by default, so the lock screen says who and not what), and quiet hours.
- **Saved devices:** `push_subscriptions` (migration `20261027140000_push_notifications.sql`). A
  device is added through `register_push_subscription`, so a shared phone follows whoever signed
  in last.
- **The trigger:** a new row in `im_messages` calls the `push-notify` edge function (only if the
  recipient has a saved device). It never blocks or fails a message.
- **The rules** (`supabase/functions/_shared/pushRules.ts`, tested in
  `src/services/__tests__/pushRules.test.ts`): no notification if push is off, the sender is
  blocked, the recipient is online right now (the in-app popup covers that), or it is inside quiet
  hours. Several messages in one chat collapse into one notification.
- **Tapping it:** opens that chat (`/lobby?im=...&conv=...`, or a message to the open app).

## Turning it on (once, not in git)

1. `npx web-push generate-vapid-keys`
2. Edge function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:you@example.com`).
3. The web app build: `VITE_VAPID_PUBLIC_KEY` (the same public key).
4. The Vault secret `cron_secret` must exist (the scheduled functions already need it).
5. Apply the migration, then deploy `push-notify`.

Until steps 1 to 5 are done the Settings toggle explains that notifications are not set up, and
the trigger does nothing.

## Not built yet

- Per-conversation mute (there is no mute table yet).
- Group chat and community rooms (mentions and replies only, never every message).
- Companion check-ins (the scheduler `proactive-check-in-scheduler` already decides when; it
  would call `push-notify` with a new kind, off by default).
- Game events (a bill is due, a shift ended): the game runs in the player's browser, so the server
  does not know what is happening in the house while they are away.
- Not tested against real push services: it needs the keys and a deployed function.
