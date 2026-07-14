// Palette derivation + typography pairing.
// Light-first, accessibility-aware. Avoids the dark-on-dark failure of the old engine.

function hexToRgb(h) {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
function rgbToHex([r, g, b]) { return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join(''); }
function lighten(hex, amt) { const [r, g, b] = hexToRgb(hex); return rgbToHex([r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt]); }
function darken(hex, amt) { const [r, g, b] = hexToRgb(hex); return rgbToHex([r * (1 - amt), g * (1 - amt), b * (1 - amt)]); }

// Relative luminance (WCAG) for contrast checks.
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
export function bestTextOn(bg, options = ['#FFFFFF', '#141821']) {
  return options.map((c) => ({ c, r: contrastRatio(c, bg) })).sort((x, y) => y.r - x.r)[0].c;
}

// Accent choices per event type — coordinated, harmonious with a navy brand.
const ACCENTS = {
  prayer: '#E0A83B',      // warm gold
  birthday: '#E8607A',    // rose
  exam: '#3B7BE0',        // blue
  festival: '#E0563B',    // vermilion
  admissions: '#2FA37A',  // green
  event: '#E0A83B',
};

export function derivePalette(brandHex = '#1E3A5F', eventType = 'prayer') {
  const primary = brandHex;
  const accent = ACCENTS[eventType] || ACCENTS.event;
  return {
    primary,
    primaryDark: darken(primary, 0.35),
    primaryLight: lighten(primary, 0.28),
    accent,
    accentDark: darken(accent, 0.2),
    // Premium light canvas — warm off-white, not pure white, not navy.
    canvas: '#F6F3EC',
    canvasAlt: '#FFFFFF',
    ink: '#1B222E',
    inkSoft: '#4A5464',
    onPrimary: '#FFFFFF',
    onAccent: bestTextOn(accent),
  };
}

// Coordinated font pairing (max 2 families). Poppins display + Lato body.
export function typographyPairing() {
  return {
    display: { family: 'Poppins', weight: 700, kind: 'displayUpper' },
    displaySemi: { family: 'Poppins', weight: 600, kind: 'display' },
    body: { family: 'Lato', weight: 400, kind: 'body' },
    bodyBold: { family: 'Lato', weight: 700, kind: 'body' },
    label: { family: 'Poppins', weight: 600, kind: 'bodyUpper' },
  };
}
