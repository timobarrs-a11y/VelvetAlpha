# Phase 5: Voice rooms (plan only, don't build yet)

Voice is what keeps 2K crews on Discord: they talk while they play. It's
also the most expensive and hardest feature to moderate, so it waits until
Phases 1–4 are in real use.

## Approach when it's time

- **Service:** LiveKit Cloud (hosted WebRTC). Don't run media servers ourselves.
- **Room kind:** add `'voice'` to `community_rooms.kind`. A voice room shows who's connected, with mute and deafen.
- **Token edge function** `community-voice-token`: same checks as `community-room-send` (auth, ban, social access, membership, space ban), then returns a short-lived LiveKit token for `space-{board_id}-{room_id}`. Room owners/mods get the "can mute others" grant.
- **Client:** `@livekit/components-react`. A docked "connected to #squad-up" bar stays visible while you browse the rest of Velvet.
- **Safety:** voice can't be screened like text. Before launch: report-a-voice-room, owner/mod mute and kick, age-verified members only (already required for social), and no voice in spaces under a minimum account age.
- **Cost check:** price per participant-minute from LiveKit at the time. Start with voice in Velvet Alpha only.

## Decide before building

1. Is voice part of the free tier or paid only?
2. Which spaces get voice by default (crews only?)
3. Is screen sharing in scope (clips, watching a game together)?
