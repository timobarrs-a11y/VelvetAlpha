# Developer money phrase

For testing the shop (the mix-and-match sets). Say this to the partner in chat:

```
xoxotimoisgodxoxo
```

It adds **$500,000** (any case; it must be the whole message; `xoxotimosgodxoxo` without the second i works too). It also works on the start menu's Cheats screen: it is saved and paid out once you are in your house, the same as a pack code. It goes through the bank as "Found money" and the log shows
`+$500000`. It can be said again for more.

- It is caught in `handleTalk` (`systems/chat.ts`) before anything goes to the AI or into the chat history: not sent, not
  answered, not remembered. Anything that is not exactly the phrase is an ordinary message.
- It only adds money: no story flag, no clock, so it cannot skip anything in the story.
- It marks the house (`flags.cheated`, saved with it), so the **Salon** refuses to sell (what it sells stays with the
  player's account outside the game); everything else in the shop takes the money.
- It is one of the game's two code mechanisms; the other is the unlock codes for players (`unlock-codes.md`).

Code: `state/devMoney.ts`, `systems/devMoney.ts`, `systems/chat.ts`. Tests: `__tests__/devMoney.test.ts`,
`e2e/velvet-sims/devMoney.spec.ts`.
