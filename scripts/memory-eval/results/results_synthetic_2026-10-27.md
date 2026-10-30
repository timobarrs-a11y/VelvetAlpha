# Memory retrieval eval — 2026-11-01T12:00:00.000Z

Engine: `supabase/functions/_shared/memoryEngine.ts` · SQL stage: mirror · eval: `scripts/memory-eval/synthetic/eval_retrieval_synthetic.json`  
Passed **121 / 157** · zero-tolerance violations: **18** {"inject_denied_fact":18}

| case | category | shift | pass | facts | threads | relevant | dup pairs | tokens | failures |
|---|---|---|---|---|---|---|---|---|---|
| A01 | direct recall | 0 | ✅ | 6 | 1 | 0 | 0 | 182 |  |
| A02 | old vs new / stale active row | 0 | ❌ | 7 | 1 | 1 | 0 | 196 | selected excluded 8be89adc "User lives in Portland" |
| A03 | denied fact | 0 | ✅ | 6 | 1 | 0 | 0 | 182 |  |
| A04 | denied fact / direct | 0 | ❌ | 7 | 1 | 1 | 0 | 195 | selected excluded 81853283 "User is a vegetarian"<br>**ZT:** inject_denied_fact:81853283 |
| A05 | global safety fact | 0 | ✅ | 6 | 1 | 0 | 0 | 182 |  |
| A06 | person recall | 0 | ✅ | 7 | 1 | 1 | 0 | 207 |  |
| A07 | reading recall | 0 | ✅ | 6 | 1 | 0 | 0 | 182 |  |
| A08 | preference | 0 | ✅ | 6 | 1 | 0 | 0 | 182 |  |
| A09 | expired temporary | 0 | ✅ | 6 | 1 | 0 | 0 | 182 |  |
| A10 | temporary still valid | 0 | ✅ | 6 | 1 | 0 | 0 | 182 |  |
| A11 | time-shifted: temporary expired | 45 | ✅ | 6 | 1 | 0 | 0 | 185 |  |
| A12 | nothing relevant | 0 | ✅ | 6 | 1 | 0 | 0 | 182 |  |
| A13 | greeting | 0 | ✅ | 6 | 1 | 0 | 0 | 182 |  |
| A14 | short reply needs previous turn | 0 | ✅ | 7 | 1 | 2 | 0 | 208 |  |
| A15 | thread recall | 0 | ✅ | 6 | 1 | 1 | 0 | 182 |  |
| A16 | cross-companion isolation | 0 | ✅ | 6 | 1 | 0 | 0 | 182 |  |
| A17 | preference | 0 | ❌ | 6 | 1 | 0 | 0 | 182 | missing 4b6d8355 |
| A18 | full dump / dedupe | 0 | ✅ | 6 | 1 | 0 | 0 | 182 |  |
| A19 | direct recall | 0 | ✅ | 6 | 2 | 0 | 0 | 203 |  |
| A20 | direct recall | 0 | ✅ | 7 | 2 | 1 | 0 | 219 |  |
| A21 | denied fact | 0 | ❌ | 6 | 2 | 0 | 0 | 198 | selected excluded 6fafc505 "User has hired a running coach"<br>**ZT:** inject_denied_fact:6fafc505 |
| A22 | expired temporary | 0 | ✅ | 6 | 2 | 0 | 0 | 203 |  |
| A23 | thread recall | 0 | ✅ | 6 | 2 | 1 | 0 | 203 |  |
| A24 | global reaches mentor | 0 | ✅ | 6 | 2 | 0 | 0 | 198 |  |
| A25 | cross-companion isolation | 0 | ✅ | 6 | 2 | 0 | 0 | 203 |  |
| A26 | time-shifted: race still ahead | 30 | ✅ | 6 | 2 | 0 | 0 | 203 |  |
| A27 | vague | 0 | ✅ | 6 | 2 | 0 | 0 | 203 |  |
| B01 | private scope visible to romantic | 0 | ✅ | 6 | 2 | 0 | 0 | 231 |  |
| B02 | person recall | 0 | ✅ | 6 | 2 | 1 | 0 | 231 |  |
| B03 | old vs new date | 0 | ✅ | 6 | 2 | 0 | 0 | 231 |  |
| B04 | temporary valid | 0 | ✅ | 6 | 2 | 0 | 0 | 227 |  |
| B05 | time-shifted: temporary expired | 45 | ✅ | 6 | 2 | 0 | 0 | 238 |  |
| B06 | expired temporary | 0 | ✅ | 6 | 2 | 0 | 0 | 222 |  |
| B07 | denied fact | 0 | ✅ | 6 | 2 | 0 | 0 | 231 |  |
| B08 | denied fact / direct | 0 | ❌ | 7 | 2 | 1 | 0 | 242 | selected excluded e57c4ad4 "User smokes"<br>**ZT:** inject_denied_fact:e57c4ad4 |
| B09 | thread recall | 0 | ✅ | 6 | 2 | 0 | 0 | 231 |  |
| B10 | inside joke | 0 | ✅ | 6 | 2 | 0 | 0 | 231 |  |
| B11 | cross-user isolation | 0 | ✅ | 6 | 2 | 0 | 0 | 231 |  |
| B12 | vague | 0 | ✅ | 6 | 2 | 0 | 0 | 231 |  |
| B13 | time-shifted: exam passed | 30 | ✅ | 6 | 2 | 0 | 0 | 222 |  |
| B14 | short reply | 0 | ✅ | 6 | 2 | 1 | 0 | 231 |  |
| B15 | full dump / dedupe | 0 | ✅ | 6 | 2 | 0 | 0 | 231 |  |
| C01 | old vs new | 0 | ✅ | 6 | 2 | 0 | 0 | 216 |  |
| C02 | direct recall | 0 | ✅ | 6 | 2 | 0 | 0 | 216 |  |
| C03 | person recall | 0 | ✅ | 6 | 2 | 0 | 0 | 216 |  |
| C04 | thread recall | 0 | ✅ | 6 | 2 | 0 | 0 | 216 |  |
| C05 | thread recall | 0 | ✅ | 6 | 2 | 1 | 0 | 216 |  |
| C06 | retired thread hidden | 0 | ✅ | 6 | 2 | 0 | 0 | 216 |  |
| C07 | denied global fact | 0 | ❌ | 6 | 2 | 0 | 0 | 216 | selected excluded 09da6e19 "User lives in Chicago"<br>**ZT:** inject_denied_fact:09da6e19 |
| C08 | dedupe | 0 | ✅ | 6 | 2 | 0 | 0 | 216 |  |
| C09 | denied fact / direct | 0 | ❌ | 6 | 1 | 2 | 0 | 168 | selected excluded 09da6e19 "User lives in Chicago"<br>**ZT:** inject_denied_fact:09da6e19 |
| C10 | person recall | 0 | ✅ | 5 | 1 | 0 | 0 | 154 |  |
| C11 | thread recall | 0 | ✅ | 5 | 1 | 0 | 0 | 154 |  |
| C12 | expired temporary | 0 | ✅ | 5 | 1 | 0 | 0 | 154 |  |
| C13 | direct recall | 0 | ✅ | 5 | 1 | 0 | 0 | 154 |  |
| C14 | cross-companion isolation | 0 | ✅ | 5 | 1 | 0 | 0 | 154 |  |
| C15 | vague | 0 | ✅ | 5 | 1 | 0 | 0 | 154 |  |
| C16 | time-shifted: still valid | 20 | ✅ | 5 | 1 | 0 | 0 | 154 |  |
| C17 | lexical miss | 0 | ✅ | 5 | 1 | 0 | 0 | 154 |  |
| E01 | direct recall | 0 | ✅ | 5 | 2 | 0 | 0 | 188 |  |
| E02 | temporary without expiry | 0 | ✅ | 5 | 2 | 0 | 0 | 188 |  |
| E03 | time-shifted: stale temporary | 45 | ❌ | 5 | 2 | 0 | 0 | 195 | selected excluded d712d2dd "User is currently resting a sprained right wrist a" |
| E04 | retired thread hidden, result visible | 0 | ✅ | 6 | 2 | 1 | 0 | 217 |  |
| E05 | thread recall | 0 | ✅ | 5 | 2 | 0 | 0 | 188 |  |
| E06 | identity | 0 | ✅ | 5 | 2 | 0 | 0 | 188 |  |
| E07 | private hidden from mentor | 0 | ✅ | 5 | 2 | 0 | 0 | 188 |  |
| E08 | private visible to partner | 0 | ✅ | 6 | 0 | 1 | 0 | 132 |  |
| E09 | temporary valid, private | 0 | ✅ | 6 | 0 | 0 | 0 | 132 |  |
| E10 | time-shifted: private temporary expired | 45 | ✅ | 5 | 0 | 0 | 0 | 110 |  |
| E11 | denied fact | 0 | ❌ | 6 | 0 | 0 | 0 | 132 | selected excluded 05d24d0e "User is vegan"<br>**ZT:** inject_denied_fact:05d24d0e |
| E12 | denied fact / direct | 0 | ❌ | 6 | 0 | 1 | 0 | 132 | selected excluded 05d24d0e "User is vegan"<br>**ZT:** inject_denied_fact:05d24d0e |
| E13 | direct recall | 0 | ✅ | 6 | 0 | 1 | 0 | 132 |  |
| E14 | cross-companion isolation | 0 | ✅ | 6 | 0 | 0 | 0 | 132 |  |
| E15 | vague | 0 | ❌ | 6 | 0 | 0 | 0 | 132 | selected excluded 05d24d0e "User is vegan"<br>**ZT:** inject_denied_fact:05d24d0e |
| F01 | global identity | 0 | ✅ | 6 | 1 | 0 | 0 | 181 |  |
| F02 | denied global fact | 0 | ✅ | 6 | 1 | 0 | 0 | 181 |  |
| F03 | denied global fact in other pair | 0 | ✅ | 6 | 1 | 0 | 0 | 190 |  |
| F04 | temporary valid | 0 | ✅ | 6 | 1 | 0 | 0 | 181 |  |
| F05 | time-shifted: temporary expired | 45 | ✅ | 6 | 1 | 0 | 0 | 182 |  |
| F06 | person recall | 0 | ✅ | 6 | 1 | 0 | 0 | 181 |  |
| F07 | thread recall | 0 | ✅ | 6 | 1 | 0 | 0 | 181 |  |
| F08 | preference | 0 | ✅ | 6 | 1 | 0 | 0 | 181 |  |
| F09 | old vs new | 0 | ✅ | 6 | 1 | 0 | 0 | 179 |  |
| F10 | thread recall | 0 | ✅ | 6 | 1 | 1 | 0 | 179 |  |
| F11 | direct recall | 0 | ✅ | 6 | 1 | 0 | 0 | 190 |  |
| F12 | direct recall | 0 | ✅ | 6 | 1 | 0 | 0 | 179 |  |
| F13 | cross-companion isolation | 0 | ✅ | 6 | 1 | 0 | 0 | 179 |  |
| F14 | vague | 0 | ❌ | 6 | 1 | 0 | 0 | 179 | selected excluded dc29db79 "User is a doctor"<br>**ZT:** inject_denied_fact:dc29db79 |
| F15 | time-shifted: deadline passed | 30 | ✅ | 6 | 1 | 0 | 0 | 179 |  |
| F16 | full dump / dedupe | 0 | ✅ | 6 | 1 | 0 | 0 | 181 |  |
| D01 | scale: old unique fact beyond the 500 newest | 0 | ✅ | 5 | 2 | 0 | 0 | 196 |  |
| D02 | scale: old identity fact | 0 | ❌ | 5 | 2 | 0 | 0 | 191 | missing d7a10579 |
| D03 | scale: old identity fact | 30 | ❌ | 5 | 2 | 0 | 0 | 206 | missing d9ab9b76 |
| D04 | temporary valid | 0 | ✅ | 5 | 2 | 0 | 0 | 205 |  |
| D05 | global safety fact | 0 | ❌ | 5 | 2 | 0 | 0 | 205 | missing 37c29055 |
| D06 | denied fact | 0 | ❌ | 5 | 2 | 0 | 0 | 205 | none of 3556aa9b selected |
| D07 | denied fact / direct | 0 | ❌ | 6 | 2 | 1 | 0 | 217 | missing 3556aa9b<br>selected excluded 8dcb2f23 "User is married"<br>**ZT:** inject_denied_fact:8dcb2f23 |
| D08 | direct recall | 0 | ✅ | 5 | 2 | 0 | 0 | 205 |  |
| D09 | expired temporary | 0 | ✅ | 5 | 2 | 0 | 0 | 205 |  |
| D10 | dedupe flood | 0 | ✅ | 8 | 2 | 3 | 0 | 260 |  |
| D11 | noise must not win | 0 | ❌ | 5 | 2 | 0 | 0 | 205 | missing e6cace90 |
| D12 | noise topic recall | 0 | ✅ | 5 | 2 | 0 | 0 | 192 |  |
| D13 | vague at scale | 0 | ✅ | 5 | 2 | 0 | 0 | 205 |  |
| D14 | thread recall | 0 | ✅ | 5 | 2 | 1 | 0 | 205 |  |
| D15 | cross-user isolation | 0 | ✅ | 5 | 2 | 0 | 0 | 205 |  |
| D16 | time-shifted: deadline passed | 30 | ✅ | 6 | 2 | 1 | 0 | 224 |  |
| D17 | scale: preference | 0 | ✅ | 6 | 2 | 1 | 0 | 227 |  |
| D18 | scale: identity under noise | 0 | ❌ | 5 | 2 | 0 | 0 | 205 | none of d7a10579/e6cace90/37c29055/d9ab9b76 selected |
| S01 | time-shifted: recent fact still recalled | 60 | ✅ | 6 | 1 | 0 | 0 | 185 |  |
| S02 | time-shifted: global fact | 60 | ❌ | 6 | 1 | 0 | 0 | 179 | selected excluded dc29db79 "User is a doctor"<br>**ZT:** inject_denied_fact:dc29db79 |
| S03 | time-shifted: denied stays denied | 90 | ❌ | 5 | 0 | 1 | 0 | 112 | selected excluded 05d24d0e "User is vegan"<br>**ZT:** inject_denied_fact:05d24d0e |
| S04 | time-shifted: expired stays hidden | 90 | ✅ | 5 | 1 | 0 | 0 | 154 |  |
| S05 | time-shifted: identity at scale | 90 | ❌ | 5 | 2 | 0 | 0 | 192 | missing d7a10579 |
| S06 | time-shifted: anniversary | 120 | ✅ | 6 | 2 | 0 | 0 | 222 |  |
| S07 | time-shifted: vague | 45 | ❌ | 6 | 2 | 0 | 0 | 195 | selected excluded 6fafc505 "User has hired a running coach"<br>**ZT:** inject_denied_fact:6fafc505 |
| S08 | time-shifted: person | 120 | ✅ | 5 | 1 | 0 | 0 | 154 |  |
| A28 | person recall | 0 | ❌ | 6 | 1 | 0 | 0 | 182 | missing 2508fcc0 |
| A29 | nothing relevant | 0 | ✅ | 6 | 1 | 0 | 0 | 182 |  |
| A30 | old vs new / lexical trap | 0 | ❌ | 7 | 1 | 1 | 0 | 196 | selected excluded 8be89adc "User lives in Portland" |
| A31 | time-shifted: expired stays hidden | 10 | ✅ | 6 | 1 | 0 | 0 | 184 |  |
| A32 | time-shifted: temporary still inside its window | 1 | ✅ | 6 | 1 | 0 | 0 | 182 |  |
| A33 | thread recall | 0 | ✅ | 6 | 2 | 1 | 0 | 203 |  |
| A34 | nothing relevant | 0 | ✅ | 6 | 2 | 0 | 0 | 203 |  |
| A35 | denied fact / lexical trap | 0 | ❌ | 6 | 2 | 0 | 0 | 196 | selected excluded 6fafc505 "User has hired a running coach"<br>**ZT:** inject_denied_fact:6fafc505 |
| B16 | person recall | 0 | ✅ | 6 | 2 | 0 | 0 | 221 |  |
| B17 | nothing relevant | 0 | ✅ | 6 | 2 | 0 | 0 | 231 |  |
| B18 | time-shifted: anniversary | 120 | ✅ | 6 | 2 | 0 | 0 | 222 |  |
| B19 | old vs new / lexical trap | 0 | ❌ | 7 | 2 | 1 | 0 | 251 | selected excluded 40499e23 "User plans to take the CPA exam in September" |
| B20 | thread recall | 0 | ✅ | 6 | 2 | 1 | 0 | 231 |  |
| C18 | direct recall | 0 | ✅ | 6 | 2 | 0 | 0 | 216 |  |
| C19 | retired thread hidden / vague | 0 | ❌ | 6 | 2 | 0 | 0 | 216 | selected excluded 09da6e19 "User lives in Chicago"<br>**ZT:** inject_denied_fact:09da6e19 |
| C20 | denied global fact / friend | 0 | ❌ | 6 | 1 | 1 | 0 | 168 | selected excluded 09da6e19 "User lives in Chicago"<br>**ZT:** inject_denied_fact:09da6e19 |
| C21 | time-shifted: dedupe | 60 | ✅ | 7 | 2 | 1 | 0 | 231 |  |
| C22 | lexical miss | 0 | ✅ | 5 | 1 | 0 | 0 | 154 |  |
| C23 | cross-user isolation | 0 | ✅ | 6 | 2 | 0 | 0 | 216 |  |
| E16 | thread recall | 0 | ✅ | 5 | 2 | 1 | 0 | 188 |  |
| E17 | direct recall | 0 | ✅ | 6 | 2 | 1 | 0 | 217 |  |
| E18 | time-shifted: thread past its date | 60 | ✅ | 5 | 2 | 0 | 0 | 190 |  |
| E19 | private hidden from mentor / lexical trap | 0 | ✅ | 5 | 2 | 0 | 0 | 188 |  |
| E20 | preference | 0 | ✅ | 6 | 0 | 1 | 0 | 132 |  |
| E21 | nothing relevant | 0 | ❌ | 6 | 0 | 0 | 0 | 132 | selected excluded 05d24d0e "User is vegan"<br>**ZT:** inject_denied_fact:05d24d0e |
| F17 | global reaches mentor | 0 | ✅ | 6 | 1 | 0 | 0 | 179 |  |
| F18 | temporary valid | 0 | ✅ | 6 | 1 | 0 | 0 | 181 |  |
| F19 | preference | 0 | ✅ | 6 | 1 | 0 | 0 | 181 |  |
| F20 | nothing relevant | 0 | ✅ | 6 | 1 | 0 | 0 | 181 |  |
| F21 | time-shifted: deadline still ahead | 90 | ✅ | 7 | 1 | 1 | 0 | 202 |  |
| F22 | denied fact / direct | 0 | ❌ | 7 | 1 | 1 | 0 | 193 | selected excluded dc29db79 "User is a doctor"<br>**ZT:** inject_denied_fact:dc29db79 |
| D19 | scale: oldest unique fact | 0 | ❌ | 5 | 2 | 0 | 0 | 205 | missing e6cace90 |
| D20 | scale: old global fact | 0 | ❌ | 5 | 2 | 0 | 0 | 205 | missing 37c29055 |
| D21 | scale: noise topic recall | 0 | ✅ | 12 | 2 | 7 | 0 | 442 |  |
| D22 | scale: thread recall | 0 | ✅ | 5 | 2 | 1 | 0 | 205 |  |
| D23 | scale: time-shifted dump | 30 | ❌ | 5 | 2 | 0 | 0 | 206 | none of d7a10579/e6cace90/37c29055/d9ab9b76 selected |
| D24 | time-shifted: temporary expired at scale | 10 | ❌ | 5 | 2 | 0 | 0 | 206 | missing d9ab9b76 |
| S09 | time-shifted: denied stays denied | 120 | ✅ | 6 | 1 | 0 | 0 | 185 |  |
| S10 | time-shifted: private stays hidden from mentor | 45 | ✅ | 5 | 2 | 0 | 0 | 190 |  |
| S11 | time-shifted: expired stays hidden | 60 | ✅ | 6 | 2 | 0 | 0 | 196 |  |
| S12 | time-shifted: scale identity | 120 | ❌ | 5 | 2 | 0 | 0 | 205 | missing e6cace90 |

