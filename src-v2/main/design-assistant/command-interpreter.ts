// Deterministic local command parser.
//
// Basic commands MUST NOT fail when Gemini is unavailable (§ AI and
// deterministic behaviour). This module turns common natural-language commands
// into validated Operation objects with no network dependency. It also decides
// whether a command targets the *active* Photoshop layer ("this", "selected",
// "current logo", …) versus a semantic role.

import type { Operation, SemanticRole } from './types';

export interface ParsedCommand {
  operations: Operation[];
  // Which layer the command is about, in priority order:
  targetsActiveLayer: boolean;   // "this / selected / current …"
  roleHint: SemanticRole | null; // best-effort semantic role from the text
  unresolved: boolean;           // true when nothing deterministic matched
  notes: string[];
}

// Words that force targeting the currently-selected Photoshop layer.
const ACTIVE_LAYER_PATTERNS = [
  /\bthis\b/, /\bselected\b/, /\bcurrent\b/, /\bactive\b/,
];

// Common named colours → hex (no leading #). Deliberately small and explicit.
const NAMED_COLORS: Record<string, string> = {
  white: 'ffffff', black: '000000', red: 'ff0000', green: '008000', blue: '0000ff',
  yellow: 'ffff00', orange: 'ffa500', purple: '800080', pink: 'ffc0cb', gold: 'ffd700',
  navy: '001f5b', 'navy blue': '001f5b', teal: '008080', grey: '808080', gray: '808080',
  silver: 'c0c0c0', maroon: '800000', cyan: '00ffff', magenta: 'ff00ff', brown: '8b4513',
  'dark blue': '00274d', 'light blue': 'add8e6', 'sky blue': '87ceeb',
};

export function parseColor(text: string): string | null {
  const hexMatch = text.match(/#?([0-9a-fA-F]{6})\b/);
  if (hexMatch) return hexMatch[1].toLowerCase();
  const rgb = text.match(/rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/i);
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, parseInt(n, 10)));
    return [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
  }
  // longest named colour first so "dark blue" beats "blue"
  const names = Object.keys(NAMED_COLORS).sort((a, b) => b.length - a.length);
  for (const name of names) if (new RegExp(`\\b${name}\\b`, 'i').test(text)) return NAMED_COLORS[name];
  return null;
}

// Default nudge distance when the user says "slightly" / "a little" with no px.
const SLIGHT_PX = 30;
const DEFAULT_PX = 20;

function roleHintFrom(text: string): SemanticRole | null {
  const t = text.toLowerCase();
  if (/lead\s*logo/.test(t)) return 'lead_logo';
  if (/logo|emblem/.test(t)) return 'school_logo';
  if (/headline|title/.test(t)) return 'headline';
  if (/sub\s*headline|subtitle/.test(t)) return 'subheadline';
  if (/chairman/.test(t)) return 'chairman_photo';
  if (/correspondent/.test(t)) return 'correspondent_photo';
  if (/principal/.test(t)) return 'principal_photo';
  if (/student|portrait|photo/.test(t)) return 'student_photo';
  if (/school\s*name/.test(t)) return 'school_name';
  if (/address/.test(t)) return 'school_address';
  if (/phone|contact|mobile/.test(t)) return 'phone_number';
  if (/background|\bbg\b/.test(t)) return 'background';
  if (/date/.test(t)) return 'date';
  if (/birthday/.test(t)) return 'birthday_section';
  if (/footer/.test(t)) return 'footer';
  if (/decorat|ornament/.test(t)) return 'decorative_element';
  return null;
}

function pxAmount(text: string, fallback: number): number {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:px|pixels?|pixel)\b/);
  if (m) return parseFloat(m[1]);
  if (/slightly|a little|a bit|tiny/.test(text)) return SLIGHT_PX;
  return fallback;
}

function percentAmount(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)\b/);
  return m ? parseFloat(m[1]) : null;
}

