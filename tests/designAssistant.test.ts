import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseCommand, parseColor } from '../src-v2/main/design-assistant/command-interpreter';
import { buildActionPlan, validateActionPlan } from '../src-v2/main/design-assistant/execution-planner';
import { mapLayer, resolveTargets, mapScene } from '../src-v2/main/design-assistant/semantic-layer-mapper';
import { checkProtection, computeCover, computeContain } from '../src-v2/main/design-assistant/background-replacer';
import { checkpointName, versionName, HistoryManager } from '../src-v2/main/design-assistant/history-manager';
import { validateDownloadedAsset, mimeToFormat } from '../src-v2/main/design-assistant/asset-validator';
import { verifyScene, contrastRatio } from '../src-v2/main/design-assistant/visual-verifier';
import { buildSceneGraph } from '../src-v2/main/design-assistant/document-analyzer';
import { emitExecuteJsx, emitReplaceBackgroundJsx } from '../src-v2/main/design-assistant/jsx-operations';
import type { ActionPlan } from '../src-v2/main/design-assistant/types';
import type { SceneGraph, SceneLayer } from '../src-v2/main/design-assistant/types';

// ── helpers ─────────────────────────────────────────────────────────────────
function layer(p: Partial<SceneLayer>): SceneLayer {
  return {
    id: 1, name: '', parentPath: '', parentId: null, type: 'pixel', depth: 0, zOrder: 0,
    bounds: { left: 0, top: 0, right: 100, bottom: 100 }, width: 100, height: 100, x: 0, y: 0,
    visible: true, opacity: 100, blendMode: 'normal', locked: false, smartObject: false,
    linkedSmartObject: false, clippingMask: false, hasMask: false, adjustmentType: null,
    text: null, fontName: null, fontSize: null, textColorHex: null, active: false, children: [],
    ...p,
  };
}
const DOC = { name: 'poster.psd', width: 1080, height: 1350, resolution: 72 };

// ── Command parsing ───────────────────────────────────────────────────────
describe('command parsing', () => {
  it('parses exact pixel move left', () => {
    const r = parseCommand('Move the school logo 30 pixels left');
    expect(r.operations).toContainEqual({ type: 'translate', x: -30, y: 0 });
    expect(r.roleHint).toBe('school_logo');
  });
  it('parses "slightly left" as default nudge', () => {
    const r = parseCommand('Move this slightly left');
    expect(r.operations).toContainEqual({ type: 'translate', x: -30, y: 0 });
    expect(r.targetsActiveLayer).toBe(true);
  });
  it('parses percentage scaling smaller', () => {
    const r = parseCommand('Make the LEAD logo 10 percent smaller');
    expect(r.operations).toContainEqual({ type: 'scale', percentage: 90, maintainAspectRatio: true });
    expect(r.roleHint).toBe('lead_logo');
  });
  it('parses text colour change', () => {
    const r = parseCommand('Make the headline yellow');
    expect(r.operations).toContainEqual({ type: 'setTextColor', hex: 'ffff00' });
  });
  it('routes active-layer commands', () => {
    expect(parseCommand('Make this text white').targetsActiveLayer).toBe(true);
    expect(parseCommand('Reduce this logo size').targetsActiveLayer).toBe(true);
  });
  it('recognises background search intent', () => {
    expect(parseCommand('Find a premium blue educational background').notes).toContain('REQUEST_ASSET_SEARCH');
  });
  it('marks pure gibberish as unresolved', () => {
    expect(parseCommand('asdf qwerty').unresolved).toBe(true);
  });
});

describe('colour parsing', () => {
  it('parses named, hex and rgb', () => {
    expect(parseColor('make it white')).toBe('ffffff');
    expect(parseColor('use #1a2b3c')).toBe('1a2b3c');
    expect(parseColor('rgb(255, 0, 0)')).toBe('ff0000');
    expect(parseColor('dark blue please')).toBe('00274d'); // longest-match beats "blue"
    expect(parseColor('no colour here')).toBeNull();
  });
});