## By category

| category | passed |
|---|---|
| direct recall | 12/12 |
| old vs new | 2/5 |
| denied fact | 2/12 |
| global safety fact | 1/2 |
| person recall | 6/7 |
| reading recall | 1/1 |
| preference | 4/5 |
| expired temporary | 5/5 |
| temporary still valid | 1/1 |
| time-shifted: temporary expired | 3/3 |
| nothing relevant | 5/6 |
| greeting | 1/1 |
| short reply needs previous turn | 1/1 |
| thread recall | 13/13 |
| cross-companion isolation | 5/5 |
| full dump | 3/3 |
| global reaches mentor | 2/2 |
| time-shifted: race still ahead | 1/1 |
| vague | 3/5 |
| private scope visible to romantic | 1/1 |
| old vs new date | 1/1 |
| temporary valid | 4/4 |
| inside joke | 1/1 |
| cross-user isolation | 3/3 |
| time-shifted: exam passed | 1/1 |
| short reply | 1/1 |
| retired thread hidden | 1/2 |
| denied global fact | 1/3 |
| dedupe | 1/1 |
| time-shifted: still valid | 1/1 |
| lexical miss | 2/2 |
| temporary without expiry | 1/1 |
| time-shifted: stale temporary | 0/1 |
| retired thread hidden, result visible | 1/1 |
| identity | 1/1 |
| private hidden from mentor | 2/2 |
| private visible to partner | 1/1 |
| temporary valid, private | 1/1 |
| time-shifted: private temporary expired | 1/1 |
| global identity | 1/1 |
| denied global fact in other pair | 1/1 |
| time-shifted: deadline passed | 2/2 |
| scale: old unique fact beyond the 500 newest | 1/1 |
| scale: old identity fact | 0/2 |
| dedupe flood | 1/1 |
| noise must not win | 0/1 |
| noise topic recall | 1/1 |
| vague at scale | 1/1 |
| scale: preference | 1/1 |
| scale: identity under noise | 0/1 |
| time-shifted: recent fact still recalled | 1/1 |
| time-shifted: global fact | 0/1 |
| time-shifted: denied stays denied | 1/2 |
| time-shifted: expired stays hidden | 3/3 |
| time-shifted: identity at scale | 0/1 |
| time-shifted: anniversary | 2/2 |
| time-shifted: vague | 0/1 |
| time-shifted: person | 1/1 |
| time-shifted: temporary still inside its window | 1/1 |
| time-shifted: dedupe | 1/1 |
| time-shifted: thread past its date | 1/1 |
| time-shifted: deadline still ahead | 1/1 |
| scale: oldest unique fact | 0/1 |
| scale: old global fact | 0/1 |
| scale: noise topic recall | 1/1 |
| scale: thread recall | 1/1 |
| scale: time-shifted dump | 0/1 |
| time-shifted: temporary expired at scale | 0/1 |
| time-shifted: private stays hidden from mentor | 1/1 |
| time-shifted: scale identity | 0/1 |

## What each turn injected

### A01 — "where do I work again?"

- • `03ccf01a` rel=0.071 score=0.352 — User works at Globex Health as a staff engineer, started in September
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A02 — "what part of town do I live in?"

- • `53651a48` rel=0.071 score=0.334 — User moved to Austin in August and lives near Zilker Park
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `8be89adc` rel=0.25 score=0.324 — User lives in Portland
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A03 — "any dinner ideas for tonight?"

- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A04 — "am I vegetarian?"

- • `81853283` rel=0.5 score=0.487 — User is a vegetarian
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0.125 score=0.353 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A05 — "we're going to a seafood place for the team dinner"

- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A06 — "how old is Biscuit now?"

- • `071824a6` rel=0.286 score=0.367 — User's dog is a beagle named Biscuit who is seven years old
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A07 — "which book am I on?"

- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `f6838e9e` rel=0.071 score=0.309 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A08 — "recommend me something to read next"

- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `f6838e9e` rel=0.071 score=0.309 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A09 — "how am I feeling today?"

- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A10 — "what do I have planned this weekend?"

- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A11 — "what do I have planned this weekend?" (asked 45 days later)

- • `2229cc03` rel=0 score=0.311 — User is allergic to shellfish
- • `03ccf01a` rel=0 score=0.282 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.276 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.259 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.208 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- • `071824a6` rel=0 score=0.2 — User's dog is a beagle named Biscuit who is seven years old
- 🧵 `54653b01` rel=0 score=0.215 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A12 — "what time zone is Tokyo in?"

- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0.063 score=0.323 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A13 — "morning!"

- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A14 — "Is Maren still coming in December? ⏎ yes, she is"

- • `2508fcc0` rel=0.286 score=0.351 — User's sister Maren lives in Lisbon and visits every December
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- 🧵 `54653b01` rel=0.25 score=0.426 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A15 — "did I ever hear back about Maren getting time off?"

- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0.5 score=0.564 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A16 — "how's my knee holding up?"

- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A17 — "coffee order for me?"

- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A18 — "what do you remember about me?"

- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A19 — "what's my race goal?"

- • `2e852f3a` rel=0 score=0.325 — User wants to run the Austin half marathon in February
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `afd37dbc` rel=0 score=0.295 — User is training on their own with a free plan, not with a coach
- • `096bdee1` rel=0 score=0.297 — User's current long run is 14 kilometres at about 5:40 per kilometre
- • `263d7520` rel=0 score=0.228 — User finds the on-call rotation at work exhausting
- • `bc351b59` rel=0 score=0.259 — User's left knee hurts after runs longer than 10 kilometres
- 🧵 `991ab119` rel=0 score=0.261 — Knee pain — User was going to book a physio appointment and report back
- 🧵 `d8a28b6d` rel=0 score=0.237 — Half-marathon training plan — User asked for a 12-week plan and wants to check in every Monday

### A20 — "how far was my last long run?"

- • `096bdee1` rel=0.25 score=0.434 — User's current long run is 14 kilometres at about 5:40 per kilometre
- • `2e852f3a` rel=0.083 score=0.37 — User wants to run the Austin half marathon in February
- • `6fafc505` rel=0.167 score=0.333 — User has hired a running coach
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `afd37dbc` rel=0 score=0.295 — User is training on their own with a free plan, not with a coach
- • `bc351b59` rel=0.071 score=0.298 — User's left knee hurts after runs longer than 10 kilometres
- • `263d7520` rel=0 score=0.228 — User finds the on-call rotation at work exhausting
- 🧵 `991ab119` rel=0 score=0.261 — Knee pain — User was going to book a physio appointment and report back
- 🧵 `d8a28b6d` rel=0 score=0.237 — Half-marathon training plan — User asked for a 12-week plan and wants to check in every Monday

### A21 — "should I ask my coach about the knee?"

- • `afd37dbc` rel=0.125 score=0.364 — User is training on their own with a free plan, not with a coach
- • `2e852f3a` rel=0 score=0.325 — User wants to run the Austin half marathon in February
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `6fafc505` rel=0.167 score=0.333 — User has hired a running coach
- • `bc351b59` rel=0.071 score=0.298 — User's left knee hurts after runs longer than 10 kilometres
- • `096bdee1` rel=0 score=0.297 — User's current long run is 14 kilometres at about 5:40 per kilometre
- 🧵 `991ab119` rel=0.063 score=0.296 — Knee pain — User was going to book a physio appointment and report back
- 🧵 `d8a28b6d` rel=0.042 score=0.26 — Half-marathon training plan — User asked for a 12-week plan and wants to check in every Monday

### A22 — "shoe advice?"

