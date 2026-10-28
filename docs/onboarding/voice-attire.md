# Signature attire: one look per voice (draft)

Every signature voice gets a matching outfit, so the voice, the dials and the person you see are one character. This is
a draft mapping from the pieces the avatar system has today (`src/data/avatarItems.ts`: 12 shirts, 11 bottoms,
16 hats, glasses, earrings, necklaces, facial hair, eyeliner, eyepatch). Every cell is a first pass for the director
to correct.

## How it ties in

- The voice is picked **before** the look page, so the look opens already dressed in the voice's attire. It is a
  starting point; they can change anything.
- A random match ("Surprise me") gets its voice's attire too.
- The sim's signature outfit (`simProfile.tsx`) reads the saved look, so the house shows the same outfit.
- A voice's attire is a *persona* (`PERSONAS` in `avatarItems.ts`): a shirt, pants and hat plus the odd extra.

## The catch: tiers

Six pieces used below are `member` or `earned` (Rockstar jacket, Streetwear hoodie, Leather pants, Breeches, Snapback,
Top hat). Locked pieces are swapped for a plain fallback when shown, and `sanitize_avatar_config` in the database strips
them on save. Every voice is open to everyone, so a voice whose attire is locked would arrive undressed. Needs a
decision: make the pieces voices use `starter`, or let a voice's own attire bypass the tier. Changing a tier means
changing the database function too.

## Per voice

"Full" = existing pieces make the look. "Close" = existing pieces get most of the way. "New art" = the look needs a
piece the renderer does not have yet.

| Voice | Fit | Shirt | Bottom | Hat | Extras |
|---|---|---|---|---|---|
| Cheerleader | Full | Cheer top | Cheer skirt | Hair bow | existing Cheerleader persona |
| French Romantic | Full | Linen shirt | Trousers | Beret | pendant |
| Cool Beauty | Full | Suit, tailored | Trousers | none | pearls |
| Homie | Full | Streetwear hoodie | Baggy jeans | Snapback | chain (the Rapper persona) |
| Brooklyn Native | Full | Streetwear hoodie, other colour | Baggy jeans | Beanie | chain |
| Bad Boy | Full | Rockstar jacket | Leather pants | none | stubble |
| Cold Prince | Full | Suit, dark | Trousers | none | none; cool colours |
| Surfer Dude | Full | Tee, faded | Shorts | Bucket hat | stubble |
| Goth Girl | Full | Tee, black | Skirt, black | none | choker, bold eyeliner, dark hair |
| British Gentleman | Full | Suit | Trousers | Top hat if earned, else none | round glasses |
| Therapist | Close | Linen shirt | Trousers | none | round glasses |
| Big Sister | Close | Tee | Jeans | none | hoops |
| 90s R&B Lover | Close | Tee | Trousers | none | chain; wants a 90s jacket |
| Gentle Protector | Close | Linen shirt | Jeans | Beanie | broad body type |
| Shy Sweetheart | Close | Tee, soft colour | Skirt | Headband | round glasses |
| Genki Girl | Close | Tee, bright | Shorts | Headband | hair bow |
| Valley Girl | Close | Tee, pastel | Skirt | Headband | hoops |
| Bookworm | Close | Linen shirt | Skirt | Beret | round glasses |
| Southern Gentleman | Close | Linen shirt | Trousers | Cowboy hat | none |
| Jock | New art | Tee (team colours) | Shorts | Baseball cap | wants a letterman jacket |
| Determined Hero | New art | Tee | Jeans | Headband | wants a scarf |
| Playful Trickster | New art | Streetwear hoodie | Jeans | Bucket hat | dangles; wants a fox mask or cloak |
| Nerd | New art | Tee | Jeans | none | square glasses; wants a cardigan and bow tie |
| Tsundere | New art | Tee | Skirt | Hair bow | wants a school uniform (blazer, plaid skirt) |
| Shakespearean | New art | Pirate garb, lace colours | Breeches | none | wants a doublet or a gown |
| Southern Belle | New art | Linen shirt | Skirt | Hair bow | pearls; wants a dress |

Tally: 10 full, 9 close, 7 need new art. The 7 still get a stand-in from the table until the art exists.

## Still open

- Tiers (above).
- Whether to draw the 7 missing pieces, and which first. Tsundere, Shakespearean and Southern Belle read worst without
  them; the rest are acceptable as stand-ins.
- Whether a voice's attire should apply to existing companions when they change voice, or only at creation.
