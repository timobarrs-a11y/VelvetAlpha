# Games Fixes — Handoff Instructions for Bolt

Two games touched: **Checkers** (two bugs fixed) and **Momentum** (mobile swipe
controls added). All changes are frontend-only — no edge functions, no schema.

---

## CHECKERS — `src/pages/CheckersGame.tsx`

### Bug A: AI chat box did nothing

`initializeGame()` loaded the companion with:

```ts
const { data: companions } = await supabase
  .from('companions').select('*').eq('user_id', user.id).maybeSingle();
```

`.maybeSingle()` returns an **error + null data whenever the user has more than
one companion**. Since users now have multiple (Friends/Companions/Coaches),
`companionId` was never set, so `handleSendMessage` bailed at
`if (!companionId) return`. It also ignored the `?companion=` launch param.

**Fix:** prefer the `?companion=` companion, else fall back to the most-recent
one; never `.maybeSingle()` the whole list.

```ts
const companionParam = searchParams.get('companion');
let companionRow = null;
if (companionParam) {
  const { data } = await supabase.from('companions').select('*')
    .eq('id', companionParam).eq('user_id', user.id).maybeSingle();
  companionRow = data;
}
if (!companionRow) {
  const { data } = await supabase.from('companions').select('*')
    .eq('user_id', user.id).order('last_message_at', { ascending: false }).limit(1);
  companionRow = data?.[0] ?? null;
}
// then setCompanionId(companionRow.id) / setCompanionName(...) as before
```

Also, chat was routed through the dead legacy `ChatService.sendMessage()` path.
Switched it to `sendMessageWithSignals` so the companion replies in their real
persona/voice (the same `chat-turn` pipeline fixed in the persona work):

