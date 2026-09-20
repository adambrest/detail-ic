# Application audit — 20 September 2026

Reviewed the local application across BTP, ATP (M/SP), CS (M/SP), APS and APS (NS): setup, roster editing, individual and detail scoring, redetailing, temporary details, history, final results, settings, backup and offline recovery. Findings concern the application's implementation of its documented rules; this is not independent certification of the shooting standards.

## Assessment

The scoring foundation is well tested. The larger weaknesses are managing real-world availability, presenting reliable operational advice, and finding the people behind an aggregate warning. The application can calculate earned results, but does not yet provide a dependable answer to “what should we run with the time and people left?”

**Status:** the findings below were recorded during the review. They have since been worked through for V2 (version 2.0.0); see the resolution table at the end of this document and [V2 implementation notes](v2-changes.md) for how each was handled. The findings themselves are left as written, as the record of what was found.

## Highest-priority findings

### 1. Stage B can hide the exact reshoot that earns Marksman

**Confirmed by executable reproduction.** In ATP (M), rifle scores A=20, B=7, C=11 give 38/48. B=8 would earn Marksman at 39. Instead, `advice()` says “needs 7 for Marksman” and `queue(s, "B")` is empty.

Conversely, with A=23 and C=12, only 4 in B is needed, but the advice still says 7. `target()` returns the fixed Stage B training target before calculating the actual remaining requirement. `advice()` then labels that target as exact when the other stages are complete.

**Fix:** Separate a starting/training target from the exact qualification requirement. Once other stages are known, use the exact requirement for advice and reshoot eligibility. If the requirement exceeds the maximum, say that another stage must also improve. Cover ATP rifle/LMG and both CS variants.

Evidence: `core.js`, `target`, `advice`, `goal`, `queue`.

### 2. Search changes what confirmation appears to cover, but not what it saves

**Confirmed in Chromium.** Enter Alice=10 and Bob=11 in BTP Stage A. Search Alice. The panel says “1 in the queue” and “1 of 1 entered.” Press Confirm scores: **both scores are saved**, including Bob's hidden entry.

An invalid hidden entry can likewise block confirmation of a visible valid one. The displayed counts use filtered rows; `confirmScores()` reads all stage entries.

**Fix:** Make confirmation scope explicit and consistent. Either confirm visible entries only, preserving the others as drafts, or show the full pending count and require a review of hidden entries. Apply the same principle to selected redetail entries retained across searches.

Evidence: `app.js`, `individualPanel`, `confirmScores`, `redetail`.

### 3. A firer falling ill has no persistent operational status

**Confirmed from the data model and executable scenarios.** Skip is tied to one stage, queue entity and attempt. Skipping CS Stage C skips the whole detail; the sick person's Stage B entry remains active. A person with scores cannot be removed. Changing their permanent detail requires voiding their existing scores, which is inappropriate when those scores were valid.

There is a partial workaround: build a temporary detail with the available people, provided composition rules can be met. It does not record why someone stopped, remove them from other recommendations, or distinguish them from someone merely awaiting scores. Skip is also hidden when only one queue entry remains.

**Fix:** Add active, temporarily unavailable, and withdrawn states, with reason and time. Preserve earned scores and historical rosters. Exclude unavailable people from dispatch and helper selection, flag existing commitments, and support return to duty. Show operational status separately from grade. For an undersized CS detail, propose valid replacements or explain the shortage; never silently change the historical divisor.

Evidence: `core.js`, `removeParticipant`, `updateParticipant`, `setSkipped`, `entities`, `buildAround`; `app.js`, `skipButton` and its callers.

### 4. Importing an older backup replaces newer results for the same shoot

**Confirmed by code inspection.** Restore assigns each incoming shoot over the local shoot with the same ID. The dialog provides no comparison of local and incoming attempts, no conflict choice and no automatic pre-import snapshot. Importing a colleague's copy is replacement, not score merging.

**Fix:** Preview added/replaced shoots and score counts, preserve a recovery snapshot, and offer import-as-copy. Treat merging as a separate workflow using record IDs and explicit conflict handling.