- • `2e852f3a` rel=0 score=0.325 — User wants to run the Austin half marathon in February
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `afd37dbc` rel=0 score=0.295 — User is training on their own with a free plan, not with a coach
- • `096bdee1` rel=0 score=0.297 — User's current long run is 14 kilometres at about 5:40 per kilometre
- • `263d7520` rel=0 score=0.228 — User finds the on-call rotation at work exhausting
- • `bc351b59` rel=0 score=0.259 — User's left knee hurts after runs longer than 10 kilometres
- 🧵 `991ab119` rel=0 score=0.261 — Knee pain — User was going to book a physio appointment and report back
- 🧵 `d8a28b6d` rel=0 score=0.237 — Half-marathon training plan — User asked for a 12-week plan and wants to check in every Monday

### A23 — "did I book that appointment?"

- • `2e852f3a` rel=0 score=0.325 — User wants to run the Austin half marathon in February
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `afd37dbc` rel=0 score=0.295 — User is training on their own with a free plan, not with a coach
- • `096bdee1` rel=0 score=0.297 — User's current long run is 14 kilometres at about 5:40 per kilometre
- • `263d7520` rel=0 score=0.228 — User finds the on-call rotation at work exhausting
- • `bc351b59` rel=0 score=0.259 — User's left knee hurts after runs longer than 10 kilometres
- 🧵 `991ab119` rel=0.25 score=0.399 — Knee pain — User was going to book a physio appointment and report back
- 🧵 `d8a28b6d` rel=0 score=0.237 — Half-marathon training plan — User asked for a 12-week plan and wants to check in every Monday

### A24 — "post-run recovery meal ideas?"

- • `2e852f3a` rel=0.083 score=0.37 — User wants to run the Austin half marathon in February
- • `6fafc505` rel=0.167 score=0.333 — User has hired a running coach
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `096bdee1` rel=0.063 score=0.331 — User's current long run is 14 kilometres at about 5:40 per kilometre
- • `afd37dbc` rel=0 score=0.295 — User is training on their own with a free plan, not with a coach
- • `bc351b59` rel=0.071 score=0.298 — User's left knee hurts after runs longer than 10 kilometres
- 🧵 `991ab119` rel=0 score=0.261 — Knee pain — User was going to book a physio appointment and report back
- 🧵 `d8a28b6d` rel=0 score=0.237 — Half-marathon training plan — User asked for a 12-week plan and wants to check in every Monday

### A25 — "what is my dog called?"

- • `2e852f3a` rel=0 score=0.325 — User wants to run the Austin half marathon in February
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `afd37dbc` rel=0 score=0.295 — User is training on their own with a free plan, not with a coach
- • `263d7520` rel=0.083 score=0.274 — User finds the on-call rotation at work exhausting
- • `096bdee1` rel=0 score=0.297 — User's current long run is 14 kilometres at about 5:40 per kilometre
- • `bc351b59` rel=0 score=0.259 — User's left knee hurts after runs longer than 10 kilometres
- 🧵 `991ab119` rel=0 score=0.261 — Knee pain — User was going to book a physio appointment and report back
- 🧵 `d8a28b6d` rel=0 score=0.237 — Half-marathon training plan — User asked for a 12-week plan and wants to check in every Monday

### A26 — "how many weeks until the half?" (asked 30 days later)

- • `2e852f3a` rel=0.083 score=0.341 — User wants to run the Austin half marathon in February
- • `2229cc03` rel=0 score=0.313 — User is allergic to shellfish
- • `afd37dbc` rel=0 score=0.26 — User is training on their own with a free plan, not with a coach
- • `096bdee1` rel=0 score=0.236 — User's current long run is 14 kilometres at about 5:40 per kilometre
- • `263d7520` rel=0 score=0.202 — User finds the on-call rotation at work exhausting
- • `bc351b59` rel=0 score=0.217 — User's left knee hurts after runs longer than 10 kilometres
- 🧵 `d8a28b6d` rel=0.167 score=0.298 — Half-marathon training plan — User asked for a 12-week plan and wants to check in every Monday
- 🧵 `991ab119` rel=0 score=0.218 — Knee pain — User was going to book a physio appointment and report back

### A27 — "ugh"

- • `2e852f3a` rel=0 score=0.325 — User wants to run the Austin half marathon in February
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `afd37dbc` rel=0 score=0.295 — User is training on their own with a free plan, not with a coach
- • `096bdee1` rel=0 score=0.297 — User's current long run is 14 kilometres at about 5:40 per kilometre
- • `263d7520` rel=0 score=0.228 — User finds the on-call rotation at work exhausting
- • `bc351b59` rel=0 score=0.259 — User's left knee hurts after runs longer than 10 kilometres
- 🧵 `991ab119` rel=0 score=0.261 — Knee pain — User was going to book a physio appointment and report back
- 🧵 `d8a28b6d` rel=0 score=0.237 — Half-marathon training plan — User asked for a 12-week plan and wants to check in every Monday

### B01 — "remind me when our anniversary is"

- • `b6b5a243` rel=0.125 score=0.36 — User and Jordan's anniversary is on 14 March
- • `5379e8b1` rel=0 score=0.34 — User is studying for the CPA exam scheduled for 18 November
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `def93b33` rel=0 score=0.296 — User quit smoking two years ago and has not smoked since
- • `d8e71181` rel=0 score=0.31 — User's partner is named Jordan and they have been together for three years
- • `27f80bb4` rel=0 score=0.222 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- 🧵 `5f199c79` rel=0 score=0.294 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.254 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B02 — "how long have Jordan and I been together?"

- • `d8e71181` rel=0.333 score=0.493 — User's partner is named Jordan and they have been together for three years
- • `5379e8b1` rel=0 score=0.34 — User is studying for the CPA exam scheduled for 18 November
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `b6b5a243` rel=0.125 score=0.36 — User and Jordan's anniversary is on 14 March
- • `def93b33` rel=0 score=0.296 — User quit smoking two years ago and has not smoked since
- • `27f80bb4` rel=0 score=0.222 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- 🧵 `5f199c79` rel=0.063 score=0.328 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.254 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B03 — "when is my exam?"

- • `5379e8b1` rel=0.083 score=0.386 — User is studying for the CPA exam scheduled for 18 November
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `d8e71181` rel=0 score=0.31 — User's partner is named Jordan and they have been together for three years
- • `def93b33` rel=0 score=0.296 — User quit smoking two years ago and has not smoked since
- • `b6b5a243` rel=0 score=0.291 — User and Jordan's anniversary is on 14 March
- • `27f80bb4` rel=0 score=0.222 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- 🧵 `5f199c79` rel=0 score=0.294 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0.05 score=0.281 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B04 — "what should I cook for everyone?"

- • `5379e8b1` rel=0 score=0.34 — User is studying for the CPA exam scheduled for 18 November
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `d8e71181` rel=0 score=0.31 — User's partner is named Jordan and they have been together for three years
- • `def93b33` rel=0 score=0.296 — User quit smoking two years ago and has not smoked since
- • `b6b5a243` rel=0 score=0.291 — User and Jordan's anniversary is on 14 March
- • `6a81bb6a` rel=0.063 score=0.23 — User loves cooking Thai food and makes a green curry most Sundays
- 🧵 `5f199c79` rel=0 score=0.294 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.254 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B05 — "what should I cook for everyone?" (asked 45 days later)

- • `d8e71181` rel=0 score=0.307 — User's partner is named Jordan and they have been together for three years
- • `5379e8b1` rel=0 score=0.292 — User is studying for the CPA exam scheduled for 18 November
- • `def93b33` rel=0 score=0.276 — User quit smoking two years ago and has not smoked since
- • `b6b5a243` rel=0 score=0.287 — User and Jordan's anniversary is on 14 March
- • `6a81bb6a` rel=0.063 score=0.217 — User loves cooking Thai food and makes a green curry most Sundays
- • `27f80bb4` rel=0 score=0.192 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- 🧵 `5f199c79` rel=0 score=0.217 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.203 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B06 — "feeling lazy, skip the gym?"

- • `5379e8b1` rel=0 score=0.34 — User is studying for the CPA exam scheduled for 18 November
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `d8e71181` rel=0 score=0.31 — User's partner is named Jordan and they have been together for three years
- • `def93b33` rel=0 score=0.296 — User quit smoking two years ago and has not smoked since
- • `b6b5a243` rel=0 score=0.291 — User and Jordan's anniversary is on 14 March
- • `3770788a` rel=0.083 score=0.24 — User goes to a boxing gym on Tuesday and Thursday evenings
- 🧵 `5f199c79` rel=0 score=0.294 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.254 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B07 — "stressful day, I need a vice"

- • `5379e8b1` rel=0 score=0.34 — User is studying for the CPA exam scheduled for 18 November
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `d8e71181` rel=0 score=0.31 — User's partner is named Jordan and they have been together for three years
- • `27f80bb4` rel=0.071 score=0.262 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- • `def93b33` rel=0 score=0.296 — User quit smoking two years ago and has not smoked since
- • `b6b5a243` rel=0 score=0.291 — User and Jordan's anniversary is on 14 March
- 🧵 `5f199c79` rel=0 score=0.294 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.254 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B08 — "do I smoke?"

- • `e57c4ad4` rel=0.5 score=0.48 — User smokes
- • `def93b33` rel=0.083 score=0.342 — User quit smoking two years ago and has not smoked since
- • `5379e8b1` rel=0 score=0.34 — User is studying for the CPA exam scheduled for 18 November
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `b6b5a243` rel=0 score=0.291 — User and Jordan's anniversary is on 14 March
- • `d8e71181` rel=0 score=0.31 — User's partner is named Jordan and they have been together for three years
- • `27f80bb4` rel=0 score=0.222 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- 🧵 `5f199c79` rel=0 score=0.294 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.254 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B09 — "still cannot decide on the present"

- • `5379e8b1` rel=0 score=0.34 — User is studying for the CPA exam scheduled for 18 November
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `d8e71181` rel=0 score=0.31 — User's partner is named Jordan and they have been together for three years
- • `def93b33` rel=0 score=0.296 — User quit smoking two years ago and has not smoked since
- • `b6b5a243` rel=0 score=0.291 — User and Jordan's anniversary is on 14 March
- • `27f80bb4` rel=0 score=0.222 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- 🧵 `5f199c79` rel=0.063 score=0.328 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.254 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B10 — "it is Monday again"

- • `5379e8b1` rel=0 score=0.34 — User is studying for the CPA exam scheduled for 18 November
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `d8e71181` rel=0 score=0.31 — User's partner is named Jordan and they have been together for three years
- • `27f80bb4` rel=0.071 score=0.262 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- • `def93b33` rel=0 score=0.296 — User quit smoking two years ago and has not smoked since
- • `b6b5a243` rel=0 score=0.291 — User and Jordan's anniversary is on 14 March
- 🧵 `5f199c79` rel=0 score=0.294 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.254 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B11 — "am I allergic to anything?"

- • `5379e8b1` rel=0 score=0.34 — User is studying for the CPA exam scheduled for 18 November
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `d8e71181` rel=0 score=0.31 — User's partner is named Jordan and they have been together for three years
- • `def93b33` rel=0 score=0.296 — User quit smoking two years ago and has not smoked since
- • `b6b5a243` rel=0 score=0.291 — User and Jordan's anniversary is on 14 March
- • `27f80bb4` rel=0 score=0.222 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- 🧵 `5f199c79` rel=0 score=0.294 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.254 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B12 — "hey you"

- • `5379e8b1` rel=0 score=0.34 — User is studying for the CPA exam scheduled for 18 November
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `d8e71181` rel=0 score=0.31 — User's partner is named Jordan and they have been together for three years
- • `def93b33` rel=0 score=0.296 — User quit smoking two years ago and has not smoked since
- • `b6b5a243` rel=0 score=0.291 — User and Jordan's anniversary is on 14 March
- • `27f80bb4` rel=0 score=0.222 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- 🧵 `5f199c79` rel=0 score=0.294 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.254 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B13 — "what was I so stressed about last month?" (asked 30 days later)

- • `d8e71181` rel=0 score=0.307 — User's partner is named Jordan and they have been together for three years
- • `5379e8b1` rel=0 score=0.303 — User is studying for the CPA exam scheduled for 18 November
- • `def93b33` rel=0 score=0.281 — User quit smoking two years ago and has not smoked since
- • `b6b5a243` rel=0 score=0.288 — User and Jordan's anniversary is on 14 March
- • `27f80bb4` rel=0 score=0.199 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- • `e57c4ad4` rel=0 score=0.19 — User smokes
- 🧵 `5f199c79` rel=0 score=0.235 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.214 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B14 — "Which section of the CPA worries you most? ⏎ the audit part"

- • `5379e8b1` rel=0.083 score=0.386 — User is studying for the CPA exam scheduled for 18 November
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `d8e71181` rel=0 score=0.31 — User's partner is named Jordan and they have been together for three years
- • `def93b33` rel=0 score=0.296 — User quit smoking two years ago and has not smoked since
- • `b6b5a243` rel=0 score=0.291 — User and Jordan's anniversary is on 14 March
- • `27f80bb4` rel=0 score=0.222 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- 🧵 `e2f97e21` rel=0.3 score=0.419 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November
- 🧵 `5f199c79` rel=0 score=0.294 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday

### B15 — "tell me everything you know about me"

- • `5379e8b1` rel=0 score=0.34 — User is studying for the CPA exam scheduled for 18 November
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `d8e71181` rel=0 score=0.31 — User's partner is named Jordan and they have been together for three years
- • `def93b33` rel=0 score=0.296 — User quit smoking two years ago and has not smoked since
- • `b6b5a243` rel=0 score=0.291 — User and Jordan's anniversary is on 14 March
- • `27f80bb4` rel=0 score=0.222 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- 🧵 `5f199c79` rel=0 score=0.294 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.254 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### C01 — "how is my language practice going?"

