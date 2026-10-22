# Regression Report

**Status: structural PASS; live desktop/mobile verification OPEN.**

| Test | Methode | Erwartet | Status | Evidence |
| --- | --- | --- | --- | --- |
| REG-01 | node check-atlas.mjs | main Atlas graph/data valid | PASS | 68 edges, 53 trade rows |
| REG-02 | node check-resource-world.mjs | mine/resource view graph valid | PASS | 9,809 nodes and 14 directed edges |
| REG-03 | node check-dual-overview.mjs | two independent iframe URLs and responsive structure | PASS | URL isolation/static structure |
| REG-04 | node check-navigation.mjs | pointer logic and pinch continuity | PASS | scripted input logic |
| REG-05 | node check-unified.mjs | filter and existing single views | PASS | same deal statuses/dates/sources |
| REG-06 | node check-ownership-context.mjs | selection ownership context/conflicts | PASS | 19,557 assertions, 3 conflict groups |
| REG-07 | pnpm --dir ma-intelligence check | typecheck/lint/tests | PASS | 270/270 unit/integration tests |
| REG-08 | source hashes and unchanged assets | existing data reachable at same paths | PASS | 21 asset hashes checked; no Atlas JSON mutation |
| REG-09 | actual 3D browser on desktop | both WebGL globes independently interact | MANUAL_VERIFICATION_REQUIRED | private site auth wall; static checks do not execute GPU |
| REG-10 | actual iPhone/mobile browser | touch, layout, node selection, edge/source view | MANUAL_VERIFICATION_REQUIRED | no authenticated device in test environment |
| REG-11 | actual browser historical claim display | time presentation remains correct | MANUAL_VERIFICATION_REQUIRED | legacy UI path unchanged; no live WebGL session |
| REG-12 | actual browser UNKNOWN/CONFLICT display | labels and contradictions visible | MANUAL_VERIFICATION_REQUIRED | ownership context logic passed; visual interaction not observed |

Static logic checks do not prove rendering or live touch controls. The two existing globes and datasets were not modified by this release.
