import {
  PROGRAMS,
  TYPES,
  DETAIL_RULES,
  NON_SAR,
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
  activateStage,
  requireActiveStage,
  availableMembers,
  replacementPlan,
  setPersonSkipped,
  personSkipped,
  skippedStages,
  importBackup,
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
  orderParticipant,
  autoDetail,
  rosterIssues,
  addParticipants,
  ensureDetail,
  updateParticipant,
  hasRecords,
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
  breakdownFor,
  parseBreakdown,
  validateBreakdownLayout,
  scoreHistory,
  nextAttempt,
  detailAttempts,
  firingQueue,
  setSkipped,
  nothingToGain,
  insights,
  weakFirers,
  shootsPoorly,
  cleared,
  stageNeed,
  goal,
  poorPace,
  marksmanPace,
  committed,
  overlapping,
  homeAttempts,
  isStrong,
  advice,
  buildAround,
  planRest,
  firerHits,
  hitsRange,
  detailPlan,
  parseRoster,
  MISSING,
  attemptNumbers,
  detailAttemptNumbers,
  best,
  result,
  voidAttempt,
  unvoidAttempt,
  restorable,
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
  historyFeed,
  exportCsv,
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
const KEY = "detail-ic-v2-store";
let store,
  lastSaved = null,
  storageError = false,
  unsaved = false,
  tab = "shoots",
  // Shoots is a chooser: a shoot's own tabs appear only once one is opened,
  // so the row never implies a shoot is already in hand.
  openedShoot = false,
  search = "",
  selected = new Set(),
  openPresets = new Set(),
  showScored = false,
  addMode = null,
  dragging = null,
  dragOver = null,
  manualSort = "best",
  showReached = false,
  openEvents = new Set(),
  historyFilter = null,
  pasteDetail = 1,
  apsView = "standard",
  busy = false,
  pointerDown = false,
  pending = null;
try {
  lastSaved = localStorage.getItem(KEY);
  store = lastSaved ? validateStore(JSON.parse(lastSaved)) : newStore();
  applyPresets(store);
} catch (e) {
  store = newStore();
  storageError = true;
}
const s = () => getShoot(store);
const format = (v) => (v === null || v === undefined ? "—" : String(v));
const ratio = (v, max) => `${format(v)}/${max}`;
const weapons = (c) => weaponsFor(c.program, c.variant);
// Service dates read day-first with the month in letters — 20 Sep, 04 Mar — and
// times are 24-hour. The year is added only where a record is being filed or
// looked up later, not on today's scoring screens.
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const pad = (n) => String(n).padStart(2, "0");
const dayLabel = (iso, year = false) => {
  const d = new Date(iso);
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]}${year ? ` ${d.getFullYear()}` : ""}`;
};
const clockLabel = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const dateLabel = (iso) => dayLabel(iso, true);
// Separated, so a 24-hour time is never mistaken for a year.
const stampLabel = (iso, year = false) =>
  `${dayLabel(iso, year)} · ${clockLabel(iso)}`;
const stageLabel = (c, stage) => stages(c).find((x) => x.id === stage).label;
const reduceMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;
// Re-rendering while a button is pressed would swallow its click, so wait.
function later(fn) {
  if (pointerDown) pending = fn;
  else fn();
}
document.addEventListener("pointerdown", () => (pointerDown = true), true);
// A touch that turns into a scroll is cancelled and never sends pointerup, and
// a press that ends off the window may not either. Without these the waiting
// redraw would never run and the page would stop responding to taps.
function released() {
  pointerDown = false;
  if (pending)
    setTimeout(() => {
      const fn = pending;
      pending = null;
      fn?.();
    });
}
for (const event of ["pointerup", "pointercancel"])
  document.addEventListener(event, released, true);
addEventListener("blur", released);
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
  $("#storage-warning").innerHTML =
    `${esc(message)} <button id="export-unsaved">Export backup</button> <button id="retry-save">Retry save</button>`;
  $("#export-unsaved").onclick = () =>
    download(`detail-ic-unsaved-${Date.now()}.json`, JSON.stringify(store));
  $("#retry-save").onclick = () => {
    if (save()) toast("Saved on this device.");
  };
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
    unsaved = false;
    $("#storage-warning").hidden = true;
    return true;
  } catch (e) {
    unsaved = true;
    warning(
      `Not saved on this device. ${e.message || "Storage is full. Export a backup."}`,
    );
    return false;
  }
}
// Shows an input's error as red text under it. The page has been re-rendered,
// so the field is found again by its data attribute.
function fieldError(t, message) {
  const key = Object.keys(t.dataset)[0],
    attr = key && `data-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`,
    field =
      (t.id && document.getElementById(t.id)) ||
      (attr && $(`[${attr}="${CSS.escape(t.dataset[key])}"]`));
  const home = field?.closest(".target-row, td, .field, .toolbar");
  if (!home) return toast(message);
  const note = document.createElement("div");
  note.className = "field-error";
  note.setAttribute("role", "alert");
  note.textContent = message;
  // Inside a table cell the note goes under the input; elsewhere under the row.
  if (home.tagName === "TD") home.append(note);
  else home.after(note);
}
function toast(text, undo) {
  if (unsaved)
    text = "Changes are only in memory. Export a backup before reloading.";
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
function textMatches(text) {
  const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((token) => String(text).toLowerCase().includes(token));
}
function filtered(p) {
  const detail = s()?.details.find((d) => d.id === p.detailId)?.name ?? "";
  const r = s() ? result(s(), p) : null;
  return textMatches(
    `${p.name} ${p.weapon} ${detail} ${p.profile.components.map((c, i) => `${r?.scores[i] ?? ""}/${c.max}`).join(" ")} ${r?.total ?? ""} ${r?.status ?? ""}`,
  );
}
function matchFirst(items, matches = filtered) {
  return search.trim()
    ? items.toSorted((a, b) => Number(matches(b)) - Number(matches(a)))
    : items;
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
  return `<input type="search" id="search" placeholder="Search" aria-label="Find a name, detail or score" value="${esc(search)}">`;
}
function render() {
  const current = s(),
    tabs = [
      ["shoots", "Shoots"],
      ...(current && openedShoot
        ? [
            ["participants", "Participants"],
            ...stages(current).map((c) => [`stage:${c.id}`, c.label]),
            ["final", "Final scores"],
            ["history", "History"],
          ]
        : []),
      ["settings", "Settings"],
    ];
  if (!tabs.some((t) => t[0] === tab)) tab = "shoots";
  // Scoring opens only once the participants are confirmed.
  const scoring = (key) => key.startsWith("stage:") || key === "final",
    shut = current && !current.locked;
  if (shut && scoring(tab)) tab = "participants";
  // Replacing the row would destroy the button a tap is in the middle of, and
  // the click would go nowhere, so it is only rewritten when it has changed.
  const bar = tabs
    .map(
      ([key, label]) =>
        `<button data-tab="${key}" class="${tab === key ? "on" : ""}" ${tab === key ? 'aria-current="page"' : ""} ${shut && scoring(key) ? 'disabled title="Confirm the participants first"' : ""}>${esc(label)}</button>`,
    )
    .join("");
  if ($("#tabs").innerHTML !== bar) $("#tabs").innerHTML = bar;
  if (tab === "shoots") renderShoots();
  else if (tab === "settings") renderSettings();
  else if (tab === "participants") renderParticipants();
  else if (tab === "final") renderFinal();
  else if (tab === "history") renderHistory();
  else renderStage(tab.split(":")[1]);
}
function renderShoots() {
  const types = TYPES,
    list = store.shoots.toSorted(
      (a, b) =>
        Number(
          search &&
            textMatches(
              `${b.name} ${b.participants.map((p) => p.name).join(" ")}`,
            ),
        ) -
          Number(
            search &&
              textMatches(
                `${a.name} ${a.participants.map((p) => p.name).join(" ")}`,
              ),
          ) ||
        (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt),
    );
  $("#main").innerHTML =
    `<div class="shoots"><section class="panel"><div class="panel-head"><h2>New shoot</h2></div><div class="panel-body">${
      types.length
        ? `<form id="new-shoot" novalidate><div class="type-grid" role="radiogroup" aria-label="Shoot type">${types.map(([p, v], i) => `<label class="type-option"><input type="radio" name="type" value="${p}|${v}" ${i === 0 ? "checked" : ""}><span>${esc(typeLabel(p, v))}</span></label>`).join("")}</div><label class="field"><span>Shoot name</span><input name="name" autocomplete="off" placeholder="e.g. Alpha Coy · ${esc(dateLabel(now()))}"></label><div class="error" role="alert"></div><button class="primary" type="submit">Create shoot</button></form>`
        : ""
    }</div></section>${
      list.length
        ? `<section class="panel"><div class="panel-head"><h3>Shoots <span class="count">${list.length}</span></h3>${searchBox()}</div>${list
            .map(
              (x) =>
                `<div class="shoot-row ${search && textMatches(`${x.name} ${x.participants.map((p) => p.name).join(" ")}`) ? "match" : ""}"><div><strong>${esc(x.name)}</strong><p class="note">${esc(typeLabel(x.program, x.variant))} · ${esc(dateLabel(x.createdAt))} · ${x.participants.length} participants · ${hasScores(x) ? "Scores recorded" : "No scores yet"}</p></div><div class="actions"><button class="danger" data-delete-shoot="${x.id}" aria-label="Delete ${esc(x.name)}">Delete</button><button class="primary" data-open-shoot="${x.id}" aria-label="Open ${esc(x.name)}">Open</button></div></div>`,
            )
            .join("")}</section>`
        : ""
    }<div class="toolbar shoots-data"><button data-action="backup">Export backup</button><button data-action="restore">Import backup</button></div></div>`;
}
// Detail buttons offered per participant: as many details as the minimum size allows.
function nextDetailNumber(c) {
  const used = new Set(
    c.details
      .filter((d) => !d.temporary && members(c, d.id).length)
      .map(detailNumber),
  );
  let n = 1;
  while (used.has(n)) n++;
  return n;
}
// How many details this roster can fill, so numbering cannot run away.
function detailCap(c) {
  const rule = DETAIL_RULES[c.program];
  return rule ? Math.max(1, Math.floor(c.participants.length / rule.min)) : 1;
}
// Details that are the wrong size right now, worked out on every render so the
// note cannot go stale while the roster is being filled in.
function sizeNote(c) {
  const rule = DETAIL_RULES[c.program];
  if (!rule) return "";
  const bad = sortedDetails(c)
    .filter((d) => !d.temporary && members(c, d.id).length)
    .map((d) => ({ d, n: members(c, d.id).length }))
    .filter(({ n }) => n < rule.min || n > rule.max);
  return bad.length
    ? `${bad.map(({ d, n }) => `${d.name} has ${n} ${n === 1 ? "firer" : "firers"}`).join(", ")}. ${typeLabel(c.program, c.variant)} details take ${rule.min}–${rule.max}. Fix it in the list below before you confirm.`
    : "";
}
function addPanel(c) {
  const cs = isCS(c);
  if (!addMode)
    return c.participants.length
      ? '<div class="add-bar"><button class="primary" data-action="add">Add participants</button></div>'
      : "";
  if (addMode === "choose")
    return `<section class="panel add-panel"><div class="panel-head"><h3>Add participants</h3><button class="icon-button" data-action="add-close" aria-label="Close">✕</button></div><div class="panel-body"><p class="note">Do you already know who is in each detail?</p><div class="actions"><button class="primary" data-action="add-by-detail">Paste detail by detail</button><button data-action="add-list">Paste the whole list</button></div></div></section>`;
  const byDetail = addMode === "detail";
  return `<section class="panel add-panel"><div class="panel-head"><h3>${byDetail ? `Paste Detail ${pasteDetail}` : "Paste full names"}</h3><button class="icon-button" data-action="add-close" aria-label="Close">✕</button></div><div class="panel-body"><textarea id="add-names" aria-label="${byDetail ? `Full names for Detail ${pasteDetail}` : "Full names"}" placeholder="Alex Tan&#10;Benjamin Lee"></textarea><div class="actions">${byDetail ? '<button class="primary" data-action="add-next">Save and next detail</button><button data-action="add-done">Save and finish</button>' : '<button class="primary" data-action="add-save">Add participants</button>'}</div><div class="errors add-note">${esc(byDetail ? sizeNote(c) : "")}</div><p class="note">${byDetail ? `Everyone in this box joins Detail ${pasteDetail}. Save and finish adds them and closes.` : cs ? "One full name per line. A detail number after a name puts them straight into it, for example “Alex Tan, 2”." : "One full name per line."} Everyone starts on ${esc(baseWeapons(c.program, c.variant)[0])}; change a firer's rifle on their row.</p></div></section>`;
}
function renderParticipants() {
  const c = s(),
    cs = isCS(c),
    multi = weapons(c).length > 1,
    locked = c.locked,
    duplicate = (p) =>
      c.participants.filter(
        (x) => x.name.trim().toLowerCase() === p.name.trim().toLowerCase(),
      ).length > 1,
    matches = (p) => search && filtered(p),
    highest = Math.max(
      0,
      ...c.details.filter((d) => !d.temporary).map(detailNumber),
    );
  const full = (n) => {
      const d = c.details.find((x) => !x.temporary && detailNumber(x) === n);
      return d ? members(c, d.id).length : 0;
    },
    max = DETAIL_RULES[c.program]?.max ?? Infinity,
    // A further detail is offered only once every earlier one has someone in it.
    roomForNew =
      cs &&
      Array.from({ length: highest }, (_, i) => full(i + 1)).every((n) => n) &&
      highest < detailCap(c);
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
        `<option value="${i + 1}" ${i + 1 === n ? "selected" : ""} ${full(i + 1) >= max && i + 1 !== n ? "disabled" : ""}>Detail ${i + 1}${full(i + 1) >= max && i + 1 !== n ? " · full" : ""}</option>`,
    ).join(
      "",
    )}${roomForNew || !n ? '<option value="new">New detail</option>' : ""}</select></td>`;
  };
  const row = (p) =>
    `<tr class="${matches(p) ? "match" : ""} ${duplicate(p) ? "duplicate-name" : ""}" ${cs && !locked ? `draggable="true" data-drag="${p.id}" data-drop-row="${p.id}"` : ""}>${cs ? `<td class="grip">${locked ? "" : `<span class="handle" aria-hidden="true">☰</span>`}</td>` : ""}<td class="name"><input class="name-input" type="text" data-name="${p.id}" value="${esc(p.name)}" aria-label="Name for ${esc(p.name)}" aria-invalid="${duplicate(p)}" ${locked ? "disabled" : ""}></td>${multi ? `<td>${hasRecords(c, p) ? `<span class="locked-field" data-locked-rifle="${p.id}" title="${esc(p.name)} has scores on ${esc(p.weapon)}. Void them to change rifle."><select class="row-weapon" aria-label="Rifle for ${esc(p.name)}" disabled>${option(weapons(c), p.weapon)}</select></span>` : `<select class="row-weapon" data-rifle="${p.id}" aria-label="Rifle for ${esc(p.name)}" ${locked ? "disabled" : ""}>${option(weapons(c), p.weapon)}</select>`}</td>` : ""}${cs ? picker(p) : ""}<td class="more-cell">${locked ? `<button class="more" data-person="${p.id}" aria-label="Scores for ${esc(p.name)}">⋯</button>` : `<button class="icon-button danger" data-remove="${p.id}" aria-label="Remove ${esc(p.name)}">✕</button>`}</td></tr>`;
  // An empty row on each detail, so a short detail can be filled in place.
  const addRow = (d, people) =>
    locked || !d || people.length >= max
      ? ""
      : `<tr class="add-row"><td class="grip"></td><td class="name" colspan="${1 + (multi ? 1 : 0) + 1}"><input class="name-input" type="text" enterkeyhint="done" data-add-to="${d.id}" placeholder="Add a firer to ${esc(d.name)}" aria-label="Add a firer to ${esc(d.name)}"></td><td></td></tr>`;
  const table = (people, d) =>
    `<div class="table-wrap"><table><thead><tr>${cs ? "<th></th>" : ""}<th>Full name</th>${multi ? "<th>Rifle</th>" : ""}${cs ? "<th>Detail</th>" : ""}<th></th></tr></thead><tbody>${matchFirst(people).map(row).join("")}${cs ? addRow(d, people) : ""}</tbody></table></div>`;
  let body = "";
  if (!c.participants.length)
    body = addMode
      ? ""
      : empty(
          "No participants yet",
          '<p>Paste full names, one per line.</p><button class="primary" data-action="add">Add participants</button>',
        );
  else if (cs) {
    const unassigned = members(c, null),
      groups = [
        ...(unassigned.length ? [[null, unassigned]] : []),
        // Temporary details belong to a stage, not the roster; they are in History.
        ...sortedDetails(c)
          .filter((d) => !d.temporary && members(c, d.id).length)
          .map((d) => [d, members(c, d.id)]),
      ];
    const orderedGroups = matchFirst(groups, ([, people]) =>
      people.some(filtered),
    );
    body = orderedGroups
      .map(
        ([d, people]) =>
          `<section class="panel ${d ? "" : "unassigned"}" ${d && !locked ? `data-drop="${d.id}"` : 'data-drop=""'}><div class="detail-head"><h3>${d ? esc(d.name) : "Needs a detail"}</h3>${d ? borrowedNote(c, d) : ""}<span class="count">${people.length}${d && max !== Infinity ? ` of ${max}` : ""} firers</span>${d && locked ? `<div class="actions"><button class="more" data-detail-menu="${d.id}" aria-label="Scores for ${esc(d.name)}">⋯</button></div>` : ""}${d || locked ? "" : '<div class="actions"><button class="primary" data-action="auto-detail">Auto-detail</button></div>'}</div>${table(people, d)}</section>`,
      )
      .join("");
  } else
    body = `<section class="panel">${table(c.participants, null)}</section>`;
  const ready = c.participants.length && !rosterIssues(c).length;
  $("#main").innerHTML =
    shootHead("", true) +
    (hasScores(c)
      ? '<p class="note lock-note">Scores are recorded, so the shoot type is locked. <button class="inline-link" data-action="shoots">Start a new shoot</button> to use a different type.</p>'
      : "") +
    (locked
      ? `<div class="panel confirmed"><span>Participants confirmed. Pick a stage above to start scoring.${isCS(c) ? " Stage B rifles can still change on its tab." : ""}</span><div class="actions"><button data-action="unlock">Edit participants</button></div></div>`
      : "") +
    (c.participants.length
      ? `<div class="toolbar">${searchBox()}<span class="count">${c.participants.length} participants</span><span class="spacer"></span>${locked ? "" : `<button class="danger" data-action="clear-participants">Clear participants</button>${ready ? '<button class="primary" data-action="confirm-participants">Confirm participants</button>' : ""}`}</div>`
      : "") +
    (locked || !c.participants.length ? "" : issuesPanel(c, false)) +
    (locked ? "" : addPanel(c)) +
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
// The counted score for the stage: in Stages A and C the detail's average,
// shared by everyone who fired it.
function resultsCell(c, p, stage) {
  const list = scoreHistory(c, p, stage);
  if (!list.length) return '<span class="muted">—</span>';
  const top = Math.max(...list.map((a) => a.score)),
    rest = list.map((a) => a.score);
  rest.splice(rest.indexOf(top), 1);
  return `<b>${top}</b>${rest.length ? `<span class="prev">${rest.join(" ")}</span>` : ""}`;
}
// Weak and Strong describe how a firer shoots, which in Stages A and C is not
// the number in the Results column: that is their detail's average.
function abilityMark(c, p, stage, weak, strong) {
  const low = weak.has(p.id),
    high = !low && strong.has(p.id);
  if (!low && !high) return "";
  const note = low
    ? `Shot under half of ${stageLabel(c, stage)}'s rounds, so they pull a detail's average down.`
    : `At or above the ${marksmanPace(p, stage)} that keeps them on course for Marksman.`;
  return ` <span class="badge ${high ? "green" : "red"}" title="${esc(note)}">${low ? "Weak" : "Strong"}</span>`;
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
    shootHead(`<span class="spacer"></span>${searchBox()}`) +
    issuesPanel(c) +
    (c.activeStage && c.activeStage !== stage
      ? `<div class="panel confirmed"><span>${esc(stageLabel(c, stage))} is locked. ${esc(stageLabel(c, c.activeStage))} is active.</span><button data-unlock-stage="${stage}">Unlock ${esc(stageLabel(c, stage))}</button></div>`
      : "") +
    `<div class="grid"><div class="score-col">${detailedStage(c, stage) ? detailPanels(c, stage) : individualPanel(c, stage)}</div><div class="side-col">${summaryPanel(c, stage)}${queuePanel(c, stage, q)}</div></div>`;
  if (c.activeStage && c.activeStage !== stage) {
    document
      .querySelectorAll(
        "[data-part-person], [data-hits], [data-cs-hits], [data-aggregate], [data-confirm], [data-confirm-all], [data-reset], [data-skip], [data-person-skip], [data-queue], #redetail, [data-action=manual-detail], [data-replace-detail], [data-build], [data-requeue]",
      )
      .forEach((el) => (el.disabled = true));
  }
}
// Roster problems that will block scoring. On other tabs it carries a link back.
function issuesPanel(c, link = true) {
  const issues = rosterIssues(c);
  return issues.length
    ? `<div class="panel issues" role="status">${esc(issues.join("\n"))}${link ? `\n<button class="inline-link" data-action="participants">Fix in Participants</button>` : ""}</div>`
    : "";
}
// Short local time, e.g. 9:42 AM, for when a score was confirmed.
function timeLabel(iso) {
  return clockLabel(iso);
}
function entryValue(c, stage, p) {
  return c.entries?.[`${stage}:${p.id}`] ?? "";
}
function breakdownText(parts) {
  return parts?.length
    ? parts.map((p) => `${p.label}: ${p.hits}/${p.max}`).join(" · ")
    : "";
}
// What one firer's hits contribute to their detail's total: their real score,
// capped at what the stage credits for the rifle they fired it on.
function creditedHits(c, detailId, stage, row) {
  const p = c.participants.find((x) => x.id === row.participantId);
  if (!p) return 0;
  const max = profileFor(
    c.program,
    c.variant,
    rosterWeapon(c, detailId, p),
  ).components.find((x) => x.id === stage).max;
  return Math.min(Number(row.hits), max);
}
// Some rifles are issued more rounds than the stage can credit. The real score
// is recorded and shown; only the arithmetic uses the lower figure.
function creditNote(weapon, fired, max, label) {
  return `${weapon} fires ${fired} rounds in ${label}. Enter the hits actually scored: up to ${max} count towards this firer's ${label} score, and anything above that is kept on record but not added in.`;
}
function scoreEditor(c, p, stage, detailId = null, disabled = false) {
  const weapon = detailId
      ? rosterWeapon(c, detailId, p)
      : stageRifle(c, p, stage),
    // The rifle used for this stage, which in Combat Shoot need not be the one
    // on the participant's own profile.
    component = profileFor(c.program, c.variant, weapon).components.find(
      (x) => x.id === stage,
    ),
    max = component.max,
    // What this rifle actually fires. Entry accepts all of it; only `max` is
    // credited, and the note below says so.
    fired = component.inputMax ?? max,
    row = detailId
      ? getDraft(c, detailId, stage).rows.find((r) => r.participantId === p.id)
      : null,
    value = detailId ? (row?.hits ?? "") : entryValue(c, stage, p),
    parts = breakdownFor(c, weapon, stage),
    values = detailId
      ? (row?.parts ?? [])
      : (c.entryParts?.[`${stage}:${p.id}`] ?? []),
    required = c.settings.requireBreakdown,
    attr = detailId ? `data-cs-hits="${p.id}"` : `data-hits="${p.id}"`;
  // No layout and none to set yet: this rifle's sequence has not been given,
  // so the sub-stage boxes stay closed and the stage is scored on its total.
  const pending = required && !parts.length && NON_SAR.has(weapon);
  const cell = (v, i, part) =>
    `<input type="text" inputmode="numeric" pattern="[0-9]*" data-part-person="${p.id}" data-part-index="${i}" ${detailId ? `data-part-detail="${detailId}"` : ""} value="${esc(v ?? "")}" aria-label="${esc(p.name)} ${esc(part.label)} hits" title="${esc(part.label)} /${part.max}" ${invalidPart(v, part) ? 'aria-invalid="true"' : ""} ${disabled ? "disabled" : ""}>`;
  return `<div class="hits-row">${
    required
      ? parts.length
        ? `<span class="subscores">${parts.map((part, i) => cell(values[i], i, part)).join("")}</span>`
        : pending
          ? `<span class="muted pending-parts" title="No sub-stage sequence has been given for the ${esc(weapon)} yet.">Sub-stages pending</span>`
          : `<button data-configure-parts="${esc(weapon)}" data-configure-stage="${stage}">Set sub-stages</button>`
      : ""
  }<span class="score-input"><input type="text" inputmode="numeric" pattern="[0-9]*" ${attr} value="${esc(value)}" aria-label="${esc(p.name)} hits" placeholder="—" ${required && parts.length ? "readonly" : ""} ${disabled || (required && !parts.length && !pending) ? "disabled" : ""}><span class="muted">/${fired}</span>${fired !== max ? info(creditNote(weapon, fired, max, stageLabel(c, stage))) : ""}</span></div>`;
}
// The column header names the sub-stage boxes, so each row can stay bare: one
// line of small boxes and the stage total at the end.
function hitsHeader(c, stage) {
  if (!c.settings.requireBreakdown) return "Hits";
  const layouts = [
    ...new Set(
      weapons(c)
        .map((w) => breakdownFor(c, w, stage))
        .filter((parts) => parts.length)
        .map((parts) => parts.map((x) => x.max).join("+")),
    ),
  ];
  if (layouts.length !== 1) return "Hits";
  const parts = layouts[0].split("+"),
    even = new Set(parts).size === 1,
    shape = even
      ? `${parts.length > 1 ? `${parts.length} × ` : ""}${parts[0]} rds`
      : `${parts.join(" + ")} rds`;
  return `Hits <span class="muted">${esc(shape)}</span>`;
}
// A box is wrong when it is not a whole number in range. Flagged as it is
// typed, rather than only when the whole detail is confirmed.
function invalidPart(v, part) {
  if (v === "" || v === null || v === undefined) return false;
  return !/^\d+$/.test(String(v)) || Number(v) > part.max;
}
function layoutDialog(program, variant, weapon, stage) {
  const pr = preset(store, program, variant),
    component = profileFor(program, variant, weapon).components.find(
      (c) => c.id === stage,
    ),
    parts = pr.breakdowns?.[`${weapon}:${stage}`] ?? [],
    // Parts cover the rounds fired. Where a rifle is issued more than the stage
    // credits, say so, or the figure looks like a mistake.
    fired = component.inputMax ?? component.max;
  dialog(
    `${component.label} sub-stages · ${weapon}`,
    `<p>One part per line: name, maximum hits. Maximums must total ${fired}.${fired !== component.max ? ` ${weapon} fires ${fired} rounds here; at most ${component.max} can be credited.` : ""}</p><label class="field"><span>Sub-stages</span><textarea name="layout" rows="8" placeholder="Part 1, 2">${esc(parts.map((p) => `${p.label}, ${p.max}`).join("\n"))}</textarea></label>`,
    "Save breakdown",
    (f) => {
      const layout = String(f.get("layout"))
        .split(/\n/)
        .filter((l) => l.trim())
        .map((line) => {
          const m = line.match(/^(.+),\s*(\d+)\s*$/);
          if (!m) throw Error("Use name, maximum hits on each line.");
          return { label: m[1].trim(), max: Number(m[2]) };
        });
      validateBreakdownLayout(layout, fired);
      if (
        store.shoots.some(
          (s) =>
            s.program === program &&
            s.variant === variant &&
            s.attempts.some(
              (a) =>
                a.stage === stage && a.weapon === weapon && a.breakdown?.length,
            ),
        ) &&
        JSON.stringify(parts) !== JSON.stringify(layout)
      )
        throw Error(
          "This breakdown already has recorded scores. Its definitions are fixed for this version.",
        );
      pr.breakdowns ??= {};
      pr.breakdowns[`${weapon}:${stage}`] = layout;
      for (const shoot of store.shoots.filter(
        (s) => s.program === program && s.variant === variant,
      )) {
        shoot.settings.breakdowns ??= {};
        shoot.settings.breakdowns[`${weapon}:${stage}`] =
          structuredClone(layout);
      }
      applyPresets(store);
      save();
      $("#dialog").close();
      render();
    },
  );
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
    toShoot = matchFirst(order.map((e) => e.members[0])),
    done = c.participants
      .filter((p) => !toShoot.includes(p))
      .toSorted((a, b) => detailOf(a) - detailOf(b)),
    entered = toShoot.filter((p) => entryValue(c, stage, p) !== "").length,
    weak = new Set(weakFirers(c, stage).map((x) => x.p.id)),
    strong = new Set(
      c.participants.filter((p) => isStrong(c, p, stage)).map((p) => p.id),
    );
  const row = (p) => {
    const max = p.profile.components.find((x) => x.id === stage).max,
      e = entry.get(p.id),
      typed = entryValue(c, stage, p) !== "";
    return `<tr data-row="${p.id}" class="${[waiting.has(p.id) && "awaiting", e.skipped && "skipped", search && filtered(p) && "match"].filter(Boolean).join(" ")}"><td class="seat">${e.n + 1}</td><td class="name">${esc(p.name)}${personSkipped(c, p, stage) ? badge("Skipped") : ""}${abilityMark(c, p, stage, weak, strong)}${multi && !cs && p.weapon !== c.settings.weapon ? `<div class="sub">${esc(p.weapon)}</div>` : ""}<div class="attempt ${waiting.has(p.id) ? "on" : ""}">${e.skipped ? "Skipped · " : ""}Attempt ${e.attempt}${waiting.has(p.id) ? " · redetailed" : ""}</div></td>${cs ? `<td class="rifle">${esc(stageRifle(c, p, stage))}</td>` : ""}<td>${scoreEditor(c, p, stage, null, e.skipped)}</td><td class="num results">${resultsCell(c, p, stage)}</td><td class="more-cell"><button class="more" data-person="${p.id}" aria-label="Options for ${esc(p.name)}">⋯</button></td></tr>`;
  };
  const scoredRow = (p) => {
    const last = scoreHistory(c, p, stage).at(-1);
    return `<tr data-row="${p.id}" class="${search && filtered(p) ? "match" : ""}"><td class="name">${esc(p.name)}</td><td class="num results">${resultsCell(c, p, stage)}</td><td class="muted when">${last ? esc(timeLabel(last.recordedAt)) : ""}</td><td class="more-cell"><button class="more" data-person="${p.id}" aria-label="Options for ${esc(p.name)}">⋯</button></td></tr>`;
  };
  const past = done.length
    ? `<details class="panel past-scores"${search ? " open" : ""}><summary>Past scores · ${done.length} ${done.length === 1 ? "firer" : "firers"}</summary><div class="table-wrap"><table><thead><tr><th>Full name</th><th>Results</th><th>Confirmed</th><th></th></tr></thead><tbody>${matchFirst(done).map(scoredRow).join("")}</tbody></table></div></details>`
    : "";
  const pastFirst = search && done.some(filtered);
  return (
    (pastFirst ? past : "") +
    `<section class="panel score-panel" data-individual><div class="detail-head"><h3>${esc(stageLabel(c, stage))}</h3><span class="count">${toShoot.length} in the queue</span>${toShoot.length ? `<div class="actions"><span class="draft-summary">${entered} of ${toShoot.length} entered.</span><button class="primary" data-confirm-all="${stage}">Confirm scores</button></div>` : ""}</div>${cs ? '<p class="note stage-note">Fired individually. Details do not apply to this stage; a firer may use a different rifle for it.</p>' : ""}${
      toShoot.length
        ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>Full name</th>${cs ? "<th>Rifle</th>" : ""}<th>${hitsHeader(c, stage)}</th><th>Results</th><th></th></tr></thead><tbody>${toShoot.map(row).join("")}</tbody></table></div>`
        : `<div class="panel-body note">Everyone has a ${esc(stageLabel(c, stage))} score. Redetail firers to enter more.</div>`
    }<div class="errors draft-errors" role="alert"></div></section>` +
    (pastFirst ? "" : past)
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
  // Always a line, so the bar never pops in and out as hits are typed.
  return v.shared && v.score !== null
    ? `Average ${v.aggregate}/${v.divisor} → ${v.score}/${max}.`
    : `${entered} of ${v.rows.length} entered.`;
}
function hasInput(draft) {
  return (
    !!draft && (draft.aggregate !== "" || draft.rows.some((r) => r.hits !== ""))
  );
}
// Skip toggles; it greys out once hits are typed, since that entry is firing.
function skipButton(key, name, on, typed) {
  return `<button type="button" class="skip ${on ? "on" : ""}" data-skip="${esc(key)}" aria-pressed="${!!on}" ${typed ? "disabled" : ""} title="${on ? "Skipped: tap to put back in its place" : "Skip: move below everyone waiting"}" aria-label="${on ? "Unskip" : "Skip"} ${esc(name)}">${on ? "Skipped" : "Skip"}</button>`;
}
// Combat Shoot Stage B can be fired on a different rifle, remembered per firer.
// Every CS rifle has the same stage limits and thresholds, so the total holds.
function stageRifle(c, p, stage) {
  return c.stageRifles?.[`${p.id}:${stage}`] ?? p.weapon;
}
// A detail whose scores are in. There is nothing left to type, so it shows
// what it fired, when it was confirmed, and a menu to correct it.
function scoredPanel(c, d, stage, weak, strong) {
  const list = detailAttempts(c, d.id, stage).filter(
      (a) => a.status === "valid",
    ),
    last = list.at(-1),
    cmax = stages(c).find((x) => x.id === stage).max;
  if (!last) return "";
  const people = members(c, d.id),
    numbers = detailAttemptNumbers(c, d.id, stage),
    hitsOf = (p) => last.roster.find((m) => m.id === p.id)?.rawHits;
  return `<section class="panel score-panel scored" data-detail="${d.id}"><div class="detail-head">${d.temporary ? '<span class="badge">Temporary</span>' : ""}<h3>${esc(d.name)}</h3>${badge(`Attempt ${numbers.get(last.id) ?? list.length}`)}<span class="count">Scored ${ratio(last.score, cmax)} · ${esc(timeLabel(last.recordedAt))}</span>${borrowedNote(c, d, stage)}<div class="actions"><button class="more" data-detail-history="${d.id}" aria-label="Scores for ${esc(d.name)}">⋯</button></div></div><div class="table-wrap"><table><thead><tr><th>Full name</th><th>Rifle</th><th>${hitsHeader(c, stage)}</th><th>Results</th><th></th></tr></thead><tbody>${people
    .map(
      (p) =>
        `<tr data-row="${p.id}" class="${search && filtered(p) ? "match" : ""}"><td class="name">${esc(p.name)}${personSkipped(c, p, stage) ? badge("Skipped") : ""}${abilityMark(c, p, stage, weak, strong)}</td><td class="rifle">${esc(rosterWeapon(c, d.id, p))}</td><td class="num">${hitsOf(p) ?? '<span class="muted">—</span>'}</td><td class="num results">${resultsCell(c, p, stage)}</td><td class="more-cell"><button class="more" data-person="${p.id}" aria-label="Options for ${esc(p.name)}">⋯</button></td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></div>${last.inputMode === "aggregate" ? `<div class="score-footer"><span class="draft-summary">Confirmed on the detail total: ${last.aggregateHits} over ${last.divisor} firers.</span></div>` : ""}</section>`;
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
      ? matchFirst(all, (d) => members(c, d.id).some(filtered))
      : showScored
        ? [...open, null, ...all.filter((d) => !open.includes(d))]
        : [...open, null],
    unassigned = members(c, null).length,
    weak = new Set(weakFirers(c, stage).map((x) => x.p.id)),
    strong = new Set(
      c.participants.filter((p) => isStrong(c, p, stage)).map((p) => p.id),
    );
  if (!all.length)
    return empty(
      unassigned ? "Assign details first" : "Add participants first",
      '<p><button data-action="participants">Participants</button></p>',
    );
  return (
    (unassigned
      ? `<p class="note">${unassigned} ${unassigned === 1 ? "participant needs" : "participants need"} a detail. <button class="inline-link" data-action="participants">Assign details</button></p>`
      : "") +
    shown
      .map((d) => {
        if (!d) return toggle;
        const people = members(c, d.id),
          draft = getDraft(c, d.id, stage),
          attempt = nextAttempt(c, people, stage),
          e = entry.get(d.id),
          available = availableMembers(c, d.id, stage),
          absent = people.filter((p) => personSkipped(c, p, stage)),
          short = available.length < DETAIL_RULES[c.program].min;
        // Waiting to fire, or part-typed: a form. Otherwise it is a record.
        if (!e && !hasInput(draft))
          return scoredPanel(c, d, stage, weak, strong);
        return `<section class="panel score-panel ${[d.temporary && "temporary", e?.skipped && "skipped"].filter(Boolean).join(" ")}" data-detail="${d.id}"><div class="detail-head">${e ? `<span class="seat">${e.n + 1}</span>` : ""}<h3>${esc(d.name)}</h3>${badge(`Attempt ${attempt}`)}${borrowedNote(c, d, stage)}<span class="count">${available.length} available</span><div class="actions">${e && order.length > 1 ? skipButton(`detail:${d.id}`, d.name, e.skipped, hasInput(draft)) : ""}${e?.dispatch ? `<button data-undetail="${e.dispatch.id}" title="Cancel this redetail and put the detail back in the Redetailing list" aria-label="Cancel redetail ${esc(d.name)}">Cancel redetail</button>` : ""}<button data-detail-history="${d.id}" aria-label="History for ${esc(d.name)}">History</button><button class="icon-button" data-reset="${d.id}" title="Clear entries" aria-label="Clear entries for ${esc(d.name)}">↺</button><button class="primary" data-confirm="${d.id}" aria-label="Confirm scores for ${esc(d.name)}" ${e?.skipped || short ? "disabled" : ""}>Confirm scores</button></div></div>${absent.length ? `<div class="issues" role="status">${short ? `Too few available firers: ${available.length}/${DETAIL_RULES[c.program].min}.` : `${absent.length} skipped; this attempt will include ${available.length} firers.`} ${absent.map((p) => `<button data-person-skip="${p.id}">Unskip ${esc(p.name)}</button>`).join(" ")} ${short ? `<button data-replace-detail="${d.id}">Build replacement detail</button>` : ""}</div>` : ""}<div class="table-wrap"><table><thead><tr><th>Full name</th><th>Rifle</th><th>${hitsHeader(c, stage)}</th><th>Results</th><th></th></tr></thead><tbody>${matchFirst(
          people,
        )
          .map((p) => {
            const row = draft.rows.find((r) => r.participantId === p.id),
              mine = nextAttempt(c, p, stage);
            return `<tr data-row="${p.id}" class="${[personSkipped(c, p, stage) && "skipped", waiting.has(p.id) && "awaiting", search && filtered(p) && "match"].filter(Boolean).join(" ")}"><td class="name">${esc(p.name)}${personSkipped(c, p, stage) ? badge("Skipped") : ""}${abilityMark(c, p, stage, weak, strong)}${mine !== attempt || waiting.has(p.id) ? `<div class="attempt ${waiting.has(p.id) ? "on" : ""}">Attempt ${mine}${waiting.has(p.id) ? " · redetailed" : ""}</div>` : ""}</td><td class="rifle">${esc(rosterWeapon(c, d.id, p))}</td><td>${scoreEditor(c, p, stage, d.id, e?.skipped || personSkipped(c, p, stage))}</td><td class="num results">${resultsCell(c, p, stage)}</td><td class="more-cell"><button class="more" data-person="${p.id}" aria-label="Options for ${esc(p.name)}">⋯</button></td></tr>`;
          })
          .join(
            "",
          )}</tbody></table></div>${shared && !c.settings.requireBreakdown ? `<div class="aggregate"><label>Detail total <input type="text" inputmode="numeric" pattern="[0-9]*" data-aggregate="${d.id}" value="${esc(draft.aggregate)}" aria-label="${esc(d.name)} total hits" placeholder="—" ${e?.skipped ? "disabled" : ""}></label><span class="muted">/${available.length * cmax} · fills in from the hits</span></div>` : ""}<div class="errors draft-errors">${esc(draftErrors(c, draft).join("\n"))}</div><div class="score-footer"><span class="draft-summary">${esc(e?.skipped ? "Skipped: it has not fired. Unskip to enter scores." : draftSummary(c, draft))}</span></div></section>`;
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
        "Automatic: 1. Firers at risk of failing, who cannot pass without a better score here. 2. Everyone else, furthest from their threshold first, since they need the most attempts and practice. A firer's threshold is their share of what they still need for Marksman, worked out from the scores already in; Stage B starts at 7/8 and adjusts as other stage scores arrive.",
      highest: "Highest best score first.",
      first:
        "Confirmation order: earliest confirmed group first, then lane order within that group. Search does not change lane order.",
    }[c.settings.order] ?? "Lowest best score first."
  } ▲ High priority firers go first and ▼ low priority firers go last.`;
}
function queuePanel(c, stage, q) {
  const started = c.attempts.some(
      (a) => a.stage === stage && a.status === "valid",
    ),
    ready = q.filter((e) => !e.errors.length).length,
    count = q
      .filter((e) => selected.has(e.key))
      .reduce((n, e) => n + e.members.length, 0);
  // Nothing to redetail yet: keep it to one line, so phones see the queue first.
  const manual = detailedStage(c, stage)
    ? '<button data-action="manual-detail">Manual detail</button>'
    : "";
  if (!started)
    return `<section class="panel queue"><div class="queue-head"><div class="queue-title"><h3>Redetailing</h3></div><p class="note">Opens once the first ${esc(stageLabel(c, stage))} scores are in.</p>${manual ? `<div class="queue-actions">${manual}</div>` : ""}</div></section>`;
  return `<section class="panel queue"><div class="queue-head"><div class="queue-title"><h3>Redetailing</h3>${!started ? "" : `<span class="count">${q.reduce((n, e) => n + e.members.length, 0)} firers</span>`}</div><div class="queue-method"><select id="order" aria-label="Redetailing order">${[
    ["smart", "Automatic"],
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
    )}</select>${info(methodInfo(c))}</div><div class="queue-actions">${manual}<button data-action="select-all" ${!started || !ready ? "disabled" : ""}>Select all</button><button class="primary" id="redetail" data-action="redetail" ${count && started ? "" : "disabled"}>Redetail${count ? ` (${count})` : ""}</button></div></div>${!started ? `<div class="panel-body note">No ${esc(stageLabel(c, stage))} scores yet.</div>` : ""}<div class="queue-list" ${!started ? "hidden" : ""}>${
    matchFirst(q, (e) => e.members.some(filtered))
      .map((e, i) => {
        const name = e.detail ? e.detail.name : e.members[0].name,
          max = e.priority.p.profile.components.find((x) => x.id === stage).max;
        return `<div class="queue-row ${search && e.members.some(filtered) ? "match" : ""}" data-key="${esc(e.key)}"><input type="checkbox" data-queue="${esc(e.key)}" ${selected.has(e.key) ? "checked" : ""} ${e.errors.length ? "disabled" : ""} aria-label="Select ${esc(name)}"><span class="count">${i + 1}</span><div><strong>${esc(name)}</strong>${e.detail ? borrowedNote(c, e.detail, stage) : ""}${e.above ? badge("Above threshold") : ""}<p class="note">${e.errors.length ? "Fix this detail in Participants" : `Attempt ${e.attempt} · ${esc(e.reason)}`}</p>${e.holdingBack?.length ? `<p class="note holding">${esc(names(e.holdingBack.map((p) => p.name)))} may benefit from another attempt. Retry this detail, or consider a different mix.</p>` : ""}</div><button type="button" class="prio ${e.tag || ""}" data-priority="${esc(e.key)}" aria-label="${esc(name)} priority: ${e.tag || "normal"}" title="${e.tag === "high" ? "High priority" : e.tag === "low" ? "Low priority" : "Set priority"}">${e.tag === "high" ? "▲" : e.tag === "low" ? "▼" : "↕"}</button></div>`;
      })
      .join("") ||
    `<div class="panel-body note">${search && q.length ? "No matching firers to redetail." : "No firers to redetail."}</div>`
  }</div>${detailedStage(c, stage) ? weakPanel(c, stage) : ""}${reachedPanel(c, stage, q)}</section>`;
}
// What the operator should know before choosing who fires next.
// The summary itself is always on show; only the groups inside it fold away.
function summaryPanel(c, stage = null) {
  const notes = insights(c, stage);
  if (!notes.length) return "";
  const count = notes
    .filter((x) => x.level !== "info")
    .reduce((n, x) => n + x.items.length, 0);
  return `<section class="panel summary"><div class="summary-head"><h3>Summary</h3><span class="count">${count ? `${count} to review` : "On track"}</span></div>${notes
    .map(
      (n) =>
        `<details class="insight insight-${n.level}"><summary>${esc(n.title)} · ${n.items.length}</summary><ul>${n.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>`,
    )
    .join("")}</section>`;
}
// Poor shooters pull their detail's average down in Stages A and C, where the
// score is the detail's hits divided by its firers. Build detail puts one of
// them with the strongest shooters from other details — the ones who still
// need the stage first, so the reshoot is worth their time too. Their own
// detail gets two goes before it is worth breaking up, and a firer already
// booked into a detail is left alone so nobody is put on two firing points.
function weakPanel(c, stage) {
  const list = matchFirst(weakFirers(c, stage), ({ p }) => filtered(p));
  if (!list.length) return "";
  const max = stages(c).find((x) => x.id === stage).max,
    label = stageLabel(c, stage);
  return `<details class="reached weak-list"><summary>${list.length} poor ${list.length === 1 ? "shooter" : "shooters"}</summary><p class="note weak-note">An optional different mix, based on past scores. Retrying the same detail is also an option.</p>${list
    .map(({ p }) => {
      const d = c.details.find((x) => x.id === p.detailId),
        booked = committed(c, stage, p),
        tries = Math.max(
          scoreHistory(c, p, stage).length,
          homeAttempts(c, p, stage),
        ),
        why = booked
          ? "already in a detail waiting to fire"
          : tries < 2
            ? `${d ? d.name : "their detail"} fires ${tries ? "once more" : "twice"} first`
            : "";
      return `<div class="reached-row ${search && filtered(p) ? "match" : ""}"><span class="count">!</span><div><strong>${esc(p.name)}</strong><p class="note">${firerHits(c, p, stage) !== null ? `${firerHits(c, p, stage)}/${max}` : "no hits of their own recorded"}${advice(c, p, stage) ? `, ${advice(c, p, stage).text}` : ""}${d ? ` · ${esc(d.name)}` : ""}${why ? ` · ${esc(why)}` : ""}</p></div>${why ? "" : `<button type="button" data-build="${p.id}" aria-label="Build a detail around ${esc(p.name)}">Build detail</button>`}</div>`;
    })
    .join("")}</details>`;
}
// Firers who already met the stage threshold, with a way to send them again.
function reachedPanel(c, stage, q) {
  const listed = new Set(q.map((e) => e.key));
  let done = entities(c, stage).filter(
    (e) =>
      !listed.has(e.key) &&
      e.members.some((p) => best(c, p, stage) !== null) &&
      !c.dispatches.some(
        (d) => d.key === e.key && d.stage === stage && d.status === "awaiting",
      ),
  );
  const found = (e) => search && e.members.some(filtered);
  if (search) done = matchFirst(done, found);
  if (!done.length) return "";
  const score = (e) =>
    Math.max(...e.members.map((p) => best(c, p, stage) ?? 0));
  return `<details class="reached"${showReached || search ? " open" : ""}><summary>${done.length} at or above the threshold</summary>${done
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
// "1 shoot", "2 shoots".
function plural(n, noun) {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
// "A", "A and B", "A, B and C".
function names(list) {
  return list.length > 1
    ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`
    : (list[0] ?? "");
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
// Skip is only blocked while that entry has hits typed into it.
function syncSkips() {
  for (const button of document.querySelectorAll("[data-skip]")) {
    const panel = button.closest(".score-panel"),
      row = button.closest("tr"),
      boxes = [
        ...(row ?? panel ?? document).querySelectorAll(
          "[data-part-person],[data-hits]:not([readonly]),[data-cs-hits]:not([readonly]),[data-aggregate]",
        ),
      ],
      typed = boxes.some((x) => x.value !== "");
    button.disabled = typed;
    button.title = typed
      ? "Clear the hits to skip this entry"
      : button.classList.contains("on")
        ? "Skipped: tap to put back in its place"
        : "Skip: move below everyone waiting";
  }
}
function holdHit(input, stage) {
  const c = s();
  requireActiveStage(c, stage);
  c.updatedAt = now();
  c.entries ??= {};
  if (input.value === "") delete c.entries[`${stage}:${input.dataset.hits}`];
  else c.entries[`${stage}:${input.dataset.hits}`] = input.value;
  save();
  const panel = input.closest(".score-panel"),
    total = panel.querySelectorAll("[data-hits]").length,
    entered = [...panel.querySelectorAll("[data-hits]")].filter(
      (x) => x.value !== "",
    ).length;
  for (const label of panel.querySelectorAll(".draft-summary"))
    label.textContent = `${entered} of ${total} entered.`;
  syncSkips();
}
function confirmScores(stage) {
  const c = s(),
    panel = $(".score-panel"),
    errors = [],
    saved = [];
  requireActiveStage(c, stage);
  const laneOrder = firingQueue(c, stage).flatMap((e) =>
    e.members.map((p) => p.id),
  );
  const pending = Object.entries(c.entries ?? {})
    .filter(([key]) => key.startsWith(`${stage}:`))
    .map(([key, hits]) => ({
      p: c.participants.find((x) => x.id === key.slice(stage.length + 1)),
      hits,
    }))
    .filter((x) => x.p)
    .sort((a, b) => laneOrder.indexOf(a.p.id) - laneOrder.indexOf(b.p.id));
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
    else if (c.settings.requireBreakdown) {
      try {
        parseBreakdown(
          c,
          stageRifle(c, p, stage),
          stage,
          c.entryParts?.[`${stage}:${p.id}`],
        );
      } catch (e) {
        errors.push(`${p.name}: ${e.message}`);
      }
    } else if (parsed.error) errors.push(`${p.name}: ${parsed.error}`);
  }
  if (errors.length) {
    panel.querySelector(".draft-errors").textContent = errors.join("\n");
    return;
  }
  const at = now(),
    batchId = uid();
  for (const { p, hits } of pending) {
    saved.push(
      recordIndividual(
        c,
        p,
        stage,
        hits,
        isCS(c) ? stageRifle(c, p, stage) : p.weapon,
        "",
        at,
        c.settings.requireBreakdown
          ? c.entryParts?.[`${stage}:${p.id}`]
          : undefined,
        batchId,
      ),
    );
    delete c.entries[`${stage}:${p.id}`];
    if (c.entryParts) delete c.entryParts[`${stage}:${p.id}`];
  }
  const persisted = save();
  render();
  if (!persisted) {
    toast("Not saved");
    return;
  }
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
    !c.settings.requireBreakdown &&
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
  panel.querySelector(".draft-errors").textContent = draftErrors(c, draft).join(
    "\n",
  );
  const summary = panel.querySelector(".draft-summary");
  if (summary) summary.textContent = draftSummary(c, draft);
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
  const c = s(),
    rows = [...document.querySelectorAll(".queue-list .queue-row")],
    leaving = rows.filter((r) => keys.includes(r.dataset.key)),
    // Where the rows that stay are now, so they can slide up into their places.
    before = rowTops(rows.filter((r) => !keys.includes(r.dataset.key)));
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
  );
  selected.clear();
  save();
  busy = true;
  if (leaving.length && !reduceMotion()) {
    for (const r of leaving) r.classList.add("leaving");
    await new Promise((done) => setTimeout(done, 220));
  }
  busy = false;
  render();
  slideFrom(before);
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
const rowTops = (rows) =>
  new Map(rows.map((r) => [r.dataset.key, r.getBoundingClientRect().top]));
// Rows slide from where they were to where they now belong. Only transforms
// move, and the list is clipped while they do, so nothing reflows and no
// scrollbar appears mid-animation.
function slideFrom(before) {
  const list = $(".queue-list");
  if (!list || !before.size || reduceMotion()) return;
  const moves = [];
  for (const row of list.querySelectorAll(".queue-row")) {
    const from = before.get(row.dataset.key);
    if (from === undefined) continue;
    const dy = from - row.getBoundingClientRect().top;
    if (dy) moves.push([row, dy]);
  }
  if (!moves.length) return;
  list.classList.add("settling");
  let last = null;
  for (const [row, dy] of moves)
    last = row.animate(
      [{ transform: `translateY(${dy}px)` }, { transform: "none" }],
      { duration: 260, easing: "cubic-bezier(.2,.9,.2,1)" },
    );
  last.finished.catch(() => {}).then(() => list.classList.remove("settling"));
}
// A change that reorders the list: measure, apply, redraw, then let it settle.
function animateQueue(change) {
  const before = rowTops([
    ...document.querySelectorAll(".queue-list .queue-row"),
  ]);
  change();
  render();
  slideFrom(before);
}
function renderFinal() {
  const c = s(),
    cs = stages(c),
    rr = c.participants.map((p) => result(c, p));
  const table = (people) =>
    `<div class="table-wrap"><table><thead><tr><th>Full name</th><th>Result</th>${cs.map((x) => `<th>${esc(x.label)}</th>`).join("")}<th>Total</th><th></th></tr></thead><tbody>${matchFirst(
      people,
    )
      .map((p) => {
        const r = result(c, p);
        return `<tr class="${search && filtered(p) ? "match" : ""}"><td class="name">${esc(p.name)}${skippedStages(c, p).length ? badge("Skipped") : ""}</td><td>${badge(r.status)}</td>${p.profile.components
          .map((x, i) => {
            // Only the total carries a denominator. A stage shows what was
            // scored, with its sub-stages as quiet figures beside it.
            const parts = c.attempts.find(
              (a) => a.id === r.bestAttemptIds[i],
            )?.breakdown;
            return `<td class="num">${format(r.scores[i])}${parts?.length ? `<span class="sub-parts">${esc(parts.map((q) => q.hits).join(" · "))}</span>` : ""}</td>`;
          })
          .join(
            "",
          )}<td class="num"><b>${ratio(r.total, p.profile.total)}</b></td><td class="more-cell"><button class="more" data-person="${p.id}" aria-label="Options for ${esc(p.name)}">⋯</button></td></tr>`;
      })
      .join("")}</tbody></table></div>`;
  $("#main").innerHTML =
    shootHead(
      `<span class="spacer"></span>${searchBox()}<button data-action="csv">Export scores</button>`,
    ) +
    summaryPanel(c) +
    `<div class="summary-line">${["Marksman", "Pass", "Fail", "Incomplete"].map((label) => `<span><strong>${rr.filter((r) => r.status === label).length}</strong> ${label}</span>`).join("")}</div>` +
    (!c.participants.length
      ? empty("No scores yet")
      : isCS(c)
        ? c.details
            .filter((d) => !d.temporary && members(c, d.id).length)
            .toSorted(
              (a, b) =>
                Number(search && members(c, b.id).some(filtered)) -
                Number(search && members(c, a.id).some(filtered)),
            )
            .map(
              (d) =>
                `<section class="panel"><div class="detail-head"><h3>${esc(d.name)}</h3></div>${table(members(c, d.id))}</section>`,
            )
            .join("") +
          (members(c, null).length
            ? `<section class="panel"><h3>Unassigned</h3>${table(members(c, null))}</section>`
            : "")
        : `<section class="panel">${table(c.participants)}</section>`);
}
// The record of a shoot, filed under the stage each thing belongs to and
// newest first within it. Cards open for the detail behind them, and the menu
// beside a score corrects that score and nothing else.
function renderHistory() {
  const c = s(),
    feed = historyFeed(c),
    stageName = (id) => stages(c).find((x) => x.id === id)?.label ?? id,
    stageMax = (id) => stages(c).find((x) => x.id === id)?.max ?? null,
    text = (e) =>
      `${e.title ?? ""} ${e.stage ? stageName(e.stage) : ""} ${e.summary ?? ""} ${(e.lines ?? []).join(" ")} ${e.score ?? ""}/${e.max ?? (e.stage ? stageMax(e.stage) : "")} ${e.aggregate ?? ""} ${(e.people ?? []).map((x) => `${x.name} ${x.hits ?? ""}/${x.max ?? ""} ${x.score ?? ""} ${breakdownText(x.breakdown)}`).join(" ")}`,
    hit = (e) => !search || textMatches(text(e)),
    shown = matchFirst(feed, hit);
  const KINDS = {
      "detail-score": ["Scored", "blue"],
      score: ["Scored", "blue"],
      redetail: ["Redetailed", "amber"],
      "temp-detail": ["Detail built", "green"],
      roster: ["Nominal roll", ""],
      note: ["Setup", ""],
      operation: ["Operation", ""],
      void: ["Voided", "red"],
      restore: ["Restored", "green"],
    },
    tags = (e) => {
      const [label, tone] = KINDS[e.kind] ?? ["", ""];
      return `<span class="event-tags">${e.stage ? `<span class="badge">${esc(stageName(e.stage))}</span>` : ""}${label ? `<span class="badge ${tone}">${label}</span>` : ""}${e.voided ? '<span class="badge red">Voided</span>' : ""}</span>`;
    };
  const when = (e) => (e.at ? stampLabel(e.at) : ""),
    who = (e) => (e.people ?? []).map((x) => x.name).join(", "),
    mark = (x) => search && x.toLowerCase().includes(search.toLowerCase());
  // A card is a summary you can open. Whether it is open survives a redraw, so
  // typing in the search box does not keep shutting it.
  const card = (e, head, body = "", menu = "") =>
    `<details class="panel event ${search && hit(e) ? "match" : ""} ${e.voided ? "void" : ""}" data-event="${esc(e.id)}" ${openEvents.has(e.id) || (search && hit(e)) ? "open" : ""}><summary><div class="event-head"><div>${tags(e)}${head}</div><span class="when">${esc(when(e))}</span></div></summary>${body}</details>${menu}`;
  const flat = (e, head, body = "") => card(e, head, body);
  const title = (main, note) =>
    `<strong>${main}</strong>${note ? `<p class="note">${note}</p>` : ""}`;
  const voidNote = (e) =>
    e.voided
      ? `<span class="voided-tag">Voided${e.reason ? ` · ${esc(e.reason)}` : ""}</span>`
      : "";
  const scoreTable = (e, rows) =>
    `<div class="table-wrap"><table><tbody>${rows.join("")}</tbody></table></div>`;
  // Both a score and the void that took it out open the same record, where it
  // can be put back.
  const openScore = (e) =>
    e.recordId
      ? `<button data-detail-score="${esc(e.recordId)}">Open this score</button>`
      : e.attemptId
        ? `<button data-attempt="${esc(e.attemptId)}">Open this score</button>`
        : "";
  const entry = (e) => {
    const max = e.max ?? (e.stage ? stageMax(e.stage) : null);
    if (e.kind === "void" || e.kind === "restore")
      return flat(
        e,
        title(
          `${esc(e.title)}${e.score != null && max ? ` · ${e.score}/${max}` : ""} ${e.kind === "void" ? "voided" : "restored"}`,
          e.reason ? esc(e.reason) : "",
        ),
        `<div class="event-foot">${openScore(e)}</div>`,
      );
    if (e.kind === "detail-score") {
      // A detail's score belongs to the whole detail, so it is corrected as
      // one from here; a single firer cannot be voided out of it.
      const rows = e.people.map(
        (x) =>
          `<tr class="${mark(x.name) ? "match" : ""}"><td class="name">${esc(x.name)}${x.breakdown?.length ? `<div class="sub">${esc(breakdownText(x.breakdown))}</div>` : ""}</td><td class="num">${x.hits ?? '<span class="muted">—</span>'}${(x.max ?? max) ? `<span class="muted">/${x.max ?? max}</span>` : ""}</td></tr>`,
      );
      return card(
        e,
        title(
          `${esc(e.title)}${e.temporary ? ' <span class="badge">Temporary</span>' : ""} · ${e.score}/${max}`,
          `${e.people.length} firers${e.totalOnly ? ` · confirmed on the detail total ${e.aggregate} over ${e.divisor}` : ""} ${voidNote(e)}`,
        ),
        scoreTable(e, rows) +
          `<div class="event-foot"><button data-detail-score="${esc(e.recordId)}">${e.voided ? "Restore this detail's score" : "Edit or void this detail's score"}</button></div>`,
      );
    }
    if (e.kind === "score") {
      const rows = e.people.map(
        (x) =>
          `<tr class="${x.voided ? "void" : ""} ${mark(x.name) ? "match" : ""}"><td class="name">${x.lane ? `<span class="count">Lane ${x.lane}</span> ` : ""}${esc(x.name)}${x.breakdown?.length ? `<div class="sub">${esc(breakdownText(x.breakdown))}</div>` : ""}${x.voided ? `<div class="sub">Voided${x.reason ? ` · ${esc(x.reason)}` : ""}</div>` : ""}</td><td class="num">${x.hits ?? '<span class="muted">—</span>'}${(x.max ?? max) ? `<span class="muted">/${x.max ?? max}</span>` : ""}</td><td class="more-cell"><button class="more" data-attempt="${x.attemptId}" aria-label="Correct ${esc(x.name)}'s ${esc(stageName(e.stage))} score">⋯</button></td></tr>`,
      );
      return card(
        e,
        title(
          `${e.people.length} ${e.people.length === 1 ? "score" : "scores"} confirmed`,
          voidNote(e),
        ),
        scoreTable(e, rows),
      );
    }
    if (e.kind === "temp-detail")
      return card(
        e,
        title(
          `${esc(e.title)} built`,
          `${e.oneOff ? "One-off" : "Kept"} · ${e.people.length} firers${e.retired ? " · finished and dropped" : ""}`,
        ),
        `<div class="event-body"><p class="note">${esc(who(e))}</p></div>`,
      );
    if (e.kind === "redetail")
      return card(
        e,
        title(
          `${esc(e.title)} redetailed`,
          e.status === "canceled"
            ? "canceled"
            : e.status === "scored"
              ? "scored since"
              : "waiting to fire",
        ),
        `<div class="event-body"><p class="note">${esc(who(e))}</p></div>`,
      );
    if (e.kind === "operation")
      return card(
        e,
        title(esc(e.title), ""),
        `<div class="event-body"><p class="note">${esc([who(e), ...(e.lines ?? [])].filter(Boolean).join(" · "))}</p></div>`,
      );
    if (e.kind === "roster")
      return card(
        e,
        title("Nominal roll", esc(e.summary)),
        `<div class="event-body">${e.lines.map((l) => `<p class="note ${mark(l) ? "match" : ""}">${esc(l)}</p>`).join("")}</div>`,
      );
    // Setup notes: the one place a full date with the year belongs.
    return card(
      e,
      title(esc(e.title), ""),
      `<div class="event-body"><p class="note">${esc(stampLabel(e.at, true))}</p></div>`,
    );
  };
  // Everything in order by default; the buttons narrow it to one stage.
  const chips = [
      ["", "All"],
      ...(feed.some((e) => !e.stage) ? [["setup", "Setup"]] : []),
      ...stages(c)
        .filter((x) => feed.some((e) => e.stage === x.id))
        .map((x) => [x.id, x.label]),
    ],
    picked = historyFilter ?? "",
    inFilter = (e) =>
      !historyFilter ||
      (historyFilter === "setup" ? !e.stage : e.stage === historyFilter),
    list = shown.filter(inFilter);
  $("#main").innerHTML =
    shootHead(`<span class="spacer"></span>${searchBox()}`) +
    `<div class="history-feed"><div class="seg history-filter">${chips
      .map(
        ([key, label]) =>
          `<button data-history-filter="${esc(key)}" class="${picked === key ? "on" : ""}">${esc(label)}</button>`,
      )
      .join("")}</div>${
      list.length
        ? list.map(entry).join("")
        : empty(search ? "Nothing matches that name" : "Nothing here yet")
    }</div>`;
}
function renderSettings() {
  $("#main").innerHTML =
    `<div class="settings"><div class="heading"><h2>Settings</h2></div><label class="panel breakdown-toggle"><input id="require-breakdown" type="checkbox" ${store.requireBreakdown !== false ? "checked" : ""}> Require individual sub-stage scores</label>${Object.entries(
      PROGRAMS,
    )
      .map(([program, label]) => {
        const open = openPresets.has(program);
        return `<section class="preset ${open ? "open" : ""}"><div class="preset-head"><button class="expand" data-expand="${program}" aria-expanded="${open}">${label}</button></div><div class="preset-body">${presetBody(program)}</div></section>`;
      })
      .join("")}</div>`;
}
function thresholdInfo() {
  return "Redetailing lists a firer for a stage until their best score reaches its threshold, they reach Marksman, or they max the stage. These are the starting thresholds. Once any other stage is scored, a firer's threshold becomes their share of what they still need. Stage B starts at 7/8; targets adjust as other stage scores arrive.";
}
// A shoot type's settings: the rifle new participants start on, then one
// collapsible threshold section per rifle, since each has its own standard.
function presetBody(program) {
  const variant = program === "APS" ? apsView : "standard",
    key = `${program}|${variant}`,
    label = typeLabel(program, variant),
    pr = preset(store, program, variant),
    list = weaponsFor(program, variant),
    // A preset saved before a rifle option was renamed must not take the page
    // down with it.
    chosen = list.includes(pr.weapon) ? pr.weapon : list[0],
    rule = DETAIL_RULES[program],
    shoot = {
      program,
      variant,
      attempts: [],
      settings: {
        weapon: chosen,
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
                id = `target-${program}-${weapon}-${c.id}`.replace(/\W+/g, "-"),
                // Only Stage B of ATP and Combat Shoot ships a layout, so say
                // which stages still need one rather than leaving it to a click.
                parts = pr.breakdowns?.[`${weapon}:${c.id}`] ?? [];
              return `<div class="target-row"><label for="${id}">${esc(c.label)}</label><input id="${id}" data-threshold="${esc(`${key}|${weapon}|${c.id}`)}" type="number" min="0" max="${max}" step="1" inputmode="numeric" value="${target(shoot, p, c.id)}" aria-label="${esc(`${label} ${weapon} ${c.label}`)} threshold"><span class="muted">/${max}</span><button class="${parts.length ? "" : "unset"}" data-layout="${esc(`${key}|${weapon}|${c.id}`)}" aria-label="${esc(`${label} ${weapon} ${c.label}`)} sub-stages">${parts.length ? `${parts.length} sub-stages` : "Set sub-stages"}</button></div>`;
            })
            .join("")}</div>`
        : ""
    }</section>`;
  };
  return `${program === "APS" ? `<div class="seg" style="margin-bottom:14px"><button data-aps="standard" class="${apsView === "standard" ? "on" : ""}">APS</button><button data-aps="ns" class="${apsView === "ns" ? "on" : ""}">APS (NS)</button></div>` : ""}<div class="field inline rifle-type"><span>New participants start on</span>${list.length > 1 ? `<select data-default-weapon="${key}" aria-label="${esc(label)} default rifle">${option(list, chosen)}</select>` : `<strong>${esc(chosen)}</strong>`}</div>${rule ? `<p class="limit">${rule.min ? `${rule.min}–${rule.max} firers per detail. Up to ${rule.nonSAR} non-SAR21 weapons per detail. Stages A and C: detail hits ÷ firers, rounded down.` : ""}</p>` : ""}<p class="muted rifle-sets-head">Thresholds by rifle</p>${list.map(rifle).join("")}`;
}
function dialog(title, body, label, submit, closeLabel = "Close", onClose) {
  const d = $("#dialog"),
    buttons = Array.isArray(label) ? label : label ? [{ label }] : [];
  d.innerHTML = `<form id="dialog-form" novalidate><h2 id="dialog-title">${esc(title)}</h2>${body}<div class="error" role="alert"></div><div class="dialog-actions"><button type="button" id="close-dialog">${esc(closeLabel)}</button>${buttons.map((b, i) => `<button type="submit" ${b.value ? `value="${esc(b.value)}"` : ""} class="${b.danger ? "danger-solid" : i === buttons.length - 1 ? "primary" : ""}">${esc(b.label)}</button>`).join("")}</div></form>`;
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
        throw Error(
          `Not on the list: ${unknown.map((r) => r.name).join(", ")}.`,
        );
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
// How useful a firer is to a detail that needs lifting, best first: a strong
// shot the reshoot also carries to Marksman, then a strong shot who still needs
// the stage, then a strong shot with nothing left to gain, then everyone else,
// and poor shots last. The same order picks the plan and lays out the list.
const ROLES = [
  "Helps most · shoots well and a good score here makes them Marksman",
  "Helps · shoots well and still needs this stage",
  "Can help · already has the score they need here",
  "Can help · already maxed this stage, so it is pure charity",
  "Everyone else",
  "Needs help · build the detail around them",
  "Can help · Marksman already, so nothing in it for them",
];
function role(c, p, stage) {
  const max = p.profile.components.find((x) => x.id === stage).max;
  // Marksman is the end of the line, and a maxed stage cannot be improved, so
  // neither is anyone to build a detail around however they shoot.
  if (result(c, p).status === "Marksman") return 6;
  if (best(c, p, stage) === max) return 3;
  if (shootsPoorly(c, p, stage)) return 5;
  if (!isStrong(c, p, stage)) return 4;
  if (cleared(c, p, stage)) return 2;
  return goal(c, p, stage)?.objective === "marksman" ? 0 : 1;
}
// Ability and standing are separate things, so they get separate marks: how a
// firer shoots, and whether this stage still owes them anything.
function pickMarks(c, p, stage) {
  const badge = (text, tone, why) =>
      ` <span class="badge ${tone}" title="${esc(why)}">${text}</span>`,
    need = stageNeed(c, p, stage),
    marks = [];
  if (shootsPoorly(c, p, stage))
    marks.push(
      badge(
        "Weak",
        "red",
        `Shot under ${poorPace(p, stage)} of ${stageLabel(c, stage)}'s rounds, so they pull a detail's average down.`,
      ),
    );
  else if (isStrong(c, p, stage))
    marks.push(
      badge(
        "Strong",
        "green",
        `At or above the ${marksmanPace(p, stage)} that keeps them on course for Marksman.`,
      ),
    );
  if (result(c, p).status === "Marksman")
    marks.push(badge("Marksman", "blue", "Marksman on their total already."));
  else if (cleared(c, p, stage))
    marks.push(
      badge(
        "Cleared",
        "",
        `${stageLabel(c, stage)} has given them what they need, so they would be firing to help.`,
      ),
    );
  else
    marks.push(
      badge(
        `Needs ${stageLabel(c, stage)}`,
        "amber",
        `Still short of the ${need} they need from ${stageLabel(c, stage)}, so a reshoot counts for them too.`,
      ),
    );
  return marks.join("");
}
// Swapping the weakest of the chosen poor shots for the best shooters still
// free, how many can stay before the detail stops reaching what it is aiming
// at. Returns the sentence to show, or "" when the pick already works.
function poorAdvice(c, stage, chosen, poorPicked, aim, ids) {
  const hit = (p) => hitsRange(c, p, stage).low ?? best(c, p, stage) ?? 0,
    rest = chosen.filter((p) => !poorPicked.includes(p)),
    free = c.participants
      .filter(
        (p) =>
          !ids.includes(p.id) &&
          !committed(c, stage, p) &&
          !shootsPoorly(c, p, stage) &&
          hitsRange(c, p, stage).low !== null,
      )
      .toSorted((a, b) => hit(b) - hit(a)),
    total = (keep) =>
      rest.reduce((n, p) => n + hit(p), 0) +
      poorPicked.slice(0, keep).reduce((n, p) => n + hit(p), 0) +
      free.slice(0, poorPicked.length - keep).reduce((n, p) => n + hit(p), 0);
  for (let keep = poorPicked.length; keep >= 0; keep--) {
    if (poorPicked.length - keep > free.length) continue;
    if (Math.floor(total(keep) / chosen.length) < aim) continue;
    if (keep === poorPicked.length) return "";
    const drop = poorPicked.slice(keep).map((p) => p.name);
    return `On past scores this detail carries at most ${keep} poor ${keep === 1 ? "shot" : "shots"} and still averages ${aim}. Swapping ${names(drop)} for the best shooters still free would get it there.`;
  }
  return `Recorded bests project below ${aim} with this mix. You can retry for practice or consider different partners.`;
}
// A detail put together on the spot. Around a poor shooter it comes ready
// built; otherwise it starts empty. Firers already booked to fire this stage
// are flagged rather than blocked: two details sharing a firer can be done, but
// on the range it means one of them waits, so it should be a deliberate choice.
function manualDetailDialog(
  stage,
  around = null,
  picks = null,
  replacing = null,
) {
  const c = s(),
    label = stageLabel(c, stage),
    rule = DETAIL_RULES[c.program],
    plan = around ? buildAround(c, stage, around) : null,
    picked = picks ?? new Set(plan?.entries.map((e) => e.participantId) ?? []),
    max = stages(c).find((x) => x.id === stage).max,
    // What a firer is expected to put on the target: what they shot, or what
    // their detail's total proves they must have.
    hit = (p) => hitsRange(c, p, stage).low ?? best(c, p, stage),
    weakName = around && c.participants.find((p) => p.id === around).name;
  const groups =
    manualSort === "best"
      ? ROLES.map((name, i) => [
          name,
          c.participants
            .filter((p) => role(c, p, stage) === i)
            .toSorted((a, b) => (hit(b) ?? -1) - (hit(a) ?? -1)),
        ]).filter(([, people]) => people.length)
      : [
          // By detail is the roster as it stands, in its own order.
          ...stageDetails(c, stage)
            .filter((d) => !d.temporary)
            .map((d) => [d.name, members(c, d.id)]),
          ...(members(c, null).length
            ? [["Needs a detail", members(c, null)]]
            : []),
        ];
  const row = (p) =>
    `<div class="manual-row ${picked.has(p.id) ? "on" : ""}"><label class="manual-pick"><input type="checkbox" name="pick" value="${p.id}" aria-label="Include ${esc(p.name)}" ${personSkipped(c, p, stage) ? "disabled" : ""} ${picked.has(p.id) ? "checked" : ""}><span>${esc(p.name)}${personSkipped(c, p, stage) ? " · skipped" : ""}${pickMarks(c, p, stage)}${committed(c, stage, p) ? ' <span class="muted">· already booked</span>' : ""}</span></label><span class="rifle">${esc(p.weapon)}</span></div>`;
  // Why this plan is what it is, and whether waiting would give a better one.
  const advisories = [];
  if (plan?.short)
    advisories.push(
      `Only ${plan.people.length} ${plan.people.length === 1 ? "firer is" : "firers are"} free and a detail takes ${rule.min}. Add more by hand, or wait for a detail to finish.`,
    );
  if (plan?.waitFor.length)
    advisories.push(
      `A stronger detail is possible later. ${names(plan.waitFor.map((x) => x.name))} ${plan.waitFor.length === 1 ? "shoots" : "shoot"} better and still ${plan.waitFor.length === 1 ? "needs" : "need"} ${label}, so they would lift the average more — but they are already in a detail waiting to fire. Wait for that detail to finish, or go ahead with this one.`,
    );
  dialog(
    around
      ? `Detail around ${weakName} · ${label}`
      : `Manual detail · ${label}`,
    `<p class="note">${
      around
        ? `Suggested partners based on recorded scores, with firers who still need ${esc(label)} first. Past scores may not repeat. You can change this mix or retry the original detail.`
        : `Choose who fires together. The detail appears in ${esc(label)} so you can enter its scores.`
    }</p>${advisories.map((x) => `<p class="note warn-note">${esc(x)}</p>`).join("")}<div class="seg manual-seg">${[
      ["detail", "By detail"],
      ["best", "Best shooters first"],
    ]
      .map(
        ([key, text]) =>
          `<button type="button" data-sort="${key}" class="${manualSort === key ? "on" : ""}">${text}</button>`,
      )
      .join(
        "",
      )}</div><div class="manual-list">${groups.map(([name, people]) => `<div class="manual-group"><h3>${esc(name)}</h3>${matchFirst(people).map(row).join("")}</div>`).join("")}</div><p class="note manual-summary">No firers chosen.</p><p class="note warn-note manual-carry" hidden></p><p class="note warn-note manual-warn" hidden></p>${around ? `<div class="rest-plan" hidden><label class="chk"><input type="checkbox" name="rest" checked> <span class="rest-title"></span></label><p class="note rest-text"></p></div>` : ""}<p class="note">A one-off is dropped once its scores are in; a kept detail can be redetailed.</p>`,
    [
      { label: "Keep as a detail", value: "keep" },
      { label: "One-off detail", value: "once" },
    ],
    (f, action) => {
      const entries = f.getAll("pick").map((id) => ({
          participantId: id,
          weapon: c.participants.find((p) => p.id === id).weapon,
        })),
        oneOff = action === "once",
        d = createTempDetail(c, stage, entries, { oneOff, replacing }),
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
    chosenIds = () =>
      [...form.querySelectorAll("[name=pick]")]
        .filter((b) => b.checked)
        .map((b) => b.value),
    update = () => {
      const ids = chosenIds(),
        entries = ids.map((id) => ({
          participantId: id,
          weapon: c.participants.find((p) => p.id === id).weapon,
        }));
      for (const box of form.querySelectorAll("[name=pick]"))
        box.closest(".manual-row").classList.toggle("on", box.checked);
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
      // What this detail has to average to clear whoever still needs the
      // stage, and what it looks like it will manage.
      const chosen = ids.map((id) => c.participants.find((p) => p.id === id)),
        needing = chosen.filter((p) => !cleared(c, p, stage)),
        aim = needing.length
          ? Math.max(...needing.map((p) => stageNeed(c, p, stage)))
          : null,
        known = chosen.map(hit),
        expected =
          ids.length && known.every((v) => v !== null)
            ? Math.floor(known.reduce((a, b) => a + b, 0) / ids.length)
            : null,
        room = rule ? rule.max - ids.length : 0,
        lines = [`${ids.length} firers chosen.`];
      if (aim !== null)
        lines.push(
          `Aiming for ${aim}/${max}, what ${needing.length === 1 ? `${needing[0].name} still needs` : "the firers who still need it ask for"}.`,
        );
      if (expected !== null)
        lines.push(
          `Average if recorded bests repeat from their best hits: ${expected}/${max}.`,
        );
      if (room > 0)
        lines.push(
          `Room for ${room} more; a fuller detail spreads a poor shot's hits further.`,
        );
      form.querySelector(".manual-summary").textContent = ids.length
        ? lines.join(" ")
        : "No firers chosen.";
      // How many of these particular poor shots the detail can carry and still
      // land on its aim, given who is left to swap them for.
      const carry = form.querySelector(".manual-carry"),
        poorPicked = chosen
          .filter((x) => shootsPoorly(c, x, stage))
          .toSorted((a, b) => (hit(b) ?? 0) - (hit(a) ?? 0)),
        message =
          aim === null || expected === null || !poorPicked.length
            ? ""
            : poorAdvice(c, stage, chosen, poorPicked, aim, ids);
      carry.hidden = !message;
      carry.textContent = message;
      // Two details cannot put the same firer on the point at once.
      const clash = overlapping(
          replacing
            ? {
                ...c,
                dispatches: c.dispatches.filter(
                  (d) => d.key !== `detail:${replacing}`,
                ),
              }
            : c,
          stage,
          ids,
        ),
        warn = form.querySelector(".manual-warn");
      warn.hidden = !clash.length;
      warn.textContent = clash.length
        ? `${names(clash.map((p) => p.name))} ${clash.length === 1 ? "is" : "are"} unavailable or already assigned for ${label}. Unskip them or cancel their other assignment first.`
        : "";
      // Who is left of the weak firer's detail, and the detail they get.
      const box = form.querySelector(".rest-plan");
      if (box) {
        const rest = planRest(c, stage, around, ids);
        box.hidden = !rest;
        if (rest) {
          const list = (people) => people.map((p) => p.name).join(", "),
            own = rest.people.filter((p) => !rest.fillIns.includes(p));
          form.querySelector(".rest-title").textContent =
            `Also make a detail for the rest of ${rest.from.name}`;
          form.querySelector(".rest-text").textContent = rest.short
            ? `${list(own)} still need ${label}, but there are not enough good shooters to make a detail with them. Make one by hand.`
            : `${list(own)} fire without ${weakName}.${rest.fillIns.length ? ` ${list(rest.fillIns)} ${rest.fillIns.length === 1 ? "joins" : "join"} to make ${rest.people.length}.` : ""}${rest.expected !== null ? ` Average if recorded bests repeat: ${rest.expected}/${max}.` : ""}`;
          box.querySelector("[name=rest]").disabled = rest.short;
        }
      }
      form.querySelector(".error").textContent = ids.length
        ? problems.join("\n")
        : "";
    };
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  // Re-sorting keeps whoever is already picked.
  for (const b of form.querySelectorAll("[data-sort]"))
    b.onclick = () => {
      manualSort = b.dataset.sort;
      manualDetailDialog(stage, around, new Set(chosenIds()), replacing);
    };
  update();
}
// The ⋯ menu on a stage tab: history, and sighting where the shoot has one.
function personDialog(id) {
  const c = s(),
    p = c.participants.find((x) => x.id === id),
    stage = tab.startsWith("stage:") ? tab.split(":")[1] : null,
    // Combat Shoot Stage B may be fired on another rifle.
    swappable = stage && isCS(c) && !detailedStage(c, stage),
    // A redetail that has not been scored yet can be taken back.
    sent =
      stage &&
      c.dispatches.find(
        (d) =>
          d.stage === stage &&
          d.status === "awaiting" &&
          d.roster.some((m) => m.id === p.id),
      ),
    scored = stage && best(c, p, stage) !== null,
    // Skipping is uncommon, so it lives in here rather than on every row, and
    // it applies to this stage alone. Hits already typed for this stage are
    // held back first, so a skip cannot quietly strand them.
    skipped = personSkipped(c, p, stage),
    typed =
      stage &&
      (entryValue(c, stage, p) !== "" ||
        (c.entryParts?.[`${stage}:${p.id}`] ?? []).some((v) => v !== ""));
  dialog(
    p.name,
    `<p class="note">${esc(stage && isCS(c) ? stageRifle(c, p, stage) : p.weapon)}${isCS(c) ? "" : ` · ${esc(p.profile.components.map((x) => `${x.label} ${ratio(best(c, p, x.id), x.max)}`).join(" · "))}`}</p>${swappable ? `<label class="field inline"><span>Rifle for ${esc(stageLabel(c, stage))}</span><select id="swap-rifle" ${scored ? "disabled" : ""}>${option(weapons(c), stageRifle(c, p, stage))}</select></label>${scored ? '<p class="note">Already scored this stage, so the rifle is fixed. Edit the score in History to change it.</p>' : ""}` : ""}<div class="actions"><button type="button" id="history">History</button>${p.profile.excluded?.length ? '<button type="button" id="sighting">Sighting</button>' : ""}${sent ? `<button type="button" id="undetail" title="Cancel this redetail and put them back in the Redetailing list">Cancel redetail</button>` : ""}${stage ? `<button type="button" id="person-skip" ${typed ? "disabled" : ""} title="${typed ? "Clear the hits typed for this stage first." : skipped ? `Put ${esc(p.name)} back in ${esc(stageLabel(c, stage))}` : `${esc(p.name)} is not firing ${esc(stageLabel(c, stage))}`}">${skipped ? "Unskip" : "Skip"} ${esc(stageLabel(c, stage))}</button>` : ""}</div>`,
    null,
    null,
    "Close",
  );
  $("#history").onclick = () => historyDialog(p);
  if ($("#person-skip"))
    $("#person-skip").onclick = () => {
      setPersonSkipped(c, p.id, stage, !skipped);
      save();
      $("#dialog").close();
      render();
      toast(
        skipped
          ? `${p.name} is firing ${stageLabel(c, stage)} again.`
          : `${p.name} is not firing ${stageLabel(c, stage)}.`,
      );
    };
  if ($("#undetail"))
    $("#undetail").onclick = () => {
      cancelDispatch(c, sent.id);
      save();
      $("#dialog").close();
      render();
      toast(`${p.name} is back in the Redetailing list.`);
    };
  if ($("#sighting")) $("#sighting").onclick = () => sightingDialog(p);
  if ($("#swap-rifle"))
    $("#swap-rifle").onchange = (ev) => {
      c.stageRifles ??= {};
      c.stageRifles[`${p.id}:${stage}`] = ev.target.value;
      save();
      render();
      toast(`${p.name}: ${ev.target.value} for ${stageLabel(c, stage)}.`);
    };
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
function historyDialog(p, back) {
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
          return `<div class="history-row ${a.status === "void" ? "void" : ""}"><div><b>${esc(stageLabel(c, a.stage))} · ${number ? `attempt ${number}` : "not counted"} · ${ratio(a.score, max)}</b> ${a.status === "void" ? badge(a.revisedBy ? "Edited" : "Voided") : ""}<p>${esc(source)}${roster ? `<br>With: ${roster}` : ""}${a.breakdown?.length ? `<br>${esc(breakdownText(a.breakdown))}` : ""}<br>${esc(stampLabel(a.recordedAt))}${a.correction ? `<br>${esc(a.correction.reason)}` : ""}</p></div>${a.status === "valid" ? `<div class="actions"><button type="button" data-edit="${a.id}">Edit</button><button type="button" class="danger" data-correct="${a.id}">Void</button></div>` : !a.detailAttemptId && restorable(c, a.id) ? `<div class="actions"><button type="button" data-unvoid="${a.id}">Restore</button></div>` : ""}</div>`;
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
    null,
    back ? "Back" : "Close",
    back,
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
            shared = c.shared.find((x) => x.id === a.detailAttemptId),
            withThem = shared
              ? shared.roster.filter((m) => m.id !== p.id).map((m) => m.name)
              : [];
          dialog(
            "Void score",
            `${withThem.length ? `<p class="note warn-note">This is a detail score. Voiding it takes ${esc(stageLabel(c, a.stage))} away from everyone who fired it, not just ${esc(p.name)}: ${esc(names(withThem))} lose it too.</p>` : ""}<label class="field"><span>Reason</span><input name="reason" required autofocus></label>`,
            [{ label: "Void score", danger: true }],
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
    .querySelectorAll("[data-unvoid]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const a = c.attempts.find((x) => x.id === b.dataset.unvoid);
          restoreDialog(c, {
            id: a.id,
            title: p.name,
            stage: a.stage,
            score: a.score,
            max: a.profile.components.find((x) => x.id === a.stage).max,
            was: a.correction?.reason,
            back: () => historyDialog(p, back),
            done: () => {
              render();
              historyDialog(p, back);
            },
          });
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
// From the roster there is no stage in hand, so a detail's menu offers the
// stages it has fired. Each one opens its scores, where they can be corrected.
function detailMenu(detailId) {
  const c = s(),
    d = c.details.find((x) => x.id === detailId),
    scored = stages(c).filter(
      (x) =>
        detailedStage(c, x.id) &&
        detailAttempts(c, detailId, x.id).some((a) => a.status === "valid"),
    );
  dialog(
    d.name,
    scored.length
      ? `<p class="note">Open a stage to edit or void what this detail scored. Voiding takes the score from every firer who fired it, which is what has to happen before anyone in the detail can change rifle or move.</p><div class="actions">${scored.map((x) => `<button type="button" data-stage-scores="${x.id}">${esc(x.label)} scores</button>`).join("")}</div>`
      : '<p class="note">No scores recorded for this detail yet.</p>',
    null,
    null,
    "Close",
  );
  for (const b of $("#dialog").querySelectorAll("[data-stage-scores]"))
    b.onclick = () =>
      detailHistoryDialog(detailId, b.dataset.stageScores, () =>
        detailMenu(detailId),
      );
}
// Putting a score back changes what a firer is graded on, so it is confirmed
// the way voiding is: what was voided and why, and a reason for undoing it.
function restoreDialog(c, { id, title, stage, score, max, was, back, done }) {
  dialog(
    `Restore ${title} · ${stageLabel(c, stage)}`,
    `<p class="note warn-note">This score was voided${was ? ` · ${esc(was)}` : ""}. Restoring puts ${ratio(score, max)} back into their record, and back into their total.</p><label class="field"><span>Reason for restoring</span><input name="reason" required autofocus></label>`,
    "Restore score",
    (f) => {
      unvoidAttempt(c, id, f.get("reason"));
      save();
      done();
      toast(`${title} restored.`);
    },
    "Back",
    back,
  );
}
// A single recorded score, corrected on its own. A score fired as part of a
// detail never reaches here: it belongs to everyone who fired it, so it is
// corrected from the detail and they all move together.
function scoreEventDialog(attemptId) {
  const c = s(),
    a = c.attempts.find((x) => x.id === attemptId);
  if (!a) return;
  const p = c.participants.find((x) => x.id === a.participantId),
    max = a.profile.components.find((x) => x.id === a.stage).max,
    number = p ? attemptNumbers(c, p).get(a.id) : null,
    live = a.status === "valid" && !a.detailAttemptId,
    done = () => {
      $("#dialog").close();
      render();
    };
  dialog(
    `${p?.name ?? "Removed firer"} · ${stageLabel(c, a.stage)}`,
    `<p class="note">${ratio(a.score, max)} · ${esc(a.weapon)}${number ? ` · attempt ${number}` : ""}<br>${esc(stampLabel(a.recordedAt))}</p>${
      a.status === "valid"
        ? ""
        : `<p class="note warn-note">Already voided${a.correction?.reason ? ` · ${esc(a.correction.reason)}` : ""}.</p>`
    }${
      a.detailAttemptId
        ? '<p class="note warn-note">Fired as part of a detail, so it cannot be corrected on its own. Open the detail\'s score and every firer in it moves together.</p>'
        : ""
    }<div class="actions">${live ? '<button type="button" id="edit-score">Edit</button><button type="button" class="danger" id="void-score">Void</button>' : ""}${restorable(c, a.id) && !a.detailAttemptId ? '<button type="button" id="unvoid-score">Restore this score</button>' : ""}</div>`,
    null,
    null,
    "Close",
  );
  if (restorable(c, a.id) && !a.detailAttemptId)
    $("#unvoid-score").onclick = () =>
      restoreDialog(c, {
        id: a.id,
        title: p?.name ?? "this score",
        stage: a.stage,
        score: a.score,
        max,
        was: a.correction?.reason,
        back: () => scoreEventDialog(attemptId),
        done,
      });
  if (!live) return;
  $("#edit-score").onclick = () => editScoreDialog(p, a, done);
  $("#void-score").onclick = () =>
    dialog(
      `Void ${p?.name ?? "this score"} · ${stageLabel(c, a.stage)}`,
      `<p class="note">This removes ${ratio(a.score, max)} from their record. It stays in History, struck through.</p><label class="field"><span>Reason</span><input name="reason" required autofocus></label>`,
      [{ label: "Void score", danger: true }],
      (f) => {
        voidAttempt(c, a.id, f.get("reason"));
        save();
        done();
      },
      "Back",
      () => scoreEventDialog(attemptId),
    );
}
// Editing an individual score, including the rifle where a stage allows a change.
function editPartsInputs(parts, saved, id) {
  if (!parts.length)
    return '<p class="errors">Configure this stage in Settings before adding a breakdown.</p>';
  return `<div class="subscores">${parts.map((p, i) => `<label>${esc(p.label)} /${p.max}<input name="part-${id}-${i}" type="number" min="0" max="${p.max}" step="1" value="${saved?.[i]?.hits ?? ""}" aria-label="${esc(p.label)} hits for ${id}"></label>`).join("")}</div>`;
}
function editScoreDialog(p, a, done) {
  const c = s(),
    max = a.profile.components.find((x) => x.id === a.stage).max,
    withParts = c.settings.requireBreakdown || a.breakdown?.length,
    parts = breakdownFor(c, a.weapon, a.stage);
  dialog(
    `Edit ${p.name} · ${stageLabel(c, a.stage)}`,
    `${withParts ? editPartsInputs(parts, a.breakdown, p.id) : ""}<label class="field"><span>Hits /${max}</span><input name="hits" type="number" min="0" max="${max}" step="1" value="${a.score}" ${withParts ? "readonly" : ""} required autofocus></label>${isCS(c) ? `<label class="field"><span>Rifle</span><select name="weapon">${option(weapons(c), a.weapon)}</select></label>` : `<p class="note">${esc(a.weapon)}</p>`}`,
    "Save score",
    (f) => {
      editIndividual(
        c,
        a.id,
        f.get("hits"),
        f.get("weapon") || a.weapon,
        withParts ? parts.map((_, i) => f.get(`part-${p.id}-${i}`)) : undefined,
      );
      save();
      if (done) return done();
      render();
      historyDialog(p);
    },
    "Back",
    done ?? (() => historyDialog(p)),
  );
}
// A detail's own history: every score confirmed for it, newest first, each one
// editable or voidable the way an individual's attempts are.
function detailHistoryDialog(detailId, stage, back) {
  const c = s(),
    d = c.details.find((x) => x.id === detailId),
    list = detailAttempts(c, detailId, stage),
    numbers = detailAttemptNumbers(c, detailId, stage),
    max = stages(c).find((x) => x.id === stage).max,
    here = () => detailHistoryDialog(detailId, stage, back),
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
          return `<div class="history-row ${a.status === "void" ? "void" : ""}"><div><b>${number ? `Attempt ${number}` : "Not counted"} · ${ratio(a.score, max)}</b> ${a.status === "void" ? badge(a.revisedBy || list.some((x) => x.revisionOf === a.id) ? "Edited" : "Voided") : ""}<p>${esc(a.inputMode === "aggregate" ? `Detail total ${a.aggregateHits} over ${a.divisor} firers` : `${hits} · total ${a.aggregateHits} over ${a.divisor} firers`)}${a.breakdown?.length ? `<br>${esc(breakdownText(a.breakdown))}` : ""}<br>${esc(stampLabel(a.recordedAt))}${a.correction ? `<br>${esc(a.correction.reason)}` : ""}</p></div>${a.status === "valid" ? `<div class="actions"><button type="button" data-edit-detail="${a.id}">Edit</button><button type="button" class="danger" data-void-detail="${a.id}">Void</button></div>` : restorable(c, c.attempts.find((x) => x.detailAttemptId === a.id)?.id) ? `<div class="actions"><button type="button" data-unvoid-detail="${a.id}">Restore</button></div>` : ""}</div>`;
        })
        .join("") +
      (!list.length && !waitingOn.length
        ? '<p class="note">No scores confirmed for this detail yet.</p>'
        : ""),
    null,
    null,
    back ? "Back" : "Close",
    back,
  );
  const box = $("#dialog");
  box
    .querySelectorAll("[data-edit-detail]")
    .forEach(
      (b) => (b.onclick = () => editDetailDialog(b.dataset.editDetail, here)),
    );
  box.querySelectorAll("[data-void-detail]").forEach(
    (b) =>
      (b.onclick = () => {
        const a = c.attempts.find(
          (x) => x.detailAttemptId === b.dataset.voidDetail,
        );
        const record = c.shared.find((x) => x.id === b.dataset.voidDetail);
        dialog(
          "Void detail score",
          `<p class="note warn-note">This takes ${esc(stageLabel(c, stage))} away from all ${record.roster.length} firers who fired it: ${esc(names(record.roster.map((m) => m.name)))}.</p><label class="field"><span>Reason</span><input name="reason" required autofocus></label>`,
          [{ label: "Void score", danger: true }],
          (f) => {
            voidAttempt(c, a.id, f.get("reason"));
            save();
            render();
            here();
          },
          "Back",
          here,
        );
      }),
  );
  box.querySelectorAll("[data-unvoid-detail]").forEach(
    (b) =>
      (b.onclick = () => {
        const record = c.shared.find((x) => x.id === b.dataset.unvoidDetail),
          first = c.attempts.find(
            (x) => x.detailAttemptId === b.dataset.unvoidDetail,
          );
        restoreDialog(c, {
          id: first.id,
          title: d ? d.name : "this detail",
          stage,
          score: record.score,
          max,
          was: first.correction?.reason,
          back: here,
          done: () => {
            render();
            here();
          },
        });
      }),
  );
  box.querySelectorAll("[data-cancel]").forEach(
    (b) =>
      (b.onclick = () => {
        cancelDispatch(c, b.dataset.cancel);
        save();
        render();
        here();
      }),
  );
}
// One recorded detail score. The entry in History already said which one, so
// there is nothing to pick here: edit it, void it, or put it back. Every firer
// who fired it moves together.
function detailEventDialog(detailAttemptId) {
  const c = s(),
    d = c.shared.find((x) => x.id === detailAttemptId);
  if (!d) return;
  const detail = c.details.find((x) => x.id === d.detailId),
    max = stages(c).find((x) => x.id === d.stage)?.max ?? null,
    number = detailAttemptNumbers(c, d.detailId, d.stage).get(d.id),
    reason = c.attempts.find((x) => x.detailAttemptId === d.id)?.correction
      ?.reason,
    live = d.status === "valid",
    done = () => {
      $("#dialog").close();
      render();
    };
  dialog(
    `${detail?.name ?? "Detail"} · ${stageLabel(c, d.stage)}`,
    `<p class="note">${ratio(d.score, max)} over ${d.divisor} firers${number ? ` · attempt ${number}` : ""}<br>${esc(stampLabel(d.recordedAt))}</p><p class="note">${esc(d.inputMode === "aggregate" ? `Confirmed on the detail total ${d.aggregateHits}.` : d.roster.map((m) => `${m.name} ${m.rawHits ?? "—"}`).join(", "))}</p>${
      live
        ? `<p class="note warn-note">Voiding takes ${esc(stageLabel(c, d.stage))} away from all ${d.roster.length} firers who fired it: ${esc(names(d.roster.map((m) => m.name)))}.</p>`
        : `<p class="note warn-note">Voided${reason ? ` · ${esc(reason)}` : ""}.</p>`
    }<div class="actions">${live ? '<button type="button" id="edit-detail-score">Edit</button><button type="button" class="danger" id="void-detail-score">Void</button>' : ""}${restorable(c, c.attempts.find((x) => x.detailAttemptId === d.id)?.id) ? '<button type="button" id="unvoid-detail-score">Restore this score</button>' : ""}</div>`,
    null,
    null,
    "Close",
  );
  const first = c.attempts.find((x) => x.detailAttemptId === d.id);
  if (restorable(c, first?.id))
    $("#unvoid-detail-score").onclick = () =>
      restoreDialog(c, {
        id: first.id,
        title: detail?.name ?? "this detail",
        stage: d.stage,
        score: d.score,
        max,
        was: reason,
        back: () => detailEventDialog(detailAttemptId),
        done,
      });
  if (!live) return;
  $("#edit-detail-score").onclick = () => editDetailDialog(d.id, done);
  $("#void-detail-score").onclick = () =>
    dialog(
      `Void ${detail?.name ?? "detail"} · ${stageLabel(c, d.stage)}`,
      `<p class="note warn-note">All ${d.roster.length} firers lose this score: ${esc(names(d.roster.map((m) => m.name)))}. It stays in History, struck through, and can be put back.</p><label class="field"><span>Reason</span><input name="reason" required autofocus></label>`,
      [{ label: "Void score", danger: true }],
      (f) => {
        voidAttempt(c, first.id, f.get("reason"));
        save();
        done();
      },
      "Back",
      () => detailEventDialog(detailAttemptId),
    );
}
// Editing a detail's score: each firer's hits, or the detail total. Clearing a
// firer's hits takes them out of the record.
function editDetailDialog(detailAttemptId, back) {
  const c = s(),
    shared = c.shared.find((d) => d.id === detailAttemptId),
    detail = c.details.find((d) => d.id === shared.detailId),
    withParts =
      c.settings.requireBreakdown ||
      shared.roster.some((m) => m.breakdown?.length),
    max = shared.roster[0].profile.components.find(
      (x) => x.id === shared.stage,
    ).max;
  dialog(
    `Edit ${detail ? detail.name : "detail"} · ${stageLabel(c, shared.stage)}`,
    `<p class="note">Enter every firer's hits, or only the detail total.</p><div class="manual-list">${shared.roster
      .map(
        (m) =>
          `<div class="manual-row on"><span class="manual-pick">${esc(m.name)}</span><span class="rifle">${esc(m.weapon)}</span>${withParts ? editPartsInputs(breakdownFor(c, m.weapon, shared.stage), m.breakdown, m.id) : ""}<input ${withParts ? "readonly" : ""} type="number" name="hits-${m.id}" min="0" max="${max}" step="1" value="${m.rawHits ?? ""}" placeholder="—" aria-label="${esc(m.name)} hits"></div>`,
      )
      .join(
        "",
      )}</div><label class="field inline"><span>Or detail total</span><input ${withParts ? "disabled" : ""} type="number" name="aggregate" min="0" step="1" value="${shared.inputMode === "aggregate" ? shared.aggregateHits : ""}" placeholder="—" aria-label="Detail total hits"></label>`,
    "Save scores",
    (f) => {
      const entries = shared.roster.map((m) => ({
        participantId: m.id,
        weapon: m.weapon,
        hits: f.get(`hits-${m.id}`) ?? "",
        parts: withParts
          ? breakdownFor(c, m.weapon, shared.stage).map((_, i) =>
              f.get(`part-${m.id}-${i}`),
            )
          : undefined,
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
        if (!file?.name) throw Error("Choose a backup file.");
        if (file.size > 20000000) throw Error("Maximum backup size is 20 MB.");
        const incoming = validateStore(JSON.parse(await file.text()));
        const report = importBackup(store, incoming);
        save();
        $("#dialog").close();
        tab = "shoots";
        render();
        toast(
          `${plural(report.added, "shoot")} added, ${report.updated} updated, ${plural(report.kept, "local shoot")} kept (older or conflicting copies).`,
        );
      } catch (e) {
        $("#dialog .error").textContent = e.message;
      }
    },
  );
}
$("#tabs").onclick = (e) => {
  const b = e.target.closest("[data-tab]");
  if (!b) return;
  const previous = tab;
  tab = b.dataset.tab;
  if (tab === "shoots") openedShoot = false;
  addMode = null;
  selected.clear();
  // The tab row is redrawn before the page below it, so a failure there would
  // otherwise light up the tab and leave the old page sitting underneath.
  try {
    render();
  } catch (err) {
    tab = previous;
    try {
      render();
    } catch (again) {}
    toast(`${b.textContent} could not open: ${err.message}`);
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
  if (t.dataset.partPerson) {
    const stage = tab.split(":")[1];
    requireActiveStage(c, stage);
    const id = t.dataset.partPerson,
      p = c.participants.find((p) => p.id === id),
      detail = t.dataset.partDetail,
      weapon = detail ? rosterWeapon(c, detail, p) : stageRifle(c, p, stage),
      parts = breakdownFor(c, weapon, stage);
    c.entryParts ??= {};
    const row = detail
        ? getDraft(c, detail, stage).rows.find((r) => r.participantId === id)
        : null,
      values = detail
        ? (row.parts ??= parts.map(() => ""))
        : (c.entryParts[`${stage}:${id}`] ??= parts.map(() => ""));
    const index = Number(t.dataset.partIndex);
    values[index] = t.value;
    // Mark a bad box as it is typed rather than waiting for Confirm.
    if (invalidPart(t.value, parts[index]))
      t.setAttribute("aria-invalid", "true");
    else t.removeAttribute("aria-invalid");
    let total = "";
    try {
      total = String(parseBreakdown(c, weapon, stage, values).total);
    } catch {}
    const panel = t.closest(".score-panel"),
      totalInput = panel.querySelector(
        `[${detail ? "data-cs-hits" : "data-hits"}="${id}"]`,
      );
    totalInput.value = total;
    if (detail) {
      row.hits = total;
      const draft = getDraft(c, detail, stage);
      draft.aggregate = "";
      draft.autoTotal = true;
      draft.updatedAt = now();
      refreshDraft(panel, c, draft);
    } else {
      c.entries ??= {};
      c.entries[`${stage}:${id}`] = total;
    }
    c.updatedAt = now();
    save();
    return;
  }
  if (t.dataset.hits) {
    holdHit(t, tab.split(":")[1]);
    return;
  }
  if (t.matches("[data-cs-hits],[data-aggregate]")) {
    requireActiveStage(c, tab.split(":")[1]);
    const panel = t.closest("[data-detail]"),
      draft = getDraft(c, panel.dataset.detail, tab.split(":")[1]);
    if (t.dataset.csHits) {
      draft.rows.find((r) => r.participantId === t.dataset.csHits).hits =
        t.value;
      // The total follows the hits until someone types their own. It is a
      // total of credited hits, so a rifle issued more rounds than the stage
      // counts adds only what can be credited.
      if (draft.autoTotal !== false) {
        const all = draft.rows.every((r) => /^\d+$/.test(r.hits));
        draft.aggregate = all
          ? String(
              draft.rows.reduce(
                (n, r) =>
                  n +
                  creditedHits(c, panel.dataset.detail, tab.split(":")[1], r),
                0,
              ),
            )
          : "";
        const box = panel.querySelector("[data-aggregate]");
        if (box) box.value = draft.aggregate;
      }
    } else {
      draft.aggregate = t.value;
      draft.autoTotal = t.value === "" ? undefined : false;
    }
    draft.updatedAt = now();
    c.updatedAt = draft.updatedAt;
    save();
    refreshDraft(panel, c, draft);
    syncSkips();
  }
});
$("#main").addEventListener(
  "toggle",
  (e) => {
    const event = e.target.dataset?.event;
    if (!event) return;
    if (e.target.open) openEvents.add(event);
    else openEvents.delete(event);
  },
  true,
);
$("#main").addEventListener("dragstart", (e) => {
  const row = e.target.closest?.("[data-drag]");
  if (!row) return;
  dragging = row.dataset.drag;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", dragging);
  row.classList.add("dragging");
});
function clearDrag() {
  dragging = null;
  dragOver = null;
  for (const el of document.querySelectorAll(".drop-here, .drop-before"))
    el.classList.remove("drop-here", "drop-before");
}
$("#main").addEventListener("dragend", (e) => {
  e.target.closest?.("[data-drag]")?.classList.remove("dragging");
  clearDrag();
});
$("#main").addEventListener("dragover", (e) => {
  const row = e.target.closest?.("[data-drop-row]"),
    panel = e.target.closest?.("[data-drop]");
  if (!dragging || (!row && !panel)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  // A row marks the place the firer lands; a panel marks the detail itself.
  const mark = row && row.dataset.dropRow !== dragging ? row : panel;
  if (mark === dragOver) return;
  for (const el of document.querySelectorAll(".drop-here, .drop-before"))
    el.classList.remove("drop-here", "drop-before");
  dragOver = mark;
  if (mark) mark.classList.add(mark === row ? "drop-before" : "drop-here");
});
$("#main").addEventListener("drop", (e) => {
  const row = e.target.closest?.("[data-drop-row]"),
    panel = e.target.closest?.("[data-drop]"),
    id = dragging || e.dataTransfer.getData("text/plain");
  if ((!row && !panel) || !id) return;
  e.preventDefault();
  clearDrag();
  const c = s(),
    before = row && row.dataset.dropRow !== id ? row.dataset.dropRow : null,
    home = before && c.participants.find((x) => x.id === before),
    detail = c.details.find(
      (d) => d.id === (home ? home.detailId : panel?.dataset.drop),
    );
  try {
    assignDetail(c, id, detail ? detailNumber(detail) : null);
    if (before) orderParticipant(c, id, before);
    save();
    render();
  } catch (err) {
    toast(err.message);
  }
});
$("#main").addEventListener("keydown", (e) => {
  const t = e.target;
  // Enter on a detail's empty row adds that firer, the way a phone keyboard
  // sends it. Blurring commits the value and the row is redrawn and refocused.
  if (e.key === "Enter" && t.dataset?.addTo) {
    e.preventDefault();
    t.blur();
    return;
  }
  // Tab goes from score box to score box, past rifles, Skip and menus.
  if (
    e.key === "Tab" &&
    !e.altKey &&
    !e.metaKey &&
    !e.ctrlKey &&
    t.matches(
      "[data-part-person],[data-hits]:not([readonly]),[data-cs-hits]:not([readonly]),[data-aggregate]",
    )
  ) {
    const boxes = [
        ...$("#main").querySelectorAll(
          ":is([data-part-person],[data-hits]:not([readonly]),[data-cs-hits]:not([readonly]),[data-aggregate]):not(:disabled)",
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
  if (
    e.key !== "Enter" ||
    !t.matches(
      "[data-part-person],[data-hits]:not([readonly]),[data-cs-hits]:not([readonly]),[data-aggregate]",
    )
  )
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
    if (t.id === "require-breakdown") {
      store.requireBreakdown = t.checked;
      applyPresets(store);
      save();
      render();
      return;
    }
    if (t.id === "shoot-type") {
      const [program, variant] = t.value.split("|");
      changeShootType(c, program, variant);
      applyPreset(store, c);
      save();
      render();
      toast(`Shoot type changed to ${typeLabel(program, variant)}.`);
      if (isCS(c) && c.participants.length && !c.details.length)
        detailPicker(c);
    } else if (t.id === "order") {
      animateQueue(() => {
        c.settings.order = t.value;
        save();
      });
    } else if (t.dataset.queue) {
      t.checked
        ? selected.add(t.dataset.queue)
        : selected.delete(t.dataset.queue);
      updateRedetailButton(stage);
    } else if (t.dataset.addTo) {
      const name = t.value.trim();
      if (!name) return;
      addParticipants(
        c,
        name,
        baseWeapons(c.program, c.variant)[0],
        t.dataset.addTo,
      );
      save();
      render();
      $(`[data-add-to="${t.dataset.addTo}"]`)?.focus();
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
      later(render);
    } else if (t.dataset.defaultWeapon) {
      const [program, variant] = t.dataset.defaultWeapon.split("|");
      preset(store, program, variant).weapon = t.value;
      save();
      later(render);
    }
  } catch (err) {
    render();
    fieldError(t, err.message);
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
      openedShoot = true;
      tab = "participants";
      search = "";
      selected.clear();
      save();
      render();
      return;
    }
  } catch (err) {
    const box = e.target.querySelector(".error");
    if (box) box.textContent = err.message;
    else toast(err.message);
  }
});
$("#main").addEventListener("click", (e) => {
  // A rifle held by a recorded score is greyed out; saying why beats silence.
  const held = e.target.closest("[data-locked-rifle]");
  if (held) {
    const p = s().participants.find((x) => x.id === held.dataset.lockedRifle);
    if (p)
      toast(
        `${p.name} has scores recorded on ${p.weapon}. Rifles are held to different standards, so void those scores in History before changing it.`,
      );
    return;
  }
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
          openedShoot = false;
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
      openedShoot = true;
      const opened = s();
      tab = opened.locked
        ? search.trim()
          ? "history"
          : opened.activeStage
            ? `stage:${opened.activeStage}`
            : "participants"
        : "participants";
      selected.clear();
      // A stage filter belongs to the shoot it was set in. Another shoot may
      // not have that stage at all, which leaves History looking empty with no
      // chip marked to explain why.
      historyFilter = null;
      save();
      render();
      return;
    }
    if (b.dataset.layout) {
      const [program, variant, weapon, stage] = b.dataset.layout.split("|");
      layoutDialog(program, variant, weapon, stage);
      return;
    }
    if (b.dataset.configureParts) {
      layoutDialog(
        c.program,
        c.variant,
        b.dataset.configureParts,
        b.dataset.configureStage,
      );
      return;
    }
    if (b.dataset.replaceDetail) {
      manualDetailDialog(
        stage,
        null,
        new Set(
          replacementPlan(c, b.dataset.replaceDetail, stage).map((p) => p.id),
        ),
        b.dataset.replaceDetail,
      );
      return;
    }
    if (b.dataset.unlockStage) {
      activateStage(c, b.dataset.unlockStage);
      save();
      render();
      return;
    }
    if (b.dataset.personSkip) {
      const p = c.participants.find((p) => p.id === b.dataset.personSkip),
        st = b.dataset.personSkipStage ?? tab.split(":")[1];
      setPersonSkipped(c, p.id, st, !personSkipped(c, p, st));
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
      if (tab === "final" || tab === "history") historyDialog(person);
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
    if (b.dataset.skip?.startsWith("person:")) {
      const p = c.participants.find((p) => p.id === b.dataset.skip.slice(7));
      const st = tab.split(":")[1];
      setPersonSkipped(c, p.id, st, !personSkipped(c, p, st));
      save();
      render();
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
    if ("historyFilter" in b.dataset) {
      historyFilter = b.dataset.historyFilter || null;
      render();
      return;
    }
    if (b.dataset.attempt) {
      scoreEventDialog(b.dataset.attempt);
      return;
    }
    if (b.dataset.detailScore) {
      detailEventDialog(b.dataset.detailScore);
      return;
    }
    if (b.dataset.detailMenu) {
      detailMenu(b.dataset.detailMenu);
      return;
    }
    if (b.dataset.undetail) {
      cancelDispatch(c, b.dataset.undetail);
      save();
      render();
      toast("Back in the Redetailing list.");
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
        addMode = null;
        render();
        break;
      case "add-done":
      case "add-next":
      case "add-save": {
        const names = $("#add-names").value,
          weapon = baseWeapons(c.program, c.variant)[0],
          byDetail = b.dataset.action === "add-next",
          finishing = b.dataset.action === "add-done";
        // Finishing with an empty box just closes the panel.
        if (finishing && !names.trim()) {
          addMode = null;
          render();
          break;
        }
        const people = addParticipants(
          c,
          names,
          weapon,
          byDetail || finishing ? ensureDetail(c, pasteDetail).id : null,
        );
        if (finishing) addMode = null;
        else if (byDetail) pasteDetail = nextDetailNumber(c);
        else addMode = null;
        save();
        render();
        if (!sizeNote(c))
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
        render();
        toast("Participants confirmed. Pick a stage above to start scoring.");
        break;
      case "unlock":
        setRosterLock(c, false);
        save();
        render();
        break;
      case "select-all": {
        selected = new Set(
          queue(c, stage)
            .filter((x) => !x.errors.length)
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
        if (
          checking ||
          document.visibilityState === "hidden" ||
          !navigator.onLine
        )
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
