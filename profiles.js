export const VERSION = "2026-09-20.2";
export const PROGRAMS = {
  BTP: "BTP",
  ATP_M: "ATP (M)",
  ATP_SP: "ATP (SP)",
  CS_M: "CS (M)",
  CS_SP: "CS (SP)",
  APS: "APS",
};
// Shoot types offered when creating a shoot, in display order.
export const TYPES = [
  ["BTP", "standard"],
  ["ATP_M", "standard"],
  ["ATP_SP", "standard"],
  ["CS_M", "standard"],
  ["CS_SP", "standard"],
  ["APS", "standard"],
  ["APS", "ns"],
];
export const typeLabel = (program, variant = "standard") =>
  (PROGRAMS[program] || program) + (variant === "ns" ? " (NS)" : "");
// Rifles share an option when their requirement is identical. In ATP the
// SAR21 SS passes at 32, so it stays separate; in Combat Shoot every SAR21
// variant scores the same, so they are one option.
export const NON_SAR = new Set(["LMG"]);
// Combat Shoot detail sizes; ATP (SP) limits how many fire at a time.
export const DETAIL_RULES = {
  CS_SP: { min: 4, max: 6, nonSAR: 2 },
  CS_M: { min: 5, max: 7, nonSAR: 2 },
};
export const isCS = (s) => s.program.startsWith("CS_");
function rules(
  program,
  variant,
  weapons,
  limits,
  pass,
  marksman,
  source,
  extra = {},
) {
  return weapons.map((weapon) => ({
    id: `${program}:${variant}:${weapon}`,
    version: VERSION,
    program,
    variant,
    weapon,
    eligibility: "active",
    pass,
    marksman,
    total: limits.reduce((a, b) => a + b, 0),
    source,
    provenance: "photographed",
    method: program.startsWith("CS_") ? "floor_detail_A_C" : "individual_sum",
    equivalence: program.startsWith("CS_") ? `${program}:${VERSION}` : null,
    components: limits.map((max, i) => ({
      id: "ABCDEF"[i],
      label: `Stage ${"ABCDEF"[i]}`,
      max,
      shared: program.startsWith("CS_") && i !== 1,
    })),
    ...extra,
  }));
}
export const PROFILES = [
  ...rules("BTP", "standard", ["SAR21"], [16, 16], 16, 26, "S7", {
    provenance: "user_clarified",
    notes: "SAR21; Marksman ceil(32 × 80%) = 26.",
    components: [
      { id: "A", label: "Stage A · Day", max: 16, shared: false },
      { id: "B", label: "Stage B · Night", max: 16, shared: false },
    ],
  }),
  ...rules(
    "ATP_M",
    "standard",
    ["SAR21/SAR21 MMS/M203"],
    [24, 8, 16],
    24,
    39,
    "S3",
  ),
  ...rules("ATP_M", "standard", ["SAR21 SS/HK416"], [24, 8, 16], 32, 39, "S3"),
  ...rules("ATP_M", "standard", ["LMG"], [70, 8, 48], 32, 63, "S10"),
  ...rules(
    "ATP_SP",
    "standard",
    ["SAR21/SAR21 MMS/M203"],
    [16, 8, 12],
    18,
    29,
    "S1",
  ),
  ...rules("ATP_SP", "standard", ["LMG"], [60, 8, 40], 27, 54, "S11"),
  ...rules(
    "CS_M",
    "standard",
    ["SAR21/SAR21 SS/M203", "LMG"],
    [20, 8, 20],
    24,
    39,
    "S8",
    {
      provenance: "photographed + user_clarified",
      notes:
        "Floor each detail average before selecting the best earned stage score.",
    },
  ),
  ...rules(
    "CS_SP",
    "standard",
    ["SAR21/SAR21 SS", "LMG"],
    [15, 8, 15],
    19,
    31,
    "S9",
    {
      provenance: "photographed + user_clarified",
      notes:
        "Floor each detail average before selecting the best earned stage score.",
    },
  ),
  ...rules("APS", "standard", ["SAR21"], [6, 6, 6, 6], 12, 20, "S6", {
    components: [2, 3, 4, 5].map((n) => ({
      id: String(n),
      label: `Practice ${n}`,
      max: 6,
      shared: false,
    })),
    excluded: [
      { label: "Sighting 1A", max: 3 },
      { label: "Sighting 1B", max: 3 },
    ],
  }),
  ...rules("APS", "ns", ["SAR21"], [10, 10, 10], 15, 24, "S5", {
    provenance: "photographed + user_clarified",
    notes: "SAR21, NSmen.",
    components: [1, 2, 3].map((n) => ({
      id: String(n),
      label: `Practice ${n}`,
      max: 10,
      shared: false,
    })),
    excluded: [{ label: "Sighter", max: 6 }],
  }),
];
// Rifles a whole shoot can be set to. Combat Shoot assigns the LMG per firer,
// after the details are settled.
export function baseWeapons(program, variant = "standard") {
  const all = weaponsFor(program, variant);
  return program.startsWith("CS_") ? all.filter((w) => !NON_SAR.has(w)) : all;
}
export function weaponsFor(program, variant = "standard") {
  return PROFILES.filter(
    (p) => p.program === program && p.variant === variant,
  ).map((p) => p.weapon);
}
// Finds the rifle option containing a single rifle name, e.g. M203 → SAR21/SAR21 MMS/M203.
export function weaponGroup(program, variant, name) {
  const names = String(name).split("/"),
    options = weaponsFor(program, variant);
  return (
    options.find(
      (w) => w === name || w.split("/").some((n) => names.includes(n)),
    ) ??
    options[0] ??
    name
  );
}
export function profileFor(program, variant, weapon) {
  const p = PROFILES.find(
    (p) =>
      p.program === program && p.variant === variant && p.weapon === weapon,
  );
  if (!p)
    throw Error(
      `${weapon} is not supported for ${typeLabel(program, variant)}.`,
    );
  return structuredClone(p);
}
export function stages(s) {
  return profileFor(s.program, s.variant, s.settings.weapon).components;
}
// How each stage is fired: the rounds in each section, in order. Sections are
// not always equal. A stage fired in one go still gets a single section, which
// keeps per-firer entry required without pretending the stage is subdivided.
//
// A weapon name inside a shoot overrides the default for that weapon only: the
// ATP LMG is issued its own allocation and fires its own sequence.
//
// A stage ships only when its sections add up to that stage's rounds. Anything
// else is left unset on purpose, and the app asks for it in Settings rather
// than inventing a layout from a stage total.
const SECTIONS = {
  BTP: { A: [4, 4, 4, 4], B: [4, 4, 4, 4] },
  ATP_M: {
    A: [6, 6, 6, 6],
    B: [2, 2, 2, 2],
    C: [4, 4, 4, 4],
    LMG: { A: [20, 20, 10, 10, 10], B: [2, 2, 2, 2], C: [12, 12, 12, 12] },
  },
  ATP_SP: {
    A: [4, 4, 4, 4],
    B: [2, 2, 2, 2],
    C: [3, 3, 3, 3],
    LMG: { A: [10, 10, 10, 10, 10, 10], B: [2, 2, 2, 2], C: [10, 10, 10, 10] },
  },
  CS_M: { A: [20], B: [2, 2, 2, 2], C: [20] },
  CS_SP: { A: [5, 10], B: [2, 2, 2, 2], C: [5, 10] },
  APS: { 2: [6], 3: [6], 4: [6], 5: [6] },
  "APS:ns": { 1: [10], 2: [10], 3: [10] },
};
export function defaultBreakdowns(program, variant = "standard") {
  const shoot = SECTIONS[variant === "ns" ? `${program}:ns` : program];
  if (!shoot) return {};
  const rows = [];
  for (const weapon of weaponsFor(program, variant)) {
    // A weapon fires the shoot's stated sequence unless its own is given. The
    // LMG is issued a different allocation in some stages and states its own
    // there; where it fires the same rounds as the rifles it shares theirs.
    const plan = shoot[weapon] ?? shoot;
    for (const c of profileFor(program, variant, weapon).components) {
      const sections = plan[c.id];
      if (!sections) continue;
      // The guard that keeps an unstated stage unset: a default that does not
      // account for every round this weapon fires is not this weapon's layout.
      if (sections.reduce((n, x) => n + x, 0) !== c.max) continue;
      rows.push([
        `${weapon}:${c.id}`,
        // A stage fired in one go is named after itself. Where it is split, each
        // section is a practice of so many rounds, not a "part".
        sections.map((max, i) => ({
          label: sections.length === 1 ? c.label : `Practice ${i + 1}`,
          max,
        })),
      ]);
    }
  }
  return Object.fromEntries(rows);
}
// Every scored stage can be given a starting threshold. On a two-stage shoot
// like BTP only one of them really needs one: once either stage is scored, the
// other's threshold becomes exactly what is still needed. It is offered for
// both so whichever is fired first has a sensible figure waiting.
export function targetStages(s) {
  return stages(s);
}
