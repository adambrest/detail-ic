import {
  PROGRAMS,
  TYPES,
  DETAIL_RULES,
  isCS,
  typeLabel,
  weaponsFor,
  baseWeapons,
  profileFor,
  stages,
  targetStages,
} from "./profiles.js";
import {
  uid,
  now,
  newStore,
  preset,
  applyPreset,
  applyPresets,
  createShoot,
  getShoot,
  hasScores,
  setRosterLock,
  detailedStage,
  stageDetails,
  deleteShoot,
  changeShootType,
  audit,
  members,
  sortedDetails,
  detailNumber,
  borrowedBy,
  rosterWeapon,
  assignDetail,
  autoDetail,
  rosterIssues,
  addParticipants,
  ensureDetail,
  updateParticipant,
  fillWeapons,
  removeParticipant,
  clearParticipants,
  compositionErrors,
  getDraft,
  resetDraft,
  validateDraft,
  saveDetail,
  createTempDetail,
  dropTemporaryDetail,
  editIndividual,
  editDetailAttempt,
  recordIndividual,
  parseHits,
  scoreHistory,
  nextAttempt,
  detailAttempts,
  firingQueue,
  setSkipped,
  nothingToGain,
  insights,
  weakFirers,
  buildAround,
  planRest,
  firerHits,
  detailPlan,
  parseRoster,
  MISSING,
  attemptNumbers,
  detailAttemptNumbers,
  best,
  result,
  voidAttempt,
  undoAttempt,
  target,
  stageCompositionErrors,
  notYetShot,
  setPriority,
  queue,
  queueKey,
  entities,
  dispatch,
  cancelDispatch,
  exportCsv,
  migrateStore,
  validateStore,
} from "./core.js";
const $ = (q) => document.querySelector(q),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const KEY = "detail-ic-v2";
let store,
  lastSaved = null,
  storageError = false,
  tab = "shoots",
  search = "",
  selected = new Set(),
  openPresets = new Set(),
  showScored = false,
  addMode = null,
  addNote = "",
  showReached = false,
  closedSummaries = new Set(),
  pasteDetail = 1,
  apsView = "standard",
  busy = false,
  pointerDown = false,
  pending = null;
try {
  lastSaved = localStorage.getItem(KEY);
  store = lastSaved
    ? validateStore(migrateStore(JSON.parse(lastSaved)))
    : newStore();
  applyPresets(store);
} catch (e) {
  store = newStore();
  storageError = true;
}
const s = () => getShoot(store);
const format = (v) => (v === null || v === undefined ? "—" : String(v));
const ratio = (v, max) => `${format(v)}/${max}`;
const weapons = (c) => weaponsFor(c.program, c.variant);
const dateLabel = (iso) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const stageLabel = (c, stage) => stages(c).find((x) => x.id === stage).label;
// ATP and Combat Shoot start on Stage B, while there is daylight for A later.
const firstStage = (c) =>
  ["ATP_M", "ATP_SP"].includes(c.program) || isCS(c) ? "B" : stages(c)[0].id;
const reduceMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;
// Re-rendering while a button is pressed would swallow its click, so wait.
function later(fn) {
  if (pointerDown) pending = fn;
  else fn();
}
document.addEventListener("pointerdown", () => (pointerDown = true), true);
document.addEventListener(
  "pointerup",
  () => {
    pointerDown = false;
    if (pending)
      setTimeout(() => {
        const fn = pending;
        pending = null;
        fn?.();
      });
  },
  true,
);
function option(values, value) {
  return values
    .map(
      (v) =>
        `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(v)}</option>`,
    )
    .join("");
}
function badge(text) {
  return `<span class="badge ${text === "Marksman" ? "blue" : text === "Pass" ? "green" : text === "Fail" ? "red" : ""}">${esc(text)}</span>`;
}
function warning(message) {
  $("#storage-warning").textContent = message;
  $("#storage-warning").hidden = false;
}
function save() {
  try {
    if (storageError)
      throw Error(
        "Stored data could not be read. Export any new work before reloading.",
      );
    if (localStorage.getItem(KEY) !== lastSaved)
      throw Error("Changed in another tab. Export your work, then reload.");
    const data = JSON.stringify(store);
    localStorage.setItem(KEY, data);
    lastSaved = data;
    $("#storage-warning").hidden = true;
    return true;
  } catch (e) {
    warning(e.message || "Storage is full. Export a backup.");
    return false;
  }
}
function toast(text, undo) {
  const t = $("#toast");
  t.innerHTML = `<span>${esc(text)}</span>${undo ? '<button type="button" id="undo">Undo</button>' : ""}`;
  t.classList.add("show");
  if (undo)
    $("#undo").onclick = () => {
      t.classList.remove("show");
      try {
        undo();
        save();
        render();
      } catch (e) {
        toast(e.message);
      }
    };
  clearTimeout(toast.timer);
  toast.timer = setTimeout(
    () => t.classList.remove("show"),
    undo ? 6000 : 3500,
  );
}
function info(text) {
  return `<button class="info" type="button" aria-label="${esc(text)}">i<span class="tooltip">${esc(text)}</span></button>`;
}
function empty(text, button = "") {
  return `<div class="empty"><h2>${esc(text)}</h2>${button}</div>`;
}
function filtered(p) {
  return `${p.name} ${p.weapon}`.toLowerCase().includes(search.toLowerCase());
}
function shootHead(extra = "", editable = false) {
  const c = s(),
    types = TYPES;
  const type = editable
    ? `<select id="shoot-type" class="shoot-select" aria-label="Shoot type" ${hasScores(c) ? "disabled" : ""}>${types.map(([p, v]) => `<option value="${p}|${v}" ${p === c.program && v === c.variant ? "selected" : ""}>${esc(typeLabel(p, v))}</option>`).join("")}</select>`
    : `<span class="badge">${esc(typeLabel(c.program, c.variant))}</span>`;
  return `<div class="toolbar"><strong class="shoot-name">${esc(c.name)}</strong>${type}${extra}</div>`;
}
function borrowedNote(c, d, stage) {
  const list = borrowedBy(c, d.id, stage);
  if (!list.length) return "";
  const text = `${list.map((x) => `${x.detail.name} took ${x.people.map((p) => p.name).join(", ")}`).join(". ")} from this detail.`;
  return `<button class="info warn" type="button" aria-label="${esc(text)}">⚠<span class="tooltip">${esc(text)}</span></button>`;
}
function searchBox() {
  return `<input type="search" id="search" placeholder="Find a participant" aria-label="Find a participant" value="${esc(search)}">`;
}
function render() {
  const current = s(),
    tabs = [
      ["shoots", "Shoots"],
      ...(current
        ? [
            ["participants", "Participants"],
            ...stages(current).map((c) => [`stage:${c.id}`, c.label]),
            ["final", "Final scores"],
          ]
        : []),
      ["settings", "Settings"],
    ];
  if (!tabs.some((t) => t[0] === tab)) tab = "shoots";
  // Scoring opens only once the participants are confirmed.
  const scoring = (key) => key.startsWith("stage:") || key === "final",
    shut = current && !current.locked;
  if (shut && scoring(tab)) tab = "participants";
  $("#tabs").innerHTML = tabs
    .map(
      ([key, label]) =>
        `<button data-tab="${key}" class="${tab === key ? "on" : ""}" ${tab === key ? 'aria-current="page"' : ""} ${shut && scoring(key) ? 'disabled title="Confirm the participants first"' : ""}>${esc(label)}</button>`,
    )
    .join("");
  if (tab === "shoots") renderShoots();
  else if (tab === "settings") renderSettings();
  else if (tab === "participants") renderParticipants();
  else if (tab === "final") renderFinal();
  else renderStage(tab.split(":")[1]);
}
function renderShoots() {
  const types = TYPES,
    list = store.shoots.toSorted(
      (a, b) =>
        (b.id === store.active) - (a.id === store.active) ||
        b.createdAt.localeCompare(a.createdAt),
    );
  $("#main").innerHTML =
    `<div class="shoots"><section class="panel"><div class="panel-head"><h2>New shoot</h2></div><div class="panel-body">${
      types.length
        ? `<form id="new-shoot"><div class="type-grid" role="radiogroup" aria-label="Shoot type">${types.map(([p, v], i) => `<label class="type-option"><input type="radio" name="type" value="${p}|${v}" ${i === 0 ? "checked" : ""}><span>${esc(typeLabel(p, v))}</span></label>`).join("")}</div><label class="field"><span>Shoot name</span><input name="name" required autocomplete="off" placeholder="e.g. Alpha Coy · ${esc(dateLabel(now()))}"></label><button class="primary" type="submit">Create shoot</button></form>`
        : ""
    }</div></section>${
      list.length
        ? `<section class="panel"><div class="panel-head"><h3>Shoots <span class="count">${list.length}</span></h3></div>${list
            .map(
              (x) =>
                `<div class="shoot-row"><div><strong>${esc(x.name)}</strong><p class="note">${esc(typeLabel(x.program, x.variant))} · ${esc(dateLabel(x.createdAt))} · ${x.participants.length} participants · ${hasScores(x) ? "Scores recorded" : "No scores yet"}</p></div><div class="actions"><button class="danger" data-delete-shoot="${x.id}" aria-label="Delete ${esc(x.name)}">Delete</button><button ${x.id === store.active ? 'class="primary"' : ""} data-open-shoot="${x.id}" aria-label="${x.id === store.active ? "Continue" : "Open"} ${esc(x.name)}">${x.id === store.active ? "Continue" : "Open"}</button></div></div>`,
            )
            .join("")}</section>`
        : ""
    }<div class="toolbar shoots-data"><button data-action="backup">Export backup</button><button data-action="restore">Import backup</button></div></div>`;
}
// Detail buttons offered per participant: as many details as the minimum size allows.
function nextDetailNumber(c) {
  return (
    Math.max(
      0,
      ...c.details.filter((d) => !d.temporary).map(detailNumber),
    ) + 1
  );
}
function addPanel(c) {
  const cs = isCS(c),
    rifle =
      weapons(c).length > 1
        ? `<label class="field inline"><span>Rifle</span><select id="add-weapon" aria-label="Rifle for these participants">${option(weapons(c), c.settings.weapon)}</select></label>`
        : "";
  if (!addMode)
    return c.participants.length
      ? '<div class="add-bar"><button class="primary" data-action="add">Add participants</button></div>'
      : "";
  if (addMode === "choose")
    return `<section class="panel add-panel"><div class="panel-head"><h3>Add participants</h3><button class="icon-button" data-action="add-close" aria-label="Close">✕</button></div><div class="panel-body"><p class="note">Do you already know who is in each detail?</p><div class="actions"><button class="primary" data-action="add-by-detail">Paste detail by detail</button><button data-action="add-list">Paste the whole list</button></div></div></section>`;
  const byDetail = addMode === "detail";
  return `<section class="panel add-panel"><div class="panel-head"><h3>${byDetail ? `Paste Detail ${pasteDetail}` : "Paste full names"}</h3><button class="icon-button" data-action="add-close" aria-label="Close">✕</button></div><div class="panel-body"><textarea id="add-names" aria-label="${byDetail ? `Full names for Detail ${pasteDetail}` : "Full names"}" placeholder="Alex Tan&#10;Benjamin Lee"></textarea>${rifle}<div class="actions">${byDetail ? '<button class="primary" data-action="add-next">Confirm and next detail</button><button data-action="add-done">Done</button>' : '<button class="primary" data-action="add-save">Add participants</button>'}</div><div class="errors add-note">${esc(addNote)}</div><p class="note">${byDetail ? `Everyone in this box joins Detail ${pasteDetail}.` : cs ? "One full name per line. A detail number after a name puts them straight into it, for example “Alex Tan, 2”." : "One full name per line."}</p></div></section>`;
}
function renderParticipants() {
  const c = s(),
    cs = isCS(c),
    multi = weapons(c).length > 1,
    base = baseWeapons(c.program, c.variant),
    locked = c.locked,
    rifle =
      base.length > 1 && !locked
        ? `<label class="muted" for="fill-weapon">Rifle</label><select id="fill-weapon" aria-label="Rifle for fill all">${option(base, c.settings.weapon)}</select><button data-action="fill-all">Fill all</button>`
        : "",
    matches = (p) => search && filtered(p),
    highest = Math.max(
      0,
      ...c.details.filter((d) => !d.temporary).map(detailNumber),
    );
  const picker = (p) => {
    const fixed =
        locked ||
        c.attempts.some((a) => a.participantId === p.id) ||
        c.dispatches.some(
          (d) => d.status === "awaiting" && d.roster.some((m) => m.id === p.id),
        ),
      detail = c.details.find((d) => d.id === p.detailId),
      n = detail && !detail.temporary ? detailNumber(detail) : 0;
    return `<td><select class="assign" data-assign="${p.id}" aria-label="Detail for ${esc(p.name)}" ${fixed ? "disabled" : ""}><option value="" ${n ? "" : "selected"}>—</option>${Array.from(
      { length: Math.max(highest, n) },
      (_, i) =>
        `<option value="${i + 1}" ${i + 1 === n ? "selected" : ""}>Detail ${i + 1}</option>`,
    ).join("")}<option value="new">New detail</option></select></td>`;
  };
  const row = (p) =>
    `<tr class="${matches(p) ? "match" : ""}"><td class="name"><input class="name-input" type="text" data-name="${p.id}" value="${esc(p.name)}" aria-label="Name for ${esc(p.name)}" ${locked ? "disabled" : ""}></td>${multi ? `<td><select class="row-weapon" data-rifle="${p.id}" aria-label="Rifle for ${esc(p.name)}" ${locked ? "disabled" : ""}>${option(weapons(c), p.weapon)}</select></td>` : ""}${cs ? picker(p) : ""}<td class="more-cell">${locked ? "" : `<button class="icon-button danger" data-remove="${p.id}" aria-label="Remove ${esc(p.name)}">✕</button>`}</td></tr>`;
  const table = (people) =>
    `<div class="table-wrap"><table><thead><tr><th>Full name</th>${multi ? "<th>Rifle</th>" : ""}${cs ? "<th>Detail</th>" : ""}<th></th></tr></thead><tbody>${people.map(row).join("")}</tbody></table></div>`;
  let body = "";
  if (!c.participants.length)
    body = addMode
      ? ""
      : empty(
          "No participants yet",
          '<p>Paste full names, one per line.</p><button class="primary" data-action="add">Add participants</button>',
        );
  else if (cs) {
    const issues = rosterIssues(c),
      unassigned = members(c, null),
      groups = [
        ...(unassigned.length ? [[null, unassigned]] : []),
        ...sortedDetails(c)
          .filter((d) => members(c, d.id).length)
          .map((d) => [d, members(c, d.id)]),
      ].filter(([, people]) => !search || people.some(filtered));
    body =
      (issues.length
        ? `<div class="panel issues" role="status">${esc(issues.join("\n"))}</div>`
        : "") +
      groups
        .map(([d, people]) =>
          d?.temporary
            ? `<section class="panel temporary"><div class="detail-head"><h3>${esc(d.name)}</h3><span class="count">${people.length} firers</span></div><div class="table-wrap"><table><thead><tr><th>Full name</th><th>Rifle</th></tr></thead><tbody>${people.map((p) => `<tr class="${matches(p) ? "match" : ""}"><td class="name">${esc(p.name)}</td><td>${esc(rosterWeapon(c, d.id, p))}</td></tr>`).join("")}</tbody></table></div></section>`
            : `<section class="panel ${d ? "" : "unassigned"}"><div class="detail-head"><h3>${d ? esc(d.name) : "Needs a detail"}</h3>${d ? borrowedNote(c, d) : ""}<span class="count">${people.length} firers</span>${d || locked ? "" : '<div class="actions"><button class="primary" data-action="auto-detail">Auto-detail</button></div>'}</div>${table(people)}</section>`,
        )
        .join("");
  } else
    body = `<section class="panel">${table(c.participants.filter(filtered))}</section>`;
  const ready = c.participants.length && !rosterIssues(c).length;
  $("#main").innerHTML =
    shootHead(`<span class="spacer"></span>${rifle}`, true) +
    (hasScores(c)
      ? '<p class="note lock-note">Scores are recorded, so the shoot type is locked. <button class="inline-link" data-action="shoots">Start a new shoot</button> to use a different type.</p>'
      : "") +
    (locked
      ? `<div class="panel confirmed"><span>Participants confirmed and locked.${isCS(c) ? " Stage B rifles can still change on its tab." : ""}</span><div class="actions"><button data-action="unlock">Edit participants</button><button class="primary" data-action="to-stage">Go to ${esc(stageLabel(c, firstStage(c)))}</button></div></div>`
      : "") +
    (locked ? "" : addPanel(c)) +
    (c.participants.length
      ? `<div class="toolbar">${searchBox()}<span class="count">${c.participants.length} participants</span><span class="spacer"></span>${locked ? "" : `<button class="danger" data-action="clear-participants">Clear participants</button>${ready ? '<button class="primary" data-action="confirm-participants">Confirm participants</button>' : ""}`}</div>`
      : "") +
    body;
  if (addMode === "detail" || addMode === "list") $("#add-names")?.focus();
}
function awaiting(c, stage) {
  const map = new Map();
  for (const d of c.dispatches)
    if (d.stage === stage && d.status === "awaiting")
      for (const m of d.roster) if (!map.has(m.id)) map.set(m.id, map.size);
  return map;
}
function resultsCell(c, p, stage) {
  const list = scoreHistory(c, p, stage);
  if (!list.length) return '<span class="muted">—</span>';
  const best = Math.max(...list.map((a) => a.score)),
    rest = list.map((a) => a.score);
  rest.splice(rest.indexOf(best), 1);
  return `<b>${best}</b>${rest.length ? `<span class="prev">${rest.join(" ")}</span>` : ""}`;
}
function renderStage(stage) {
  const c = s(),
    q = queue(c, stage);
  selected = new Set(
    [...selected].filter((key) =>
      q.some((e) => e.key === key && !e.errors.length),
    ),
  );
  $("#main").innerHTML =
    shootHead(
      `<span class="spacer"></span>${searchBox()}${isCS(c) ? '<button data-action="manual-detail">Manual detail</button>' : ""}`,
    ) +
    issuesPanel(c) +
    `<div class="grid"><div class="score-col">${detailedStage(c, stage) ? detailPanels(c, stage) : individualPanel(c, stage)}</div><div class="side-col">${summaryPanel(c, stage)}${queuePanel(c, stage, q)}</div></div>`;
}
// Roster problems that will block scoring, with one link to fix them.
function issuesPanel(c) {
  const issues = rosterIssues(c);
  return issues.length
    ? `<div class="panel issues" role="status">${esc(issues.join("\n"))}\n<button class="inline-link" data-action="participants">Fix in Participants</button></div>`
    : "";
}
function entryValue(c, stage, p) {
  return c.entries?.[`${stage}:${p.id}`] ?? "";
}
function individualPanel(c, stage) {
  if (!c.participants.length)
    return empty(
      "Add participants first",
      '<p><button data-action="participants">Participants</button></p>',
    );
  const waiting = awaiting(c, stage),
    cs = isCS(c),
    multi = weapons(c).length > 1,
    detailOf = (p) => {
      const d = c.details.find((x) => x.id === p.detailId);
      return d && !d.temporary ? detailNumber(d) : 99;
    },
    order = firingQueue(c, stage),
    entry = new Map(order.map((e, i) => [e.members[0].id, { ...e, n: i }])),
    toShoot = order.map((e) => e.members[0]).filter(filtered),
    done = c.participants
      .filter((p) => filtered(p) && !toShoot.includes(p))
      .toSorted((a, b) => detailOf(a) - detailOf(b)),
    entered = toShoot.filter((p) => entryValue(c, stage, p) !== "").length,
    weak = new Set(weakFirers(c, stage).map((x) => x.p.id));
  const row = (p) => {
    const max = p.profile.components.find((x) => x.id === stage).max,
      e = entry.get(p.id),
      typed = entryValue(c, stage, p) !== "";
    return `<tr data-row="${p.id}" class="${[waiting.has(p.id) && "awaiting", e.n === 0 && !e.skipped && "next", e.skipped && "skipped", search && "match"].filter(Boolean).join(" ")}"><td class="seat">${e.n + 1}</td><td class="name">${esc(p.name)}${weak.has(p.id) ? ` ${badge("Weak")}` : ""}${multi && !cs && p.weapon !== c.settings.weapon ? `<div class="sub">${esc(p.weapon)}</div>` : ""}<div class="attempt ${waiting.has(p.id) ? "on" : ""}">${e.skipped ? "Skipped · " : ""}Attempt ${e.attempt}${waiting.has(p.id) ? " · redetailed" : ""}</div></td>${cs ? `<td><select class="row-weapon" data-stage-rifle="${p.id}" aria-label="${esc(p.name)} rifle for ${esc(stageLabel(c, stage))}">${option(weapons(c), stageRifle(c, p, stage))}</select></td>` : ""}<td><div class="score-input"><input type="number" min="0" max="${max}" step="1" inputmode="numeric" enterkeyhint="next" data-hits="${p.id}" value="${esc(entryValue(c, stage, p))}" aria-label="${esc(p.name)} hits" placeholder="${e.skipped ? "Skipped" : "—"}" ${e.skipped ? "disabled" : ""}><span class="muted">/${max}</span></div></td><td class="num results">${resultsCell(c, p, stage)}</td><td class="more-cell">${order.length > 1 ? skipButton(`person:${p.id}`, p.name, e.skipped, typed) : ""}<button class="more" data-person="${p.id}" aria-label="Options for ${esc(p.name)}">⋯</button></td></tr>`;
  };
  const scoredRow = (p) =>
    `<tr data-row="${p.id}" class="${search ? "match" : ""}"><td class="name">${esc(p.name)}</td><td class="num results">${resultsCell(c, p, stage)}</td><td class="more-cell"><button class="more" data-person="${p.id}" aria-label="Options for ${esc(p.name)}">⋯</button></td></tr>`;
  return (
    `<section class="panel score-panel" data-individual><div class="detail-head"><h3>${esc(stageLabel(c, stage))}</h3><span class="count">${toShoot.length} in the queue</span></div><p class="note stage-note">${queueNote}${cs ? " Fired individually. Details do not apply to this stage; a firer may use a different rifle for it." : ""}</p>${
      toShoot.length
        ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>Full name</th>${cs ? "<th>Rifle</th>" : ""}<th>Hits</th><th>Results</th><th></th></tr></thead><tbody>${toShoot.map(row).join("")}</tbody></table></div>`
        : `<div class="panel-body note">Everyone has a ${esc(stageLabel(c, stage))} score. Redetail firers to enter more.</div>`
    }<div class="errors draft-errors" role="alert"></div>${
      toShoot.length
        ? `<div class="score-footer"><span class="draft-summary">${entered} of ${toShoot.length} entered.</span><button class="primary" data-confirm-all="${stage}">Confirm scores</button></div>`
        : ""
    }</section>` +
    (done.length
      ? `<details class="panel past-scores"${search ? " open" : ""}><summary>Past scores · ${done.length} ${done.length === 1 ? "firer" : "firers"}</summary><div class="table-wrap"><table><thead><tr><th>Full name</th><th>Results</th><th></th></tr></thead><tbody>${done.map(scoredRow).join("")}</tbody></table></div></details>`
      : "")
  );
}
// Composition problems belong to the roster and are reported at the top of the
// tab, so a detail's score line does not repeat them.
const COMPOSITION =
  /^(Too few firers|Too many firers|Too many non-SAR21|Detail has no participants)/;
function draftErrors(c, draft) {
  const hasInput =
    draft.rows.some((r) => r.hits !== "") || draft.aggregate !== "";
  const errors = hasInput
    ? validateDraft(c, draft).errors
    : stageCompositionErrors(c, draft.detailId, draft.stage);
  return errors.filter((e) => !COMPOSITION.test(e) && !e.startsWith(MISSING));
}
function draftSummary(c, draft) {
  const v = validateDraft(c, draft),
    max = stages(c).find((x) => x.id === draft.stage).max,
    entered = draft.rows.filter((r) => r.hits !== "").length;
  return v.shared && v.score !== null
    ? `Average ${v.aggregate}/${v.divisor} → ${v.score}/${max}.`
    : entered
      ? `${entered} of ${v.rows.length} entered.`
      : `${v.rows.length} firers.`;
}
function hasInput(draft) {
  return !!draft && (draft.aggregate !== "" || draft.rows.some((r) => r.hits !== ""));
}
// How the order on a stage tab is made, said once above it.
const queueNote =
  "Firing order: first attempts, then redetails as sent. Skip moves someone not ready to the bottom.";
// Skip toggles; it greys out once hits are typed, since that entry is firing.
function skipButton(key, name, on, typed) {
  return `<button type="button" class="skip ${on ? "on" : ""}" data-skip="${esc(key)}" aria-pressed="${!!on}" ${typed ? "disabled" : ""} title="${on ? "Skipped: tap to put back in its place" : "Skip: move below everyone waiting"}" aria-label="${on ? "Unskip" : "Skip"} ${esc(name)}">${on ? "Skipped" : "Skip"}</button>`;
}
// Combat Shoot Stage B can be fired on a different rifle, remembered per firer.
// Every CS rifle has the same stage limits and thresholds, so the total holds.
function stageRifle(c, p, stage) {
  return c.stageRifles?.[`${p.id}:${stage}`] ?? p.weapon;
}
function detailPanels(c, stage) {
  const waiting = awaiting(c, stage),
    label = stageLabel(c, stage),
    shared = ["A", "C"].includes(stage),
    cmax = stages(c).find((x) => x.id === stage).max,
    all = stageDetails(c, stage),
    order = firingQueue(c, stage),
    entry = new Map(order.map((e, i) => [e.detail.id, { ...e, n: i }])),
    open = all
      .filter((d) => entry.has(d.id) || hasInput(c.drafts[`${d.id}:${stage}`]))
      .toSorted(
        (a, b) => (entry.get(a.id)?.n ?? 1e9) - (entry.get(b.id)?.n ?? 1e9),
      ),
    scored = all.length - open.length,
    toggle =
      scored && !search
        ? `<p class="note scored-toggle"><button class="inline-link" data-action="toggle-scored">${showScored ? "Hide scored details" : `Show ${scored} scored ${scored === 1 ? "detail" : "details"}`}</button></p>`
        : "",
    shown = search
      ? all.filter((d) => members(c, d.id).some(filtered))
      : showScored
        ? [...open, null, ...all.filter((d) => !open.includes(d))]
        : [...open, null],
    unassigned = members(c, null).length,
    weak = new Set(weakFirers(c, stage).map((x) => x.p.id));
  if (!all.length)
    return empty(
      unassigned ? "Assign details first" : "Add participants first",
      '<p><button data-action="participants">Participants</button></p>',
    );
  return (
    `<p class="note queue-note">${queueNote}</p>` +
    (unassigned
      ? `<p class="note">${unassigned} ${unassigned === 1 ? "participant needs" : "participants need"} a detail. <button class="inline-link" data-action="participants">Assign details</button></p>`
      : "") +
    shown
      .map((d) => {
        if (!d) return toggle;
        const people = members(c, d.id),
          draft = getDraft(c, d.id, stage),
          attempt = nextAttempt(c, people, stage),
          e = entry.get(d.id);
        return `<section class="panel score-panel ${[d.temporary && "temporary", e?.n === 0 && !e.skipped && "next", e?.skipped && "skipped"].filter(Boolean).join(" ")}" data-detail="${d.id}"><div class="detail-head">${e ? `<span class="seat">${e.n + 1}</span>` : ""}<h3>${esc(d.name)}</h3>${e?.n === 0 && !e.skipped ? '<span class="badge blue">Next</span>' : ""}${badge(`Attempt ${attempt}`)}${borrowedNote(c, d, stage)}<span class="count">${people.length} firers</span><div class="actions">${e && order.length > 1 ? skipButton(`detail:${d.id}`, d.name, e.skipped, hasInput(draft)) : ""}<button data-detail-history="${d.id}" aria-label="History for ${esc(d.name)}">History</button><button class="icon-button" data-reset="${d.id}" title="Clear entries" aria-label="Clear entries for ${esc(d.name)}">↺</button></div></div><div class="table-wrap"><table><thead><tr><th>Full name</th><th>Rifle</th><th>Hits</th><th>Results</th><th></th></tr></thead><tbody>${people
          .map((p) => {
            const row = draft.rows.find((r) => r.participantId === p.id),
              mine = nextAttempt(c, p, stage);
            return `<tr data-row="${p.id}" class="${[waiting.has(p.id) && "awaiting", search && filtered(p) && "match"].filter(Boolean).join(" ")}"><td class="name">${esc(p.name)}${weak.has(p.id) ? ` ${badge("Weak")}` : ""}${mine !== attempt || waiting.has(p.id) ? `<div class="attempt ${waiting.has(p.id) ? "on" : ""}">Attempt ${mine}${waiting.has(p.id) ? " · redetailed" : ""}</div>` : ""}</td><td class="rifle">${esc(rosterWeapon(c, d.id, p))}</td><td><div class="score-input"><input type="number" min="0" max="${cmax}" step="1" inputmode="numeric" enterkeyhint="next" data-cs-hits="${p.id}" value="${esc(row?.hits || "")}" aria-label="${esc(p.name)} hits" placeholder="—" ${e?.skipped ? "disabled" : ""}><span class="muted">/${cmax}</span></div></td><td class="num results">${resultsCell(c, p, stage)}</td><td class="more-cell"><button class="more" data-person="${p.id}" aria-label="Options for ${esc(p.name)}">⋯</button></td></tr>`;
          })
          .join(
            "",
          )}</tbody></table></div>${shared ? `<div class="aggregate"><label>Detail total <input type="number" min="0" max="${people.length * cmax}" step="1" data-aggregate="${d.id}" value="${esc(draft.aggregate)}" aria-label="${esc(d.name)} total hits" placeholder="—" ${e?.skipped ? "disabled" : ""}></label><span class="muted">/${people.length * cmax} · fills in from the hits</span></div>` : ""}<div class="errors draft-errors">${esc(draftErrors(c, draft).join("\n"))}</div><div class="score-footer"><span class="draft-summary">${esc(e?.skipped ? "Skipped: it has not fired. Unskip to enter scores." : draftSummary(c, draft))}</span><button class="primary" data-confirm="${d.id}" aria-label="Confirm scores for ${esc(d.name)}" ${e?.skipped ? "disabled" : ""}>Confirm scores</button></div></section>`;
      })
      .join("") +
    (!shown.length
      ? `<div class="empty"><h2>All details scored</h2><p>Redetail firers to enter more ${esc(label)} scores.</p></div>`
      : "")
  );
}
function methodInfo(c) {
  return `Only firers below their threshold are listed; each row says why. ${
    {
      smart:
        "Smart: anyone at risk of failing first, then quick wins (a point or two short), then the rest by how close they are to Marksman. That is where a reshoot most likely changes a result.",
      highest: "Highest best score first.",
      first: "Chronological order: whoever shot longest ago goes again first.",
    }[c.settings.order] ?? "Lowest best score first."
  } ▲ High priority firers go first and ▼ low priority firers go last.`;
}
function queuePanel(c, stage, q) {
  const cs = isCS(c),
    started = c.attempts.some((a) => a.stage === stage && a.status === "valid"),
    cap = !cs && DETAIL_RULES[c.program]?.max,
    count = q
      .filter((e) => selected.has(e.key))
      .reduce((n, e) => n + e.members.length, 0);
  // Nothing to redetail yet: keep it to one line, so phones see the queue first.
  if (!started)
    return `<section class="panel queue"><div class="queue-head"><div class="queue-title"><h3>Redetailing</h3></div><p class="note">Opens once the first ${esc(stageLabel(c, stage))} scores are in.</p></div></section>`;
  return `<section class="panel queue"><div class="queue-head"><div class="queue-title"><h3>Redetailing</h3>${!started ? "" : `<span class="count">${q.reduce((n, e) => n + e.members.length, 0)} firers</span>`}</div><div class="queue-method"><select id="order" aria-label="Redetailing order">${[
    ["smart", "Smart: at risk of failing, then closest to Marksman"],
    ["lowest", "Lowest score first"],
    ["highest", "Highest score first"],
    ["first", "Chronological order"],
  ]
    .map(
      ([key, label]) =>
        `<option value="${key}" ${c.settings.order === key ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select>${info(methodInfo(c))}</div><div class="queue-actions"><button data-action="select-all" ${!started ? "disabled" : ""}>${cap ? `Select next ${cap}` : "Select all"}</button><button class="primary" id="redetail" data-action="redetail" ${count && started ? "" : "disabled"}>Redetail${count ? ` (${count})` : ""}</button></div></div>${!started ? `<div class="panel-body note">No ${esc(stageLabel(c, stage))} scores yet.</div>` : ""}<div class="queue-list" ${!started ? "hidden" : ""}>${
    q
      .map((e, i) => {
        const name = e.detail ? e.detail.name : e.members[0].name,
          max = e.priority.p.profile.components.find((x) => x.id === stage).max;
        return `<div class="queue-row ${search && e.members.some(filtered) ? "match" : ""}" data-key="${esc(e.key)}"><input type="checkbox" data-queue="${esc(e.key)}" ${selected.has(e.key) ? "checked" : ""} ${e.errors.length ? "disabled" : ""} aria-label="Select ${esc(name)}"><span class="count">${i + 1}</span><div><strong>${esc(name)}</strong>${e.detail ? borrowedNote(c, e.detail, stage) : ""}${e.above ? badge("Above threshold") : ""}<p class="note">${e.errors.length ? "Fix this detail in Participants" : `Attempt ${e.attempt} · ${e.reason}`}</p></div><button type="button" class="prio ${e.tag || ""}" data-priority="${esc(e.key)}" aria-label="${esc(name)} priority: ${e.tag || "normal"}" title="${e.tag === "high" ? "High priority" : e.tag === "low" ? "Low priority" : "Set priority"}">${e.tag === "high" ? "▲" : e.tag === "low" ? "▼" : "↕"}</button></div>`;
      })
      .join("") || '<div class="panel-body note">No firers to redetail.</div>'
  }</div>${detailedStage(c, stage) ? weakPanel(c, stage) : ""}${reachedPanel(c, stage, q)}</section>`;
}
// What the operator should know before choosing who fires next.
function summaryPanel(c, stage = null) {
  const notes = insights(c, stage),
    id = `${c.id}:${stage ?? "final"}`;
  if (!notes.length) return "";
  const count = notes
    .filter((x) => x.level !== "info")
    .reduce((n, x) => n + x.items.length, 0);
  return `<details class="panel summary" data-summary="${esc(id)}" ${closedSummaries.has(id) ? "" : "open"}><summary><h3>Summary</h3><span class="count">${count ? `${count} ${count === 1 ? "warning" : "warnings"}` : "No warnings"}</span></summary>${notes
    .map(
      (n) =>
        `<div class="insight insight-${n.level}"><strong>${esc(n.title)}</strong><ul>${n.items
          .slice(0, 8)
          .map((x) => `<li>${esc(x)}</li>`)
          .join(
            "",
          )}${n.items.length > 8 ? `<li class="muted">and ${n.items.length - 8} more</li>` : ""}</ul></div>`,
    )
    .join("")}</details>`;
}
// Weak firers pull a detail's average down. Each gets a button to build a
// manual detail around them with strong shooters.
function weakPanel(c, stage) {
  const list = weakFirers(c, stage);
  if (!list.length) return "";
  const max = stages(c).find((x) => x.id === stage).max;
  return `<details class="reached weak-list" open><summary>${list.length} weak ${list.length === 1 ? "firer" : "firers"}: under what a pass needs, on their own hits</summary>${list
    .map(({ p, hits, pace }) => {
      const d = c.details.find((x) => x.id === p.detailId);
      return `<div class="reached-row ${search && filtered(p) ? "match" : ""}"><span class="count">!</span><div><strong>${esc(p.name)}</strong><p class="note">${hits}/${max} (a pass needs about ${pace} here)${d ? ` · ${esc(d.name)}` : ""}</p></div><button type="button" data-build="${p.id}" aria-label="Build a detail around ${esc(p.name)}">Build detail</button></div>`;
    })
    .join("")}</details>`;
}
// Firers who already met the stage threshold, with a way to send them again.
function reachedPanel(c, stage, q) {
  const listed = new Set(q.map((e) => e.key)),
    done = entities(c, stage).filter(
      (e) =>
        !listed.has(e.key) &&
        e.members.some((p) => best(c, p, stage) !== null) &&
        !c.dispatches.some(
          (d) => d.key === e.key && d.stage === stage && d.status === "awaiting",
        ),
    );
  if (!done.length) return "";
  const score = (e) => Math.max(...e.members.map((p) => best(c, p, stage) ?? 0)),
    found = (e) => search && e.members.some(filtered);
  return `<details class="reached"${showReached || done.some(found) ? " open" : ""}><summary>${done.length} at or above the threshold</summary>${done
    .toSorted((a, b) => score(a) - score(b))
    .map((e) => {
      const name = e.detail ? e.detail.name : e.members[0].name,
        max = e.members[0].profile.components.find((x) => x.id === stage).max,
        maxed = (p) => best(c, p, stage) === max,
        marksman = (p) => result(c, p).status === "Marksman",
        finished = e.members.every((p) => maxed(p) || marksman(p)),
        why = e.members.every(maxed)
          ? `max score in ${stageLabel(c, stage)}`
          : e.members.every(marksman)
            ? e.detail
              ? "all marksman"
              : "already marksman"
            : finished
              ? `max score in ${stageLabel(c, stage)} or marksman`
              : "",
        locked = finished && !isCS(c);
      return `<div class="reached-row ${found(e) ? "match" : ""}"><span class="count">✓</span><div><strong>${esc(name)}</strong><p class="note">Best ${ratio(score(e), max)}${why ? ` · ${why}` : ""}</p></div><button type="button" data-requeue="${esc(e.key)}" aria-label="Redetail ${esc(name)}" ${locked ? "disabled" : ""}>Redetail</button></div>`;
    })
    .join("")}</details>`;
}
function updateRedetailButton(stage) {
  const c = s(),
    count = queue(c, stage)
      .filter((e) => selected.has(e.key))
      .reduce((n, e) => n + e.members.length, 0);
  $("#redetail").disabled = !count;
  $("#redetail").textContent = `Redetail${count ? ` (${count})` : ""}`;
}
// Individual stages hold what is typed until the scores are confirmed.
function holdHit(input, stage) {
  const c = s();
  c.entries ??= {};
  if (input.value === "") delete c.entries[`${stage}:${input.dataset.hits}`];
  else c.entries[`${stage}:${input.dataset.hits}`] = input.value;
  save();
  const panel = input.closest(".score-panel"),
    total = panel.querySelectorAll("[data-hits]").length,
    entered = [...panel.querySelectorAll("[data-hits]")].filter(
      (x) => x.value !== "",
    ).length;
  panel.querySelector(".draft-summary").textContent =
    `${entered} of ${total} entered.`;
}
function confirmScores(stage) {
  const c = s(),
    panel = $(".score-panel"),
    errors = [],
    saved = [];
  const pending = Object.entries(c.entries ?? {})
    .filter(([key]) => key.startsWith(`${stage}:`))
    .map(([key, hits]) => ({
      p: c.participants.find((x) => x.id === key.slice(stage.length + 1)),
      hits,
    }))
    .filter((x) => x.p);
  if (!pending.length) {
    panel.querySelector(".draft-errors").textContent =
      "Enter at least one score.";
    return;
  }
  const skipped = new Set(
    firingQueue(c, stage)
      .filter((e) => e.skipped)
      .map((e) => e.members[0].id),
  );
  for (const { p, hits } of pending) {
    const max = p.profile.components.find((x) => x.id === stage).max,
      parsed = parseHits(hits, max);
    if (skipped.has(p.id))
      errors.push(`${p.name} is skipped and has not fired. Unskip them first.`);
    else if (parsed.error) errors.push(`${p.name}: ${parsed.error}`);
  }
  if (errors.length) {
    panel.querySelector(".draft-errors").textContent = errors.join("\n");
    return;
  }
  for (const { p, hits } of pending) {
    saved.push(
      recordIndividual(
        c,
        p,
        stage,
        hits,
        isCS(c) ? stageRifle(c, p, stage) : p.weapon,
      ),
    );
    delete c.entries[`${stage}:${p.id}`];
  }
  save();
  render();
  toast(
    `${saved.length} ${saved.length === 1 ? "score" : "scores"} saved.`,
    () => saved.forEach((a) => undoAttempt(c, a.id)),
  );
}
function confirmDetail(detailId, stage, totalOnly = false) {
  const c = s(),
    draft = getDraft(c, detailId, stage),
    panel = $(`[data-detail="${detailId}"]`);
  if (
    !totalOnly &&
    draft.aggregate !== "" &&
    draft.rows.every((r) => r.hits === "")
  ) {
    const name = c.details.find((d) => d.id === detailId).name;
    dialog(
      "Only the detail total",
      `<p>${esc(name)} has a total but no hits for each firer.</p><p class="note">Without individual hits, poor-shooter warnings are off for this detail, and you cannot see who pulled the average down. Enter each firer's hits and the total fills itself in.</p>`,
      "Confirm total only",
      () => {
        $("#dialog").close();
        confirmDetail(detailId, stage, true);
      },
      "Enter hits",
      () => {
        $("#dialog").close();
        panel.querySelector("[data-cs-hits]")?.focus();
      },
    );
    return;
  }
  try {
    const a = saveDetail(c, draft),
      name = c.details.find((d) => d.id === detailId).name;
    save();
    render();
    toast(`${name}: ${stageLabel(c, stage)} confirmed.`, () =>
      undoAttempt(c, c.attempts.find((x) => x.detailAttemptId === a.id).id),
    );
  } catch (e) {
    panel.querySelector(".draft-errors").textContent = e.message;
    save();
  }
}
function refreshDraft(panel, c, draft) {
  panel.querySelector(".draft-errors").textContent = draftErrors(
    c,
    draft,
  ).join("\n");
  panel.querySelector(".draft-summary").textContent = draftSummary(c, draft);
  save();
}
function redetail(stage) {
  const c = s(),
    chosen = queue(c, stage).filter((e) => selected.has(e.key));
  if (busy || !chosen.length) return;
  const keys = chosen.map((e) => e.key),
    total = c.participants.length,
    shot = total - notYetShot(c, stage).length,
    ahead = firingQueue(c, stage).reduce((n, e) => n + e.members.length, 0);
  // Redetailing starts while others are still shooting; only warn this early.
  if (shot * 2 >= total) return runRedetail(stage, keys);
  dialog(
    "Most firers have not shot yet",
    `<p>Only ${shot} of ${total} firers have a ${esc(stageLabel(c, stage))} score.</p><p class="note">Redetailed firers join the back of the queue${ahead ? `, behind the ${ahead} ${ahead === 1 ? "firer" : "firers"} already waiting` : ""}.</p>`,
    "Redetail",
    () => {
      $("#dialog").close();
      runRedetail(stage, keys);
    },
    "Go back",
  );
}
async function runRedetail(stage, keys) {
  const c = s();
  try {
    dispatch(c, stage, keys);
  } catch (e) {
    toast(e.message);
    return;
  }
  const ids = new Set(
      c.dispatches
        .filter((d) => d.status === "awaiting" && keys.includes(d.key))
        .flatMap((d) => d.roster.map((m) => m.id)),
    ),
    list = $(".queue-list");
  selected.clear();
  save();
  busy = true;
  if (list && !reduceMotion()) await shuffle(list, keys);
  busy = false;
  render();
  document.querySelectorAll("tr[data-row]").forEach((tr) => {
    if (ids.has(tr.dataset.row)) tr.classList.add("flash");
  });
  const seats = firingQueue(c, stage)
      .map((e, i) => (keys.includes(e.key) ? i + 1 : 0))
      .filter(Boolean),
    at =
      seats.length > 1 ? `${seats[0]}–${seats.at(-1)}` : String(seats[0] ?? "");
  toast(
    `${ids.size} ${ids.size === 1 ? "firer" : "firers"} redetailed, ${seats.length > 1 ? "places" : "place"} ${at} in the queue.`,
  );
}
// Brief shuffle of the list, ending in the order it should be.
async function shuffle(list, keys = []) {
  const rows = [...list.querySelectorAll(".queue-row")],
    leaving = rows.filter((r) => keys.includes(r.dataset.key)),
    staying = rows.filter((r) => !keys.includes(r.dataset.key)),
    order = [...staying],
    pause = (ms) => new Promise((done) => setTimeout(done, ms)),
    flip = (rearrange) => {
      const top = new Map(staying.map((r) => [r, r.getBoundingClientRect().top]));
      rearrange();
      for (const r of staying) {
        const dy = top.get(r) - r.getBoundingClientRect().top;
        if (dy)
          r.animate(
            [
              { transform: `translateY(${dy}px) scale(1.04)`, offset: 0 },
              { transform: `translateY(${dy * 0.25}px) scale(1.02)`, offset: 0.5 },
              { transform: "none" },
            ],
            { duration: 150, easing: "cubic-bezier(.3,1.4,.4,1)" },
          );
      }
    };
  list.classList.add("shuffling");
  if (leaving.length) {
    leaving.forEach((r) => r.classList.add("leaving"));
    await pause(220);
    leaving.forEach((r) => r.remove());
  }
  for (let round = 0; round < 3; round++) {
    flip(() => staying.sort(() => Math.random() - 0.5).forEach((r) => list.append(r)));
    await pause(140);
  }
  flip(() => order.forEach((r) => list.append(r)));
  await pause(180);
  list.classList.remove("shuffling");
}
// Rows slide from where they were to where they belong.
function animateQueue(change) {
  const list = $(".queue-list");
  if (!list || reduceMotion()) {
    change();
    render();
    return;
  }
  const before = new Map(
    [...list.querySelectorAll(".queue-row")].map((r) => [
      r.dataset.key,
      r.getBoundingClientRect().top,
    ]),
  );
  change();
  render();
  for (const row of document.querySelectorAll(".queue-row")) {
    const from = before.get(row.dataset.key);
    if (from === undefined) continue;
    const dy = from - row.getBoundingClientRect().top;
    if (dy)
      row.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: "none" }],
        { duration: 280, easing: "cubic-bezier(.2,.9,.2,1)" },
      );
  }
}
async function reshuffle() {
  const list = $(".queue-list");
  if (busy || !list || list.children.length < 2 || reduceMotion()) return;
  busy = true;
  await shuffle(list);
  busy = false;
}
function renderFinal() {
  const c = s(),
    cs = stages(c),
    rr = c.participants.map((p) => result(c, p));
  const table = (people) =>
    `<div class="table-wrap"><table><thead><tr><th>Full name</th><th>Result</th>${cs.map((x) => `<th>${esc(x.label)}</th>`).join("")}<th>Total</th><th></th></tr></thead><tbody>${people
      .map((p) => {
        const r = result(c, p);
        return `<tr><td class="name">${esc(p.name)}</td><td>${badge(r.status)}</td>${p.profile.components.map((x, i) => `<td class="num">${ratio(r.scores[i], x.max)}</td>`).join("")}<td class="num"><b>${ratio(r.total, p.profile.total)}</b></td><td class="more-cell"><button class="more" data-person="${p.id}" aria-label="Options for ${esc(p.name)}">⋯</button></td></tr>`;
      })
      .join("")}</tbody></table></div>`;
  $("#main").innerHTML =
    shootHead(
      '<span class="spacer"></span><button data-action="csv">Export scores</button>',
    ) +
    summaryPanel(c) +
    `<div class="summary-line">${["Marksman", "Pass", "Fail", "Incomplete"].map((label) => `<span><strong>${rr.filter((r) => r.status === label).length}</strong> ${label}</span>`).join("")}</div>` +
    (!c.participants.length
      ? empty("No scores yet")
      : isCS(c)
        ? c.details
            .filter((d) => members(c, d.id).length)
            .map(
              (d) =>
                `<section class="panel"><div class="detail-head"><h3>${esc(d.name)}</h3></div>${table(members(c, d.id))}</section>`,
            )
            .join("")
        : `<section class="panel">${table(c.participants)}</section>`);
}
function renderSettings() {
  $("#main").innerHTML =
    `<div class="settings"><div class="heading"><h2>Settings</h2></div>${Object.entries(
      PROGRAMS,
    )
      .map(([program, label]) => {
        const open = openPresets.has(program);
        return `<section class="preset ${open ? "open" : ""}"><div class="preset-head"><button class="expand" data-expand="${program}" aria-expanded="${open}">${label}</button></div><div class="preset-body">${presetBody(program)}</div></section>`;
      })
      .join(
        "",
      )}</div>`;
}
function thresholdInfo() {
  return "Redetailing lists a firer for a stage until their best score reaches its threshold, they reach Marksman, or they max the stage. These are the starting thresholds. Once any other stage is scored, a firer's threshold becomes their share of what they still need. Stage B of ATP and Combat Shoot stays at 7/8.";
}
// A shoot type's settings: the rifle new participants start on, then one
// collapsible threshold section per rifle, since each has its own standard.
function presetBody(program) {
  const variant = program === "APS" ? apsView : "standard",
    key = `${program}|${variant}`,
    label = typeLabel(program, variant),
    pr = preset(store, program, variant),
    list = weaponsFor(program, variant),
    rule = DETAIL_RULES[program],
    shoot = {
      program,
      variant,
      attempts: [],
      settings: {
        weapon: pr.weapon,
        objective: pr.objective,
        targets: pr.targets,
      },
    };
  const rifle = (weapon) => {
    const profile = profileFor(program, variant, weapon),
      p = { weapon, profile },
      open = openPresets.has(`${key}|${weapon}`),
      custom = targetStages(shoot).some(
        (c) => pr.targets[`${weapon}:${c.id}:${pr.objective}`] !== undefined,
      );
    return `<section class="rifle-set ${open ? "open" : ""}"><button class="expand" data-expand="${esc(`${key}|${weapon}`)}" aria-expanded="${open}">${esc(weapon)} <span class="muted">Pass ${ratio(profile.pass, profile.total)} · Marksman ${ratio(profile.marksman, profile.total)}</span></button>${
      open
        ? `<div class="rifle-body"><div class="threshold-head"><span class="muted">Starting thresholds</span>${info(thresholdInfo())}<button type="button" class="reset" data-reset-thresholds="${esc(`${key}|${weapon}`)}" ${custom ? "" : "disabled"}>Reset</button></div>${targetStages(
            shoot,
          )
            .map((c) => {
              const max = profile.components.find((x) => x.id === c.id).max,
                id = `target-${program}-${weapon}-${c.id}`.replace(/\W+/g, "-");
              return `<div class="target-row"><label for="${id}">${esc(c.label)}</label><input id="${id}" data-threshold="${esc(`${key}|${weapon}|${c.id}`)}" type="number" min="0" max="${max}" step="1" inputmode="numeric" value="${target(shoot, p, c.id)}" aria-label="${esc(`${label} ${weapon} ${c.label}`)} threshold"><span class="muted">/${max}</span></div>`;
            })
            .join("")}</div>`
        : ""
    }</section>`;
  };
  return `${program === "APS" ? `<div class="seg" style="margin-bottom:14px"><button data-aps="standard" class="${apsView === "standard" ? "on" : ""}">APS</button><button data-aps="ns" class="${apsView === "ns" ? "on" : ""}">APS (NS)</button></div>` : ""}<div class="field inline rifle-type"><span>New participants start on</span>${list.length > 1 ? `<select data-default-weapon="${key}" aria-label="${esc(label)} default rifle">${option(list, pr.weapon)}</select>` : `<strong>${esc(pr.weapon)}</strong>`}</div>${rule ? `<p class="limit">${rule.min ? `${rule.min}–${rule.max} firers per detail. Up to ${rule.nonSAR} non-SAR21 weapons per detail. Stages A and C: detail hits ÷ firers, rounded down.` : `Up to ${rule.max} firers at a time.`}</p>` : ""}<p class="muted rifle-sets-head">Thresholds by rifle</p>${list.map(rifle).join("")}`;
}
function dialog(title, body, label, submit, closeLabel = "Close", onClose) {
  const d = $("#dialog"),
    buttons = Array.isArray(label) ? label : label ? [{ label }] : [];
  d.innerHTML = `<form id="dialog-form"><h2 id="dialog-title">${esc(title)}</h2>${body}<div class="error" role="alert"></div><div class="dialog-actions"><button type="button" id="close-dialog">${esc(closeLabel)}</button>${buttons.map((b, i) => `<button type="submit" ${b.value ? `value="${esc(b.value)}"` : ""} class="${i === buttons.length - 1 ? "primary" : ""}">${esc(b.label)}</button>`).join("")}</div></form>`;
  if (!d.open) d.showModal();
  $("#close-dialog").onclick = () => (onClose ? onClose() : d.close());
  $("#dialog-form").onsubmit = (ev) => {
    ev.preventDefault();
    try {
      submit?.(new FormData(ev.target), ev.submitter?.value);
    } catch (e) {
      d.querySelector(".error").textContent = e.message;
    }
  };
}
// Everyone needs a detail after switching to a detailed shoot type. Auto-detail
// splits the list in order; or type a detail number after each name.
function detailPicker(c) {
  const rule = DETAIL_RULES[c.program],
    sizes = detailPlan(c.participants.length, rule);
  dialog(
    "Put participants into details",
    `<p class="note">${esc(typeLabel(c.program, c.variant))} fires in details of ${rule.min}–${rule.max}. ${c.participants.length} participants need a detail.</p><p class="note">Auto-detail makes ${sizes.length} ${sizes.length === 1 ? "detail" : "details"} of ${sizes.join(", ")}, in list order.</p><label class="field"><span>Or type a detail number after each name</span><textarea name="roster" rows="10" aria-label="Names with detail numbers">${esc(c.participants.map((p) => `${p.name}, `).join("\n"))}</textarea></label>`,
    [
      { label: "Use these numbers", value: "list" },
      { label: "Auto-detail", value: "auto" },
    ],
    (f, action) => {
      if (action === "auto") {
        const made = autoDetail(c);
        save();
        $("#dialog").close();
        render();
        toast(
          `${made.length} ${made.length === 1 ? "detail" : "details"} of ${made.join(", ")}.`,
        );
        return;
      }
      const byName = new Map(
          c.participants.map((p) => [p.name.trim().toLowerCase(), p]),
        ),
        rows = parseRoster(f.get("roster"), true),
        unknown = rows.filter((r) => !byName.has(r.name.toLowerCase()));
      if (unknown.length)
        throw Error(`Not on the list: ${unknown.map((r) => r.name).join(", ")}.`);
      const numbered = rows.filter((r) => r.detail !== null);
      if (!numbered.length)
        throw Error("Type a detail number after a name, e.g. “Alex Tan, 2”.");
      for (const r of numbered)
        assignDetail(c, byName.get(r.name.toLowerCase()).id, r.detail);
      save();
      $("#dialog").close();
      render();
      const left = members(c, null).length;
      toast(
        left
          ? `${numbered.length} placed. ${left} still ${left === 1 ? "needs" : "need"} a detail.`
          : "Everyone has a detail.",
      );
    },
    "Later",
  );
}
function manualDetailDialog(stage, around = null) {
  const c = s(),
    label = stageLabel(c, stage),
    plan = around ? buildAround(c, stage, around) : null,
    picked = new Set(plan?.entries.map((e) => e.participantId) ?? []),
    groups = [
      ...stageDetails(c, stage)
        .filter((d) => !d.temporary)
        .map((d) => [d.name, members(c, d.id)]),
      ...(members(c, null).length ? [["Needs a detail", members(c, null)]] : []),
    ];
  const max = stages(c).find((x) => x.id === stage).max,
    why = (p) =>
      best(c, p, stage) === max
        ? "max score"
        : result(c, p).status === "Marksman"
          ? "marksman"
          : "";
  // Firers with nothing to gain can fire to help a detail's average, but only
  // alongside someone who can still improve.
  const hits = (p) => firerHits(c, p, stage),
    row = (p) =>
      `<div class="manual-row ${picked.has(p.id) ? "on" : ""}"><label class="manual-pick"><input type="checkbox" name="pick" value="${p.id}" aria-label="Include ${esc(p.name)}" ${picked.has(p.id) ? "checked" : ""}><span>${esc(p.name)}${p.id === around ? ` ${badge("Weak")}` : why(p) ? ` ${badge(why(p))}` : ""}${hits(p) !== null ? ` <span class="muted">${hits(p)}/${max}</span>` : ""}</span></label><span class="rifle">${esc(p.weapon)}</span></div>`,
    weakName = around && c.participants.find((p) => p.id === around).name;
  dialog(
    around ? `Detail around ${weakName} · ${label}` : `Manual detail · ${label}`,
    `${around ? `<p class="note">One weak firer with the strongest shooters available: those who still need ${esc(label)} first, since the reshoot helps them too, then firers who have cleared it.${plan.short ? " There are not enough strong shooters for a full detail, so the next best fill it." : ""} Change anyone before creating it.</p>` : ""}<p class="note">Choose who fires together. The detail appears in ${esc(label)} so you can enter its scores. A one-off is dropped once its scores are in; a kept detail can be redetailed.</p><div class="manual-list">${groups.map(([name, people]) => `<div class="manual-group"><h3>${esc(name)}</h3>${people.map(row).join("")}</div>`).join("")}</div><p class="note manual-summary">No firers chosen.</p>${around ? `<div class="rest-plan" hidden><label class="chk"><input type="checkbox" name="rest" checked> <span class="rest-title"></span></label><p class="note rest-text"></p></div>` : ""}`,
    [
      { label: "One-off detail", value: "once" },
      { label: "Keep as a detail", value: "keep" },
    ],
    (f, action) => {
      const entries = f.getAll("pick").map((id) => ({
          participantId: id,
          weapon: c.participants.find((p) => p.id === id).weapon,
        })),
        oneOff = action === "once",
        d = createTempDetail(c, stage, entries, { oneOff }),
        made = [d];
      // The rest of the weak firer's detail, if the operator kept it ticked.
      const rest =
        around && f.get("rest")
          ? planRest(c, stage, around, f.getAll("pick"))
          : null;
      if (rest && !rest.short)
        made.push(createTempDetail(c, stage, rest.entries, { oneOff }));
      save();
      $("#dialog").close();
      showScored = false;
      render();
      $(`[data-detail="${d.id}"]`)?.scrollIntoView({ block: "center" });
      toast(
        `${made.map((x) => x.name).join(" and ")} ready. Enter ${made.length > 1 ? "their" : "its"} ${stageLabel(c, stage)} scores.`,
        () => made.forEach((x) => dropTemporaryDetail(c, x.id)),
      );
    },
  );
  const form = $("#dialog-form"),
    update = () => {
      const entries = [];
      for (const box of form.querySelectorAll("[name=pick]")) {
        const line = box.closest(".manual-row");
        line.classList.toggle("on", box.checked);
        if (box.checked)
          entries.push({
            participantId: box.value,
            weapon: c.participants.find((p) => p.id === box.value).weapon,
          });
      }
      const problems = compositionErrors(
        c,
        entries.map((e) => ({ weapon: e.weapon })),
      );
      if (
        entries.length &&
        entries.every((e) =>
          nothingToGain(
            c,
            c.participants.find((p) => p.id === e.participantId),
            stage,
          ),
        )
      )
        problems.push(
          "Everyone chosen already has the max score for this stage or is marksman. Include at least one firer who can still improve.",
        );
      // What the average should come to, from each firer's best hits.
      const known = entries.map((e) =>
          hits(c.participants.find((p) => p.id === e.participantId)),
        ),
        expected =
          entries.length && known.every((v) => v !== null)
            ? Math.floor(known.reduce((a, b) => a + b, 0) / known.length)
            : null;
      form.querySelector(".manual-summary").textContent = entries.length
        ? `${entries.length} firers chosen.${expected !== null ? ` Expected average from their best hits: ${expected}/${max}.` : ""}`
        : "No firers chosen.";
      // Who is left of the weak firer's detail, and the detail they get.
      const box = form.querySelector(".rest-plan");
      if (box) {
        const rest = planRest(
          c,
          stage,
          around,
          entries.map((e) => e.participantId),
        );
        box.hidden = !rest;
        if (rest) {
          const names = (list) => list.map((p) => p.name).join(", "),
            own = rest.people.filter((p) => !rest.fillIns.includes(p));
          form.querySelector(".rest-title").textContent =
            `Also make a detail for the rest of ${rest.from.name}`;
          form.querySelector(".rest-text").textContent = rest.short
            ? `${names(own)} still need ${label}, but there are not enough good shooters to make a detail with them. Make one by hand.`
            : `${names(own)} fire without ${weakName}.${rest.fillIns.length ? ` ${names(rest.fillIns)} ${rest.fillIns.length === 1 ? "joins" : "join"} to make ${rest.people.length}.` : ""}${rest.expected !== null ? ` Expected average: ${rest.expected}/${max}.` : ""}`;
          box.querySelector("[name=rest]").disabled = rest.short;
        }
      }
      form.querySelector(".error").textContent = entries.length
        ? problems.join("\n")
        : "";
    };
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  if (around) update();
}
// The ⋯ menu on a stage tab: history, and sighting where the shoot has one.
function personDialog(id) {
  const c = s(),
    p = c.participants.find((x) => x.id === id),
    stage = tab.startsWith("stage:") ? tab.split(":")[1] : null;
  dialog(
    p.name,
    `<p class="note">${esc(p.weapon)}${isCS(c) ? "" : ` · ${esc(stages(c).map((x) => `${x.label} ${ratio(best(c, p, x.id), x.max)}`).join(" · "))}`}</p><div class="actions"><button type="button" id="history">History</button>${p.profile.excluded?.length ? '<button type="button" id="sighting">Sighting</button>' : ""}</div>`,
    null,
    null,
    "Close",
  );
  $("#history").onclick = () => historyDialog(p);
  if ($("#sighting")) $("#sighting").onclick = () => sightingDialog(p);
}
function sightingDialog(p) {
  const c = s();
  dialog(
    `${p.name} · Sighting`,
    `<label class="field"><span>Practice</span><select name="practice">${p.profile.excluded.map((x, i) => `<option value="${i}">${esc(x.label)} /${x.max}</option>`).join("")}</select></label><label class="field"><span>Hits</span><input name="hits" type="number" min="0" step="1" required></label>`,
    "Save",
    (f) => {
      const x = p.profile.excluded[Number(f.get("practice"))],
        parsed = parseHits(f.get("hits"), x.max);
      if (parsed.error) throw Error(parsed.error);
      c.sightings ??= [];
      c.sightings.push({
        id: uid(),
        participantId: p.id,
        recordId: p.recordId,
        weapon: p.weapon,
        profile: structuredClone(p.profile),
        practice: x.label,
        hits: parsed.value,
        at: now(),
        recorder: "Local device",
      });
      audit(c, "Sighting recorded", { participantId: p.id });
      save();
      $("#dialog").close();
      render();
    },
  );
}
function attemptRows(c, p) {
  const numbers = attemptNumbers(c, p);
  return c.attempts
    .filter((a) => a.participantId === p.id)
    .map((a) => {
      const shared = c.shared.find((d) => d.id === a.detailAttemptId),
        detail = c.details.find((d) => d.id === shared?.detailId);
      return { attempt: a, number: numbers.get(a.id), shared, detail };
    })
    .toReversed();
}
function historyDialog(p) {
  const c = s(),
    rows = attemptRows(c, p),
    pendingList = c.dispatches.filter(
      (d) => d.status === "awaiting" && d.roster.some((m) => m.id === p.id),
    );
  dialog(
    `${p.name} · History`,
    pendingList
      .map(
        (d) =>
          `<div class="history-row"><div>${esc(stageLabel(c, d.stage))} · attempt ${nextAttempt(c, p, d.stage)} not entered yet</div><button type="button" data-cancel="${d.id}">Cancel</button></div>`,
      )
      .join("") +
      rows
        .map(({ attempt: a, number, shared, detail }) => {
          const max = a.profile.components.find((x) => x.id === a.stage).max,
            source = shared
              ? `${detail ? `${detail.name} · ` : ""}${shared.inputMode === "aggregate" ? `detail total ${shared.aggregateHits}/${shared.divisor} firers` : `hits ${shared.roster.map((m) => m.rawHits ?? "—").join(", ")} · total ${shared.aggregateHits}/${shared.divisor} firers`}`
              : `Individual · ${esc(a.weapon)}`,
            roster = shared
              ? shared.roster
                  .map((m) => `${esc(m.name)} (${esc(m.weapon)})`)
                  .join(", ")
              : "";
          return `<div class="history-row ${a.status === "void" ? "void" : ""}"><div><b>${esc(stageLabel(c, a.stage))} · ${number ? `attempt ${number}` : "not counted"} · ${ratio(a.score, max)}</b> ${a.status === "void" ? badge(a.revisedBy ? "Edited" : "Voided") : ""}<p>${esc(source)}${roster ? `<br>With: ${roster}` : ""}<br>${new Date(a.recordedAt).toLocaleString("en-US")}${a.correction ? `<br>${esc(a.correction.reason)}` : ""}</p></div>${a.status === "valid" ? `<div class="actions"><button type="button" data-edit="${a.id}">Edit</button><button type="button" data-correct="${a.id}">Void</button></div>` : ""}</div>`;
        })
        .join("") +
      (c.sightings || [])
        .filter((a) => a.participantId === p.id)
        .map(
          (a) =>
            `<div class="history-row"><div>${esc(a.practice)} · ${a.hits}<p>Not counted in scores</p></div></div>`,
        )
        .join("") +
      (!rows.length && !pendingList.length
        ? '<p class="note">No scored attempts.</p>'
        : ""),
    null,
  );
  $("#dialog")
    .querySelectorAll("[data-edit]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const a = c.attempts.find((x) => x.id === b.dataset.edit);
          if (a.detailAttemptId)
            editDetailDialog(a.detailAttemptId, () => historyDialog(p));
          else editScoreDialog(p, a);
        }),
    );
  $("#dialog")
    .querySelectorAll("[data-correct]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const a = c.attempts.find((x) => x.id === b.dataset.correct),
            affected = a.detailAttemptId
              ? c.attempts.filter((x) => x.detailAttemptId === a.detailAttemptId)
                  .length
              : 1;
          dialog(
            "Void score",
            `${affected > 1 ? `<p class="note">This detail score affects ${affected} firers.</p>` : ""}<label class="field"><span>Reason</span><input name="reason" required autofocus></label>`,
            "Void score",
            (f) => {
              voidAttempt(c, a.id, f.get("reason"));
              save();
              render();
              historyDialog(p);
            },
            "Back",
            () => historyDialog(p),
          );
        }),
    );
  $("#dialog")
    .querySelectorAll("[data-cancel]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          cancelDispatch(c, b.dataset.cancel);
          save();
          render();
          historyDialog(p);
        }),
    );
}
// Editing an individual score, including the rifle where a stage allows a change.
function editScoreDialog(p, a) {
  const c = s(),
    max = a.profile.components.find((x) => x.id === a.stage).max;
  dialog(
    `Edit ${p.name} · ${stageLabel(c, a.stage)}`,
    `<label class="field"><span>Hits /${max}</span><input name="hits" type="number" min="0" max="${max}" step="1" value="${a.score}" required autofocus></label>${isCS(c) ? `<label class="field"><span>Rifle</span><select name="weapon">${option(weapons(c), a.weapon)}</select></label>` : `<p class="note">${esc(a.weapon)}</p>`}`,
    "Save score",
    (f) => {
      editIndividual(c, a.id, f.get("hits"), f.get("weapon") || a.weapon);
      save();
      render();
      historyDialog(p);
    },
    "Back",
    () => historyDialog(p),
  );
}
// A detail's own history: every score confirmed for it, newest first, each one
// editable or voidable the way an individual's attempts are.
function detailHistoryDialog(detailId, stage) {
  const c = s(),
    d = c.details.find((x) => x.id === detailId),
    list = detailAttempts(c, detailId, stage),
    numbers = detailAttemptNumbers(c, detailId, stage),
    max = stages(c).find((x) => x.id === stage).max,
    back = () => detailHistoryDialog(detailId, stage),
    waitingOn = c.dispatches.filter(
      (x) =>
        x.key === `detail:${detailId}` &&
        x.stage === stage &&
        x.status === "awaiting",
    );
  dialog(
    `${d ? d.name : "Detail"} · ${stageLabel(c, stage)}`,
    waitingOn
      .map(
        (x) =>
          `<div class="history-row"><div>Attempt ${nextAttempt(c, members(c, detailId), stage)} not entered yet</div><button type="button" data-cancel="${x.id}">Cancel</button></div>`,
      )
      .join("") +
      list
        .toReversed()
        .map((a) => {
          const number = numbers.get(a.id);
          const hits = a.roster
            .map((m) => `${m.name} ${m.rawHits ?? "—"}`)
            .join(", ");
          return `<div class="history-row ${a.status === "void" ? "void" : ""}"><div><b>${number ? `Attempt ${number}` : "Not counted"} · ${ratio(a.score, max)}</b> ${a.status === "void" ? badge(a.revisedBy || list.some((x) => x.revisionOf === a.id) ? "Edited" : "Voided") : ""}<p>${esc(a.inputMode === "aggregate" ? `Detail total ${a.aggregateHits} over ${a.divisor} firers` : `${hits} · total ${a.aggregateHits} over ${a.divisor} firers`)}<br>${new Date(a.recordedAt).toLocaleString("en-US")}${a.correction ? `<br>${esc(a.correction.reason)}` : ""}</p></div>${a.status === "valid" ? `<div class="actions"><button type="button" data-edit-detail="${a.id}">Edit</button><button type="button" data-void-detail="${a.id}">Void</button></div>` : ""}</div>`;
        })
        .join("") +
      (!list.length && !waitingOn.length
        ? '<p class="note">No scores confirmed for this detail yet.</p>'
        : ""),
    null,
  );
  const box = $("#dialog");
  box
    .querySelectorAll("[data-edit-detail]")
    .forEach(
      (b) => (b.onclick = () => editDetailDialog(b.dataset.editDetail, back)),
    );
  box.querySelectorAll("[data-void-detail]").forEach(
    (b) =>
      (b.onclick = () => {
        const a = c.attempts.find(
          (x) => x.detailAttemptId === b.dataset.voidDetail,
        );
        dialog(
          "Void detail score",
          `<p class="note">This removes the score from every firer in this record.</p><label class="field"><span>Reason</span><input name="reason" required autofocus></label>`,
          "Void score",
          (f) => {
            voidAttempt(c, a.id, f.get("reason"));
            save();
            render();
            back();
          },
          "Back",
          back,
        );
      }),
  );
  box.querySelectorAll("[data-cancel]").forEach(
    (b) =>
      (b.onclick = () => {
        cancelDispatch(c, b.dataset.cancel);
        save();
        render();
        back();
      }),
  );
}
// Editing a detail's score: each firer's hits, or the detail total. Clearing a
// firer's hits takes them out of the record.
function editDetailDialog(detailAttemptId, back) {
  const c = s(),
    shared = c.shared.find((d) => d.id === detailAttemptId),
    detail = c.details.find((d) => d.id === shared.detailId),
    max = shared.roster[0].profile.components.find((x) => x.id === shared.stage)
      .max;
  dialog(
    `Edit ${detail ? detail.name : "detail"} · ${stageLabel(c, shared.stage)}`,
    `<p class="note">Enter every firer's hits, or only the detail total.</p><div class="manual-list">${shared.roster
      .map(
        (m) =>
          `<div class="manual-row on"><span class="manual-pick">${esc(m.name)}</span><span class="rifle">${esc(m.weapon)}</span><input type="number" name="hits-${m.id}" min="0" max="${max}" step="1" value="${m.rawHits ?? ""}" placeholder="—" aria-label="${esc(m.name)} hits"></div>`,
      )
      .join(
        "",
      )}</div><label class="field inline"><span>Or detail total</span><input type="number" name="aggregate" min="0" step="1" value="${shared.inputMode === "aggregate" ? shared.aggregateHits : ""}" placeholder="—" aria-label="Detail total hits"></label>`,
    "Save scores",
    (f) => {
      const entries = shared.roster.map((m) => ({
        participantId: m.id,
        weapon: m.weapon,
        hits: f.get(`hits-${m.id}`) ?? "",
      }));
      editDetailAttempt(c, detailAttemptId, entries, f.get("aggregate") ?? "");
      save();
      render();
      back();
    },
    "Back",
    back,
  );
}
function download(name, content, type = "application/json") {
  const link = document.createElement("a"),
    url = URL.createObjectURL(new Blob([content], { type }));
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function restore() {
  dialog(
    "Restore backup",
    '<label class="field"><span>Detail IC backup</span><input type="file" name="file" accept=".json,application/json" required></label>',
    "Restore",
    async (f) => {
      try {
        const file = f.get("file");
        if (file.size > 20000000) throw Error("Maximum backup size is 20 MB.");
        const incoming = validateStore(
          migrateStore(JSON.parse(await file.text())),
        );
        for (const shoot of incoming.shoots) {
          const i = store.shoots.findIndex((x) => x.id === shoot.id);
          if (i >= 0) store.shoots[i] = shoot;
          else store.shoots.push(shoot);
        }
        store.presets = { ...incoming.presets, ...store.presets };
        if (incoming.active) store.active = incoming.active;
        applyPresets(store);
        save();
        $("#dialog").close();
        tab = "shoots";
        render();
        toast("Backup restored.");
      } catch (e) {
        $("#dialog .error").textContent = e.message;
      }
    },
  );
}
$("#tabs").onclick = (e) => {
  const b = e.target.closest("[data-tab]");
  if (b) {
    tab = b.dataset.tab;
    search = "";
    addMode = null;
    selected.clear();
    render();
  }
};
$("#main").addEventListener("input", (e) => {
  const c = s(),
    t = e.target;
  if (t.id === "search") {
    search = t.value;
    const pos = t.selectionStart;
    render();
    $("#search").focus();
    $("#search").setSelectionRange(pos, pos);
    return;
  }
  if (t.dataset.hits) {
    holdHit(t, tab.split(":")[1]);
    const skip = t.closest("tr").querySelector("[data-skip]");
    if (skip) skip.disabled = t.value !== "";
    return;
  }
  if (t.matches("[data-cs-hits],[data-aggregate]")) {
    const panel = t.closest("[data-detail]"),
      draft = getDraft(c, panel.dataset.detail, tab.split(":")[1]);
    if (t.dataset.csHits) {
      draft.rows.find((r) => r.participantId === t.dataset.csHits).hits =
        t.value;
      // The total follows the hits until someone types their own.
      if (draft.autoTotal !== false) {
        const all = draft.rows.every((r) => /^\d+$/.test(r.hits));
        draft.aggregate = all
          ? String(draft.rows.reduce((n, r) => n + Number(r.hits), 0))
          : "";
        const box = panel.querySelector("[data-aggregate]");
        if (box) box.value = draft.aggregate;
      }
    } else {
      draft.aggregate = t.value;
      draft.autoTotal = t.value === "" ? undefined : false;
    }
    draft.updatedAt = now();
    refreshDraft(panel, c, draft);
    const skip = panel.querySelector(".detail-head [data-skip]");
    if (skip) skip.disabled = hasInput(draft);
  }
});
$("#main").addEventListener(
  "toggle",
  (e) => {
    const id = e.target.dataset?.summary;
    if (!id) return;
    if (e.target.open) closedSummaries.delete(id);
    else closedSummaries.add(id);
  },
  true,
);
$("#main").addEventListener("keydown", (e) => {
  const t = e.target;
  // Tab goes from score box to score box, past rifles, Skip and menus.
  if (
    e.key === "Tab" &&
    !e.altKey &&
    !e.metaKey &&
    !e.ctrlKey &&
    t.matches("[data-hits],[data-cs-hits],[data-aggregate]")
  ) {
    const boxes = [
        ...$("#main").querySelectorAll(
          ":is([data-hits],[data-cs-hits],[data-aggregate]):not(:disabled)",
        ),
      ],
      next = boxes[boxes.indexOf(t) + (e.shiftKey ? -1 : 1)];
    if (next) {
      e.preventDefault();
      next.focus();
      next.select?.();
    }
    return;
  }
  if (e.key !== "Enter" || !t.matches("[data-hits],[data-cs-hits],[data-aggregate]"))
    return;
  e.preventDefault();
  const inputs = [
      ...t.closest(".score-panel").querySelectorAll('input[type="number"]'),
    ],
    next = inputs[inputs.indexOf(t) + 1],
    selector = next
      ? ["hits", "csHits", "aggregate"]
          .filter((k) => next.dataset[k] !== undefined)
          .map(
            (k) =>
              `[data-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}="${next.dataset[k]}"]`,
          )[0]
      : null;
  t.blur();
  if (selector) $(selector)?.focus();
});
$("#main").addEventListener("change", (e) => {
  const c = s(),
    t = e.target,
    stage = tab.split(":")[1];
  try {
    if (t.id === "shoot-type") {
      const [program, variant] = t.value.split("|");
      changeShootType(c, program, variant);
      applyPreset(store, c);
      save();
      render();
      toast(`Shoot type changed to ${typeLabel(program, variant)}.`);
      if (isCS(c) && c.participants.length && !c.details.length)
        detailPicker(c);
    } else if (t.id === "fill-weapon") {
      c.settings.weapon = t.value;
      save();
    } else if (t.id === "order") {
      c.settings.order = t.value;
      save();
      render();
      reshuffle();
    } else if (t.dataset.queue) {
      t.checked ? selected.add(t.dataset.queue) : selected.delete(t.dataset.queue);
      updateRedetailButton(stage);
    } else if (t.dataset.name || t.dataset.rifle) {
      const id = t.dataset.name || t.dataset.rifle,
        p = c.participants.find((x) => x.id === id);
      updateParticipant(
        c,
        id,
        {
          name: t.dataset.name ? t.value : p.name,
          weapon: t.dataset.rifle ? t.value : p.weapon,
          detailId: p.detailId,
        },
        "Edited in the participant list",
      );
      save();
      later(render);
    } else if (t.dataset.stageRifle) {
      c.stageRifles ??= {};
      c.stageRifles[`${t.dataset.stageRifle}:${stage}`] = t.value;
      save();
    } else if (t.dataset.assign) {
      assignDetail(
        c,
        t.dataset.assign,
        t.value === ""
          ? null
          : t.value === "new"
            ? nextDetailNumber(c)
            : Number(t.value),
      );
      save();
      later(render);
    } else if (t.dataset.hits) holdHit(t, stage);
    else if (t.dataset.threshold) {
      const [program, variant, weapon, id] = t.dataset.threshold.split("|"),
        pr = preset(store, program, variant),
        parsed = parseHits(t.value, Number(t.max));
      if (parsed.error) throw Error(`Threshold: ${parsed.error}`);
      pr.targets[`${weapon}:${id}:${pr.objective}`] = parsed.value;
      applyPresets(store);
      save();
      render();
    } else if (t.dataset.defaultWeapon) {
      const [program, variant] = t.dataset.defaultWeapon.split("|");
      preset(store, program, variant).weapon = t.value;
      save();
      render();
    }
  } catch (err) {
    toast(err.message);
    render();
  }
});
$("#main").addEventListener("submit", (e) => {
  e.preventDefault();
  try {
    if (e.target.id === "new-shoot") {
      const f = new FormData(e.target),
        [program, variant] = f.get("type").split("|");
      createShoot(
        store,
        program,
        variant,
        f.get("name").trim() ||
          `${typeLabel(program, variant)} · ${dateLabel(now())}`,
      );
      tab = "participants";
      search = "";
      selected.clear();
      save();
      render();
      return;
    }
  } catch (err) {
    toast(err.message);
  }
});
$("#main").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const c = s(),
    stage = tab.split(":")[1];
  try {
    if (b.classList.contains("info")) {
      b.classList.toggle("open");
      return;
    }
    if (b.dataset.expand) {
      openPresets.has(b.dataset.expand)
        ? openPresets.delete(b.dataset.expand)
        : openPresets.add(b.dataset.expand);
      render();
      return;
    }
    if (b.dataset.aps) {
      apsView = b.dataset.aps;
      render();
      return;
    }
    if (b.dataset.deleteShoot) {
      const shoot = getShoot(store, b.dataset.deleteShoot);
      dialog(
        `Delete ${shoot.name}?`,
        `<p class="note">This removes its ${shoot.participants.length} participants and every score in it from this device. Export a backup first if you might need them.</p>`,
        "Delete shoot",
        () => {
          deleteShoot(store, shoot.id);
          save();
          $("#dialog").close();
          tab = "shoots";
          render();
          toast(`${shoot.name} deleted.`);
        },
        "Cancel",
      );
      return;
    }
    if (b.dataset.openShoot) {
      store.active = b.dataset.openShoot;
      tab = "participants";
      search = "";
      selected.clear();
      save();
      render();
      return;
    }
    if (b.dataset.priority) {
      const next = { undefined: "high", high: "low", low: null }[
        c.priorities[b.dataset.priority]
      ];
      animateQueue(() => {
        setPriority(c, b.dataset.priority, next);
        save();
      });
      return;
    }
    if (b.dataset.requeue) {
      queueKey(c, b.dataset.requeue, stage);
      showReached = true;
      save();
      render();
      return;
    }
    if (b.dataset.remove) {
      removeParticipant(c, b.dataset.remove);
      save();
      render();
      return;
    }
    if (b.dataset.person) {
      const person = c.participants.find((x) => x.id === b.dataset.person);
      if (tab === "final") historyDialog(person);
      else personDialog(b.dataset.person);
      return;
    }
    if (b.dataset.resetThresholds) {
      const [program, variant, weapon] = b.dataset.resetThresholds.split("|"),
        pr = preset(store, program, variant);
      for (const key of Object.keys(pr.targets))
        if (key.startsWith(`${weapon}:`) && key.endsWith(`:${pr.objective}`))
          delete pr.targets[key];
      applyPresets(store);
      save();
      render();
      toast("Thresholds reset.");
      return;
    }
    if (b.dataset.skip) {
      const key = b.dataset.skip,
        slot = `${stage}:${key}`,
        on = b.getAttribute("aria-pressed") !== "true",
        before = setSkipped(c, stage, key, on),
        e = entities(c, stage).find((x) => x.key === key),
        name = e.detail ? e.detail.name : e.members[0].name;
      save();
      render();
      toast(
        on
          ? `${name} skipped, below everyone waiting.`
          : `${name} is back in the queue.`,
        () => {
          if (before) c.skips[slot] = before;
          else delete c.skips[slot];
        },
      );
      return;
    }
    if (b.dataset.build) {
      manualDetailDialog(stage, b.dataset.build);
      return;
    }
    if (b.dataset.detailHistory) {
      detailHistoryDialog(b.dataset.detailHistory, stage);
      return;
    }
    if (b.dataset.confirm) {
      confirmDetail(b.dataset.confirm, stage);
      return;
    }
    if (b.dataset.confirmAll) {
      confirmScores(b.dataset.confirmAll);
      return;
    }
    if (b.dataset.reset) {
      resetDraft(c, b.dataset.reset, stage);
      save();
      render();
      return;
    }
    switch (b.dataset.action) {
      case "settings":
      case "shoots":
      case "participants":
        tab = b.dataset.action;
        render();
        break;
      case "add":
        addMode = isCS(c) ? "choose" : "list";
        pasteDetail = nextDetailNumber(c);
        render();
        break;
      case "add-by-detail":
        addMode = "detail";
        pasteDetail = nextDetailNumber(c);
        render();
        break;
      case "add-list":
        addMode = "list";
        render();
        break;
      case "add-close":
      case "add-done":
        addMode = null;
        addNote = "";
        render();
        break;
      case "add-next":
      case "add-save": {
        const names = $("#add-names").value,
          weapon = $("#add-weapon")?.value || c.settings.weapon,
          byDetail = b.dataset.action === "add-next",
          people = addParticipants(
            c,
            names,
            weapon,
            byDetail ? ensureDetail(c, pasteDetail).id : null,
          );
        addNote = "";
        if (byDetail) {
          const rule = DETAIL_RULES[c.program],
            size = members(c, ensureDetail(c, pasteDetail).id).length;
          if (rule && (size < rule.min || size > rule.max))
            addNote = `Detail ${pasteDetail} has ${size} ${size === 1 ? "firer" : "firers"}. ${typeLabel(c.program, c.variant)} details take ${rule.min}–${rule.max}. Fix it in the list below when you finish.`;
          pasteDetail += 1;
        } else addMode = null;
        save();
        render();
        if (!addNote)
          toast(
            `${people.length} ${people.length === 1 ? "participant" : "participants"} added.`,
          );
        break;
      }
      case "clear-participants":
        dialog(
          "Clear participants?",
          `<p class="note">This removes all ${c.participants.length} participants and their details from this shoot.</p>`,
          "Clear participants",
          () => {
            const n = clearParticipants(c);
            save();
            $("#dialog").close();
            addMode = null;
            render();
            toast(`${n} participants cleared.`);
          },
          "Cancel",
        );
        break;
      case "auto-detail": {
        const sizes = autoDetail(c);
        save();
        render();
        toast(
          `${sizes.length} ${sizes.length === 1 ? "detail" : "details"} of ${sizes.join(", ")}.`,
        );
        break;
      }
      case "confirm-participants":
        setRosterLock(c, true);
        save();
        tab = `stage:${firstStage(c)}`;
        render();
        toast("Participants confirmed.");
        break;
      case "unlock":
        setRosterLock(c, false);
        save();
        render();
        break;
      case "to-stage":
        tab = `stage:${firstStage(c)}`;
        render();
        break;
      case "fill-all":
        fillWeapons(c, $("#fill-weapon").value);
        save();
        render();
        toast("Rifle applied to everyone.");
        break;
      case "select-all": {
        const cap = !isCS(c) && DETAIL_RULES[c.program]?.max;
        selected = new Set(
          queue(c, stage)
            .filter((x) => !x.errors.length)
            .slice(0, cap || undefined)
            .map((x) => x.key),
        );
        render();
        break;
      }
      case "redetail":
        redetail(stage);
        break;
      case "manual-detail":
        manualDetailDialog(stage);
        break;
      case "toggle-scored":
        showScored = !showScored;
        render();
        break;
      case "backup":
        download(
          `detail-ic-${now().slice(0, 10)}.json`,
          JSON.stringify(store, null, 2),
        );
        break;
      case "restore":
        restore();
        break;
      case "csv":
        download(
          "detail-ic-scores.csv",
          "﻿" + exportCsv(c),
          "text/csv;charset=utf-8",
        );
        break;
    }
  } catch (err) {
    toast(err.message);
  }
});
if (globalThis.APP_VERSION)
  $("#app-version").textContent = `v${globalThis.APP_VERSION}`;
