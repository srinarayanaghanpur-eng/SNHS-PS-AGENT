# SNHS SMART POSTER AGENT

Production-oriented Adobe Photoshop UXP panel that analyzes an open PSD automatically, infers semantic placeholders, saves a reusable manifest, builds a matching poster form, edits a protected duplicate, validates the layout, and exports the result. It uses no ExtendScript and never requires a hand-written layer map.

## Requirements

- Windows or macOS with Adobe Photoshop 24.2 or newer
- Adobe UXP Developer Tool (UDT), installed from Creative Cloud Desktop
- Node.js 20+ for development builds only

## Build and load

```powershell
npm install
npm test
npm run typecheck
npm run build
```

In UXP Developer Tool:

1. Click **Add Plugin** and select this project's `manifest.json`.
2. Open the plugin's **••• → Options → Advanced** settings.
3. Set the distribution folder to `dist`.
4. Click **Load**, open Photoshop, then choose **Plugins → SNHS Smart Poster Agent**.

For development, run `npm run dev`, then use UDT **Watch** or **Reload**. A production build is the complete `dist/` folder.

## Workflow

1. Open any layered PSD template.
2. Click **Analyze Current PSD**. The scanner recursively reads groups, hidden/locked layers, text, bounds, masks, clipping, Smart Objects, opacity, blend mode, parent paths, IDs, and sibling context.
3. Only low-confidence or conflicting matches appear in **Review Uncertain Layers**. High-confidence mappings are accepted automatically.
4. Save the generated manifest. It is stored in UXP plugin data and reused when filename, dimensions, important paths, bounds, and structure produce the same fingerprint.
5. Enter only the fields detected in that PSD. Add any number of students and choose local photos.
6. Choose an export folder and click **Generate & Export**. The plugin duplicates the PSD before any edit, retains editable groups/text, replaces Smart Objects where possible, arranges repeated cards, validates the result, and exports selected formats.

## Architecture

- `src/core`: recursive scanner, classifier, confidence, manifests, fingerprints, storage, dynamic forms
- `src/photoshop`: modal document operations, text/image replacement, Smart Objects, cards, visibility, export, targeted batchPlay helpers
- `src/layout`: safe areas, card grids, collision and quality validation
- `src/assets`: persistent asset-folder token, recursive index, licence sidecars
- `src/ui`: React panel, all workflow screens, progress and actionable errors
- `src/types`: shared manifest, form, asset, generation, and validation contracts

## Manifest and asset storage

Template manifests are JSON files in UXP's private plugin-data folder. Asset libraries remain in the user-selected folder; the plugin stores only a persistent access token and indexes supported PNG, JPEG, WebP, PSD, and SVG entries. Optional licence metadata can be stored beside an asset as `asset.png.license.json`:

```json
{ "license": "CC BY 4.0", "source": "https://example.org/asset" }
```

## Safety

- The original document is never edited during generation.
- All Photoshop mutations execute inside `core.executeAsModal`.
- Smart Object replacement is preferred; other images are placed embedded, cover-fitted without stretching, and clipped to the placeholder.
- Semantic tagging is optional and only appends `[SNHS:role]` to the existing name.
- Alternate ratios use proportional scaling and centered canvas expansion, never non-proportional stretching.

See [Troubleshooting](docs/TROUBLESHOOTING.md) and [API limitations](docs/API_LIMITATIONS.md).
