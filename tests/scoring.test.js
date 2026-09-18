import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REFERENCE_ONLY,
  VERSION,
  weaponsFor,
  baseWeapons,
  weaponGroup,
  profileFor,
} from "../profiles.js";
import {
  newStore,
  newShoot,
  createShoot,
  deleteShoot,
  getShoot,
  preset,
  applyPresets,
  changeShootType,
  addDetail,
  addParticipants,
  parseRoster,
  assignDetail,
  autoDetail,
  detailPlan,
  setRosterLock,
  createTempDetail,
  dropTemporaryDetail,
  editIndividual,
  editDetailAttempt,
  stageDetails,
  clearParticipants,
  rosterIssues,
  members,
  sortedDetails,
  compositionErrors,
  fillWeapons,
  updateParticipant,
  getDraft,
  validateDraft,
  validateManual,
  saveDetail,
  borrowedBy,
  recordIndividual,
  best,
  bestAttempt,
  nextAttempt,
  detailAttempts,
  firingQueue,
  setSkipped,
  attemptNumbers,
  detailAttemptNumbers,
  result,
  scoreHistory,
  target,
  now,
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
function detailScore(s, d, stage, total, { individuals } = {}) {
  const draft = getDraft(s, d.id, stage);
  if (total !== null) draft.aggregate = String(total);
  if (individuals)
    draft.rows.forEach((r, i) => (r.hits = String(individuals[i])));
  return saveDetail(s, draft);
}
for (const [program, variant, weapon, pass, marksman] of [
  ["BTP", "standard", "SAR21", 16, 26],
  ["ATP_M", "standard", "SAR21", 24, 39],
  ["ATP_M", "standard", "HK416", 32, 39],
  ["ATP_M", "standard", "LMG", 32, 63],
  ["ATP_SP", "standard", "SAR21", 18, 29],
  ["APS", "standard", "SAR21", 12, 20],
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
      for (const person of people) recordIndividual(s, person, "B", String(b));
      detailScore(s, d, "C", left * n);
      assert.equal(result(s, people[0]).status, status);
    }
  });