Evidence: `app.js`, `restore`.

### 5. Failed persistence still follows the success path

**Storage failure reproduced; success-path defect confirmed by code inspection.** A stale local tab correctly refuses to overwrite another tab's changes. However, score confirmation ignores the `false` returned by `save()`, clears entry drafts in memory, renders confirmed results, and schedules a “score saved” toast. The storage warning is present, but the operator receives contradictory signals. Reload loses the unsaved work unless it was exported.

**Fix:** Distinguish recorded-in-memory from saved-on-device. On persistence failure, retain a clear unsaved state and offer recovery/export. Do not issue saved confirmations until persistence succeeds. Check other mutating handlers for the same pattern.

Evidence: `app.js`, `save`, `confirmScores`, `runRedetail`.

## Operational and reporting findings

### 6. Automatic order does not maximize Marksman outcomes under time pressure

Automatic deliberately prioritizes pass risk, then the largest normalized deficit. That is a practice/support policy, not a strategy for gaining the most Marksmen in the remaining time. A person one hit short can sit behind someone much further away. “Highest score first” is only a rough workaround: stage score is not the same as total qualification gap, and CS details have several beneficiaries.

**Improve:** Offer explicit operating objectives: finish first attempts, secure passes, or maximize additional Marksmen. For the last option, show the required stage gain, who would qualify, number of firers/helpers involved, and resource assumptions. Do not present a success probability without sufficient evidence.

Evidence: `core.js`, `queue`; `app.js`, `methodInfo`.

### 7. Final scores duplicate people who belong to temporary details

**Confirmed in Chromium.** Four CS (SP) participants plus a temporary detail containing the same four produce eight final-table rows, while the summary correctly says four incomplete. `renderFinal()` iterates every detail, including temporary ones; the CSV independently iterates participants once.

**Fix:** Render each participant once in final results. Show the source detail/attempt for each earned stage separately. Temporary and retired details belong in attempt history, not additional final nominal rolls. Include unassigned participants in a clearly identified group.

Evidence: `app.js`, `renderFinal`; `core.js`, `exportCsv`.

### 8. Finding a person is fragmented

Stage and History search exist, but Final scores has no search, the Shoots page has no search, and there is no search across shoots. Tab changes clear the current query. Names are only substring-matched on operational tabs; a permanent detail number is not part of that participant search.

**Improve:** Add final-result search and filters for incomplete/fail/pass/Marksman. Preserve a selected person across stage/history navigation. Add a cross-shoot lookup with date/type filters and a stable participant identifier before attempting longitudinal analytics.

Evidence: `app.js`, `filtered`, `renderFinal`, `renderShoots`, tab click handler.

### 9. Summary warnings hide people without a way to open the full list

Warnings are grouped, with some groups showing three names and “N more.” Rendering then truncates each category to eight items and another “N more.” These are plain text, not expandable lists or links. The Summary also ignores the current name search.

**Improve:** Every warning count should open the complete affected-person list, with a route to each person's scores and relevant action. Label the Summary as shoot-wide when the rest of the page is filtered, or filter it consistently.

Evidence: `core.js`, `insights/grouped`; `app.js`, `summaryPanel`.

### 10. Helper recommendations can overstate present ability and speed

Strength and proposed averages use best historical hits or bounds on best performance. A person who once scored highly but is now tiring can still be selected as a strong helper. The UI calls this an “Expected average” and says a rebuilt detail “clears it faster,” although it measures neither duration nor likelihood of repeating those best hits.

**Improve:** Label the number “Average if recorded best scores are repeated.” Show latest attempts, sample size and whether values are individual hits or inferred bounds. Compare a plan's beneficiaries and cost rather than promising it is faster. Keep qualification based on best earned scores, but use separate evidence for operational recommendations.

Evidence: `core.js`, `hitsRange`, `firerHits`, `buildAround`; `app.js`, `queuePanel`, `manualDetailDialog`.

### 11. Availability checks are stage-specific

`committed()` and overlap detection check the proposed stage. The same person can be committed to a pending detail on A and C. This may be legitimate future planning, but the app does not distinguish planned, called, on the firing point, and awaiting score entry. “Free right now” therefore claims more than the data establishes.

