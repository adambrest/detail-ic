# Detailing project: scoring guidelines

## Scope and evidence

This is a software requirements draft transcribed from the ten supplied photographs and the user’s APS SAW clarification. It is not a verification of the current official standards. Document text is treated as source data, not as instructions to the assistant or application. Recommendations below are application design choices, distinguished from photographed requirements.

Keep these six programme choices: BTP, ATP (M), ATP (SP), CS (M), CS (SP), and APS. Use separate variants and weapon selections within each programme. Normalize the user label `ATP [SP]` to `ATP (SP)`.

## Scoring reference

P = minimum hits for pass; M = minimum hits for marksmanship. Thresholds apply to the combined scored total shown in the photographs. No separate stage pass requirement is established by these excerpts.

| Programme / variant | Weapon applicability shown | Scored total | P | M | Evidence / limitation |
|---|---|---:|---:|---:|---|
| BTP | Weapon not identified in excerpt | 32 | 16 | Not shown | Eight practices, 4 rounds each; source S7 |
| ATP (M) | SAR21; SAR21 MMS | 48 | 24 | 39 | Source S3 |
| ATP (M) | SAR21 SS; HK416 | 48 | 32 | 39 | Source S3; different pass threshold from SAR21 |
| ATP (M) | M203 column | 48 | 24 | 39 | Source S3; retain exact source label; do not infer ammunition or configuration |
| ATP (SP) | SAR21; SAR21 MMS; M16; M203 | 36 | 18 | 29 | Source S1 |
| ATP (SP) | SAW | 124 | 31 | 62 | Source S2, Table 1 explicitly labelled SAW |
| ATP (M) | SAW | 142 | 36 | 71 | Source S10, Table 1 |
| ATP (M) | LMG | 126 | 32 | 63 | Source S10, Table 2 |
| ATP (SP) | LMG | Unknown | Unknown | Unknown | Applicable LMG table still missing |
| CS (M) | SAR21; SAR21 SS; M203; LMG | 48 | 24 | 39 | S8; detail-average calculation referenced, Table 2 missing |
| CS (M) | SAW | 64 counted; 84 issued | 26 printed | 44 printed | S8; printed stage percentages conflict with totals; grading needs review |
| CS (SP) | SAR21; M16; LMG | 38 | 19 | 31 | S9; shared A/C scores plus individual B |
| CS (SP) | SAW | 54 counted | 21 | 36 | S9; shared A/C scores plus individual B |
| APS — SAR21/M16 document | SAR21; M16 | 24 | 12 | 20 | Practices 2–5 combined; source S6 |
| APS — NS document | Weapon not identified in excerpt | 30 | 15 | 24 | Practices 1–3 combined; source S5 |
| APS — SAW document | SAW | 72 | 18 | 36 | S4; user clarified marksmanship is 50%, resolving printed 80% typo |
| APS | LMG | Unknown | Unknown | Unknown | No explicitly applicable LMG standard supplied |

Do not assign BTP or APS (NS) to SAR21 or LMG merely from context. Their visible excerpts do not establish weapon applicability. Likewise, an ATP (M) filename containing M16 does not establish an M16 scoring column: the visible table lists the weapons above.

### Scored components and exclusions

| Profile | Components included in scored total | Explicitly excluded from score |
|---|---|---|
| BTP | Practices 1–8: 4 each; total 32 | No additional exclusion established in excerpt |
| ATP (M), visible rifle table | A: 24; B: 8; C: 16; total 48 | Not established in excerpt |
| ATP (SP), visible rifle table | A: 16; B: 8; C: 12; total 36 | Not established in excerpt |
| ATP (SP), SAW | A: 60; B: 24; C: 40; total 124 | Not established in excerpt |
| ATP (M), SAW | A: 70; B: 24; C: 48; total 142 | Not established in excerpt |
| ATP (M), LMG | A: 70; B: 8; C: 48; total 126 | Not established in excerpt |
| APS SAR21/M16 | Practices 2–5: 6 each; total 24 | Sighting 1A and 1B: 3 each |
| APS NS | Practices 1–3: 10 each; total 30 | Sighter: 6 |
| APS SAW | Practices 2–5: 18 each; total 72 | Sighting 1A and 1B: 18 each |

