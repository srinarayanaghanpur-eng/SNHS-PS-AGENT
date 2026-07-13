# Live Design Assistant Agent

Interactive assistant that refines an **already-open Photoshop document** through
natural-language commands. Additive to the V2 poster composer — it does not
replace the composer, its IPC channels, PSD/PNG/JPG export, job storage, or
brand-kit functionality.

## Architecture (adapted to this repo)

Reuses the existing pathway: **Electron main → `cscript.exe` →
`photoshop/smoke-test-dojavascript.vbs` → `$.evalFile` → DoJavaScript → JSX.**
No UXP, no UXP Developer Tool, no CEP. No web app.

```
src-v2/main/design-assistant/
  types.ts                       scene graph, semantic roles, operation allow-list, action-plan schema
  command-interpreter.ts         deterministic local NL parser (works with NO Gemini)
  gemini-command-interpreter.ts  optional Gemini → STRICT schema-validated plan only (never JSX)
  execution-planner.ts           builds + validates ActionPlan against the allow-list
  semantic-layer-mapper.ts       weighted, confidence-scored role mapping (never filename-only)
  document-analyzer.ts           normalises analyzer-JSX output → typed SceneGraph
  photoshop-state-reader.ts      reads active doc / active layer via assistant-analyze.jsx
  photoshop-command-executor.ts  runs a plan as targeted, atomic JSX (by layer ID)
  jsx-operations.ts              ES3 emitter for operations (snapshot-first, atomic)
  jsx-history.ts                 ES3 revert-to-snapshot + save-version
  background-replacer.ts         cover/contain math + protected-element rules
  visual-verifier.ts             post-edit checks (out-of-canvas, clipping, contrast, branding…)
  history-manager.ts             checkpoints, undo/redo, version naming
  asset-scout.ts                 provider order: library → approved → Openverse → Pexels → browser
  browser-controller.ts          Playwright visible Chrome (separate profile), Chromium fallback
  asset-downloader.ts            download + validate into the job assets dir (no clipboard)
  asset-validator.ts             MIME / HTML-disguise / min-dimension rejection
  assistant-session-store.ts     structured activity log (no API keys/tokens)
  creative-supervisor.ts         orchestrates read→parse→map→protect→plan→execute→verify
  assistant-window.ts            always-on-top tool window that snaps to Photoshop's right edge
  assistant-ipc.ts               additive, zod-validated IPC surface

src-v2/renderer/design-assistant/
  assistant.tsx                  entry
  DesignAssistantWindow.tsx      full panel: command input, doc/layer, detected elements,
                                 quick edits, Asset + Background tabs, before/after preview,
                                 apply/cancel, undo/redo/restore/save-version, activity log, errors
```

Entry points: `photoshop/assistant-analyze.jsx` (non-destructive analyzer),
`Open Design Assistant` button on the Results screen and the Edit-Existing-PSD page.

## Configuration (environment variables)
- `GEMINI_API_KEY`, `GEMINI_MODEL` (optional) — complex-command interpretation.
  Basic commands work without it.
- `PEXELS_API_KEY` (optional) — enables the Pexels provider.
- Visible-browser fallback requires Playwright: `npm i playwright && npx playwright install chrome`.
  It is an **optionalDependency** and marked external in the build; the app runs without it.

## Security
contextIsolation on, sandbox on, nodeIntegration off, typed preload, every IPC
input zod-validated, no shell exec from renderer, no arbitrary JSX from renderer
or AI (only the allow-listed executor emits JSX), downloaded assets restricted to
image MIME types with sanitised filenames and host allow-list, path-traversal
guarded via existing `containedPath`.

## Manual acceptance tests (require the real installed Photoshop)
These CANNOT be run in CI/Linux; run on the Windows box with Photoshop open:

1. Open a layered school poster PSD in Photoshop.
2. Launch the app, generate/open a poster, click **Open Design Assistant**.
3. "Move the school logo 30 pixels left." → verify only that layer moved.
4. "Make the headline yellow." → verify only the headline colour changed.
5. "Make the LEAD logo 10 percent smaller." → verify aspect ratio preserved.
6. "Find a premium blue educational background." → verify results appear
   (Openverse/Pexels; or visible Chrome if Playwright installed).
7. Select a result → verify full-res download into the job assets dir, MIME-valid.
8. Verify import as a Smart Object behind all content; previous background hidden,
   not deleted; before/after preview shown.
9. **Undo** → verify the old background returns.
10. Close and relaunch the packaged `.exe`; repeat 2–3 to confirm it works packaged.

## Operation JSX status
All operation paths are now implemented with real ActionManager (ES3) code in
`jsx-operations.ts` — no stubs remain:
- `setFillColor` — solid-fill-layer recolour, with a preserve-transparency pixel
  fill fallback for raster layers.
- `setStrokeColor` / `removeStroke`, `addShadow` / `removeShadow` — layer effects
  applied read-modify-write so removing one effect preserves the others.
- `setBlendMode` — friendly-name → `BlendMode` enum mapping.
- `adjustBrightness` / `adjustSaturation` — non-destructive **clipped** adjustment
  layers (Brightness/Contrast, Hue/Saturation).
- `addOverlay` — full-canvas solid-fill overlay layer at the requested opacity.
- `roundedCorners` — rounded-rect mask from the layer's own bounds.
- `replaceSmartObject` — `placedLayerReplaceContents`.
- `replaceBackground` — dedicated path (`emitReplaceBackgroundJsx` +
  `executeBackgroundReplacement`): places the validated image as a Smart Object,
  cover-fits with the pre-computed scale/offset from `computeCover`, moves it to
  the bottom of the stack, and **hides (never deletes)** the previous background.
  Wired end-to-end: Background tab → "Use as bg" → download+validate → place.

## Known limitations / not yet verified
- The operation JSX has NOT been executed against real Photoshop — ActionManager
  code is standard but unproven here. Run the manual acceptance tests to confirm.
- Not executed against real Chrome or the packaged `.exe` in this environment.
- WebP assets skip the strict dimension pre-check (header parser returns null),
  so `replaceBackground` falls back to a 100% place and lets Photoshop cover-fit.
- `addOverlay` gradient tone currently renders as a solid dark overlay.
- Photoshop snapshot-based undo assumes snapshots persist for the session; a
  document "flatten"/close discards them.
- NOTE ON THIS SESSION: after adding the operation JSX, `tsc`/`vitest` could not
  be re-run — the Linux workspace mount began serving corrupted/truncated reads
  of existing files (including untouched `node_modules`), an environment fault.
  The pre-operation-JSX state passed clean (`tsc` exit 0; 34/34 assistant tests;
  178/178 full suite). The new code is type-reviewed against the host files but
  its fresh compile/test run is pending a healthy environment — please run
  `npm run typecheck` and `npm test` locally.