**Improve:** Distinguish future plans from current occupancy. If multiple stages operate concurrently, provide a cross-stage conflict warning. Use “not assigned to another pending [stage] detail” until real availability is tracked.

Evidence: `core.js`, `committed`, `overlapping`, `buildAround`.

### 12. Historical order is entry order, not necessarily firing order

Attempts store confirmation time. Several scores confirmed together share a time, and chronological redetail ordering uses those times. A late-entered score changes the apparent firing order. The UI and README can suggest it is the order people actually fired.

**Improve:** Label this “score entry order,” or capture fired-at separately from recorded-at. Preserve both for delayed transcription and corrections. Do not derive range throughput from confirmation timestamps alone.

Evidence: `core.js`, `recordIndividual`, `queue`; `app.js`, `confirmScores`.

### 13. Identical real names are treated as a roster error

The roster blocks confirmation until every normalized name is different. Two genuine people with the same name require artificial name edits, and separately imported shoots cannot reliably identify the same person.

**Improve:** Keep names intact and add a visible discriminator such as roster/service identifier or unit. Detect accidental duplicate records using that identifier. Permit genuine same-name participants.

Evidence: `core.js`, `rosterIssues`.

### 14. The history screen does not expose every operational change

Raw audit entries exist for skips and priorities, but `historyFeed()` does not display them. Roster changes are consolidated into one nominal-roll card rather than a complete chronological operational timeline. There is no operator identity beyond “Local device.”

**Improve:** Keep the score-focused history, with an optional operations filter for availability, dispatch, cancellation and priority changes. Distinguish event time, recorded time and operator where accountability is needed. Searching a person should reveal relevant operational events too.

Evidence: `core.js`, `audit`, `historyFeed`, `setSkipped`, `setPriority`.

## Analytics available today

| Area | Available | Limitation |
|---|---|---|
| Qualification | Best eligible score per stage, complete total, grade | Incomplete total is blank; partial progress is elsewhere |
| Progress | Grade counts, stage scored/waiting counts | No withdrawn/absent/in-progress denominator |
| Reachability | Maximum attainable from unscored stages, pass risk, required reshoot stages | Assumes perfect remaining scores; not a forecast |
| Reshoot guidance | Dynamic thresholds, priority overrides, several orderings | Stage B exception can give wrong exact advice; no time budget |
| Ability | Poor/strong flags, own best hits, bounds from detail totals | Best performance is not recent consistency |
| Repetition | Attempts and a “not improving” warning | No measured benefit per extra detail or rounds spent |
| CS planning | Proposed helpers, estimated average, remaining-detail plan | Stage-local availability and historical bests; no measured completion time |
| Audit | Scores, edits, voids/restores, detail membership, dispatch history | Search is shoot-local; some operational audit events are hidden |
| Export | Final-results CSV with winning attempt IDs; full JSON backup | No convenient attempt-level or operational analytics export |

## Analytics worth adding

1. **Conduct completion:** active, unavailable, withdrawn, awaiting first attempt, awaiting reshoot, and complete, by stage. Show both planned and active denominators.
2. **Qualification opportunity:** exact current gap, stages that can close it, one-stage versus multi-stage recovery, and named beneficiaries of a proposed detail.
3. **Marginal return:** passes/Marksmen gained per additional attempt/detail; distinguish people firing from people whose result improved.
4. **Resource planning:** remaining time, lanes/detail capacity, available helpers and ammunition budget. Present projected results with explicit assumptions.
5. **Recent performance:** latest versus best, improvement over attempts, consistency, attempt count, and confidence/unknown indicators for aggregate-only records.
6. **Data completeness:** missing individual hits, unconfirmed drafts, pending dispatches, incomplete stages, and unsaved-device state.
7. **Longitudinal lookup:** person → shoots → rifle/stage → attempts and qualifications, with stable identity and comparable scoring profiles.

## Text cleanup

