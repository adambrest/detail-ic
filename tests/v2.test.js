import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as c from "../core.js";
import {
  TYPES,
  weaponsFor,
  defaultBreakdowns,
  profileFor,
} from "../profiles.js";

function setup(program = "ATP_M", count = 1) {
  const store = c.newStore(),
    s = c.createShoot(store, program);
  const people = c.addParticipants(
    s,
    Array.from(
      { length: count },
      (_, i) => `Firer ${String.fromCharCode(65 + i)}`,
    ).join("\n"),
    s.settings.weapon,
  );
  return { store, s, people, p: people[0] };
}
const score = (s, p, stage, hits, parts) => {
  c.activateStage(s, stage);
  return c.recordIndividual(
    s,
    p,
    stage,
    String(hits),
    p.weapon,
    "",
    c.now(),
    parts,
  );
};

test("Stage B advice and eligibility use exact qualification gaps", () => {
  for (const [a, b, d, need] of [
    [20, 7, 11, 8],
    [23, 0, 12, 4],
  ]) {
    const { s, p } = setup();
    s.settings.requireBreakdown = false;
    score(s, p, "A", a);
    score(s, p, "C", d);
    score(s, p, "B", b);
    assert.equal(c.advice(s, p, "B").score, need);
    assert.equal(c.queue(s, "B").length, 1);
    score(s, p, "B", need);
    assert.equal(c.result(s, p).status, "Marksman");
  }
});
test("Required breakdown rejects missing and excessive parts; zero is a score", () => {
  const { s, p } = setup();
  assert.equal(s.settings.requireBreakdown, true);
  s.settings.breakdowns[`${p.weapon}:B`] = [1, 2, 3, 4].map((i) => ({
    label: `Part ${i}`,
    max: 2,
  }));
  assert.throws(() => score(s, p, "B", 8), /every sub-stage/);
  assert.throws(() => score(s, p, "B", 8, [2, 2, 2, 3]), /0.*2/);
  assert.throws(() => score(s, p, "B", 8, [2, 2, 2, ""]), /Missing/);
  assert.equal(s.attempts.length, 0);
  const a = score(s, p, "B", 999, [2, 0, 1, 2]);
  assert.equal(a.score, 5);
  assert.deepEqual(
    a.breakdown.map((p) => p.hits),
    [2, 0, 1, 2],
  );
  const edited = c.editIndividual(s, a.id, "", p.weapon, [2, 2, 2, 2]);
  assert.equal(edited.score, 8);
  assert.equal(a.status, "void");
  assert.equal(edited.recordedAt, a.recordedAt);
  assert.equal(edited.lane, a.lane);
  // Every sub-score is its own column, so the file sorts and totals like a
  // sheet instead of hiding the figures inside one cell.
  const [head, row] = c
    .exportCsv(s)
    .trim()
    .split("\n")
    .map((line) => line.slice(1, -1).split('","'));
  assert.equal(head.length, row.length);
  const at = (label) => row[head.indexOf(label)];
  assert.deepEqual(
    [1, 2, 3, 4].map((i) => at(`Stage B · Part ${i}`)),
    ["2", "2", "2", "2"],
  );
});
test("Best stage keeps the breakdown from its actual winning attempt", () => {
  const { s, p } = setup();
  s.settings.breakdowns[`${p.weapon}:B`] = [
    { label: "First", max: 4 },
    { label: "Second", max: 4 },
  ];
  const a = score(s, p, "B", 0, [4, 1]);
  score(s, p, "B", 0, [1, 4]);
  assert.equal(c.best(s, p, "B"), 5);
  assert.equal(c.bestAttempt(s, p, "B").id, a.id);
  assert.deepEqual(
    c.bestAttempt(s, p, "B").breakdown.map((p) => p.hits),
    [4, 1],
  );
});
test("Stage lock rejects another stage but permits historical corrections", () => {
  const { s, p } = setup();
  s.settings.requireBreakdown = false;
  const a = score(s, p, "A", 20);
  assert.equal(s.activeStage, "A");
  assert.throws(() => c.recordIndividual(s, p, "B", "7"), /locked/);
  c.activateStage(s, "B");
  c.recordIndividual(s, p, "B", "7");
  c.editIndividual(s, a.id, "21", p.weapon);
  assert.equal(s.activeStage, "B");
});
test("Skip preserves scores, excludes reshoots, and replacement fills a short detail", () => {
  const { s, people } = setup("CS_SP", 8);
  s.settings.requireBreakdown = false;
  c.autoDetail(s);
  const d = s.details[0],
    person = c.members(s, d.id)[0];
  const draft = c.getDraft(s, d.id, "A");
  draft.aggregate = "40";
  c.saveDetail(s, draft);
  c.setPersonSkipped(s, person.id, "A", true);
  assert.equal(c.best(s, person, "A"), 10);
  assert.equal(c.availableMembers(s, d.id, "A").length, 3);
  // Skipping Stage A leaves Stage C untouched: availability is per stage.
  assert.deepEqual(c.stageCompositionErrors(s, d.id, "C"), []);
  assert.match(c.stageCompositionErrors(s, d.id, "A").join(" "), /Too few/);
  c.setPersonSkipped(s, person.id, "B", true);
  assert.equal(
    c.queue(s, "B").some((e) => e.members.includes(person)),
    false,
  );
  c.setPersonSkipped(s, person.id, "B", false);
  const plan = c.replacementPlan(s, d.id, "A");
  assert.equal(plan.length, 4);
  assert.ok(!plan.includes(person));
  c.setPersonSkipped(s, person.id, "A", false);
  assert.equal(c.availableMembers(s, d.id, "A").length, 4);
});
test("Changing availability cannot silently change a partly entered detail", () => {
  const { s, people } = setup("CS_SP", 5);
  s.settings.requireBreakdown = false;
  c.autoDetail(s);
  const d = s.details[0],
    draft = c.getDraft(s, d.id, "A");
  draft.rows[0].hits = "10";
  c.setPersonSkipped(s, people[1].id, "A", true);
  assert.throws(() => c.saveDetail(s, draft), /Roster changed/);
  assert.equal(s.attempts.length, 0);
});
test("CS per-firer breakdowns sum before detail averaging and survive editing", () => {
  const { s, people } = setup("CS_SP", 4);
  c.autoDetail(s);
  s.settings.breakdowns[`${people[0].weapon}:A`] = [
    { label: "One", max: 5 },
    { label: "Two", max: 10 },
  ];
  const draft = c.getDraft(s, s.details[0].id, "A");
  draft.aggregate = "40";
  assert.throws(() => c.saveDetail(s, draft), /sub-stage/);
  draft.aggregate = "";
  draft.rows.forEach((r) => {
    r.parts = [4, 6];
    r.hits = "10";
  });
  const d = c.saveDetail(s, draft);
  assert.equal(d.score, 10);
  assert.equal(d.aggregateHits, 40);
  const edited = c.editDetailAttempt(
    s,
    d.id,
    people.map((p) => ({
      participantId: p.id,
      weapon: p.weapon,
      hits: "",
      parts: [5, 10],
    })),
  );
  assert.equal(edited.score, 15);
  assert.equal(edited.recordedAt, d.recordedAt);
  assert.ok(
    s.attempts
      .filter((a) => a.detailAttemptId === edited.id)
      .every((a) => a.recordedAt === d.recordedAt && a.breakdown.length === 2),
  );
});
test("Older and divergent imports preserve local scores; descendant imports advance", () => {
  const { store, s, p } = setup();
  s.settings.requireBreakdown = false;
  store.requireBreakdown = false;
  const old = structuredClone(store);
  score(s, p, "A", 20);
  assert.equal(c.importBackup(store, old).kept, 1);
  assert.equal(c.best(s, p, "A"), 20);
  const later = structuredClone(store),
    ls = later.shoots[0];
  score(ls, ls.participants[0], "B", 7);
  assert.equal(c.importBackup(store, later).updated, 1);
  assert.equal(store.shoots[0].attempts.length, 2);
  const divergent = structuredClone(old);
  score(divergent.shoots[0], divergent.shoots[0].participants[0], "C", 12);
  assert.equal(c.importBackup(store, divergent).kept, 1);
  assert.equal(store.shoots[0].attempts.length, 2);
});
test("V2 rejects old formats and invalid imported scores", () => {
  assert.throws(
    () => c.validateStore({ schema: 3, presets: {}, shoots: [] }),
    /V2/,
  );
  const { store, s, p } = setup();
  s.settings.requireBreakdown = false;
  score(s, p, "B", 7);
  s.attempts[0].score = 99;
  assert.throws(() => c.validateStore(store), /Invalid score/);
});
// The withdrawn light support weapon must not appear as a rifle option, nor
// anywhere in the shipped source, not even as an unsupported or legacy mention.
// Its name is assembled here so this guard does not match its own source.
const RETIRED = ["S", "A", "W"].join("");
test(`${RETIRED} appears nowhere in the app`, () => {
  for (const [program, variant] of TYPES)
    for (const weapon of weaponsFor(program, variant))
      assert.doesNotMatch(weapon, new RegExp(RETIRED, "i"));
  const root = new URL("..", import.meta.url),
    pattern = new RegExp(`\\b${RETIRED}\\b`),
    offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (/^(node_modules|\.git|icons)$/.test(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(js|cjs|mjs|css|html|md|json|webmanifest)$/.test(entry.name))
        readFileSync(path, "utf8")
          .split("\n")
          .forEach((line, i) => {
            if (pattern.test(line)) offenders.push(`${entry.name}:${i + 1}`);
          });
    }
  };
  walk(fileURLToPath(root));
  assert.deepEqual(offenders, []);
});
// Every shipped layout is one that was stated for the real shoot, and its parts
// add up to the rounds fired. Stages whose layout is still unknown stay unset
// rather than being invented from a stage total.
test("Shipped sub-stage layouts match the stated firing sequence", () => {
  const stated = {
    "BTP SAR21": { A: [4, 4, 4, 4], B: [4, 4, 4, 4] },
    "ATP_M SAR21/SAR21 MMS/M203": {
      A: [6, 6, 6, 6],
      B: [2, 2, 2, 2],
      C: [4, 4, 4, 4],
    },
    "ATP_M SAR21 SS/HK416": {
      A: [6, 6, 6, 6],
      B: [2, 2, 2, 2],
      C: [4, 4, 4, 4],
    },
    // No LMG sequence has been stated for any stage yet.
    "ATP_M LMG": {},
    "ATP_SP SAR21/SAR21 MMS/M203": {
      A: [4, 4, 4, 4],
      B: [2, 2, 2, 2],
      C: [3, 3, 3, 3],
    },
    "ATP_SP LMG": {},
    "CS_M SAR21/SAR21 SS/M203": { A: [20], B: [2, 2, 2, 2], C: [20] },
    "CS_M LMG": {},
    "CS_SP SAR21/SAR21 SS": { A: [5, 10], B: [2, 2, 2, 2], C: [5, 10] },
    "CS_SP LMG": {},
    "APS SAR21": { 2: [6], 3: [6], 4: [6], 5: [6] },
    "APS:ns SAR21": { 1: [10], 2: [10], 3: [10] },
  };
  for (const [program, variant] of TYPES)
    for (const weapon of weaponsFor(program, variant)) {
      const shipped = defaultBreakdowns(program, variant),
        key = `${program}${variant === "ns" ? ":ns" : ""} ${weapon}`,
        got = Object.fromEntries(
          Object.entries(shipped)
            .filter(([k]) => k.startsWith(`${weapon}:`))
            .map(([k, parts]) => [
              k.slice(weapon.length + 1),
              parts.map((p) => p.max),
            ]),
        );
      assert.deepEqual(got, stated[key], key);
    }
  // A layout's parts must cover the rounds fired, not the credited maximum.
  for (const [program, variant] of TYPES)
    for (const weapon of weaponsFor(program, variant)) {
      const profile = profileFor(program, variant, weapon);
      for (const [k, parts] of Object.entries(
        defaultBreakdowns(program, variant),
      )) {
        if (!k.startsWith(`${weapon}:`)) continue;
        const comp = profile.components.find(
          (x) => x.id === k.slice(weapon.length + 1),
        );
        assert.equal(
          parts.reduce((n, p) => n + p.max, 0),
          comp.inputMax ?? comp.max,
          k,
        );
      }
    }
});
// ATP LMG Stage A awaits its breakdown, so it cannot be scored yet.
test("A stage with no stated layout cannot be scored", () => {
  const { s, p } = setup("ATP_M");
  c.updateParticipant(s, p.id, { name: p.name, weapon: "LMG" });
  for (const stage of ["A", "B", "C"])
    assert.deepEqual(c.breakdownFor(s, "LMG", stage), [], stage);
  assert.throws(
    () => score(s, s.participants[0], "A", 40),
    /breakdown in Settings/,
  );
  // A SAR21 firer in the same shoot is unaffected.
  const [other] = c.addParticipants(s, "Rifleman", s.settings.weapon);
  assert.equal(score(s, other, "A", "", [6, 6, 6, 6]).score, 24);
});
// The LMG fires more rounds than Combat Shoot credits. The entry is kept whole
// and the cap is applied when the detail's hits are summed.
test("A CS LMG is entered over 30 rounds but credited at the stage maximum", () => {
  const { s, people } = setup("CS_SP", 4);
  s.settings.requireBreakdown = false;
  c.autoDetail(s);
  c.updateParticipant(s, people[0].id, {
    name: people[0].name,
    weapon: "LMG",
    detailId: people[0].detailId,
  });
  // 30 rounds are issued for Stages A and C though only 15 can be credited.
  const lmg = profileFor("CS_SP", "standard", "LMG").components.find(
    (x) => x.id === "A",
  );
  assert.equal(lmg.inputMax, 30);
  assert.equal(lmg.max, 15);
  const draft = c.getDraft(s, s.details[0].id, "A");
  draft.rows.forEach((r) => {
    r.hits = r.participantId === people[0].id ? "22" : "15";
  });
  const d = c.saveDetail(s, draft);
  const a = s.attempts.find((x) => x.participantId === people[0].id);
  assert.equal(a.rawHits, 22, "the real score is kept");
  assert.equal(a.score, 15, "credited at the stage maximum");
  assert.equal(d.aggregateHits, 60);
  assert.equal(d.score, 15);
});

