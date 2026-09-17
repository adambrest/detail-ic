import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REFERENCE_ONLY,
  VERSION,
  weaponsFor,
  weaponGroup,
  profileFor,
} from "../profiles.js";
import {
  newStore,
  newShoot,
  createShoot,
  enableShoot,
  getShoot,
  preset,
  applyPresets,
  changeShootType,
  addDetail,
  addParticipants,
  parseRoster,
  assignDetail,
  detailIssues,
  members,
  compositionErrors,
  fillWeapons,
  updateParticipant,
  getDraft,
  setPresent,
  validateDraft,
  saveDetail,
  recordIndividual,
  best,
  bestAttempt,
  result,
  scoreHistory,
  voidAttempt,
  undoAttempt,
  queue,
  dispatch,
  notYetShot,
  setPriority,
  manualQueue,
  exportCsv,
  migrateStore,
  validateStore,
} from "../core.js";
const rifle = (program, variant = "standard") => weaponsFor(program, variant)[0];
function setup(program = "BTP", variant = "standard", n = 1, weapon) {
  const s = newShoot(program, variant),
    d = program.startsWith("CS_") ? addDetail(s) : null,
    people = addParticipants(
      s,
      Array.from({ length: n }, (_, i) => `Person ${i + 1}`),
      weapon ? weaponGroup(program, variant, weapon) : rifle(program, variant),
      d?.id,
    );
  return { s, d, people, p: people[0] };
}
function complete(s, p, total) {
  for (const c of p.profile.components) {
    const hits = Math.min(c.max, total);
    recordIndividual(s, p, c.id, String(hits));
    total -= hits;
  }
}
function detailScore(
  s,
  d,
  stage,
  total,
  { weapons = {}, individuals, absent = [] } = {},
) {
  const draft = getDraft(s, d.id, stage);
  if (total !== null) draft.aggregate = String(total);
  draft.rows.forEach((r, i) => {
    r.accounted = !absent.includes(i);
    if (weapons[i]) r.weapon = weapons[i];
    if (individuals) r.hits = String(individuals[i]);
  });
  return saveDetail(s, draft);
}
for (const [program, variant, weapon, pass, marksman] of [
  ["BTP", "standard", "SAR21", 16, 26],
  ["ATP_M", "standard", "SAR21", 24, 39],
  ["ATP_M", "standard", "HK416", 32, 39],
  ["ATP_M", "standard", "LMG", 32, 63],
  ["ATP_SP", "standard", "M16", 18, 29],
  ["APS", "standard", "M16", 12, 20],
  ["APS", "ns", "SAR21", 15, 24],
])
  test(`${program} ${variant} ${weapon} exact thresholds`, () => {
    for (const [total, status] of [
      [pass - 1, "Fail"],
      [pass, "Pass"],
      [marksman - 1, "Pass"],
      [marksman, "Marksman"],
    ]) {
      const { s, p } = setup(program, variant, 1, weapon);
      complete(s, p, total);
      assert.equal(result(s, p).status, status);
      assert.equal(result(s, p).total, total);
    }
  });
for (const [program, n, pass, marksman, max] of [
  ["CS_M", 5, 24, 39, 20],
  ["CS_SP", 4, 19, 31, 15],
])
  test(`${program} exact thresholds`, () => {
    for (const [total, status] of [
      [pass - 1, "Fail"],
      [pass, "Pass"],
      [marksman - 1, "Pass"],
      [marksman, "Marksman"],
    ]) {
      const { s, d, people } = setup(program, "standard", n);
      let left = total;
      const a = Math.min(max, left);
      left -= a;
      const b = Math.min(8, left);
      left -= b;
      detailScore(s, d, "A", a * n);
      detailScore(s, d, "B", null, { individuals: people.map(() => b) });
      detailScore(s, d, "C", left * n);
      assert.equal(result(s, people[0]).status, status);
    }
  });
