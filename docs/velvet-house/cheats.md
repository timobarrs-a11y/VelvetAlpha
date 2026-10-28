# Cheat codes

A few typed codes for playing around. Code: `state/cheats.ts` (the rules and the table), `systems/cheats.ts` (what they
do to the house), `ui/cheats.ts` (the console). Tests: `__tests__/cheats.test.ts`, `e2e/velvet-sims/cheats.spec.ts`.

**Open the console:** press the backtick key (`` ` ``), or tap the money chip five times within five seconds (for a
phone). Enter runs a code, Escape or the × closes it. Codes are not case sensitive.

| Code | What it does |
|---|---|
| `kaching` | Finds $1000 in the couch (goes through the bank as "Found money"). |
| `fillerup` | Everyone's needs are full. |
| `lovebomb` | Bond with the partner +15 (to 100). |
| `stockup` | The fridge has at least 8 basic and 8 fresh meals. |
| `decorate <set>` | Puts a whole set on the floor you are looking at, free. Every set in the shop is a name (`retro`, `farmhouse`, `modern`, `scandi`, `industrial`, `beach`, `spring`, `summer`, `fall`, `winter`); `help` lists them from the catalog. |
| `help` | Lists them. |

**Rules**
- Only after the move-in is over (`settleDone`), and never during a cutscene or a guided lesson. A cheat never sets a
  story flag, marks a beat done or skips anything: the story stays as it is.
- Money from `kaching` sets `flags.cheated` on that house. The **Salon** then refuses to sell (what it sells stays with
  the player's account outside the game), so cheat money cannot buy account items. Everything else in the shop still
  takes it. The flag is saved with the house.
- A cheat is not a time skip: there are no codes for the clock or the season, because bills and schedules run on
  absolute time.
