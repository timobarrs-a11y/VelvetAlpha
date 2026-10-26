# Velvet Sims: Jobs, Work Days and Workplace Casts

*Design doc. Companion to `opening-sequence.md`.*

Jordan (the player) goes to work. Maya stays home with her own day (chores,
hobbies, texts Jordan on his break). Each job is a **content pack**: a place,
a cast of strong personalities, a stream of work tasks, and a progression.

## The five jobs

| # | Job | Place | Cast (signature voice it borrows) | The loop |
|---|---|---|---|---|
| 1 | **IT Help Desk** | Cubicle farm, server room, break room, boardroom | Nerd, Valley girl, Goth girl, Brooklyn native, plus the boss and callers below | Tickets |
| 2 | **Teacher** | Customisable classroom | Five or six kids written like individual children (see "Kids" rules), plus the Southern belle principal | Lessons and keeping the class calm |
| 3 | **Café barista** | Café counter and seating | Goth girl, Surfer dude, Shakespearean, Bookworm | The morning rush |
| 4 | **Gym trainer** | Fitness studio | Jock, Cheerleader, Tsundere | Member goals |
| 5 | **Animal clinic** | Vet clinic (uses the game's real pets) | Gentle protector, Genki girl, nervous owners | Check-ups and calming scared pets |

Swap-in if we want one: **Restaurant kitchen** (Brooklyn-native head chef, French
romantic pastry chef, a dishwasher who is a homie).

Jobs unlock through a pick at the start and then promotions or milestones.

---

## Job 1: IT Help Desk (Meridian Tech)

The tone is deadpan office comedy. Everyone has a "computer problem". Almost
none of them are.

### Place

- **Cubicle farm:** a grid of cubicles. Jordan's has a monitor, a mug and a
  sad plant. Coworkers sit in theirs. Customisable desk (colour, style) and
  wallpaper, same as the home systems.
- **Server room:** cold, humming, blinking lights. Raven lives here.
- **Break room:** coffee machine, fridge with one stolen lunch.
- **Boardroom:** all-hands meetings, the Friday review.

### Cast

Each is a one-line identity players recognise at once.

| Character | Voice | Persona in one line |
|---|---|---|
| **Dale** (boss) | Cold prince, made corporate | Speaks only in buzzwords ("let's circle back", "move the needle"). Warm underneath. Terrified of the server room |
| **Ozzie** (sysadmin) | Nerd | Over-explains everything, loves RGB lighting, sees Jordan as his only equal |
| **Kayleigh** (intern) | Valley girl | Cheerful and chaotic. Has broken something every day and is "literally so sorry" |
| **Raven** (night security and server room) | Goth girl | Deadpan, dry, quietly the most competent person in the building |
| **Tony** (sales) | Brooklyn native | Blunt, loud, needs his laptop to "just work, I got a guy at four" |
| **Barb from Accounting** (caller) | New | Calls everything "the Google". Her monitor is always unplugged. Recurring |

### Work tasks (no AI needed)

Tickets arrive in a queue with a timer. Most are quick, free interactions:

| Ticket | What it really is |
|---|---|
| "My screen is black" | Unplugged (it's Barb) |
| "The printer is haunted" | Paper jam, but Raven insists it is a ghost |
| "I forgot my password (again)" | Reset it, with a small lecture |
| "I can't find the any key" | Press any key |
| "Reply-all storm" | Contain it before it hits the whole company |
| "The server room is too warm" | A fan, a ladder, and Dale panicking |

Each ticket is a short choice: **turn it off and on again**, **check the cable**,
**reset the password**, or **escalate**. The signature **"Have you tried turning
it off and on again?"** button works more often than it should.

Scripted set pieces: Monday standup, the Friday review, and an **all-hands
server outage** where the whole cast pulls together.

### Progression

Help Desk Tech, then Senior Tech, then Team Lead, then Sysadmin, then IT Director.
Performance comes from ticket speed and quality, not from chatting.

---

## How a work day works (all jobs)

- **Schedule:** weekdays, with a commute. Jordan can't take house orders while
  at work. Needs still drain, so he has to eat and use the bathroom at work.
- **Visible:** tap Jordan at work, or use the workplace tab, to switch into the
  office scene and watch what he is doing. A status line says what ("2pm
  product meeting").
- **Tasks:** the job's stream of small tasks fills a performance meter. Most
  are free, deterministic interactions. The player can direct them, or leave
  Jordan to handle them on his own.
- **Chat is the bonus:** talking to coworkers or kids is optional and costs
  money (it calls the AI). It earns bonuses, relationships and story, not the
  basic paycheque.
- **Pay:** a review at the end of each shift updates performance and pay, using
  the existing career logic (`state/career.ts`).
- **Organize:** how the workspace is styled and arranged (desks, wallpaper,
  floor) affects mood and performance.

## Character engine rules

Every character is a data file: name, age, role, personality, vocabulary,
speech quirks, what they know and don't know, relationship to the player, mood,
a few remembered facts, schedule, and a model tier.

- **Short replies:** one or two sentences.
- **Structured output:** `{ line, emotion, action }`, so the game drives
  animation and mood.
- **Tiers:** background characters on the fast model, leads (Maya and each
  job's main characters) on the stronger model. Persona prompts are cached.
- **Budget:** a per-day chat allowance, with canned fallback lines when the
  chat is unavailable.

### Kids (Teacher job)

The player is always the adult teacher. Kid characters stay inside classroom
life: lessons, jokes, small conflicts, feelings. They never ask for or give
personal information, and nothing romantic or inappropriate is ever in scope.
This is enforced in the prompt and by an output check. Review against the app's
and the API provider's content and age policies before launch.

---

## Build order

1. **Foundation pass:** connect the chat to the live game, add cloud save, one
   shared source for level and object data plus a scene list (so a workplace
   is a scene, not a floor number), and split `main.ts`.
2. **Script engine** and the Dez opening from `opening-sequence.md`.
3. **Daily to-do list** and Jordan going to work (Maya at home).
4. **Character chat engine**, with Maya moved onto it.
5. **IT Help Desk scene** first, as the template for the other four.
6. **Teacher**, then **Café**, **Gym** and **Animal clinic**.

## Open decisions

- Job 5: Animal clinic or Restaurant kitchen?
- Work time at normal speed: speed up automatically during work, or let the
  player skip a shift?
- Skipping work: a penalty (performance, a warning) or just no pay that day?
- Story tone: cozy small-town, or more drama?