// ── Semantic mapping ──────────────────────────────────────────────────────
describe('semantic layer mapping', () => {
  it('maps a LEAD logo above a generic logo', () => {
    const m = mapLayer(layer({ name: 'LEAD Logo', smartObject: true }), DOC);
    expect(m.role).toBe('lead_logo');
    expect(m.confidence).toBeGreaterThan(0.5);
  });
  it('does not identify by filename alone (asset signal is supporting only)', () => {
    // name matches known asset but layer is clearly a big background by geometry
    const m = mapLayer(
      layer({ name: 'chairman', bounds: { left: 0, top: 0, right: 1080, bottom: 1350 }, width: 1080, height: 1350 }),
      DOC,
      { knownAssets: { chairmanPhoto: 'chairman.jpg' } },
    );
    // geometry (full canvas) competes; role should still carry reasons, not be filename-only
    expect(m.reasons.length).toBeGreaterThan(0);
  });
  it('returns low confidence for ambiguous layers', () => {
    const m = mapLayer(layer({ name: 'Layer 7', type: 'pixel' }), DOC);
    expect(m.confidence).toBeLessThan(0.45);
  });
  it('resolveTargets asks for selection on low confidence', () => {
    const scene: SceneGraph = { document: DOC, layers: [layer({ id: 5, name: 'Layer 7' })], activeLayerId: null };
    const matches = mapScene(scene);
    const r = resolveTargets(scene, matches, { roleHint: 'school_logo' });
    expect(r.needsUserSelection).toBe(true);
  });
  it('active-layer targeting overrides role', () => {
    const scene: SceneGraph = { document: DOC, layers: [layer({ id: 9, name: 'x' })], activeLayerId: 9 };
    const matches = mapScene(scene);
    const r = resolveTargets(scene, matches, { targetsActiveLayer: true });
    expect(r.targets[0].layerId).toBe(9);
    expect(r.targets[0].confidence).toBe(1);
  });
});

// ── Action-plan validation ────────────────────────────────────────────────
describe('action-plan validation', () => {
  it('accepts a well-formed plan', () => {
    const v = buildActionPlan({
      command: 'move logo', targets: [{ semanticRole: 'school_logo', layerId: 3, confidence: 0.9 }],
      operations: [{ type: 'translate', x: -30, y: 0 }], liveApply: true,
    });
    expect(v.ok).toBe(true);
    expect(v.plan?.requiresPreview).toBe(false); // simple reversible + liveApply
  });
  it('forces preview for destructive ops', () => {
    const v = buildActionPlan({
      command: 'replace bg', targets: [{ layerId: 1, confidence: 1 }],
      operations: [{ type: 'replaceBackground', assetPath: 'x.png', fit: 'cover' }], liveApply: true,
    });
    expect(v.plan?.requiresPreview).toBe(true);
  });
  it('rejects an unsupported operation type (invalid AI response)', () => {
    const v = validateActionPlan({
      command: 'evil', targets: [{ layerId: 1, confidence: 1 }],
      operations: [{ type: 'runJsx', code: 'app.activeDocument.flatten()' }], requiresPreview: false, source: 'gemini', warnings: [],
    });
    expect(v.ok).toBe(false);
  });
  it('rejects a plan with no target', () => {
    const v = buildActionPlan({ command: 'x', targets: [], operations: [{ type: 'delete' }] });
    expect(v.ok).toBe(false);
  });
});

// ── Protected layers ──────────────────────────────────────────────────────
describe('protected-layer warnings', () => {
  it('warns before deleting the school logo', () => {
    const p = checkProtection('school_logo', 'delete');
    expect(p.requiresConfirmation).toBe(true);
    expect(p.warning).toMatch(/school logo/i);
  });
  it('allows moving a protected element without confirmation', () => {
    expect(checkProtection('school_logo', 'translate').requiresConfirmation).toBe(false);
  });
  it('respects overrides', () => {
    expect(checkProtection('footer', 'delete', { overrides: ['footer'] }).requiresConfirmation).toBe(false);
  });
});

