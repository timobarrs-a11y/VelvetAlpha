# Velvet Sims: free and paid, money, bills and the daily routine

*Plan for later. Ideas and decisions from Tim, 26 October; nothing here is built yet. The
numbers are a first pass, tuned to the shop's prices (median item about $100).*

The aim: enough for free that someone comes back every day, and enough behind the paywall
that they want to sign up. The game is good on its own without the AI; the AI makes it come
alive. Money isn't only for buying things: bills come due, and the player has to manage it.

## 1. Two levels of the same game

| | **Free: the game** | **Paid: the live game** |
|---|---|---|
| Home, building, decorating, the shop | Yes | Yes |
| Daily routine, chores, garden, pets, bills, bank | Yes | Yes |
| Side jobs at home | 1 new offer a day | 3 new offers a day |
| Your companion in the house | Scripted: their own day, canned lines, "While you were at work" | The AI: they talk back, remember, react |
| Talking to your companion in real time (the live sequences) | No | Yes |
| The day job | **Corner Market** (the free job, below), flat pay, no promotions | The five jobs in `jobs.md`, promotions, higher pay |

Today the game gives free players 40 AI companion replies a day and paid players 300 (the
budget in `20261027130000_velvet_game_budget.sql`). That's inside the game only; Velvet's
normal chat outside the game has its own message limits. Under this plan, free players get no
AI companion in the game (or a small taste; see open decisions).

## 2. The free job: Corner Market

A new job, built without the AI, so a free player always has steady pay.

- **Place:** a small neighbourhood market. Stockroom, shelves, one till.
- **Work tasks:** stock shelves, face the shelves, check dates, ring up regulars, the delivery
  truck at 10. Scripted, quick, like the Help Desk tickets.
- **Cast:** Mr. Okafor (owner, kind, particular about the shelves) and a few regulars with one
  canned line each.
- **Pay:** $20 an hour. No promotions. Paid players can still pick it.

## 3. Money

### What things cost (fixed)

Bills are fixed amounts on fixed days, each paid separately:

| Bill | Amount | Due | If it's late |
|---|---|---|---|
| Rent | $400 a week | Monday | $25 late fee, then a warning letter from the landlord |
| Electric | $70 a week | Wednesday | $25 late fee; the power goes off (TV, cooking, computer side jobs, lights), the fridge spoils (the game already does this) |
| Water | $40 a week | Friday | $25 late fee; the water goes off (no shower, no dishes, hygiene drops, which hurts work) |
| Internet | $30 a week | Friday | The computer side jobs stop until it's paid |

That's $540 a week in bills, plus about $105 in groceries: **about $645 a week to live**. These
replace the single "rent and utilities" bill the game has now ($180 every 3 days).

### What they earn

A game week has 5 workdays (8 paid hours each) and 7 evenings.

| | Free | Paid, starting job | Paid, promoted |
|---|---|---|---|
| Day job | $20/hr → $800 a week | $32/hr → $1,280 | up to $55/hr → $2,200 |
| Side jobs | 1 offer a day, about $78 → about $545 a week | 3 offers a day, they'll do about 2 → about $1,120 | same |
| **Earned a week** | **about $1,345** | **about $2,400** | **about $3,320** |
| Minus living ($645) | **about $700 a week ≈ $100 a day** | **about $1,755 ≈ $250 a day** | about $2,675 ≈ $380 a day |
| In shop items (median $100) | **about one thing a day** | **two or three a day** | more |

**Why not 0.25x pay?** If free players earned a quarter of what paid players earn, they
couldn't pay rent. The bills already widen the gap: free players earn a bit over half of what
paid players earn, but because both pay the same bills, free players keep about **0.4x** of
the spending money. That gives Tim's rule: free buys one thing a day, paid buys two or three.

The current plan for IT pay ($18–35 an hour, `architecture-plan.md`) moves up to sit above the
free job ($32–55).

### The bank

Every payment is something the player does and sees.

- A **Bank** app on Jordan's phone and the home computer shows:
  - the balance in large type
  - a list of transactions: `Fri  Paycheck — Corner Market  +$800`, `Mon  Rent  −$400`
  - **Bills**: what's due, when, and a Pay button on each.
- **Paying a bill:** tap Pay, confirm "Pay rent: $400 from checking". The balance counts
  down ($958 → $558) and the bill moves to Paid with a receipt line.
- **Paychecks** come in on Friday evening, the full week at once. Rent is due on Monday, so
  the weekend's spending decides whether rent is easy or tight.
- **No autopay.** Paying is part of the game. A reminder lands the day before each due date.
- **Starting money:** $900, with the first rent due on day 3.