- • `0b1fee50` rel=0 score=0.308 — User is the founder of a two-person startup building scheduling software for dental clinics
- • `2432bec8` rel=0 score=0.281 — User is raising a pre-seed round and has talked to six investors
- • `683b9025` rel=0 score=0.26 — User switched from Spanish to Italian in July because of a planned move to Bologna
- • `482399c6` rel=0 score=0.259 — User is working toward ten clinic customers by spring
- • `09da6e19` rel=0 score=0.184 — User lives in Chicago
- • `009cf485` rel=0 score=0.18 — User's co-founder is Tomas, who handles sales
- 🧵 `6812411b` rel=0 score=0.306 — Pre-seed round — User has a second meeting with Harbor Ventures next week and wants to rehearse the pitch
- 🧵 `de7d1ac5` rel=0 score=0.269 — First hire — User is deciding whether to hire a designer or a second engineer first

### C02 — "how many investors have I pitched?"

- • `2432bec8` rel=0.063 score=0.315 — User is raising a pre-seed round and has talked to six investors
- • `0b1fee50` rel=0 score=0.308 — User is the founder of a two-person startup building scheduling software for dental clinics
- • `683b9025` rel=0 score=0.26 — User switched from Spanish to Italian in July because of a planned move to Bologna
- • `482399c6` rel=0 score=0.259 — User is working toward ten clinic customers by spring
- • `09da6e19` rel=0 score=0.184 — User lives in Chicago
- • `009cf485` rel=0 score=0.18 — User's co-founder is Tomas, who handles sales
- 🧵 `6812411b` rel=0.038 score=0.327 — Pre-seed round — User has a second meeting with Harbor Ventures next week and wants to rehearse the pitch
- 🧵 `de7d1ac5` rel=0 score=0.269 — First hire — User is deciding whether to hire a designer or a second engineer first

### C03 — "who does sales at my company?"

- • `0b1fee50` rel=0 score=0.308 — User is the founder of a two-person startup building scheduling software for dental clinics
- • `2432bec8` rel=0 score=0.281 — User is raising a pre-seed round and has talked to six investors
- • `683b9025` rel=0 score=0.26 — User switched from Spanish to Italian in July because of a planned move to Bologna
- • `482399c6` rel=0 score=0.259 — User is working toward ten clinic customers by spring
- • `009cf485` rel=0.083 score=0.226 — User's co-founder is Tomas, who handles sales
- • `09da6e19` rel=0 score=0.184 — User lives in Chicago
- 🧵 `6812411b` rel=0 score=0.306 — Pre-seed round — User has a second meeting with Harbor Ventures next week and wants to rehearse the pitch
- 🧵 `de7d1ac5` rel=0 score=0.269 — First hire — User is deciding whether to hire a designer or a second engineer first

### C04 — "can we rehearse for Harbor?"

- • `0b1fee50` rel=0 score=0.308 — User is the founder of a two-person startup building scheduling software for dental clinics
- • `2432bec8` rel=0 score=0.281 — User is raising a pre-seed round and has talked to six investors
- • `683b9025` rel=0 score=0.26 — User switched from Spanish to Italian in July because of a planned move to Bologna
- • `482399c6` rel=0 score=0.259 — User is working toward ten clinic customers by spring
- • `09da6e19` rel=0 score=0.184 — User lives in Chicago
- • `009cf485` rel=0 score=0.18 — User's co-founder is Tomas, who handles sales
- 🧵 `6812411b` rel=0.154 score=0.39 — Pre-seed round — User has a second meeting with Harbor Ventures next week and wants to rehearse the pitch
- 🧵 `de7d1ac5` rel=0 score=0.269 — First hire — User is deciding whether to hire a designer or a second engineer first

### C05 — "designer or engineer, what did I say?"

- • `0b1fee50` rel=0 score=0.308 — User is the founder of a two-person startup building scheduling software for dental clinics
- • `2432bec8` rel=0 score=0.281 — User is raising a pre-seed round and has talked to six investors
- • `683b9025` rel=0 score=0.26 — User switched from Spanish to Italian in July because of a planned move to Bologna
- • `482399c6` rel=0 score=0.259 — User is working toward ten clinic customers by spring
- • `09da6e19` rel=0 score=0.184 — User lives in Chicago
- • `009cf485` rel=0 score=0.18 — User's co-founder is Tomas, who handles sales
- 🧵 `de7d1ac5` rel=0.286 score=0.427 — First hire — User is deciding whether to hire a designer or a second engineer first
- 🧵 `6812411b` rel=0 score=0.306 — Pre-seed round — User has a second meeting with Harbor Ventures next week and wants to rehearse the pitch

### C06 — "how is the deck coming along?"

- • `0b1fee50` rel=0 score=0.308 — User is the founder of a two-person startup building scheduling software for dental clinics
- • `2432bec8` rel=0 score=0.281 — User is raising a pre-seed round and has talked to six investors
- • `683b9025` rel=0 score=0.26 — User switched from Spanish to Italian in July because of a planned move to Bologna
- • `482399c6` rel=0 score=0.259 — User is working toward ten clinic customers by spring
- • `09da6e19` rel=0 score=0.184 — User lives in Chicago
- • `009cf485` rel=0 score=0.18 — User's co-founder is Tomas, who handles sales
- 🧵 `6812411b` rel=0 score=0.306 — Pre-seed round — User has a second meeting with Harbor Ventures next week and wants to rehearse the pitch
- 🧵 `de7d1ac5` rel=0 score=0.269 — First hire — User is deciding whether to hire a designer or a second engineer first

### C07 — "any coworking spaces you know of near me?"

- • `0b1fee50` rel=0 score=0.308 — User is the founder of a two-person startup building scheduling software for dental clinics
- • `2432bec8` rel=0 score=0.281 — User is raising a pre-seed round and has talked to six investors
- • `683b9025` rel=0 score=0.26 — User switched from Spanish to Italian in July because of a planned move to Bologna
- • `482399c6` rel=0 score=0.259 — User is working toward ten clinic customers by spring
- • `09da6e19` rel=0 score=0.184 — User lives in Chicago
- • `009cf485` rel=0 score=0.18 — User's co-founder is Tomas, who handles sales
- 🧵 `6812411b` rel=0 score=0.306 — Pre-seed round — User has a second meeting with Harbor Ventures next week and wants to rehearse the pitch
- 🧵 `de7d1ac5` rel=0 score=0.269 — First hire — User is deciding whether to hire a designer or a second engineer first

### C08 — "what is my customer target?"

- • `0b1fee50` rel=0 score=0.308 — User is the founder of a two-person startup building scheduling software for dental clinics
- • `2432bec8` rel=0 score=0.281 — User is raising a pre-seed round and has talked to six investors
- • `482399c6` rel=0.083 score=0.305 — User is working toward ten clinic customers by spring
- • `683b9025` rel=0 score=0.26 — User switched from Spanish to Italian in July because of a planned move to Bologna
- • `09da6e19` rel=0 score=0.184 — User lives in Chicago
- • `009cf485` rel=0 score=0.18 — User's co-founder is Tomas, who handles sales
- 🧵 `6812411b` rel=0 score=0.306 — Pre-seed round — User has a second meeting with Harbor Ventures next week and wants to rehearse the pitch
- 🧵 `de7d1ac5` rel=0 score=0.269 — First hire — User is deciding whether to hire a designer or a second engineer first

### C09 — "do I live in Chicago?"

- • `09da6e19` rel=1 score=0.734 — User lives in Chicago
- • `263cf272` rel=0.333 score=0.418 — User lives in Evanston, not Chicago, and commutes in twice a week
- • `12322239` rel=0 score=0.292 — User's birthday is 2 December
- • `3953c0fc` rel=0 score=0.202 — User listens to history podcasts on the train
- • `302fefa8` rel=0 score=0.181 — User's younger sister Priya is a nurse in Milwaukee
- • `a00476ea` rel=0 score=0.194 — User bouldering twice a week and prefers it to running
- 🧵 `a47b15eb` rel=0 score=0.284 — Priya's exam — Priya sits her nurse practitioner exam in November and User wants to send her something

### C10 — "what does my sister do?"

- • `12322239` rel=0 score=0.292 — User's birthday is 2 December
- • `302fefa8` rel=0.1 score=0.236 — User's younger sister Priya is a nurse in Milwaukee
- • `263cf272` rel=0 score=0.235 — User lives in Evanston, not Chicago, and commutes in twice a week
- • `3953c0fc` rel=0 score=0.202 — User listens to history podcasts on the train
- • `a00476ea` rel=0 score=0.194 — User bouldering twice a week and prefers it to running
- 🧵 `a47b15eb` rel=0 score=0.284 — Priya's exam — Priya sits her nurse practitioner exam in November and User wants to send her something

### C11 — "what should I get Priya?"

- • `12322239` rel=0 score=0.292 — User's birthday is 2 December
- • `302fefa8` rel=0.1 score=0.236 — User's younger sister Priya is a nurse in Milwaukee
- • `263cf272` rel=0 score=0.235 — User lives in Evanston, not Chicago, and commutes in twice a week
- • `3953c0fc` rel=0 score=0.202 — User listens to history podcasts on the train
- • `a00476ea` rel=0 score=0.194 — User bouldering twice a week and prefers it to running
- 🧵 `a47b15eb` rel=0.056 score=0.314 — Priya's exam — Priya sits her nurse practitioner exam in November and User wants to send her something

### C12 — "fancy a climb this week?"

- • `12322239` rel=0 score=0.292 — User's birthday is 2 December
- • `263cf272` rel=0.083 score=0.281 — User lives in Evanston, not Chicago, and commutes in twice a week
- • `3953c0fc` rel=0 score=0.202 — User listens to history podcasts on the train
- • `302fefa8` rel=0 score=0.181 — User's younger sister Priya is a nurse in Milwaukee
- • `a00476ea` rel=0.1 score=0.249 — User bouldering twice a week and prefers it to running
- 🧵 `a47b15eb` rel=0 score=0.284 — Priya's exam — Priya sits her nurse practitioner exam in November and User wants to send her something

### C13 — "when is my birthday?"

- • `12322239` rel=0.167 score=0.384 — User's birthday is 2 December
- • `263cf272` rel=0 score=0.235 — User lives in Evanston, not Chicago, and commutes in twice a week
- • `3953c0fc` rel=0 score=0.202 — User listens to history podcasts on the train
- • `302fefa8` rel=0 score=0.181 — User's younger sister Priya is a nurse in Milwaukee
- • `a00476ea` rel=0 score=0.194 — User bouldering twice a week and prefers it to running
- 🧵 `a47b15eb` rel=0 score=0.284 — Priya's exam — Priya sits her nurse practitioner exam in November and User wants to send her something

### C14 — "how is fundraising going?"

- • `12322239` rel=0 score=0.292 — User's birthday is 2 December
- • `263cf272` rel=0 score=0.235 — User lives in Evanston, not Chicago, and commutes in twice a week
- • `3953c0fc` rel=0 score=0.202 — User listens to history podcasts on the train
- • `302fefa8` rel=0 score=0.181 — User's younger sister Priya is a nurse in Milwaukee
- • `a00476ea` rel=0 score=0.194 — User bouldering twice a week and prefers it to running
- 🧵 `a47b15eb` rel=0 score=0.284 — Priya's exam — Priya sits her nurse practitioner exam in November and User wants to send her something

### C15 — "lol"

- • `12322239` rel=0 score=0.292 — User's birthday is 2 December
- • `263cf272` rel=0 score=0.235 — User lives in Evanston, not Chicago, and commutes in twice a week
- • `3953c0fc` rel=0 score=0.202 — User listens to history podcasts on the train
- • `302fefa8` rel=0 score=0.181 — User's younger sister Priya is a nurse in Milwaukee
- • `a00476ea` rel=0 score=0.194 — User bouldering twice a week and prefers it to running
- 🧵 `a47b15eb` rel=0 score=0.284 — Priya's exam — Priya sits her nurse practitioner exam in November and User wants to send her something

### C16 — "birthday plans?" (asked 20 days later)

- • `12322239` rel=0.167 score=0.381 — User's birthday is 2 December
- • `263cf272` rel=0 score=0.231 — User lives in Evanston, not Chicago, and commutes in twice a week
- • `3953c0fc` rel=0 score=0.192 — User listens to history podcasts on the train
- • `302fefa8` rel=0 score=0.179 — User's younger sister Priya is a nurse in Milwaukee
- • `a00476ea` rel=0 score=0.187 — User bouldering twice a week and prefers it to running
- 🧵 `a47b15eb` rel=0 score=0.243 — Priya's exam — Priya sits her nurse practitioner exam in November and User wants to send her something

### C17 — "anything good on my commute lately?"

- • `12322239` rel=0 score=0.292 — User's birthday is 2 December
- • `263cf272` rel=0.083 score=0.281 — User lives in Evanston, not Chicago, and commutes in twice a week
- • `3953c0fc` rel=0 score=0.202 — User listens to history podcasts on the train
- • `302fefa8` rel=0 score=0.181 — User's younger sister Priya is a nurse in Milwaukee
- • `a00476ea` rel=0 score=0.194 — User bouldering twice a week and prefers it to running
- 🧵 `a47b15eb` rel=0 score=0.284 — Priya's exam — Priya sits her nurse practitioner exam in November and User wants to send her something

### E01 — "which song am I working on?"

- • `6ab9a4ef` rel=0 score=0.36 — User was offered the department head role and accepted it, starting in January
- • `d712d2dd` rel=0 score=0.318 — User is currently resting a sprained right wrist and cannot practise
- • `8063381a` rel=0 score=0.289 — User's book club is reading 'Piranesi' this month
- • `e4c2c4a8` rel=0 score=0.286 — User is a high-school chemistry teacher
- • `2ab8cbeb` rel=0 score=0.285 — User wants to play 'Blackbird' cleanly by New Year
- 🧵 `71038f34` rel=0 score=0.274 — Student recital — User is organising the school's winter recital on 12 December
- 🧵 `5fc2eae2` rel=0 score=0.269 — Blackbird progress — User can play the first half and wanted to check in after learning the bridge

