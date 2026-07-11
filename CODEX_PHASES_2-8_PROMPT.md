# CODEX PROMPT — SMART SCHOOL POSTER RECREATOR (Phases 2–8, full specification)

You are a principal computer-vision engineer, AI engineer, Adobe Photoshop automation expert, and professional school-poster designer. You are continuing an existing project. Inspect, implement, run, test, debug, repair, and complete the working application. Do not create only documentation, mock-ups, fake buttons, or placeholder functions. Do not stop after analysing. Do not wait for confirmation.

---

## 0. CURRENT REPO STATE — VERIFY FIRST, DO NOT ASSUME

This project is an **Adobe Photoshop UXP panel plugin** (NOT ExtendScript, NOT Electron, NOT a standalone Windows app):

- TypeScript + React 18, esbuild (`scripts/build.mjs`), vitest, UXP manifest v5, Photoshop ≥ 24.2.
- A working PSD-template pipeline that must be **preserved untouched**: `src/core/*` (photoshopScanner, recursiveLayerReader, layerClassifier, smartTagger, manifestBuilder, templateFingerprint, templateStorage, posterGenerator, dynamicForm, confidenceEngine), `src/photoshop/*` (batchPlayHelpers, documentDuplicator, groupDuplicator, textReplacement, imageReplacement, imageFitManager, layerVisibility, layerLookup, exporter), `src/layout/*` (textFitEngine, collisionDetector, safeAreaCalculator, spacingEngine, sectionLayoutEngine, cardLayoutEngine, layoutValidator, qualityValidator, automaticRepairEngine, layerBoundsReader, layoutHelpers).
- **Phase 1 is already implemented but has never been compiled, tested, or run.** Files:
  - `src/profile/schoolProfile.ts` — persistent school profile (SNHS defaults), corrupt-file-proof normalization, brand-media storage per role.
  - `src/ingest/posterUpload.ts` — JPG/JPEG/PNG/WEBP/PDF upload; PDF page 1 rasterised at 300 ppi via batchPlay `open` descriptor; permanent per-project stored copy; SHA-256 + FNV-1a hashes; reopen/resume.
  - `src/project/projectStore.ts` — validated `ReferenceProject` JSON schema (modes pending/full/hybrid/safe), crash-safe tmp writes, repairing validator that drops bad elements, never whole projects.
  - `src/models/modelManager.ts` — model registry (Tesseract worker, core WASM, eng, tel), size + SHA-256 verification (trust-on-first-install), download with progress + 3 retries, delete, **Import Offline Model Pack** from a folder/USB.
  - New types at bottom of `src/types/index.ts` (SchoolProfile, ReferenceProject, DetectedRegion, ModelDescriptor/Record, etc.); UI in `src/ui/screens/Phase1Screens.tsx`; nav wired in `src/ui/App.tsx`; network domains added to `manifest.json`; SHA-256 (pure JS, FIPS-tested) in `src/utils/hash.ts` + `hash.test.ts`.

**STEP 0 (mandatory before any new code):**
1. `npm install`
2. `npm run typecheck` — fix every error.
3. `npm run test` — all tests must pass (hash FIPS vectors included).
4. `npm run build`
5. Load `dist/` in Photoshop via UXP Developer Tool; verify the Reference Posters, School Profile, and AI Models screens actually work (upload a JPG, save the profile, scan models).
Repair anything broken in Phase 1 before starting Phase 2.

---

## 1. PRIMARY GOAL

The user must be able to upload almost any school poster in JPG, JPEG, PNG, WEBP, or PDF. The system must automatically:

1. Read and understand the complete poster.
2. Detect all visible text.
3. Detect the original school name, logo, phone number, address, academic year, website, email, and other institution-specific details.
4. Detect people, students, faces, photos, objects, logos, shapes, ribbons, badges, decorations, backgrounds, borders, gradients, shadows, and layout regions.
5. Remove or cover the original institution's identity.
6. Replace it with the configured school identity.
7. Replace student, staff, campus, logo, chairman, or principal images where supplied.
8. Preserve the visual style of the reference poster as accurately as technically possible.
9. Automatically create organised Photoshop layers.
10. Save a PSD.
11. Export PNG, JPG, and PDF.
12. Complete the workflow without requiring the user to manually identify, name, create, resize, or position layers.

Minimum user workflow: Upload reference poster → add optional new content and images → click Generate → receive a completed poster and PSD.

## 2. HONEST 100% GUARANTEE

