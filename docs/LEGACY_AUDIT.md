# Legacy Audit

Date: 2026-07-11

## Repository state

- The project is an Electron/React/TypeScript application whose current main entry is `electron/main.js`.
- Renderer entry: `src/index.tsx`; Electron source entries: `electron/main.ts` and `electron/preload.ts`.
- The build is a custom esbuild script in `scripts/build.mjs`; electron-builder targets NSIS x64.
- Git status could not be recorded because `git` is not installed or not available on PATH in this environment. No destructive Git command was run.

## Existing npm scripts (before V2 changes)

- `typecheck`: `tsc --noEmit`
- `test`: `vitest run`
- `clean`: `node scripts/build.mjs --clean`
- `desktop:compile`: `node scripts/build.mjs --electron`
- `desktop:dev`: build renderer/main and start Electron
- `desktop:build`: build renderer/main
- `desktop:package` / `desktop:installer`: build and package with electron-builder

There were no required `dev`, `build`, or `package` aliases.

## Photoshop implementation found

`backend/photoshop/vbsLauncher.ts` writes temporary JSX and VBS files and invokes `cscript`. The VBS creates `Photoshop.Application` and calls `DoJavaScriptFile`. It does not implement a durable job directory, validated job JSON, progress/result files, cancellation, reliable error propagation, or `GetObject`-first attachment. It uses command-string execution and suppresses COM/JSX errors with `On Error Resume Next`.

`electron/ipcHandlers.ts` exposes `ps:runJsx`, accepting arbitrary script text from the renderer. It also exposes unrestricted renderer-supplied filesystem paths and delete/write operations. Payloads are only checked ad hoc and are not schema validated.

## Architecture and regression findings

1. The README and `CODEX_PHASES_2-8_PROMPT.md` describe a UXP plugin, directly conflicting with the required Electron/COM/ExtendScript product.
2. Legacy `src/photoshop/*` modules contain UXP/batchPlay assumptions even though the current shell is Electron.
3. The preload surface exposes arbitrary JSX plus broad filesystem primitives; this violates least privilege and makes renderer compromise high impact.
4. Electron sandboxing is disabled. Context isolation is enabled and Node integration is disabled.
5. The current launcher can open Photoshop but has no trustworthy two-way job protocol. VBS can print an error yet still resolve as success.
6. Layer reads are encoded through console output and split delimiters rather than a bounded, scalar JSON result file. This cannot safely represent all text and is vulnerable to hangs and parsing ambiguity.
7. File selection returns a path and name, but import processing later opens files in Photoshop and does not use a self-contained, file-path-only job contract.
8. Storage is under AppData rather than the required Documents hierarchy and is exposed too broadly to the renderer.
9. The UI has many legacy screens and technical model-management concepts that conflict with the requested six-page workflow.
10. Existing package metadata names the product `SNHS Poster Agent`, not `SNHS SMART POSTER AGENT V2`.

## Controlled rebuild decision

Legacy files remain intact. New work begins under `src-v2` and `photoshop`. Entry points must not switch until the real Electron → IPC → VBS/COM → JSX smoke test creates both PSD and PNG and returns a real result.

## Phase 0 exit status

Repository structure, package configuration, entry points, scripts, and Photoshop launcher were inspected. The isolated V2 structure has begun. The next hard gate is the real Photoshop smoke test.
