# Companion voices and the two openings

## What the companion chat actually captures (scanned)
Creating a companion (`companionService.createCompanion`, `utils/companionRandomizer.ts`, `config/signatureVoices.ts`) stores:

| Field | Values |
|---|---|
| `relationship_type` | romantic, friend (mentor/assistant are coaches, never in the house) |
| `gender` | male, female |
| `signature_voice` | 27 voices (below). Default is `classic_male` / `classic_female`. |
| `humor_style` | Witty & Clever · Goofy & Random · Sarcastic & Dry · Warm & Light |
| `communication_style` | Very Direct · Diplomatic & Tactful · Playfully Indirect · Subtle & Suggestive |
| energy | Life Of The Party · Somewhere In Between · Lives In Own World |
| others | flirting style, confrontation style, support style, emotional openness, expressiveness, love language |

Signature voices (id, who they are, a sample line):
- Standard: classic_male / classic_female ("I'm here. What's on your mind?"), jock, cheerleader, therapist, big_sister
- Culture: brooklyn_native, french_romantic, rnb_lover, homie, bad_boy, southern_gentleman, nerd, british_gentleman, surfer_dude, goth_girl, shakespearean, southern_belle, valley_girl, bookworm
- Anime: cold_prince, determined_hero, playful_trickster, gentle_protector, tsundere, shy_sweetheart, genki_girl, cool_beauty

## What the game does today (and why Maya is wrong)
- The story's four tones (warm/calm/bubbly/dry) are **not** a thing the app has. The host sends `personality` as free text (`"<communication>. <humor>. <voice>"`) and the game stores it in `companionCfg.preset`; every lookup misses and falls back to `warm`. So everyone gets the "warm" lines today.
- The partner is always the internal character `maya`; the display name is the companion's real name, but the lines are written as a couple ("babe").
- With no companion the page already shows "Velvet House is a home you share with a companion" and sends them to `SOMEONE_NEW_ROUTE`. There is no return trip yet (nothing in that pipeline carries a `returnTo`).

## Recommended tone key
**Key = `signature_voice`.** It is the one field the future in-game agent will also run on, so hardcoded lines and live chat sound like the same person.
- 25 non-classic voices: one tone each.
- `classic_male` / `classic_female` (the free default, most users): split by `humor_style` into 4, so they still differ. 8 tone sets.
- Total: **33 tone sets**.
- Fallback when anything is missing: the classic set for the companion's gender.

## Two openings
| Companion | Opening | Shape |
|---|---|---|
| romantic | **Couple** | Today's story: moving in together. |
| friend | **Roommates** | Same beats, written for two friends splitting a place (no "babe", no "our bedroom", the couch fight is about the shared living room). |
| none | not playable | Gate screen, then the companion pipeline, then back to the game. |

Both share the structure, so each line slot exists twice (couple/roommates) × 33 tones.

## New first beat (after the drive-up)
The player and the companion walk in with Dez together.

**DEZ:** "Come on in, {nickname} and {companion}! Welcome to your home!"

then the cold open etc. Dez's lines stay the same for everyone. The truck-off-the-road joke slots in here as player / companion banter.

## Line slots to generate (per opening)
1. `opening.echo`: companion's first reaction to the empty house
2. `opening.moversLate`: movers are late
3. `opening.truckOffRoad` (new): the truck drove off the road, a quick back and forth with Dez
4. `opening.mayorCarriedCouch`
5. (removed: the opening no longer asks for the couch by the window; it ends when the couch is set down and the lamp delivery follows)
6. `opening.keepIt` / `opening.movedIt`: reaction to the choice
7. Player lines (`jordan`): a handful, only here at the start; after this the player types their own

## Prompt for generating the lines (one call per tone set per opening)
```
You are writing hardcoded lines for the opening of a cozy life-sim. {companion} is the player's {couple partner | friend and new roommate}.
Their voice, exactly as it is in chat:
  Signature voice: {voice.name}. {voice.instruction}
  Humor: {humor_style}. Communication: {communication_style}. Energy: {energy}.
  Sample of how they talk: "{voice.sample}"
Write ONE line for each slot below, 1 to 2 short sentences, in that voice. Stay in character, no stage directions,
no emoji unless the voice uses them. Use {player} for the player's nickname and {town} for the town; {companion} speaks as themselves.
Slots, with the situation for each: <the situation text for each slot>
Return JSON: { "opening.echo": "...", ... }
```
Review pass: every set gets read once against the voice sample before it ships.