```ts
const contextualMessage = `[We're in the middle of a checkers game right now — keep it playful and in-character] ${content}`;
const userProfile = await ChatService.getUserProfile();
const response = userProfile
  ? (await ChatService.sendMessageWithSignals(contextualMessage, companionId, userProfile)).assistantMessage
  : await ChatService.sendMessage(contextualMessage, companionId, 'romantic');
```

### Bug B: pieces "wouldn't move" (player's move got erased)

Root cause was a stale-state race. `executeMove` deferred the board update in a
`setTimeout` but switched the turn to the AI **immediately**:

```ts
setActiveAnimations(animations);
setTimeout(() => { setBoard(newBoard); ... }, ~800ms);  // board updates LATER
setCurrentTurn(opponent);                                // turn flips NOW
```

Flipping the turn fired the AI effect. The AI's `makeAIMove` closure had
captured `board` from the render **before** `setBoard` ran, so it computed and
applied its move on the pre-move board — **overwriting the player's move**.
Symptom: you move, it animates, then your piece reverts when the AI replies.

**Fix (the pattern that matters):** keep an authoritative `boardRef` and commit
the board + turn switch together *after* the animation. Never let the AI read
board state from a React closure.

1. Add a ref synced to board:
   ```ts
   const boardRef = useRef<BoardState>(board);
   useEffect(() => { boardRef.current = board; }, [board]);
   ```
2. `executeMove`: source from `boardRef.current` (not `board`), capture
   `const mover = currentTurn` at the top, `await` the animation delay, then
   commit `boardRef.current = newBoard; setBoard(newBoard)` and only *then*
   `setCurrentTurn(mover === 'red' ? 'black' : 'red')`. Move the DB `saveMove`
   before the await; keep commentary/win/draw checks after the commit using
   `mover` and `newBoard`. (Guard `winner && winner !== 'draw'`.)
3. `makeAIMove`: read `const sourceBoard = boardRef.current` and pass that to
   `calculateBestMove` and the king check — no `board` closure reads.
4. Guard against mid-animation input in `handleSquareClick`:
   ```ts
   if (activeAnimations.length > 0) return;
   ```

The board logic (`checkersGameLogic.ts`), the AI (`checkersAI.ts`), and the
board component were correct and untouched — this was purely a state-timing bug
in the page component.

### Checkers QA

1. User with 2+ companions: chat box replies (in the companion's voice), doesn't
   sit silent.
2. Launch from a companion's chat (`?companion=`): that companion is the
   opponent/chatter.
3. Make a move → piece animates and **stays**; AI responds on the updated board.
4. Capture chains, kinging, undo, new game, win/lose/draw all still resolve.
5. Rapidly tapping during an animation doesn't queue a second move.

---

## MOMENTUM — `src/pages/MomentumGame.tsx`

Goal: mobile was hard because the only controls were three small 64px buttons
(←, BOOST, →) built for two-thumb play. Added **swipe-to-steer + tap-to-boost**,
keyboard untouched.

### How it works

- **Swipe anywhere on the canvas** to move the ball horizontally. It's a
  *relative* drag: on touch-start we record the finger X and the ball's current
  center, and while dragging we steer the ball toward
  `startBallCenter + fingerDelta * scale * TOUCH_SENSITIVITY` (clamped to the
  board). Relative (not absolute) means the ball never teleports to the finger.
- **Quick stationary tap** = boost (same one-shot as a spacebar tap). A tap is
  disambiguated from a drag by movement (<8px) and duration (<250ms).
- A large **BOOST button** remains as a visible fallback, plus a
  "Swipe to steer · tap to boost" hint.

### Implementation

1. Constant:
   ```ts
   const TOUCH_SENSITIVITY = 1.6; // ball travel per px of finger drag (canvas space)
   ```
2. Refs (next to `keysRef`):
   ```ts
   const touchTargetXRef = useRef<number | null>(null);
   const touchInfoRef = useRef<{ startClientX: number; startBallCenter: number; moved: boolean; startTime: number } | null>(null);
   ```
3. In the physics loop, resolve horizontal **intent** from touch first, then
   keyboard, and use that intent for both movement and the boost's horizontal
   kick (so a boost mid-swipe still angles correctly):
   ```ts
   let intentLeft = keys.left, intentRight = keys.right;
   const steerTarget = touchTargetXRef.current;
   if (steerTarget !== null) {
     const dx = steerTarget - (player.x + PLAYER_WIDTH / 2);
     intentLeft = dx < -4; intentRight = dx > 4;   // 4px deadzone
   }
   if (intentLeft) player.vx = -HORIZONTAL_SPEED;
   else if (intentRight) player.vx = HORIZONTAL_SPEED;
   else player.vx *= (steerTarget !== null ? 0.6 : 0.82);
   // boost block: use intentLeft/intentRight instead of keys.left/right
   ```
4. Handlers + boost helper (defined after the keyboard effect):
   `triggerBoost()` pulses `keys.boost` on then off after 60ms;
   `handleCanvasTouchStart/Move/End` implement the drag + tap logic above
   (convert finger delta to canvas space via the canvas `getBoundingClientRect`
   scale). See the file for exact bodies.
5. Canvas gets the handlers + `style={{ touchAction: 'none' }}` (stops the page
   from scrolling during a swipe) + `select-none`.
6. Old 3-button bar replaced with the hint + one large BOOST button. The wrapper
   is `pointer-events-none` so swipes fall through to the canvas; only the button
   re-enables `pointer-events-auto`.

### Momentum QA (on a phone / touch emulator)

1. Swipe left/right on the play area → ball follows smoothly, reaches both edges.
2. Ball doesn't jump when you first touch (relative drag).
3. Quick tap → boost fires (watch fuel drop); tapping the BOOST button also works.
4. Boosting mid-swipe angles in the swipe direction.
5. Desktop keyboard (←/→/A/D/Space) unchanged.
6. Page doesn't scroll while swiping the canvas.

Tuning knobs: `TOUCH_SENSITIVITY` (higher = less finger travel to cross the
board), the `250`ms / `8`px tap thresholds, and the `4`px steering deadzone.