A flat JPG or PNG does not contain its original Photoshop layers, masks, vectors, fonts, effects, hidden objects, or source files. Never claim exact reconstruction of original editable layers. Instead guarantee: **100% automatic task completion for every valid supported poster, using the highest achievable visual similarity and maximum reliable editability.** Every valid poster completes through one of three modes, auto-selected by confidence:

**Mode A — Full Editable Reconstruction (high confidence).** Recreate background, editable text, separate photos, smart objects, logos, shapes, frames, masks, shadows, strokes, gradients, decorative elements, and organised groups. The original reference image must not remain visible in the final export. A hidden comparison group named `REFERENCE_DO_NOT_EXPORT` may be included and must automatically stay hidden during export.

**Mode B — Hybrid Pixel-Preserving Reconstruction.** Create a cleaned raster base from the reference (all original school-specific details removed or covered; complex artwork preserved as pixels) named `HYBRID_CLEAN_BASE`, then add the new school name, logo, dates, phone, address, images, and important text as editable layers. Never place the untouched original poster as the visible base.

**Mode C — Safe Automatic Adaptation (low confidence / extreme complexity).** Priorities in order: no original identity visible → new information correct → text readable → faces undamaged → images unstretched → balanced design → export succeeds. Use style-matched ribbons, panels, gradients, badges, shapes, or background sections to cover difficult regions.

The application must never stop only because full editable reconstruction is impossible.

## 3. SCHOOL PROFILE

Already implemented in `src/profile/schoolProfile.ts` — verify and extend, do not duplicate. Default:

```json
{ "schoolName": "SRI NARAYANA HIGH SCHOOL", "shortName": "SNHS",
  "location": "Ghanpur (M), Jayashankar Bhupalpally District",
  "phone": "6300038389", "academicYear": "2026-27",
  "groupName": "Adarshavani Group of Schools", "curriculum": "Powered by LEAD",
  "website": "", "email": "", "preferredLanguages": ["English", "Telugu"] }
```

User-savable (configured once): school name, short name, logo, address, phones, email, website, academic year, group name, branch name, curriculum branding, brand colours, preferred fonts, footer style, campus/student/staff/uniform photos, chairman photo, principal photo, social media.

## 4. TECHNICAL ARCHITECTURE (final — do not re-ask the user)

