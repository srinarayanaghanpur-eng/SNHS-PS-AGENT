// Semantic layer mapper.
//
// Maps Photoshop layers to SNHS design roles using a *weighted combination* of
// signals — never filename alone (§ Semantic layer mapping). Returns confidence
// scores; low-confidence matches should be confirmed by the user through the
// detected-elements panel.

import type { SceneGraph, SceneLayer, SemanticMatch, SemanticRole } from './types';

export interface MapperContext {
  // Known uploaded school assets (basenames), from the brand kit, e.g.
  // { schoolLogo: 'sri-narayana-logo.png', chairmanPhoto: 'chairman.jpg' }.
  knownAssets?: Partial<Record<string, string>>;
  // Application metadata: layer names the composer emitted, keyed by role.
  appMetadataRoleByLayerName?: Record<string, SemanticRole>;
}

interface Signal { role: SemanticRole; weight: number; reason: string }

// Weighted keyword rules over the layer NAME.
const NAME_RULES: [SemanticRole, RegExp, number][] = [
  ['lead_logo', /lead[\s_-]*logo|lead[\s_-]*brand/i, 0.9],
  ['school_logo', /logo|emblem|crest/i, 0.55],
  ['school_name', /school[\s_-]*name|title[\s_-]*school/i, 0.6],
  ['school_address', /address|location/i, 0.6],
  ['phone_number', /phone|contact|mobile|tel\b/i, 0.6],
  ['headline', /headline|main[\s_-]*title|event[\s_-]*title/i, 0.6],
  ['subheadline', /sub[\s_-]*head|subtitle/i, 0.6],
  ['date', /\bdate\b/i, 0.55],
  ['chairman_photo', /chairman/i, 0.85],
  ['correspondent_photo', /correspondent/i, 0.85],
  ['principal_photo', /principal|headmaster/i, 0.8],
  ['student_photo', /student|pupil|portrait|child/i, 0.6],
  ['programme_text', /programme|program|agenda|schedule/i, 0.6],
  ['birthday_section', /birthday|bday/i, 0.7],
  ['footer', /footer|bottom[\s_-]*bar/i, 0.6],
  ['background', /background|\bbg\b|backdrop/i, 0.6],
  ['background_overlay', /overlay|scrim|tint/i, 0.6],
  ['decorative_element', /decorat|ornament|flourish|swirl/i, 0.5],
  ['icon', /\bicon\b/i, 0.5],
  ['frame', /\bframe\b|border/i, 0.45],
];

// Weighted keyword rules over TEXT contents.
const TEXT_RULES: [SemanticRole, RegExp, number][] = [
  ['phone_number', /\b\d{10}\b|\+?\d[\d\s\-]{7,}/, 0.5],
  ['date', /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b|\b(20\d\d)\b/, 0.45],
  ['school_address', /\b(road|street|nagar|district|pin|village|\(m\))\b/i, 0.4],
];

function geometrySignals(layer: SceneLayer, doc: SceneGraph['document']): Signal[] {
  const out: Signal[] = [];
  if (!layer.bounds || doc.height === 0 || doc.width === 0) return out;
  const cx = (layer.x + layer.width / 2) / doc.width;
  const cy = (layer.y + layer.height / 2) / doc.height;
  const area = (layer.width * layer.height) / (doc.width * doc.height);
  // Full-canvas coverage strongly implies background.
  if (area > 0.85) out.push({ role: 'background', weight: 0.5, reason: 'covers >85% of canvas' });
  // Top band → headline area.
  if (layer.type === 'text' && cy < 0.28) out.push({ role: 'headline', weight: 0.3, reason: 'text in top band' });
  if (layer.type === 'text' && cy > 0.85) out.push({ role: 'footer', weight: 0.3, reason: 'text in bottom band' });
  // Small top-corner smart object → a logo.
  if ((layer.smartObject || layer.type === 'pixel') && cy < 0.2 && area < 0.06) {
    out.push({ role: cx < 0.5 ? 'school_logo' : 'lead_logo', weight: 0.35, reason: 'small top-corner mark' });
  }
  return out;
}