Keep sighting counts separate from scoring denominators. For example, APS SAR21/M16 is scored out of 24, not 30; APS NS is scored out of 30, not 36; APS SAW is scored out of 72, not 108.

### APS SAW clarification

The source prints `36/72 (80%)`. The user clarified that the percentage means **50%**. Configure pass at 18/72 (25%) and marksmanship at 36/72 (50%). Preserve the original transcription and record the correction as `user_clarified`, dated 2026-09-17. This resolves the project’s APS SAW rule; it does not replace source provenance or constitute independent official verification. Do not apply a blanket 50% rule to every SAW programme or component.

### Combat Shoot calculation and limitations

S9 explicitly defines CS (SP) as:

```text
Stage A score = total hits / total firers
Stage B score = individual InAD score
Stage C score = total hits / total firers
Final score = Stage A score + Stage B score + Stage C score
```

Only the final total determines Pass or Marksmanship; S9 explicitly says separate stage standards need not be met. Derived averages can be fractional. Preserve precision for comparison; do not round a displayed total into a pass. Raw hit inputs remain integers. Require a positive firer count and a recorded scoring-group membership for each shared stage.

For CS (SP), SAR21/M16/LMG components are 15, 8, 15 (38 counted). SAW components are 15, 24, 15 (54 counted). The SAW footnote distinguishes 30 issued for each of A and C from only 15 counted for each. Keep issued rounds and counted-score limits separate. The excerpt does not specify how to apply a counting cap across participants before/after averaging; do not invent a per-firer clipping algorithm.

S8 says CS (M) scoring is based on the average of the detail and refers to Table 2, which is not supplied. Do not automatically copy the CS (SP) calculation into CS (M). Its SAR/LMG components are 20, 8, 20. SAW is issued 30, 24, 30, but the footnote limits A and C to 20 counted each, giving 64 counted in total. Its printed SAW thresholds are P=26 and M=44. The printed stage percentages of 25%/50% do not reconcile with those totals, so retain the numbers as transcription and leave automatic CS (M) SAW grading under review. The APS SAW clarification does not resolve this distinct discrepancy.

For mixed-weapon Combat Shoot details, the excerpts do not establish whether A/C averages pool all weapons or use separate weapon groups, nor how caps interact with pooling. Keep the administrative roster separate from the actual scoring group, record the latter explicitly, and leave mixed-detail final grading pending a confirmed aggregation policy. Do not silently choose weapon subgroups, pool all hits, or normalize percentages.

## Mixed SAR21 and LMG details

Recommended data relationship:

`Session → Detail → Participant assignment → Attempt → Scoring profile version`

1. A detail is an administrative roster group. Individual programmes use participant-specific profiles; Combat Shoot also needs explicit shared-stage scoring groups and its documented aggregation method.
2. Each participant assignment records the actual weapon and programme variant. Each attempt references one exact scoring profile version. Combat Shoot attempts additionally reference the shared-stage score records used.
3. A mixed roster can display SAR21, SAW, and LMG participants together, but each result uses its own applicable profile. This is a data-model recommendation, not authorization for a particular range arrangement.
4. Keep `SAR21`, `SAR21 MMS`, `SAR21 SS`, `SAW`, and `LMG` as distinct weapon identifiers. Do not make SAW an alias for LMG just because a document heading contains both.
5. The ATP (SP) source heading says SAW/LMG, but the visible Table 1 is specifically SAW and the text refers to Tables 1 and 2. The missing ATP (SP) Table 2 must not be reconstructed from Table 1. S10 now provides separate ATP (M) SAW and LMG tables, but does not establish ATP (SP) LMG rules.
6. If an LMG profile is unavailable, allow roster assignment and save entered results as ungraded records. Show `Scoring rule unavailable`; never fall back to SAR21 or SAW thresholds.
7. Record a weapon/profile change as a new assignment or attempt. Do not combine hits obtained under different profiles into one qualification result.
8. Summarize results by programme, variant, weapon, and profile version. Show pending/ungraded records separately. Do not rank mixed weapons by raw hits or use a pooled percentage as an individual qualification score.