**Everything runs inside the UXP plugin** (JS/WASM in the panel's JavaScript environment). No Electron, no Node backend, no ExtendScript, no Sharp, no native OpenCV binaries. Where the original spec named ExtendScript/COM/Sharp, substitute the UXP equivalents below.

### OCR
- Primary: **Tesseract.js**, English + Telugu bundled locally via the existing modelManager. Never download during generation.
- Optional cloud fallback (Google Cloud Vision or configured provider) only when: API key exists AND internet available AND local confidence poor AND region important. Cloud failure never stops generation. Keys never in frontend source — store in UXP secure/local storage entered by the user.
- Preprocessing variants (implement with canvas/ImageData or opencv.js WASM): original, upscaled, grayscale, high-contrast, adaptive-threshold, inverted, sharpened, deskewed.
- Run OCR on the complete poster AND on detected text regions.
- Preserve per result: text, bounding box, rotation, language, word/line/region confidence, reading order. Merge duplicates and choose best by confidence scoring.

### Object and face detection
- General objects: `@huggingface/transformers` (WASM backend) with a lightweight ONNX detection model.
- Faces: a separate lightweight face detector (BlazeFace-class ONNX or opencv.js cascade as fallback). Do not use only a general-object model for faces or logos.
- Logos: layout + OCR + shape + position heuristics; position/size heuristics as final fallback.
- Run heavy detection on reduced-resolution previews; full resolution only for masks, final placement, export.
- Register every new model file in the modelManager registry so the offline pack covers them (`%LOCALAPPDATA%\SmartSchoolPoster` equivalent is the UXP data folder — keep using it). Lite mode: download with progress/retry/SHA-256/corruption recovery. Full offline mode: Import Offline Model Pack (USB) — already implemented, extend the registry.

### Inpainting
Provider interface (implement now: OpenCV + DesignCover; LaMa interface reserved):
```
InpaintingProvider
  OpenCVInpaintingProvider   // opencv.js WASM: Telea + Navier–Stokes, small simple regions
  DesignCoverProvider        // style-matched panels/ribbons/gradients sampled from surroundings
  LaMaInpaintingProvider     // later phase, interface only
```
Auto-use DesignCover for: large logos, complex textures, people, illustrations, large text regions, and wherever classical inpainting produces blur or damage.

### Photoshop automation
- The production bridge is **batchPlay inside UXP** (`src/photoshop/batchPlayHelpers.ts`). There is no ExtendScript bridge in this repo — do not build one.
- Create a `PhotoshopBridge` interface and implement `UXPPhotoshopBridge` wrapping the existing helpers. All generation code must depend only on the interface, never on batchPlay directly.
- The bridge must support: availability check, document creation, canvas size, resolution, layer groups, raster layers, text layers, image placement, smart objects, masks, clipping masks, shapes, rotation, opacity, shadows, strokes, gradients, blend modes, canvas resize, PSD save, PNG/JPG/PDF export, operation reports, partial-failure recovery.

## 5. POSTER UNDERSTANDING

**Text types to classify:** school name, organisation name, event title, subtitle, date, academic year, address, phone, website, email, student name, staff name, description, call-to-action, footer, generic content that should remain, institution-specific content that must be replaced.
Do not blindly replace all text: keep "Admissions Open" and "Qualified Faculty"; replace another school's name, logo, phone, and address.

**Visual elements to detect:** people, faces, students, teachers, staff, logos, campus photos, books, buses, sports objects, decorative icons, ribbons, panels, frames, badges, circles, rectangles, organic shapes, flowers, confetti, fireworks, light effects, background patterns, gradients, shadows, borders, texture regions.

**Layout analysis:** canvas size, safe margins, alignment, grid, visual hierarchy, focal point, z-order, whitespace, overlap, reading order, symmetry, text-to-image relationships, face-safe regions, logo placement, footer structure.

## 6. AUTOMATIC TEXT FITTING

New school information is often longer than the original. Automatically adjust: font size, letter spacing, line spacing, text-box dimensions, line count, alignment, rotation, stroke width, shadow size, surrounding layout. Reuse/extend `src/layout/textFitEngine.ts`.
Never allow: overflow, cut-off letters, text outside canvas, unreadably small text, random line breaks, text over faces, text over the logo, text touching the border, stretched typography.
Use the closest installed font when the original cannot be identified; category-based fallback after that. Font failure never stops generation.

## 7. IMAGE REPLACEMENT

For uploaded student/staff images: detect the face, remove the background (WASM segmentation model or edge/chroma heuristic fallback), refine edges, preserve face proportions, never cut the head or stretch the body, match approximate scale, colour temperature, and lighting, add suitable shadow/glow, position without covering important text.
More students than the reference: recalculate layout, add frames, reduce sizes gradually, keep equal spacing, avoid crowding, maintain hierarchy. Fewer students: remove unused frames, rebalance, enlarge primary images when suitable.

## 8. PHOTOSHOP LAYER STRUCTURE

Groups: `01_BACKGROUND, 02_DECORATIONS, 03_MAIN_IMAGES, 04_STUDENT_PHOTOS, 05_EVENT_TEXT, 06_SCHOOL_BRANDING, 07_CONTACT_DETAILS, 08_EFFECTS, 09_FOOTER`.
Meaningful names only (e.g. `Background Gradient`, `Top Gold Ribbon`, `Admissions Heading`, `School Logo`, `Student Photo 01`, `Academic Year`, `Phone Number`, `Footer Address`). Never `Layer 1`, `Unknown Object`, `Item 4`.
If one layer fails: log it, continue all other layers, attempt a raster fallback, never cancel the document.

## 9. PROJECT JSON

Extend the existing `ReferenceProject` schema in `src/types/index.ts` + `src/project/projectStore.ts` to carry: project ID, reconstruction mode, overall confidence, canvas info, source image, school profile, detected regions, replacement decisions, layers, images, text styles, masks, z-index, per-element confidence, export instructions, failed-element report. Validate before sending to Photoshop; skip or repair invalid elements and continue.

## 10. QUALITY-CONTROL ENGINE

Before export verify: no original school name/logo/phone/address visible; new name/logo/phone/academic year correct and present; text readable, inside canvas, not over faces; faces undistorted; images unstretched; important content uncovered; PSD saved; PNG and JPG exported; layer creation completed.
Score: OCR accuracy, layout similarity, colour similarity, font similarity, replacement completeness, face safety, image quality, readability, layer success, export success.
On critical failure: repair region → regenerate element → switch mode if necessary → re-run QC → export only after the issue is resolved or safely covered.

## 11. FAILURE FALLBACKS (mandatory)

```
OCR failure            → alternate preprocessing → alternate segmentation → optional cloud OCR → hybrid-region preservation
Detection failure      → face detector → OCR/layout heuristics → position/size heuristics
Font failure           → closest installed font → category-based fallback font
Inpainting failure     → alternate OpenCV method → style-matched design cover
Full-mode failure      → hybrid mode → safe adaptation mode
Photoshop failure      → save complete project JSON → preserve assets → retry without reanalysis
PDF export failure     → export PNG → convert PNG to PDF
```
One failed stage never destroys or cancels the project.

## 12. OUTPUT SIZES

Original, 1:1, 4:5, 16:9, A4 portrait, A4 landscape, custom. Generate separate variants — never stretch. Automatically reflow text, reposition images, protect faces, recalculate margins, extend backgrounds, crop intelligently, preserve hierarchy. Extend the existing exporter formats.

## 13. IMPLEMENTATION ORDER

- **Phase 2:** Tesseract eng+tel OCR, image preprocessing, region detection, OCR confidence scoring, text semantic classification.
- **Phase 3:** object detection, face detection, logo heuristics, layout analysis, style extraction, reconstruction confidence scoring.
- **Phase 4:** mask creation, OpenCV(WASM) inpainting, design-cover fallback, image replacement, text fitting, font matching.
- **Phase 5:** full editable mode, hybrid mode, safe adaptation mode, preview renderer, quality-control engine.
- **Phase 6:** PhotoshopBridge layer creation, smart-object placement, text layers, effects, PSD save, PNG/JPG/PDF export.
- **Phase 7:** failure recovery, autosave, resume incomplete projects, security, performance, offline installer preparation.
- **Phase 8:** automated testing, real-poster testing, bug repair, end-to-end verification, setup documentation.

At the end of every phase: run lint, typecheck, unit tests, integration tests; fix errors; remove placeholder code and unfinished TODOs; confirm the phase works in Photoshop before continuing. Do not re-ask preferences defined here; ask only when blocked by something impossible to infer (e.g. strictly required private credentials) and continue with local fallbacks otherwise.

## 14. ACCEPTANCE TESTS (all must pass before declaring completion)

1. Upload a JPG school poster. 2. Upload a PNG. 3. Analyse the first page of a PDF. 4. Detect English text. 5. Detect Telugu text. 6. Detect rotated text. 7. Detect another school's name. 8. Replace the school name. 9. Detect and replace a phone number. 10. Detect and replace a logo region. 11. Fit the longer name "SRI NARAYANA HIGH SCHOOL". 12. Add the configured logo. 13. Replace student images. 14. Remove student-image backgrounds. 15. Protect faces from text overlap. 16. Full editable mode on a simple poster. 17. Hybrid mode on a complex poster. 18. Safe mode on a difficult poster. 19. Meaningful Photoshop groups. 20. Editable Photoshop text. 21. Separate image layers. 22. Save PSD. 23. Export PNG. 24. Export JPG. 25. Export PDF or PDF fallback. 26. Recover when OCR fails. 27. Recover when a font is missing. 28. Recover when inpainting fails. 29. Recover when one Photoshop layer fails. 30. Reopen a saved project. 31. 1:1 version. 32. 4:5 version. 33. 16:9 version. 34. A4 version. 35. No old school identity remains visible. 36. Workflow completes without manual layer detection.

## 15. STRICT RULES

Do not build only the UI. Do not create fake AI analysis or dummy JSON. Do not hardcode one template. Do not depend on cloud services for completion. Do not download models silently during poster generation. Do not leave TypeScript errors, broken imports, placeholder functions, or fake buttons. Do not mark unfinished features complete. Do not claim exact layer recovery from flat images — guarantee completion through the fallback modes. Do not expose API keys in frontend code. Do not upload student photos anywhere by default. Do not destroy existing working functionality (PSD-template pipeline AND Phase 1 modules). Do not stop after producing a plan. When a technical limitation appears, implement the strongest practical fallback and continue.

## FINAL REQUIRED RESULT

The finished system behaves like an experienced professional designer: receives a reference poster, understands its structure, removes the old organisation's identity, applies Sri Narayana High School branding, intelligently replaces text and images, creates organised Photoshop layers, and exports a completed poster automatically.

**Start now with Step 0 (verify and repair Phase 1), report a concise status, then implement Phase 2 immediately.**
