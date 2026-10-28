# Making a companion: the dials (as built)

Dez asks, a person answers, and each answer sets one thing the companion does differently. Two companions that differ
by one dial should feel different. If a question cannot show up in how someone chats or in the house, it is not asked.

Flow: Dez's intro, **gender**, **friend or companion** (skipped if already chosen), **build or be surprised**. Surprise
me makes everything below at random (from the same options, so the two cannot drift) and ends in the chat. Build goes on:

| Screen | Dez asks | Stops | Saved as | Where it shows |
|---|---|---|---|---|
| Energy | "Picture her walking into a party. Does she work the room, or find the quiet corner?" | life of the party / in between / own world | `energy_preference` | length, punctuation, how often she starts a chat; also sets `expressiveness` (emoji and actions) |
| Humor | "You burn the toast and set off the smoke alarm. What does she say?" | witty / goofy / dry / warm; **pick one, or two** | `humor_style`, "Witty & Clever + Warm & Light", main first | chat; the house's line banks (`humorKey`, the first named wins) |
| Directness | "You ask her how the new haircut looks, and it is not great." | tells you straight / tactful but honest / hints and teases | `communication_style` | chat; the house's line banks (`commKey`) |
| Openness | "She has had a rough week. Does she tell you about it?" | keeps it to herself / opens up when ready / tells you everything | `emotional_openness` | how much she volunteers |
| Care | "You come home wrecked after a bad day. What does she do?" | fixes it with you / listens first, then helps / just listens | `support_style` | how she handles stress, and the house's concerns |
| Flirt (**companions only**) | "Now the fun part. How does she let you know she's into you?" | bold / sweet / banter / deep and quiet | `flirting_style` | chat |
| Interests | "What is she into?" | six groups, pick a few | `hobbies`, `interest_text` | topics |
| Name | | | `custom_name` | |

Every dial has a real middle: the answer is a position, not a forced label. Love language and "when it's hard" are not
asked here; the companion asks them in conversation in its first week (`companionWeekOne.ts`).

## Who wins against the signature voice

The prompt now says the settings set the levels (how big, how long, how often, how blunt, how open, fix or listen) and
the voice owns its attitude and phrases, winning on what it names as its core, where the setting only nudges a step.
See `voice-audit.md`.

## Not asked, and not made up

Conversation depth, initiative, availability, dynamic, life context and sports are no longer filled in with an invented
answer. They stay empty and the prompt falls back to "not set".

## Still open

- Dez's lines between questions (a reaction after each answer) are not written; the beats between screens are the old,
  unhosted ones.
- The check that changing one dial changes the output (one fixed message, one dial moved) has not been run against the
  model.
- Voice picking comes after these screens and does not yet flag a voice that is locked against what was chosen
  ("Genki Girl at calm is a stretch").
