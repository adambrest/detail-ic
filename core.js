import {
  PROGRAMS,
  VERSION,
  DETAIL_RULES,
  WEAPON_FAMILY,
  isCS,
  profileFor,
  stages,
} from "./profiles.js";
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function newStore() {
  return {
    schema: 2,
    enabled: [],
    active: null,
    aps: "standard",
    shoots: {},
    archives: [],
  };
}
export function newShoot(program, variant = "standard") {
  return {
    id: uid(),
    program,
    variant,
    participants: [],
    details: [],
    attempts: [],
    shared: [],
    drafts: {},
    dispatches: [],
    manualQueue: [],
    audit: [],
    settings: {
      weapon: "SAR21",
      objective: "marksman",
      order: "automatic",
      targets: {},
    },
  };
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
export function shootKey(program, variant = "standard") {
  return program === "APS" ? `APS:${variant}` : program;
}
export function getShoot(store, program = store.active) {
  if (!program) return null;
  const variant = program === "APS" ? store.aps : "standard",
    key = shootKey(program, variant);
  return (store.shoots[key] ??= newShoot(program, variant));
}
export function enableShoot(store, program, on) {
  if (!PROGRAMS[program]) throw Error("Unknown shoot.");
  store.enabled = store.enabled.filter((p) => p !== program);
  if (on) store.enabled.push(program);
  if (!store.enabled.includes(store.active))
    store.active = store.enabled[0] || null;
}
export function addDetail(s) {
  const d = {
    id: uid(),
    name: `Detail ${Math.max(0, ...s.details.map((d) => Number(d.name.match(/\d+$/)?.[0]) || 0)) + 1}`,
  };
  s.details.push(d);
  audit(s, "Detail added", { detail: structuredClone(d) });
  return d;
}
export function members(s, detailId) {
  return s.participants.filter((p) => p.detailId === detailId);
}
export function compositionErrors(s, people, { checkMinimum = true } = {}) {
  const rule = DETAIL_RULES[s.program] || {},
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
  const nonSAR = people.filter(
    (p) => WEAPON_FAMILY[p.weapon] !== "SAR21",
  ).length;
  if (rule.nonSAR && nonSAR > rule.nonSAR)
    errors.push(
      `Too many non-SAR21 weapons: ${nonSAR}/${rule.nonSAR} maximum in total.`,
    );
  return [...new Set(errors)];
}
function upperBounds(s, people) {
  const errors = compositionErrors(s, people, { checkMinimum: false });
  if (errors.length) throw Error(errors.join(" "));
}
export function addParticipants(s, names, weapon, detailId) {
  if (!s.details.some((d) => d.id === detailId))
    throw Error("Choose a detail.");
  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  if (!cleaned.length) throw Error("Enter full names, one per line.");
  if (cleaned.length > 1000)
    throw Error("Add up to 1,000 participants at a time.");
  const people = cleaned.map((name) => ({
    id: uid(),
    name,
    detailId,
    weapon,
    recordId: uid(),
    profile: profileFor(s.program, s.variant, weapon),
  }));
  upperBounds(s, [...members(s, detailId), ...people]);
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
  { name, weapon, detailId },
  reason = "",
) {
  const p = s.participants.find((p) => p.id === id);
  if (!p) throw Error("Participant not found.");
  name = name.trim();
  if (!name) throw Error("Enter a full name.");
  if (!s.details.some((d) => d.id === detailId))
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
      "Record or cancel the awaiting detail before editing this participant.",
    );
  const changed = { ...p, name, weapon, detailId };
  upperBounds(s, [...members(s, detailId).filter((x) => x.id !== id), changed]);
  const previous = structuredClone(p);
  if (p.weapon !== weapon && !isCS(s)) {
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
      "Some firers already have scores. Change their weapon individually to preserve previous records.",
    );
  if (s.dispatches.some((d) => d.status === "awaiting"))
    throw Error(
      "Record or cancel awaiting details before changing roster weapons.",
    );
  for (const d of s.details)
    if (members(s, d.id).length)
      upperBounds(
        s,
        members(s, d.id).map((p) => ({ ...p, weapon })),
      );
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
      "This firer has recorded results. Move them with an audited roster correction instead.",
    );
  if (
    s.dispatches.some(
      (d) => d.status === "awaiting" && d.roster.some((m) => m.id === id),
    )
  )
    throw Error("Cancel the awaiting detail first.");
  s.participants = s.participants.filter((p) => p.id !== id);
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
    rows: members(s, detailId).map((p) => ({
      participantId: p.id,
      weapon: p.weapon,
      hits: "",
      accounted: false,
    })),
    aggregate: "",
    pasteErrors: [],
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
export function validateDraft(s, draft) {
  const roster = members(s, draft.detailId),
    errors = [...(draft.pasteErrors || [])],
    shared = isCS(s) && ["A", "C"].includes(draft.stage);
  const ids = roster.map((p) => p.id),
    rowIds = draft.rows.map((r) => r.participantId);
  if (!sameIds(ids, draft.rosterIds))
    errors.push(
      "Roster changed. Reset this draft to use the current participant list.",
    );
  if (new Set(rowIds).size !== rowIds.length)
    errors.push("Duplicate participant in score entry.");
  if (rowIds.some((id) => !ids.includes(id)))
    errors.push("Unexpected participant in score entry.");
  if (ids.some((id) => !rowIds.includes(id)))
    errors.push("A roster participant is missing from score entry.");
  const rows = draft.rows.map((row) => {
    const person = roster.find((p) => p.id === row.participantId);
    let profile, component;
    try {
      profile = profileFor(s.program, s.variant, row.weapon);
      component = profile.components.find((c) => c.id === draft.stage);
      if (!component) throw Error("Unknown stage.");
    } catch (e) {
      errors.push(e.message);
    }
    if (person && !isCS(s) && person.weapon !== row.weapon)
      errors.push(
        `${person.name}: weapon must remain ${person.weapon} for this shoot record.`,
      );
    const parsed = component
      ? parseHits(row.hits, component.max)
      : { error: "Unsupported weapon." };
    return { ...row, person, profile, component, parsed };
  });
  errors.push(
    ...compositionErrors(
      s,
      rows.map((r) => ({ weapon: r.weapon })),
    ),
  );
  const hasAggregate =
    draft.aggregate !== "" &&
    draft.aggregate !== null &&
    draft.aggregate !== undefined;
  const someHits = rows.some((r) => r.hits !== "");
  let aggregate = null;
  if (shared && hasAggregate) {
    const max = rows.reduce((n, r) => n + (r.component?.max || 0), 0),
      p = parseHits(draft.aggregate, max);
    if (p.error) errors.push(`Detail total: ${p.error}`);
    else aggregate = p.value;
    const accounted = rows
      .filter((r) => r.accounted)
      .map((r) => r.participantId);
    if (!sameIds(ids, accounted))
      errors.push(
        `Account for every firer: ${accounted.length}/${ids.length} accounted for.`,
      );
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
  if (!roster.length) errors.push("Detail has no participants.");
  return {
    errors: [...new Set(errors)],
    rows,
    aggregate,
    divisor: roster.length,
    shared,
    score:
      shared && aggregate !== null && roster.length
        ? Math.floor(aggregate / roster.length)
        : null,
    mode:
      shared && hasAggregate
        ? someHits
          ? "reconciled"
          : "aggregate"
        : "individual",
    roster,
  };
}
export function sameIds(a, b) {
  return (
    a.length === b.length &&
    new Set(a).size === a.length &&
    new Set(b).size === b.length &&
    a.every((id) => b.includes(id))
  );
}
export function pasteScores(s, draft, text) {
  const roster = members(s, draft.detailId),
    errors = [],
    seen = new Set();
  const updates = [];
  for (const line of text.split(/\r?\n/).filter((l) => l.trim())) {
    const cells = line.split(/\t|,/).map((c) => c.trim());
    if (cells.length !== 2) {
      errors.push(`Use a name or ID and hits on each line: ${line}`);
      continue;
    }
    const [name, hits] = cells;
    const matches = roster.filter(
      (p) => p.id === name || p.name.toLowerCase() === name.toLowerCase(),
    );
    if (matches.length !== 1) {
      errors.push(
        matches.length
          ? "Duplicate names: use participant IDs to distinguish them."
          : `Unexpected participant: ${name}.`,
      );
      continue;
    }
    const p = matches[0];
    if (seen.has(p.id)) {
      errors.push(`Duplicate participant: ${name}.`);
      continue;
    }
    seen.add(p.id);
    updates.push({ id: p.id, hits });
  }
  for (const p of roster)
    if (!seen.has(p.id)) errors.push(`Missing participant: ${p.name}.`);
  for (const u of updates) {
    const row = draft.rows.find((r) => r.participantId === u.id);
    if (row) {
      row.hits = u.hits;
      row.accounted = true;
    }
  }
  draft.pasteErrors = errors;
  audit(s, "Results pasted", { draftId: draft.id, errors });
  return errors;
}
export function saveDetail(s, draft) {
  const v = validateDraft(s, draft);
  if (v.errors.length) throw Error(v.errors.join("\n"));
  const at = now(),
    detailAttemptId = uid(),
    roster = v.rows.map((r) => ({
      id: r.person.id,
      name: r.person.name,
      recordId: r.person.recordId,
      weapon: r.weapon,
      profile: structuredClone(r.profile),
      rawHits: r.hits === "" ? null : r.parsed.value,
      accounted: draft.aggregate !== "" ? r.accounted : true,
    }));
  const detailAttempt = {
    id: detailAttemptId,
    detailId: draft.detailId,
    stage: draft.stage,
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
  };
  s.shared.push(detailAttempt);
  for (const row of roster)
    s.attempts.push({
      id: uid(),
      participantId: row.id,
      recordId: row.recordId,
      program: s.program,
      variant: s.variant,
      stage: draft.stage,
      weapon: row.weapon,
      profile: row.profile,
      rawHits: row.rawHits,
      score: v.shared ? v.score : row.rawHits,
      detailAttemptId,
      status: "valid",
      recordedAt: at,
      recorder: "Local device",
    });
  closeDispatch(
    s,
    draft.detailId,
    draft.stage,
    roster.map((r) => r.id),
  );
  s.manualQueue = s.manualQueue.filter(
    (q) => q.stage !== draft.stage || q.key !== `detail:${draft.detailId}`,
  );
  audit(s, "Scores finalized", { detailAttemptId });
  delete s.drafts[draftKey(draft.detailId, draft.stage)];
  return detailAttempt;
}
export function recordIndividual(
  s,
  p,
  stage,
  hits,
  weapon = p.weapon,
  reason = "",
) {
  if (isCS(s)) throw Error("Save the detail to reconcile every participant.");
  const errors = compositionErrors(s, members(s, p.detailId));
  if (errors.length) throw Error(errors.join(" "));
  const profile = profileFor(s.program, s.variant, weapon);
  const component = profile.components.find((c) => c.id === stage);
  if (!component) throw Error("Unknown stage.");
  const parsed = parseHits(hits, component.max);
  if (parsed.error) throw Error(parsed.error);
  if (weapon !== p.weapon)
    throw Error(
      `Use ${p.weapon} for this shoot record. Change the roster weapon to start a separate record.`,
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
  closeDispatch(s, p.detailId, stage, [p.id]);
  s.manualQueue = s.manualQueue.filter(
    (q) => q.stage !== stage || q.key !== `person:${p.id}`,
  );
  audit(s, "Individual score recorded", { attemptId: a.id, reason });
  return a;
}
function closeDispatch(s, detailId, stage, ids) {
  for (const d of s.dispatches)
    if (
      d.stage === stage &&
      d.status === "awaiting" &&
      d.roster.every((p) => ids.includes(p.id))
    )
      d.status = "scored";
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
export function bestAttempt(s, p, stage) {
  return s.attempts
    .filter((a) => a.stage === stage && eligible(s, p, a))
    .reduce((best, a) => (!best || a.score > best.score ? a : best), null);
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
export function target(s, p, stage, objective = s.settings.objective) {
  const c = p.profile.components.find((c) => c.id === stage);
  if (s.program === "BTP" && stage === "B") {
    const a = best(s, p, "A");
    return a === null ? null : Math.max(0, p.profile[objective] - a);
  }
  return (
    s.settings.targets[`${p.weapon}:${stage}:${objective}`] ??
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
  return isCS(s)
    ? s.details
        .filter((d) => members(s, d.id).length)
        .map((d) => ({
          key: `detail:${d.id}`,
          detail: d,
          members: members(s, d.id),
        }))
    : s.participants.map((p) => ({
        key: `person:${p.id}`,
        detail: s.details.find((d) => d.id === p.detailId),
        members: [p],
      }));
}
export function stageMembers(s, detailId, stage) {
  const roster = members(s, detailId),
    draft = s.drafts[draftKey(detailId, stage)];
  return roster.map((p) => ({
    ...p,
    weapon:
      draft?.rows.find((r) => r.participantId === p.id)?.weapon || p.weapon,
  }));
}
export function stageCompositionErrors(s, detailId, stage) {
  const draft = s.drafts[draftKey(detailId, stage)],
    roster = members(s, detailId);
  if (
    draft &&
    !sameIds(
      draft.rows.map((r) => r.participantId),
      roster.map((p) => p.id),
    )
  )
    return ["Score draft roster changed. Reset the draft before detailing."];
  return compositionErrors(s, stageMembers(s, detailId, stage));
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
        e.members.some((p) => {
          const v = best(s, p, stage),
            g = goal(s, p, stage),
            r = result(s, p);
          return (
            v === null ||
            (g &&
              v < p.profile.components.find((c) => c.id === stage).max &&
              (r.total === null
                ? v < (target(s, p, stage, g.objective) ?? 0)
                : r.total < g.threshold))
          );
        }),
    );
  for (const e of rows) {
    e.errors = stageCompositionErrors(s, e.detail.id, stage);
    e.first = e.members.some((p) => best(s, p, stage) === null);
    e.best = Math.min(...e.members.map((p) => best(s, p, stage) ?? 0));
    e.priority = e.members
      .map((p) => {
        const g = goal(s, p, stage),
          v = best(s, p, stage),
          r = result(s, p);
        return {
          p,
          rank: v === null ? -1 : (g?.rank ?? 2),
          gap:
            v === null
              ? 0
              : g
                ? r.total === null
                  ? Math.max(0, (target(s, p, stage, g.objective) ?? 0) - v) /
                    p.profile.components.find((c) => c.id === stage).max
                  : (g.threshold - r.total) / p.profile.total
                : Infinity,
        };
      })
      .sort((a, b) => a.rank - b.rank || a.gap - b.gap)[0];
    e.last = Math.max(
      0,
      ...s.attempts
        .filter(
          (a) =>
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
        e.members[0].profile.components.find((c) => c.id === stage).max;
  return rows.sort((a, b) =>
    s.settings.order === "lowest"
      ? fraction(a) - fraction(b)
      : s.settings.order === "highest"
        ? fraction(b) - fraction(a)
        : s.settings.order === "first"
          ? a.last - b.last
          : a.priority.rank - b.priority.rank ||
            a.priority.gap - b.priority.gap,
  );
}
export function dispatch(s, stage, keys) {
  const selected = entities(s, stage).filter((e) => keys.includes(e.key));
  if (!selected.length) throw Error("Select firers to detail.");
  for (const e of selected) {
    const errors = stageCompositionErrors(s, e.detail.id, stage);
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
      detailId: e.detail.id,
      roster: e.members.map((p) => ({
        id: p.id,
        recordId: p.recordId,
        weapon: stageMembers(s, e.detail.id, stage).find((m) => m.id === p.id)
          .weapon,
      })),
      status: "awaiting",
      at: now(),
    });
  s.manualQueue = s.manualQueue.filter(
    (q) => q.stage !== stage || !keys.includes(q.key),
  );
  audit(s, "Firers detailed", { stage, keys });
}
export function manualQueue(s, p, stage) {
  const key = isCS(s) ? `detail:${p.detailId}` : `person:${p.id}`;
  if (!s.manualQueue.some((q) => q.key === key && q.stage === stage))
    s.manualQueue.push({ key, stage });
  audit(s, "Reshoot queued", { key, stage });
}
export function exportCsv(s) {
  const rows = [
    [
      "Name",
      "Detail",
      "Weapon",
      ...stages(s).map((c) => c.label),
      "Total",
      "Out of",
      "Result",
      ...stages(s).map((c) => `${c.label} attempt ID`),
    ],
  ];
  for (const p of s.participants) {
    const r = result(s, p);
    rows.push([
      p.name,
      s.details.find((d) => d.id === p.detailId)?.name,
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
export function validateStore(store) {
  if (
    store?.schema !== 2 ||
    !Array.isArray(store.enabled) ||
    store.enabled.some((p) => !PROGRAMS[p]) ||
    !store.shoots ||
    !Array.isArray(store.archives) ||
    !["standard", "ns"].includes(store.aps)
  )
    throw Error("Invalid Detail IC backup.");
  for (const s of Object.values(store.shoots)) {
    if (
      !PROGRAMS[s.program] ||
      !Array.isArray(s.participants) ||
      !Array.isArray(s.attempts) ||
      !Array.isArray(s.shared) ||
      !Array.isArray(s.details) ||
      !Array.isArray(s.audit) ||
      !s.drafts ||
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
        !s.details.some((d) => d.id === p.detailId) ||
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
  return store;
}
