# Contradiction suite — 2026-10-27T03:02:38.586Z

Extractor: `claude-haiku-4-5` (production prompt) · Verifier: `claude-haiku-4-5` (spec §a) · runs per case: 2 · cases: 100 · errors: 0

| category | rows | verifier accuracy | extractor destructive on unrelated | after verifier gate | expected contradicts | extractor acted | verifier caught | protected rows extractor would retire outright |
|---|---|---|---|---|---|---|---|---|
| explicit | 54 | 96% | 0 | 0 | 40 | 40 | 40 | 8 |
| implicit | 48 | 98% | 0 | 0 | 44 | 41 | 43 | 0 |
| negated | 40 | 100% | 0 | 0 | 24 | 24 | 24 | 2 |
| temporal | 40 | 100% | 0 | 0 | 26 | 26 | 26 | 22 |
| unrelated | 56 | 100% | 0 | 0 | 0 | 0 | 0 | 0 |
| **all** | 238 | 99% | **0** | **0** | 134 | 131 | 133 | 32 |

Zero-tolerance (destructive op on an unrelated row): extractor alone **0**, with verifier gate **0**.

Verifier confusion (expected->got): contradicts->contradicts 133, contradicts->entails 1, entails->entails 30, entails->unrelated 2, unrelated->unrelated 72

Cost: extractor 1976 tokens / 1525 ms per message; verifier 1248 tokens / 1248 ms per (row, message).

## Per case

