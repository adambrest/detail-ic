# Detail IC: scoring rules

How Detail IC scores every shoot type.

## Thresholds

P = pass minimum, M = marksman minimum. Both are whole numbers of hits against the scored total.

| Shoot type | Rifle option | Scored total | P | M |
|---|---|---:|---:|---:|
| BTP | SAR21 | 32 | 16 | 26 |
| ATP (M) | SAR21/SAR21 MMS/M203 | 48 | 24 | 39 |
| ATP (M) | SAR21 SS/HK416 | 48 | 32 | 39 |
| ATP (M) | LMG | 126 | 32 | 63 |
| ATP (SP) | SAR21/SAR21 MMS/M203 | 36 | 18 | 29 |
| CS (M) | SAR21/SAR21 SS/M203 | 48 | 24 | 39 |
| CS (M) | LMG | 48 | 24 | 39 |
| CS (SP) | SAR21/SAR21 SS | 38 | 19 | 31 |
| CS (SP) | LMG | 38 | 19 | 31 |
| APS | SAR21 | 24 | 12 | 20 |
| APS (NS) | SAR21 | 30 | 15 | 24 |

A total at or above M is Marksman, at or above P is Pass, below P is Fail. A total is only graded once every stage has a score. The total alone decides the grade; no stage carries its own pass mark.

Rifles share one option only when their requirement is identical. The SAR21 SS keeps its own option in ATP (M) because it passes at 32, not 24; in Combat Shoot every SAR21 variant passes at the same mark, so they are one option. M16 is out of service and is not offered; rosters that still name it are moved to the SAR21 option, which scores the same.

LMG is not offered for BTP, ATP (SP) or APS: those tables carry no LMG standard, and one is never borrowed from another shoot type.

## Stages

| Shoot type | Scored stages | Not counted |
|---|---|---|
| BTP | Stage A · Day 16, Stage B · Night 16 | — |
| ATP (M), rifles | A 24, B 8, C 16 | — |
| ATP (M), LMG | A 70, B 8, C 48 | — |
| ATP (SP) | A 16, B 8, C 12 | — |
| CS (M) | A 20, B 8, C 20 | — |
| CS (SP) | A 15, B 8, C 15 | — |
| APS | Practices 2–5, 6 each | Sighting 1A and 1B, 3 each |
| APS (NS) | Practices 1–3, 10 each | Sighter, 6 |

Sighting scores are recorded for reference and never counted in a total.

## Combat Shoot

Stages A and C are fired and scored as a detail. Stage B is fired individually, in any order, and details do not apply to it.

```text
A = floor(detail hits for Stage A ÷ firers in that detail)
B = the firer's own Stage B hits
C = floor(detail hits for Stage C ÷ firers in that detail)
Total = A + B + C
```

Each division rounds down on its own. 59 hits over 6 firers is 9 and 65 over 6 is 10, so A + C is 19, not 20. Rounding a percentage into a threshold rounds up; these are different operations.

Averaging happens before best scores are chosen. A firer keeps the best Stage A average they earned, the best Stage B hits, and the best Stage C average, and the three may come from different attempts. An average counts for a firer only if they were in that detail, so once details are mixed up, firers who started in the same detail can hold different Stage A and Stage C scores. Best individual hits are never recombined into a new average.

Every Combat Shoot rifle fires the same rounds in Stage B, so a firer may use a different rifle for that stage. Stages A and C use the rifle set on their roster.

## Details

| Shoot type | Firers per detail | Rifle limit |
|---|---|---|
| CS (SP) | 4–6 | At most 2 non-SAR21 rifles |
| CS (M) | 5–7 | At most 2 non-SAR21 rifles |

The limit counts non-SAR21 rifles together, not two of each kind. Only Combat Shoot has detail sizes; other shoot types fire individually and have no size rule.

Rosters can be arranged freely: sizes and rifle mixes are reported as problems on the Participants tab and checked again when scores are confirmed or firers are redetailed, never by blocking an edit.

A temporary detail scores one stage with any mix of firers, for swaps and reruns. It belongs to that stage only, and the firers stay in their usual detail for every other stage.

## Score entry

Hits are whole numbers from zero to that stage's maximum. A blank is missing, not zero, and a missing stage leaves the total ungraded.