### E02 — "can I practise today?"

- • `6ab9a4ef` rel=0 score=0.36 — User was offered the department head role and accepted it, starting in January
- • `d712d2dd` rel=0.071 score=0.358 — User is currently resting a sprained right wrist and cannot practise
- • `8063381a` rel=0 score=0.289 — User's book club is reading 'Piranesi' this month
- • `e4c2c4a8` rel=0 score=0.286 — User is a high-school chemistry teacher
- • `2ab8cbeb` rel=0 score=0.285 — User wants to play 'Blackbird' cleanly by New Year
- 🧵 `71038f34` rel=0 score=0.274 — Student recital — User is organising the school's winter recital on 12 December
- 🧵 `5fc2eae2` rel=0 score=0.269 — Blackbird progress — User can play the first half and wanted to check in after learning the bridge

### E03 — "can I practise today?" (asked 45 days later)

- • `6ab9a4ef` rel=0 score=0.312 — User was offered the department head role and accepted it, starting in January
- • `0d7843b8` rel=0.071 score=0.293 — User is learning fingerstyle guitar and practises 30 minutes a day
- • `e4c2c4a8` rel=0 score=0.286 — User is a high-school chemistry teacher
- • `2ab8cbeb` rel=0 score=0.246 — User wants to play 'Blackbird' cleanly by New Year
- • `d712d2dd` rel=0.071 score=0.265 — User is currently resting a sprained right wrist and cannot practise
- 🧵 `71038f34` rel=0 score=0.21 — Student recital — User is organising the school's winter recital on 12 December
- 🧵 `5fc2eae2` rel=0 score=0.208 — Blackbird progress — User can play the first half and wanted to check in after learning the bridge

### E04 — "any news on the department head thing?"

- • `6ab9a4ef` rel=0.286 score=0.517 — User was offered the department head role and accepted it, starting in January
- • `d712d2dd` rel=0 score=0.318 — User is currently resting a sprained right wrist and cannot practise
- • `8063381a` rel=0 score=0.289 — User's book club is reading 'Piranesi' this month
- • `e4c2c4a8` rel=0 score=0.286 — User is a high-school chemistry teacher
- • `2ab8cbeb` rel=0 score=0.285 — User wants to play 'Blackbird' cleanly by New Year
- • `0d7843b8` rel=0 score=0.269 — User is learning fingerstyle guitar and practises 30 minutes a day
- 🧵 `71038f34` rel=0 score=0.274 — Student recital — User is organising the school's winter recital on 12 December
- 🧵 `5fc2eae2` rel=0 score=0.269 — Blackbird progress — User can play the first half and wanted to check in after learning the bridge

### E05 — "recital planning is stressing me out"

- • `6ab9a4ef` rel=0 score=0.36 — User was offered the department head role and accepted it, starting in January
- • `d712d2dd` rel=0 score=0.318 — User is currently resting a sprained right wrist and cannot practise
- • `8063381a` rel=0 score=0.289 — User's book club is reading 'Piranesi' this month
- • `e4c2c4a8` rel=0 score=0.286 — User is a high-school chemistry teacher
- • `2ab8cbeb` rel=0 score=0.285 — User wants to play 'Blackbird' cleanly by New Year
- 🧵 `71038f34` rel=0.071 score=0.313 — Student recital — User is organising the school's winter recital on 12 December
- 🧵 `5fc2eae2` rel=0 score=0.269 — Blackbird progress — User can play the first half and wanted to check in after learning the bridge

### E06 — "what do I do for a living?"

- • `6ab9a4ef` rel=0 score=0.36 — User was offered the department head role and accepted it, starting in January
- • `d712d2dd` rel=0 score=0.318 — User is currently resting a sprained right wrist and cannot practise
- • `8063381a` rel=0 score=0.289 — User's book club is reading 'Piranesi' this month
- • `e4c2c4a8` rel=0 score=0.286 — User is a high-school chemistry teacher
- • `2ab8cbeb` rel=0 score=0.285 — User wants to play 'Blackbird' cleanly by New Year
- 🧵 `71038f34` rel=0 score=0.274 — Student recital — User is organising the school's winter recital on 12 December
- 🧵 `5fc2eae2` rel=0 score=0.269 — Blackbird progress — User can play the first half and wanted to check in after learning the bridge

### E07 — "how is Sam?"

- • `6ab9a4ef` rel=0 score=0.36 — User was offered the department head role and accepted it, starting in January
- • `d712d2dd` rel=0 score=0.318 — User is currently resting a sprained right wrist and cannot practise
- • `8063381a` rel=0 score=0.289 — User's book club is reading 'Piranesi' this month
- • `e4c2c4a8` rel=0 score=0.286 — User is a high-school chemistry teacher
- • `2ab8cbeb` rel=0 score=0.285 — User wants to play 'Blackbird' cleanly by New Year
- 🧵 `71038f34` rel=0 score=0.274 — Student recital — User is organising the school's winter recital on 12 December
- 🧵 `5fc2eae2` rel=0 score=0.269 — Blackbird progress — User can play the first half and wanted to check in after learning the bridge

### E08 — "what hours does Sam work?"

- • `4a4ac9ab` rel=0.333 score=0.498 — User's girlfriend Sam is a paramedic who works night shifts
- • `7e90091a` rel=0.125 score=0.368 — User and Sam argued about moving in together
- • `eca1f44b` rel=0.1 score=0.356 — User and Sam are going to Lisbon for a week in March
- • `b854d154` rel=0 score=0.255 — User eats fish and eggs; they are pescatarian, not vegan
- • `eb1997d6` rel=0 score=0.19 — User makes pancakes every Sunday morning
- • `05d24d0e` rel=0 score=0.205 — User is vegan

### E09 — "things are tense at home"

- • `4a4ac9ab` rel=0 score=0.314 — User's girlfriend Sam is a paramedic who works night shifts
- • `eca1f44b` rel=0 score=0.301 — User and Sam are going to Lisbon for a week in March
- • `b854d154` rel=0 score=0.255 — User eats fish and eggs; they are pescatarian, not vegan
- • `7e90091a` rel=0 score=0.3 — User and Sam argued about moving in together
- • `eb1997d6` rel=0 score=0.19 — User makes pancakes every Sunday morning
- • `05d24d0e` rel=0 score=0.205 — User is vegan

### E10 — "things are tense at home" (asked 45 days later)

- • `4a4ac9ab` rel=0 score=0.308 — User's girlfriend Sam is a paramedic who works night shifts
- • `b854d154` rel=0 score=0.236 — User eats fish and eggs; they are pescatarian, not vegan
- • `eca1f44b` rel=0 score=0.233 — User and Sam are going to Lisbon for a week in March
- • `eb1997d6` rel=0 score=0.18 — User makes pancakes every Sunday morning
- • `05d24d0e` rel=0 score=0.186 — User is vegan

### E11 — "brunch ideas?"

- • `4a4ac9ab` rel=0 score=0.314 — User's girlfriend Sam is a paramedic who works night shifts
- • `eca1f44b` rel=0 score=0.301 — User and Sam are going to Lisbon for a week in March
- • `b854d154` rel=0 score=0.255 — User eats fish and eggs; they are pescatarian, not vegan
- • `7e90091a` rel=0 score=0.3 — User and Sam argued about moving in together
- • `eb1997d6` rel=0 score=0.19 — User makes pancakes every Sunday morning
- • `05d24d0e` rel=0 score=0.205 — User is vegan

### E12 — "am I vegan?"

- • `05d24d0e` rel=0.5 score=0.48 — User is vegan
- • `4a4ac9ab` rel=0 score=0.314 — User's girlfriend Sam is a paramedic who works night shifts
- • `eca1f44b` rel=0 score=0.301 — User and Sam are going to Lisbon for a week in March
- • `7e90091a` rel=0 score=0.3 — User and Sam argued about moving in together
- • `b854d154` rel=0.1 score=0.31 — User eats fish and eggs; they are pescatarian, not vegan
- • `eb1997d6` rel=0 score=0.19 — User makes pancakes every Sunday morning

### E13 — "where are we going in March?"

- • `eca1f44b` rel=0.4 score=0.521 — User and Sam are going to Lisbon for a week in March
- • `4a4ac9ab` rel=0 score=0.314 — User's girlfriend Sam is a paramedic who works night shifts
- • `b854d154` rel=0 score=0.255 — User eats fish and eggs; they are pescatarian, not vegan
- • `7e90091a` rel=0 score=0.3 — User and Sam argued about moving in together
- • `eb1997d6` rel=0 score=0.19 — User makes pancakes every Sunday morning
- • `05d24d0e` rel=0 score=0.205 — User is vegan

### E14 — "how is the guitar going?"

- • `eca1f44b` rel=0.1 score=0.356 — User and Sam are going to Lisbon for a week in March
- • `4a4ac9ab` rel=0 score=0.314 — User's girlfriend Sam is a paramedic who works night shifts
- • `b854d154` rel=0 score=0.255 — User eats fish and eggs; they are pescatarian, not vegan
- • `7e90091a` rel=0 score=0.3 — User and Sam argued about moving in together
- • `eb1997d6` rel=0 score=0.19 — User makes pancakes every Sunday morning
- • `05d24d0e` rel=0 score=0.205 — User is vegan

### E15 — "night"

- • `4a4ac9ab` rel=0.083 score=0.36 — User's girlfriend Sam is a paramedic who works night shifts
- • `eca1f44b` rel=0 score=0.301 — User and Sam are going to Lisbon for a week in March
- • `b854d154` rel=0 score=0.255 — User eats fish and eggs; they are pescatarian, not vegan
- • `7e90091a` rel=0 score=0.3 — User and Sam argued about moving in together
- • `eb1997d6` rel=0 score=0.19 — User makes pancakes every Sunday morning
- • `05d24d0e` rel=0 score=0.205 — User is vegan

### F01 — "the kids are driving me up the wall"

- • `98abc494` rel=0.083 score=0.373 — User has two kids, Noor (9) and Idris (5)
- • `4f9cda96` rel=0 score=0.319 — User's mother is recovering from hip surgery and lives with them for now
- • `9f526d55` rel=0 score=0.309 — User's car failed its inspection and needs new brakes
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `8a1850bf` rel=0 score=0.285 — User is a nurse, not a doctor, and gets annoyed when people mix them up
- • `81ca6f1e` rel=0 score=0.213 — User watches Korean thrillers and hates horror
- 🧵 `7e84cabc` rel=0 score=0.265 — Mum's recovery — User's mother has a follow-up with the surgeon on 20 November

### F02 — "long shift today"

- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `4f9cda96` rel=0 score=0.319 — User's mother is recovering from hip surgery and lives with them for now
- • `9f526d55` rel=0 score=0.309 — User's car failed its inspection and needs new brakes
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `8a1850bf` rel=0 score=0.285 — User is a nurse, not a doctor, and gets annoyed when people mix them up
- • `81ca6f1e` rel=0 score=0.213 — User watches Korean thrillers and hates horror
- 🧵 `7e84cabc` rel=0 score=0.265 — Mum's recovery — User's mother has a follow-up with the surgeon on 20 November

### F03 — "how does my clinical work feed into the thesis?"

- • `b266899a` rel=0 score=0.341 — User finished the literature review and is now drafting the methods chapter
- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `c3bfc641` rel=0.056 score=0.307 — User is doing a part-time master's in public health and has a thesis due in May
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `0bdf1440` rel=0.1 score=0.268 — User's thesis is about vaccine uptake in refugee communities
- • `1935639c` rel=0 score=0.235 — User struggles with the statistics module and dreads regression
- 🧵 `16425702` rel=0.056 score=0.327 — Thesis proposal — User submits the proposal on 10 November and wants a read-through first

### F04 — "how am I getting to work this week?"

- • `8a1850bf` rel=0.083 score=0.33 — User is a nurse, not a doctor, and gets annoyed when people mix them up
- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `4f9cda96` rel=0 score=0.319 — User's mother is recovering from hip surgery and lives with them for now
- • `9f526d55` rel=0 score=0.309 — User's car failed its inspection and needs new brakes
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `81ca6f1e` rel=0 score=0.213 — User watches Korean thrillers and hates horror
- 🧵 `7e84cabc` rel=0 score=0.265 — Mum's recovery — User's mother has a follow-up with the surgeon on 20 November

### F05 — "how am I getting to work this week?" (asked 45 days later)

- • `98abc494` rel=0 score=0.326 — User has two kids, Noor (9) and Idris (5)
- • `8a1850bf` rel=0.083 score=0.318 — User is a nurse, not a doctor, and gets annoyed when people mix them up
- • `4f9cda96` rel=0 score=0.265 — User's mother is recovering from hip surgery and lives with them for now
- • `3e99d84b` rel=0 score=0.286 — User is a pediatric nurse at St. Agnes hospital
- • `81ca6f1e` rel=0 score=0.188 — User watches Korean thrillers and hates horror
- • `c7e4cfed` rel=0 score=0.18 — User grows tomatoes and chillies on the balcony
- 🧵 `7e84cabc` rel=0 score=0.207 — Mum's recovery — User's mother has a follow-up with the surgeon on 20 November

### F06 — "how is mum doing?"

- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `4f9cda96` rel=0 score=0.319 — User's mother is recovering from hip surgery and lives with them for now
- • `9f526d55` rel=0 score=0.309 — User's car failed its inspection and needs new brakes
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `8a1850bf` rel=0 score=0.285 — User is a nurse, not a doctor, and gets annoyed when people mix them up
- • `81ca6f1e` rel=0 score=0.213 — User watches Korean thrillers and hates horror
- 🧵 `7e84cabc` rel=0.063 score=0.3 — Mum's recovery — User's mother has a follow-up with the surgeon on 20 November

### F07 — "when is the surgeon appointment?"

- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `4f9cda96` rel=0 score=0.319 — User's mother is recovering from hip surgery and lives with them for now
- • `9f526d55` rel=0 score=0.309 — User's car failed its inspection and needs new brakes
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `8a1850bf` rel=0 score=0.285 — User is a nurse, not a doctor, and gets annoyed when people mix them up
- • `81ca6f1e` rel=0 score=0.213 — User watches Korean thrillers and hates horror
- 🧵 `7e84cabc` rel=0.063 score=0.3 — Mum's recovery — User's mother has a follow-up with the surgeon on 20 November

### F08 — "movie night, pick something"

- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `4f9cda96` rel=0 score=0.319 — User's mother is recovering from hip surgery and lives with them for now
- • `9f526d55` rel=0 score=0.309 — User's car failed its inspection and needs new brakes
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `8a1850bf` rel=0 score=0.285 — User is a nurse, not a doctor, and gets annoyed when people mix them up
- • `81ca6f1e` rel=0 score=0.213 — User watches Korean thrillers and hates horror
- 🧵 `7e84cabc` rel=0 score=0.265 — Mum's recovery — User's mother has a follow-up with the surgeon on 20 November

### F09 — "how is the lit review going?"

- • `b266899a` rel=0.083 score=0.387 — User finished the literature review and is now drafting the methods chapter
- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `c3bfc641` rel=0 score=0.277 — User is doing a part-time master's in public health and has a thesis due in May
- • `1935639c` rel=0 score=0.235 — User struggles with the statistics module and dreads regression
- • `dc29db79` rel=0 score=0.194 — User is a doctor
- 🧵 `16425702` rel=0 score=0.297 — Thesis proposal — User submits the proposal on 10 November and wants a read-through first

### F10 — "can you read my proposal before I submit?"

- • `b266899a` rel=0 score=0.341 — User finished the literature review and is now drafting the methods chapter
- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `c3bfc641` rel=0 score=0.277 — User is doing a part-time master's in public health and has a thesis due in May
- • `1935639c` rel=0 score=0.235 — User struggles with the statistics module and dreads regression
- • `dc29db79` rel=0 score=0.194 — User is a doctor
- 🧵 `16425702` rel=0.333 score=0.48 — Thesis proposal — User submits the proposal on 10 November and wants a read-through first

### F11 — "what is my thesis about?"

- • `b266899a` rel=0 score=0.341 — User finished the literature review and is now drafting the methods chapter
- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `c3bfc641` rel=0.056 score=0.307 — User is doing a part-time master's in public health and has a thesis due in May
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `0bdf1440` rel=0.1 score=0.268 — User's thesis is about vaccine uptake in refugee communities
- • `1935639c` rel=0 score=0.235 — User struggles with the statistics module and dreads regression
- 🧵 `16425702` rel=0.056 score=0.327 — Thesis proposal — User submits the proposal on 10 November and wants a read-through first

### F12 — "regression homework again"

- • `b266899a` rel=0 score=0.341 — User finished the literature review and is now drafting the methods chapter
- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `1935639c` rel=0.1 score=0.29 — User struggles with the statistics module and dreads regression
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `c3bfc641` rel=0 score=0.277 — User is doing a part-time master's in public health and has a thesis due in May
- • `dc29db79` rel=0 score=0.194 — User is a doctor
- 🧵 `16425702` rel=0 score=0.297 — Thesis proposal — User submits the proposal on 10 November and wants a read-through first

### F13 — "what should I watch tonight?"

- • `b266899a` rel=0 score=0.341 — User finished the literature review and is now drafting the methods chapter
- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `c3bfc641` rel=0 score=0.277 — User is doing a part-time master's in public health and has a thesis due in May
- • `1935639c` rel=0 score=0.235 — User struggles with the statistics module and dreads regression
- • `dc29db79` rel=0 score=0.194 — User is a doctor
- 🧵 `16425702` rel=0 score=0.297 — Thesis proposal — User submits the proposal on 10 November and wants a read-through first

### F14 — "hi"

- • `b266899a` rel=0 score=0.341 — User finished the literature review and is now drafting the methods chapter
- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `c3bfc641` rel=0 score=0.277 — User is doing a part-time master's in public health and has a thesis due in May
- • `1935639c` rel=0 score=0.235 — User struggles with the statistics module and dreads regression
- • `dc29db79` rel=0 score=0.194 — User is a doctor
- 🧵 `16425702` rel=0 score=0.297 — Thesis proposal — User submits the proposal on 10 November and wants a read-through first

### F15 — "did I get the proposal in?" (asked 30 days later)

- • `98abc494` rel=0 score=0.326 — User has two kids, Noor (9) and Idris (5)
- • `3e99d84b` rel=0 score=0.286 — User is a pediatric nurse at St. Agnes hospital
- • `b266899a` rel=0 score=0.283 — User finished the literature review and is now drafting the methods chapter
- • `c3bfc641` rel=0 score=0.271 — User is doing a part-time master's in public health and has a thesis due in May
- • `1935639c` rel=0 score=0.205 — User struggles with the statistics module and dreads regression
- • `dc29db79` rel=0 score=0.184 — User is a doctor
- 🧵 `16425702` rel=0.056 score=0.266 — Thesis proposal — User submits the proposal on 10 November and wants a read-through first

### F16 — "what do you know about me?"

- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `4f9cda96` rel=0 score=0.319 — User's mother is recovering from hip surgery and lives with them for now
- • `9f526d55` rel=0 score=0.309 — User's car failed its inspection and needs new brakes
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `8a1850bf` rel=0 score=0.285 — User is a nurse, not a doctor, and gets annoyed when people mix them up
- • `81ca6f1e` rel=0 score=0.213 — User watches Korean thrillers and hates horror
- 🧵 `7e84cabc` rel=0 score=0.265 — Mum's recovery — User's mother has a follow-up with the surgeon on 20 November

### D01 — "how is Hikaru getting on with the violin?"

- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `b3d26c4a` rel=0.125 score=0.347 — User is keen to get back to comics
- • `3556aa9b` rel=0.071 score=0.34 — User is divorced and co-parents Hikaru with their ex, Kenji
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- 🧵 `cd5245f0` rel=0.071 score=0.336 — Hikaru's concert — the orchestra concert is on 5 December and User might film it
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays

### D02 — "what do I do for work?"

- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `18ba5752` rel=0.167 score=0.357 — User hopes to do more comic work
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D03 — "which city am I in?" (asked 30 days later)

- • `64781f2f` rel=0 score=0.329 — User has a cover deadline for a fantasy trilogy on 30 November
- • `3556aa9b` rel=0 score=0.293 — User is divorced and co-parents Hikaru with their ex, Kenji
- • `6c040025` rel=0 score=0.248 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `5a1eb32e` rel=0 score=0.248 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.247 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0 score=0.24 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.236 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D04 — "where am I this week?"

- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c70ed0f` rel=0.1 score=0.367 — User is in Kyoto visiting Kenji's family this week
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.318 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D05 — "bakery recommendations?"

- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.318 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D06 — "anniversary gift ideas for my spouse"

- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.318 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D07 — "am I married?"

- • `8dcb2f23` rel=0.5 score=0.465 — User is married
- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.318 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D08 — "when is the cover due?"

- • `64781f2f` rel=0.083 score=0.438 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.318 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0.071 score=0.345 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D09 — "feeling better today"

- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.318 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D10 — "I want to get back into comics"

- • `b3d26c4a` rel=0.75 score=0.691 — User is keen to get back to comics
- • `f508de84` rel=0.667 score=0.617 — User wants to draw more comics
- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `4d849b9b` rel=0.5 score=0.536 — User wants to draw comics, not just covers
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `9a84a2d9` rel=0 score=0.322 — User listened to a podcast episode about sourdough starters and thought it was overrated (episode 3)
- 🧵 `1bcdae4c` rel=0.071 score=0.345 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D11 — "what is my daughter called?"

- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.318 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D12 — "tell me something about octopuses I liked"

- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c040025` rel=0.063 score=0.356 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `a1771765` rel=0.125 score=0.326 — User would like to work on comics more
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D13 — "hello"

- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.318 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D14 — "remind me on Friday about the second cover"

- • `64781f2f` rel=0.083 score=0.438 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.318 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0.429 score=0.541 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D15 — "who is my sister?"

- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.318 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D16 — "did I make the trilogy deadline?" (asked 30 days later)

- • `64781f2f` rel=0.333 score=0.512 — User has a cover deadline for a fantasy trilogy on 30 November
- • `3556aa9b` rel=0 score=0.293 — User is divorced and co-parents Hikaru with their ex, Kenji
- • `0ccfbe81` rel=0.125 score=0.283 — User is trying to make time for comics
- • `6c040025` rel=0 score=0.248 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `5a1eb32e` rel=0 score=0.248 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.247 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0.071 score=0.28 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.236 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D17 — "should I drive or bike to the studio?"

- • `d3ec847a` rel=0.5 score=0.455 — User cycles to the studio and hates driving
- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.318 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D18 — "what do you remember about me?"

- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.318 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### S01 — "which book am I on?" (asked 60 days later)

- • `2229cc03` rel=0 score=0.309 — User is allergic to shellfish
- • `03ccf01a` rel=0 score=0.277 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.272 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.255 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0.071 score=0.238 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- • `071824a6` rel=0 score=0.199 — User's dog is a beagle named Biscuit who is seven years old
- 🧵 `54653b01` rel=0 score=0.203 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### S02 — "my shift pattern changed" (asked 60 days later)

- • `98abc494` rel=0 score=0.326 — User has two kids, Noor (9) and Idris (5)
- • `3e99d84b` rel=0 score=0.286 — User is a pediatric nurse at St. Agnes hospital
- • `c3bfc641` rel=0 score=0.268 — User is doing a part-time master's in public health and has a thesis due in May
- • `b266899a` rel=0 score=0.254 — User finished the literature review and is now drafting the methods chapter
- • `1935639c` rel=0 score=0.19 — User struggles with the statistics module and dreads regression
- • `dc29db79` rel=0 score=0.18 — User is a doctor
- 🧵 `16425702` rel=0 score=0.205 — Thesis proposal — User submits the proposal on 10 November and wants a read-through first

### S03 — "am I vegan?" (asked 90 days later)

- • `05d24d0e` rel=0.5 score=0.454 — User is vegan
- • `4a4ac9ab` rel=0 score=0.306 — User's girlfriend Sam is a paramedic who works night shifts
- • `b854d154` rel=0.1 score=0.284 — User eats fish and eggs; they are pescatarian, not vegan
- • `eb1997d6` rel=0 score=0.177 — User makes pancakes every Sunday morning
- • `eca1f44b` rel=0 score=0.208 — User and Sam are going to Lisbon for a week in March

### S04 — "fancy a climb this week?" (asked 90 days later)

- • `12322239` rel=0 score=0.286 — User's birthday is 2 December
- • `263cf272` rel=0.083 score=0.272 — User lives in Evanston, not Chicago, and commutes in twice a week
- • `3953c0fc` rel=0 score=0.178 — User listens to history podcasts on the train
- • `302fefa8` rel=0 score=0.176 — User's younger sister Priya is a nurse in Milwaukee
- • `a00476ea` rel=0.1 score=0.232 — User bouldering twice a week and prefers it to running
- 🧵 `a47b15eb` rel=0 score=0.189 — Priya's exam — Priya sits her nurse practitioner exam in November and User wants to send her something

### S05 — "what do I do for work?" (asked 90 days later)

- • `3556aa9b` rel=0 score=0.287 — User is divorced and co-parents Hikaru with their ex, Kenji
- • `64781f2f` rel=0 score=0.281 — User has a cover deadline for a fantasy trilogy on 30 November
- • `18ba5752` rel=0.167 score=0.278 — User hopes to do more comic work
- • `6c040025` rel=0 score=0.193 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `499d32af` rel=0 score=0.192 — User went to a talk about bronze age trade and could not stop thinking about it (episode 9)
- 🧵 `1bcdae4c` rel=0 score=0.191 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.19 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### S06 — "our anniversary is coming up, right?" (asked 120 days later)

- • `b6b5a243` rel=0.125 score=0.354 — User and Jordan's anniversary is on 14 March
- • `5379e8b1` rel=0 score=0.27 — User is studying for the CPA exam scheduled for 18 November
- • `def93b33` rel=0 score=0.267 — User quit smoking two years ago and has not smoked since
- • `d8e71181` rel=0 score=0.305 — User's partner is named Jordan and they have been together for three years
- • `27f80bb4` rel=0 score=0.178 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- • `e57c4ad4` rel=0 score=0.177 — User smokes
- 🧵 `5f199c79` rel=0 score=0.182 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.18 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### S07 — "hey" (asked 45 days later)

- • `2229cc03` rel=0 score=0.311 — User is allergic to shellfish
- • `2e852f3a` rel=0 score=0.286 — User wants to run the Austin half marathon in February
- • `afd37dbc` rel=0 score=0.25 — User is training on their own with a free plan, not with a coach
- • `263d7520` rel=0 score=0.194 — User finds the on-call rotation at work exhausting
- • `096bdee1` rel=0 score=0.218 — User's current long run is 14 kilometres at about 5:40 per kilometre
- • `6fafc505` rel=0 score=0.199 — User has hired a running coach
- 🧵 `991ab119` rel=0 score=0.205 — Knee pain — User was going to book a physio appointment and report back
- 🧵 `d8a28b6d` rel=0 score=0.197 — Half-marathon training plan — User asked for a 12-week plan and wants to check in every Monday

### S08 — "what does my sister do?" (asked 120 days later)

- • `12322239` rel=0 score=0.285 — User's birthday is 2 December
- • `302fefa8` rel=0.1 score=0.23 — User's younger sister Priya is a nurse in Milwaukee
- • `263cf272` rel=0 score=0.226 — User lives in Evanston, not Chicago, and commutes in twice a week
- • `3953c0fc` rel=0 score=0.177 — User listens to history podcasts on the train
- • `a00476ea` rel=0 score=0.176 — User bouldering twice a week and prefers it to running
- 🧵 `a47b15eb` rel=0 score=0.182 — Priya's exam — Priya sits her nurse practitioner exam in November and User wants to send her something