## 4. Side jobs at home

Done in the house, at the right object. Each takes a fixed amount of game time and pays only
when finished.

| Side job | Where | Game time | Pay | Notes |
|---|---|---|---|---|
| **Build a website for a customer** | Computer | 3 h | $120 | Needs power and internet |
| **Design a logo** | Computer or desk | 2 h | $80 | Needs power and internet |
| **Fix a neighbour's laptop** | Desk or workbench | 1.5 h | $60 | Needs power |
| **Bake a batch for the café** | Kitchen | 2 h | $70 | Uses 2 servings from the fridge; needs power and water |
| **Tutor a student online** | Computer | 1 h | $45 | Needs internet. Paid: the student talks back with the AI |

How they work:
- **Offers** arrive in an Odd Jobs inbox on the phone: 1 a day for free players, 3 a day for paid
  players. Each offer expires after 2 days.
- **Progress bar:** working fills a bar over the job's game time. They can get up at any time,
  do something else and come back; progress is kept.
- **Paid on completion only.** Half a website pays nothing.
- **Needs keep draining** while they work. A low energy or fun level slows the bar a little, so
  home life matters.
- **The game already has a "freelance" activity** (90 minutes at the desk, gives fun). It
  becomes the Design a logo job.

## 5. The daily routine (autonomy)

Jordan runs his own day, so nothing falls apart if the player is away.

| Time | What Jordan does on his own |
|---|---|
| 6:00 | Wakes up |
| 6:00–8:00 | Brushes teeth, showers, breakfast, gets dressed |
| 8:00 | Leaves for work |
| 8:00–5:00 | At work (paid 8 hours, lunch at noon) |
| 5:00 | Home |
| 5:00–12:00 | Free evening: eats, relaxes, looks after needs. **Doesn't do side jobs or pay bills on his own** |
| 12:00 | Bed |

Weekends have no work: he wakes at 8 and the day is his.

- **Overrides:** a Routine panel changes any of this for a day or for good, e.g. wake at 5:30,
  skip the shower, stay up late. The game already supports Jordan leaving for work and coming
  home.
- **Things pile up if they're not there.** The routine keeps the job safe, but:
  - bills aren't paid (late fees, power or water off)
  - side-job offers expire
  - dishes, laundry and mail stack up
  - the companion notices ("You've been busy").
  Coming back always has something to sort out.

## 6. How fast a day goes (like The Sims)

The clock already runs like The Sims: at 1x, **one game minute is one real second**, so a full
day is 24 real minutes (`BASE_MIN_PER_SEC = 1`, speeds 1x, 3x and 10x). The plan keeps that
and skips the parts nobody wants to watch, as The Sims does:

| Part of the day | Game time | What happens | Real time |
|---|---|---|---|
| Morning, 6:00–8:00 | 2 h | Jordan's routine plays out; they can step in | about 2 min at 1x, or 40 s at 3x |
| Work, 8:00–5:00 | 9 h | Jordan is away. **Skip to 5 PM** (the game already has a skip that simulates the work day without drawing it) | a few seconds |
| Evening, 5:00–12:00 | 7 h | The part they play: side jobs, bills, chores, the companion | about 7 min at 1x, 2–3 min at 3x |
| Night, 12:00–6:00 | 6 h | Everyone asleep: the clock jumps ahead automatically, like The Sims' sleep speed-up | a few seconds |

So **a weekday is about 10 minutes of real play**, and a weekend day (no work) about 15–20.
A side job fits in an evening: building a website (3 game hours) takes 3 real minutes at 1x or
1 minute at 3x. A game week, with its bills, is about an hour and a half of play.

**When the game is closed, time stops**, as in The Sims. Nothing is lost while they're away.
Things pile up inside the game: if they speed through days without paying attention, Jordan
keeps to his routine and his job, but bills go late, offers expire and chores stack up.

**What brings them back each real day** isn't the clock. It's things tied to the real date:
the companion's daily message, a daily side-job offer that's on the real calendar, and Today in
Velvet. Earnings are per game day, so playing more game days earns more.

## 7. Open decisions

1. **A taste of the AI for free:** none, or a small allowance (a few live conversations, or the
   first week).
2. **Late rent:** after the warning, what's the worst that happens? My recommendation: no
   eviction, just a growing fee and an awkward landlord. Losing the house would drive people away.
3. **Which paid tier unlocks the live game:** Essential, Plus or Elite (`src/types/subscription.ts`),
   or a game-only add-on.
4. **One clear offer:** how this fits with Velvet's other paid features (coaches, assistants,
   the web search button) so it's one subscription, not several small ones.
