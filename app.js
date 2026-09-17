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
  enableShoot,
  hasScores,
  changeShootType,
  audit,
  addDetail,
  members,
  sortedDetails,
  detailNumber,
  borrowedBy,
  rosterWeapon,
  assignDetail,
  detailIssues,
  addParticipants,
  updateParticipant,
  fillWeapons,
  removeParticipant,
  getDraft,
  resetDraft,
  validateDraft,
  validateManual,
  saveDetail,
  recordManualDetail,
  dropTemporaryDetail,
  recordIndividual,
  parseHits,
  scoreHistory,
  best,
  result,
  voidAttempt,
  undoAttempt,
  target,
  stageCompositionErrors,
  notYetShot,
  setPriority,
  queue,
  dispatch,
  cancelDispatch,
  manualQueue,
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
  apsView = "standard",
  offlineReady = false,
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
function status() {
  $("#status").textContent = navigator.onLine
    ? offlineReady
      ? "Offline ready"
      : "Saved on device"
    : offlineReady
      ? "Offline · saved on device"
      : "Offline";
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
    status();
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
    types = TYPES.filter(
      ([p, v]) =>
        store.enabled.includes(p) || (p === c.program && v === c.variant),
    );
  const type = editable
    ? `<select id="shoot-type" class="shoot-select" aria-label="Shoot type" ${hasScores(c) ? "disabled" : ""}>${types.map(([p, v]) => `<option value="${p}|${v}" ${p === c.program && v === c.variant ? "selected" : ""}>${esc(typeLabel(p, v))}</option>`).join("")}</select>`
    : `<span class="badge">${esc(typeLabel(c.program, c.variant))}</span>`;
  return `<div class="toolbar"><strong class="shoot-name">${esc(c.name)}</strong>${type}${extra}</div>`;
}
function borrowedNote(c, d) {
  const list = borrowedBy(c, d.id);
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
  $("#tabs").innerHTML = tabs
    .map(
      ([key, label]) =>
        `<button data-tab="${key}" class="${tab === key ? "on" : ""}" ${tab === key ? 'aria-current="page"' : ""}>${esc(label)}</button>`,
    )
    .join("");
  if (tab === "shoots") renderShoots();
  else if (tab === "settings") renderSettings();
  else if (tab === "participants") renderParticipants();
  else if (tab === "final") renderFinal();
  else renderStage(tab.split(":")[1]);
  status();
}
function renderShoots() {
  const types = TYPES.filter(([p]) => store.enabled.includes(p)),
    list = store.shoots.toSorted(
      (a, b) =>
        (b.id === store.active) - (a.id === store.active) ||
        b.createdAt.localeCompare(a.createdAt),
    );
  $("#main").innerHTML =
    `<div class="shoots"><section class="panel"><div class="panel-head"><h2>New shoot</h2></div><div class="panel-body">${
      types.length
        ? `<form id="new-shoot"><div class="type-grid" role="radiogroup" aria-label="Shoot type">${types.map(([p, v], i) => `<label class="type-option"><input type="radio" name="type" value="${p}|${v}" ${i === 0 ? "checked" : ""}><span>${esc(typeLabel(p, v))}</span></label>`).join("")}</div><label class="field"><span>Shoot name</span><input name="name" required autocomplete="off" placeholder="e.g. Alpha Coy · ${esc(dateLabel(now()))}"></label><button class="primary" type="submit">Create shoot</button></form>`
        : '<p class="note">Turn on the shoot types you run in Settings.</p><button class="primary" data-action="settings">Settings</button>'
    }</div></section>${
      list.length
        ? `<section class="panel"><div class="panel-head"><h3>Shoots <span class="count">${list.length}</span></h3></div>${list
            .map(
              (x) =>
                `<div class="shoot-row"><div><strong>${esc(x.name)}</strong><p class="note">${esc(typeLabel(x.program, x.variant))} · ${esc(dateLabel(x.createdAt))} · ${x.participants.length} participants · ${hasScores(x) ? "Scores recorded" : "No scores yet"}</p></div><button ${x.id === store.active ? 'class="primary"' : ""} data-open-shoot="${x.id}" aria-label="${x.id === store.active ? "Continue" : "Open"} ${esc(x.name)}">${x.id === store.active ? "Continue" : "Open"}</button></div>`,
            )
            .join("")}</section>`
        : ""
    }</div>`;
}
// Detail buttons offered per participant: as many details as the minimum size allows.
function detailCount(c) {
  const min = DETAIL_RULES[c.program]?.min || 1,
    used = Math.max(
      0,
      ...c.details
        .filter((d) => !d.temporary && members(c, d.id).length)
        .map(detailNumber),
    );
  return Math.max(1, Math.floor(c.participants.length / min), used);
}
function renderParticipants() {
  const c = s(),
    cs = isCS(c),
    multi = weapons(c).length > 1,
    base = baseWeapons(c.program, c.variant),
    rifle =
      base.length > 1
        ? `<label class="muted" for="fill-weapon">Rifle</label><select id="fill-weapon" aria-label="Rifle for fill all">${option(base, c.settings.weapon)}</select><button data-action="fill-all">Fill all</button>`
        : "",
    matches = (p) => search && filtered(p),
    count = cs ? detailCount(c) : 0;
  const picks = (p) => {
    const locked =
      c.attempts.some((a) => a.participantId === p.id) ||
      c.dispatches.some(
        (d) => d.status === "awaiting" && d.roster.some((m) => m.id === p.id),
      );
    return `<td><div class="detail-picks" role="group" aria-label="Detail for ${esc(p.name)}">${Array.from(
      { length: count },
      (_, i) => {
        const on =
          c.details.find((d) => d.id === p.detailId) &&
          detailNumber(c.details.find((d) => d.id === p.detailId)) === i + 1;
        return `<button type="button" class="pick ${on ? "on" : ""}" data-assign="${p.id}" data-number="${i + 1}" aria-pressed="${on}" aria-label="${esc(p.name)} detail ${i + 1}" ${locked ? "disabled" : ""}>${i + 1}</button>`;
      },
    ).join("")}</div></td>`;
  };
  const row = (p) =>
    `<tr class="${matches(p) ? "match" : ""}"><td class="name">${esc(p.name)}</td>${multi ? `<td>${esc(p.weapon)}</td>` : ""}${cs ? picks(p) : ""}<td class="more-cell"><button class="more" data-person="${p.id}" aria-label="Options for ${esc(p.name)}">⋯</button></td></tr>`;
  const table = (people) =>
    `<div class="table-wrap"><table><thead><tr><th>Full name</th>${multi ? "<th>Rifle</th>" : ""}${cs ? "<th>Detail</th>" : ""}<th></th></tr></thead><tbody>${people.map(row).join("")}</tbody></table></div>`;
  let body;
  if (!c.participants.length)
    body = empty(
      "No participants yet",
      `<p>Paste full names, one per line.</p><button class="primary" data-action="add">Add participants</button>`,
    );
  else if (cs) {
    const issues = detailIssues(c),
      unassigned = members(c, null),
      groups = [
        ...(unassigned.length ? [[null, unassigned]] : []),
        ...sortedDetails(c)
          .filter((d) => members(c, d.id).length)
          .map((d) => [d, members(c, d.id)]),
      ].filter(([, people]) => !search || people.some(filtered));
    body =
      (issues.length
        ? `<div class="panel errors issues" role="alert">${esc(issues.join("\n"))}</div>`
        : "") +
      groups
        .map(([d, people]) =>
          d?.temporary
            ? `<section class="panel temporary"><div class="detail-head"><h3>${esc(d.name)}</h3><span class="count">${people.length} firers</span></div><div class="table-wrap"><table><thead><tr><th>Full name</th><th>Rifle</th></tr></thead><tbody>${people.map((p) => `<tr class="${matches(p) ? "match" : ""}"><td class="name">${esc(p.name)}</td><td>${esc(rosterWeapon(c, d.id, p))}</td></tr>`).join("")}</tbody></table></div></section>`
            : `<section class="panel ${d ? "" : "unassigned"}"><div class="detail-head"><h3>${d ? esc(d.name) : "Needs a detail"}</h3>${d ? borrowedNote(c, d) : ""}<span class="count">${people.length} firers</span></div>${table(people)}</section>`,
        )
        .join("");
  } else
    body = `<section class="panel">${table(c.participants.filter(filtered))}</section>`;
  $("#main").innerHTML =
    shootHead(
      `<span class="spacer"></span>${rifle}<button class="primary" data-action="add">＋ Add participants</button>`,
      true,
    ) +
    (hasScores(c)
      ? '<p class="note lock-note">Scores are recorded, so the shoot type is locked. <button class="inline-link" data-action="shoots">Start a new shoot</button> to use a different type.</p>'
      : "") +
    `<div class="toolbar">${searchBox()}<span class="count">${c.participants.length} participants</span></div>` +
    body;
}
// Participant ID → position in the order they were redetailed.
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
  return `${list.length > 1 ? `<span class="prev">${list.map((a) => a.score).join(" ")}</span>` : ""}<b>${Math.max(...list.map((a) => a.score))}</b>`;
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
    `<div class="grid"><div class="score-col">${isCS(c) ? detailPanels(c, stage) : individualPanel(c, stage)}</div>${queuePanel(c, stage, q)}</div>`;
}
function individualPanel(c, stage) {
  if (!c.participants.length)
    return empty(
      "Add participants first",
      '<p><button data-action="participants">Participants</button></p>',
    );
  const waiting = awaiting(c, stage),
    multi = weapons(c).length > 1,
    rank = (p) => (waiting.has(p.id) ? waiting.get(p.id) : 1e9),
    people = c.participants.filter(filtered).toSorted((a, b) => rank(a) - rank(b));
  return `<section class="panel score-panel" data-individual><div class="detail-head"><h3>${esc(stageLabel(c, stage))}</h3><span class="count">${c.participants.length} firers</span></div><div class="table-wrap"><table><thead><tr><th>Full name</th><th>Hits</th><th>Results</th><th></th></tr></thead><tbody>${people
    .map((p) => {
      const max = p.profile.components.find((x) => x.id === stage).max;
      return `<tr data-row="${p.id}" class="${waiting.has(p.id) ? "awaiting" : ""}"><td class="name">${esc(p.name)}${multi ? `<div class="sub">${esc(p.weapon)}</div>` : ""}${waiting.has(p.id) ? '<div class="pending">Awaiting scores</div>' : ""}</td><td><div class="score-input"><input type="number" min="0" max="${max}" step="1" inputmode="numeric" enterkeyhint="next" data-hits="${p.id}" aria-label="${esc(p.name)} hits" placeholder="—"><span class="muted">/${max}</span></div></td><td class="num results">${resultsCell(c, p, stage)}</td><td class="more-cell"><button class="more" data-person="${p.id}" aria-label="Options for ${esc(p.name)}">⋯</button></td></tr>`;
    })
    .join(
      "",
    )}</tbody></table></div><div class="errors draft-errors" role="alert"></div><div class="score-footer"><span class="draft-summary">Scores save when you press Enter or leave the box.</span></div></section>`;
}
function draftErrors(c, draft) {
  const hasInput =
    draft.rows.some((r) => r.hits !== "") || draft.aggregate !== "";
  if (!hasInput)
    return stageCompositionErrors(c, draft.detailId, draft.stage);
  return validateDraft(c, draft).errors.filter(
    (e) => !e.endsWith("Missing hits.") && !e.startsWith("Account for every"),
  );
}
function draftSummary(c, draft) {
  const v = validateDraft(c, draft),
    max = stages(c).find((x) => x.id === draft.stage).max;
  return v.shared && v.score !== null
    ? `Average ${v.aggregate}/${v.divisor} → ${v.score}/${max}.`
    : `${v.rows.length} firers.`;
}
// A detail stays on the stage tab until its scores are confirmed, unless redetailed.
function needsScores(c, d, stage) {
  const draft = c.drafts[`${d.id}:${stage}`];
  return (
    c.dispatches.some(
      (x) =>
        x.key === `detail:${d.id}` && x.stage === stage && x.status === "awaiting",
    ) ||
    !c.shared.some(
      (x) => x.detailId === d.id && x.stage === stage && x.status === "valid",
    ) ||
    (draft &&
      (draft.aggregate !== "" || draft.rows.some((r) => r.hits !== "")))
  );
}
function detailPanels(c, stage) {
  const waiting = awaiting(c, stage),
    label = stageLabel(c, stage),
    shared = ["A", "C"].includes(stage),
    cmax = stages(c).find((x) => x.id === stage).max,
    all = sortedDetails(c).filter((d) => members(c, d.id).length),
    open = all.filter((d) => needsScores(c, d, stage)),
    scored = all.length - open.length,
    shown = search
      ? all.filter((d) => members(c, d.id).some(filtered))
      : showScored
        ? all
        : open,
    unassigned = members(c, null).length;
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
        const people = members(c, d.id),
          draft = getDraft(c, d.id, stage);
        return `<section class="panel score-panel ${d.temporary ? "temporary" : ""}" data-detail="${d.id}"><div class="detail-head"><h3>${esc(d.name)}</h3>${borrowedNote(c, d)}<span class="count">${people.length} firers</span><div class="actions"><button class="icon-button" data-reset="${d.id}" title="Clear entries" aria-label="Clear entries for ${esc(d.name)}">↺</button></div></div><div class="table-wrap"><table><thead><tr><th>Full name</th><th>Rifle</th><th>Hits</th><th>Results</th><th></th></tr></thead><tbody>${people
          .map((p) => {
            const row = draft.rows.find((r) => r.participantId === p.id);
            return `<tr data-row="${p.id}" class="${[waiting.has(p.id) && "awaiting", search && filtered(p) && "match"].filter(Boolean).join(" ")}"><td class="name">${esc(p.name)}${waiting.has(p.id) ? '<div class="pending">Awaiting scores</div>' : ""}</td><td class="rifle">${esc(rosterWeapon(c, d.id, p))}</td><td><div class="score-input"><input type="number" min="0" max="${cmax}" step="1" inputmode="numeric" enterkeyhint="next" data-cs-hits="${p.id}" value="${esc(row?.hits || "")}" aria-label="${esc(p.name)} hits" placeholder="—"><span class="muted">/${cmax}</span></div></td><td class="num results">${resultsCell(c, p, stage)}</td><td class="more-cell"><button class="more" data-person="${p.id}" aria-label="Options for ${esc(p.name)}">⋯</button></td></tr>`;
          })
          .join(
            "",
          )}</tbody></table></div>${shared ? `<div class="aggregate"><label>Or detail total <input type="number" min="0" max="${people.length * cmax}" step="1" data-aggregate="${d.id}" value="${esc(draft.aggregate)}" aria-label="${esc(d.name)} total hits" placeholder="—"></label><span class="muted">/${people.length * cmax}</span></div>` : ""}<div class="errors draft-errors">${esc(draftErrors(c, draft).join("\n"))}</div><div class="score-footer"><span class="draft-summary">${esc(draftSummary(c, draft))}</span><button class="primary" data-confirm="${d.id}">Confirm scores</button></div></section>`;
      })
      .join("") +
    (!shown.length
      ? `<div class="empty"><h2>All details scored</h2><p>Redetail firers to enter more ${esc(label)} scores.</p></div>`
      : "") +
    (scored && !search
      ? `<p class="note"><button class="inline-link" data-action="toggle-scored">${showScored ? "Hide scored details" : `Show ${scored} scored ${scored === 1 ? "detail" : "details"}`}</button></p>`
      : "")
  );
}
function methodInfo(c) {
  const goalName = c.settings.objective === "marksman" ? "Marksman" : "Pass";
  return `${
    {
      automatic: `Firers who haven't shot come first. Then firers below the auto-detailing threshold for ${goalName}, closest to it first. Set thresholds in Settings.`,
      lowest: "Lowest best score first.",
      highest: "Highest best score first.",
      first: "In the order firers last shot: whoever shot earliest goes again first.",
    }[c.settings.order]
  } ▲ High priority firers go first and ▼ low priority firers go last.`;
}
function queuePanel(c, stage, q) {
  const cs = isCS(c),
    cap = !cs && DETAIL_RULES[c.program]?.max,
    count = q
      .filter((e) => selected.has(e.key))
      .reduce((n, e) => n + e.members.length, 0);
  return `<section class="panel queue"><div class="queue-head"><div class="queue-title"><h3>Redetailing</h3><span class="count">${q.reduce((n, e) => n + e.members.length, 0)} firers</span></div><div class="queue-method"><select id="order" aria-label="Redetailing order">${[
    ["automatic", "Automatic"],
    ["lowest", "Lowest first"],
    ["highest", "Highest first"],
    ["first", "Shoot first, shoot again first"],
  ]
    .map(
      ([key, label]) =>
        `<option value="${key}" ${c.settings.order === key ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select>${info(methodInfo(c))}</div><div class="queue-actions"><button data-action="select-all">${cap ? `Select next ${cap}` : "Select all"}</button><button class="primary" id="redetail" data-action="redetail" ${count ? "" : "disabled"}>Redetail${count ? ` (${count})` : ""}</button></div></div><div class="queue-list">${
    q
      .map((e, i) => {
        const name = cs ? e.detail.name : e.members[0].name,
          max = e.priority.p.profile.components.find((x) => x.id === stage).max;
        return `<div class="queue-row" data-key="${esc(e.key)}"><input type="checkbox" data-queue="${esc(e.key)}" ${selected.has(e.key) ? "checked" : ""} ${e.errors.length ? "disabled" : ""} aria-label="Select ${esc(name)}"><span class="count">${i + 1}</span><div><strong>${esc(name)}</strong>${cs ? borrowedNote(c, e.detail) : ""}<p class="note">${e.errors.length ? esc(e.errors.join(" ")) : e.first ? "First attempt" : `Best ${ratio(best(c, e.priority.p, stage), max)}`}</p></div><button type="button" class="prio ${e.tag || ""}" data-priority="${esc(e.key)}" aria-label="${esc(name)} priority: ${e.tag || "normal"}" title="${e.tag === "high" ? "High priority" : e.tag === "low" ? "Low priority" : "Set priority"}">${e.tag === "high" ? "▲" : e.tag === "low" ? "▼" : "↕"}</button></div>`;
      })
      .join("") || '<div class="panel-body note">No firers to redetail.</div>'
  }</div></section>`;
}
// Updates results and the redetailing list without replacing score inputs.
function refreshStage(stage) {
  const c = s(),
    waiting = awaiting(c, stage);
  document.querySelectorAll("tr[data-row]").forEach((tr) => {
    const p = c.participants.find((x) => x.id === tr.dataset.row);
    if (!p) return;
    tr.querySelector(".results").innerHTML = resultsCell(c, p, stage);
    tr.classList.toggle("awaiting", waiting.has(p.id));
    if (!waiting.has(p.id)) tr.querySelector(".pending")?.remove();
  });
  const q = queue(c, stage);
  selected = new Set(
    [...selected].filter((key) =>
      q.some((e) => e.key === key && !e.errors.length),
    ),
  );
  const panel = $(".queue");
  if (panel) panel.outerHTML = queuePanel(c, stage, q);
}
function updateRedetailButton(stage) {
  const c = s(),
    count = queue(c, stage)
      .filter((e) => selected.has(e.key))
      .reduce((n, e) => n + e.members.length, 0);
  $("#redetail").disabled = !count;
  $("#redetail").textContent = `Redetail${count ? ` (${count})` : ""}`;
}
function saveHit(input) {
  const c = s(),
    stage = tab.split(":")[1],
    p = c.participants.find((x) => x.id === input.dataset.hits),
    errors = input.closest(".score-panel").querySelector(".draft-errors");
  if (!p || input.value === "") return;
  try {
    const a = recordIndividual(c, p, stage, input.value);
    input.value = "";
    input.classList.remove("invalid");
    errors.textContent = "";
    save();
    later(() => refreshStage(stage));
    toast(`${p.name}: ${a.score} saved.`, () => undoAttempt(c, a.id));
  } catch (e) {
    input.classList.add("invalid");
    errors.textContent = `${p.name}: ${e.message}`;
  }
}
function confirmDetail(detailId, stage) {
  const c = s(),
    draft = getDraft(c, detailId, stage),
    panel = $(`[data-detail="${detailId}"]`);
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
    ids = new Set(chosen.flatMap((e) => e.members.map((p) => p.id))),
    reshoot = chosen.some((e) =>
      e.members.some((p) => best(c, p, stage) !== null),
    ),
    waiting = notYetShot(c, stage).filter((p) => !ids.has(p.id));
  if (!reshoot || !waiting.length) return runRedetail(stage, keys);
  const names = waiting.slice(0, 12).map((p) => p.name).join(", ");
  dialog(
    "Not all participants have shot yet",
    `<p>${waiting.length === 1 ? "1 participant has" : `${waiting.length} participants have`} no ${esc(stageLabel(c, stage))} score yet: ${esc(names)}${waiting.length > 12 ? ` and ${waiting.length - 12} more` : ""}.</p><p class="note">Let everyone shoot once before redetailing, or go back and fill in their scores.</p>`,
    "Continue redetailing",
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
  toast(
    `${ids.size} ${ids.size === 1 ? "firer" : "firers"} redetailed. Enter their scores when they finish.`,
  );
}
// Brief shuffle of the list while redetailed firers slide out to the score table.
async function shuffle(list, keys) {
  const rows = [...list.querySelectorAll(".queue-row")],
    leaving = rows.filter((r) => keys.includes(r.dataset.key)),
    staying = rows.filter((r) => !keys.includes(r.dataset.key)),
    pause = (ms) => new Promise((done) => setTimeout(done, ms));
  list.classList.add("shuffling");
  leaving.forEach((r) => r.classList.add("leaving"));
  await pause(220);
  leaving.forEach((r) => r.remove());
  for (let round = 0; round < 5; round++) {
    const top = new Map(staying.map((r) => [r, r.getBoundingClientRect().top]));
    staying.sort(() => Math.random() - 0.5).forEach((r) => list.append(r));
    for (const r of staying) {
      const dy = top.get(r) - r.getBoundingClientRect().top;
      if (dy)
        r.animate(
          [{ transform: `translateY(${dy}px)` }, { transform: "none" }],
          { duration: 90, easing: "ease-out" },
        );
    }
    await pause(95);
  }
  list.classList.remove("shuffling");
}
function renderFinal() {
  const c = s(),
    cs = stages(c),
    rr = c.participants.map((p) => result(c, p));
  const table = (people) =>
    `<div class="table-wrap"><table><thead><tr><th>Full name</th>${cs.map((x) => `<th>${esc(x.label)}</th>`).join("")}<th>Total</th><th>Result</th><th></th></tr></thead><tbody>${people
      .map((p) => {
        const r = result(c, p);
        return `<tr><td class="name">${esc(p.name)}</td>${p.profile.components.map((x, i) => `<td class="num">${ratio(r.scores[i], x.max)}</td>`).join("")}<td class="num"><b>${ratio(r.total, p.profile.total)}</b></td><td>${badge(r.status)}</td><td class="more-cell"><button class="more" data-person="${p.id}" aria-label="Options for ${esc(p.name)}">⋯</button></td></tr>`;
      })
      .join("")}</tbody></table></div>`;
  $("#main").innerHTML =
    shootHead(
      '<span class="spacer"></span><button data-action="csv">Export scores</button>',
    ) +
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
        const on = store.enabled.includes(program),
          open = openPresets.has(program);
        const inUse = on && s()?.program === program;
        return `<section class="preset ${open ? "open" : ""}"><div class="preset-head"><button class="expand" data-expand="${program}" aria-expanded="${open}">${label}</button><button class="toggle" role="switch" aria-checked="${on}" data-enable="${program}" aria-label="Enable ${label}" ${inUse ? `disabled title="The open shoot uses ${esc(label)}"` : ""}></button></div><div class="preset-body">${inUse ? `<p class="note">The open shoot uses ${esc(label)}, so it stays on.</p>` : ""}${on ? presetBody(program) : `<p class="note">Turn on ${esc(label)} to edit its settings.</p>`}</div></section>`;
      })
      .join(
        "",
      )}<div class="settings-section"><h3>Data</h3><div class="actions"><button data-action="backup">Export backup</button><button data-action="restore">Restore backup</button></div><p class="note" id="offline-note">${offlineReady ? "Available offline. Shoots and scores are saved on this device." : "Preparing offline files…"}</p></div></div>`;
}
function thresholdInfo(program, objective) {
  return `Automatic redetailing keeps listing a firer for a stage until their best score reaches its threshold. Defaults spread the ${objective === "marksman" ? "Marksman" : "Pass"} score across the stages, rounded up.${program === "BTP" ? " Stage B's threshold is whatever is still needed after Stage A." : ""}`;
}
function presetBody(program) {
  const variant = program === "APS" ? apsView : "standard",
    key = `${program}|${variant}`,
    label = typeLabel(program, variant),
    pr = preset(store, program, variant),
    list = baseWeapons(program, variant),
    rule = DETAIL_RULES[program],
    profile = profileFor(program, variant, pr.weapon),
    shoot = {
      program,
      variant,
      attempts: [],
      settings: {
        weapon: pr.weapon,
        objective: pr.objective,
        targets: pr.targets,
      },
    },
    p = { weapon: pr.weapon, profile },
    rows = targetStages(shoot),
    custom = rows.some(
      (c) => pr.targets[`${pr.weapon}:${c.id}:${pr.objective}`] !== undefined,
    );
  return `${program === "APS" ? `<div class="seg" style="margin-bottom:14px"><button data-aps="standard" class="${apsView === "standard" ? "on" : ""}">APS</button><button data-aps="ns" class="${apsView === "ns" ? "on" : ""}">APS (NS)</button></div>` : ""}<div class="field inline rifle-type"><span>Rifle type</span>${list.length > 1 ? `<select data-default-weapon="${key}" aria-label="${esc(label)} rifle type">${option(list, pr.weapon)}</select>` : `<strong>${esc(pr.weapon)}</strong>`}</div><p class="required">Pass ${ratio(profile.pass, profile.total)} · Marksman ${ratio(profile.marksman, profile.total)}</p>${rule ? `<p class="limit">${rule.min ? `${rule.min}–${rule.max} firers per detail. Up to ${rule.nonSAR} non-SAR21 weapons per detail. Stages A and C: detail hits ÷ firers, rounded down.` : `Up to ${rule.max} firers at a time.`}</p>` : ""}<label class="field inline"><span>Automatic</span><select data-objective="${key}" aria-label="${esc(label)} Automatic priority"><option value="marksman" ${pr.objective === "marksman" ? "selected" : ""}>Marksman first</option><option value="pass" ${pr.objective === "pass" ? "selected" : ""}>Pass first</option></select></label><div class="threshold-head"><span class="muted">Auto-detailing thresholds</span>${info(thresholdInfo(program, pr.objective))}<button type="button" class="inline-link" data-reset-thresholds="${key}" ${custom ? "" : "disabled"}>Reset</button></div>${rows
    .map((c) => {
      const max = profile.components.find((x) => x.id === c.id).max;
      return `<div class="target-row"><label for="target-${program}-${c.id}">${esc(c.label)}</label><input id="target-${program}-${c.id}" data-threshold="${key}|${c.id}" type="number" min="0" max="${max}" step="1" inputmode="numeric" value="${target(shoot, p, c.id)}" aria-label="${esc(label)} ${esc(c.label)} threshold"><span class="muted">/${max}</span></div>`;
    })
    .join("")}`;
}
function dialog(title, body, label, submit, closeLabel = "Close") {
  const d = $("#dialog"),
    buttons = Array.isArray(label) ? label : label ? [{ label }] : [];
  d.innerHTML = `<form id="dialog-form"><h2 id="dialog-title">${esc(title)}</h2>${body}<div class="error" role="alert"></div><div class="dialog-actions"><button type="button" id="close-dialog">${esc(closeLabel)}</button>${buttons.map((b, i) => `<button type="submit" ${b.value ? `value="${esc(b.value)}"` : ""} class="${i === buttons.length - 1 ? "primary" : ""}">${esc(b.label)}</button>`).join("")}</div></form>`;
  if (!d.open) d.showModal();
  $("#close-dialog").onclick = () => d.close();
  $("#dialog-form").onsubmit = (ev) => {
    ev.preventDefault();
    try {
      submit?.(new FormData(ev.target), ev.submitter?.value);
    } catch (e) {
      d.querySelector(".error").textContent = e.message;
    }
  };
}
function manualDetailDialog(stage) {
  const c = s(),
    label = stageLabel(c, stage),
    shared = ["A", "C"].includes(stage),
    cmax = stages(c).find((x) => x.id === stage).max,
    groups = [
      ...sortedDetails(c)
        .filter((d) => !d.temporary && members(c, d.id).length)
        .map((d) => [d.name, members(c, d.id)]),
      ...(members(c, null).length ? [["Needs a detail", members(c, null)]] : []),
    ];
  const row = (p) =>
    `<div class="manual-row"><label class="manual-pick"><input type="checkbox" name="pick" value="${p.id}" aria-label="Include ${esc(p.name)}"><span>${esc(p.name)}</span></label><select name="weapon-${p.id}" aria-label="${esc(p.name)} rifle" disabled>${option(weapons(c), p.weapon)}</select><input type="number" name="hits-${p.id}" min="0" max="${cmax}" step="1" inputmode="numeric" placeholder="—" aria-label="${esc(p.name)} hits" disabled></div>`;
  dialog(
    `Manual detail · ${label}`,
    `<p class="note">Choose who fired together, their rifles and hits. Save once for a one-off, or as a new detail to keep redetailing it.</p><div class="manual-list">${groups.map(([name, people]) => `<div class="manual-group"><h3>${esc(name)}</h3>${people.map(row).join("")}</div>`).join("")}</div>${shared ? `<label class="field inline manual-total"><span>Or detail total</span><input type="number" name="aggregate" min="0" step="1" inputmode="numeric" placeholder="—" aria-label="Manual detail total hits"></label>` : ""}<p class="note manual-summary">No firers chosen.</p>`,
    [
      { label: "Save once", value: "once" },
      { label: "Save as new detail", value: "keep" },
    ],
    (f, action) => {
      const entries = f.getAll("pick").map((id) => ({
          participantId: id,
          weapon: f.get(`weapon-${id}`),
          hits: f.get(`hits-${id}`) ?? "",
        })),
        a = recordManualDetail(c, stage, entries, f.get("aggregate") ?? "", {
          keep: action === "keep",
        });
      save();
      $("#dialog").close();
      render();
      toast(
        a.detailId
          ? `${c.details.find((d) => d.id === a.detailId).name} saved.`
          : "Manual detail saved.",
        () => {
          undoAttempt(c, c.attempts.find((x) => x.detailAttemptId === a.id).id);
          if (a.detailId) dropTemporaryDetail(c, a.detailId);
        },
      );
    },
  );
  const form = $("#dialog-form"),
    update = () => {
      const entries = [];
      for (const box of form.querySelectorAll("[name=pick]")) {
        const line = box.closest(".manual-row");
        line.classList.toggle("on", box.checked);
        line
          .querySelectorAll("select,input[type=number]")
          .forEach((el) => (el.disabled = !box.checked));
        if (box.checked)
          entries.push({
            participantId: box.value,
            weapon: form.elements[`weapon-${box.value}`].value,
            hits: form.elements[`hits-${box.value}`].value,
          });
      }
      const v = validateManual(
        c,
        stage,
        entries,
        form.elements.aggregate?.value ?? "",
      );
      form.querySelector(".manual-summary").textContent = entries.length
        ? `${entries.length} firers${v.score !== null ? ` · average ${v.aggregate}/${v.divisor} → ${v.score}/${cmax}` : ""}.`
        : "No firers chosen.";
      form.querySelector(".error").textContent = entries.length
        ? v.errors.filter((e) => !e.endsWith("Missing hits.")).join("\n")
        : "";
    };
  form.addEventListener("input", update);
  form.addEventListener("change", update);
}
function detailOptions(c, chosen) {
  return `<option value="" ${!chosen ? "selected" : ""}>No detail</option>${sortedDetails(
    c,
  )
    .map(
      (d) =>
        `<option value="${d.id}" ${d.id === chosen ? "selected" : ""}>${esc(d.name)}</option>`,
    )
    .join("")}<option value="new">New detail</option>`;
}
function addDialog() {
  const c = s(),
    cs = isCS(c),
    base = baseWeapons(c.program, c.variant);
  dialog(
    "Add participants",
    `<label class="field"><span>Full names · one per line</span><textarea name="names" required autofocus placeholder="${cs ? "Alex Tan, 1&#10;Benjamin Lee, 1&#10;Chris Wong" : "Alex Tan&#10;Benjamin Lee"}"></textarea></label>${cs ? '<p class="note">Add a detail number after a name to put them in that detail, or choose details afterward with the number buttons.</p>' : ""}${base.length > 1 ? `<label class="field"><span>Rifle</span><select name="weapon">${option(base, c.settings.weapon)}</select></label>` : ""}`,
    "Add",
    (f) => {
      addParticipants(c, f.get("names"), f.get("weapon") || c.settings.weapon);
      save();
      $("#dialog").close();
      render();
    },
  );
}
function personDialog(id) {
  const c = s(),
    cs = isCS(c),
    multi = weapons(c).length > 1,
    p = c.participants.find((p) => p.id === id);
  dialog(
    p.name,
    `<label class="field"><span>Full name</span><input name="name" value="${esc(p.name)}" required></label>${multi || cs ? `<div class="form-grid">${multi ? `<label class="field"><span>Rifle</span><select name="weapon">${option(weapons(c), p.weapon)}</select></label>` : ""}${cs ? `<label class="field"><span>Detail</span><select name="detail">${detailOptions(c, p.detailId)}</select></label>` : ""}</div>` : ""}<label class="field"><span>Correction reason · required when changing recorded data</span><input name="reason"></label>${cs ? "" : `<div class="actions">${p.profile.components.map((x) => `<button type="button" data-manual="${x.id}">Enter ${esc(x.label)}</button>`).join("")}</div>`}<div class="actions" style="margin-top:8px"><button type="button" id="history">History</button>${p.profile.excluded?.length ? '<button type="button" id="sighting">Sighting</button>' : ""}<button type="button" id="reshoot">Queue reshoot</button><button type="button" class="danger" id="remove">Remove</button></div>`,
    "Save",
    (f) => {
      let detail = null,
        created = null;
      if (cs) {
        detail = f.get("detail") || null;
        if (detail === "new") {
          created = addDetail(c);
          detail = created.id;
        }
      }
      try {
        updateParticipant(
          c,
          id,
          {
            name: f.get("name"),
            weapon: f.get("weapon") || p.weapon,
            detailId: detail,
          },
          f.get("reason"),
        );
      } catch (e) {
        if (created) c.details = c.details.filter((d) => d.id !== created.id);
        throw e;
      }
      save();
      $("#dialog").close();
      render();
    },
  );
  $("#history").onclick = () => historyDialog(p);
  $("#remove").onclick = () => {
    try {
      removeParticipant(c, id);
      save();
      $("#dialog").close();
      render();
    } catch (e) {
      $("#dialog .error").textContent = e.message;
    }
  };
  $("#reshoot").onclick = () =>
    dialog(
      "Queue reshoot",
      `<label class="field"><span>Stage</span><select name="stage">${p.profile.components.map((x) => `<option value="${x.id}">${esc(x.label)}</option>`).join("")}</select></label>`,
      "Queue",
      (f) => {
        manualQueue(c, p, f.get("stage"));
        save();
        $("#dialog").close();
        tab = `stage:${f.get("stage")}`;
        render();
      },
    );
  if ($("#sighting")) $("#sighting").onclick = () => sightingDialog(p);
  $("#dialog")
    .querySelectorAll("[data-manual]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          manualDialog(p, b.dataset.manual);
        }),
    );
}
function manualDialog(p, stage) {
  const c = s(),
    x = p.profile.components.find((x) => x.id === stage);
  dialog(
    `${p.name} · ${x.label}`,
    `<label class="field"><span>Hits /${x.max}</span><input name="hits" type="number" min="0" max="${x.max}" step="1" required autofocus></label><label class="field"><span>Note (optional)</span><input name="reason"></label>`,
    "Save score",
    (f) => {
      recordIndividual(c, p, stage, f.get("hits"), p.weapon, f.get("reason"));
      save();
      $("#dialog").close();
      render();
    },
  );
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
function historyDialog(p) {
  const c = s(),
    attempts = c.attempts
      .filter((a) => a.participantId === p.id)
      .toReversed(),
    pendingList = c.dispatches.filter(
      (d) => d.status === "awaiting" && d.roster.some((m) => m.id === p.id),
    );
  dialog(
    `${p.name} · History`,
    pendingList
      .map(
        (d) =>
          `<div class="history-row"><div>Stage ${esc(d.stage)} · Awaiting scores</div><button type="button" data-cancel="${d.id}">Cancel</button></div>`,
      )
      .join("") +
      attempts
        .map((a) => {
          const shared = c.shared.find((d) => d.id === a.detailAttemptId),
            max = a.profile.components.find((x) => x.id === a.stage).max;
          return `<div class="history-row"><div><b>Stage ${esc(a.stage)} · ${ratio(a.score, max)}</b> ${a.status === "void" ? badge("Voided") : ""}<p>${esc(a.weapon)} · ${new Date(a.recordedAt).toLocaleString("en-US")}${shared && isCS(c) && ["A", "C"].includes(a.stage) ? `<br>${shared.manual ? "Manual detail. " : ""}${shared.aggregateHits}/${shared.divisor} → ${a.score}. ${shared.inputMode === "aggregate" ? "Detail total only." : "Individual hits checked."}` : ""}${a.correction ? `<br>${esc(a.correction.reason)}` : ""}</p></div>${a.status === "valid" ? `<button type="button" data-correct="${a.id}">Correct</button>` : ""}</div>`;
        })
        .join("") +
      (c.sightings || [])
        .filter((a) => a.participantId === p.id)
        .map(
          (a) =>
            `<div class="history-row"><div>${esc(a.practice)} · ${a.hits}<p>Not counted in scores</p></div></div>`,
        )
        .join("") +
      (!attempts.length && !pendingList.length
        ? '<p class="note">No scored attempts.</p>'
        : ""),
    null,
  );
  $("#dialog")
    .querySelectorAll("[data-correct]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const a = c.attempts.find((a) => a.id === b.dataset.correct),
            affected = a.detailAttemptId
              ? c.attempts.filter((x) => x.detailAttemptId === a.detailAttemptId)
                  .length
              : 1;
          dialog(
            "Correct score",
            `${affected > 1 ? `<p class="note">This detail score affects ${affected} firers.</p>` : ""}<label class="field"><span>Correction reason</span><input name="reason" required autofocus></label>`,
            "Void score",
            (f) => {
              voidAttempt(c, a.id, f.get("reason"));
              save();
              render();
              historyDialog(p);
            },
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
        store.enabled = [...new Set([...store.enabled, ...incoming.enabled])];
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
  if (t.matches("[data-cs-hits],[data-aggregate]")) {
    const panel = t.closest("[data-detail]"),
      draft = getDraft(c, panel.dataset.detail, tab.split(":")[1]);
    if (t.dataset.csHits)
      draft.rows.find((r) => r.participantId === t.dataset.csHits).hits =
        t.value;
    else draft.aggregate = t.value;
    draft.updatedAt = now();
    refreshDraft(panel, c, draft);
  }
});
$("#main").addEventListener("keydown", (e) => {
  const t = e.target;
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
    } else if (t.id === "fill-weapon") {
      c.settings.weapon = t.value;
      save();
    } else if (t.id === "order") {
      c.settings.order = t.value;
      save();
      render();
    } else if (t.dataset.queue) {
      t.checked ? selected.add(t.dataset.queue) : selected.delete(t.dataset.queue);
      updateRedetailButton(stage);
    } else if (t.dataset.hits) saveHit(t);
    else if (t.dataset.threshold) {
      const [program, variant, id] = t.dataset.threshold.split("|"),
        pr = preset(store, program, variant),
        parsed = parseHits(t.value, Number(t.max));
      if (parsed.error) throw Error(`Threshold: ${parsed.error}`);
      pr.targets[`${pr.weapon}:${id}:${pr.objective}`] = parsed.value;
      applyPresets(store);
      save();
      render();
    } else if (t.dataset.defaultWeapon) {
      const [program, variant] = t.dataset.defaultWeapon.split("|");
      preset(store, program, variant).weapon = t.value;
      save();
      render();
    } else if (t.dataset.objective) {
      const [program, variant] = t.dataset.objective.split("|");
      preset(store, program, variant).objective = t.value;
      applyPresets(store);
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
    if (b.dataset.enable) {
      const on = !store.enabled.includes(b.dataset.enable);
      enableShoot(store, b.dataset.enable, on);
      if (on) openPresets.add(b.dataset.enable);
      save();
      render();
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
      setPriority(c, b.dataset.priority, next);
      save();
      render();
      return;
    }
    if (b.dataset.person) {
      personDialog(b.dataset.person);
      return;
    }
    if (b.dataset.assign) {
      assignDetail(c, b.dataset.assign, Number(b.dataset.number));
      save();
      render();
      return;
    }
    if (b.dataset.resetThresholds) {
      const [program, variant] = b.dataset.resetThresholds.split("|"),
        pr = preset(store, program, variant);
      for (const key of Object.keys(pr.targets))
        if (key.startsWith(`${pr.weapon}:`) && key.endsWith(`:${pr.objective}`))
          delete pr.targets[key];
      applyPresets(store);
      save();
      render();
      toast("Thresholds reset.");
      return;
    }
    if (b.dataset.confirm) {
      confirmDetail(b.dataset.confirm, stage);
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
        addDialog();
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
window.addEventListener("storage", (e) => {
  if (e.key === KEY)
    warning("Changed in another tab. Export any unsaved work, then reload.");
});
window.addEventListener("online", status);
window.addEventListener("offline", status);
render();
if (storageError)
  warning("Saved data could not be read. It has not been overwritten.");
else save();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .then(async () => {
      await navigator.serviceWorker.ready;
      offlineReady = true;
      status();
      if ($("#offline-note"))
        $("#offline-note").textContent =
          "Available offline. Shoots and scores are saved on this device.";
    })
    .catch(() => {
      if ($("#offline-note"))
        $("#offline-note").textContent =
          "Offline setup failed. Reload while connected to try again.";
    });
}