test("Rifles with identical scoring share one option", () => {
  assert.deepEqual(weaponsFor("BTP"), ["SAR21"]);
  assert.deepEqual(weaponsFor("ATP_SP"), ["SAR21/SAR21 MMS/M16/M203"]);
  assert.deepEqual(weaponsFor("APS"), ["SAR21/M16"]);
  assert.deepEqual(weaponsFor("ATP_M"), [
    "SAR21/SAR21 MMS/M203",
    "SAR21 SS/HK416",
    "LMG",
  ]);
  assert.deepEqual(weaponsFor("CS_M"), ["SAR21/SAR21 SS/M203", "LMG"]);
  assert.deepEqual(weaponsFor("CS_SP"), ["SAR21", "M16/LMG"]);
  assert.equal(weaponGroup("CS_M", "standard", "M203"), "SAR21/SAR21 SS/M203");
});
test("Unsupported rifles stay out of selectors and scoring", () => {
  assert.throws(() => profileFor("BTP", "standard", "LMG"));
  assert.throws(() => profileFor("ATP_SP", "standard", "LMG"));
  assert.throws(() => profileFor("APS", "standard", "LMG"));
  assert.throws(() => profileFor("APS", "ns", "M16"));
  assert.equal(REFERENCE_ONLY[0].total, 108);
  assert.ok(!weaponsFor("ATP_SP").some((w) => w.includes("LMG")));
});
test("Shoots need an enabled type; disabling a type keeps its shoots", () => {
  const store = newStore();
  assert.deepEqual(store.enabled, []);
  assert.throws(() => createShoot(store, "BTP", "standard", "Alpha"), /Enable/);
  enableShoot(store, "BTP", true);
  const s = createShoot(store, "BTP", "standard", "Alpha");
  assert.equal(getShoot(store), s);
  addParticipants(s, ["A"], "SAR21");
  enableShoot(store, "BTP", false);
  assert.equal(getShoot(store).participants.length, 1);
  enableShoot(store, "BTP", true);
  const second = createShoot(store, "BTP", "standard", "Bravo");
  assert.equal(store.shoots.length, 2);
  assert.equal(store.active, second.id);
});
test("Presets apply their Automatic priority and suggestions to shoots", () => {
  const store = newStore();
  enableShoot(store, "ATP_M", true);
  const s = createShoot(store, "ATP_M", "standard", "Alpha");
  const pr = preset(store, "ATP_M");
  pr.objective = "pass";
  pr.targets["LMG:A:pass"] = 20;
  applyPresets(store);
  assert.equal(s.settings.objective, "pass");
  assert.equal(s.settings.targets["LMG:A:pass"], 20);
});
test("Shoot type can change until scores are recorded", () => {
  const { s, p } = setup("ATP_M", "standard", 9, "HK416");
  s.name = "ATP (M) · Sep 18, 2026";
  changeShootType(s, "CS_SP");
  assert.equal(s.name, "CS (SP) · Sep 18, 2026");
  assert.equal(p.weapon, "SAR21");
  assert.equal(p.detailId, null);
  assert.equal(members(s, null).length, 9);
  changeShootType(s, "BTP");
  assert.equal(p.profile.id, "BTP:standard:SAR21");
  recordIndividual(s, p, "A", "10");
  assert.throws(() => changeShootType(s, "ATP_M"), /new shoot/);
});
test("Pasted rosters read detail numbers from CSV, TSV or a trailing number", () => {
  assert.deepEqual(parseRoster("Alex Tan, 2\nBen Lee\t1\nChris Wong 3\nDana", true), [
    { name: "Alex Tan", detail: 2 },
    { name: "Ben Lee", detail: 1 },
    { name: "Chris Wong", detail: 3 },
    { name: "Dana", detail: null },
  ]);
  assert.deepEqual(parseRoster("Team 7", false), [
    { name: "Team 7", detail: null },
  ]);
  const s = newShoot("CS_SP");
  addParticipants(s, "A,1\nB,1\nC,1\nD,1\nE", "SAR21");
  assert.equal(members(s, s.details[0].id).length, 4);
  assert.match(detailIssues(s).join(" "), /1 participant needs a detail/);
});
test("Detail buttons assign firers; skipped, small and large details are reported", () => {
  const s = newShoot("CS_SP"),
    people = addParticipants(s, "A\nB\nC\nD\nE\nF\nG\nH", "SAR21");
  people.slice(0, 3).forEach((p) => assignDetail(s, p.id, 1));
  people.slice(3).forEach((p) => assignDetail(s, p.id, 3));
  const issues = detailIssues(s).join("\n");
  assert.match(issues, /Detail 2 is skipped/);
  assert.match(issues, /Detail 1: Too few firers: 3\/4/);
  people.slice(3).forEach((p) => assignDetail(s, p.id, 2));
  assignDetail(s, people[7].id, 1);
  assert.deepEqual(detailIssues(s), []);
  people.forEach((p) => assignDetail(s, p.id, 1));
  assert.match(detailIssues(s).join(" "), /Too many firers: 8\/6/);
  const t = setup("CS_SP", "standard", 4);
  detailScore(t.s, t.d, "A", 40);
  assert.throws(() => assignDetail(t.s, t.p.id, 2), /recorded scores/);
});
test("CS floors each stage before addition: 59/6 + 65/6 = 9+10", () => {
  const { s, d, p } = setup("CS_SP", "standard", 6);
  detailScore(s, d, "A", 59);
  detailScore(s, d, "C", 65);
  detailScore(s, d, "B", null, { individuals: [0, 0, 0, 0, 0, 0] });
  assert.equal(best(s, p, "A"), 9);
  assert.equal(best(s, p, "C"), 10);
  assert.equal(result(s, p).total, 19);
  assert.equal(result(s, p).status, "Pass");
});
test("Firers marked not present are left out of that attempt only", () => {
  const { s, d, people } = setup("CS_SP", "standard", 5);
  setPresent(s, d.id, "A", people[4].id, false);
  const a = saveDetail(s, Object.assign(getDraft(s, d.id, "A"), { aggregate: "44" }));
  assert.equal(a.divisor, 4);
  assert.equal(best(s, people[0], "A"), 11);
  assert.equal(best(s, people[4], "A"), null);
  assert.deepEqual(a.absent, [people[4].id]);
  assert.ok(getDraft(s, d.id, "A").rows.every((r) => r.accounted));
  const draft = getDraft(s, d.id, "A");
  draft.rows.forEach((r) => (r.accounted = false));
  assert.match(validateDraft(s, draft).errors.join(" "), /Everyone is marked not present/);
});
test("CS detail sizes and ATP (SP) redetail limit", () => {
  for (const [program, n] of [
    ["CS_SP", 3],
    ["CS_M", 4],
  ]) {
    const { s, d } = setup(program, "standard", n);
    assert.match(compositionErrors(s, members(s, d.id)).join(" "), /Too few/);
    assert.throws(() => detailScore(s, d, "A", 0));
  }
  for (const [program, n] of [
    ["CS_SP", 7],
    ["CS_M", 8],
  ]) {
    const { s, d } = setup(program, "standard", n);
    assert.match(compositionErrors(s, members(s, d.id)).join(" "), /Too many/);
  }
  const { s } = setup("ATP_SP", "standard", 6);
  assert.throws(
    () => dispatch(s, "A", queue(s, "A").map((e) => e.key)),
    /Up to 5 firers/,
  );
  dispatch(s, "A", queue(s, "A").slice(0, 5).map((e) => e.key));
  assert.equal(setup("ATP_M", "standard", 50).people.length, 50);
});
test("Combined non-SAR21 cap applies to roster and stage rifles", () => {
  const { s, d, people } = setup("CS_SP", "standard", 6);
  for (const i of [0, 1])
    updateParticipant(s, people[i].id, {
      name: people[i].name,
      detailId: d.id,
      weapon: "M16/LMG",
    });
  assert.throws(
    () =>
      updateParticipant(s, people[2].id, {
        name: people[2].name,
        detailId: d.id,
        weapon: "M16/LMG",
      }),
    /non-SAR21/,
  );
  const draft = getDraft(s, d.id, "A");
  draft.rows[2].weapon = "M16/LMG";
  draft.aggregate = "30";
  assert.match(validateDraft(s, draft).errors.join(" "), /non-SAR21/);
  assert.throws(() => saveDetail(s, draft));
  assert.throws(() => dispatch(s, "A", [`detail:${d.id}`]), /non-SAR21/);
});
test("M203 counts as SAR21 in CS (M); fill all checks the cap", () => {
  const { s, people } = setup("CS_M", "standard", 5, "M203");
  assert.deepEqual(compositionErrors(s, people), []);
  assert.throws(() => fillWeapons(s, "LMG"), /non-SAR21/);
  fillWeapons(s, "SAR21/SAR21 SS/M203");
  assert.ok(people.every((p) => p.weapon === "SAR21/SAR21 SS/M203"));
});
test("Mixed rifles in CS share thresholds and keep the rifle per stage", () => {
  const { s, d, p } = setup("CS_SP", "standard", 4);
  detailScore(s, d, "A", 52, { weapons: { 0: "M16/LMG" } });
  detailScore(s, d, "B", null, { individuals: [8, 8, 8, 8] });
  detailScore(s, d, "C", 40);
  assert.equal(result(s, p).status, "Marksman");
  assert.equal(bestAttempt(s, p, "A").weapon, "M16/LMG");
  assert.equal(bestAttempt(s, p, "B").weapon, "SAR21");
  assert.equal(best(s, p, "A"), 13);
});
test("CS best is selected from earned averaged attempts, never raw individual bests", () => {
  const { s, d, p } = setup("CS_SP", "standard", 4);
  detailScore(s, d, "A", null, { individuals: [15, 0, 0, 0] });
  detailScore(s, d, "A", null, { individuals: [0, 15, 15, 15] });
  assert.equal(best(s, p, "A"), 11);
  assert.deepEqual(
    scoreHistory(s, p, "A").map((a) => a.score),
    [3, 11],
  );
  const bestId = bestAttempt(s, p, "A").detailAttemptId;
  assert.equal(s.shared.find((a) => a.id === bestId).aggregateHits, 45);
});
test("An average cannot be borrowed from a detail the participant did not attend", () => {
  const { s, d, people } = setup("CS_SP", "standard", 4),
    other = addDetail(s),
    others = addParticipants(s, ["B1", "B2", "B3", "B4"], "SAR21", other.id);
  detailScore(s, d, "A", 12);
  detailScore(s, other, "A", 60);
  assert.equal(best(s, people[0], "A"), 3);
  assert.equal(best(s, others[0], "A"), 15);
  const fake = {
    ...s.attempts.find((a) => a.participantId === others[0].id),
    participantId: people[0].id,
  };
  s.attempts.push(fake);
  assert.equal(best(s, people[0], "A"), 3);
});
test("Duplicate, missing and unexpected participants block confirmation", () => {
  for (const mode of ["duplicate", "missing", "unexpected", "snapshot"]) {
    const { s, d } = setup("CS_SP", "standard", 4),
      draft = getDraft(s, d.id, "A");
    draft.aggregate = "20";
    if (mode === "duplicate") draft.rows.push({ ...draft.rows[0] });
    if (mode === "missing") draft.rows.pop();
    if (mode === "unexpected") draft.rows[0].participantId = "outsider";
    if (mode === "snapshot") draft.rosterIds.pop();
    assert.ok(validateDraft(s, draft).errors.length);
    assert.throws(() => saveDetail(s, draft));
  }
});
test("Detail totals and individual hits must match", () => {
  const { s, d } = setup("CS_SP", "standard", 4),
    draft = getDraft(s, d.id, "A");
  draft.aggregate = "21";
  draft.rows.forEach((r) => (r.hits = "5"));
  assert.match(validateDraft(s, draft).errors.join(" "), /difference 1/);
  draft.aggregate = "20";
  draft.rows[0].hits = "";
  assert.match(validateDraft(s, draft).errors.join(" "), /Missing hits/);
  draft.rows[0].hits = "5";
  const a = saveDetail(s, draft);
  assert.equal(a.inputMode, "reconciled");
  assert.equal(a.individualsVerified, true);
});
test("Stage B requires individual scores; missing is not zero", () => {
  const { s, d, p } = setup("CS_SP", "standard", 4);
  const draft = getDraft(s, d.id, "B");
  draft.aggregate = "20";
  assert.match(
    validateDraft(s, draft).errors.join(" "),
    /Individual results are required/,
  );
  assert.throws(() => saveDetail(s, draft));
  draft.aggregate = "";
  draft.rows.forEach((r) => (r.hits = "0"));
  saveDetail(s, draft);
  assert.equal(best(s, p, "B"), 0);
  assert.equal(result(s, p).status, "Incomplete");
});
test("Invalid fractional, negative and excessive counts never become scores", () => {
  for (const hits of ["", "-1", "1.5", "16", "Infinity"]) {
    const { s, d } = setup("CS_SP", "standard", 4);
    const draft = getDraft(s, d.id, "A");
    draft.rows.forEach((r) => (r.hits = hits));
    assert.throws(() => saveDetail(s, draft));
    const one = setup("BTP");
    assert.throws(() =>
      recordIndividual(one.s, one.p, "A", hits === "16" ? "17" : hits),
    );
  }
  const { s, d } = setup("CS_SP", "standard", 4);
  assert.throws(() => detailScore(s, d, "A", 61));
});
test("Changing an individual's rifle starts a separate record", () => {
  const { s, p } = setup("ATP_M");
  recordIndividual(s, p, "A", "24");
  const oldId = p.recordId;
  assert.throws(() => recordIndividual(s, p, "B", "8", "LMG"));
  updateParticipant(s, p.id, { name: p.name, weapon: "LMG" }, "Changed rifle");
  assert.notEqual(p.recordId, oldId);
  assert.equal(best(s, p, "A"), null);
  assert.equal(s.attempts[0].weapon, "SAR21/SAR21 MMS/M203");
  assert.equal(s.attempts[0].profile.version, VERSION);
  complete(s, p, 63);
  assert.equal(result(s, p).status, "Marksman");
});
test("Best stages may come from different attempts; corrections keep shared history", () => {
  const { s, d, p } = setup("CS_SP", "standard", 4);
  detailScore(s, d, "A", 52);
  const a = bestAttempt(s, p, "A");
  detailScore(s, d, "A", 40);
  assert.equal(best(s, p, "A"), 13);
  assert.throws(() => voidAttempt(s, a.id, ""));
  voidAttempt(s, a.id, "Wrong sheet");
  assert.equal(best(s, p, "A"), 10);
  assert.equal(s.shared[0].status, "void");
  assert.equal(s.attempts.filter((a) => a.status === "void").length, 4);
  assert.equal(s.attempts.length, 8);
});
test("Roster corrections keep historical membership and make old entries stale", () => {
  const { s, d, p } = setup("CS_SP", "standard", 4);
  detailScore(s, d, "A", 40);
  getDraft(s, d.id, "C").aggregate = "20";
  const other = addDetail(s);
  addParticipants(s, ["Other 1", "Other 2", "Other 3"], "SAR21", other.id);
  updateParticipant(
    s,
    p.id,
    { name: p.name, weapon: p.weapon, detailId: other.id },
    "Roster correction",
  );
  assert.equal(best(s, p, "A"), 10);
  assert.equal(s.shared[0].roster.length, 4);
  assert.match(
    validateDraft(s, getDraft(s, d.id, "C")).errors.join(" "),
    /Roster changed/,
  );
});
test("Score → redetail → score, with undo reopening the redetail", () => {
  const { s, p } = setup();
  recordIndividual(s, p, "A", "8");
  assert.equal(queue(s, "A").length, 1);
  dispatch(s, "A", [queue(s, "A")[0].key]);
  assert.equal(queue(s, "A").length, 0);
  const a = recordIndividual(s, p, "A", "13");
  assert.equal(s.dispatches[0].status, "scored");
  undoAttempt(s, a.id);
  assert.equal(s.dispatches[0].status, "awaiting");
  assert.equal(best(s, p, "A"), 8);
  recordIndividual(s, p, "A", "13");
  assert.equal(queue(s, "A").length, 0);
  manualQueue(s, p, "A");
  assert.equal(queue(s, "A").length, 1);
});
test("Confirmed CS detail closes its redetail even with someone not present", () => {
  const { s, d, people } = setup("CS_SP", "standard", 5);
  detailScore(s, d, "A", 20);
  dispatch(s, "A", [`detail:${d.id}`]);
  setPresent(s, d.id, "A", people[0].id, false);
  detailScore(s, d, "A", 40, { absent: [0] });
  assert.equal(s.dispatches[0].status, "scored");
});
test("Priority tags put firers first or last, sorted within each group", () => {
  const { s, people } = setup("BTP", "standard", 4);
  [5, 11, 8, 2].forEach((hits, i) => recordIndividual(s, people[i], "A", String(hits)));
  const order = () => queue(s, "A").map((e) => e.members[0].name);
  s.settings.order = "lowest";
  assert.deepEqual(order(), ["Person 4", "Person 1", "Person 3", "Person 2"]);
  setPriority(s, `person:${people[1].id}`, "high");
  setPriority(s, `person:${people[3].id}`, "low");
  assert.deepEqual(order(), ["Person 2", "Person 1", "Person 3", "Person 4"]);
  setPriority(s, `person:${people[3].id}`, null);
  assert.equal(order().at(-1), "Person 3");
});
test("Shoot first, shoot again first follows the time of each firer's last score", async () => {
  const { s, people } = setup("BTP", "standard", 3);
  s.settings.order = "first";
  for (const i of [2, 0, 1]) {
    recordIndividual(s, people[i], "A", "5");
    await new Promise((done) => setTimeout(done, 5));
  }
  assert.deepEqual(
    queue(s, "A").map((e) => e.members[0].name),
    ["Person 3", "Person 1", "Person 2"],
  );
});
test("Participants without a first score are listed for the redetail prompt", () => {
  const { s, people } = setup("BTP", "standard", 3);
  recordIndividual(s, people[0], "A", "5");
  assert.deepEqual(
    notYetShot(s, "A").map((p) => p.name),
    ["Person 2", "Person 3"],
  );
});
test("CSV export escapes formulas and lists details only for Combat Shoot", () => {
  const { s, p } = setup();
  p.name = "=HYPERLINK()";
  const csv = exportCsv(s);
  assert.match(csv, /"'=HYPERLINK\(\)"/);
  assert.ok(!csv.split("\r\n")[0].includes("Detail"));
  assert.ok(exportCsv(setup("CS_SP", "standard", 4).s).split("\r\n")[0].includes("Detail"));
});
test("Unknown or incompatible profile versions cannot enter best score selection", () => {
  const { s, p } = setup();
  recordIndividual(s, p, "A", "16");
  s.attempts[0].profile.version = "older";
  assert.equal(best(s, p, "A"), null);
});
test("Backup round trip keeps shoots, drafts, presence and best attempt IDs", () => {
  const store = newStore();
  enableShoot(store, "CS_SP", true);
  const s = createShoot(store, "CS_SP", "standard", "Alpha"),
    people = addParticipants(s, "A 1\nB 1\nC 1\nD 1", "SAR21"),
    d = s.details[0];
  detailScore(s, d, "A", 44);
  getDraft(s, d.id, "C").aggregate = "30";
  setPresent(s, d.id, "C", people[3].id, false);
  const restored = validateStore(migrateStore(JSON.parse(JSON.stringify(store)))),
    rs = getShoot(restored);
  assert.equal(rs.drafts[`${d.id}:C`].aggregate, "30");
  assert.equal(rs.drafts[`${d.id}:C`].rows[3].accounted, false);
  assert.equal(
    result(rs, rs.participants[0]).bestAttemptIds[0],
    result(s, people[0]).bestAttemptIds[0],
  );
});
test("Saved data from the previous version moves to grouped rifles and shoot lists", () => {
  const old = {
    schema: 2,
    enabled: ["ATP_M"],
    active: "ATP_M",
    aps: "standard",
    archives: [],
    shoots: {
      ATP_M: {
        id: "old-shoot",
        program: "ATP_M",
        variant: "standard",
        participants: [
          {
            id: "p1",
            name: "Alex",
            detailId: "d1",
            weapon: "HK416",
            recordId: "r1",
            profile: { id: "ATP_M:standard:HK416", version: "2026-09-17.2" },
          },
        ],
        details: [{ id: "d1", name: "Detail 1" }],
        attempts: [
          {
            id: "a1",
            participantId: "p1",
            recordId: "r1",
            program: "ATP_M",
            variant: "standard",
            stage: "A",
            weapon: "HK416",
            profile: { id: "ATP_M:standard:HK416", version: "2026-09-17.2" },
            score: 20,
            status: "valid",
            recordedAt: "2026-09-17T08:00:00.000Z",
          },
        ],
        shared: [],
        drafts: {},
        dispatches: [],
        manualQueue: [],
        audit: [],
        settings: {
          weapon: "SAR21",
          objective: "marksman",
          order: "automatic",
          targets: { "HK416:A:marksman": 20 },
        },
      },
      BTP: newShoot("BTP"),
    },
  };
  const store = validateStore(migrateStore(old)),
    s = getShoot(store),
    p = s.participants[0];
  assert.equal(store.shoots.length, 1);
  assert.equal(p.weapon, "SAR21 SS/HK416");
  assert.equal(p.detailId, null);
  assert.equal(best(s, p, "A"), 20);
  assert.equal(store.presets.ATP_M.targets["SAR21 SS/HK416:A:marksman"], 20);
});
