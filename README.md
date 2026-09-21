# Detail IC

Range scoring for BTP, ATP (M/SP), CS (M/SP), APS and APS (NS).

**[Open the app](https://adambrest.github.io/detail-ic/)**

Create a shoot, confirm the roster, then enter scores as they come in. Combat Shoot Stages A and C are scored as a detail; everything else is scored per firer.

## Using it

- **Scores** are entered section by section, per firer. One stage is open at a time: the first score entered opens it, and Unlock moves entry to another.
- **Redetailing** — Automatic order puts pass risk first, then whoever is furthest from their target. Skip marks a firer as not firing one stage, leaving their other scores alone.
- **History** keeps every attempt, correction and void, searchable by name, detail or score (`7/8`). A detail score is corrected as a whole.
- **Final scores** grade once every stage has a score. Done shooting closes the shoot and is reversible.

Warnings say how urgent something is by colour, and name the firers behind the count.

## Offline and backups

Open the app online once, then use your browser's Add to home screen. Everything lives in that browser on that device, so **export a backup from Shoots regularly**. Only V2 backups are accepted, and importing never replaces newer local scores.

## Development

- `npm test` — scoring, availability, breakdowns, import and validation
- `npm run test:browser` — Chromium and WebKit, mobile, offline, recovery and updates

[Scoring rules](docs/scoring-guidelines.md) has the thresholds, firing sequences and how each conduct is graded. Reuse terms are in [LICENSE.md](LICENSE.md).
