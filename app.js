import {
  PROGRAMS,
  VERSION,
  DETAIL_RULES,
  WEAPON_FAMILY,
  PROFILES,
  isCS,
  weaponsFor,
  profileFor,
  stages,
  targetStages,
} from "./profiles.js";
import {
  uid,
  now,
  newStore,
  newShoot,
  getShoot,
  shootKey,
  enableShoot,
  audit,
  addDetail,
  members,
  compositionErrors,
  addParticipants,
  updateParticipant,
  fillWeapons,
  removeParticipant,
  getDraft,
  resetDraft,
  draftKey,
  validateDraft,
  pasteScores,
  saveDetail,
  recordIndividual,
  parseHits,
  bestAttempt,
  best,
  result,
  voidAttempt,
  target,
  goal,
  queue,
  dispatch,
  manualQueue,
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
const KEY = "detail-ic-v2";
let store,
  lastSaved = null,
  storageError = false,
  tab = "participants",
  search = "",
  selected = new Set(),
  openPresets = new Set(),
  offlineReady = false;
try {
  lastSaved = localStorage.getItem(KEY);
  store = lastSaved ? validateStore(JSON.parse(lastSaved)) : newStore();
} catch (e) {
  store = newStore();
  storageError = true;
}
const s = () =>
  store.active && store.enabled.includes(store.active) ? getShoot(store) : null;
const format = (v) => (v === null || v === undefined ? "—" : String(v));
const ratio = (v, max) => `${format(v)}/${max}`;
const programLabel = (p) =>
  PROGRAMS[p] + (p === "APS" && store.aps === "ns" ? " (NS)" : "");
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
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 3500);
}
function info(text) {
  return `<button class="info" type="button" aria-label="${esc(text)}">i<span class="tooltip">${esc(text)}</span></button>`;
}
function empty(text, button = "") {
  return `<div class="empty"><h2>${esc(text)}</h2>${button}</div>`;
}
function shootPicker(extra = "") {
  return `<div class="toolbar"><select class="shoot-select" id="shoot" aria-label="Shoot">${store.enabled.map((p) => `<option value="${p}" ${store.active === p ? "selected" : ""}>${esc(programLabel(p))}</option>`).join("")}</select>${extra}</div>`;
}
function filtered(p) {
  return `${p.name} ${p.weapon}`.toLowerCase().includes(search.toLowerCase());
}
function render() {
  const current = s(),
    tabs = [
      ["participants", "Participants"],
      ...(current
        ? stages(current).map((c) => [`stage:${c.id}`, c.label])
        : []),
      ["final", "Final scores"],
      ["settings", "Settings"],
    ];
  if (!tabs.some((t) => t[0] === tab)) tab = "participants";
  $("#tabs").innerHTML = tabs
    .map(
      ([key, label]) =>
        `<button data-tab="${key}" class="${tab === key ? "on" : ""}" ${tab === key ? 'aria-current="page"' : ""}>${esc(label)}</button>`,
    )
    .join("");
  if (tab === "settings") renderSettings();
  else if (!current)
    $("#main").innerHTML = empty(
      "Enable a shoot to get started",
      '<p>Choose the shoots you need in Settings.</p><button class="primary" data-action="settings">Settings</button>',
    );
  else if (tab === "participants") renderParticipants();
  else if (tab === "final") renderFinal();
  else renderStage(tab.split(":")[1]);
  status();
}
function renderParticipants() {
  const current = s();
  $("#main").innerHTML =
    shootPicker(
      `<span class="spacer"></span><label class="muted" for="fill-weapon">Rifle</label><select id="fill-weapon" aria-label="Rifle for fill all">${option(weaponsFor(current.program, current.variant), current.settings.weapon)}</select><button data-action="fill-all">Fill all</button><button class="primary" data-action="add">＋ Add participants</button>`,
    ) +
    `<div class="toolbar"><input type="search" id="search" placeholder="Find a participant" aria-label="Find a participant" value="${esc(search)}"><span class="count">${current.participants.length} participants</span></div>` +
    (current.participants.length
      ? current.details
          .filter((d) => members(current, d.id).some(filtered))
          .map((d) => {
            const people = members(current, d.id),
              errors = compositionErrors(current, people);
            return `<section class="panel"><div class="detail-head"><h3>${esc(d.name)}</h3><span class="count">${people.length} firers</span><div class="actions"><button data-add-detail="${d.id}">＋ Add</button></div></div>${errors.length ? `<div class="errors">${esc(errors.join("\n"))}</div>` : ""}<div class="table-wrap"><table><thead><tr><th>Full name</th><th>Rifle</th><th></th></tr></thead><tbody>${people
              .filter(filtered)
              .map(
                (p) =>
                  `<tr><td class="name">${esc(p.name)}</td><td>${esc(p.weapon)}</td><td style="text-align:right"><button class="more" data-person="${p.id}" aria-label="Options for ${esc(p.name)}">⋯</button></td></tr>`,
              )
              .join("")}</tbody></table></div></section>`;
          })
          .join("")
      : empty(
          "No participants yet",
          '<p>Paste full names, one per line.</p><button class="primary" data-action="add">Add participants</button>',
        ));
}
function detailErrors(current, draft) {
  const v = validateDraft(current, draft);
  return isCS(current)
    ? v.errors
    : v.errors.filter((e) => !e.endsWith("Missing hits."));
}
function renderStage(stage) {
  const current = s(),
    c = stages(current).find((c) => c.id === stage),
    q = queue(current, stage);
  selected = new Set(
    [...selected].filter((key) =>
      q.some((e) => e.key === key && !e.errors.length),
    ),
  );
  $("#main").innerHTML =
    shootPicker(
      `<span class="spacer"></span><input type="search" id="search" placeholder="Find a participant" aria-label="Find a participant" value="${esc(search)}">`,
    ) +
    `<div class="grid"><div>${
      current.details
        .filter((d) => members(current, d.id).some(filtered))
        .map((d) => {
          const people = members(current, d.id),
            draft = getDraft(current, d.id, stage),
            v = validateDraft(current, draft),
            shared = isCS(current) && ["A", "C"].includes(stage),
            errors = detailErrors(current, draft),
            hasInput =
              draft.rows.some((r) => r.hits !== "") || draft.aggregate !== "";
          return `<section class="panel score-panel" data-detail="${d.id}"><div class="detail-head"><h3>${esc(d.name)}</h3><span class="count">${people.length} firers</span><div class="actions"><button data-paste="${d.id}">Paste scores</button><button class="icon-button" data-reset="${d.id}" title="Clear this draft" aria-label="Clear draft for ${esc(d.name)}">↺</button></div></div><div class="table-wrap"><table><thead><tr><th>Full name</th>${isCS(current) ? "<th>Rifle</th>" : ""}${shared ? '<th title="Accounted for this attempt">Present</th>' : ""}<th>Hits</th><th>Best</th><th></th></tr></thead><tbody>${people
            .filter(filtered)
            .map((p) => {
              const row = draft.rows.find((r) => r.participantId === p.id),
                max = profileFor(
                  current.program,
                  current.variant,
                  row?.weapon || p.weapon,
                ).components.find((c) => c.id === stage).max,
                awaiting = current.dispatches.some(
                  (d) =>
                    d.stage === stage &&
                    d.status === "awaiting" &&
                    d.roster.some((m) => m.id === p.id),
                );
              return `<tr data-row="${p.id}"><td class="name">${esc(p.name)}${awaiting ? '<div class="pending">Awaiting scores</div>' : ""}</td>${isCS(current) ? `<td><select class="row-weapon" data-stage-weapon="${p.id}" aria-label="${esc(p.name)} rifle for ${esc(c.label)}">${option(weaponsFor(current.program, current.variant), row?.weapon || p.weapon)}</select></td>` : ""}${shared ? `<td><input type="checkbox" data-present="${p.id}" ${row?.accounted ? "checked" : ""} aria-label="${esc(p.name)} accounted for"></td>` : ""}<td><div class="score-input"><input type="number" min="0" max="${max}" step="1" inputmode="numeric" data-hits="${p.id}" value="${esc(row?.hits || "")}" aria-label="${esc(p.name)} hits" placeholder="—"><span class="muted">/${max}</span></div></td><td class="num">${format(best(current, p, stage))}</td><td><button class="more" data-person="${p.id}" aria-label="Options for ${esc(p.name)}">⋯</button></td></tr>`;
            })
            .join(
              "",
            )}</tbody></table></div>${shared ? `<div class="aggregate"><label>Or detail total <input type="number" min="0" max="${people.length * c.max}" step="1" data-aggregate="${d.id}" value="${esc(draft.aggregate)}" aria-label="${esc(d.name)} total hits" placeholder="—"></label><span class="muted">/${people.length * c.max}</span><label><input type="checkbox" data-all-present="${d.id}" ${draft.rows.every((r) => r.accounted) ? "checked" : ""}>All ${people.length} accounted for</label></div>` : ""}<div class="errors draft-errors">${esc((hasInput || compositionErrors(current, people).length ? errors : compositionErrors(current, people)).join("\n"))}</div><div class="score-footer"><span class="draft-summary">${shared && v.score !== null ? `Average: ${v.aggregate}/${v.divisor} → ${v.score}/${c.max}` : isCS(current) ? "Enter every firer’s result." : "Entries are saved on this device."}</span><button class="primary" data-save-scores="${d.id}">${isCS(current) ? "Confirm scores" : "Save entered scores"}</button></div></section>`;
        })
        .join("") ||
      empty(
        "Add participants first",
        '<p><button data-action="participants">Participants</button></p>',
      )
    }</div><section class="panel queue"><div class="panel-head"><div style="width:100%"><h3>Redetailing <span class="count">${q.reduce((n, e) => n + e.members.length, 0)} firers</span></h3><select id="order" aria-label="Redetailing order">${[
      ["automatic", "Automatic"],
      ["lowest", "Lowest first"],
      ["highest", "Highest first"],
      ["first", "Shoot first, shoot again first"],
    ]
      .map(
        ([key, label]) =>
          `<option value="${key}" ${current.settings.order === key ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></div></div>${q.map((e, i) => `<div class="queue-row"><input type="checkbox" data-queue="${esc(e.key)}" ${selected.has(e.key) ? "checked" : ""} ${e.errors.length ? "disabled" : ""} aria-label="Select ${esc(isCS(current) ? e.detail.name : e.members[0].name)}"><span class="count">${i + 1}</span><div><strong>${esc(isCS(current) ? e.detail.name : e.members[0].name)}</strong><p class="note">${e.errors.length ? esc(e.errors.join(" ")) : e.first ? "First attempt" : `Best ${ratio(best(current, e.priority.p, stage), e.priority.p.profile.components.find((c) => c.id === stage).max)}`}</p></div>${info(queueInfo(current, e, stage))}</div>`).join("") || '<div class="panel-body note">No firers to redetail.</div>'}<div class="queue-footer"><button data-action="select-all">Select all</button><button class="primary" id="detailed" ${selected.size ? "" : "disabled"}>Mark detailed${selected.size ? ` (${q.filter((e) => selected.has(e.key)).reduce((n, e) => n + e.members.length, 0)})` : ""}</button></div></section></div>`;
  $("#order").onchange = (e) => {
    current.settings.order = e.target.value;
    save();
    render();
  };
  $("#detailed").onclick = () => {
    try {
      dispatch(current, stage, [...selected]);
      selected.clear();
      save();
      render();
      toast("Awaiting scores.");
    } catch (e) {
      toast(e.message);
    }
  };
}
function queueInfo(current, e, stage) {
  const p = e.priority.p,
    g = goal(current, p, stage),
    c = p.profile.components.find((c) => c.id === stage),
    t = target(current, p, stage, g?.objective || current.settings.objective),
    r = result(current, p);
  const method = {
    automatic: `${current.settings.objective === "marksman" ? "Marksman" : "Pass"} first. First attempts come first, then attainable goals with the smallest proportional score gap.`,
    lowest: "Lowest best-stage fraction first.",
    highest: "Highest best-stage fraction first.",
    first:
      "First attempts, then earliest recorded attempt. Firing order is approximated by score-entry time.",
  }[current.settings.order];
  return `${method} ${e.first ? "No complete score yet." : `Best ${ratio(best(current, p, stage), c.max)}. ${r.total === null ? `Suggested ${ratio(t, c.max)}.` : `Total ${ratio(r.total, p.profile.total)}.`}`} ${isCS(current) ? `The ${e.members.length}-firer detail stays together. Its priority follows ${p.name}.` : ""} ${e.errors.join(" ")} These are planning suggestions, not stage pass standards or a prediction of improvement.`;
}
function renderFinal() {
  const current = s(),
    cs = stages(current),
    rr = current.participants.map((p) => result(current, p));
  $("#main").innerHTML =
    shootPicker(
      '<span class="spacer"></span><button data-action="csv">Export scores</button>',
    ) +
    `<div class="summary-line">${["Marksman", "Pass", "Fail", "Incomplete"].map((label) => `<span><strong>${rr.filter((r) => r.status === label).length}</strong> ${label}</span>`).join("")}</div>` +
    (current.participants.length
      ? current.details
          .filter((d) => members(current, d.id).length)
          .map(
            (d) =>
              `<section class="panel"><div class="detail-head"><h3>${esc(d.name)}</h3></div><div class="table-wrap"><table><thead><tr><th>Full name</th>${cs.map((c) => `<th>${esc(c.label)}</th>`).join("")}<th>Total</th><th>Result</th><th></th></tr></thead><tbody>${members(
                current,
                d.id,
              )
                .map((p) => {
                  const r = result(current, p);
                  return `<tr><td class="name">${esc(p.name)}</td>${p.profile.components.map((c, i) => `<td class="num" title="${esc(bestAttempt(current, p, c.id)?.weapon || p.weapon)}">${ratio(r.scores[i], c.max)}</td>`).join("")}<td class="num"><b>${ratio(r.total, p.profile.total)}</b></td><td>${badge(r.status)}</td><td><button class="more" data-person="${p.id}" aria-label="Options for ${esc(p.name)}">⋯</button></td></tr>`;
                })
                .join("")}</tbody></table></div></section>`,
          )
          .join("")
      : empty("No scores yet"));
}
function targetSample(current, p) {
  const objective = current.settings.objective,
    goalName = objective === "marksman" ? "Marksman" : "Pass",
    components = p.profile.components;
  if (current.program === "BTP") {
    const a = target(current, p, "A"),
      remaining = Math.max(0, p.profile[objective] - a);
    return `${ratio(a, 16)} in Stage A requires ${ratio(remaining, 16)} in Stage B for ${goalName} (${ratio(p.profile[objective], 32)}).`;
  }
  const configured = components.slice(0, -1),
    last = components.at(-1),
    sum = configured.reduce((n, c) => n + (target(current, p, c.id) ?? 0), 0),
    needed = Math.max(0, p.profile[objective] - sum);
  return `${configured.map((c) => `${c.label} ${ratio(target(current, p, c.id), c.max)}`).join(" + ")} requires ${last.label} ${ratio(needed, last.max)} for ${goalName} (${ratio(p.profile[objective], p.profile.total)}).`;
}
function renderSettings() {
  const active = s();
  $("#main").innerHTML =
    `<div class="settings"><div class="heading"><h2>Settings</h2></div>${Object.entries(
      PROGRAMS,
    )
      .map(([program, label]) => {
        const variant = program === "APS" ? store.aps : "standard",
          current = getShoot(store, program),
          p = {
            weapon: current.settings.weapon,
            profile: profileFor(program, variant, current.settings.weapon),
          },
          on = store.enabled.includes(program),
          rule = DETAIL_RULES[program];
        return `<section class="preset ${openPresets.has(program) ? "open" : ""}"><div class="preset-head"><button class="expand" data-expand="${program}" aria-expanded="${openPresets.has(program)}">${label}</button><button class="toggle" role="switch" aria-checked="${on}" data-enable="${program}" aria-label="Enable ${label}"></button></div><div class="preset-body">${program === "APS" ? `<div class="seg" style="margin-bottom:14px"><button data-aps="standard" class="${store.aps === "standard" ? "on" : ""}">APS</button><button data-aps="ns" class="${store.aps === "ns" ? "on" : ""}">APS (NS)</button></div>` : ""}<label class="field inline"><span>Rifle</span><select data-default-weapon="${program}" aria-label="${label} default rifle">${option(weaponsFor(program, variant), current.settings.weapon)}</select></label>${rule ? `<p class="limit">${rule.min ? `${rule.min}–${rule.max} firers per detail.` : `Maximum ${rule.max} firers per detail.`}${rule.nonSAR ? " Up to 2 non-SAR21 weapons total." : ""}${program === "ATP_SP" ? " No LMG." : ""}</p>` : ""}<form data-target-form="${program}"><label class="field inline"><span>Automatic</span><select data-objective="${program}" aria-label="${label} Automatic priority"><option value="marksman" ${current.settings.objective === "marksman" ? "selected" : ""}>Marksman first</option><option value="pass" ${current.settings.objective === "pass" ? "selected" : ""}>Pass first</option></select></label><span class="muted">Suggested scores</span>${targetStages(
          current,
        )
          .map((c) => {
            const max = p.profile.components.find((x) => x.id === c.id).max;
            return `<div class="target-row"><label for="target-${program}-${c.id}">${esc(c.label)}</label><input id="target-${program}-${c.id}" name="${c.id}" type="number" min="0" max="${max}" step="1" required value="${target(current, p, c.id)}" aria-label="${label} ${c.label} suggested score"><span class="muted">/${max}</span></div>`;
          })
          .join(
            "",
          )}<p class="note sample">${esc(targetSample(current, p))}</p><button type="submit">Save suggestions</button></form><details class="reference"><summary>Scoring rules</summary><p>Pass ${ratio(p.profile.pass, p.profile.total)} · Marksman ${ratio(p.profile.marksman, p.profile.total)}.</p>${isCS(current) ? "<p>A/C: floor(detail hits ÷ roster count), then keep each firer’s best earned average. Stage B uses individual hits.</p>" : ""}<p>Source ${p.profile.source} · ${p.profile.version}</p></details></div></section>`;
      })
      .join(
        "",
      )}<div class="settings-section"><h3>Data</h3><div class="actions"><button data-action="backup">Export backup</button><button data-action="restore">Restore backup</button>${active ? '<button data-action="new-roster">New roster</button>' : ""}</div><p class="note" id="offline-note">${offlineReady ? "Available offline. Rosters, scores, and unfinished entries are saved on this device." : "Preparing offline files…"}</p>${store.archives.length ? `<details class="reference"><summary>Earlier records (${store.archives.length})</summary>${store.archives.map((a) => `<p>${esc(a.label)} <button class="inline-link" data-archive="${a.id}">View</button></p>`).join("")}</details>` : ""}</div></div>`;
}
function dialog(title, body, label, submit) {
  const d = $("#dialog");
  d.innerHTML = `<form id="dialog-form"><h2 id="dialog-title">${esc(title)}</h2>${body}<div class="error" role="alert"></div><div class="dialog-actions"><button type="button" id="close-dialog">Close</button>${label ? `<button type="submit" class="primary">${esc(label)}</button>` : ""}</div></form>`;
  if (!d.open) d.showModal();
  $("#close-dialog").onclick = () => d.close();
  $("#dialog-form").onsubmit = (ev) => {
    ev.preventDefault();
    try {
      submit?.(new FormData(ev.target));
    } catch (e) {
      d.querySelector(".error").textContent = e.message;
    }
  };
}
function addDialog(detailId) {
  const current = s();
  dialog(
    "Add participants",
    `<label class="field"><span>Full names · one per line</span><textarea name="names" required autofocus></textarea></label><div class="form-grid"><label class="field"><span>Rifle</span><select name="weapon">${option(weaponsFor(current.program, current.variant), current.settings.weapon)}</select></label><label class="field"><span>Detail</span><select name="detail">${current.details.map((d) => `<option value="${d.id}" ${d.id === detailId ? "selected" : ""}>${esc(d.name)}</option>`).join("")}<option value="new" ${!detailId ? "selected" : ""}>New detail</option></select></label></div>`,
    "Add",
    (f) => {
      let d = current.details.find((d) => d.id === f.get("detail")),
        created = false;
      if (!d) {
        d = addDetail(current);
        created = true;
      }
      try {
        addParticipants(
          current,
          f.get("names").split(/\r?\n/),
          f.get("weapon"),
          d.id,
        );
      } catch (e) {
        if (created)
          current.details = current.details.filter((x) => x.id !== d.id);
        throw e;
      }
      save();
      $("#dialog").close();
      render();
    },
  );
}
function personDialog(id) {
  const current = s(),
    p = current.participants.find((p) => p.id === id);
  dialog(
    p.name,
    `<label class="field"><span>Full name</span><input name="name" value="${esc(p.name)}" required></label><div class="form-grid"><label class="field"><span>Rifle</span><select name="weapon">${option(weaponsFor(current.program, current.variant), p.weapon)}</select></label><label class="field"><span>Detail</span><select name="detail">${current.details.map((d) => `<option value="${d.id}" ${d.id === p.detailId ? "selected" : ""}>${esc(d.name)}</option>`).join("")}<option value="new">New detail</option></select></label></div><label class="field"><span>Correction reason · required when changing recorded data</span><input name="reason"></label><div class="actions">${p.profile.components.map((c) => `<button type="button" data-manual="${c.id}">Enter ${esc(c.label)}</button>`).join("")}</div><div class="actions" style="margin-top:8px"><button type="button" id="history">History</button>${p.profile.excluded?.length ? '<button type="button" id="sighting">Sighting</button>' : ""}<button type="button" id="reshoot">Queue reshoot</button><button type="button" class="danger" id="remove">Remove</button></div>`,
    "Save",
    (f) => {
      let detailId = f.get("detail"),
        created;
      if (detailId === "new") {
        created = addDetail(current);
        detailId = created.id;
      }
      try {
        updateParticipant(
          current,
          id,
          { name: f.get("name"), weapon: f.get("weapon"), detailId },
          f.get("reason"),
        );
      } catch (e) {
        if (created)
          current.details = current.details.filter((d) => d.id !== created.id);
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
      removeParticipant(current, id);
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
      `<label class="field"><span>Stage</span><select name="stage">${p.profile.components.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join("")}</select></label>`,
      "Queue",
      (f) => {
        manualQueue(current, p, f.get("stage"));
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
          const stage = b.dataset.manual;
          if (isCS(current)) {
            $("#dialog").close();
            tab = `stage:${stage}`;
            search = "";
            render();
            $(`[data-detail="${p.detailId}"]`).scrollIntoView({
              block: "center",
            });
            return;
          }
          manualDialog(p, stage);
        }),
    );
}
function manualDialog(p, stage) {
  const current = s(),
    c = p.profile.components.find((c) => c.id === stage);
  dialog(
    `${p.name} · ${c.label}`,
    `<label class="field"><span>Hits /${c.max}</span><input name="hits" type="number" min="0" max="${c.max}" step="1" required autofocus></label><label class="field"><span>Note (optional)</span><input name="reason"></label>`,
    "Save score",
    (f) => {
      recordIndividual(
        current,
        p,
        stage,
        f.get("hits"),
        p.weapon,
        f.get("reason"),
      );
      save();
      $("#dialog").close();
      render();
    },
  );
}
function sightingDialog(p) {
  const current = s();
  dialog(
    `${p.name} · Sighting`,
    `<label class="field"><span>Practice</span><select name="practice">${p.profile.excluded.map((c, i) => `<option value="${i}">${esc(c.label)} /${c.max}</option>`).join("")}</select></label><label class="field"><span>Hits</span><input name="hits" type="number" min="0" step="1" required></label>`,
    "Save",
    (f) => {
      const c = p.profile.excluded[Number(f.get("practice"))],
        parsed = parseHits(f.get("hits"), c.max);
      if (parsed.error) throw Error(parsed.error);
      current.sightings ??= [];
      current.sightings.push({
        id: uid(),
        participantId: p.id,
        recordId: p.recordId,
        weapon: p.weapon,
        profile: structuredClone(p.profile),
        practice: c.label,
        hits: parsed.value,
        at: now(),
        recorder: "Local device",
      });
      audit(current, "Sighting recorded", { participantId: p.id });
      save();
      $("#dialog").close();
      render();
    },
  );
}
function historyDialog(p) {
  const current = s(),
    attempts = current.attempts
      .filter((a) => a.participantId === p.id)
      .toReversed(),
    pending = current.dispatches.filter(
      (d) => d.status === "awaiting" && d.roster.some((m) => m.id === p.id),
    );
  dialog(
    `${p.name} · History`,
    pending
      .map(
        (d) =>
          `<div class="history-row"><div>Stage ${esc(d.stage)} · Awaiting scores</div><button type="button" data-cancel="${d.id}">Cancel detailing</button></div>`,
      )
      .join("") +
      attempts
        .map((a) => {
          const shared = current.shared.find((d) => d.id === a.detailAttemptId),
            max = a.profile.components.find((c) => c.id === a.stage).max;
          return `<div class="history-row"><div><b>Stage ${esc(a.stage)} · ${ratio(a.score, max)}</b> ${a.status === "void" ? badge("Voided") : ""}<p>${esc(a.weapon)} · ${new Date(a.recordedAt).toLocaleString("en-US")}${shared && isCS(current) && ["A", "C"].includes(a.stage) ? `<br>${shared.aggregateHits}/${shared.divisor} → ${a.score}. ${shared.inputMode === "aggregate" ? "Aggregate only; individual hits not supplied." : "Individual hits reconciled."}` : ""}${a.correction ? `<br>${esc(a.correction.reason)}` : ""}</p></div>${a.status === "valid" ? `<button type="button" data-correct="${a.id}">Correct</button>` : ""}</div>`;
        })
        .join("") +
      (current.sightings || [])
        .filter((a) => a.participantId === p.id)
        .map(
          (a) =>
            `<div class="history-row"><div>${esc(a.practice)} · ${a.hits}<p>Excluded from scored totals</p></div></div>`,
        )
        .join("") +
      (!attempts.length && !pending.length
        ? '<p class="note">No scored attempts.</p>'
        : ""),
    null,
  );
  $("#dialog")
    .querySelectorAll("[data-correct]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const a = current.attempts.find((a) => a.id === b.dataset.correct),
            affected = a.detailAttemptId
              ? current.attempts.filter(
                  (x) => x.detailAttemptId === a.detailAttemptId,
                ).length
              : 1;
          dialog(
            "Correct score",
            `${affected > 1 ? `<p class="note">This shared record affects ${affected} firers.</p>` : ""}<label class="field"><span>Correction reason</span><input name="reason" required autofocus></label>`,
            "Void score",
            (f) => {
              voidAttempt(current, a.id, f.get("reason"));
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
          const d = current.dispatches.find((d) => d.id === b.dataset.cancel);
          d.status = "canceled";
          audit(current, "Detailing canceled", { dispatchId: d.id });
          save();
          render();
          historyDialog(p);
        }),
    );
}
function pasteDialog(detailId, stage) {
  const current = s(),
    d = current.details.find((d) => d.id === detailId);
  dialog(
    `${d.name} · Paste scores`,
    `<p class="note">One full name and hit count per line, separated by a tab or comma. Include everyone in this detail.</p><textarea name="scores" placeholder="Full name,12" required autofocus></textarea><details class="reference"><summary>Participant IDs (for duplicate names)</summary>${members(
      current,
      detailId,
    )
      .map((p) => `<p>${esc(p.name)} <span class="small-id">${p.id}</span></p>`)
      .join("")}</details>`,
    "Paste",
    (f) => {
      pasteScores(current, getDraft(current, detailId, stage), f.get("scores"));
      save();
      $("#dialog").close();
      render();
    },
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
function backup() {
  download(
    `detail-ic-${now().slice(0, 10)}.json`,
    JSON.stringify(store, null, 2),
  );
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
        const incoming = validateStore(JSON.parse(await file.text()));
        for (const [key, shoot] of Object.entries(incoming.shoots)) {
          if (store.shoots[key]?.participants.length)
            store.archives.push({
              id: uid(),
              label: `${PROGRAMS[store.shoots[key].program]} · before restore`,
              savedAt: now(),
              shoot: structuredClone(store.shoots[key]),
            });
          store.shoots[key] = structuredClone(shoot);
        }
        store.archives.push(
          ...incoming.archives.map((a) => ({ ...a, id: uid() })),
        );
        store.enabled = [...new Set([...store.enabled, ...incoming.enabled])];
        store.aps = incoming.aps;
        store.active =
          incoming.active && store.enabled.includes(incoming.active)
            ? incoming.active
            : store.enabled[0] || null;
        save();
        $("#dialog").close();
        tab = "participants";
        render();
        toast("Backup restored. Previous rosters are in Earlier records.");
      } catch (e) {
        $("#dialog .error").textContent = e.message;
      }
    },
  );
}
function archiveDialog(id) {
  const archive = store.archives.find((a) => a.id === id);
  const shoots = archive.shoot ? [archive.shoot] : [];
  dialog(
    archive.label,
    `<p class="note">Read-only history.</p>${shoots
      .map(
        (shoot) =>
          `<h3>${esc(PROGRAMS[shoot.program] || shoot.program)}</h3><div class="table-wrap"><table><thead><tr><th>Name</th><th>Weapon</th><th>Recorded attempts</th></tr></thead><tbody>${shoot.participants
            .map(
              (p) =>
                `<tr><td>${esc(p.name)}</td><td>${esc(p.weapon)}</td><td>${
                  (shoot.attempts || [])
                    .filter((a) => a.participantId === p.id)
                    .map(
                      (a) =>
                        `<div>Stage ${esc(a.stage)}: ${a.score}${a.status === "void" ? " (voided)" : ""}</div>`,
                    )
                    .join("") || "—"
                }</td></tr>`,
            )
            .join("")}</tbody></table></div>`,
      )
      .join(
        "",
      )}<div class="actions" style="margin-top:15px"><button type="button" id="export-archive">Export original records</button></div>`,
    null,
  );
  $("#export-archive").onclick = () =>
    download(
      "detail-ic-earlier-records.json",
      JSON.stringify(archive, null, 2),
    );
}
function refreshDraft(panel, current, draft) {
  const errors = detailErrors(current, draft),
    v = validateDraft(current, draft);
  panel.querySelector(".draft-errors").textContent = errors.join("\n");
  if (v.shared) {
    const max = stages(current).find((c) => c.id === draft.stage).max;
    panel.querySelector(".draft-summary").textContent =
      v.score === null
        ? "Draft saved"
        : `Average: ${v.aggregate}/${v.divisor} → ${v.score}/${max}`;
    const all = panel.querySelector("[data-all-present]");
    if (all) all.checked = draft.rows.every((r) => r.accounted);
  }
  save();
}
function saveScores(detailId, stage) {
  const current = s(),
    draft = getDraft(current, detailId, stage);
  try {
    if (isCS(current)) saveDetail(current, draft);
    else {
      const errors = detailErrors(current, draft);
      if (errors.length) throw Error(errors.join("\n"));
      const entered = draft.rows.filter((r) => r.hits !== "");
      if (!entered.length) throw Error("Enter at least one score.");
      for (const row of entered) {
        const p = current.participants.find((p) => p.id === row.participantId);
        recordIndividual(current, p, stage, row.hits, row.weapon);
      }
      for (const row of entered) {
        row.hits = "";
        row.accounted = false;
      }
    }
    save();
    render();
    toast("Scores saved.");
  } catch (e) {
    const panel = $(`[data-detail="${detailId}"]`);
    panel.querySelector(".draft-errors").textContent = e.message;
    save();
  }
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
  const current = s();
  if (e.target.id === "search") {
    search = e.target.value;
    const pos = e.target.selectionStart;
    render();
    $("#search").focus();
    $("#search").setSelectionRange(pos, pos);
    return;
  }
  if (e.target.matches("[data-hits],[data-aggregate]")) {
    const panel = e.target.closest("[data-detail]"),
      stage = tab.split(":")[1],
      draft = getDraft(current, panel.dataset.detail, stage);
    if (e.target.dataset.hits) {
      const row = draft.rows.find(
        (r) => r.participantId === e.target.dataset.hits,
      );
      row.hits = e.target.value;
      if (row.hits !== "") {
        row.accounted = true;
        const cb = panel.querySelector(`[data-present="${row.participantId}"]`);
        if (cb) cb.checked = true;
      }
    } else draft.aggregate = e.target.value;
    draft.updatedAt = now();
    refreshDraft(panel, current, draft);
  }
  if (e.target.closest("[data-target-form]")) {
    const form = e.target.closest("[data-target-form]"),
      program = form.dataset.targetForm,
      shoot = getShoot(store, program),
      p = {
        weapon: shoot.settings.weapon,
        profile: profileFor(program, shoot.variant, shoot.settings.weapon),
      },
      draft = structuredClone(shoot);
    for (const c of targetStages(shoot)) {
      const input = form.elements[c.id];
      if (input.validity.valid && input.value !== "")
        draft.settings.targets[
          `${p.weapon}:${c.id}:${shoot.settings.objective}`
        ] = Number(input.value);
    }
    form.querySelector(".sample").textContent = targetSample(draft, p);
  }
});
$("#main").addEventListener("change", (e) => {
  const current = s(),
    t = e.target;
  if (t.id === "shoot") {
    store.active = t.value;
    search = "";
    selected.clear();
    save();
    render();
  } else if (t.id === "fill-weapon") {
    current.settings.weapon = t.value;
    save();
  } else if (t.dataset.queue) {
    t.checked
      ? selected.add(t.dataset.queue)
      : selected.delete(t.dataset.queue);
    const q = queue(current, tab.split(":")[1]);
    $("#detailed").disabled = !selected.size;
    $("#detailed").textContent =
      `Mark detailed${selected.size ? ` (${q.filter((e) => selected.has(e.key)).reduce((n, e) => n + e.members.length, 0)})` : ""}`;
  } else if (
    t.matches("[data-stage-weapon],[data-present],[data-all-present]")
  ) {
    const panel = t.closest("[data-detail]"),
      stage = tab.split(":")[1],
      draft = getDraft(current, panel.dataset.detail, stage);
    if (t.dataset.stageWeapon)
      draft.rows.find((r) => r.participantId === t.dataset.stageWeapon).weapon =
        t.value;
    else if (t.dataset.present)
      draft.rows.find((r) => r.participantId === t.dataset.present).accounted =
        t.checked;
    else {
      for (const row of draft.rows) row.accounted = t.checked;
      panel
        .querySelectorAll("[data-present]")
        .forEach((cb) => (cb.checked = t.checked));
    }
    draft.updatedAt = now();
    refreshDraft(panel, current, draft);
    if (t.dataset.stageWeapon) render();
  } else if (t.dataset.defaultWeapon) {
    getShoot(store, t.dataset.defaultWeapon).settings.weapon = t.value;
    save();
    render();
  } else if (t.dataset.objective) {
    getShoot(store, t.dataset.objective).settings.objective = t.value;
    save();
    render();
  }
});
$("#main").addEventListener("submit", (e) => {
  const form = e.target.closest("[data-target-form]");
  if (!form) return;
  e.preventDefault();
  const current = getShoot(store, form.dataset.targetForm);
  for (const c of targetStages(current))
    current.settings.targets[
      `${current.settings.weapon}:${c.id}:${current.settings.objective}`
    ] = Number(form.elements[c.id].value);
  audit(current, "Suggested scores changed", {
    targets: structuredClone(current.settings.targets),
  });
  save();
  render();
  toast("Suggestions saved.");
});
$("#main").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const current = s();
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
      store.aps = b.dataset.aps;
      save();
      render();
      return;
    }
    if (b.dataset.person) {
      personDialog(b.dataset.person);
      return;
    }
    if (b.dataset.addDetail) {
      addDialog(b.dataset.addDetail);
      return;
    }
    if (b.dataset.paste) {
      pasteDialog(b.dataset.paste, tab.split(":")[1]);
      return;
    }
    if (b.dataset.reset) {
      resetDraft(current, b.dataset.reset, tab.split(":")[1]);
      save();
      render();
      return;
    }
    if (b.dataset.saveScores) {
      saveScores(b.dataset.saveScores, tab.split(":")[1]);
      return;
    }
    if (b.dataset.archive) {
      archiveDialog(b.dataset.archive);
      return;
    }
    switch (b.dataset.action) {
      case "settings":
        tab = "settings";
        render();
        break;
      case "participants":
        tab = "participants";
        render();
        break;
      case "add":
        addDialog();
        break;
      case "fill-all":
        fillWeapons(current, $("#fill-weapon").value);
        save();
        render();
        toast("Rifle applied to everyone.");
        break;
      case "select-all":
        selected = new Set(
          queue(current, tab.split(":")[1])
            .filter((e) => !e.errors.length)
            .map((e) => e.key),
        );
        render();
        break;
      case "backup":
        backup();
        break;
      case "restore":
        restore();
        break;
      case "csv":
        download(
          "detail-ic-scores.csv",
          "\ufeff" + exportCsv(current),
          "text/csv;charset=utf-8",
        );
        break;
      case "new-roster":
        dialog(
          "New roster",
          '<p class="note">The current roster and all its scores will be kept in Earlier records.</p>',
          "Start new roster",
          () => {
            store.archives.push({
              id: uid(),
              label: `${PROGRAMS[current.program]} · previous roster`,
              savedAt: now(),
              shoot: structuredClone(current),
            });
            store.shoots[shootKey(current.program, current.variant)] = newShoot(
              current.program,
              current.variant,
            );
            save();
            $("#dialog").close();
            tab = "participants";
            render();
          },
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
          "Available offline. Rosters, scores, and unfinished entries are saved on this device.";
    })
    .catch(() => {
      if ($("#offline-note"))
        $("#offline-note").textContent =
          "Offline setup failed. Reload while connected to try again.";
    });
}
