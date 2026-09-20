# Detail IC

**[Open the app](https://adambrest.github.io/detail-ic/)** in your browser. Create a shoot, add and confirm participants, then enter scores as they come in. Supports BTP, ATP (M/SP), CS (M/SP), APS and APS (NS).

## Scoring

V2 requires individual sub-stage scores by default. Define each stage's parts in Settings: one name and maximum per part, with maximums adding up to the stage total.

Layouts ship for the stages whose firing sequence is known:

| Shoot | Rifle | Stage A | Stage B | Stage C |
|---|---|---|---|---|
| BTP | SAR21 | 4 × 4 | 4 × 4 | — |
| ATP (M) | SAR21 variants | 4 × 6 | 4 × 2 | 4 × 4 |
| ATP (M) | LMG | *unset* | 4 × 2 | 4 × 12 |
| ATP (SP) | SAR21 variants | 4 × 4 | 4 × 2 | 4 × 3 |
| ATP (SP) | LMG | *unset* | 4 × 2 | 4 × 10 |
| CS (M) | SAR21 variants | 20 | 4 × 2 | 20 |
| CS (M) | LMG | 30, credited 20 | 4 × 2 | 30, credited 20 |
| CS (SP) | SAR21 variants | 5 + 10 | 4 × 2 | 5 + 10 |
| CS (SP) | LMG | 10 + 20, credited 15 | 4 × 2 | 10 + 20, credited 15 |
| APS | SAR21 | Practices 2–5: 6 each | | |
| APS (NS) | SAR21 | Practices 1–3: 10 each | | |

A stage fired in one go still gets a single part, which keeps per-firer entry required without pretending the stage is subdivided. Sub-sections are not always equal.

Parts add up to the **rounds fired**, not to what can be credited. A Combat Shoot LMG firer is issued 30 rounds for Stages A and C and breaks the stage down over all 30. Enter the hits actually scored: the box accepts the full allocation and an **i** note beside it says how many can be credited. The stage maximum (20 in CS (M), 15 in CS (SP)) is what enters the detail's total, while the real figure is kept and shown in History and exports.

Any stage not listed above starts unset and is marked *Set sub-stages* in red in Settings. It cannot be scored while the requirement is on — set it, or turn the requirement off for total-only entry. No layout is ever guessed from a stage total.

Breakdowns are retained with each attempt, shown in History and Final scores, and included in CSV exports. Best parts from different attempts are never combined. Once a layout has recorded scores it is fixed for that version.

The first score entry activates that stage. Other stages stay readable and locked; use Unlock on another stage to transfer entry there. History corrections remain available and are audited.

Search brings matches to the top and highlights them without hiding anyone. Confirm scores still confirms every entered score. Lane order comes from the queue, not search order or typing order. Each confirmation is recorded as a group.

## Redetailing and Skip

Automatic order gives pass risk priority, then firers furthest below their target, allowing time to practice. Stage B starts at 7/8; all stage targets adjust as other scores arrive. Once every other stage is scored, advice uses the exact remaining requirement.

Skip makes a firer unavailable across the shoot while preserving earned scores. A short CS detail offers Unskip and Build replacement detail. The proposed replacement respects size, rifle limits and existing bookings, preferring suitable firers who still need the stage. Review the selection before creating it.

You can retry the same detail or use Manual detail. Suggestions based on past scores are optional, not predictions. Summary and additional advice are collapsed so routine scoring stays prominent.

## History and results

History can be searched by name, detail, score (for example 7/8), or a combination. Matching records open automatically; other records remain available. It retains corrections, voids, restores, skips and stage changes. A detail score is corrected as a whole.

Final scores show each firer once, with the breakdown of the actual attempt contributing each best stage. Shoots are ordered by latest update; searching a name finds matching shoots and opens their history.

## Offline use and backups

Open the app online once, then install it using your browser's Add to home screen option. Scores are local to this browser/device. Export backups regularly from Shoots.

V2 uses its own storage and accepts only V2 backups. Backups from before V2 are invalid and are not migrated. Importing the same shoot keeps local data unless the incoming audit demonstrably extends the local history; older and conflicting copies do not replace it. A failed save is marked as unsaved with Export backup and Retry save controls.

## Development

- `npm test`: scoring, availability, breakdown and backup validation tests.
- `npm run test:browser`: Chromium/WebKit workflows, mobile/offline use, recovery, updates and V2 scenarios.

See [scoring rules](docs/scoring-guidelines.md) and [V2 implementation notes](docs/v2-changes.md).

## Reproduction

Reproductions must credit the original creator and link to this repository. See [reuse permission](LICENSE.md).
