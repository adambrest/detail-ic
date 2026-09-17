# Detail IC

**[Open the app](https://adambrest.github.io/detail-ic/)** in your browser. Enable your shoot in Settings, paste in participants, then enter scores.

## Offline use

Open the app online once and let it finish loading. Add it to your home screen:

- **iPhone/iPad:** Safari → Share → Add to Home Screen.
- **Android:** Chrome → ⋮ → Add to home screen / Install.

Everything works offline once loaded. Rosters and scores stay on your device and are never sent to a server.

## Supported shoots

- BTP: SAR21.
- ATP (M): SAR21, SAR21 MMS, SAR21 SS, HK416, M203 and LMG.
- ATP (SP): SAR21, SAR21 MMS, M16 and M203. Up to 5 firers per detail.
- CS (M): SAR21, SAR21 SS, M203 and LMG. 5–7 firers per detail.
- CS (SP): SAR21, M16 and LMG. 4–6 firers per detail.
- APS: SAR21 and M16. APS (NS): SAR21.

Combat Shoot details allow at most two non-SAR21 weapons. Pass and Marksman thresholds for each weapon are under Settings → Scoring rules.

## Using Detail IC

Enable the shoots you need in Settings. On Participants, paste full names one per line and choose a rifle and detail. Use a participant's ⋯ menu to edit them, enter a score, view history or queue a reshoot.

Each stage has its own tab. Enter hits and save. A blank is missing, not zero. Every participant keeps their best score for each stage, and Final scores adds those together for Pass, Marksman or Fail.

Combat Shoot details score together. For Stages A and C, enter each firer's hits or the detail total with everyone accounted for. Each firer receives the detail total divided by the number of firers, rounded down. If you enter both, they must match. Stage B is always scored individually. Firers keep their best detail average, never an average rebuilt from individual bests.

For BTP, ATP and APS, changing a participant's rifle starts a new record. Scores from different rifles are never combined.

The Redetailing panel on each stage lists who still needs to shoot. Tick firers and choose Mark detailed; they wait for scores until their next result is saved. Automatic order puts first attempts first, then firers who can still reach Marksman (or Pass, set in Settings), closest to the goal first. You can also sort by lowest or highest score, or by who shot longest ago. Tap ⓘ beside a firer to see why they are listed. Suggested stage scores are planning guides, not official standards, and can be changed in Settings.

To fix a wrong score, open History from the ⋯ menu and choose Correct. The score is voided with a reason and kept in history; enter the right score afterward. Correcting a Combat Shoot A or C score voids it for the whole detail.

## Your data

Data is saved in this browser only. Clearing browser data deletes it, so use Settings → Export backup regularly. Restoring a backup replaces matching shoots and keeps the previous rosters under Earlier records. New roster does the same. Export scores on Final scores downloads a CSV.

## Run locally

Serve this directory with a static HTTP server, for example `python3 -m http.server 8080`, then open `http://localhost:8080`. No build step is required. Service workers require localhost or HTTPS.

For development checks:

```sh
npm ci
npm test
npx playwright install chromium webkit
npm run test:browser
```

Change `CACHE` in `sw.js` whenever app files change, or installed copies keep serving the old version. Scoring profiles are in `profiles.js`, with source notes in [docs/scoring-guidelines.md](docs/scoring-guidelines.md).

## Reproduction

Reproductions must credit the original creator and link to this repository. See [reuse permission](LICENSE.md).