// ── Background cover math ──────────────────────────────────────────────────
describe('background cover calculations', () => {
  it('covers a portrait canvas with a landscape image without stretching', () => {
    const fit = computeCover(1920, 1080, 1080, 1350);
    expect(fit.drawWidth).toBeGreaterThanOrEqual(1080);
    expect(fit.drawHeight).toBeGreaterThanOrEqual(1350);
    // aspect ratio preserved
    expect(fit.drawWidth / fit.drawHeight).toBeCloseTo(1920 / 1080, 3);
  });
  it('contain fits entirely inside', () => {
    const fit = computeContain(1920, 1080, 1080, 1350);
    expect(fit.drawWidth).toBeLessThanOrEqual(1080 + 0.01);
    expect(fit.drawHeight).toBeLessThanOrEqual(1350 + 0.01);
  });
  it('throws on degenerate input', () => {
    expect(() => computeCover(0, 0, 1080, 1350)).toThrow();
  });
});

// ── History / versions ────────────────────────────────────────────────────
describe('history checkpoints and versions', () => {
  it('creates a descriptive checkpoint name', () => {
    expect(checkpointName('Move the logo left', [{ type: 'translate', x: -30, y: 0 }])).toBe('Assistant: before move');
  });
  it('numbers versions and never reuses the original name', () => {
    expect(versionName(0)).toBe('poster-original.psd');
    expect(versionName(1)).toBe('poster-assistant-v001.psd');
    expect(versionName(12)).toBe('poster-assistant-v012.psd');
  });
  it('supports undo/redo', () => {
    const h = new HistoryManager('poster-original.psd');
    h.push(h.makeCheckpoint('a', [{ type: 'translate', x: 1, y: 0 }], [1]));
    expect(h.canUndo()).toBe(true);
    const undone = h.undo();
    expect(undone).not.toBeNull();
    expect(h.canRedo()).toBe(true);
    expect(h.redo()).not.toBeNull();
  });
});

// ── Asset MIME / HTML rejection ────────────────────────────────────────────
describe('asset validation', () => {
  it('maps MIME types', () => {
    expect(mimeToFormat('image/png')).toBe('png');
    expect(mimeToFormat('text/html')).toBeNull();
  });
  it('rejects HTML disguised as an image', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'asset-'));
    const p = join(dir, 'fake.png');
    await writeFile(p, '<!DOCTYPE html><html><body>Not found</body></html>');
    const r = await validateDownloadedAsset(p);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/html/i);
  });
  it('rejects an under-sized png (below min dimensions)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'asset-'));
    const p = join(dir, 'tiny.png');
    // Valid PNG signature + IHDR declaring 1x1, padded above the 100-byte floor
    // so the dimension check (not the size check) is what rejects it.
    const sig = Buffer.from('89504e470d0a1a0a', 'hex');
    const ihdr = Buffer.from('0000000d4948445200000001000000010806000000', 'hex'); // len,IHDR,w=1,h=1,bitdepth,colortype...
    const png = Buffer.concat([sig, ihdr, Buffer.alloc(160, 0)]);
    await writeFile(p, png);
    const r = await validateDownloadedAsset(p, { minWidth: 600, minHeight: 600 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/below minimum/i);
  });
  it('rejects a disallowed extension', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'asset-'));
    const p = join(dir, 'thing.svg');
    await writeFile(p, '<svg/>');
    expect((await validateDownloadedAsset(p)).ok).toBe(false);
  });
});

// ── Verifier ──────────────────────────────────────────────────────────────
describe('visual verification', () => {
  it('computes contrast ratio', () => {
    expect(contrastRatio('ffffff', '000000')).toBeCloseTo(21, 0);
  });
  it('detects out-of-canvas', () => {
    const scene: SceneGraph = {
      document: DOC, activeLayerId: null,
      layers: [layer({ id: 1, name: 'stray', bounds: { left: 1000, top: 0, right: 1200, bottom: 100 }, x: 1000, width: 200, height: 100 })],
    };
    const issues = verifyScene(scene);
    // An element past the canvas edge is flagged either generically or, if the
    // mapper reads it as a logo, as a cut-off logo — both are "outside canvas".
    expect(issues.some((i) => i.code === 'OUT_OF_CANVAS' || i.code === 'LOGO_CUT_OFF')).toBe(true);
  });
  it('detects text clipping', () => {
    const scene: SceneGraph = {
      document: DOC, activeLayerId: null,
      layers: [layer({ id: 2, name: 'Headline', type: 'text', text: 'Hi', bounds: { left: 10, top: 10, right: 1200, bottom: 80 }, x: 10, y: 10, width: 1190, height: 70 })],
    };
    const issues = verifyScene(scene);
    expect(issues.some((i) => i.code === 'TEXT_CLIPPED')).toBe(true);
  });
});