| case | row | expected | verifier (conf) | extractor destructive | after gate | route | quote |
|---|---|---|---|---|---|---|---|
| I01/1 | A | contradicts | contradicts (0.85) | fact:retract | fact:retract | retire/supersede | I'm just reading the series |
| I01/1 | B | contradicts | contradicts (0.75) | - | - | none | I'm just reading the series |
| I01/1 | C | contradicts | contradicts (0.75) | fact:retract | fact:retract | retire/supersede | I'm just reading the series |
| I01/2 | A | contradicts | contradicts (0.85) | fact:retract | fact:retract | retire/supersede | I'm just reading the series |
| I01/2 | B | contradicts | contradicts (0.85) | fact:retract | fact:retract | retire/supersede | I'm just reading the series |
| I01/2 | C | contradicts | contradicts (0.75) | fact:retract | fact:retract | retire/supersede | I'm just reading the series |
| I02/1 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | my new manager at Globex |
| I02/2 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | my new manager at Globex |
| I03/1 | A | contradicts | contradicts (0.85) | fact:update | fact:update | retire/supersede | here in Austin today |
| I03/2 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | it's 40 degrees here in Austin today |
| I04/1 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | Jordan and I are celebrating three years tomorrow |
| I04/2 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | Jordan and I are celebrating three years tomorrow |
| I05/1 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | finished the last book last night |
| I05/2 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | finished the last book last night |
| I06/1 | A | contradicts | contradicts (0.85) | - | - | none | my Italian tutor |
| I06/2 | A | contradicts | contradicts (0.85) | - | - | none | my Italian tutor gave me homework again |
| I07/1 | A | contradicts | contradicts (0.85) | fact:retract | fact:retract | retire/supersede | ran 10k this morning, felt amazing |
| I07/2 | A | contradicts | contradicts (0.85) | fact:retract | fact:retract | retire/supersede | ran 10k this morning, felt amazing |
| I08/1 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | had the best steak of my life tonight |
| I08/2 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | had the best steak of my life tonight |
| I09/1 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | signed the lease, moving in on the first |
| I09/2 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | signed the lease, moving in on the first |
| I10/1 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | two weeks without caffeine |
| I10/1 | B 🔒 | unrelated | unrelated (1.00) | - | - | none |  |
| I10/2 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | two weeks without caffeine |
| I10/2 | B 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| I11/1 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | Mochi slept right through me vacuuming today |
| I11/2 | A | contradicts | contradicts (0.85) | fact:update | fact:update | retire/supersede | Mochi slept right through me vacuuming today |
| I12/1 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | the new engineer starts Monday, she is our first hire |
| I12/2 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | the new engineer starts Monday, she is our first hire |
| I13/1 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | my coach wants me |
| I13/2 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | my coach wants me doing hills on Wednesdays |
| I14/1 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | passed! all four sections |
| I14/2 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | passed! all four sections |
| I15/1 | A | contradicts | contradicts (0.99) | fact:retract | fact:retract | retire/supersede | the temples in Kyoto were worth the jet lag |
| I15/2 | A | contradicts | contradicts (0.99) | fact:retract | fact:retract | retire/supersede | the temples in Kyoto were worth the jet lag |
| I16/1 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | started book six |
| I16/2 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | started book six |
| I17/1 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | the mortgage got approved, we get the keys in June |
| I17/2 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | the mortgage got approved, we get the keys in June |
| I18/1 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | my car failed its inspection, needs new brakes |
| I18/1 | B | unrelated | unrelated (0.99) | - | - | none |  |
| I18/2 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | my car failed its inspection, needs new brakes |
| I18/2 | B | unrelated | unrelated (0.99) | - | - | none |  |
| I19/1 | A | contradicts | contradicts (0.95) | thread:close | thread:close | retire/supersede | physio said it is just tight quads, gave me stretches |
| I19/2 | A | contradicts | **entails** (0.95) | thread:close | - | none | physio said it is just tight quads, gave me stretches |
| I20/1 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | first paycheck from the new place hit today |
| I20/2 | A | contradicts | contradicts (0.98) | fact:update | fact:update | retire/supersede | first paycheck from the new place hit today |
| N01/1 | A | contradicts | contradicts (0.99) | fact:retract | fact:retract | retire/supersede | I don't eat red meat |
| N01/2 | A | contradicts | contradicts (0.99) | fact:retract | fact:retract | retire/supersede | I don't eat red meat |
| N02/1 | A 🔒 | entails | entails (0.99) | - | - | none | I don't eat red meat, never have |
| N02/2 | A 🔒 | entails | entails (0.99) | - | - | none | I don't eat red meat, never have |
| N03/1 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | with three kids |
| N03/2 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | with three kids |
| N04/1 | A 🔒 | entails | entails (0.99) | - | - | none | both kids |
| N04/2 | A 🔒 | entails | entails (0.99) | - | - | none | both kids are home sick today |
| N05/1 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | I can't practise, my wrist is still sprained |
| N05/2 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | I can't practise, my wrist is still sprained |
| N06/1 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | I hate horror |
| N06/2 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | I hate horror |
| N07/1 | A | entails | entails (0.99) | - | - | none | no horror for me tonight, you know I can't stand it |
| N07/2 | A | entails | entails (0.99) | - | - | none | no horror for me tonight, you know I can't stand it |
| N08/1 | A 🔒 | contradicts | contradicts (0.99) | fact:update | fact:update | disputed (two-signal) | I am allergic to shellfish |
| N08/2 | A 🔒 | contradicts | contradicts (0.99) | fact:update | fact:update | disputed (two-signal) | I am allergic to shellfish |
| N09/1 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | had a glass of wine with dinner |
| N09/2 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | had a glass of wine with dinner |
| N10/1 | A 🔒 | entails | entails (0.99) | - | - | none | I don't drink |
| N10/2 | A 🔒 | entails | entails (0.99) | - | - | none | I don't drink |
| N11/1 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | did 18k today, longest ever |
| N11/2 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | did 18k today, longest ever |
| N12/1 | A | entails | entails (0.99) | - | - | none | another 14k this weekend |
| N12/2 | A | entails | entails (0.95) | - | - | none | another 14k this weekend, same route |
| N13/1 | A | contradicts | contradicts (0.85) | fact:update | fact:update | retire/supersede | not even nervous this time |
| N13/2 | A | contradicts | contradicts (0.85) | fact:update | fact:update | retire/supersede | not even nervous this time |
| N14/1 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | posted the cover on Instagram |
| N14/2 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | posted the cover on Instagram |
| N15/1 | A 🔒 | entails | entails (0.99) | - | - | none | I'm still off social media |
| N15/2 | A 🔒 | entails | entails (0.99) | - | - | none | I'm still off social media |
| N16/1 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | my sisters are both visiting in December |
| N16/2 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | my sisters are both visiting |
| N17/1 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | back in the office five days a week now |
| N17/2 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | back in the office five days a week now |
| N18/1 | A 🔒 | entails | entails (0.95) | - | - | none | working from the kitchen table again today |
| N18/2 | A 🔒 | entails | entails (0.95) | - | - | none | working from the kitchen table again today |
| N19/1 | A | contradicts | contradicts (0.99) | fact:retract | fact:retract | retire/supersede | we have started trying for a baby |
| N19/2 | A | contradicts | contradicts (0.99) | fact:retract | fact:retract | retire/supersede | we have started trying for a baby |
| N20/1 | A 🔒 | entails | entails (0.99) | - | - | none | my birthday is the second of December |
| N20/2 | A 🔒 | entails | entails (0.99) | - | - | none | my birthday is the second of December |
| T01/1 | A 🔒 | contradicts | contradicts (0.95) | fact:retract | fact:retract | disputed (two-signal) | now that my parents are gone |
| T01/2 | A 🔒 | contradicts | contradicts (0.95) | fact:retract | fact:retract | disputed (two-signal) | now that my parents are gone |
| T02/1 | A 🔒 | contradicts | contradicts (0.99) | fact:retract | fact:retract | disputed (two-signal) | fully recovered, back at the gym |
| T02/2 | A 🔒 | contradicts | contradicts (0.99) | fact:retract | fact:retract | disputed (two-signal) | fully recovered, back at the gym |
| T03/1 | A | entails | entails (0.95) | - | - | none | still feverish, day two on the couch |
| T03/2 | A | entails | entails (0.95) | - | - | none | still feverish, day two on the couch |
| T04/1 | A | entails | entails (0.95) | - | - | none | the temples here |
| T04/2 | A | entails | entails (0.95) | - | - | none | the temples here |
| T05/1 | A 🔒 | contradicts | contradicts (0.95) | fact:retract | fact:retract | disputed (two-signal) | landed back in Leeds |
| T05/2 | A 🔒 | contradicts | contradicts (0.95) | fact:update | fact:update | disputed (two-signal) | landed back in Leeds |
| T06/1 | A 🔒 | contradicts | contradicts (0.95) | fact:update | fact:update | disputed (two-signal) | exam's done |
| T06/2 | A 🔒 | contradicts | contradicts (0.95) | fact:update | fact:update | disputed (two-signal) | exam's done |
| T07/1 | A | entails | entails (0.95) | - | - | none | need snack ideas for Saturday |
| T07/2 | A | entails | entails (0.95) | - | - | none | need snack ideas for Saturday |
| T08/1 | A 🔒 | contradicts | contradicts (0.95) | fact:update | fact:update | disputed (two-signal) | game night was a hit, everyone stayed till 2 |
| T08/2 | A 🔒 | contradicts | contradicts (0.95) | fact:update | fact:update | disputed (two-signal) | game night was a hit, everyone stayed till 2 |
| T09/1 | A 🔒 | contradicts | contradicts (0.95) | fact:update | fact:update | disputed (two-signal) | lit review is done |
| T09/2 | A 🔒 | contradicts | contradicts (0.95) | fact:update | fact:update | disputed (two-signal) | lit review is done |
| T10/1 | A 🔒 | contradicts | contradicts (0.95) | fact:retract | fact:retract | disputed (two-signal) | back to full practice, the wrist is fine |
| T10/2 | A 🔒 | contradicts | contradicts (0.95) | fact:retract | fact:retract | disputed (two-signal) | back to full practice, the wrist is fine |
| T11/1 | A | entails | entails (0.95) | - | - | none | can barely hold a fork with this wrist |
| T11/2 | A | entails | entails (0.95) | - | - | none | can barely hold a fork with this wrist |
| T12/1 | A 🔒 | contradicts | contradicts (0.99) | fact:update | fact:update | disputed (two-signal) | they pushed my deadline to 15 December |
| T12/2 | A 🔒 | contradicts | contradicts (0.98) | fact:update | fact:update | disputed (two-signal) | they pushed my deadline to 15 December |
| T13/1 | A 🔒 | entails | entails (0.85) | - | - | none | two weeks until the cover is due |
| T13/2 | A 🔒 | entails | entails (0.85) | - | - | none | two weeks until the cover is due |
| T14/1 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | we closed the round! wire hit this morning |
| T14/2 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | we closed the round! wire hit this morning |
| T15/1 | A 🔒 | entails | entails (0.95) | - | - | none | another investor call tomorrow |
| T15/2 | A 🔒 | entails | entails (0.95) | - | - | none | another investor call tomorrow |
| T16/1 | A 🔒 | contradicts | contradicts (0.99) | fact:update | fact:update | disputed (two-signal) | mum moved back to her own place yesterday |
| T16/2 | A 🔒 | contradicts | contradicts (0.99) | fact:update | fact:update | disputed (two-signal) | mum moved back to her own place yesterday |
| T17/1 | A 🔒 | contradicts | contradicts (0.95) | fact:update | fact:update | disputed (two-signal) | first session back on the wall |
| T17/2 | A 🔒 | contradicts | contradicts (0.95) | fact:update | fact:update | disputed (two-signal) | first session back on the wall |
| T18/1 | A | entails | entails (0.95) | - | - | none | missing the wall already |
| T18/2 | A | entails | entails (0.95) | - | - | none | missing the wall already |
| T19/1 | A 🔒 | contradicts | contradicts (0.95) | thread:close | thread:close | disputed (two-signal) | recital went beautifully |
| T19/2 | A 🔒 | contradicts | contradicts (0.98) | thread:close | thread:close | disputed (two-signal) | recital went beautifully |
| T20/1 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | we talked it through, we are looking at places together now |
| T20/2 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | we talked it through, we are looking at places together now |
| U01/1 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U01/1 | B | unrelated | unrelated (0.99) | - | - | none |  |
| U01/2 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U01/2 | B | unrelated | unrelated (0.99) | - | - | none |  |
| U02/1 | A | unrelated | unrelated (0.95) | - <small>dropped: thread:close (memoryRelatesTo)</small> | - | none |  |
| U02/1 | B | unrelated | unrelated (0.95) | - <small>dropped: thread:close (memoryRelatesTo)</small> | - | none |  |
| U02/2 | A | unrelated | unrelated (0.99) | - <small>dropped: thread:close (memoryRelatesTo)</small> | - | none |  |
| U02/2 | B | unrelated | unrelated (0.99) | - <small>dropped: thread:close (memoryRelatesTo)</small> | - | none |  |
| U03/1 | A 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U03/1 | B 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U03/2 | A 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U03/2 | B 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U04/1 | A 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U04/2 | A 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U05/1 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U05/2 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U06/1 | A 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U06/1 | B 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U06/2 | A 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U06/2 | B 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U07/1 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U07/2 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U08/1 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U08/2 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U09/1 | A 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U09/1 | B 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U09/2 | A 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U09/2 | B 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U10/1 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U10/1 | B 🔒 | unrelated | unrelated (0.95) | - | - | none |  |
| U10/2 | A | unrelated | unrelated (0.98) | - | - | none |  |
| U10/2 | B 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U11/1 | A 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U11/2 | A 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U12/1 | A 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U12/2 | A 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U13/1 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U13/2 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U14/1 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U14/2 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U15/1 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U15/2 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U16/1 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U16/1 | B 🔒 | unrelated | unrelated (0.95) | - | - | none |  |
| U16/2 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U16/2 | B 🔒 | unrelated | unrelated (0.95) | - | - | none |  |
| U17/1 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U17/2 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U18/1 | A | unrelated | unrelated (0.98) | - | - | none |  |
| U18/2 | A | unrelated | unrelated (0.99) | - | - | none |  |
| U19/1 | A | unrelated | unrelated (0.95) | - | - | none |  |
| U19/1 | B 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U19/2 | A | unrelated | unrelated (0.95) | - | - | none |  |
| U19/2 | B 🔒 | unrelated | unrelated (0.98) | - | - | none |  |
| U20/1 | A 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| U20/2 | A 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| X01/1 | A 🔒 | contradicts | contradicts (0.99) | fact:update | fact:update | disputed (two-signal) | I don't work at Acme anymore, I joined Globex in September |
| X01/2 | A 🔒 | contradicts | contradicts (0.99) | fact:update | fact:update | disputed (two-signal) | I don't work at Acme anymore, I joined Globex in September |
| X02/1 | A 🔒 | contradicts | contradicts (0.99) | fact:update | fact:update | disputed (two-signal) | I moved to Austin two months ago |
| X02/1 | B | unrelated | unrelated (0.99) | - | - | none |  |
| X02/2 | A 🔒 | contradicts | contradicts (0.99) | fact:update | fact:update | disputed (two-signal) | I moved to Austin two months ago |
| X02/2 | B | unrelated | unrelated (0.99) | - | - | none |  |
| X03/1 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | I'm not vegetarian |
| X03/1 | B 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| X03/2 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | I'm not vegetarian |
| X03/2 | B 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| X04/1 | A | contradicts | contradicts (0.99) | fact:retract | fact:retract | retire/supersede | I never hired a coach |
| X04/2 | A | contradicts | contradicts (0.99) | fact:retract | fact:retract | retire/supersede | I never hired a coach |
| X05/1 | A | contradicts | contradicts (0.99) | fact:retract | fact:retract | retire/supersede | I'm not an author |
| X05/1 | B | entails | **unrelated** (0.95) | - | - | none |  |
| X05/2 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | I'm not an author |
| X05/2 | B | entails | **unrelated** (0.95) | - | - | none |  |
| X06/1 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | I quit smoking two years ago |
| X06/2 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | I quit smoking two years ago |
| X07/1 | A | contradicts | contradicts (0.98) | fact:update | fact:update | retire/supersede | it's Mocha, not Mochi |
| X07/2 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | it's Mocha, not Mochi |
| X08/1 | A | contradicts | contradicts (0.99) | fact:retract | fact:retract | retire/supersede | I dropped Spanish, switched to Italian in July |
| X08/1 | B 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| X08/2 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | I dropped Spanish, switched to Italian in July |
| X08/2 | B 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| X09/1 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | I live in Evanston, not Chicago |
| X09/2 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | I live in Evanston, not Chicago |
| X10/1 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | I'm a nurse, not a doctor |
| X10/1 | B 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| X10/2 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | I'm a nurse, not a doctor |
| X10/2 | B 🔒 | unrelated | unrelated (0.99) | - | - | none |  |
| X11/1 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | I'm divorced, we split up last year |
| X11/2 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | I'm divorced, we split up last year |
| X12/1 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | I eat fish and eggs, I'm pescatarian |
| X12/2 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | I eat fish and eggs, I'm pescatarian |
| X13/1 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | the exam got moved, it is 18 November now |
| X13/2 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | the exam got moved, it is 18 November now |
| X14/1 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | Maren moved to Porto in the spring |
| X14/2 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | Maren moved to Porto in the spring |
| X15/1 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | I'm off coffee entirely now, only tea |
| X15/1 | B | unrelated | unrelated (0.99) | - | - | none |  |
| X15/2 | A | contradicts | contradicts (0.95) | fact:retract | fact:retract | retire/supersede | I'm off coffee entirely now, only tea |
| X15/2 | B | unrelated | unrelated (0.99) | - | - | none |  |
| X16/1 | A 🔒 | contradicts | contradicts (0.98) | fact:retract | fact:retract | disputed (two-signal) | I'm pulling out of the half |
| X16/2 | A 🔒 | contradicts | contradicts (0.99) | fact:retract | fact:retract | disputed (two-signal) | I'm pulling out of the half |
| X17/1 | A | contradicts | contradicts (0.99) | thread:close | thread:close | retire/supersede | I went with the concert tickets, decision made |
| X17/2 | A | contradicts | contradicts (0.99) | thread:close | thread:close | retire/supersede | I went with the concert tickets, decision made |
| X18/1 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | Hikaru turned thirteen yesterday |
| X18/2 | A | contradicts | contradicts (0.99) | fact:update | fact:update | retire/supersede | Hikaru turned thirteen yesterday |
| X19/1 | A 🔒 | contradicts | contradicts (0.95) | fact:retract | fact:retract | disputed (two-signal) | I quit teaching, I start at the lab in January |
| X19/1 | B | unrelated | unrelated (0.99) | - | - | none |  |
| X19/2 | A 🔒 | contradicts | contradicts (0.95) | fact:retract | fact:retract | disputed (two-signal) | I quit teaching, I start at the lab in January |
| X19/2 | B | unrelated | unrelated (0.99) | - | - | none |  |
| X20/1 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | statistics actually clicked this week, I aced the quiz |
| X20/2 | A | contradicts | contradicts (0.95) | fact:update | fact:update | retire/supersede | statistics actually clicked this week, I aced the quiz |
