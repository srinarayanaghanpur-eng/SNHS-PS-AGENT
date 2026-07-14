# Daily Prayer redesign acceptance report

Generated and visually inspected on 14 July 2026 through the Photoshop automation pipeline.

| Test | Input condition | Selected family | Result |
| --- | --- | --- | --- |
| `test1-full-bleed` | Assembly photo supplied | `fullBleedAssemblyEditorial` | Accepted |
| `test2-student-hero` | Student photo supplied | `asymmetricStudentHero` | Accepted |
| `test3-no-photo` | No hero photo supplied | `premiumEmblematicAssembly` | Accepted |

Every acceptance folder contains the final layered PSD, final PNG and JPEG, preview and approval images, immutable `design-plan.json`, `render-log.json`, `quality-gate-report.json`, `asset-usage-report.json`, and a compact `acceptance-summary.json`.

All three runs confirm:

- renderer: `immutable-design-plan-jsx`
- legacy Daily Prayer renderer used: `false`
- preview, Photoshop, export, and final plan hashes match: `true`
- final-PNG professional quality gate accepted: `true`

Visual inspection findings:

- Assembly-photo poster: strong full-bleed photographic focal point, deliberate dark editorial scrim, diagonal crop, legible programme timeline, and correct school/LEAD branding.
- Student-photo poster: clearly different asymmetric composition, student speaker as the hero, diagonal colour ribbon, and compact programme timeline.
- No-photo poster: premium emblematic composition with sunrise rays, folded-hands/book illustration, and a designed 3x3 programme field without placeholders or dashboard styling.

Verification completed:

- `npm test`: 22 test files, 209 tests passed
- `npm run v2:build`: passed
- `git diff --check`: passed (line-ending warnings only)