function assetSignals(layer: SceneLayer, ctx: MapperContext): Signal[] {
  const out: Signal[] = [];
  const known = ctx.knownAssets ?? {};
  const base = layer.name.toLowerCase();
  const roleByAssetKey: Record<string, SemanticRole> = {
    schoolLogo: 'school_logo', leadLogo: 'lead_logo', chairmanPhoto: 'chairman_photo',
    correspondentPhoto: 'correspondent_photo', principalPhoto: 'principal_photo',
  };
  for (const [key, file] of Object.entries(known)) {
    if (!file) continue;
    const fileBase = String(file).toLowerCase().replace(/\.[a-z0-9]+$/, '');
    // Asset match is a *supporting* signal (weight kept moderate) — never the
    // sole identifier (§ "Never identify an element only by filename").
    if (fileBase && base.includes(fileBase) && roleByAssetKey[key]) {
      out.push({ role: roleByAssetKey[key], weight: 0.4, reason: `matches known asset ${key}` });
    }
  }
  return out;
}

export function mapLayer(layer: SceneLayer, doc: SceneGraph['document'], ctx: MapperContext = {}): SemanticMatch {
  const signals: Signal[] = [];

  // Application metadata is the strongest single signal when present.
  const metaRole = ctx.appMetadataRoleByLayerName?.[layer.name];
  if (metaRole) signals.push({ role: metaRole, weight: 0.85, reason: 'application metadata' });

  for (const [role, re, w] of NAME_RULES) if (re.test(layer.name)) signals.push({ role, weight: w, reason: `name matches /${re.source}/` });
  if (layer.text) for (const [role, re, w] of TEXT_RULES) if (re.test(layer.text)) signals.push({ role, weight: w, reason: `text matches /${re.source}/` });
  signals.push(...geometrySignals(layer, doc));
  signals.push(...assetSignals(layer, ctx));

  if (signals.length === 0) {
    // Fallbacks by pure type — low confidence.
    if (layer.type === 'text') return { layerId: layer.id, role: 'headline', confidence: 0.25, reasons: ['text layer, no other signal'] };
    return { layerId: layer.id, role: 'unknown_element', confidence: 0.1, reasons: ['no signal matched'] };
  }

  // Aggregate weights per role, then normalise with a soft cap.
  const byRole = new Map<SemanticRole, { weight: number; reasons: string[] }>();
  for (const s of signals) {
    const cur = byRole.get(s.role) ?? { weight: 0, reasons: [] };
    cur.weight += s.weight; cur.reasons.push(s.reason);
    byRole.set(s.role, cur);
  }
  let best: SemanticRole = 'unknown_element'; let bestWeight = 0; let reasons: string[] = [];
  for (const [role, v] of byRole) if (v.weight > bestWeight) { best = role; bestWeight = v.weight; reasons = v.reasons; }
  // Confidence = combined weight capped at 0.98, with a mild diminishing return.
  const confidence = Math.min(0.98, 1 - Math.exp(-bestWeight));
  return { layerId: layer.id, role: best, confidence: Number(confidence.toFixed(3)), reasons };
}

function flatten(layers: SceneLayer[], acc: SceneLayer[] = []): SceneLayer[] {
  for (const l of layers) { acc.push(l); if (l.children.length) flatten(l.children, acc); }
  return acc;
}

export function mapScene(scene: SceneGraph, ctx: MapperContext = {}): SemanticMatch[] {
  return flatten(scene.layers).map((l) => mapLayer(l, scene.document, ctx));
}

// Confidence below this should prompt the user to disambiguate.
export const LOW_CONFIDENCE = 0.45;

// Resolve targets for a command. If a role hint is given, prefer the highest
// confidence layer for that role; if it targets the active layer, return that.
export function resolveTargets(
  scene: SceneGraph,
  matches: SemanticMatch[],
  opts: { roleHint?: SemanticRole | null; targetsActiveLayer?: boolean },
): { targets: SemanticMatch[]; needsUserSelection: boolean } {
  if (opts.targetsActiveLayer && scene.activeLayerId != null) {
    const m = matches.find((x) => x.layerId === scene.activeLayerId)
      ?? { layerId: scene.activeLayerId, role: 'unknown_element' as SemanticRole, confidence: 1, reasons: ['active layer'] };
    return { targets: [{ ...m, confidence: 1 }], needsUserSelection: false };
  }
  if (opts.roleHint) {
    const candidates = matches.filter((m) => m.role === opts.roleHint).sort((a, b) => b.confidence - a.confidence);
    if (candidates.length === 0) return { targets: [], needsUserSelection: true };
    if (candidates[0].confidence < LOW_CONFIDENCE) return { targets: candidates.slice(0, 3), needsUserSelection: true };
    return { targets: [candidates[0]], needsUserSelection: false };
  }
  return { targets: [], needsUserSelection: true };
}