test("Changing shoot type clears everything keyed by the old stages", () => {
  const { store, s } = setup();
  c.activateStage(s, "C");
  s.entries = { "C:x": "5" };
  c.changeShootType(s, "BTP");
  c.applyPreset(store, s);
  assert.equal(s.activeStage, null);
  assert.deepEqual(s.entries, {});
  assert.deepEqual(Object.keys(s.settings.breakdowns), ["SAR21:A", "SAR21:B"]);
  c.validateStore(structuredClone(store));
  // APS and APS (NS) share a rifle name and stage ids but not round counts.
  const aps = c.createShoot(store, "APS", "standard");
  c.changeShootType(aps, "APS", "ns");
  c.applyPreset(store, aps);
  assert.equal(c.breakdownFor(aps, "SAR21", "2")[0].max, 10);
});
// Settings is where a layout is edited, so it must reach later shoots too.
test("A layout set in Settings applies to a new shoot of that type", () => {
  const store = c.newStore();
  c.preset(store, "BTP").breakdowns["SAR21:A"] = [
    { label: "Grouping", max: 8 },
    { label: "Application", max: 8 },
  ];
  const s = c.createShoot(store, "BTP");
  assert.deepEqual(
    c.breakdownFor(s, "SAR21", "A").map((p) => p.label),
    ["Grouping", "Application"],
  );
});
// A row's total stays blank until every part is in, so parts must count as
// input or a half-entered table is discarded underneath the recorder.
test("Half-entered sub-stage scores are not treated as an empty draft", () => {
  const { s, people } = setup("CS_SP", 5);
  c.autoDetail(s);
  const draft = c.getDraft(s, s.details[0].id, "A");
  draft.rows.forEach((r) => (r.parts = ["5", ""]));
  assert.equal(Object.keys(s.drafts).length, 1);
  c.setPersonSkipped(s, people[4].id, "A", true);
  assert.equal(Object.keys(s.drafts).length, 1, "skip discarded the draft");
  c.assignDetail(s, people[1].id, 2);
  assert.equal(Object.keys(s.drafts).length, 1, "reassigning discarded it");
});
test("Redetailing a skipped firer reports them instead of crashing", () => {
  const { s, p } = setup("ATP_M", 3);
  c.activateStage(s, "A");
  c.setPersonSkipped(s, p.id, "A", true);
  assert.throws(() => c.dispatch(s, "A", [`person:${p.id}`]), /Unskip/);
});
// A skipped firer's requirement must not drive what their detail is told to aim
// for, since they are not the one firing it again.
test("Weak-detail advice ignores firers who are skipped", () => {
  const { s, people } = setup("CS_SP", 5);
  s.settings.requireBreakdown = false;
  c.autoDetail(s);
  const d = s.details[0];
  for (const [stage, hits] of [
    ["C", 70],
    ["A", 30],
  ]) {
    c.activateStage(s, stage);
    const draft = c.getDraft(s, d.id, stage);
    draft.aggregate = String(hits);
    c.saveDetail(s, draft);
  }
  c.activateStage(s, "B");
  people.forEach((p, i) => c.recordIndividual(s, p, "B", i === 4 ? "2" : "8"));
  const weakest = c.insights(s, "A").find((n) => n.title === "Weak details");
  c.setPersonSkipped(s, people[4].id, "A", true);
  const after = c.insights(s, "A").find((n) => n.title === "Weak details");
  assert.notDeepEqual(after?.items, weakest?.items);
});
// Finishing closes every stage at once and is reversible.
test("A shoot is finished only once every stage is scored", () => {
  const { s, p } = setup();
  s.settings.requireBreakdown = false;
  assert.equal(c.allScored(s), false);
  assert.throws(() => c.setFinished(s, true), /score in every stage/);
  score(s, p, "A", 20);
  score(s, p, "B", 7);
  assert.equal(c.allScored(s), false, "Stage C is still open");
  score(s, p, "C", 12);
  assert.equal(c.allScored(s), true);
  // A firer skipped out of a stage is not holding the shoot open, but their
  // result stays incomplete and the gap is reported.
  const [other] = c.addParticipants(s, "Late Arrival", s.settings.weapon);
  assert.equal(c.allScored(s), false);
  for (const st of ["A", "B", "C"]) c.setPersonSkipped(s, other.id, st, true);
  assert.equal(c.allScored(s), true);
  assert.equal(c.outstanding(s).length, 0);
  assert.equal(c.skippedGaps(s).length, 3);
  assert.equal(c.result(s, other).status, "Incomplete");
  c.setFinished(s, true);
  assert.equal(s.activeStage, null);
  assert.throws(() => c.recordIndividual(s, p, "A", "21"), /finished/);
  c.setFinished(s, false);
  c.activateStage(s, "A");
  assert.equal(c.recordIndividual(s, p, "A", "21").score, 21);
});
// Marksman is the objective, so losing it is critical rather than a caution.
test("Losing Marksman is a critical alert", () => {
  const { s, p } = setup();
  s.settings.requireBreakdown = false;
  // 20 + 0 leaves at most 36: a pass is still reachable, Marksman is not.
  score(s, p, "A", 20);
  score(s, p, "B", 0);
  const notes = c.insights(s);
  assert.equal(
    notes.find((n) => n.title === "Marksman not possible")?.level,
    "bad",
  );
  assert.equal(
    notes.some((n) => n.title === "Pass not possible"),
    false,
  );
});
test("History keeps score records and leaves working adjustments out", () => {
  const { s, p } = setup();
  s.settings.requireBreakdown = false;
  c.updateParticipant(s, p.id, { name: p.name, weapon: "LMG" });
  score(s, p, "A", 60);
  c.setPersonSkipped(s, p.id, "A", true);
  const feed = c.historyFeed(s);
  assert.equal(
    feed.some((e) => /skip/i.test(e.title ?? "")),
    false,
    "a skip is not a recountable change",
  );
  assert.equal(feed.find((e) => e.kind === "score").people[0].max, 70);
});
