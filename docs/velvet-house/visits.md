# Visiting a friend's house

The director: "we do need to be able to let friends go into friends houses and see what they've done."

## What a player sees

- **Household page, Friends' houses:** each friend whose house is open, with the day they are on and a **Visit**
  button, and a **Friends can visit my house** switch (on by default).
- **On a visit:** the friend's house as they last saved it, with the two people who live there and their pets going
  about their day. A bar at the top says whose house it is and has **Go home**. There is no shop, Arrange, chat,
  money or vitals; tapping things still pokes them (the TV flickers on, the fridge opens). Nothing is saved, and
  the player's own house is saved before they leave and opened again, straight in, when they come home.

## How it works

- **Server** (`supabase/migrations/20261111100000_velvet_house_visits.sql`): saves stay owner-only. Security-definer
  functions read them for a friend (an accepted friendship, neither blocking the other, as for designs) and return the
  **house only**, by an allow-list: the rooms' looks, the furniture, wall decor, the yard, pets, the two residents'
  names and looks, the day and time. Never memories, chats, story, concerns, money, bills, the closet or the
  companion's personality. `velvet_house_visits_closed` holds the accounts that closed their house. Checked against a
  real Postgres by `supabase/tests/velvet_house_visits_behaviour.sql`.
- **App:** the game asks the host (`velvet:houses`: `friends`, `open`, `setOpen`) and asks to go (`velvet:visit`);
  the host page (`pages/VelvetHouseNextGame.tsx`, `services/velvetHouseVisits.ts`) runs it as the player and opens
  `/velvet-house/visit/:ownerId` (`pages/VelvetHouseVisit.tsx`). That page fetches the house, puts it in the visit slot
  (`velvet-sims:visit`, removed when the page closes) and opens the game with `?visit`; `velvet:visitEnd` brings the
  player home.
- **Game** (`run.visit` in `kernel/config.ts`, `ui/visit.ts`): reads the visit slot, never saves (`systems/persist.ts`),
  plays no story, sends no unlocks, ticks off no goals, skips the host bridge (the visitor's profile would overwrite the
  residents' looks), and takes taps as pokes only (`systems/input.ts`).

## Still open

- The migration has to be applied to the live project before the list fills; until then the Household page says
  friends' houses could not be loaded.
- A visit shows the friend's last save, not their house live. Visiting together, leaving a note or rating a room are
  not built.