### A28 — "what is my sister called?"

- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A29 — "can you explain how mortgages work?"

- • `03ccf01a` rel=0.071 score=0.352 — User works at Globex Health as a staff engineer, started in September
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `53651a48` rel=0 score=0.295 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A30 — "how different is Austin from Portland so far?"

- • `53651a48` rel=0.071 score=0.334 — User moved to Austin in August and lives near Zilker Park
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.315 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.312 — User works at Globex Health as a staff engineer, started in September
- • `d39a3032` rel=0 score=0.284 — User is not a vegetarian; they just don't eat red meat
- • `8be89adc` rel=0.25 score=0.324 — User lives in Portland
- • `f6838e9e` rel=0 score=0.269 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.289 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A31 — "I think I am getting sick again" (asked 10 days later)

- • `2229cc03` rel=0 score=0.318 — User is allergic to shellfish
- • `03ccf01a` rel=0 score=0.303 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.289 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.276 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.25 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- • `386eada5` rel=0 score=0.25 — User prefers slow-burn science fiction over fantasy
- 🧵 `54653b01` rel=0.063 score=0.3 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A32 — "what do I have planned this weekend?" (asked 1 days later)

- • `2229cc03` rel=0 score=0.321 — User is allergic to shellfish
- • `18dc0e7b` rel=0 score=0.312 — User is hosting a board-game night this Saturday
- • `03ccf01a` rel=0 score=0.311 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.294 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.283 — User is not a vegetarian; they just don't eat red meat
- • `f6838e9e` rel=0 score=0.267 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.286 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### A33 — "Monday check-in, how did the week go?"

- • `2e852f3a` rel=0 score=0.325 — User wants to run the Austin half marathon in February
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `afd37dbc` rel=0 score=0.295 — User is training on their own with a free plan, not with a coach
- • `096bdee1` rel=0 score=0.297 — User's current long run is 14 kilometres at about 5:40 per kilometre
- • `263d7520` rel=0 score=0.228 — User finds the on-call rotation at work exhausting
- • `bc351b59` rel=0 score=0.259 — User's left knee hurts after runs longer than 10 kilometres
- 🧵 `d8a28b6d` rel=0.25 score=0.375 — Half-marathon training plan — User asked for a 12-week plan and wants to check in every Monday
- 🧵 `991ab119` rel=0.063 score=0.296 — Knee pain — User was going to book a physio appointment and report back

### A34 — "what is the capital of Peru?"

- • `2e852f3a` rel=0 score=0.325 — User wants to run the Austin half marathon in February
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `afd37dbc` rel=0 score=0.295 — User is training on their own with a free plan, not with a coach
- • `096bdee1` rel=0 score=0.297 — User's current long run is 14 kilometres at about 5:40 per kilometre
- • `263d7520` rel=0 score=0.228 — User finds the on-call rotation at work exhausting
- • `bc351b59` rel=0 score=0.259 — User's left knee hurts after runs longer than 10 kilometres
- 🧵 `991ab119` rel=0 score=0.261 — Knee pain — User was going to book a physio appointment and report back
- 🧵 `d8a28b6d` rel=0 score=0.237 — Half-marathon training plan — User asked for a 12-week plan and wants to check in every Monday

### A35 — "remind me what my coach said about hills"

- • `afd37dbc` rel=0.125 score=0.364 — User is training on their own with a free plan, not with a coach
- • `2e852f3a` rel=0 score=0.325 — User wants to run the Austin half marathon in February
- • `2229cc03` rel=0 score=0.322 — User is allergic to shellfish
- • `6fafc505` rel=0.167 score=0.333 — User has hired a running coach
- • `096bdee1` rel=0 score=0.297 — User's current long run is 14 kilometres at about 5:40 per kilometre
- • `263d7520` rel=0 score=0.228 — User finds the on-call rotation at work exhausting
- 🧵 `991ab119` rel=0 score=0.261 — Knee pain — User was going to book a physio appointment and report back
- 🧵 `d8a28b6d` rel=0 score=0.237 — Half-marathon training plan — User asked for a 12-week plan and wants to check in every Monday

### B16 — "what is my cat scared of?"

- • `5379e8b1` rel=0 score=0.34 — User is studying for the CPA exam scheduled for 18 November
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `d8e71181` rel=0 score=0.31 — User's partner is named Jordan and they have been together for three years
- • `097ed456` rel=0.1 score=0.268 — User's cat Mochi is afraid of the vacuum cleaner
- • `def93b33` rel=0 score=0.296 — User quit smoking two years ago and has not smoked since
- • `b6b5a243` rel=0 score=0.291 — User and Jordan's anniversary is on 14 March
- 🧵 `5f199c79` rel=0 score=0.294 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.254 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B17 — "how do I fix a leaky tap?"

- • `5379e8b1` rel=0 score=0.34 — User is studying for the CPA exam scheduled for 18 November
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `d8e71181` rel=0 score=0.31 — User's partner is named Jordan and they have been together for three years
- • `def93b33` rel=0 score=0.296 — User quit smoking two years ago and has not smoked since
- • `b6b5a243` rel=0 score=0.291 — User and Jordan's anniversary is on 14 March
- • `27f80bb4` rel=0 score=0.222 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- 🧵 `5f199c79` rel=0 score=0.294 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.254 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B18 — "any ideas for the 14th?" (asked 120 days later)

- • `d8e71181` rel=0 score=0.305 — User's partner is named Jordan and they have been together for three years
- • `5379e8b1` rel=0 score=0.27 — User is studying for the CPA exam scheduled for 18 November
- • `b6b5a243` rel=0 score=0.285 — User and Jordan's anniversary is on 14 March
- • `def93b33` rel=0 score=0.267 — User quit smoking two years ago and has not smoked since
- • `27f80bb4` rel=0 score=0.178 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- • `e57c4ad4` rel=0 score=0.177 — User smokes
- 🧵 `5f199c79` rel=0 score=0.182 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0 score=0.18 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B19 — "is the exam still in September?"

- • `40499e23` rel=0.4 score=0.402 — User plans to take the CPA exam in September
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `d8e71181` rel=0 score=0.31 — User's partner is named Jordan and they have been together for three years
- • `5379e8b1` rel=0.083 score=0.386 — User is studying for the CPA exam scheduled for 18 November
- • `def93b33` rel=0 score=0.296 — User quit smoking two years ago and has not smoked since
- • `b6b5a243` rel=0 score=0.291 — User and Jordan's anniversary is on 14 March
- • `27f80bb4` rel=0 score=0.222 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- 🧵 `5f199c79` rel=0 score=0.294 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday
- 🧵 `e2f97e21` rel=0.05 score=0.281 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November

### B20 — "I feel sick about the audit section"

- • `5379e8b1` rel=0 score=0.34 — User is studying for the CPA exam scheduled for 18 November
- • `9a7c32a8` rel=0 score=0.318 — User's parents are visiting this weekend
- • `d8e71181` rel=0 score=0.31 — User's partner is named Jordan and they have been together for three years
- • `def93b33` rel=0 score=0.296 — User quit smoking two years ago and has not smoked since
- • `b6b5a243` rel=0 score=0.291 — User and Jordan's anniversary is on 14 March
- • `27f80bb4` rel=0 score=0.222 — User and the companion call Mondays "the vacuum days" after Mochi hid all Monday
- 🧵 `e2f97e21` rel=0.2 score=0.364 — CPA exam — User is nervous about the audit section and wanted encouragement the week before 18 November
- 🧵 `5f199c79` rel=0 score=0.294 — Gift for Jordan — User is deciding between a pottery class and concert tickets for Jordan's birthday

### C18 — "what does my company build?"

- • `0b1fee50` rel=0.05 score=0.335 — User is the founder of a two-person startup building scheduling software for dental clinics
- • `2432bec8` rel=0 score=0.281 — User is raising a pre-seed round and has talked to six investors
- • `683b9025` rel=0 score=0.26 — User switched from Spanish to Italian in July because of a planned move to Bologna
- • `482399c6` rel=0 score=0.259 — User is working toward ten clinic customers by spring
- • `09da6e19` rel=0 score=0.184 — User lives in Chicago
- • `009cf485` rel=0 score=0.18 — User's co-founder is Tomas, who handles sales
- 🧵 `6812411b` rel=0 score=0.306 — Pre-seed round — User has a second meeting with Harbor Ventures next week and wants to rehearse the pitch
- 🧵 `de7d1ac5` rel=0 score=0.269 — First hire — User is deciding whether to hire a designer or a second engineer first

### C19 — "any updates on my side?"

- • `0b1fee50` rel=0 score=0.308 — User is the founder of a two-person startup building scheduling software for dental clinics
- • `2432bec8` rel=0 score=0.281 — User is raising a pre-seed round and has talked to six investors
- • `683b9025` rel=0 score=0.26 — User switched from Spanish to Italian in July because of a planned move to Bologna
- • `482399c6` rel=0 score=0.259 — User is working toward ten clinic customers by spring
- • `09da6e19` rel=0 score=0.184 — User lives in Chicago
- • `009cf485` rel=0 score=0.18 — User's co-founder is Tomas, who handles sales
- 🧵 `6812411b` rel=0 score=0.306 — Pre-seed round — User has a second meeting with Harbor Ventures next week and wants to rehearse the pitch
- 🧵 `de7d1ac5` rel=0 score=0.269 — First hire — User is deciding whether to hire a designer or a second engineer first

### C20 — "what is the weather like where I live?"

- • `09da6e19` rel=0.25 score=0.322 — User lives in Chicago
- • `12322239` rel=0 score=0.292 — User's birthday is 2 December
- • `3953c0fc` rel=0 score=0.202 — User listens to history podcasts on the train
- • `a00476ea` rel=0 score=0.194 — User bouldering twice a week and prefers it to running
- • `302fefa8` rel=0 score=0.181 — User's younger sister Priya is a nurse in Milwaukee
- • `263cf272` rel=0.083 score=0.281 — User lives in Evanston, not Chicago, and commutes in twice a week
- 🧵 `a47b15eb` rel=0 score=0.284 — Priya's exam — Priya sits her nurse practitioner exam in November and User wants to send her something

### C21 — "remind me of my spring target" (asked 60 days later)

- • `485ddc6c` rel=0.4 score=0.413 — User's target is ten clinics signed by spring
- • `0b1fee50` rel=0 score=0.306 — User is the founder of a two-person startup building scheduling software for dental clinics
- • `683b9025` rel=0 score=0.249 — User switched from Spanish to Italian in July because of a planned move to Bologna
- • `2432bec8` rel=0 score=0.202 — User is raising a pre-seed round and has talked to six investors
- • `09da6e19` rel=0 score=0.177 — User lives in Chicago
- • `009cf485` rel=0 score=0.176 — User's co-founder is Tomas, who handles sales
- • `f0954bc9` rel=0 score=0.176 — User is learning Spanish on Duolingo
- 🧵 `6812411b` rel=0 score=0.208 — Pre-seed round — User has a second meeting with Harbor Ventures next week and wants to rehearse the pitch
- 🧵 `de7d1ac5` rel=0 score=0.199 — First hire — User is deciding whether to hire a designer or a second engineer first

### C22 — "bored on the train again"

- • `12322239` rel=0 score=0.292 — User's birthday is 2 December
- • `3953c0fc` rel=0.125 score=0.27 — User listens to history podcasts on the train
- • `263cf272` rel=0 score=0.235 — User lives in Evanston, not Chicago, and commutes in twice a week
- • `302fefa8` rel=0 score=0.181 — User's younger sister Priya is a nurse in Milwaukee
- • `a00476ea` rel=0 score=0.194 — User bouldering twice a week and prefers it to running
- 🧵 `a47b15eb` rel=0 score=0.284 — Priya's exam — Priya sits her nurse practitioner exam in November and User wants to send her something

### C23 — "how is my guitar practice going?"

- • `0b1fee50` rel=0 score=0.308 — User is the founder of a two-person startup building scheduling software for dental clinics
- • `2432bec8` rel=0 score=0.281 — User is raising a pre-seed round and has talked to six investors
- • `683b9025` rel=0 score=0.26 — User switched from Spanish to Italian in July because of a planned move to Bologna
- • `482399c6` rel=0 score=0.259 — User is working toward ten clinic customers by spring
- • `09da6e19` rel=0 score=0.184 — User lives in Chicago
- • `009cf485` rel=0 score=0.18 — User's co-founder is Tomas, who handles sales
- 🧵 `6812411b` rel=0 score=0.306 — Pre-seed round — User has a second meeting with Harbor Ventures next week and wants to rehearse the pitch
- 🧵 `de7d1ac5` rel=0 score=0.269 — First hire — User is deciding whether to hire a designer or a second engineer first

### E16 — "I learned the bridge!"

- • `6ab9a4ef` rel=0 score=0.36 — User was offered the department head role and accepted it, starting in January
- • `d712d2dd` rel=0 score=0.318 — User is currently resting a sprained right wrist and cannot practise
- • `8063381a` rel=0 score=0.289 — User's book club is reading 'Piranesi' this month
- • `e4c2c4a8` rel=0 score=0.286 — User is a high-school chemistry teacher
- • `2ab8cbeb` rel=0 score=0.285 — User wants to play 'Blackbird' cleanly by New Year
- 🧵 `5fc2eae2` rel=0.222 score=0.392 — Blackbird progress — User can play the first half and wanted to check in after learning the bridge
- 🧵 `71038f34` rel=0 score=0.274 — Student recital — User is organising the school's winter recital on 12 December

### E17 — "what is book club reading this month?"