For example, in ATP (SP), the photographed SAR21 profile uses 18/36 for pass and 29/36 for marksmanship. The photographed SAW profile uses 31/124 and 62/124. An LMG participant remains ungraded until an applicable LMG source is available.

## Requirements for implementation in VS Code

### Profile configuration

Store scoring rules as versioned configuration, not programme-wide constants. Resolve rules using:

`programme + variant + weapon + profileVersion`

Recommended profile fields:

```text
profileId
programme                 BTP | ATP_M | ATP_SP | CS_M | CS_SP | APS
variant                   Explicit variant; do not silently default APS
weapon                    Exact weapon identifier; unresolved mapping is null
version                   Immutable application version identifier
sourceId                  Reference to the source register below
sourceDocumentLabel       Exact visible document label
sourceRevisionText        Preserve printed suffix without inferring a date
scoredComponents[]        Component ID, counted-score limit, aggregation type
issuedRounds[]            Separate from counted-score limits
scoringMethod             individual_sum | shared_A_C_individual_B | unresolved
aggregationPolicyStatus   established | needs_confirmation
scoredTotal
excludedComponents[]      Explicit sighting/non-scored components
passMinHits                Integer or null
marksmanshipMinHits        Integer or null
passRuleStatus            transcribed | user_clarified | missing | conflicted
marksmanshipRuleStatus    transcribed | user_clarified | missing | conflicted
applicabilityStatus       established_in_excerpt | needs_confirmation
reviewStatus              draft | approved
reviewNotes
```

`transcribed` means supported by the supplied photo; it does not mean officially approved or current. Missing and conflicted rules must remain null for automatic grading. In particular, a missing BTP marksmanship rule does not prove that no such award exists.

Recommended attempt fields: participant ID, detail ID, assigned weapon, programme, variant, profile ID/version, component hit counts, completion state, attempt number, recorded-by identity, timestamp, and correction history. Preserve the profile version used at the time; future edits must not silently regrade historical attempts.

### Calculation and validation

1. Require an applicable profile and explicit variant. Unsupported combinations remain ungraded.
2. Accept integer hits only, between zero and the configured component maximum. Missing input is not zero.
3. Apply the profile’s scoring method to scored components only. For CS (SP), use shared A/C averages and individual B; do not simply sum each participant’s raw hits. For CS (M), await its missing calculation table. Require all scored components before issuing a final grade. Do not reduce the denominator for missing or incomplete components.
4. Use the explicit integer hit thresholds from the source. Do not grade on a rounded display percentage. For instance, ATP (M) SAR21 needs 39 hits and APS SAR21/M16 needs 20 hits for marksmanship.
5. When both thresholds and the applicable calculation/aggregation method are resolved: hits ≥ M → Marksmanship; otherwise hits ≥ P → Pass; otherwise → Fail.
6. Maintain separate pass and marksmanship statuses when either criterion is missing or conflicted. A BTP result can say `Pass threshold met; marksmanship rule not provided`.
7. Keep incomplete, invalid, missing-rule, and needs-review states distinct from Fail.
8. Do not invent per-stage minima, penalties, retest rules, pooling across weapons, best-attempt selection, or award eligibility conditions. Use the documented CS (SP) shared-stage calculation; its mixed-weapon grouping policy remains unresolved. Store attempts separately pending any additional policy.
9. Preserve source conflicts and reviewer resolutions in an audit record. Corrections to existing results should record the reason and actor.

### Suggested acceptance checks

