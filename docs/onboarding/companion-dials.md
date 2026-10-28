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

## Dez's remarks

After every answer Dez says one short line, typed out like the rest of his dialogue, and then the next question comes
up. The lines are the same for everyone; only the companion's pronouns change. Humor with two picks gets "A mix. That's
how real folks are." The old "taking shape" screens are gone, since his remarks do that job. Remarks live next to each
question in `companionBank.ts` (`reaction`) and are only said when a host is set.

| After | Dez says (she/he shown as she) |
|---|---|
| Female / Male | "A woman, then. I know a few worth meeting." / "A fella, then. I know a few of those too." |
| Friend / companion | "A friend first. Best way to start anything." / "Something more. Now we're talking." |
| Build / surprise | "A builder. I like it. Let's make her just right." / "Feeling lucky. Hold onto your hat." |
| Energy | "Hoo, she's the loud one. No dull nights with her." / "Could go either way, depending on the day. Smart." / "The quiet type. Bet she's thinking about something good." |
| Humor | "Sharp. Hope you've had your coffee." / "A clown. I respect that." / "Deadpan. Takes you a second, then you're gone." / "Kind humor. Rare as hen's teeth." |
| Directness | "A straight shooter. You'll always know where you stand." / "Tactful but honest. The hardest kind to be." / "Hints and teasing. You'll be guessing, and loving it." |
| Openness | "Hard to crack. Worth the effort, though." / "She'll open up in her own time. Can't rush that." / "Wears her heart on her sleeve. That takes nerve." |
| Care | "A fixer. Sleeves up first, questions after." / "Listens first, then helps. That's the order that works." / "Just stays with you. Sometimes that's all anybody needs." |
| Flirt | "Bold. No guesswork there." / "Sweet and subtle. It's the little things." / "Banter. Flirting with a sharp edge." / "Quiet and deep. Notices everything." |
| Interests | "Good taste. Never a shortage to talk about." |
| Name | "{Name}. That suits her. Let me go and fetch her." |

## Who wins against the signature voice

The prompt now says the settings set the levels (how big, how long, how often, how blunt, how open, fix or listen) and
the voice owns its attitude and phrases, winning on what it names as its core, where the setting only nudges a step.
See `voice-audit.md`.

## Not asked, and not made up

Conversation depth, initiative, availability, dynamic, life context and sports are no longer filled in with an invented
answer. They stay empty and the prompt falls back to "not set".

## Still open

- The check that changing one dial changes the output (one fixed message, one dial moved) has not been run against the
  model.
- Voice picking comes after these screens and does not yet flag a voice that is locked against what was chosen
  ("Genki Girl at calm is a stretch").