test("Only plain SAR21 variants share an option; a shoot is set on a base rifle", () => {
  assert.deepEqual(weaponsFor("BTP"), ["SAR21"]);
  assert.deepEqual(weaponsFor("ATP_SP"), ["SAR21/SAR21 MMS/M203"]);
  assert.deepEqual(weaponsFor("APS"), ["SAR21"]);
  // SAR21 SS and HK416 share a requirement in ATP (M), so they share an option.
  assert.deepEqual(weaponsFor("ATP_M"), [
    "SAR21/SAR21 MMS/M203",
    "SAR21 SS/HK416",
    "LMG",
  ]);
  assert.deepEqual(weaponsFor("CS_M"), ["SAR21/M203", "SAR21 SS", "LMG"]);
  assert.deepEqual(weaponsFor("CS_SP"), ["SAR21", "LMG"]);
  assert.equal(weaponGroup("CS_M", "standard", "M203"), "SAR21/M203");
  // SAR21 SS keeps its own requirement in ATP (M), so it is never lumped in.
  assert.equal(profileFor("ATP_M", "standard", "SAR21 SS/HK416").pass, 32);
  assert.equal(profileFor("ATP_M", "standard", "SAR21/SAR21 MMS/M203").pass, 24);
  // M16 and LMG are given out per firer, after the details are set.
  assert.deepEqual(baseWeapons("CS_M"), ["SAR21/M203", "SAR21 SS"]);
  assert.deepEqual(baseWeapons("CS_SP"), ["SAR21"]);
  assert.deepEqual(baseWeapons("ATP_M"), weaponsFor("ATP_M"));
});
test("Unsupported rifles stay out of selectors and scoring", () => {
  assert.throws(() => profileFor("BTP", "standard", "LMG"));
  assert.throws(() => profileFor("ATP_SP", "standard", "LMG"));
  assert.throws(() => profileFor("APS", "standard", "LMG"));
  assert.equal(REFERENCE_ONLY[0].total, 108);
  assert.ok(!weaponsFor("ATP_SP").some((w) => w.includes("LMG")));
});
test("Shoots are created, opened and deleted from one list", () => {
  const store = newStore();
  const s = createShoot(store, "BTP", "standard", "Alpha");
  assert.equal(getShoot(store), s);
  addParticipants(s, ["A"], "SAR21");
  const second = createShoot(store, "BTP", "standard", "Bravo");
  assert.equal(store.shoots.length, 2);
  assert.equal(store.active, second.id);
  deleteShoot(store, second.id);
  assert.equal(store.shoots.length, 1);
  assert.equal(store.active, store.shoots[0].id);
  deleteShoot(store, store.active);
  assert.equal(store.active, null);
  assert.throws(() => deleteShoot(store, "missing"), /not found/);
});
test("Presets apply their Automatic priority and suggestions to shoots", () => {
  const store = newStore();
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
  assert.match(rosterIssues(s).join(" "), /1 participant needs a detail/);
});
test("Detail buttons assign firers; skipped, small and large details are reported", () => {
  const s = newShoot("CS_SP"),
    people = addParticipants(s, "A\nB\nC\nD\nE\nF\nG\nH", "SAR21");
  people.slice(0, 3).forEach((p) => assignDetail(s, p.id, 1));
  people.slice(3).forEach((p) => assignDetail(s, p.id, 3));
  const issues = rosterIssues(s).join("\n");
  assert.match(issues, /Detail 2 is skipped/);
  assert.match(issues, /Detail 1: Too few firers: 3\/4/);
  people.slice(3).forEach((p) => assignDetail(s, p.id, 2));
  assignDetail(s, people[7].id, 1);
  assert.deepEqual(rosterIssues(s), []);
  people.forEach((p) => assignDetail(s, p.id, 1));
  assert.match(rosterIssues(s).join(" "), /Too many firers: 8\/6/);
  assignDetail(s, people[0].id, null);
  assert.equal(people[0].detailId, null);
  const t = setup("CS_SP", "standard", 4);
  detailScore(t.s, t.d, "A", 40);
  assert.throws(() => assignDetail(t.s, t.p.id, 2), /recorded scores/);
});
test("Auto-detail uses as few details as possible, all within the allowed size", () => {
  assert.deepEqual(detailPlan(13, { min: 5, max: 7 }), [7, 6]);
  assert.deepEqual(detailPlan(12, { min: 5, max: 7 }), [6, 6]);
  assert.deepEqual(detailPlan(20, { min: 5, max: 7 }), [7, 7, 6]);
  assert.deepEqual(detailPlan(5, { min: 5, max: 7 }), [5]);
  const s = newShoot("CS_M"),
    people = addParticipants(
      s,
      Array.from({ length: 13 }, (_, i) => `P${i + 1}`).join("\n"),
      rifle("CS_M"),
    );
  assert.deepEqual(autoDetail(s), [7, 6]);
  assert.deepEqual(
    sortedDetails(s).map((d) => members(s, d.id).length),
    [7, 6],
  );
  assert.deepEqual(rosterIssues(s), []);
  assert.throws(() => autoDetail(s), /already has a detail/);
  assignDetail(s, people[12].id, null);
  autoDetail(s);
  assert.equal(members(s, s.details[1].id).length, 6);
  assert.equal(clearParticipants(s), 13);
  assert.deepEqual(s.participants, []);
  const scored = setup("BTP");
  recordIndividual(scored.s, scored.p, "A", "10");
  assert.throws(() => clearParticipants(scored.s), /Delete the shoot/);
});
test("Participants are confirmed only once the details work, and can be unlocked", () => {
  const s = newShoot("CS_M");
  assert.throws(() => setRosterLock(s, true), /Add participants/);
  addParticipants(s, "A\nB\nC\nD", rifle("CS_M"));
  assert.throws(() => setRosterLock(s, true), /needs? a detail/);
  autoDetail(s);
  assert.throws(() => setRosterLock(s, true), /Too few/);
  addParticipants(s, "E\nF", rifle("CS_M"));
  autoDetail(s);
  setRosterLock(s, true);
  assert.equal(s.locked, true);
  setRosterLock(s, false);
  assert.equal(s.locked, false);
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
test("A one-off temporary detail scores once and then leaves the roster", () => {
  const { s, d, people } = setup("CS_SP", "standard", 4),
    other = addDetail(s),
    others = addParticipants(s, ["B1", "B2", "B3", "B4"], "SAR21", other.id);
  const temp = createTempDetail(
    s,
    "A",
    [people[0], people[1], others[0], others[1]].map((p, i) => ({
      participantId: p.id,
      weapon: i === 0 ? "LMG" : "SAR21",
    })),
    { oneOff: true },
  );
  assert.equal(temp.stage, "A");
  assert.ok(stageDetails(s, "A").includes(temp));
  assert.equal(people[0].detailId, d.id);
  detailScore(s, temp, "A", 50);
  assert.equal(best(s, people[0], "A"), 12);
  assert.equal(bestAttempt(s, people[0], "A").weapon, "LMG");
  assert.ok(!stageDetails(s, "A").includes(s.details.find((x) => x.id === temp.id)));
});
test("A kept temporary detail belongs to its stage and flags where firers came from", () => {
  const { s, d, people } = setup("CS_SP", "standard", 4),
    other = addDetail(s),
    others = addParticipants(s, ["B1", "B2", "B3", "B4"], "SAR21", other.id);
  detailScore(s, d, "A", 20);
  detailScore(s, other, "A", 20);
  const temp = createTempDetail(
    s,
    "A",
    [people[0], people[1], others[0], others[1]].map((p) => ({
      participantId: p.id,
      weapon: "SAR21",
    })),
  );
  assert.equal(temp.name, "Temp detail 1");
  detailScore(s, temp, "A", 40);
  assert.equal(best(s, people[0], "A"), 10);
  assert.deepEqual(
    borrowedBy(s, d.id, "A").map((x) => x.people.map((p) => p.name)),
    [["Person 1", "Person 2"]],
  );
  // It only replaces details for its own stage.
  assert.deepEqual(borrowedBy(s, d.id, "C"), []);
  assert.ok(!stageDetails(s, "C").some((x) => x.temporary));
  assert.ok(stageDetails(s, "A").some((x) => x.id === temp.id));
  assert.equal(dropTemporaryDetail(s, temp.id), false);
  voidAttempt(
    s,
    s.attempts.find((a) => a.detailAttemptId === s.shared.at(-1).id).id,
    "Wrong",
  );
  assert.equal(dropTemporaryDetail(s, temp.id), true);
});
test("Temporary details follow the detail size and rifle rules", () => {
  const { s, people } = setup("CS_SP", "standard", 6),
    entry = (p, weapon = "SAR21") => ({ participantId: p.id, weapon });
  assert.throws(
    () => createTempDetail(s, "A", people.slice(0, 3).map((p) => entry(p))),
    /Too few/,
  );
  assert.throws(
    () =>
      createTempDetail(
        s,
        "A",
        people.slice(0, 4).map((p, i) => entry(p, i < 3 ? "LMG" : "SAR21")),
      ),
    /non-SAR21/,
  );
  assert.throws(() => createTempDetail(s, "A", []), /Choose the firers/);
  assert.throws(() => createTempDetail(s, "B", []), /Stages A and C/);
});
test("Recorded scores can be edited, keeping the original in the history", () => {
  const { s, p } = setup("BTP");
  const first = recordIndividual(s, p, "A", "9");
  const edited = editIndividual(s, first.id, "12");
  assert.equal(best(s, p, "A"), 12);
  assert.equal(s.attempts.find((a) => a.id === first.id).status, "void");
  assert.equal(edited.revisionOf, first.id);
  assert.equal(edited.recordedAt, first.recordedAt);
  assert.equal(scoreHistory(s, p, "A").length, 1);
  const cs = setup("CS_SP", "standard", 4);
  const detail = detailScore(cs.s, cs.d, "A", 40);
  editDetailAttempt(
    cs.s,
    detail.id,
    cs.people.map((x) => ({ participantId: x.id, weapon: "SAR21", hits: "" })),
    "52",
  );
  assert.equal(best(cs.s, cs.p, "A"), 13);
  assert.equal(cs.s.shared[0].status, "void");
  assert.equal(cs.s.shared[1].revisionOf, detail.id);
  assert.throws(
    () => editIndividual(cs.s, cs.s.attempts.at(-1).id, "5"),
    /detail's scores/,
  );
});
test("Redetailing stays empty until firers have shot the stage", () => {
  const { s, d, people } = setup("CS_SP", "standard", 4);
  assert.deepEqual(queue(s, "A"), []);
  detailScore(s, d, "A", 20);
  assert.equal(queue(s, "A").length, 1);
  const btp = setup("BTP", "standard", 3);
  assert.deepEqual(queue(btp.s, "A"), []);
  recordIndividual(btp.s, btp.people[0], "A", "4");
  assert.deepEqual(
    queue(btp.s, "A").map((e) => e.members[0].name),
    ["Person 1"],
  );
  manualQueue(btp.s, btp.people[1], "A");
  assert.equal(queue(btp.s, "A").length, 2);
});
test("Combat Shoot Stage B is fired individually, on any rifle", () => {
  const { s, d, people } = setup("CS_SP", "standard", 4);
  updateParticipant(s, people[0].id, {
    name: people[0].name,
    detailId: d.id,
    weapon: "LMG",
  });
  recordIndividual(s, people[0], "B", "5", "SAR21");
  assert.equal(best(s, people[0], "B"), 5);
  assert.equal(bestAttempt(s, people[0], "B").weapon, "SAR21");
  assert.throws(() => recordIndividual(s, people[1], "A", "10"), /whole detail/);
  assert.deepEqual(
    queue(s, "B").map((e) => e.key),
    [`person:${people[0].id}`],
  );
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
  const { s, people } = setup("ATP_SP", "standard", 6);
  for (const p of people) recordIndividual(s, p, "A", "1");
  assert.equal(queue(s, "A").length, 6);
  assert.throws(
    () => dispatch(s, "A", queue(s, "A").map((e) => e.key)),
    /Up to 5 firers/,
  );
  dispatch(s, "A", queue(s, "A").slice(0, 5).map((e) => e.key));
  assert.equal(setup("ATP_M", "standard", 50).people.length, 50);
});
test("A detail takes at most two non-SAR21 rifles, however they are arranged", () => {
  const { s, d, people } = setup("CS_SP", "standard", 6),
    give = (n, weapon) =>
      updateParticipant(s, people[n].id, {
        name: people[n].name,
        detailId: d.id,
        weapon,
      });
  for (const i of [0, 1]) give(i, "LMG");
  assert.deepEqual(compositionErrors(s, members(s, d.id)), []);
  // Edits are never refused, so a roster can be rearranged freely.
  give(2, "LMG");
  assert.match(
    compositionErrors(s, members(s, d.id)).join(" "),
    /Too many non-SAR21 weapons: 3\/2/,
  );
  for (const i of [3, 4, 5]) give(i, "LMG");
  assert.match(
    compositionErrors(s, members(s, d.id)).join(" "),
    /Too many non-SAR21 weapons: 6\/2/,
  );
  assert.throws(() => dispatch(s, "A", [`detail:${d.id}`]), /non-SAR21/);
  assert.throws(() => detailScore(s, d, "A", 30), /non-SAR21/);
  for (const i of [2, 3, 4, 5]) give(i, "SAR21");
  assert.deepEqual(compositionErrors(s, members(s, d.id)), []);
});
test("M203 counts as SAR21 in CS (M); a whole detail on LMG is flagged", () => {
  const { s, people } = setup("CS_M", "standard", 5, "M203");
  assert.deepEqual(compositionErrors(s, people), []);
  fillWeapons(s, "LMG");
  assert.match(
    compositionErrors(s, people).join(" "),
    /Too many non-SAR21 weapons: 5\/2/,
  );
  fillWeapons(s, "SAR21/M203");
  assert.deepEqual(compositionErrors(s, people), []);
});
test("Mixed rifles in CS share thresholds and keep the rifle per stage", () => {
  const { s, d, p, people } = setup("CS_SP", "standard", 4);
  updateParticipant(s, p.id, { name: p.name, detailId: d.id, weapon: "LMG" });
  detailScore(s, d, "A", 52);
  for (const person of people) recordIndividual(s, person, "B", "8");
  detailScore(s, d, "C", 40);
  assert.equal(result(s, p).status, "Marksman");
  assert.equal(bestAttempt(s, p, "A").weapon, "LMG");
  assert.equal(bestAttempt(s, p, "B").weapon, "LMG");
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
  assert.match(validateDraft(s, draft).errors.join(" "), /Missing: Person 1/);
  draft.rows[0].hits = "5";
  const a = saveDetail(s, draft);
  assert.equal(a.inputMode, "reconciled");
  assert.equal(a.individualsVerified, true);
});
test("A detail confirms whole: every firer's hits, or only the detail total", () => {
  const { s, d, people } = setup("CS_M", "standard", 6),
    draft = getDraft(s, d.id, "A");
  for (const i of [0, 1, 2, 3]) draft.rows[i].hits = "10";
  assert.throws(
    () => saveDetail(s, draft),
    /Enter every firer's hits, or only the detail total\. Missing: Person 5, Person 6\./,
  );
  assert.equal(s.shared.length, 0);
  for (const r of draft.rows) r.hits = "";
  draft.aggregate = "60";
  const a = saveDetail(s, draft);
  assert.equal(a.divisor, 6);
  assert.equal(a.score, 10);
  for (const p of people) assert.equal(best(s, p, "A"), 10);
});
test("A detail's records are numbered by attempt, and edits keep the number", () => {
  const { s, d, people } = setup("CS_M", "standard", 6);
  const r1 = detailScore(s, d, "A", 60),
    r2 = detailScore(s, d, "A", 72);
  const r3 = editDetailAttempt(
    s,
    r2.id,
    r2.roster.map((m) => ({ participantId: m.id, weapon: m.weapon, hits: "" })),
    "78",
  );
  assert.equal(r2.revisedBy, r3.id);
  const numbers = detailAttemptNumbers(s, d.id, "A");
  assert.equal(numbers.get(r1.id), 1);
  assert.equal(numbers.get(r2.id), 2);
  assert.equal(numbers.get(r3.id), 2);
  assert.equal(nextAttempt(s, people, "A"), 3);
});
test("The firing queue keeps first attempts in order, then redetails as sent", () => {
  const store = newStore(),
    s = createShoot(store, "CS_SP", "standard", "Q");
  addParticipants(
    s,
    Array.from({ length: 12 }, (_, i) => `P${i + 1} ${Math.floor(i / 4) + 1}`),
    "SAR21",
  );
  const [d1, d2, d3] = sortedDetails(s),
    names = () => firingQueue(s, "A").map((e) => `${e.detail.name}#${e.attempt}`);
  assert.deepEqual(names(), ["Detail 1#1", "Detail 2#1", "Detail 3#1"]);
  detailScore(s, d1, "A", 20);
  assert.deepEqual(names(), ["Detail 2#1", "Detail 3#1"]);
  // Redetailed before everyone has shot: it joins the back, behind Details 2 and 3.
  dispatch(s, "A", [`detail:${d1.id}`]);
  assert.deepEqual(names(), ["Detail 2#1", "Detail 3#1", "Detail 1#2"]);
  // Priority sorts the redetail list, never the firing queue.
  setPriority(s, `detail:${d3.id}`, "high");
  assert.deepEqual(names(), ["Detail 2#1", "Detail 3#1", "Detail 1#2"]);
  // Scoring out of order takes that entry off; the rest move up.
  detailScore(s, d3, "A", 24);
  assert.deepEqual(names(), ["Detail 2#1", "Detail 1#2"]);
  dispatch(s, "A", [`detail:${d3.id}`]);
  assert.deepEqual(names(), ["Detail 2#1", "Detail 1#2", "Detail 3#2"]);
  detailScore(s, d2, "A", 16);
  detailScore(s, d1, "A", 28);
  assert.deepEqual(names(), ["Detail 3#2"]);
  assert.equal(firingQueue(s, "A")[0].dispatch.status, "awaiting");
});
test("Skipped entries wait below everyone, even later redetails", () => {
  const { s, people } = setup("BTP", "standard", 4);
  const order = () =>
    firingQueue(s, "A").map(
      (e) => e.members[0].name + (e.skipped ? " (skipped)" : ""),
    );
  recordIndividual(s, people[3], "A", "4");
  assert.deepEqual(order(), ["Person 1", "Person 2", "Person 3"]);
  // Person 1 falls out.
  setSkipped(s, "A", `person:${people[0].id}`, true);
  assert.deepEqual(order(), ["Person 2", "Person 3", "Person 1 (skipped)"]);
  // A redetail sent afterwards still goes above the skipped firer.
  dispatch(s, "A", [`person:${people[3].id}`]);
  assert.deepEqual(order(), [
    "Person 2",
    "Person 3",
    "Person 4",
    "Person 1 (skipped)",
  ]);
  // Unskipping puts them back where they were.
  setSkipped(s, "A", `person:${people[0].id}`, false);
  assert.equal(order()[0], "Person 1");
  // Once scored, a skip no longer applies to that firer's next attempt.
  setSkipped(s, "A", `person:${people[1].id}`, true);
  recordIndividual(s, people[1], "A", "3");
  dispatch(s, "A", [`person:${people[1].id}`]);
  assert.ok(order().includes("Person 2"));
  recordIndividual(s, people[2], "A", "12");
  assert.throws(
    () => setSkipped(s, "A", `person:${people[2].id}`, true),
    /not waiting/,
  );
});
test("Firers with nothing to gain can fire in a manual detail to help others", () => {
  const { s, d, people } = setup("CS_SP", "standard", 4);
  detailScore(s, d, "A", 60);
  // Everyone maxed Stage A; Person 1 also finishes as Marksman.
  recordIndividual(s, people[0], "B", "8");
  detailScore(s, d, "C", 60);
  assert.equal(result(s, people[0]).status, "Marksman");
  const temp = createTempDetail(
    s,
    "A",
    people.map((p) => ({ participantId: p.id, weapon: p.weapon })),
  );
  // Everyone in it has shot, yet the manual detail waits to fire.
  assert.ok(firingQueue(s, "A").some((e) => e.key === `detail:${temp.id}`));
  const draft = getDraft(s, temp.id, "A");
  draft.aggregate = "40";
  saveDetail(s, draft);
  assert.ok(!firingQueue(s, "A").some((e) => e.key === `detail:${temp.id}`));
  // A lower average never takes away a best score.
  assert.equal(best(s, people[0], "A"), 15);
  assert.equal(result(s, people[0]).status, "Marksman");
});
test("Individual stages queue firers by detail, then redetails", () => {
  const { s, people } = setup("BTP", "standard", 3);
  const order = () => firingQueue(s, "A").map((e) => e.members[0].name);
  assert.deepEqual(order(), ["Person 1", "Person 2", "Person 3"]);
  recordIndividual(s, people[1], "A", "4");
  dispatch(s, "A", [`person:${people[1].id}`]);
  assert.deepEqual(order(), ["Person 1", "Person 3", "Person 2"]);
});
test("History numbers match the attempt tags through edits and voids", () => {
  const { s, p } = setup("BTP", "standard", 1),
    n = (a) => attemptNumbers(s, p).get(a.id);
  const a1 = recordIndividual(s, p, "A", "5");
  assert.equal(n(a1), 1);
  // An edit corrects attempt 1; it does not become attempt 2.
  const e1 = editIndividual(s, a1.id, "7");
  assert.equal(n(a1), 1);
  assert.equal(n(e1), 1);
  assert.equal(nextAttempt(s, p, "A"), 2);
  const a2 = recordIndividual(s, p, "A", "9");
  assert.equal(n(a2), 2);
  // Voided outright, it no longer counts, so the next entry is attempt 2 again.
  voidAttempt(s, a2.id, "Wrong firer");
  assert.equal(n(a2), null);
  assert.equal(nextAttempt(s, p, "A"), 2);
  const a3 = recordIndividual(s, p, "A", "10");
  assert.equal(n(a3), 2);
  // Each stage counts on its own.
  assert.equal(n(recordIndividual(s, p, "B", "4")), 1);
});
test("Attempt numbers count the scores a firer or detail already has", () => {
  const { s, d, people } = setup("CS_SP", "standard", 4);
  assert.equal(nextAttempt(s, people, "A"), 1);
  assert.equal(nextAttempt(s, people[0], "A"), 1);
  detailScore(s, d, "A", 20);
  assert.equal(nextAttempt(s, people, "A"), 2);
  assert.equal(nextAttempt(s, people[0], "A"), 2);
  assert.equal(nextAttempt(s, people, "C"), 1);
  assert.equal(detailAttempts(s, d.id, "A").length, 1);
  detailScore(s, d, "A", 24);
  assert.equal(detailAttempts(s, d.id, "A").length, 2);
  assert.equal(nextAttempt(s, people, "A"), 3);
});
test("Stage B scores are individual; missing is not zero", () => {
  const { s, people, p } = setup("CS_SP", "standard", 4);
  for (const person of people) recordIndividual(s, person, "B", "0");
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
test("Confirmed CS detail closes its redetail", () => {
  const { s, d } = setup("CS_SP", "standard", 5);
  detailScore(s, d, "A", 20);
  dispatch(s, "A", [`detail:${d.id}`]);
  detailScore(s, d, "A", 40);
  assert.equal(s.dispatches[0].status, "scored");
});
test("Thresholds float once the other stages are scored", () => {
  const { s, people } = setup("BTP", "standard", 3);
  for (const [i, a, b] of [
    [0, 12, 16],
    [1, 12, 13],
    [2, 13, 12],
  ]) {
    recordIndividual(s, people[i], "A", String(a));
    recordIndividual(s, people[i], "B", String(b));
  }
  const names = (shoot, stage) =>
    queue(shoot, stage).map((e) => e.members[0].name);
  // Person 1 reached Marksman (28), so nothing is left to chase.
  // The others need what is still missing: 26 − their other stage.
  assert.deepEqual(names(s, "A"), ["Person 2", "Person 3"]);
  assert.deepEqual(names(s, "B"), ["Person 3", "Person 2"]);
  assert.equal(target(s, people[1], "A"), 13);
  assert.equal(target(s, people[2], "A"), 14);
  // Maxing a stage takes a firer off the list even when the total is short.
  const maxed = setup("BTP", "standard", 1);
  recordIndividual(maxed.s, maxed.p, "A", "16");
  recordIndividual(maxed.s, maxed.p, "B", "4");
  assert.deepEqual(names(maxed.s, "A"), []);
  assert.deepEqual(names(maxed.s, "B"), ["Person 1"]);
  // Before the other stages are in, the threshold set in Settings applies.
  const part = setup("BTP", "standard", 2);
  recordIndividual(part.s, part.people[0], "A", "13");
  recordIndividual(part.s, part.people[1], "A", "12");
  assert.deepEqual(names(part.s, "A"), ["Person 2"]);
  part.s.settings.targets["SAR21:A:marksman"] = 12;
  assert.deepEqual(names(part.s, "A"), []);
});
test("Redetailing keeps the order the redetailer chose", () => {
  const { s, people } = setup("BTP", "standard", 3);
  [10, 5, 8].forEach((hits, i) =>
    recordIndividual(s, people[i], "A", String(hits)),
  );
  const keys = queue(s, "A").map((e) => e.key);
  dispatch(s, "A", [keys[2], keys[0], keys[1]]);
  assert.deepEqual(
    s.dispatches.map((d) => d.key),
    [keys[2], keys[0], keys[1]],
  );
});
test("Repeated names are reported before scoring starts", () => {
  const { s, people } = setup("BTP", "standard", 2);
  assert.deepEqual(rosterIssues(s), []);
  people[1].name = "Person 1";
  assert.match(rosterIssues(s).join(" "), /Same name more than once: Person 1/);
  assert.throws(() => setRosterLock(s, true), /Same name/);
  people[1].name = "Person 2";
  setRosterLock(s, true);
  assert.equal(s.locked, true);
});
test("Rifles taken out of service are mapped onto what replaces them", () => {
  const store = newStore(),
    s = createShoot(store, "CS_SP", "standard", "Alpha"),
    people = addParticipants(s, "A 1\nB 1\nC 1\nD 1", "SAR21");
  s.participants[0].weapon = "M16";
  s.attempts.push({
    id: "a1",
    participantId: people[0].id,
    recordId: people[0].recordId,
    program: "CS_SP",
    variant: "standard",
    stage: "B",
    weapon: "M16",
    profile: profileFor("CS_SP", "standard", "SAR21"),
    score: 5,
    status: "valid",
    recordedAt: now(),
  });
  const repaired = validateStore(migrateStore(JSON.parse(JSON.stringify(store)))),
    rs = getShoot(repaired);
  assert.equal(rs.participants[0].weapon, "SAR21");
  assert.equal(rs.attempts[0].weapon, "SAR21");
  assert.equal(best(rs, rs.participants[0], "B"), 5);
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
test("Backup round trip keeps shoots, drafts and best attempt IDs", () => {
  const store = newStore();
  const s = createShoot(store, "CS_SP", "standard", "Alpha"),
    people = addParticipants(s, "A 1\nB 1\nC 1\nD 1", "SAR21"),
    d = s.details[0];
  detailScore(s, d, "A", 44);
  getDraft(s, d.id, "C").aggregate = "30";
  const restored = validateStore(migrateStore(JSON.parse(JSON.stringify(store)))),
    rs = getShoot(restored);
  assert.equal(rs.drafts[`${d.id}:C`].aggregate, "30");
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
