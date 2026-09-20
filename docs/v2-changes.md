# V2 implementation notes

What changed between V1 and V2, and the reasoning behind each decision. For the shooting standards themselves see [scoring rules](scoring-guidelines.md).

## Storage and compatibility

V2 has no migration path. It reads and writes `detail-ic-v2-store`, a separate key from V1's `detail-ic-v2`, so both can exist on a device without either corrupting the other. `validateStore` accepts `schema: 4` only and rejects anything else with a message naming V2. `migrateStore` and the rifle-repair helpers are gone, along with their tests.

The practical consequence: **V1 backups cannot be restored into V2.** Finish a shoot in V1 or re-enter it.

Dropping migration made one existing check dangerous. `validateStore` rejected any stored participant or attempt whose `profile.version` did not equal the current `profiles.js` VERSION — a date string that changes whenever a threshold is corrected. With no migration left, the next correction would have made every saved V2 store fail to load, and the app would have fallen back to an empty store. It now validates that the profile is well formed and belongs to the right program, variant and rifle, without requiring the version to match. Each participant and attempt keeps the profile snapshot it was recorded under, which is the point of storing one: a later correction does not silently re-grade history.

## Import no longer overwrites by timestamp

V1 restore assigned each incoming shoot over the local shoot of the same ID. Importing a colleague's older copy silently destroyed newer local scores.

`importBackup` replaces a local shoot only when the incoming copy is a strict descendant of it: the incoming audit is longer, contains every local audit event by ID, and retains every local attempt by ID. Anything else is counted as kept. Wall-clock time is never used to decide, because two devices editing the same shoot both have recent timestamps and neither is authoritative.

The result is reported as added / updated / kept, so a restore that changed nothing says so rather than appearing to succeed silently.

## Stage locks

The first confirmed score sets `activeStage`. `recordIndividual`, `saveDetail` and `dispatch` all call `requireActiveStage`, so the lock is enforced in core rather than only hidden in the UI. Other stages stay readable, with their inputs disabled and an Unlock button that transfers entry.

Corrections from History are exempt: they pass a `reason` and bypass the check, so a mistake in a locked stage can still be fixed and is audited.

## Availability (Skip)

`setPersonSkipped` marks a participant unavailable for the whole shoot rather than for one stage or queue entry. Skipped firers keep every earned score and stay in historical detail rosters, but are excluded from queues, dispatch, helper selection and replacement plans, and cannot have new scores recorded.

`availableMembers` is used for live operational membership; `members` still returns the full historical roster. This distinction is what keeps a CS detail's divisor honest — a skipped firer does not retroactively change what a past attempt was scored over.

If skipping leaves a CS detail below its minimum, the detail shows the shortage with two ways out: unskip the firer (the likelier case, a misclick), or **Build replacement detail**, which proposes a valid roster respecting size, rifle limits and existing bookings, preferring firers who still need the stage. The proposal is editable before it is created.

Changing availability while a detail has partly entered scores throws rather than silently re-averaging.

## Sub-stage breakdowns

Stages can be scored as parts. `store.requireBreakdown` is on by default; per-shoot it is `settings.requireBreakdown`. When required, the total input is read-only and computed from the parts, so a total can never disagree with its breakdown.

Layouts are defined per rifle and stage in Settings and are stored on the shoot, so a shoot keeps the layout it was scored under. Once a layout has recorded scores it cannot be changed for that version.

Layouts are derived from a stated firing sequence per shoot — see the table in the README. A stage fired in one go gets a single part, which still forces per-firer entry without pretending the stage is subdivided.

A layout's parts sum to the **rounds fired** (`inputMax`), not to the credited maximum. A Combat Shoot LMG fires 30 in Stages A and C but is credited 20 (CS (M)) or 15 (CS (SP)), so the cap is applied in `scoreRows` via `Math.min(value, component.max)` while `rawHits` retains the true entry. `parseBreakdown` and `validateStore` both validate against `inputMax ?? max`; they disagreed at one point, which would have let a correct LMG layout save but fail at scoring.

