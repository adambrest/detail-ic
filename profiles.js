export const VERSION = "2026-09-19.1";
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
// variant scores the same, so they are one option. M16 is out of service.
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
// Reference evidence is intentionally excluded from selectors and grading.
export const REFERENCE_ONLY = [
  {
    program: "ATP_SP",
    weapon: "LMG",
    limits: [60, 8, 40],
    total: 108,
    pass: 27,
    marksman: 54,
    source: "S11",
    eligibility: "excluded_by_user",
  },
];
// Rifles a whole shoot can be set to. Combat Shoot assigns M16 and LMG per firer,
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
    options.find((w) => w === name || w.split("/").some((n) => names.includes(n))) ??
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
    throw Error(`${weapon} is not supported for ${typeLabel(program, variant)}.`);
  return structuredClone(p);
}
export function stages(s) {
  return profileFor(s.program, s.variant, s.settings.weapon).components;
}
// Every scored stage can be given a starting threshold. On a two-stage shoot
// like BTP only one of them really needs one: once either stage is scored, the
// other's threshold becomes exactly what is still needed. It is offered for
// both so whichever is fired first has a sensible figure waiting.
export function targetStages(s) {
  return stages(s);
}
