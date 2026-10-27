# 3-Point Shootout: real-time VS with a friend (plan)

*Planning note. Nothing here is built.*

## The idea in one line

Both players play **their own game on their own screen, at the same time, on the same course**, and only
the **score** travels between them. Each sees the other's points tick up live, the way Contest already
shows an AI rival's count-up. No physics is synced, which is what keeps this small.

## Why this is cheap

- Contest already draws a rival's score as a live count-up on the board (`scoreAt` in `rivals.ts`; only
  *your* run loads the 3D arena). A friend's live score events replace the simulated run.
- Friends already play checkers, draw & guess, rock-paper-scissors and paint over a Supabase realtime
  broadcast channel (`useGameChannel`, `src/components/dock/friendGameChannel.ts`), and chat invites travel as
  `[game:<id>]` messages that render as a Play card.
- The course is deterministic from a seed (`buildCourse`, `ballSim.ts`), so both players get the identical
  racks and ball order.

## Flow

1. **Invite.** Add `shootout` to the friend games. The friend chat shows a Play card; accepting opens a
   lobby on the channel `shootout-<conversationId>-<matchId>`.
2. **Ready.** Each side sends `ready`. The inviter (host) picks level, seed and clock and sends `go` with a
   3-2-1 start. Each player's clock is local and the same length, so a ~100 ms start skew is harmless.
3. **Play.** After every shot each side sends `shot { t, points, score }` (about 25 small messages per player
   per run). The opponent's score line and avatar sit on your board and tick up as they shoot.
4. **Finish.** Each side sends `done { score }`. Results: win, lose or draw. A draw goes to the existing 30 s
   shoot-off (`tiebreakCourse`), played the same way.
5. **Save.** Write one row per match (below) so wins can feed a leaderboard.

## Edge cases to decide

- **Opponent drops mid-run:** heartbeat every 5 s. After 15 s with none, mark "opponent left", let the player
  finish, and count it as a win by forfeit only if they were ahead or the opponent never finished.
- **Phone backgrounds the app:** timers can pause, so treat a long gap like a drop.
- **Friend offline:** phase 3 below (play against their saved best run).
- **Cheating:** friendly matches trust the scores the clients report. Ranked play must not. The ball sim is
  deterministic, so a server can replay recorded release timings and verify the score (phase 4).

## Data

Only one new table: `shootout_matches (id, host_id, guest_id, level, seed, host_score, guest_score,
winner_id, finished_at)` with RLS so players read their own. The live play uses broadcast only, no tables.

Realtime cost is negligible: roughly 50 messages per match.

## Phases

1. **Duel with a friend** (invite, lobby, live scores, result, shoot-off). The core feature.
2. **Match history and a wins leaderboard.**
3. **Ghost fallback:** save each finished run's shot list and replay a friend's best run when they're offline.
4. **Ranked play and matchmaking:** server-side score verification, then pairing with strangers.

## Testing

- Unit tests for the match state machine (ready, go, shots, done, forfeit, draw) and for the live score feed,
  both pure like `rivals.ts`.
- A manual two-browser test for the real thing.

## Open questions

- 1 v 1 only, or a small group (3 to 4 friends) later?
- Same level for both, or the host chooses and the guest accepts?
- Any stakes (coins, medals) or just bragging rights?
- Does a draw always go to a shoot-off?