- • `8063381a` rel=0.8 score=0.729 — User's book club is reading 'Piranesi' this month
- • `6ab9a4ef` rel=0 score=0.36 — User was offered the department head role and accepted it, starting in January
- • `d712d2dd` rel=0 score=0.318 — User is currently resting a sprained right wrist and cannot practise
- • `e4c2c4a8` rel=0 score=0.286 — User is a high-school chemistry teacher
- • `2ab8cbeb` rel=0 score=0.285 — User wants to play 'Blackbird' cleanly by New Year
- • `0d7843b8` rel=0 score=0.269 — User is learning fingerstyle guitar and practises 30 minutes a day
- 🧵 `71038f34` rel=0 score=0.274 — Student recital — User is organising the school's winter recital on 12 December
- 🧵 `5fc2eae2` rel=0 score=0.269 — Blackbird progress — User can play the first half and wanted to check in after learning the bridge

### E18 — "how did the recital go?" (asked 60 days later)

- • `6ab9a4ef` rel=0 score=0.304 — User was offered the department head role and accepted it, starting in January
- • `e4c2c4a8` rel=0 score=0.285 — User is a high-school chemistry teacher
- • `0d7843b8` rel=0 score=0.251 — User is learning fingerstyle guitar and practises 30 minutes a day
- • `2ab8cbeb` rel=0 score=0.24 — User wants to play 'Blackbird' cleanly by New Year
- • `8063381a` rel=0 score=0.203 — User's book club is reading 'Piranesi' this month
- 🧵 `71038f34` rel=0.071 score=0.239 — Student recital — User is organising the school's winter recital on 12 December
- 🧵 `5fc2eae2` rel=0 score=0.199 — Blackbird progress — User can play the first half and wanted to check in after learning the bridge

### E19 — "Sam says hi"

- • `6ab9a4ef` rel=0 score=0.36 — User was offered the department head role and accepted it, starting in January
- • `d712d2dd` rel=0 score=0.318 — User is currently resting a sprained right wrist and cannot practise
- • `8063381a` rel=0 score=0.289 — User's book club is reading 'Piranesi' this month
- • `e4c2c4a8` rel=0 score=0.286 — User is a high-school chemistry teacher
- • `2ab8cbeb` rel=0 score=0.285 — User wants to play 'Blackbird' cleanly by New Year
- 🧵 `71038f34` rel=0 score=0.274 — Student recital — User is organising the school's winter recital on 12 December
- 🧵 `5fc2eae2` rel=0 score=0.269 — Blackbird progress — User can play the first half and wanted to check in after learning the bridge

### E20 — "Sunday morning plans?"

- • `eb1997d6` rel=0.4 score=0.41 — User makes pancakes every Sunday morning
- • `4a4ac9ab` rel=0 score=0.314 — User's girlfriend Sam is a paramedic who works night shifts
- • `eca1f44b` rel=0 score=0.301 — User and Sam are going to Lisbon for a week in March
- • `b854d154` rel=0 score=0.255 — User eats fish and eggs; they are pescatarian, not vegan
- • `7e90091a` rel=0 score=0.3 — User and Sam argued about moving in together
- • `05d24d0e` rel=0 score=0.205 — User is vegan

### E21 — "what is a good podcast about history?"

- • `4a4ac9ab` rel=0 score=0.314 — User's girlfriend Sam is a paramedic who works night shifts
- • `eca1f44b` rel=0 score=0.301 — User and Sam are going to Lisbon for a week in March
- • `b854d154` rel=0 score=0.255 — User eats fish and eggs; they are pescatarian, not vegan
- • `7e90091a` rel=0 score=0.3 — User and Sam argued about moving in together
- • `eb1997d6` rel=0 score=0.19 — User makes pancakes every Sunday morning
- • `05d24d0e` rel=0 score=0.205 — User is vegan

### F17 — "the kids have a school thing the same night as my seminar"

- • `98abc494` rel=0.083 score=0.373 — User has two kids, Noor (9) and Idris (5)
- • `b266899a` rel=0 score=0.341 — User finished the literature review and is now drafting the methods chapter
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `c3bfc641` rel=0 score=0.277 — User is doing a part-time master's in public health and has a thesis due in May
- • `1935639c` rel=0 score=0.235 — User struggles with the statistics module and dreads regression
- • `dc29db79` rel=0 score=0.194 — User is a doctor
- 🧵 `16425702` rel=0 score=0.297 — Thesis proposal — User submits the proposal on 10 November and wants a read-through first

### F18 — "ugh, the garage quoted me a fortune"

- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `4f9cda96` rel=0 score=0.319 — User's mother is recovering from hip surgery and lives with them for now
- • `9f526d55` rel=0 score=0.309 — User's car failed its inspection and needs new brakes
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `8a1850bf` rel=0 score=0.285 — User is a nurse, not a doctor, and gets annoyed when people mix them up
- • `81ca6f1e` rel=0 score=0.213 — User watches Korean thrillers and hates horror
- 🧵 `7e84cabc` rel=0 score=0.265 — Mum's recovery — User's mother has a follow-up with the surgeon on 20 November

### F19 — "my tomatoes are finally ripe"

- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `4f9cda96` rel=0 score=0.319 — User's mother is recovering from hip surgery and lives with them for now
- • `9f526d55` rel=0 score=0.309 — User's car failed its inspection and needs new brakes
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `c7e4cfed` rel=0.125 score=0.259 — User grows tomatoes and chillies on the balcony
- • `8a1850bf` rel=0 score=0.285 — User is a nurse, not a doctor, and gets annoyed when people mix them up
- 🧵 `7e84cabc` rel=0 score=0.265 — Mum's recovery — User's mother has a follow-up with the surgeon on 20 November

### F20 — "what rhymes with orange?"

- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `4f9cda96` rel=0 score=0.319 — User's mother is recovering from hip surgery and lives with them for now
- • `9f526d55` rel=0 score=0.309 — User's car failed its inspection and needs new brakes
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `8a1850bf` rel=0 score=0.285 — User is a nurse, not a doctor, and gets annoyed when people mix them up
- • `81ca6f1e` rel=0 score=0.213 — User watches Korean thrillers and hates horror
- 🧵 `7e84cabc` rel=0 score=0.265 — Mum's recovery — User's mother has a follow-up with the surgeon on 20 November

### F21 — "when is my thesis due?" (asked 90 days later)

- • `c3bfc641` rel=0.222 score=0.389 — User is doing a part-time master's in public health and has a thesis due in May
- • `98abc494` rel=0 score=0.325 — User has two kids, Noor (9) and Idris (5)
- • `3e99d84b` rel=0 score=0.285 — User is a pediatric nurse at St. Agnes hospital
- • `b266899a` rel=0 score=0.24 — User finished the literature review and is now drafting the methods chapter
- • `0bdf1440` rel=0.1 score=0.235 — User's thesis is about vaccine uptake in refugee communities
- • `1935639c` rel=0 score=0.182 — User struggles with the statistics module and dreads regression
- • `dc29db79` rel=0 score=0.177 — User is a doctor
- 🧵 `16425702` rel=0.056 score=0.221 — Thesis proposal — User submits the proposal on 10 November and wants a read-through first

### F22 — "am I a doctor?"

- • `dc29db79` rel=0.5 score=0.469 — User is a doctor
- • `98abc494` rel=0 score=0.327 — User has two kids, Noor (9) and Idris (5)
- • `4f9cda96` rel=0 score=0.319 — User's mother is recovering from hip surgery and lives with them for now
- • `9f526d55` rel=0 score=0.309 — User's car failed its inspection and needs new brakes
- • `3e99d84b` rel=0 score=0.287 — User is a pediatric nurse at St. Agnes hospital
- • `8a1850bf` rel=0.083 score=0.33 — User is a nurse, not a doctor, and gets annoyed when people mix them up
- • `81ca6f1e` rel=0 score=0.213 — User watches Korean thrillers and hates horror
- 🧵 `7e84cabc` rel=0 score=0.265 — Mum's recovery — User's mother has a follow-up with the surgeon on 20 November

### D19 — "what instrument does my daughter play?"

- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.318 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D20 — "is pasta ok for dinner?"

- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.318 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D21 — "that podcast about salt was something"

- • `ef65db4b` rel=0.25 score=0.419 — User listened to a podcast episode about the history of salt and thought it was overrated (episode 43)
- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.318 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- • `21c7380c` rel=0 score=0.318 — User went to a talk about coral reefs and could not stop thinking about it (episode 4)
- • `137691b2` rel=0.25 score=0.379 — User listened to a podcast episode about the history of salt and thought it was overrated (episode 103)
- • `a579ac1a` rel=0.25 score=0.355 — User listened to a podcast episode about the history of salt and thought it was overrated (episode 163)
- • `caaf8630` rel=0.25 score=0.339 — User listened to a podcast episode about the history of salt and thought it was overrated (episode 223)
- • `6907749d` rel=0.25 score=0.329 — User listened to a podcast episode about the history of salt and thought it was overrated (episode 283)
- • `7114da79` rel=0.25 score=0.323 — User listened to a podcast episode about the history of salt and thought it was overrated (episode 343)
- • `7663d4af` rel=0.25 score=0.319 — User listened to a podcast episode about the history of salt and thought it was overrated (episode 403)
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.297 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D22 — "should I film the concert?"

- • `64781f2f` rel=0 score=0.393 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c040025` rel=0 score=0.322 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `6c70ed0f` rel=0 score=0.312 — User is in Kyoto visiting Kenji's family this week
- • `5a1eb32e` rel=0 score=0.322 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.318 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `cd5245f0` rel=0.286 score=0.454 — Hikaru's concert — the orchestra concert is on 5 December and User might film it
- 🧵 `1bcdae4c` rel=0 score=0.306 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays

### D23 — "what do you remember about me?" (asked 30 days later)

- • `64781f2f` rel=0 score=0.329 — User has a cover deadline for a fantasy trilogy on 30 November
- • `3556aa9b` rel=0 score=0.293 — User is divorced and co-parents Hikaru with their ex, Kenji
- • `6c040025` rel=0 score=0.248 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `5a1eb32e` rel=0 score=0.248 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.247 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0 score=0.24 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.236 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### D24 — "where am I this week?" (asked 10 days later)

- • `64781f2f` rel=0 score=0.366 — User has a cover deadline for a fantasy trilogy on 30 November
- • `3556aa9b` rel=0 score=0.297 — User is divorced and co-parents Hikaru with their ex, Kenji
- • `6c040025` rel=0 score=0.291 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `5a1eb32e` rel=0 score=0.291 — User read a long article about urban beekeeping and told the companion all about it (episode 2)
- • `124a8005` rel=0 score=0.289 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- 🧵 `1bcdae4c` rel=0 score=0.279 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.272 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

### S09 — "dinner ideas?" (asked 120 days later)

- • `2229cc03` rel=0 score=0.306 — User is allergic to shellfish
- • `03ccf01a` rel=0 score=0.268 — User works at Globex Health as a staff engineer, started in September
- • `53651a48` rel=0 score=0.267 — User moved to Austin in August and lives near Zilker Park
- • `d39a3032` rel=0 score=0.247 — User is not a vegetarian; they just don't eat red meat
- • `071824a6` rel=0 score=0.196 — User's dog is a beagle named Biscuit who is seven years old
- • `f6838e9e` rel=0 score=0.181 — User is reading the Expanse novels and is on book four, 'Cibola Burn'
- 🧵 `54653b01` rel=0 score=0.182 — Maren's visit — User is waiting to hear whether Maren can get time off to visit in December

### S10 — "how is Sam?" (asked 45 days later)

- • `6ab9a4ef` rel=0 score=0.312 — User was offered the department head role and accepted it, starting in January
- • `e4c2c4a8` rel=0 score=0.286 — User is a high-school chemistry teacher
- • `0d7843b8` rel=0 score=0.253 — User is learning fingerstyle guitar and practises 30 minutes a day
- • `2ab8cbeb` rel=0 score=0.246 — User wants to play 'Blackbird' cleanly by New Year
- • `8063381a` rel=0 score=0.215 — User's book club is reading 'Piranesi' this month
- 🧵 `71038f34` rel=0 score=0.21 — Student recital — User is organising the school's winter recital on 12 December
- 🧵 `5fc2eae2` rel=0 score=0.208 — Blackbird progress — User can play the first half and wanted to check in after learning the bridge

### S11 — "shoe advice?" (asked 60 days later)

- • `2229cc03` rel=0 score=0.309 — User is allergic to shellfish
- • `2e852f3a` rel=0 score=0.28 — User wants to run the Austin half marathon in February
- • `afd37dbc` rel=0 score=0.242 — User is training on their own with a free plan, not with a coach
- • `263d7520` rel=0 score=0.188 — User finds the on-call rotation at work exhausting
- • `096bdee1` rel=0 score=0.205 — User's current long run is 14 kilometres at about 5:40 per kilometre
- • `6fafc505` rel=0 score=0.192 — User has hired a running coach
- 🧵 `991ab119` rel=0 score=0.197 — Knee pain — User was going to book a physio appointment and report back
- 🧵 `d8a28b6d` rel=0 score=0.191 — Half-marathon training plan — User asked for a 12-week plan and wants to check in every Monday

### S12 — "what instrument does my daughter play?" (asked 120 days later)

- • `3556aa9b` rel=0 score=0.286 — User is divorced and co-parents Hikaru with their ex, Kenji
- • `64781f2f` rel=0 score=0.273 — User has a cover deadline for a fantasy trilogy on 30 November
- • `6c040025` rel=0 score=0.184 — User watched a documentary about octopus intelligence and found it fascinating (episode 1)
- • `124a8005` rel=0 score=0.184 — User fell down a Wikipedia hole about tiny houses and wants to learn more (episode 5)
- • `499d32af` rel=0 score=0.184 — User went to a talk about bronze age trade and could not stop thinking about it (episode 9)
- 🧵 `1bcdae4c` rel=0 score=0.183 — Trilogy covers — User is behind on the second cover and wanted a nudge on Fridays
- 🧵 `cd5245f0` rel=0 score=0.183 — Hikaru's concert — the orchestra concert is on 5 December and User might film it