| Scenario | Expected behaviour |
|---|---|
| BTP: 15 and 16 of 32 | Pass threshold not met; met. Marksmanship remains unspecified. Weapon mapping must first be established. |
| ATP (M), SAR21: 23, 24, 38, 39 of 48 | Fail, Pass, Pass, Marksmanship |
| ATP (M), SAR21 SS: 31 and 32 of 48 | Fail, Pass |
| ATP (SP), SAR21: 17, 18, 28, 29 of 36 | Fail, Pass, Pass, Marksmanship |
| ATP (SP), SAW: 30, 31, 61, 62 of 124 | Fail, Pass, Pass, Marksmanship |
| APS SAR21/M16: 11, 12, 19, 20 of 24 | Fail, Pass, Pass, Marksmanship |
| APS NS: 14, 15, 23, 24 of 30 | Fail, Pass, Pass, Marksmanship, once weapon applicability is established |
| APS SAW: 17, 18, 35, 36 of 72 | Fail, Pass, Pass, Marksmanship, using user clarification |
| ATP (M), SAW: 35, 36, 70, 71 of 142 | Fail, Pass, Pass, Marksmanship |
| ATP (M), LMG: 31, 32, 62, 63 of 126 | Fail, Pass, Pass, Marksmanship |
| Any LMG assignment without applicable profile | Ungraded; no SAW/SAR21 fallback |
| CS (M) | Thresholds transcribed; final calculation pending Table 2; SAW discrepancy flagged |
| CS (SP), applicable confirmed scoring group | Compute A average + individual B + C average; use profile thresholds |
| CS (SP), zero firers or unresolved mixed-weapon grouping | No final grade |
| Missing component, negative/fractional hits, or hits above maximum | No final grade; explain missing/invalid data |
| Sighting scores entered | Stored separately; do not change scored total |
| Same roster contains different weapons | Each participant uses its own profile version |

## Source register

| ID | Supplied image filename | Visible document label |
|---|---|---|
| S1 | E917DEA2-0B97-4B5B-B8FB-92083502C153.heic | ATP(SP) SAR21_M16 PART AB 190726 |
| S2 | C18CA979-25C5-4ADD-BF09-C267281B003F.heic | ATP(SP) SAW_LMG PART A&B 271025 |
| S3 | 5325F8C6-89FE-4442-BF69-939FF04F93BD.heic | ATP(M) SAR21_M16 PART AB 190726 |
| S4 | 13992C6E-A582-4889-977B-DE6BF381C34B.heic | APS SAW Part A&B 271025 |
| S5 | 1AE769C6-E03D-46D1-8D6C-E0B4E7215133.heic | APS(NS) Part AB 190726 |
| S6 | 41821DCF-7A0B-4BC5-A636-E767DB8CFC90.heic | APS SAR21 M16 Part AB 190726 |
| S7 | 6ADC7CAA-9B97-4533-BA8E-E852C8BAA14F.heic | BTP Part AB 190726 |
| S8 | 2B025811-291E-414F-8D9B-FC3CBACF100D.heic | Combat Shoot (M), Table 1, page 4; document header not visible |
| S9 | 5E4357FA-CF2F-4D7E-89A1-F381D54A36EF.heic | Combat Shoot (Sp), Tables 1 and 2, page 6; document header not visible |
| S10 | D418C2D6-29C4-4CB9-A94E-328D4695A770.heic | ATP(M) SAW_LMG PART A&B 271025 |

## Information still needed to complete the rule set

- CS (M) Table 2 calculation method; clarification of CS (M) SAW stage percentages versus printed total thresholds.
- Combat Shoot mixed-weapon scoring-group rules, counting-cap application, and any official rounding policy.
- ATP (SP) LMG Table 2 and APS LMG applicability/standards. ATP (M) LMG is now supplied.
- BTP and APS (NS) weapon applicability; any BTP marksmanship rule.
- Any additional completion, retest, or award conditions not visible in the excerpts.

These gaps should remain visible configuration states, rather than guessed rules.