window.addEventListener("storage", (e) => {
  if (e.key === KEY)
    warning("Changed in another tab. Export any unsaved work, then reload.");
});
render();
if (storageError)
  warning("Saved data could not be read. It has not been overwritten.");
else save();
// A new version installs in the background and waits for the Update button.
if ("serviceWorker" in navigator) {
  let registration = null,
    applying = false,
    replaced = false,
    hadController = !!navigator.serviceWorker.controller;
  const showUpdate = () => {
    $("#update").hidden = false;
  };
  $("#update").onclick = () => {
    if (!replaced && !registration?.waiting) return;
    save();
    applying = true;
    if (replaced) return location.reload();
    $("#update").disabled = true;
    $("#update").textContent = "Updating…";
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  };
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (applying) location.reload();
    else if (hadController) {
      replaced = true;
      showUpdate();
    }
    hadController = true;
  });
  navigator.serviceWorker
    .register("./sw.js", { updateViaCache: "none" })
    .then(async (reg) => {
      registration = reg;
      await navigator.serviceWorker.ready;
      let checking = false;
      const check = async () => {
        if (checking || document.visibilityState === "hidden" || !navigator.onLine)
          return;
        checking = true;
        try {
          await reg.update();
          if (reg.waiting) showUpdate();
        } catch (e) {
        } finally {
          checking = false;
        }
      };
      if (reg.waiting) showUpdate();
      reg.addEventListener("updatefound", () => {
        const fresh = reg.installing;
        fresh?.addEventListener("statechange", () => {
          if (fresh.state === "installed" && navigator.serviceWorker.controller)
            showUpdate();
        });
      });
      check();
      setInterval(check, 60000);
      addEventListener("focus", check);
      addEventListener("online", check);
      document.addEventListener("visibilitychange", check);
    })
    .catch(() => {});
}