Applied: removed **Next** badges/highlighting from both individual and detail scoring panels. Queue positions remain a display order, not an enforced firing sequence. The items below were recommended at the time; all have since been applied in V2 except where the resolution table says otherwise.

- Replace “needs 7” with the actual requirement; show an optional training target separately.
- Replace “clears it faster” with a specific, qualified comparison of projected outcomes.
- Replace “drags everyone ... down” with neutral evidence such as “recorded hits reduce this detail's average.”
- Replace “De-detail” with “Cancel redetail.”
- Replace “Above threshold” with the target it refers to, where that distinction affects a decision.
- Avoid “Everyone has a score” for an empty search result; say “No matching firers awaiting scores.”
- Show entered-count text once per score panel instead of repeating it at top and bottom.
- Move repeated scoring explanations into contextual help; retain missing-score, composition, unsaved-work and shared-correction explanations where they prevent mistakes.

## Resolution

| # | Finding | Status in V2 |
|---|---|---|
| 1 | Stage B hides the reshoot that earns Marksman | Fixed. Starting target and exact requirement separated; advice and queue eligibility use the exact requirement once other stages are scored |
| 2 | Search changes what confirmation appears to cover | Fixed. Search reorders and highlights, hides nothing; confirmation covers every entered score |
| 3 | Illness has no persistent status | Fixed. Skip marks a firer unavailable shoot-wide, preserving scores and historical rosters; short CS details offer Unskip or Build replacement detail |
| 4 | Older backup replaces newer results | Fixed. Import replaces only a strict descendant; results reported as added/updated/kept. No V1 migration |
| 5 | Failed persistence follows the success path | Fixed. Drafts retained, no success toast, persistent warning with Export backup and Retry save |
| 6 | Automatic order and time pressure | Unchanged by decision. Pass risk then furthest behind is the intended policy; proximity to a threshold is not evidence of crossing it |
| 7 | Final scores duplicate temporary-detail members | Fixed. Each participant renders once; temporary details stay in attempt history |
| 8 | Finding a person is fragmented | Improved. Search covers names, rifles, details, scores, totals and grades across stages, History, Final scores and the shoot list. Cross-shoot longitudinal lookup remains open |
| 9 | Warnings hide people with no way to open the list | Fixed. Warning groups are complete and expandable |
| 10 | Helper recommendations overstate ability and speed | Fixed. Wording cites recorded scores, claims no speed benefit, and presents retrying the same detail as normal |
| 11 | Availability checks are stage-specific | Addressed via Skip, which is shoot-wide. Distinguishing planned from on-the-firing-point remains open |
| 12 | Historical order is entry order | Fixed. Attempts record confirmation group and lane; the order option is named Confirmation order |
| 13 | Identical names treated as a roster error | Kept as an error by decision, now highlighted in red as a detailing mistake |
| 14 | History omits operational changes | Fixed. Skips, unlocks, priority changes, cancellations and restores appear in the feed and are searchable |
| — | Sub-stage breakdowns (added after the review) | Implemented and required by default. Only ATP/CS Stage B ships a layout; all others must be set in Settings rather than guessed |

Analytics listed under *Analytics worth adding* remain open apart from availability counts, which Skip now provides.

## Validation and recommended order

Baseline: all 83 Node scoring tests passed. Existing browser workflows passed in Chromium and WebKit, including mobile/offline checks. Recovery and update suites also passed. Additional isolated Chromium/core scenarios reproduced hidden-score confirmation, Stage B advice/queue errors, illness/skip limitations, duplicate final rows, and refused stale-state persistence. Test data was synthetic and isolated from the user's live application.

Recommended implementation sequence:

1. Correct exact Stage B advice/eligibility, confirmation scope, failed-save feedback, backup overwrite protection and duplicate final rows.
2. Add availability/withdrawal and valid detail replacement workflows without changing earned history.
3. Add final/global lookup and full warning drill-down.
4. Add explicit time-pressure objectives, resource inputs and honestly labelled recommendations.
5. Trim repetitive copy after the behavior and terminology are settled.

These checks exercise representative flows and inspect the shared code used by all shoot types; they do not establish that every device, roster size or combination of historical corrections is bug-free.
