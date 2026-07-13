# Troubleshooting

## No document open

Open the PSD in Photoshop, make it the active document, and analyze again.

## A layer was deleted or renamed

The saved fingerprint no longer represents the PSD. Reopen the original template and run **Analyze Current PSD** to create a new manifest.

## Locked layer or locked parent group

The plugin reports the exact failed operation. Unlock the intended placeholder in the template, or replace it with an editable text/Smart Object layer, then re-analyze. The plugin does not silently remove template protection.

## Missing font

Install the font used by the template or select a Photoshop-compatible substitute in the PSD. Text replacement preserves the original font and style; it does not download fonts.

## Image replacement fails

Use a valid PNG, JPEG, or WebP. Confirm the Smart Object is embedded/replaceable and that its parent group is not locked. Linked cloud Smart Objects may require relinking manually.

## Empty birthday or optional frame remains

Mark its parent as `optional_section` during review. Event modes hide optional layers when no matching data exists.

## Cards overlap or leave the safe area

The quality report identifies overlaps and canvas violations. Reduce student count, enlarge the content group in the PSD, or use a template designed for more cards.

## UDT cannot load the plugin

Run `npm run build`, select the root `manifest.json` in UDT, and set Advanced → Distribution Folder to `dist`. Manifest changes require **Unload → Load**, not only Reload.

## Export failure

Choose a folder to which UXP has access, ensure adequate free space, and verify the document color mode supports PNG/JPEG. PSD copies retain layers.

## Diagnostic logs

Open **Error Logs** inside the panel. Errors include the operation, Photoshop response, and a recommended correction; operations never silently fail.
