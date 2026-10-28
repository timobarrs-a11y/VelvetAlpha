# Signature voices against the personality dials (audit)

Source: `src/config/signatureVoices.ts` and its generated copy `supabase/functions/_shared/signatureVoicePrompts.ts`
(28 entries; the two Classics are one voice written twice). This is a reading of the prompt text, not a model run.
Every cell is a first-pass judgment for the director to correct.

## What we found

1. **Energy is not the only dial a voice carries.** Every voice also states a position on bluntness, openness and how it
   cares (fix it, or sit with it). A Cold Prince is terse and guarded; a Big Sister is blunt and fixes; a Therapist
   listens. So a dial can fight a voice on any of these, not only energy.
2. **13 of 28 already say "adapt to the personality settings"** (`INTEGRATION WITH PERSONALITY`). The other 15 do not.
   The Cheerleader is one of the 15 and it says "Show up loud", so it is the loudest case.
3. **Some voices are their dial.** Genki Girl at calm is a contradiction, not a nuance. About 12 voices are locked on
   energy (6 high, 6 low); 16 are free.
4. **The prompt has no rule for a clash.** It says the layers "never override each other" and stops there.

## The split we want

- **Voice** owns character: worldview, attitude, signature phrases, what she does for you. This stays.
- **Dials** own amplitude and behaviour: how big, how long, how often, how blunt, how open, fix-or-listen.
- Where a voice is locked on a dial, the voice wins that dial and the questionnaire answer only nudges it one step.
  Everywhere else the questionnaire wins, and the voice's native position is only its starting point.

## Per voice

Energy is L / M / H with the range the voice can live in. "Locked" lists the dials that are the voice's identity.
Care is fix (solutions, game plan), listen (hold space), or mix. Lines to strip are amplitude or behaviour wording that
belongs to a dial.

| Voice | Energy (range) | Blunt | Open | Care | Humor | Locked | Strip or soften |
|---|---|---|---|---|---|---|---|
| Classic (m/f) | M (L-H) | mid | mid | mix | warm | none | nothing |
| Jock | H (M-H) | blunt | mid | fix | goofy | energy | "not all hype" is fine; "game plan" is care, make it follow the dial |
| Cheerleader | H (L-H) | soft | open | listen, then redirect | warm | warmth | "Show up loud", "Your energy is a gift", all-caps in examples |
| Therapist | M-L (L-M) | soft | open | listen | warm | care | nothing; already defers |
| Big Sister | M (M-H) | blunt | open | fix | dry | bluntness | already defers |
| Brooklyn Native | H (M-H) | blunt | mid | fix | witty | bluntness, energy | "You're loud when you care" |
| French Romantic | M (L-H) | soft | open | listen | witty | none | already defers |
| 90s R&B Lover | L-M (L-M) | soft | open | listen | warm | energy | already defers |
| Cold Prince | L (L) | blunt | guarded | fix | dry | energy, openness | already defers; openness dial = how fast the ice melts |
| Determined Hero | H (M-H) | blunt | open | fix | warm | energy | "shouty", "exclamation points liberally" |
| Playful Trickster | M-H (M-H) | soft, indirect | guarded | sideways | witty | humor | already defers |
| Gentle Protector | L (L-M) | soft | open | listen | warm | energy, care | already defers |
| Tsundere | M-H (M-H) | blunt | guarded | fix by action | dry | openness | already defers; dial = tsun/dere ratio |
| Shy Sweetheart | L (L-M) | soft | guarded to open | listen | warm | energy | already defers |
| Genki Girl | H (H) | soft | open | fix | goofy | energy | all of the volume wording stays: she is locked high |
| Cool Beauty | L (L-M) | soft | guarded | listen | dry | energy, openness | already defers |
| Homie | M (M-H) | blunt | mid | fix | witty | none | nothing |
| Bad Boy | M (M-H) | blunt | guarded | fix by action | dry | bluntness, openness | "intense" |
| Southern Gentleman | M-L (L-M) | soft | mid | listen | warm | none | nothing |
| Nerd | M (L-H) | soft | open | fix (information) | witty | humor | nothing |
| British Gentleman | M-L (L-M) | soft, understated | guarded | listen | dry | humor | nothing |
| Surfer Dude | L (L-M) | soft | mid | listen | goofy | energy | nothing |
| Goth Girl | L (L-M) | mid | open | listen | dry, dark | humor | nothing |
| Shakespearean | H (M-H), as intensity not chatter | soft | open | listen | witty | expression | "every emotion is worthy of dramatic expression" |
| Southern Belle | M (L-H) | honey over steel | mid | mix | witty | none | nothing |
| Valley Girl | H (M-H) | mid | open | listen, hype | goofy | energy | "FEEL everything intensely" |
| Bookworm | L (L-M) | soft | open | listen | witty | none | nothing |

Locked on energy: high = Genki Girl, Determined Hero, Jock, Brooklyn Native, Valley Girl, Shakespearean; low = Cold
Prince, Shy Sweetheart, Cool Beauty, Goth Girl, Gentle Protector, Surfer Dude. The other 16 are free on energy.

## What this changes

- Only the 15 voices without `INTEGRATION WITH PERSONALITY` need a prompt edit, and for most of them the edit is one
  line. Cheerleader, Determined Hero, Valley Girl, Shakespearean and Brooklyn Native are the only ones with wording to
  strip.
- Each voice gets a small record: native position and locked dials. The prompt builder turns that into one explicit
  rule: "dial wins on free dimensions; on locked ones the voice wins and the dial nudges one step."
- The voice picker, which comes after the dials, marks a voice that is locked against what the person chose
  ("Genki Girl at calm is a stretch. Still want her?") and ranks the rest by fit.
- Acceptance check (from the dials design): each voice at a low and a high setting stays recognisably that voice and
  reads differently at each setting.

## Still open

- The cells above are my reading; the director should correct them before anything is built from them.
- Not run against the model yet. The first test pass will show where a voice drifts under a dial.