// The core parser. Returns every operation it can confidently derive.
export function parseCommand(raw: string): ParsedCommand {
  const text = raw.toLowerCase().trim();
  const operations: Operation[] = [];
  const notes: string[] = [];
  const targetsActiveLayer = ACTIVE_LAYER_PATTERNS.some((p) => p.test(text));
  const roleHint = roleHintFrom(text);

  // ── Undo / redo are handled by the caller, but recognised here ──
  if (/^\s*undo\b/.test(text)) return { operations, targetsActiveLayer, roleHint, unresolved: false, notes: ['UNDO'] };
  if (/^\s*redo\b/.test(text)) return { operations, targetsActiveLayer, roleHint, unresolved: false, notes: ['REDO'] };

  // ── Position ──
  const moveMatch = text.match(/\bmove\b|\bnudge\b|\bshift\b/);
  if (moveMatch) {
    const px = pxAmount(text, DEFAULT_PX);
    let dx = 0; let dy = 0;
    if (/\bleft\b/.test(text)) dx -= px;
    if (/\bright\b/.test(text)) dx += px;
    if (/\bup\b|\bupward|\bhigher\b/.test(text)) dy -= px;
    if (/\bdown\b|\bdownward|\blower\b/.test(text)) dy += px;
    if (dx !== 0 || dy !== 0) operations.push({ type: 'translate', x: dx, y: dy });
  }

  // ── Alignment / centring ──
  if (/cent(er|re)\s+horizontal|horizontally cent/.test(text)) operations.push({ type: 'align', edge: 'centerH' });
  else if (/cent(er|re)\s+vertical|vertically cent/.test(text)) operations.push({ type: 'align', edge: 'centerV' });
  else if (/\bcent(er|re)\b/.test(text)) operations.push({ type: 'align', edge: 'centerH' });
  if (/align\s+top|\bto\s+top\b/.test(text)) operations.push({ type: 'align', edge: 'top' });
  if (/align\s+bottom|\bto\s+bottom\b/.test(text)) operations.push({ type: 'align', edge: 'bottom' });
  if (/align\s+left/.test(text)) operations.push({ type: 'align', edge: 'left' });
  if (/align\s+right/.test(text)) operations.push({ type: 'align', edge: 'right' });

  // ── Size ──
  const pct = percentAmount(text);
  if (/\bsmaller\b|reduce.*size|decrease.*size|shrink/.test(text)) {
    operations.push({ type: 'scale', percentage: pct != null ? 100 - pct : 90, maintainAspectRatio: true });
  } else if (/\blarger\b|\bbigger\b|increase.*size|enlarge|grow/.test(text)) {
    operations.push({ type: 'scale', percentage: pct != null ? 100 + pct : 110, maintainAspectRatio: true });
  } else if (pct != null && /\bresize\b|\bscale\b/.test(text)) {
    operations.push({ type: 'scale', percentage: pct, maintainAspectRatio: !/stretch|ignore aspect/.test(text) });
  }
  const widthM = text.match(/width\s*(?:to|=|:)?\s*(\d+)/);
  const heightM = text.match(/height\s*(?:to|=|:)?\s*(\d+)/);
  if (widthM || heightM) {
    operations.push({
      type: 'setSize',
      width: widthM ? parseInt(widthM[1], 10) : undefined,
      height: heightM ? parseInt(heightM[1], 10) : undefined,
      maintainAspectRatio: !/stretch|ignore aspect/.test(text),
    });
  }

  // ── Z-order ──
  if (/bring.*forward|move.*forward/.test(text)) operations.push({ type: 'reorder', direction: 'forward' });
  if (/send.*back(ward)?|move.*back(ward)?/.test(text)) operations.push({ type: 'reorder', direction: 'backward' });
  if (/to\s+(the\s+)?top|bring.*front/.test(text)) operations.push({ type: 'reorder', direction: 'front' });
  if (/to\s+(the\s+)?bottom|send.*to back/.test(text)) operations.push({ type: 'reorder', direction: 'back' });

  // ── Colour ──
  const color = parseColor(text);
  if (color) {
    if (/text|font|headline|title|wording|caption/.test(text)) operations.push({ type: 'setTextColor', hex: color });
    else if (/stroke|outline|border/.test(text)) operations.push({ type: 'setStrokeColor', hex: color, size: 4 });
    else if (/background|\bbg\b|fill/.test(text)) operations.push({ type: 'setFillColor', hex: color });
    else operations.push({ type: 'setFillColor', hex: color });
  }

  // ── Opacity ──
  if (/increase.*opacity|more opaque|less transparent/.test(text)) operations.push({ type: 'adjustOpacity', delta: pct ?? 15 });
  else if (/decrease.*opacity|reduce.*opacity|more transparent|less opaque|fade/.test(text)) operations.push({ type: 'adjustOpacity', delta: -(pct ?? 15) });
  else if (/opacity/.test(text) && pct != null) operations.push({ type: 'setOpacity', opacity: pct });

  // ── Shadow / stroke ──
  if (/add.*shadow|drop shadow/.test(text)) operations.push({ type: 'addShadow' });
  if (/remove.*shadow|no shadow/.test(text)) operations.push({ type: 'removeShadow' });
  if (/remove.*(stroke|outline|border)/.test(text)) operations.push({ type: 'removeStroke' });

  // ── Overlays / background tone ──
  if (/dark overlay|darken.*background|darker background/.test(text)) operations.push({ type: 'addOverlay', tone: 'dark', opacity: 40 });
  if (/light overlay|lighten.*background|brighter background|increase.*brightness/.test(text)) operations.push({ type: 'adjustBrightness', delta: pct ?? 20 });
  if (/reduce.*brightness|less bright/.test(text)) operations.push({ type: 'adjustBrightness', delta: -(pct ?? 20) });
  if (/increase.*saturation|more saturated|more vivid/.test(text)) operations.push({ type: 'adjustSaturation', delta: pct ?? 20 });
  if (/reduce.*saturation|less saturated|desaturate/.test(text)) operations.push({ type: 'adjustSaturation', delta: -(pct ?? 20) });

  // ── Text content / style ──
  const replaceM = raw.match(/(?:replace (?:the )?(?:selected )?text with|change (?:the )?(?:selected )?text to|set (?:the )?(?:selected )?text to|make it say)\s+["“]?(.+?)["”]?\s*$/i);
  if (replaceM) operations.push({ type: 'replaceText', text: replaceM[1].trim() });
  if (/uppercase|all caps/.test(text)) operations.push({ type: 'setTextCase', mode: 'upper' });
  else if (/title case/.test(text)) operations.push({ type: 'setTextCase', mode: 'title' });
  if (/make.*bold|bold(er)?\b/.test(text)) operations.push({ type: 'setBold', bold: true });
  const fontM = raw.match(/(?:change font to|set font to|use font)\s+([A-Za-z0-9 \-]+)/i);
  if (fontM) operations.push({ type: 'setFont', fontName: fontM[1].trim() });
  const fontSizeM = text.match(/font size\s*(?:to|=|:)?\s*(\d+)/);
  if (fontSizeM) operations.push({ type: 'setFontSize', size: parseInt(fontSizeM[1], 10) });
  if (/align.*text.*left|left align/.test(text)) operations.push({ type: 'setAlignment', align: 'left' });
  if (/align.*text.*right|right align/.test(text)) operations.push({ type: 'setAlignment', align: 'right' });
  if (/align.*text.*cent|cent.*text/.test(text)) operations.push({ type: 'setAlignment', align: 'center' });

  // ── Visibility / structure ──
  if (/\bhide\b/.test(text)) operations.push({ type: 'setVisibility', visible: false });
  if (/\bshow\b|unhide|reveal/.test(text)) operations.push({ type: 'setVisibility', visible: true });
  if (/\bdelete\b|\bremove\b(?!.*background)/.test(text) && !/remove.*(stroke|shadow|outline|border)/.test(text)) operations.push({ type: 'delete' });
  if (/\bduplicate\b|\bcopy\b/.test(text)) operations.push({ type: 'duplicate' });
  if (/\block\b/.test(text) && !/unlock/.test(text)) operations.push({ type: 'setLock', locked: true });
  if (/\bunlock\b/.test(text)) operations.push({ type: 'setLock', locked: false });
  if (/rounded corners/.test(text)) operations.push({ type: 'roundedCorners', radius: 24 });

  // ── Image / background replacement ──
  if (/replace.*background/.test(text)) notes.push('REQUEST_BACKGROUND_REPLACE');
  if (/replace.*(logo|portrait|photo|image)/.test(text)) notes.push('REQUEST_ASSET_REPLACE');
  if (/(find|search).*(background|image|pattern|photo|picture)/.test(text)) notes.push('REQUEST_ASSET_SEARCH');

  return { operations, targetsActiveLayer, roleHint, unresolved: operations.length === 0 && notes.length === 0, notes };
}
