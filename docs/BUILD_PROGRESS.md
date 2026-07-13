# Build Progress

## Phase 0 — Audit

Status: complete (2026-07-11)

- Repository and package configuration inspected.
- Renderer, preload, main-process, build, and Photoshop bridge entry points identified.
- Legacy implementation retained.
- `src-v2` boundary created.
- Git status unavailable because Git is not present on PATH; recorded in `LEGACY_AUDIT.md`.

## Phase 1 — Desktop foundation

Status: not started; entry points remain on legacy pending the Photoshop proof.

## Phase 2 — Photoshop proof

Status: passed (2026-07-11).

- Added a standalone ES3-compatible smoke JSX and VBS COM bridge.
- Gate requires real PSD, PNG, and success JSON from installed Photoshop.
- First real attempt failed at COM connection (`VBS_EXIT=20`, error 424); the VBS object guard was corrected before one retry.
- Second real attempt connected to the COM object but `DoJavaScriptFile` failed with COM error `-2147417846` and `VBS_EXIT=30` (the Photoshop automation server rejected the call). No result JSON, PSD, or PNG was produced. Per the hard gate, later phases and entry-point switching are blocked.
- Hardened the Phase 2 bridge to use GetObject-first connection, CreateObject fallback, a five-second readiness delay, and up to 15 two-second retries exclusively for `RPC_E_SERVERCALL_RETRYLATER`. Each attempt is logged and bridge failures write stage, attempt, HRESULT, error number, and details to JSON.
- Final automated retry run stopped at the Phase 2 gate. `DoJavaScriptFile` returned `0x8001010A` on all 15 attempts and exited with code 31. Failure JSON: `smoke-output/result.json`; attempt log: `smoke-output/smoke-bridge.log`. Physical verification found neither `SNHS_AUTOMATION_TEST.psd` nor `SNHS_AUTOMATION_TEST.png`. The next diagnostic is a manual Photoshop `File > Scripts > Browse` run of `photoshop/smoke-test.jsx`; no later phase is authorized until it succeeds.
- Manual Photoshop `File > Scripts > Browse` execution succeeded on 2026-07-11. Physical verification confirmed a 153,489-byte editable PSD, a 1,442,571-byte PNG, and a fresh success JSON. The PNG was visually inspected and shows `SNHS AUTOMATION TEST` in the expected 800×600 composition.
- After Photoshop completed manual initialization, a clean automated COM retry connected with `GetObject`, waited five seconds, and Photoshop accepted `DoJavaScriptFile` on attempt 1. VBS exited 0. Fresh physical outputs were verified: PSD 153,489 bytes, PNG 1,442,571 bytes, plus success JSON. The Electron entry points remain unchanged and no later phase was started.

### Phase 2 transport replacement evidence

- Adopted transport: `photoshop/smoke-test-dojavascript.vbs`, using COM `DoJavaScript` with `$.evalFile(new File(...))`; it never calls `DoJavaScriptFile`.
- Test command: `cscript.exe //Nologo "C:\Users\ADMIN\Desktop\SNHS-PS-AGENT-main\photoshop\smoke-test-dojavascript.vbs" "C:\Users\ADMIN\Desktop\SNHS-PS-AGENT-main\photoshop\smoke-test.jsx"`.
- Test started: `2026-07-11T15:22:28.4798348+05:30`. The bridge attached using `GetObject`, set Photoshop visible, and `DoJavaScript` succeeded on attempt 1. VBS exit code: 0.
- Fresh result JSON: 279 bytes, modified `2026-07-11T15:22:31.2274888+05:30`, with `success: true` and stage `completed`.
- Fresh PSD: `smoke-output/SNHS_AUTOMATION_TEST.psd`, 153,489 bytes, modified `2026-07-11T15:22:30.9272900+05:30`.
- Fresh PNG: `smoke-output/SNHS_AUTOMATION_TEST.png`, 1,442,571 bytes, modified `2026-07-11T15:22:31.1955733+05:30`, decoded dimensions exactly 800×600.
- All three modification times were later than the test start. Step B was not run because Step A passed. No Electron entry point, UI, UXP code, or later-phase implementation was changed.

## Phase 3 — File import

Status: in progress (started 2026-07-11).

- Added Zod runtime validation and included `src-v2` in TypeScript checking.
- Added an isolated main-process-owned selection/import boundary. It accepts one absolute selected path and returns only plain scalar metadata: job ID, sanitized copied path, filename, extension, size, and dimensions when locally available.
- Supported extension and signature validation covers JPG/JPEG, PNG, WebP, PSD, and PDF. Sources are copied into a generated job directory with path containment checks and a 100 MB limit.
- Explicitly rejects circular values, Buffer/typed-array payloads, native objects, relative paths, MIME mismatches, unsupported types, empty files, and unsafe destinations.
- Phase 3 focused suite: 11/11 tests passed. `npm run typecheck` passed.
- Full legacy suite: 113/115 tests passed; two existing unrelated failures remain in `src/repair/repair.test.ts` (flat-background variance and Telugu font selection). These were not changed as part of file import.
- Remaining before the Phase 3 gate: controlled preview generation and real-file validation for all supported formats. V2 remains isolated and Electron entry points/UI are unchanged.

## V2 desktop and first real poster milestone

- A sandboxed V2 Electron renderer invoked the Photoshop smoke job through explicit preload IPC and Zod-validated main-process handlers. The job created fresh Documents-based PSD/PNG outputs and returned a structured result to the renderer.
- Generated and visually inspected a real 1080×1350 Prayer poster through the same IPC/COM/JSX path. Physical exports: layered PSD 759,406 bytes, PNG 4,378,441 bytes, JPG 241,115 bytes; PNG and JPG decoded at 1080×1350.
- Standard `dev`, `build`, and `package` scripts now target V2 after the required IPC/Photoshop/output proof passed.