With the sub-stage requirement enabled (the V2 default), enter every part for each firer. Part maximums sum to the rounds that stage fires, which is not always the same as what it credits: the Combat Shoot LMG fires 30 in Stages A and C but is credited at the stage maximum, 20 in CS (M) and 15 in CS (SP). Individual stage hits are the sum of that attempt's parts, capped at the stage maximum, and CS averages are computed from those capped hits. The true entry is retained. Definitions and hits are kept with each attempt. Missing is not zero, and parts from different attempts are never combined.

A stage whose sub-sections have not been stated ships no layout and cannot be scored until one is set in Settings or the requirement is turned off. Stage A of the ATP LMG is in that position.

When the requirement is disabled, for Stages A and C enter each firer's hits or the detail total. Entering hits fills the total; a total typed by hand must match the hits exactly, and a mismatch blocks confirmation.

A detail confirmed on its total alone records no individual hits, but the total still bounds them. With `n` firers and a stage maximum of `m`, a total of `t` leaves no firer below `t − (n − 1)m` and none above `min(m, t)`. A detail that shot well enough proves a good score for everyone in it: 140 over 7 firers of 20 puts every one of them on 20. Proving a poor shot takes a total under what a pass asks of the stage, so only a dreadful detail gives one away. A firer counts as a strong shot when even the lowest they can have fired is on course for Marksman, and as a poor one when even the highest falls short of a pass.

Every available firer on the detail is included in a new attempt. Skip makes a firer unavailable across the shoot without altering any past attempt or divisor. Too few available firers blocks scoring until the user unskips someone or creates a valid replacement detail. A partially entered draft cannot silently change its roster.

## ATP rifles

An ATP result keeps one rifle throughout. The LMG fires 70, 8 and 48 rounds in ATP (M), and 60, 8 and 40 in ATP (SP), against 24, 8 and 16 and 16, 8 and 12 for the rifles. It is held to a different standard, so scores from two rifles never combine into one result. Changing a firer's rifle starts a separate record, and is refused outright while any score they fired on the old rifle still counts.

## History

A name can be corrected at any time, with a reason, and the new name replaces the old one wherever it was written down. A rifle and a detail cannot: a recorded score is held to the standard of the rifle that fired it and belongs to the firers who were on the point. Both are fixed until the scores that still count are voided, and voiding one takes it from everyone in that detail.

Every attempt is kept: the stage, the attempt number, the rifle, the hits or the detail total with its firer count, who else was in the detail, and the time it was confirmed. Scores confirmed together share one timestamp.

Editing a score records a replacement and keeps the original, marked as edited. Voiding one keeps it with its reason, and the void itself is recorded where it happened, naming the score it took out. A voided score can be put back, with a reason of its own; only one that a live edit has replaced cannot, since the replacement holds its place until it is voided in turn. Corrections to a detail score apply to everyone in that detail. Grades already recorded are never changed by later settings.

## Poor shooters and strong shooters

A firer shoots poorly in a stage when their own hits are under half its rounds. Every conduct's pass mark sits at half the rounds or below, except the ATP (M) LMG, whose standard is far easier, so the pass pace caps the mark there rather than calling a comfortably passing gunner weak. They shoot strongly when their hits are at or above the share of the stage that keeps them on course for Marksman. Both read a firer's own hits, never their detail's average, so a firer carried by a good detail can still be a poor shot, and is still the wrong person to lend to a detail that needs lifting.

A poor shooter leaves the list once the stage has given them what they need, since there is nothing left to act on, but the caution stays on them wherever a detail is being put together.

## Redetailing thresholds

Each stage has a threshold that decides who is listed for a reshoot. Once a firer's other stages are scored, the threshold becomes exactly what they still need for Marksman, capped at the stage maximum. Before that, the starting value from Settings applies. A firer drops off the list when they reach Marksman or max the stage, and can still be sent again by hand.

## V2 operational rules

Only one stage is open for score entry at a time. Beginning entry activates it; explicitly unlocking another stage locks the previous one. Historical corrections preserve their original confirmation time and do not consume a pending reshoot.

Confirmation order means the order score groups were confirmed, with lane order retained inside each group. Search changes visual priority only and never changes lane order or confirmation scope.

The ATP/CS Stage B starting target is 7/8. It adjusts using other stage scores like every other stage; when all other scores are known, the exact qualification gap takes precedence over a starting target.

Same-name roster entries remain blocking errors and are highlighted. They are not automatically merged or renamed.

V2 backup schema is 4; old formats are rejected rather than migrated. Same-shoot replacement requires the incoming audit to contain all local audit events and attempts, plus newer events. Divergent copies keep the local shoot. New shoot IDs are imported independently.