Where a rifle is issued more rounds than the stage credits, the score box accepts all of them, shows the real figure, and carries an **i** note saying how many can be credited. The arithmetic uses the lower of the two. Three places had to agree for this to work: the score box's own maximum, which previously came from the participant's profile rather than the rifle they fired that stage on; the detail total the UI fills in as hits are typed, which summed raw hits and so refused its own figure as out of range; and the layout dialog in Settings, which validated against the credited maximum and therefore rejected the shipped LMG layout.

Sub-sections are not always equal — CS (SP) Stages A and C are 5 + 10 for a SAR21 and 10 + 20 for an LMG — so `SECTIONS` records the rounds in each section rather than a count to divide by. A weapon name inside a shoot's entry overrides the default for that weapon alone.

The safety net is a sum check: a layout ships only when its sections add up to the rounds that weapon actually fires in that stage. That is what leaves **Stage A of the ATP LMG** unset — 70 rounds in ATP (M) and 60 in ATP (SP) fit no stated split, so nothing is shipped and Settings asks. Their Stage C splits four ways like the SAR21's. Earlier drafts generated `Part 1..4` layouts by dividing each stage total by four; that invented standards that were never confirmed, and is now blocked by a test that checks every shipped layout against the stated sequence.

Breakdowns are stored on the attempt, survive edits, appear in History, Final scores and CSV, and are never recombined across attempts — a best stage shows the breakdown of the attempt that actually earned it.

## Search reorders instead of filtering

Search previously hid non-matching rows while Confirm scores still saved the hidden entries. Matching rows are now moved to the top and highlighted, and nothing is hidden, so what is confirmed is always what is shown. `matchFirst` performs a stable sort by match, and search now covers names, rifles, details, scores (`7/8`), totals and grades across stages, History, Final scores and the shoot list.

## Lane and confirmation order

Attempts record a `batchId` (the confirmation group) and a `lane` within it, assigned in queue order rather than object-key or typing order. Confirmation order sorts by last-fired time and then by lane, which keeps a stable order for scores confirmed together. The order option previously labelled *Chronological* is now **Confirmation order**, because confirmation time is what is actually recorded.

## Advice uses the exact requirement

`target` returns the starting training threshold — Stage B begins at 7/8. Once every other stage is scored, `advice` and queue eligibility switch to the exact remaining requirement.

This fixes a case where a firer on A=20, B=7, C=11 (38/48, Marksman at 39) was told they needed 7 and excluded from Stage B reshoots, when 8 would have qualified them. It also stops the opposite overstatement: A=23, C=12 now correctly reports 4 rather than 7.

Ordering policy is unchanged on purpose. Automatic still puts pass risk first, then the firers furthest below their target, because those firers need the practice most and closing a large gap early removes the cases where Marksman becomes arithmetically unreachable. Proximity to a threshold is not evidence a firer will cross it next attempt.

## Failed saves

`save` returns whether persistence succeeded. Callers no longer follow the success path on failure: drafts are kept, no confirmation toast is issued, and a persistent warning offers **Export backup** and **Retry save**. Work stays in memory and exportable rather than appearing saved and disappearing on reload.

## Other corrections

- Final scores render each participant once. Temporary and retired details belong to attempt history, not to the nominal roll.
- Warning lists are complete and expandable; no count ends in "and more" with no way to see the rest.
- Duplicate roster names are blocked and highlighted in red, treated as a detailing error rather than silently accepted.
- Misleading **Next** badges were removed; queue position is a display order, not an enforced firing sequence.
- Advice wording was made non-committal: suggestions cite recorded scores, do not claim a rebuilt detail is faster, and present retrying the same detail as a normal option.
- The retired light support weapon is not a rifle option and appears nowhere in the source. A test enforces this repo-wide.
- ATP (SP) LMG was held in `REFERENCE_ONLY` as `excluded_by_user` and is now a supported rifle, since ATP and Combat Shoot are fired with the full range of weapons. Its thresholds come from source S11: pass 27, Marksman 54, out of 108. BTP and APS remain SAR21 only.

## Tests

- `npm test` — scoring, availability, locks, breakdowns, import and validation.
- `npm run test:browser` — Chromium and WebKit workflows, mobile and offline use, recovery, service-worker updates, and the V2 scenarios.
