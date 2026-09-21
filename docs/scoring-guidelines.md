# Scoring rules

How Detail IC grades every conduct. Thresholds are transcribed for convenience and are not an official reference.

## Thresholds

P = pass minimum, M = marksman minimum, both whole hits against the scored total.

| Conduct | Rifle option | Total | P | M |
|---|---|---:|---:|---:|
| BTP | SAR21 | 32 | 16 | 26 |
| ATP (M) | SAR21/SAR21 MMS/M203 | 48 | 24 | 39 |
| ATP (M) | SAR21 SS/HK416 | 48 | 32 | 39 |
| ATP (M) | LMG | 126 | 32 | 63 |
| ATP (SP) | SAR21/SAR21 MMS/M203 | 36 | 18 | 29 |
| ATP (SP) | LMG | 108 | 27 | 54 |
| CS (M) | SAR21/SAR21 SS/M203 | 48 | 24 | 39 |
| CS (M) | LMG | 48 | 24 | 39 |
| CS (SP) | SAR21/SAR21 SS | 38 | 19 | 31 |
| CS (SP) | LMG | 38 | 19 | 31 |
| APS | SAR21 | 24 | 12 | 20 |
| APS (NS) | SAR21 | 30 | 15 | 24 |

At or above M is Marksman, at or above P is Pass, below P is Fail. A total is graded only once every stage has a score; no stage carries its own pass mark.

Rifles share an option only when their requirement is identical — the SAR21 SS keeps its own in ATP (M) because it passes at 32. The LMG is offered in ATP and Combat Shoot on its own standard, and not in BTP or APS, whose tables carry no LMG standard.

## Stages and firing sequences

Each stage is fired in sections, and a layout's sections add up to that stage's rounds. A weapon fires the conduct's sequence unless its own is stated: the ATP LMG is issued its own allocation, while in Combat Shoot it is issued the rifles' and shares theirs.

| Conduct | Weapon | Stage A | Stage B | Stage C |
|---|---|---|---|---|
| BTP | SAR21 | 4 × 4 (Day 16) | 4 × 4 (Night 16) | — |
| ATP (M) | rifles | 4 × 6 | 4 × 2 | 4 × 4 |
| ATP (M) | LMG | 20 + 20 + 10 + 10 + 10 | 4 × 2 | 4 × 12 |
| ATP (SP) | rifles | 4 × 4 | 4 × 2 | 4 × 3 |
| ATP (SP) | LMG | 6 × 10 | 4 × 2 | 4 × 10 |
| CS (M) | all | 20 | 4 × 2 | 20 |
| CS (SP) | all | 5 + 10 | 4 × 2 | 5 + 10 |
| APS | SAR21 | Practices 2–5, 6 each | | |
| APS (NS) | SAR21 | Practices 1–3, 10 each | | |

APS sighting scores — 1A and 1B of 3, or a sighter of 6 — are recorded for reference and never counted.

A stage fired in one go still gets a single section, which keeps per-firer entry without pretending the stage is subdivided. Sections are not always equal. Layouts are edited in Settings and stored on the shoot, so a shoot keeps the layout it was scored under; once it has recorded scores it is fixed. A stage whose layout has been cleared cannot be scored until one is set or the requirement is turned off. No layout is ever guessed from a stage total.

## Combat Shoot

Stages A and C are fired and scored as a detail. Stage B is fired individually, in any order.

```text
A = floor(detail hits for Stage A ÷ firers in that detail)
B = the firer's own Stage B hits
C = floor(detail hits for Stage C ÷ firers in that detail)
Total = A + B + C
```

Each division rounds down on its own: 59 hits over 6 firers is 9 and 65 over 6 is 10, so A + C is 19, not 20. Rounding a percentage into a threshold rounds up; these are different operations.

Averaging happens before best scores are chosen. A firer keeps the best Stage A average they earned, the best Stage B hits and the best Stage C average, and the three may come from different attempts. An average counts only if they were in that detail, so once details are mixed up, firers who started together can hold different scores. Best individual hits are never recombined into a new average.

Every Combat Shoot rifle fires the same rounds in Stage B, so a firer may use a different rifle for it. Stages A and C use the rifle on their roster.

## Details

