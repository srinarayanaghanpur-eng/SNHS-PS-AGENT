# Photoshop UXP automation limits

The plugin uses the Photoshop DOM first and targeted `batchPlay` only for layer descriptors, Smart Object content replacement, embedded placement, transforms, and alternate-size canvas operations.

The following cannot be guaranteed reliably for arbitrary third-party PSDs:

- Semantic meaning cannot be proven from pixels alone. Low-confidence/conflicting matches are therefore reviewed, while high-confidence matches remain automatic.
- Face-aware focal-point detection is not available as a stable local UXP DOM API. Images use centered cover fitting without stretching; users should pre-crop unusually composed portraits.
- Perspective-warped or externally linked Smart Objects may not accept automatic content replacement.
- Photoshop does not expose every layer-effect and text-layout measurement through the normal DOM. The scanner records supported DOM fields and targeted descriptors, and text fitting validates resulting bounds.
- An arbitrary 1:1 design cannot be intelligently redesigned into 16:9 without aesthetic choices. Alternate formats preserve aspect ratio, center content, and expand the canvas; the quality report requires visual review.
- Automatic duplication preserves the full card group and its masks/effects, but very irregular card structures may require the optional semantic tags for reliable child matching.

These cases produce visible warnings with corrective guidance rather than silent fallback or destructive edits.