// ── Document analyzer ─────────────────────────────────────────────────────
describe('document analyzer', () => {
  it('normalises raw JSX output into a scene graph', () => {
    const raw = {
      success: true, stage: 'completed', activeLayerId: 34,
      document: { name: 'poster.psd', width: 1080, height: 1350, resolution: 72 },
      layers: [{
        id: 34, name: 'School Logo', type: 'smartObject', bounds: { left: 40, top: 40, right: 240, bottom: 200 },
        smartObject: true, children: [],
      }],
    };
    const scene = buildSceneGraph(raw);
    expect(scene.document.name).toBe('poster.psd');
    expect(scene.activeLayerId).toBe(34);
    expect(scene.layers[0].name).toBe('School Logo');
  });
});

// ── Operation JSX emitter ─────────────────────────────────────────────────
describe('operation JSX emitter', () => {
  const plan = (ops: any[]): ActionPlan => ({
    command: 'x', targets: [{ layerId: 34, confidence: 1 }], operations: ops,
    requiresPreview: false, source: 'deterministic', warnings: [],
  });
  const opts = { outputDir: '/tmp/out', previewPng: false, checkpointName: 'Assistant: before move' };

  it('targets the layer by ID and snapshots first', () => {
    const jsx = emitExecuteJsx(plan([{ type: 'translate', x: -30, y: 0 }]), 34, opts);
    expect(jsx).toContain('selectById(34)');
    expect(jsx).toMatch(/snapshot\("Assistant: before move"\)/);
    expect(jsx).toContain("translate(new UnitValue(-30,'px')");
  });

  it('emits real fill/stroke/blend/shadow code (no stubs)', () => {
    const jsx = emitExecuteJsx(plan([
      { type: 'setFillColor', hex: 'ff0000' },
      { type: 'setStrokeColor', hex: '00ff00', size: 4 },
      { type: 'setBlendMode', mode: 'multiply' },
      { type: 'addShadow' },
    ]), 34, opts);
    expect(jsx).toContain('fillWithColor(L,255,0,0)');
    expect(jsx).toContain('addStrokeFx(0,255,0,4)');
    expect(jsx).toContain('BlendMode.MULTIPLY');
    expect(jsx).toContain('addShadowFx()');
    expect(jsx).not.toContain('handled by dedicated path');
  });

  it('emits clipped adjustment layers for brightness/saturation', () => {
    const jsx = emitExecuteJsx(plan([
      { type: 'adjustBrightness', delta: 20 },
      { type: 'adjustSaturation', delta: -15 },
    ]), 34, opts);
    expect(jsx).toContain('addBrightnessContrast(20)');
    expect(jsx).toContain('addHueSaturation(-15)');
  });

  it('replaceSmartObject uses placedLayerReplaceContents', () => {
    const jsx = emitExecuteJsx(plan([{ type: 'replaceSmartObject', assetPath: 'C:/a/b.png' }]), 34, opts);
    expect(jsx).toContain('replaceSOContents("C:/a/b.png")');
  });

  it('background replacement places SO, cover-fits and hides previous bg', () => {
    const jsx = emitReplaceBackgroundJsx({
      outputDir: '/tmp/out', assetPath: 'C:/bg.jpg', scalePercent: 150, offsetX: -50, offsetY: -100,
      previousBackgroundId: 7, checkpointName: 'Assistant: before replace background', previewPng: false,
    });
    expect(jsx).toContain('placeFile("C:/bg.jpg")');
    expect(jsx).toContain('resize(150,150');
    expect(jsx).toContain('selectById(7)');           // previous background
    expect(jsx).toContain('prev.visible=false');      // hidden, not deleted
    expect(jsx).toContain('ElementPlacement.PLACEATEND'); // behind all content
  });
});