| Conduct | Firers per detail | Rifle limit |
|---|---|---|
| CS (SP) | 4–6 | At most 2 non-SAR21 in total |
| CS (M) | 5–7 | At most 2 non-SAR21 in total |

Only Combat Shoot has detail sizes. Rosters can be arranged freely: sizes and rifle mixes are reported on the Participants tab and checked again when scores are confirmed or firers are redetailed, never by blocking an edit.

A temporary detail scores one stage with any mix of firers, for swaps and reruns. It belongs to that stage only, and must still satisfy the size and rifle limits and include at least one firer who can improve.

## Score entry

Hits are whole numbers from zero to the stage maximum. A blank is missing, not zero, and a missing stage leaves the total ungraded. Sections from different attempts are never combined, and each attempt keeps the layout and hits it was recorded under.

With the requirement turned off, Stages A and C take either every firer's hits or the detail total alone. Entering hits fills the total; a total typed by hand must match them exactly.

A detail confirmed on its total alone records no individual hits, but the total still bounds them. With `n` firers and a stage maximum of `m`, a total of `t` leaves no firer below `t − (n − 1)m` and none above `min(m, t)`. So 140 over 7 firers of 20 puts every one of them on 20, while proving a poor shot takes a total under what a pass asks of the stage.

Every available firer on the detail joins a new attempt. Skip marks a firer as not firing one stage without altering any past attempt or divisor. Too few available firers blocks scoring until someone is unskipped or a valid replacement detail is made, and a partly entered draft cannot silently change its roster.

## ATP rifles

An ATP result keeps one rifle throughout. The LMG fires 70, 8 and 48 rounds in ATP (M) and 60, 8 and 40 in ATP (SP), against 24, 8 and 16 and 16, 8 and 12 for the rifles, and is held to a different standard, so scores from two rifles never combine into one result. Changing a firer's rifle starts a separate record and is refused while any score they fired on the old one still counts.

## History

A name can be corrected at any time, with a reason, and replaces the old one wherever it was written. A rifle and a detail cannot: a recorded score is held to the standard of the rifle that fired it and belongs to the firers who were on the point. Both are fixed until the scores that still count are voided, and voiding one takes it from everyone in that detail.

Every attempt is kept — the stage, attempt number, rifle, hits or detail total with its firer count, who else was in the detail, and the confirmation time. Scores confirmed together share one timestamp.

Editing a score records a replacement and keeps the original, marked as edited. Voiding one keeps it with its reason. A voided score can be put back, with a reason of its own; one that a live edit has replaced cannot, since the replacement holds its place until it is voided in turn. Grades already recorded are never changed by later settings.

## Poor and strong shooters

A firer shoots poorly in a stage when their own hits are under half its rounds. Every pass mark sits at half the rounds or below, except the ATP (M) LMG, whose standard is far easier, so the pass pace caps the mark there rather than calling a comfortably passing gunner weak. They shoot strongly when their hits are at or above the share that keeps them on course for Marksman.

Both read a firer's own hits, never their detail's average, so a firer carried by a good detail can still be a poor shot — and is still the wrong person to lend to a detail that needs lifting. A poor shooter leaves the list once the stage has given them what they need, but the caution stays wherever a detail is being put together.

## Redetailing and operational rules

Each stage has a threshold deciding who is listed for a reshoot. Once a firer's other stages are scored, it becomes exactly what they still need for Marksman, capped at the stage maximum; before that, the starting value from Settings applies. ATP and CS Stage B starts at 7/8. A firer drops off on reaching Marksman or maxing the stage, and can still be sent again by hand.

Automatic order puts pass risk first, then the firers furthest below their target, because closing a large gap early removes the cases where Marksman becomes arithmetically unreachable. Proximity to a threshold is not evidence a firer will cross it next attempt.

Only one stage is open for entry at a time; unlocking another locks the previous one. Historical corrections keep their original confirmation time and do not consume a pending reshoot. Chronological order means the order score groups were confirmed, with lane order kept inside each group. Search changes visual priority only — never lane order, and never what a confirmation covers.

Repeated roster names block scoring and are highlighted; they are matched past case, spacing and full-width characters, and are never merged automatically.

Backups are schema 4; older formats are rejected rather than migrated. A shoot is replaced only when the incoming copy contains every local audit event and attempt plus newer events, so divergent copies keep the local shoot and new shoot IDs import independently. Wall-clock time is never used to decide.
