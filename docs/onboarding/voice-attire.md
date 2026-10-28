# Signature attire: one look per voice (draft)

Every signature voice gets a matching outfit, so the voice, the dials and the person you see are one character. This is
a draft mapping from the pieces the avatar system has today (`src/data/avatarItems.ts`: 12 shirts, 11 bottoms,
16 hats, glasses, earrings, necklaces, facial hair, eyeliner, eyepatch). Every cell is a first pass for the director
to correct.

## How it ties in (as built)

- A new companion starts in the plain default outfit. Their voice's **signature style** is the first thing on the
  Wardrobe tab, so choosing it is a small moment of its own; a person who never opens the tab simply keeps the default
  and finds it later.
- Without a membership, the signature style and the plain default are the only outfits they can pick. Every other
  outfit and persona is still on show, locked. Members can wear anything.
- A **random match** ("Surprise me") has no wardrobe step, so it is made already dressed in its voice's style.
- The sim reads the saved look, so the house shows the same outfit, whatever the player's membership. The sim has its
  own drawings of the six new shirts.
- Voices cannot be changed later, so attire only applies when a companion is made.

## Tiers

The six new shirts, the plaid skirt and the fox mask are starter items, so they need no database change. The
member-only pieces some voices use (rockstar jacket, streetwear hoodie, leather pants, breeches, baggy jeans, snapback)
stay member-only for everyone else. A companion may wear its own voice's pieces whatever its owner's plan
(`sanitize_companion_avatar_config`, written as a migration and **not yet applied** to the live database). The lock on
the other outfits is in the editor; the database only guards the member-only pieces.

## Per voice

"Full" = existing pieces make the look. "Close" = existing pieces get most of the way. "New art" = the piece was drawn
for this (done: see below).

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

Tally: 10 full, 9 close, 7 with newly drawn pieces.

## Drawn for this

| Piece | For | Where |
|---|---|---|
| Letterman jacket (`letterman`, contrast sleeves, letter, snaps) | Jock | shirt |
| Tee & scarf (`hero`) | Determined Hero | shirt |
| Fox mask (`fox_mask`, worn on the side of the head) | Playful Trickster | face accessory |
| Cardigan & bow tie (`cardigan`) | Nerd | shirt |
| Sailor uniform (`uniform`) and plaid skirt (`plaid_skirt`) | Tsundere | shirt and pants |
| Doublet & ruff (`doublet`) | Shakespearean | shirt |
| Sundress (`sundress`, comes with a skirt in its own colour) | Southern Belle | shirt |

## Still open

- Whether a random match should start in the default and have the wardrobe to find, like the built path. As built it
  is dressed, because it has no wardrobe step.
- The fox mask replaces the Trickster's hat slot; say if they should also keep a hat.
- The migration (`20261111120000_companion_voice_attire.sql`) is **applied** to the live database (as `companion_voice_attire`,
  with execute revoked from `anon`). Not yet tried with a signed-in free account: the save path calls it with the
  companion's id, and falls back to an unchecked save if it ever errors.
