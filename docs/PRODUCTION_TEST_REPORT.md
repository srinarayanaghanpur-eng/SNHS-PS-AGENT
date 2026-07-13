# SNHS Smart Poster Agent V2 — Production Test Report

All tests run against the **installed** application at
`%LOCALAPPDATA%\Programs\SNHS SMART POSTER AGENT V2\SNHS SMART POSTER AGENT V2.exe`
(NSIS installer output, not the dev tree), driving the real Photoshop
automation bridge (cscript + VBS DoJavaScript + COM).

- Machine: Windows 11 Pro 10.0.26200, x64
- App version: 1.0.0, Electron 43.1.0
- Photoshop: local COM-registered install
- Report date: 2026-07-13

## Environment & packaging

| Item | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` (unit) | PASS (see suite totals below) |
| `npm run package` (NSIS) | PASS — `release\SNHS SMART POSTER AGENT V2 Setup 1.0.0.exe` produced and signed |
| Installed file integrity (icudtl.dat, snapshots, resources) | PASS after clean reinstall |
| Installed `app.asar` contains latest code (`00_BACKGROUND`, `validateImageFile`, `detectEnvironment`, `requestSingleInstanceLock`) | PASS |
| Bridge resources present under `resources\photoshop\` | PASS (5 scripts) |

### Packaging issue found and fixed
- **Symptom:** first silent install of a rebuild produced a stale/partial
  `app.asar` (old code, missing design engine) and one installed launch failed
  with `Invalid file descriptor to ICU data received`.
- **Root cause:** two **elevated** instances of a previously-installed build
  were still running and held a lock on the install directory, so NSIS could
  not overwrite `app.asar` / ICU data. The overwrite silently left mixed files.
- **Fixes:**
  1. Added a single-instance lock (`app.requestSingleInstanceLock()`), so a
     second GUI launch focuses the existing window instead of racing it for the
     install folder and job storage. CLI `--*-gate` runs are exempted so tests
     can run alongside an open app.
  2. Verified clean path: **uninstall → install** yields a byte-correct install
     whose `app.asar` contains the current code and launches without the ICU
     error.
- **Operational note:** when updating, the app must be fully closed first (the
  single-instance lock plus a normal-privilege install make this reliable).

## End-to-end test matrix (installed exe → real Photoshop)

| # | Scenario | Result | Notes |
| --- | --- | --- | --- |
| 1 | Baseline SNHS Daily Prayer (logo, 4 photos, birthday, thought, programme, footer) | PASS | Quality 100/100; editable PSD + 1080×1350 PNG + JPG; visually inspected. |
| 2 | Malformed/corrupt JPG + missing photo path + bad logo path | PASS | No crash. All three bad inputs rejected pre-flight with reasons (`too-small`, `missing`, `missing`); poster completed at quality 100 with one clean hero photo, no empty frame, no orphan label. |
| 3 | Missing font fallback (Photoshop bridge probe) | PASS + FIX | Photoshop does not throw on a missing font — it silently applies MyriadPro. `setFont` now verifies the applied font matches and falls back to Arial-BoldMT otherwise. Verified: bogus font → Arial-BoldMT. |
| 4 | Photoshop closed (cold COM launch) | PASS | Bridge cold-launched Photoshop via COM CreateObject; poster completed at quality 100 (~120s incl. Photoshop launch). |
| 5 | Concurrent / busy Photoshop | DEFERRED | Interrupted by the brand-kit epic; still to run (see §Outstanding). |
| 6 | PSD reopen + analysis | DEFERRED | Still to run (see §Outstanding). |

## Brand-kit workflow end-to-end (installed/unpacked exe → real Photoshop)

Seeds a school profile with real asset files via the persistent store (no dialog),
then generates a Daily Prayer poster and visually inspects the result (§12 checklist).

| Check (§12) | Result |
| --- | --- |
| Upload school logo, LEAD logo, chairman + principal photos | PASS — all 4 imported, copied into `BrandKits/{id}/…`, metadata stored |
| School name/address/phone/year entered and used | PASS — all appear in header + footer from the profile |
| Data persists after reload (fresh store read) | PASS — `assetsInProfile` confirmed after re-read; unit test covers reopen |
| Daily Prayer poster generated | PASS — quality 100/100, PSD + PNG + JPG |
| Correct uploaded assets appear in the PSD | PASS — logo top-left, chairman "Sri K. Rao", principal "Smt. L. Devi", LEAD logo footer-right, brand navy/gold colours |
| Layers editable / smart objects | PASS — §8 group tree (`00_BACKGROUND`…`10_EFFECTS`), text layers editable, photos placed as smart objects |
| PNG/JPG visually match preview | PASS — same `composePoster` engine drives the live SVG preview and Photoshop |
| Missing assets produce clear validation | PASS — `validatePosterRequest` names each missing item; moved/deleted assets detected and degrade to text-only |

### Brand-kit bugs found and fixed during inspection
- **Content-panel z-order:** splitting content into `06_SPECIAL_EVENT` / `07_PRAYER_CONTENT` / `08_PROGRAMME_ORDER` left the translucent panel (in 07) painting over the special-event block (in 06), so "BIRTHDAY CELEBRATIONS" was ghosted. Fixed by drawing the panel in the first content group (06) so it sits behind all blocks. Re-verified: birthday block solid and readable.
- **Footer LEAD vs academic-year overlap:** footer-right LEAD logo overlapped the right-aligned year. Fixed by reserving the logo width in the year's box. Re-verified: clear separation.
- **Test-fixture note:** the E2E used the Photoshop icon as the logo fixture and screenshots as management photos purely to exercise the upload→PSD path. Production posters must use real school/LEAD logos and portraits; §6/§9 already block unrelated substitutes at validation time.
