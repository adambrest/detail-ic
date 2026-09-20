# Detail IC

**[Open the app](https://adambrest.github.io/detail-ic/)** in your browser. Create a shoot, add and confirm participants, then enter scores as they come in. Supports BTP, ATP (M/SP), CS (M/SP), APS and APS (NS).

## Scoring

V2 requires individual sub-stage scores by default. Each stage is fired in sections; define them in Settings, one name and maximum per section, adding up to the rounds that stage fires.

Layouts ship for the stages whose firing sequence is known, and are the same for every rifle in that shoot:

| Shoot | Stage A | Stage B | Stage C |
|---|---|---|---|
| BTP | 4 × 4 | 4 × 4 | — |
| ATP (M) | 4 × 6 | 4 × 2 | 4 × 4 |
| ATP (SP) | 4 × 4 | 4 × 2 | 4 × 3 |
| CS (M) | 20 | 4 × 2 | 20 |
| CS (SP) | 5 + 10 | 4 × 2 | 5 + 10 |
| APS | Practices 2–5: 6 each | | |
| APS (NS) | Practices 1–3: 10 each | | |

**The LMG has no sub-stage layout in any shoot.** Its firing sequence has not been given, so its sub-stage boxes read *Sub-stages pending* and it is scored on the stage total.

A stage fired in one go still gets a single section, which keeps per-firer entry required without pretending the stage is subdivided. Sections are not always equal. The column header names them, so the boxes sit on one line with the stage total at the end; out-of-range entries are flagged as they are typed.

A Combat Shoot LMG is issued 30 rounds for Stages A and C though only 20 (CS (M)) or 15 (CS (SP)) can be credited. Enter the hits actually scored: the box takes the full allocation and an **i** note beside it says how many count. The credited figure is what enters the detail's total, while the real one is kept and shown in History and exports.

Any stage not listed above starts unset and is marked *Set sub-stages* in red in Settings. It cannot be scored while the requirement is on — set it, or turn the requirement off for total-only entry. No layout is ever guessed from a stage total.

Breakdowns are retained with each attempt, shown in History and Final scores, and included in CSV exports. Best parts from different attempts are never combined. Once a layout has recorded scores it is fixed for that version.

The first score entry activates that stage. Other stages stay readable and locked; use Unlock on another stage to transfer entry there. History corrections remain available and are audited.

Search brings matches to the top and highlights them without hiding anyone. Confirm scores still confirms every entered score. Lane order comes from the queue, not search order or typing order. Each confirmation is recorded as a group.

Shoots is a chooser: a shoot's own tabs appear once you open one, and going back to Shoots closes it again.

## Redetailing and Skip

Automatic order gives pass risk priority, then firers furthest below their target, allowing time to practice. Stage B starts at 7/8; all stage targets adjust as other scores arrive. Once every other stage is scored, advice uses the exact remaining requirement.

Skip marks a firer as not firing **one stage**, leaving their other stages and earned scores untouched. It sits in the firer's ⋯ menu, shows as a small badge on their row, and is refused while hits are typed for that stage. A short CS detail offers Unskip and Build replacement detail. The proposed replacement respects size, rifle limits and existing bookings, preferring suitable firers who still need the stage. Review the selection before creating it.

You can retry the same detail or use Manual detail. Suggestions based on past scores are optional, not predictions. The stage Summary is always on show; the groups within it stay folded, so routine scoring keeps the room.

## History and results

History can be searched by name, detail, score (for example 7/8), or a combination. Every record is a closed card that opens on a click, with nothing actionable until it does. It keeps what would matter in a recount — scores, corrections, voids, restores and redetails — and leaves working adjustments such as skips, priority changes and stage unlocks out. A detail score is corrected as a whole.

Dates read day-first with the month in letters and times are 24-hour (20 Sep · 14:30). The year appears only on the Shoots list and where a shoot was created.

Final scores show each firer once. A stage column shows the score alone, with its sub-stage figures in small grey text; only the total carries a denominator. Shoots are ordered by latest update; searching a name finds matching shoots and opens their history.

## Offline use and backups

Open the app online once, then install it using your browser's Add to home screen option. Scores are local to this browser/device. Export backups regularly from Shoots.

V2 uses its own storage and accepts only V2 backups. Backups from before V2 are invalid and are not migrated. Importing the same shoot keeps local data unless the incoming audit demonstrably extends the local history; older and conflicting copies do not replace it. A failed save is marked as unsaved with Export backup and Retry save controls.

## Development

- `npm test`: scoring, availability, breakdown and backup validation tests.
- `npm run test:browser`: Chromium/WebKit workflows, mobile/offline use, recovery, updates and V2 scenarios.

See [scoring rules](docs/scoring-guidelines.md) and [V2 implementation notes](docs/v2-changes.md).

## Reproduction

Reproductions must credit the original creator and link to this repository. See [reuse permission](LICENSE.md).
