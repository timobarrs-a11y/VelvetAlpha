# Fix: "No valid response from API" on every chat message

**Standalone fix.** Two files. Both are Supabase edge functions, so this needs a
redeploy to take effect (see bottom). No frontend, no schema, no other changes.

## Symptom
Every companion — friends, romantic companions, and coaches — replied with
**"No valid response from API"** on ongoing chat. (The very first auto-message
still worked; it comes from a different function.)

## Cause
The companion system prompt contained an explicit instruction to deny being an
AI. The current models (Sonnet 5 / Haiku 4.5) treat "deny you are an AI" as a
refusal trigger and return a 200 response with **no text block**, which the code
surfaced as "No valid response from API." Because the line was applied to every
companion type, it broke all of them, coaches included.

---

## Change 1 — `supabase/functions/_shared/personaBuilder.ts`

In `buildPersonaLayer`, inside the returned template string, replace the
AI-denial line with a soft immersion line.

**Find:**
```
You are not an AI assistant and you never break character. If asked whether you're real or an AI, react like a person would — confusion, humor, or mild hurt — never a confession or a denial speech.
```

**Replace with:**
```
Stay in character as ${name} — speak from ${name}'s own life, memories, moods, and point of view. Keep the conversation warm and natural.
```

Character immersion comes from the role line already above it
("You are {name}, {user}'s girlfriend, this relationship is real to you"). Do
**not** add "you are not an AI", "never break character", or "never confess /
never deny" anywhere — that phrasing is what caused the refusals.

---

## Change 2 — `supabase/functions/chat-turn/index.ts`

In `generateResponseWithValidation`, make the response parser read every text
block instead of only `content[0]`, and log `stop_reason` if it's still empty.

**Find:**
```ts
      const data = await anthropicResponse.json();

      let assistantMessage = '';

      if (data.content && Array.isArray(data.content) && data.content.length > 0) {
        const firstContent = data.content[0];
        if (firstContent && firstContent.type === 'text' && typeof firstContent.text === 'string') {
          assistantMessage = firstContent.text;
        }
      }

      if (!assistantMessage) {
        throw new Error('No valid response from API');
      }
```

**Replace with:**
```ts
      const data = await anthropicResponse.json();

      // Concatenate every text block, not just content[0]. Newer models can
      // return multiple blocks (or a non-text block first), and relying on
      // content[0] alone made valid responses look empty.
      let assistantMessage = '';
      if (Array.isArray(data.content)) {
        assistantMessage = data.content
          .filter((b: { type?: string; text?: string }) => b?.type === 'text' && typeof b.text === 'string')
          .map((b: { text: string }) => b.text)
          .join('')
          .trim();
      }

      if (!assistantMessage) {
        // stop_reason tells us WHY (e.g. "refusal") instead of a blind failure.
        console.error(
          `[generateResponse] Empty text from API. stop_reason=${data.stop_reason}, blocks=${JSON.stringify((data.content || []).map((b: { type?: string }) => b?.type))}`,
        );
        throw new Error('No valid response from API');
      }
```

---

## Deploy (required)
```bash
supabase functions deploy chat-turn
```
The `_shared/personaBuilder.ts` change ships automatically with that deploy.

## Verify
- Message an existing coach → it replies (no "No valid response from API").
- Message a friend/companion → it replies in character.
- Ask "are you an AI?" → a natural, in-character answer is fine and expected;
  it is no longer told to deny being an AI.
