import {
  PROGRAMS,
  VERSION,
  DETAIL_RULES,
  NON_SAR,
  isCS,
  profileFor,
  weaponsFor,
  baseWeapons,
  weaponGroup,
  typeLabel,
} from "./profiles.js";
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
// Stages A and C are fired as a detail; everything else is individual.
export const detailedStage = (s, stage) => isCS(s) && ["A", "C"].includes(stage);
export const typeKey = (program, variant = "standard") =>
  program === "APS" ? `APS:${variant}` : program;
export function newStore() {
  return {
    schema: 3,
    active: null,
    presets: {},
    shoots: [],
  };
}
export function preset(store, program, variant = "standard") {
  return (store.presets[typeKey(program, variant)] ??= {
    weapon: baseWeapons(program, variant)[0],
    objective: "marksman",
    targets: {},
  });
}
export function newShoot(program, variant = "standard", name = "") {
  const weapon = baseWeapons(program, variant)[0];
  if (!PROGRAMS[program] || !weapon) throw Error("Unknown shoot type.");
  return {
    id: uid(),
    name: name.trim() || typeLabel(program, variant),
    createdAt: now(),
    program,
    variant,
    participants: [],
    details: [],
    attempts: [],
    shared: [],
    drafts: {},
    dispatches: [],
    manualQueue: [],
    priorities: {},
    locked: false,
    audit: [],
    settings: {
      weapon,
      objective: "marksman",
      order: "lowest",
      targets: {},
    },
  };
}
export function applyPreset(store, s) {
  const p = preset(store, s.program, s.variant);
  s.settings.objective = p.objective;
  s.settings.targets = structuredClone(p.targets);
  if (!weaponsFor(s.program, s.variant).includes(s.settings.weapon))
    s.settings.weapon = p.weapon;
}
export function applyPresets(store) {
  for (const s of store.shoots) applyPreset(store, s);
}
export function createShoot(store, program, variant = "standard", name = "") {
  const s = newShoot(program, variant, name);
  s.settings.weapon = preset(store, program, variant).weapon;
  applyPreset(store, s);
  store.shoots.push(s);
  store.active = s.id;
  audit(s, "Shoot created", { program, variant });
  return s;
}
export function getShoot(store, id = store.active) {
  return store.shoots.find((s) => s.id === id) || null;
}
export const hasScores = (s) => s.attempts.length > 0;
// Locking says the roster and details are settled, so scoring can start.
export function setRosterLock(s, on) {
  if (on && !s.participants.length) throw Error("Add participants first.");
  if (on && rosterIssues(s).length)
    throw Error(rosterIssues(s).join("\n"));
  s.locked = !!on;
  audit(s, on ? "Participants confirmed" : "Participants unlocked");
}
// Empties the roster of a shoot that has not been scored yet.
export function clearParticipants(s) {
  if (hasScores(s))
    throw Error(
      "Scores are recorded. Delete the shoot from Shoots to start over.",
    );
  const count = s.participants.length;
  s.participants = [];
  s.details = [];
  s.drafts = {};
  s.dispatches = [];
  s.manualQueue = [];
  s.priorities = {};
  audit(s, "Participants cleared", { count });
  return count;
}
export function deleteShoot(store, id) {
  const s = getShoot(store, id);
  if (!s) throw Error("Shoot not found.");
  store.shoots = store.shoots.filter((x) => x.id !== id);
  if (store.active === id) store.active = store.shoots[0]?.id ?? null;
  return s;
}
export function changeShootType(s, program, variant = "standard") {
  if (hasScores(s))
    throw Error(
      "Scores have been recorded. Start a new shoot to use a different type.",
    );
  const weapons = weaponsFor(program, variant);
  if (!PROGRAMS[program] || !weapons.length) throw Error("Unknown shoot type.");
  const previous = { program: s.program, variant: s.variant },
    wasCS = isCS(s),
    oldLabel = typeLabel(s.program, s.variant),
    pick = (w) => {
      const group = weaponGroup(program, variant, w);
      return weapons.includes(group) ? group : weapons[0];
    };
  s.program = program;
  s.variant = variant;
  s.settings.weapon = pick(s.settings.weapon);
  for (const p of s.participants) {
    p.weapon = pick(p.weapon);
    p.profile = profileFor(program, variant, p.weapon);
    p.recordId = uid();
  }
  if (!isCS(s) || !wasCS) {
    s.details = [];
    for (const p of s.participants) p.detailId = null;
  }
  s.drafts = {};
  s.dispatches = [];
  s.manualQueue = [];
  s.priorities = {};
  if (s.name === oldLabel || s.name.startsWith(`${oldLabel} · `))
    s.name = typeLabel(program, variant) + s.name.slice(oldLabel.length);
  audit(s, "Shoot type changed", { previous, program, variant });
}
export function audit(s, action, data = {}) {
  s.audit.push({
    id: uid(),
    at: now(),
    recorder: "Local device",
    action,
    ...data,
  });
}
export function addDetail(s, number) {
  const d = {
    id: uid(),
    name: `Detail ${number ?? Math.max(0, ...s.details.filter((d) => !d.temporary).map(detailNumber)) + 1}`,
  };
  s.details.push(d);
  audit(s, "Detail added", { detail: structuredClone(d) });
  return d;
}
export function members(s, detailId) {
  const d = detailId && s.details.find((d) => d.id === detailId);
  return d?.temporary
    ? d.memberIds
        .map((id) => s.participants.find((p) => p.id === id))
        .filter(Boolean)
    : s.participants.filter((p) => p.detailId === detailId);
}
// The rifle a firer uses in a detail: temporary details keep their own choice.
export function rosterWeapon(s, detailId, p) {
  return s.details.find((d) => d.id === detailId)?.weapons?.[p.id] ?? p.weapon;
}
export const detailNumber = (d) => Number(d.name.match(/\d+$/)?.[0]) || 0;
// A temporary detail replaces a firer's usual one for a single stage.
export function createTempDetail(s, stage, entries, { oneOff = false } = {}) {
  if (!detailedStage(s, stage))
    throw Error("Temporary details are for Combat Shoot Stages A and C.");
  const rows = entries.map((e) => ({
    person: s.participants.find((p) => p.id === e.participantId),
    weapon: e.weapon,
  }));
  if (!rows.length || rows.some((r) => !r.person))
    throw Error("Choose the firers in this detail.");
  const errors = compositionErrors(
    s,
    rows.map((r) => ({ weapon: r.weapon })),
  );
  if (errors.length) throw Error(errors.join(" "));
  const d = {
    id: uid(),
    name: `Temp detail ${s.details.filter((x) => x.temporary).length + 1}`,
    temporary: true,
    stage,
    oneOff,
    memberIds: rows.map((r) => r.person.id),
    weapons: Object.fromEntries(rows.map((r) => [r.person.id, r.weapon])),
  };
  s.details.push(d);
  audit(s, "Temporary detail added", { detail: structuredClone(d), stage });
  return d;
}
export function sortedDetails(s) {
  return s.details.toSorted(
    (a, b) =>
      !!a.temporary - !!b.temporary || detailNumber(a) - detailNumber(b),
  );
}
// Temporary details holding firers who belong to this detail.
export function borrowedBy(s, detailId, stage) {
  return s.details
    .filter((d) => d.temporary && !d.retired && (!stage || d.stage === stage))
    .map((d) => ({
      detail: d,
      people: members(s, d.id).filter((p) => p.detailId === detailId),
    }))
    .filter((x) => x.people.length);
}
export function ensureDetail(s, number) {
  if (!Number.isInteger(number) || number < 1 || number > 500)
    throw Error("Detail numbers must be whole numbers from 1.");
  return (
    s.details.find((d) => !d.temporary && detailNumber(d) === number) ??
    addDetail(s, number)
  );
}
// Reads "Name", "Name,2", "Name<tab>2" or "Name 2". Numbers are only read for detailed shoots.
export function parseRoster(text, detailed) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = detailed && line.match(/^(.*?)(?:\s*[,\t;]\s*|\s+)(\d{1,3})$/);
      return m && m[1].trim()
        ? { name: m[1].trim(), detail: Number(m[2]) }
        : { name: line.replace(/[,\t;]+$/, "").trim(), detail: null };
    });
}
export function assignDetail(s, id, number) {
  const p = s.participants.find((p) => p.id === id);
  if (!p) throw Error("Participant not found.");
  if (hasActivity(s, p))
    throw Error(`${p.name} has recorded scores and cannot change detail.`);
  if (
    s.dispatches.some(
      (d) => d.status === "awaiting" && d.roster.some((m) => m.id === id),
    )
  )
    throw Error(`${p.name} is awaiting scores. Cancel that first.`);
  const previous = p.detailId,
    d = number === null ? null : ensureDetail(s, number);
  p.detailId = d?.id ?? null;
  for (const [key, draft] of Object.entries(s.drafts))
    if (
      [previous, d?.id].includes(draft.detailId) &&
      draft.rows.every((r) => r.hits === "") &&
      draft.aggregate === ""
    )
      delete s.drafts[key];
  audit(s, "Detail assigned", { participantId: id, detail: d?.name ?? null });
}
// Fills details in number order, so groups of `size` come out in roster order.
// Splits everyone into as few details as possible, each within the allowed size.
export function detailPlan(count, { min = 1, max = count || 1 } = {}) {
  if (count < 1) return [];
  let groups = Math.max(1, Math.ceil(count / max));
  while (groups * min > count && groups > 1) groups--;
  const base = Math.floor(count / groups),
    extra = count % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < extra ? 1 : 0));
}
export function autoDetail(s) {
  if (!isCS(s)) throw Error("Details are only used by Combat Shoot.");
  const waiting = s.participants.filter((p) => !p.detailId);
  if (!waiting.length) throw Error("Everyone already has a detail.");
  const sizes = detailPlan(s.participants.length, DETAIL_RULES[s.program]);
  const inNumber = (n) => {
    const d = s.details.find((x) => !x.temporary && detailNumber(x) === n);
    return d ? members(s, d.id).length : 0;
  };
  let n = 1;
  for (const p of waiting) {
    while (inNumber(n) >= (sizes[n - 1] ?? sizes.at(-1))) n++;
    assignDetail(s, p.id, n);
  }
  audit(s, "Auto-detailed", { sizes, count: waiting.length });
  return sizes;
}
// Problems that stop a shoot from being scored.
export function rosterIssues(s) {
  const issues = [],
    seen = new Map();
  for (const p of s.participants) {
    const key = p.name.trim().toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const repeated = [...seen]
    .filter(([, n]) => n > 1)
    .map(
      ([key]) =>
        s.participants.find((p) => p.name.trim().toLowerCase() === key).name,
    );
  if (repeated.length)
    issues.push(
      `Same name more than once: ${repeated.join(", ")}. Give each firer a different name.`,
    );
  if (!isCS(s)) return issues;
  const unassigned = s.participants.filter((p) => !p.detailId).length,
    used = sortedDetails(s).filter(
      (d) => !d.temporary && members(s, d.id).length,
    ),
    highest = Math.max(0, ...used.map(detailNumber));
  if (unassigned)
    issues.push(
      `${unassigned} ${unassigned === 1 ? "participant needs" : "participants need"} a detail.`,
    );
  for (let n = 1; n < highest; n++)
    if (!used.some((d) => detailNumber(d) === n))
      issues.push(`Detail ${n} is skipped.`);
  for (const d of used)
    for (const e of compositionErrors(s, members(s, d.id)))
      issues.push(`${d.name}: ${e}`);
  return issues;
}
export function compositionErrors(s, people, { checkMinimum = true } = {}) {
  const rule = (isCS(s) && DETAIL_RULES[s.program]) || {},
    errors = [];
  if (!people.length) return ["Detail has no participants."];
  if (checkMinimum && rule.min && people.length < rule.min)
    errors.push(
      `Too few firers: ${people.length}/${rule.min} minimum (${rule.min}–${rule.max} required).`,
    );
  if (rule.max && people.length > rule.max)
    errors.push(`Too many firers: ${people.length}/${rule.max} maximum.`);
  for (const p of people)
    try {
      profileFor(s.program, s.variant, p.weapon);
    } catch (e) {
      errors.push(e.message);
    }
  const nonSAR = people.filter((p) => NON_SAR.has(p.weapon)).length;
  if (rule.nonSAR && nonSAR > rule.nonSAR)
    errors.push(
      `Too many non-SAR21 weapons: ${nonSAR}/${rule.nonSAR} maximum in total.`,
    );
  return [...new Set(errors)];
}
export function addParticipants(s, lines, weapon, detailId = null) {
  const cs = isCS(s);
  if (detailId && !s.details.some((d) => d.id === detailId))
    throw Error("Choose a detail.");
  const entries = parseRoster(
    Array.isArray(lines) ? lines.join("\n") : lines,
    cs && !detailId,
  );
  if (!entries.length) throw Error("Enter full names, one per line.");
  if (entries.length > 1000)
    throw Error("Add up to 1,000 participants at a time.");
  profileFor(s.program, s.variant, weapon);
  for (const e of entries)
    if (e.detail !== null && (e.detail < 1 || e.detail > 500))
      throw Error(`${e.name}: detail numbers start at 1.`);
  const people = entries.map(({ name, detail }) => ({
    id: uid(),
    name,
    detailId: cs
      ? (detailId ?? (detail ? ensureDetail(s, detail).id : null))
      : null,
    weapon,
    recordId: uid(),
    profile: profileFor(s.program, s.variant, weapon),
  }));
  s.participants.push(...people);
  audit(s, "Participants added", { participants: structuredClone(people) });
  return people;
}
function hasActivity(s, p) {
  return (
    s.attempts.some((a) => a.participantId === p.id) ||
    s.shared.some((a) => a.roster.some((m) => m.id === p.id))
  );
}
export function updateParticipant(
  s,
  id,
  { name, weapon, detailId = null },
  reason = "",
) {
  const p = s.participants.find((p) => p.id === id);
  if (!p) throw Error("Participant not found.");
  const cs = isCS(s);
  if (!cs) detailId = null;
  name = name.trim();
  if (!name) throw Error("Enter a full name.");
  if (cs && detailId && !s.details.some((d) => d.id === detailId))
    throw Error("Choose a detail.");
  profileFor(s.program, s.variant, weapon);
  if (
    hasActivity(s, p) &&
    (p.detailId !== detailId || p.weapon !== weapon || p.name !== name) &&
    !reason.trim()
  )
    throw Error("Enter a correction reason to preserve the scoring history.");
  if (
    s.dispatches.some(
      (d) => d.status === "awaiting" && d.roster.some((m) => m.id === id),
    )
  )
    throw Error(
      "This participant is awaiting scores. Record or cancel that first.",
    );
  const changed = { ...p, name, weapon, detailId };
  const previous = structuredClone(p);
  if (p.weapon !== weapon && !cs) {
    changed.recordId = uid();
    changed.profile = profileFor(s.program, s.variant, weapon);
  } else if (p.weapon !== weapon)
    changed.profile = profileFor(s.program, s.variant, weapon);
  Object.assign(p, changed);
  audit(s, "Participant corrected", {
    previous,
    current: structuredClone(p),
    reason,
  });
}
export function fillWeapons(s, weapon) {
  profileFor(s.program, s.variant, weapon);
  if (s.participants.some((p) => p.weapon !== weapon && hasActivity(s, p)))
    throw Error(
      "Some firers already have scores. Change their rifle individually to preserve previous records.",
    );
  if (s.dispatches.some((d) => d.status === "awaiting"))
    throw Error("Record or cancel awaiting scores before changing rifles.");
  const previous = s.participants.map((p) => ({ id: p.id, weapon: p.weapon }));
  for (const p of s.participants) {
    if (p.weapon !== weapon) {
      p.weapon = weapon;
      p.profile = profileFor(s.program, s.variant, weapon);
      if (!isCS(s)) p.recordId = uid();
    }
  }
  s.settings.weapon = weapon;
  audit(s, "Fill all weapons", { weapon, previous });
}
export function removeParticipant(s, id, reason = "") {
  const p = s.participants.find((p) => p.id === id);
  if (!p) throw Error("Participant not found.");
  if (hasActivity(s, p))
    throw Error(
      "This firer has recorded results. Correct their details with a reason instead.",
    );
  if (
    s.dispatches.some(
      (d) => d.status === "awaiting" && d.roster.some((m) => m.id === id),
    )
  )
    throw Error("Cancel their awaiting scores first.");
  s.participants = s.participants.filter((p) => p.id !== id);
  delete s.priorities[`person:${id}`];
  audit(s, "Participant removed", { participant: p, reason });
}
export const draftKey = (detailId, stage) => `${detailId}:${stage}`;
export function getDraft(s, detailId, stage) {
  const key = draftKey(detailId, stage);
  return (s.drafts[key] ??= {
    id: uid(),
    detailId,
    stage,
    createdAt: now(),
    rosterIds: members(s, detailId).map((p) => p.id),
    rows: members(s, detailId).map((p) => ({ participantId: p.id, hits: "" })),
    aggregate: "",
  });
}
export function resetDraft(s, detailId, stage) {
  const key = draftKey(detailId, stage);
  if (s.drafts[key])
    audit(s, "Draft reset", { previous: structuredClone(s.drafts[key]) });
  delete s.drafts[key];
  return getDraft(s, detailId, stage);
}
export function parseHits(input, max) {
  if (input === "" || input === null || input === undefined)
    return { error: "Missing hits." };
  if (!/^\d+$/.test(String(input)) || !Number.isSafeInteger(Number(input)))
    return { error: "Hits must be nonnegative whole numbers." };
  const value = Number(input);
  if (value > max) return { error: `Hits must be 0–${max}.` };
  return { value };
}
// Shared checks for a detail's scores, whether from its entry table or a manual detail.
function scoreRows(s, stage, input, aggregateInput, errors) {
  const shared = isCS(s) && ["A", "C"].includes(stage);
  const rows = input.map((row) => {
    let profile, component;
    try {
      profile = profileFor(s.program, s.variant, row.weapon);
      component = profile.components.find((c) => c.id === stage);
      if (!component) throw Error("Unknown stage.");
    } catch (e) {
      errors.push(e.message);
    }
    const parsed = component
      ? parseHits(row.hits, component.max)
      : { error: "Unsupported weapon." };
    return { ...row, profile, component, parsed };
  });
  if (rows.length)
    errors.push(
      ...compositionErrors(
        s,
        rows.map((r) => ({ weapon: r.weapon })),
      ),
    );
  const hasAggregate =
    aggregateInput !== "" &&
    aggregateInput !== null &&
    aggregateInput !== undefined;
  const someHits = rows.some((r) => r.hits !== "");
  let aggregate = null;
  if (shared && hasAggregate) {
    const max = rows.reduce((n, r) => n + (r.component?.max || 0), 0),
      p = parseHits(aggregateInput, max);
    if (p.error) errors.push(`Detail total: ${p.error}`);
    else aggregate = p.value;
  }
  if (!shared && hasAggregate)
    errors.push(
      "Individual results are required; a detail total cannot supply individual scores.",
    );
  if (!shared || !hasAggregate || someHits) {
    for (const r of rows)
      if (r.parsed.error)
        errors.push(
          `${r.person?.name || "Unknown participant"}: ${r.parsed.error}`,
        );
    if (rows.every((r) => !r.parsed.error)) {
      const sum = rows.reduce((n, r) => n + r.parsed.value, 0);
      if (shared && hasAggregate && aggregate !== null && sum !== aggregate)
        errors.push(
          `Total mismatch: individual hits ${sum}, detail total ${aggregate} (difference ${Math.abs(sum - aggregate)}).`,
        );
      if (!hasAggregate) aggregate = sum;
    }
  }
  return {
    errors: [...new Set(errors)],
    rows,
    aggregate,
    divisor: rows.length,
    shared,
    score:
      shared && aggregate !== null && rows.length
        ? Math.floor(aggregate / rows.length)
        : null,
    mode:
      shared && hasAggregate
        ? someHits
          ? "reconciled"
          : "aggregate"
        : "individual",
  };
}
export function validateDraft(s, draft) {
  const roster = members(s, draft.detailId),
    errors = [];
  const ids = roster.map((p) => p.id),
    rowIds = draft.rows.map((r) => r.participantId);
  if (!sameIds(ids, draft.rosterIds))
    errors.push(
      "Roster changed. Clear these entries to use the current participant list.",
    );
  if (new Set(rowIds).size !== rowIds.length)
    errors.push("Duplicate participant in score entry.");
  if (rowIds.some((id) => !ids.includes(id)))
    errors.push("Unexpected participant in score entry.");
  if (ids.some((id) => !rowIds.includes(id)))
    errors.push("A roster participant is missing from score entry.");
  const rows = draft.rows.map((row) => {
    const person = roster.find((p) => p.id === row.participantId);
    return {
      participantId: row.participantId,
      person,
      weapon: person ? rosterWeapon(s, draft.detailId, person) : "",
      hits: row.hits,
    };
  });
  const v = scoreRows(s, draft.stage, rows, draft.aggregate, errors);
  if (!roster.length) v.errors.push("Detail has no participants.");
  return { ...v, roster };
}
// A detail put together on the spot, e.g. for a swap: any firers, rifles and hits.
export function validateManual(s, stage, entries, aggregate = "") {
  const errors = [],
    ids = entries.map((e) => e.participantId);
  if (!entries.length) errors.push("Choose the firers in this detail.");
  if (new Set(ids).size !== ids.length)
    errors.push("Duplicate participant in score entry.");
  const rows = entries.map((e) => ({
    participantId: e.participantId,
    person: s.participants.find((p) => p.id === e.participantId),
    weapon: e.weapon,
    hits: e.hits ?? "",
  }));
  if (rows.some((r) => !r.person))
    errors.push("Unexpected participant in score entry.");
  return scoreRows(s, stage, rows, aggregate, errors);
}
export function sameIds(a, b) {
  return (
    a.length === b.length &&
    new Set(a).size === a.length &&
    new Set(b).size === b.length &&
    a.every((id) => b.includes(id))
  );
}
function recordDetailAttempt(s, stage, detailId, v, extra = {}) {
  const at = now(),
    detailAttemptId = uid(),
    roster = v.rows.map((r) => ({
      id: r.person.id,
      name: r.person.name,
      recordId: r.person.recordId,
      weapon: r.weapon,
      profile: structuredClone(r.profile),
      rawHits: r.hits === "" ? null : r.parsed.value,
      accounted: true,
    }));
  const detailAttempt = {
    id: detailAttemptId,
    detailId,
    stage,
    roster,
    program: s.program,
    variant: s.variant,
    aggregateHits: v.aggregate,
    divisor: v.divisor,
    score: v.score,
    inputMode: v.mode,
    individualsVerified: v.mode !== "aggregate",
    status: "valid",
    recordedAt: at,
    recorder: "Local device",
    ...extra,
  };
  s.shared.push(detailAttempt);
  for (const row of roster)
    s.attempts.push({
      id: uid(),
      participantId: row.id,
      recordId: row.recordId,
      program: s.program,
      variant: s.variant,
      stage,
      weapon: row.weapon,
      profile: row.profile,
      rawHits: row.rawHits,
      score: v.shared ? v.score : row.rawHits,
      detailAttemptId,
      status: "valid",
      recordedAt: at,
      recorder: "Local device",
    });
  if (detailId) {
    detailAttempt.closedDispatches = closeDispatch(
      s,
      stage,
      `detail:${detailId}`,
    );
    s.manualQueue = s.manualQueue.filter(
      (q) => q.stage !== stage || q.key !== `detail:${detailId}`,
    );
  }
  return detailAttempt;
}
export function saveDetail(s, draft) {
  const v = validateDraft(s, draft);
  if (v.errors.length) throw Error(v.errors.join("\n"));
  const a = recordDetailAttempt(s, draft.stage, draft.detailId, v);
  const detail = s.details.find((d) => d.id === draft.detailId);
  if (detail?.oneOff) detail.retired = true;
  audit(s, "Scores finalized", { detailAttemptId: a.id });
  delete s.drafts[draftKey(draft.detailId, draft.stage)];
  return a;
}
// Replaces a recorded individual score, keeping the original in the history.
export function editIndividual(s, attemptId, hits, weapon) {
  const a = s.attempts.find((x) => x.id === attemptId && x.status === "valid");
  if (!a) throw Error("Score not found.");
  if (a.detailAttemptId)
    throw Error("Edit the detail's scores to change this one.");
  const p = s.participants.find((x) => x.id === a.participantId);
  voidAttempt(s, attemptId, "Replaced by an edit");
  const fresh = recordIndividual(
    s,
    p,
    a.stage,
    hits,
    weapon ?? a.weapon,
    "Edited",
  );
  fresh.revisionOf = attemptId;
  fresh.recordedAt = a.recordedAt;
  a.revisedBy = fresh.id;
  audit(s, "Score edited", { attemptId, replacementId: fresh.id });
  return fresh;
}
// Replaces a recorded detail score: hits, the detail total, or a firer's rifle.
export function editDetailAttempt(s, detailAttemptId, entries, aggregate = "") {
  const old = s.shared.find(
    (d) => d.id === detailAttemptId && d.status === "valid",
  );
  if (!old) throw Error("Detail score not found.");
  const v = validateManual(s, old.stage, entries, aggregate);
  if (v.errors.length) throw Error(v.errors.join("\n"));
  const first = s.attempts.find((x) => x.detailAttemptId === detailAttemptId);
  if (first) voidAttempt(s, first.id, "Replaced by an edit");
  const fresh = recordDetailAttempt(s, old.stage, old.detailId, v, {
    manual: old.manual,
    revisionOf: detailAttemptId,
    recordedAt: old.recordedAt,
  });
  for (const x of s.attempts)
    if (x.detailAttemptId === detailAttemptId) x.revisedBy = fresh.id;
  audit(s, "Detail score edited", {
    detailAttemptId,
    replacementId: fresh.id,
  });
  return fresh;
}
// Removes a temporary detail that no longer has any counted scores.
export function dropTemporaryDetail(s, id) {
  const d = s.details.find((d) => d.id === id && d.temporary);
  if (
    !d ||
    s.shared.some((a) => a.detailId === id && a.status === "valid") ||
    s.dispatches.some((x) => x.key === `detail:${id}` && x.status === "awaiting")
  )
    return false;
  s.details = s.details.filter((x) => x.id !== id);
  for (const key of Object.keys(s.drafts))
    if (s.drafts[key].detailId === id) delete s.drafts[key];
  audit(s, "Temporary detail removed", { detailId: id });
  return true;
}
export function recordIndividual(
  s,
  p,
  stage,
  hits,
  weapon = p.weapon,
  reason = "",
) {
  if (detailedStage(s, stage))
    throw Error("Enter Combat Shoot Stage A and C scores for the whole detail.");
  const profile = profileFor(s.program, s.variant, weapon);
  const component = profile.components.find((c) => c.id === stage);
  if (!component) throw Error("Unknown stage.");
  const parsed = parseHits(hits, component.max);
  if (parsed.error) throw Error(parsed.error);
  if (weapon !== p.weapon && !isCS(s))
    throw Error(
      `Use ${p.weapon} for this record. Change the participant's rifle to start a separate record.`,
    );
  const a = {
    id: uid(),
    participantId: p.id,
    recordId: p.recordId,
    program: s.program,
    variant: s.variant,
    stage,
    weapon,
    profile,
    rawHits: parsed.value,
    score: parsed.value,
    status: "valid",
    recordedAt: now(),
    recorder: "Local device",
    reason,
  };
  s.attempts.push(a);
  a.closedDispatches = closeDispatch(s, stage, `person:${p.id}`);
  s.manualQueue = s.manualQueue.filter(
    (q) => q.stage !== stage || q.key !== `person:${p.id}`,
  );
  audit(s, "Individual score recorded", { attemptId: a.id, reason });
  return a;
}
function closeDispatch(s, stage, key) {
  const closed = [];
  for (const d of s.dispatches)
    if (d.stage === stage && d.status === "awaiting" && d.key === key) {
      d.status = "scored";
      closed.push(d.id);
    }
  return closed;
}
export function eligible(s, p, a) {
  if (
    a.status !== "valid" ||
    a.participantId !== p.id ||
    a.program !== s.program ||
    a.variant !== s.variant
  )
    return false;
  if (a.detailAttemptId) {
    const d = s.shared.find((d) => d.id === a.detailAttemptId);
    if (
      !d ||
      d.status !== "valid" ||
      !d.roster.some((m) => m.id === p.id && m.recordId === a.recordId)
    )
      return false;
  }
  return isCS(s)
    ? a.profile.equivalence === p.profile.equivalence
    : a.recordId === p.recordId &&
        a.weapon === p.weapon &&
        a.profile.id === p.profile.id &&
        a.profile.version === p.profile.version;
}
// Every counted score for a stage, oldest first.
export function scoreHistory(s, p, stage) {
  return s.attempts.filter((a) => a.stage === stage && eligible(s, p, a));
}
export function bestAttempt(s, p, stage) {
  return scoreHistory(s, p, stage).reduce(
    (best, a) => (!best || a.score > best.score ? a : best),
    null,
  );
}
export function best(s, p, stage) {
  return bestAttempt(s, p, stage)?.score ?? null;
}
export function result(s, p) {
  const chosen = p.profile.components.map((c) => bestAttempt(s, p, c.id)),
    scores = chosen.map((a) => a?.score ?? null),
    total = scores.some((v) => v === null)
      ? null
      : scores.reduce((a, b) => a + b, 0);
  return {
    scores,
    bestAttemptIds: chosen.map((a) => a?.id ?? null),
    total,
    status:
      total === null
        ? "Incomplete"
        : total >= p.profile.marksman
          ? "Marksman"
          : total >= p.profile.pass
            ? "Pass"
            : "Fail",
  };
}
export function voidAttempt(s, id, reason) {
  if (!reason.trim()) throw Error("Enter a correction reason.");
  const a = s.attempts.find((a) => a.id === id);
  if (!a || a.status !== "valid") throw Error("Attempt not found.");
  const affected = a.detailAttemptId
    ? s.attempts.filter((x) => x.detailAttemptId === a.detailAttemptId)
    : [a];
  for (const x of affected) {
    x.status = "void";
    x.correction = { reason, at: now(), recorder: "Local device" };
  }
  if (a.detailAttemptId)
    s.shared.find((d) => d.id === a.detailAttemptId).status = "void";
  audit(s, "Scores corrected", {
    attemptIds: affected.map((a) => a.id),
    reason,
  });
}
// Reverses a score just entered: voids it and puts its firers back to awaiting scores.
export function undoAttempt(s, id) {
  const a = s.attempts.find((a) => a.id === id);
  if (!a || a.status !== "valid") throw Error("Nothing to undo.");
  const closed = a.detailAttemptId
    ? s.shared.find((d) => d.id === a.detailAttemptId)?.closedDispatches
    : a.closedDispatches;
  voidAttempt(s, id, "Entry undone");
  for (const d of s.dispatches)
    if (closed?.includes(d.id) && d.status === "scored") d.status = "awaiting";
}
export function target(s, p, stage, objective = s.settings.objective) {
  const c = p.profile.components.find((c) => c.id === stage),
    others = p.profile.components
      .filter((x) => x.id !== stage)
      .map((x) => best(s, p, x.id));
  // With every other stage scored, the threshold is simply what is still needed.
  if (others.every((v) => v !== null))
    return Math.min(
      c.max,
      Math.max(0, p.profile[objective] - others.reduce((a, b) => a + b, 0)),
    );
  const weapon = isCS(s) ? baseWeapons(s.program, s.variant)[0] : p.weapon;
  return (
    s.settings.targets[`${weapon}:${stage}:${objective}`] ??
    Math.ceil((p.profile[objective] * c.max) / p.profile.total)
  );
}
export function goal(s, p, stage) {
  const r = result(s, p);
  if (r.status === "Marksman") return null;
  const potential = p.profile.components.reduce(
      (n, c) => n + (c.id === stage ? c.max : (best(s, p, c.id) ?? c.max)),
      0,
    ),
    choices =
      s.settings.objective === "marksman"
        ? ["marksman", "pass"]
        : ["pass", "marksman"];
  for (let rank = 0; rank < choices.length; rank++) {
    const objective = choices[rank];
    if (objective === "pass" && ["Pass", "Marksman"].includes(r.status))
      continue;
    if (potential >= p.profile[objective])
      return { objective, rank, threshold: p.profile[objective] };
  }
  return null;
}
export function entities(s, stage) {
  return detailedStage(s, stage)
    ? stageDetails(s, stage).map((d) => ({
        key: `detail:${d.id}`,
        detail: d,
        members: members(s, d.id),
      }))
    : s.participants.map((p) => ({
        key: `person:${p.id}`,
        detail: null,
        members: [p],
      }));
}
// Details that score this stage: the permanent ones, plus this stage's temporary details.
export function stageDetails(s, stage) {
  return sortedDetails(s).filter(
    (d) =>
      !d.retired &&
      (!d.temporary || d.stage === stage) &&
      members(s, d.id).length,
  );
}
export function stageMembers(s, detailId) {
  return members(s, detailId).map((p) => ({
    ...p,
    weapon: rosterWeapon(s, detailId, p),
  }));
}
export function stageCompositionErrors(s, detailId, stage) {
  if (!isCS(s)) return [];
  const draft = s.drafts[draftKey(detailId, stage)],
    roster = members(s, detailId);
  if (!roster.length) return ["Detail has no participants."];
  if (
    draft &&
    !sameIds(
      draft.rows.map((r) => r.participantId),
      roster.map((p) => p.id),
    )
  )
    return ["Score entries are out of date. Clear them before redetailing."];
  return compositionErrors(s, stageMembers(s, detailId));
}
export function notYetShot(s, stage) {
  return s.participants.filter((p) => best(s, p, stage) === null);
}
export function setPriority(s, key, tag) {
  if (tag === "high" || tag === "low") s.priorities[key] = tag;
  else delete s.priorities[key];
  audit(s, "Priority changed", { key, tag: tag || null });
}
export function queue(s, stage) {
  const rows = entities(s, stage)
    .filter(
      (e) =>
        !s.dispatches.some(
          (d) =>
            d.key === e.key && d.stage === stage && d.status === "awaiting",
        ),
    )
    .filter(
      (e) =>
        s.manualQueue.some((q) => q.stage === stage && q.key === e.key) ||
        (e.members.some((p) => best(s, p, stage) !== null) &&
          e.members.some((p) => {
            const v = best(s, p, stage),
              g = goal(s, p, stage);
            return (
              v !== null &&
              g &&
              v < p.profile.components.find((c) => c.id === stage).max &&
              v < (target(s, p, stage, g.objective) ?? 0)
            );
          })),
    );
  for (const e of rows) {
    e.errors = e.detail ? stageCompositionErrors(s, e.detail.id, stage) : [];
    e.first = e.members.every((p) => best(s, p, stage) === null);
    // Listed by hand even though the threshold is met.
    e.above =
      !e.first &&
      e.members.every((p) => {
        const v = best(s, p, stage),
          g = goal(s, p, stage);
        return (
          v !== null && (!g || v >= (target(s, p, stage, g.objective) ?? 0))
        );
      });
    e.best = Math.min(...e.members.map((p) => best(s, p, stage) ?? 0));
    e.tag = s.priorities[e.key] || null;
    e.priority = e.members
      .map((p) => {
        const g = goal(s, p, stage),
          v = best(s, p, stage);
        return {
          p,
          rank: v === null ? -1 : (g?.rank ?? 2),
          gap:
            v === null
              ? 0
              : g
                ? Math.max(0, (target(s, p, stage, g.objective) ?? 0) - v) /
                  p.profile.components.find((c) => c.id === stage).max
                : Infinity,
        };
      })
      .sort((a, b) => a.rank - b.rank || a.gap - b.gap)[0];
    e.last = Math.max(
      0,
      ...s.attempts
        .filter(
          (a) =>
            a.status === "valid" &&
            e.members.some((p) => p.id === a.participantId) &&
            a.stage === stage,
        )
        .map((a) => Date.parse(a.recordedAt)),
    );
  }
  const fraction = (e) =>
      e.first
        ? -1
        : e.best /
          e.members[0].profile.components.find((c) => c.id === stage).max,
    tier = (e) => (e.tag === "high" ? 0 : e.tag === "low" ? 2 : 1);
  return rows.sort(
    (a, b) =>
      tier(a) - tier(b) ||
      (s.settings.order === "highest"
        ? fraction(b) - fraction(a)
        : s.settings.order === "first"
          ? a.last - b.last
          : fraction(a) - fraction(b)),
  );
}
export function dispatch(s, stage, keys) {
  // Keep the order the redetailer chose, so the score table follows it.
  const all = entities(s, stage),
    selected = keys.map((key) => all.find((e) => e.key === key)).filter(Boolean);
  if (!selected.length) throw Error("Select firers to redetail.");
  const cap = !isCS(s) && DETAIL_RULES[s.program]?.max;
  if (cap && selected.length > cap)
    throw Error(`Up to ${cap} firers at a time.`);
  for (const e of selected) {
    const errors = e.detail ? stageCompositionErrors(s, e.detail.id, stage) : [];
    if (errors.length) throw Error(`${e.detail.name}: ${errors.join(" ")}`);
    if (
      s.dispatches.some(
        (d) => d.key === e.key && d.stage === stage && d.status === "awaiting",
      )
    )
      throw Error("Already awaiting scores.");
  }
  for (const e of selected)
    s.dispatches.push({
      id: uid(),
      key: e.key,
      stage,
      detailId: e.detail?.id ?? null,
      roster: e.members.map((p) => ({
        id: p.id,
        recordId: p.recordId,
        weapon: e.detail ? rosterWeapon(s, e.detail.id, p) : p.weapon,
      })),
      status: "awaiting",
      at: now(),
    });
  s.manualQueue = s.manualQueue.filter(
    (q) => q.stage !== stage || !keys.includes(q.key),
  );
  audit(s, "Firers redetailed", { stage, keys });
}
export function cancelDispatch(s, id) {
  const d = s.dispatches.find((d) => d.id === id && d.status === "awaiting");
  if (!d) throw Error("Nothing awaiting scores.");
  d.status = "canceled";
  audit(s, "Redetail canceled", { dispatchId: id });
}
export function manualQueue(s, p, stage) {
  const detail = detailedStage(s, stage)
    ? s.details.find(
        (d) =>
          !d.retired &&
          (d.temporary ? d.stage === stage : true) &&
          members(s, d.id).some((m) => m.id === p.id),
      )
    : null;
  queueKey(s, detail ? `detail:${detail.id}` : `person:${p.id}`, stage);
}
// Puts a detail or a firer back in the redetailing list by hand.
export function queueKey(s, key, stage) {
  if (!s.manualQueue.some((q) => q.key === key && q.stage === stage))
    s.manualQueue.push({ key, stage });
  audit(s, "Reshoot queued", { key, stage });
}
export function exportCsv(s) {
  const components = profileFor(s.program, s.variant, s.settings.weapon)
      .components,
    cs = isCS(s);
  const rows = [
    [
      "Name",
      ...(cs ? ["Detail"] : []),
      "Rifle",
      ...components.map((c) => c.label),
      "Total",
      "Out of",
      "Result",
      ...components.map((c) => `${c.label} attempt ID`),
    ],
  ];
  for (const p of s.participants) {
    const r = result(s, p);
    rows.push([
      p.name,
      ...(cs ? [s.details.find((d) => d.id === p.detailId)?.name] : []),
      p.weapon,
      ...r.scores,
      r.total,
      p.profile.total,
      r.status,
      ...r.bestAttemptIds,
    ]);
  }
  return rows
    .map((row) =>
      row
        .map(
          (v) =>
            '"' +
            String(v ?? "")
              .replace(/^[=+@\-\t\r]/, "'$&")
              .replaceAll('"', '""') +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
}
// Upgrades saved data from earlier app versions. Schema 2 kept one roster per
// shoot type and listed rifles individually; rifles are now grouped.
export function migrateStore(data) {
  if (data?.schema === 3) return repairWeapons(data);
  if (data?.schema !== 2 || !data.shoots) throw Error("Invalid Detail IC backup.");
  const store = newStore();
  const old = [
    ...Object.values(data.shoots),
    ...(data.archives || [])
      .filter((a) => a.shoot)
      .map((a) => ({ ...a.shoot, name: a.label })),
  ];
  for (const s of old) {
    if (!s.participants?.length && !s.attempts?.length) continue;
    const variant = s.variant || "standard",
      map = (w) => weaponGroup(s.program, variant, w),
      profile = (w) => profileFor(s.program, variant, w);
    s.id ||= uid();
    s.variant = variant;
    s.name ||= typeLabel(s.program, variant);
    s.createdAt ||= s.audit?.[0]?.at || now();
    s.priorities ||= {};
    for (const p of s.participants) {
      p.weapon = map(p.weapon);
      p.profile = profile(p.weapon);
      if (!isCS(s)) p.detailId = null;
    }
    for (const a of s.attempts) {
      a.weapon = map(a.weapon);
      a.profile = profile(a.weapon);
    }
    for (const d of s.shared)
      for (const m of d.roster) {
        m.weapon = map(m.weapon);
        m.profile = profile(m.weapon);
      }
    for (const d of s.dispatches)
      for (const m of d.roster) m.weapon = map(m.weapon);
    if (isCS(s))
      for (const d of Object.values(s.drafts))
        for (const r of d.rows) r.weapon = map(r.weapon);
    else s.drafts = {};
    s.settings.weapon = map(s.settings.weapon);
    s.settings.targets = Object.fromEntries(
      Object.entries(s.settings.targets || {}).map(([key, value]) => {
        const [w, ...rest] = key.split(":");
        return [[map(w), ...rest].join(":"), value];
      }),
    );
    store.presets[typeKey(s.program, variant)] ??= {
      weapon: s.settings.weapon,
      objective: s.settings.objective,
      targets: structuredClone(s.settings.targets),
    };
    store.shoots.push(s);
  }
  store.active = store.shoots[0]?.id ?? null;
  return store;
}
// Maps rifles that are no longer offered onto the option that replaces them.
export function repairWeapons(store) {
  for (const s of store.shoots ?? []) {
    const options = weaponsFor(s.program, s.variant),
      map = (w) =>
        options.includes(w) ? w : weaponGroup(s.program, s.variant, w),
      profile = (w) => profileFor(s.program, s.variant, w);
    for (const p of s.participants) {
      p.weapon = map(p.weapon);
      if (p.profile?.version !== VERSION) p.profile = profile(p.weapon);
    }
    for (const a of s.attempts) {
      a.weapon = map(a.weapon);
      if (a.profile?.version !== VERSION) a.profile = profile(a.weapon);
    }
    for (const d of s.shared ?? [])
      for (const m of d.roster) {
        m.weapon = map(m.weapon);
        if (m.profile?.version !== VERSION) m.profile = profile(m.weapon);
      }
    for (const d of s.dispatches ?? [])
      for (const m of d.roster) m.weapon = map(m.weapon);
    for (const d of s.details ?? [])
      if (d.weapons)
        for (const key of Object.keys(d.weapons))
          d.weapons[key] = map(d.weapons[key]);
    s.settings.weapon = map(s.settings.weapon);
  }
  return store;
}
export function validateStore(store) {
  if (
    store?.schema !== 3 ||
    !Array.isArray(store.shoots) ||
    !store.presets ||
    typeof store.presets !== "object"
  )
    throw Error("Invalid Detail IC backup.");
  for (const s of store.shoots) {
    if (
      typeof s.id !== "string" ||
      typeof s.name !== "string" ||
      !PROGRAMS[s.program] ||
      !["standard", "ns"].includes(s.variant) ||
      !Array.isArray(s.participants) ||
      !Array.isArray(s.attempts) ||
      !Array.isArray(s.shared) ||
      !Array.isArray(s.details) ||
      !Array.isArray(s.audit) ||
      !s.drafts ||
      !s.priorities ||
      !Array.isArray(s.dispatches) ||
      !Array.isArray(s.manualQueue) ||
      !s.settings ||
      !["marksman", "pass"].includes(s.settings.objective) ||
      !s.settings.targets
    )
      throw Error("Invalid shoot data.");
    for (const p of s.participants) {
      const profile = profileFor(s.program, s.variant, p.weapon);
      if (
        typeof p.id !== "string" ||
        typeof p.name !== "string" ||
        !p.recordId ||
        (isCS(s) &&
          p.detailId !== null &&
          !s.details.some((d) => d.id === p.detailId)) ||
        p.profile?.version !== VERSION ||
        p.profile.id !== profile.id
      )
        throw Error("Invalid participant or profile.");
    }
    for (const a of s.attempts) {
      profileFor(s.program, s.variant, a.weapon);
      if (
        !Number.isInteger(a.score) ||
        a.score < 0 ||
        !["valid", "void"].includes(a.status) ||
        !a.profile
      )
        throw Error("Invalid score record.");
    }
  }
  if (store.active !== null && !store.shoots.some((s) => s.id === store.active))
    store.active = null;
  return store;
}
