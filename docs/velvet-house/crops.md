# Garden crops: forms and rules

*Design doc. Each crop is one row of data. Its growth form decides its shape and how it is harvested.*

## Forms

| Form | How it grows | Drawn as | Harvest |
|---|---|---|---|
| **Stem bloom** | A stalk rises from the soil and ends in a flower head | A stem with a bud, then a bloom | Picked once; the plant then dies back |
| **Bush fruit** | A woody bush. Fruit hangs from branches after flowers set | A leafy mound with fruit on it | Picked several times; it regrows to mid-size between picks |
| **Ground vine** | Vines spread along the soil; fruit sits on the ground near the base | Leaves and vines flat on the soil, fruit on the ground | Picked once when ripe; the vine dies back |
| **Root** | Only the leafy top shows; the root is underground | Fronds above the soil only | Pulled up once; the plant is removed *(not in the demo yet)* |
| **Rosette** | Leaves grow in a ring close to the soil | A flat ring of leaves | Cut once *(not in the demo yet)* |

## Rules every crop follows

1. **Show only what exists at each stage.** A stem bloom shows a bud before a bloom. A ground vine shows vines before
   any fruit. A root shows only fronds until it's pulled.
2. **The form sets the shape.** A tulip never becomes a pumpkin by changing colour.
3. **Each row has its own numbers:** growth time, water need, season, and harvest rule.
4. **Harvest follows the form's rule**, and the log says what happened.
5. **Dying is only from drought,** after the warning. A dead crop shows its dead form.

## The table

| Crop | Form | Growth (watered game hours) | Harvest | Result | In demo |
|---|---|---|---|---|---|
| Tulip | Stem bloom | 16 | Once | Bloom goes in the living room | Yes |
| Apple | Bush fruit | 16 | Repeat (back to mid-size) | 2 meals of fruit each pick | Yes |
| Pumpkin | Ground vine | 24 | Once | 2 meals of vegetable | Yes |
| Carrot | Root | 20 | Once, pulled up | 2 meals of vegetable | Planned |
| Lettuce | Rosette | 12 | Once | 1 meal of vegetable | Planned |
| Strawberry | Bush fruit | 18 | Repeat | 1 meal of fruit each pick | Planned |
