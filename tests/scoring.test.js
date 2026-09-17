import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROFILES,
  REFERENCE_ONLY,
  VERSION,
  weaponsFor,
  profileFor,
} from "../profiles.js";
import {
  newStore,
  newShoot,
  enableShoot,
  getShoot,
  addDetail,
  addParticipants,
  members,
  compositionErrors,
  fillWeapons,
  updateParticipant,
  getDraft,
  resetDraft,
  pasteScores,
  validateDraft,
  saveDetail,
  recordIndividual,
  best,
  bestAttempt,
  result,
  voidAttempt,
  queue,
  dispatch,
  manualQueue,
  validateStore,
} from "../core.js";
function setup(program = "BTP", variant = "standard", n = 1, weapon = "SAR21") {
  const s = newShoot(program, variant),
    d = addDetail(s),
    people = addParticipants(
      s,
      Array.from({ length: n }, (_, i) => `Person ${i + 1}`),
      weapon,
      d.id,
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
  { weapons = {}, individuals, accounted = true } = {},
) {
  const draft = getDraft(s, d.id, stage);
  if (total !== null) draft.aggregate = String(total);
  draft.rows.forEach((r, i) => {
    r.accounted = accounted;
    if (weapons[i]) r.weapon = weapons[i];
    if (individuals) r.hits = String(individuals[i]);
  });
  return saveDetail(s, draft);
}
for (const [program, variant, weapon, pass, marksman] of [
  ["BTP", "standard", "SAR21", 16, 26],
  ["ATP_M", "standard", "SAR21", 24, 39],
  ["ATP_M", "standard", "SAR21 SS", 32, 39],
  ["ATP_M", "standard", "LMG", 32, 63],
  ["ATP_SP", "standard", "SAR21", 18, 29],
  ["APS", "standard", "SAR21", 12, 20],
  ["APS", "ns", "SAR21", 15, 24],
])
  test(`${program} ${weapon} exact thresholds`, () => {
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
test("All shoots are disabled by default, enabling does not erase retained rosters", () => {
  const store = newStore();
  assert.deepEqual(store.enabled, []);
  assert.equal(store.active, null);
  enableShoot(store, "BTP", true);
  const s = getShoot(store);
  const d = addDetail(s);
  addParticipants(s, ["A"], "SAR21", d.id);
  enableShoot(store, "BTP", false);
  assert.equal(store.active, null);
  enableShoot(store, "BTP", true);
  assert.equal(getShoot(store).participants.length, 1);
});
test("Unsupported weapons stay absent from selectors and active scoring", () => {
  assert.ok(PROFILES.every((p) => p.weapon !== "SAW"));
  assert.throws(() => profileFor("BTP", "standard", "LMG"));
  assert.throws(() => profileFor("ATP_SP", "standard", "LMG"));
  assert.throws(() => profileFor("APS", "standard", "LMG"));
  assert.throws(() => profileFor("APS", "ns", "M16"));
  assert.throws(() => profileFor("CS_M", "standard", "SAW"));
  assert.equal(REFERENCE_ONLY[0].total, 108);
  assert.ok(!weaponsFor("ATP_SP").includes("LMG"));
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
test("CS minimum/maximum sizes are enforced, ATP SP only maximum is supplied", () => {
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
    ["ATP_SP", 6],
  ])
    assert.throws(() => setup(program, "standard", n), /Too many/);
  assert.equal(
    compositionErrors(setup("ATP_SP").s, [{ weapon: "SAR21" }]).length,
    0,
  );
  assert.equal(setup("ATP_M", "standard", 50).people.length, 50);
});
test("Combined non-SAR21 cap applies across all weapon types, also to stage changes", () => {
  const { s, d, people } = setup("CS_SP", "standard", 6);
  updateParticipant(s, people[0].id, {
    name: people[0].name,
    detailId: d.id,
    weapon: "LMG",
  });
  updateParticipant(s, people[1].id, {
    name: people[1].name,
    detailId: d.id,
    weapon: "M16",
  });
  assert.throws(
    () =>
      updateParticipant(s, people[2].id, {
        name: people[2].name,
        detailId: d.id,
        weapon: "LMG",
      }),
    /non-SAR21/,
  );
  const draft = getDraft(s, d.id, "A");
  draft.rows[2].weapon = "LMG";
  draft.aggregate = "30";
  draft.rows.forEach((r) => (r.accounted = true));
  assert.match(validateDraft(s, draft).errors.join(" "), /non-SAR21/);
  assert.throws(() => saveDetail(s, draft));
  assert.throws(() => dispatch(s, "A", [`detail:${d.id}`]), /non-SAR21/);
});
test("Explicit SAR21 family mapping and fill-all validation", () => {
  const { s, d, people } = setup("CS_M", "standard", 5);
  for (let i = 0; i < 3; i++)
    updateParticipant(s, people[i].id, {
      name: people[i].name,
      detailId: d.id,
      weapon: "SAR21 SS",
    });
  assert.deepEqual(compositionErrors(s, members(s, d.id)), []);
  assert.throws(() => fillWeapons(s, "LMG"), /non-SAR21/);
  fillWeapons(s, "SAR21");
  assert.ok(people.every((p) => p.weapon === "SAR21"));
});
test("Mixed SAR21/LMG CS has common thresholds and retains actual weapon per stage", () => {
  const { s, d, p } = setup("CS_SP", "standard", 4);
  detailScore(s, d, "A", 52, { weapons: { 0: "LMG" } });
  detailScore(s, d, "B", null, { individuals: [8, 8, 8, 8] });
  detailScore(s, d, "C", 40);
  assert.equal(result(s, p).status, "Marksman");
  assert.equal(bestAttempt(s, p, "A").weapon, "LMG");
  assert.equal(bestAttempt(s, p, "B").weapon, "SAR21");
  assert.equal(best(s, p, "A"), 13);
});
test("CS best is selected from earned averaged attempts, never raw individual bests", () => {
  const { s, d, p } = setup("CS_SP", "standard", 4);
  detailScore(s, d, "A", null, { individuals: [15, 0, 0, 0] });
  detailScore(s, d, "A", null, { individuals: [0, 15, 15, 15] });
  assert.equal(best(s, p, "A"), 11);
  const bestId = bestAttempt(s, p, "A").detailAttemptId;
  assert.equal(s.shared.find((a) => a.id === bestId).aggregateHits, 45);
  assert.notEqual(best(s, p, "A"), 15);
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
test("Aggregate entry requires exactly the authoritative roster and keeps raw hits null", () => {
  const { s, d } = setup("CS_SP", "standard", 6),
    draft = getDraft(s, d.id, "A");
  draft.aggregate = "59";
  draft.rows.slice(0, 5).forEach((r) => (r.accounted = true));
  assert.match(validateDraft(s, draft).errors.join(" "), /5\/6 accounted/);
  assert.throws(() => saveDetail(s, draft));
  draft.rows[5].accounted = true;
  const a = saveDetail(s, draft);
  assert.equal(a.divisor, 6);
  assert.equal(a.individualsVerified, false);
  assert.ok(a.roster.every((r) => r.rawHits === null));
});
test("Duplicate, missing, unexpected participants and roster counts block finalization", () => {
  for (const mode of ["duplicate", "missing", "unexpected", "snapshot"]) {
    const { s, d } = setup("CS_SP", "standard", 4),
      draft = getDraft(s, d.id, "A");
    draft.aggregate = "20";
    draft.rows.forEach((r) => (r.accounted = true));
    if (mode === "duplicate") draft.rows.push({ ...draft.rows[0] });
    if (mode === "missing") draft.rows.pop();
    if (mode === "unexpected") draft.rows[0].participantId = "outsider";
    if (mode === "snapshot") draft.rosterIds.pop();
    assert.ok(validateDraft(s, draft).errors.length);
    assert.throws(() => saveDetail(s, draft));
  }
});
test("Bulk and individual totals reconcile exactly; partial individual data is an error", () => {
  const { s, d } = setup("CS_SP", "standard", 4),
    draft = getDraft(s, d.id, "A");
  draft.aggregate = "21";
  draft.rows.forEach((r) => {
    r.accounted = true;
    r.hits = "5";
  });
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
  draft.rows.forEach((r) => (r.accounted = true));
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
test("Invalid fractional, negative and excessive raw counts never become scores", () => {
  for (const hits of ["", "-1", "1.5", "16", "Infinity"]) {
    const { s, d } = setup("CS_SP", "standard", 4);
    const draft = getDraft(s, d.id, "A");
    draft.rows.forEach((r) => (r.hits = hits));
    assert.throws(() => saveDetail(s, draft));
  }
  const { s, d } = setup("CS_SP", "standard", 4);
  assert.throws(() => detailScore(s, d, "A", 61));
});
test("Paste flags mismatches and accepts authoritative IDs for identical names", () => {
  const { s, d } = setup("CS_SP", "standard", 4),
    draft = getDraft(s, d.id, "A");
  pasteScores(s, draft, "Person 1,4\nPerson 1,4\nUnknown,2");
  assert.match(draft.pasteErrors.join(" "), /Duplicate participant/);
  assert.match(draft.pasteErrors.join(" "), /Unexpected participant/);
  assert.match(draft.pasteErrors.join(" "), /Missing participant/);
  pasteScores(
    s,
    draft,
    members(s, d.id)
      .map((p) => `${p.id},4`)
      .join("\n"),
  );
  assert.deepEqual(draft.pasteErrors, []);
  saveDetail(s, draft);
});
test("ATP stage weapon changes cannot contribute to the same record", () => {
  const { s, d, p } = setup("ATP_M");
  recordIndividual(s, p, "A", "24");
  const oldId = p.recordId;
  assert.throws(() => recordIndividual(s, p, "B", "8", "LMG"));
  updateParticipant(
    s,
    p.id,
    { name: p.name, weapon: "LMG", detailId: d.id },
    "Changed weapon",
  );
  assert.notEqual(p.recordId, oldId);
  assert.equal(best(s, p, "A"), null);
  assert.equal(s.attempts[0].weapon, "SAR21");
  assert.equal(s.attempts[0].profile.version, VERSION);
  complete(s, p, 63);
  assert.equal(result(s, p).status, "Marksman");
});
test("Best eligible stages may come from different attempts; corrections preserve shared history", () => {
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
test("Roster corrections preserve historical membership and make old drafts stale", () => {
  const { s, d, p } = setup("CS_SP", "standard", 4);
  detailScore(s, d, "A", 40);
  getDraft(s, d.id, "C");
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
test("Score → detail → score repeats without a user-specified capacity", () => {
  const { s, p } = setup();
  recordIndividual(s, p, "A", "8");
  assert.equal(queue(s, "A").length, 1);
  dispatch(s, "A", [queue(s, "A")[0].key]);
  assert.equal(queue(s, "A").length, 0);
  recordIndividual(s, p, "A", "13");
  assert.equal(s.dispatches[0].status, "scored");
  assert.equal(queue(s, "A").length, 0);
  manualQueue(s, p, "A");
  assert.equal(queue(s, "A").length, 1);
  assert.equal(s.settings.capacity, undefined);
});
test("Unknown/incompatible profile version cannot enter best score selection", () => {
  const { s, p } = setup();
  recordIndividual(s, p, "A", "16");
  s.attempts[0].profile.version = "older";
  assert.equal(best(s, p, "A"), null);
});
test("Backup round trip retains profiles, drafts, attendance and best attempt IDs", () => {
  const store = newStore();
  enableShoot(store, "CS_SP", true);
  const s = getShoot(store),
    d = addDetail(s),
    people = addParticipants(s, ["A", "B", "C", "D"], "SAR21", d.id);
  detailScore(s, d, "A", 44);
  getDraft(s, d.id, "C").aggregate = "30";
  const restored = validateStore(JSON.parse(JSON.stringify(store))),
    rs = getShoot(restored);
  assert.equal(rs.drafts[`${d.id}:C`].aggregate, "30");
  assert.equal(
    result(rs, rs.participants[0]).bestAttemptIds[0],
    result(s, people[0]).bestAttemptIds[0],
  );
});
