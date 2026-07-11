import type { AnalysisResult, ClassifiedLayer, TemplateManifest } from '../types';
import { id } from '../utils/hash';
import { classifyLayers } from './layerClassifier';
import { templateFingerprint } from './templateFingerprint';
import { scanActiveDocument } from './photoshopScanner';
import { findByFingerprint, saveManifest } from './templateStorage';

const rebuild = (nodes: any[], byId: Map<number, ClassifiedLayer>): ClassifiedLayer[] =>
  nodes.map((n: any) => ({
    ...byId.get(n.layerId)!,
    children: rebuild(n.children, byId),
  }));

export async function analyzeCurrentPsd(onProgress?: (m: string, p: number) => void): Promise<AnalysisResult> {
  const scan = await scanActiveDocument(onProgress);
  onProgress?.('Understanding layers', 55);
  const fp = templateFingerprint(scan.docName, scan.docWidth, scan.docHeight, scan.layers);
  const existing = await findByFingerprint(fp);
  if (existing) {
    onProgress?.('Loaded saved template', 100);
    return { manifest: existing, reused: true, warnings: [] };
  }
  const rawLayers = scan.layers.map((l: any) => ({
    layerId: l.id,
    name: l.name || '',
    path: l.path || l.name,
    type: l.type || 'pixel',
    visible: l.visible,
    opacity: l.opacity,
    depth: 0,
    bounds: l.bounds ? { left: l.left || 0, top: l.top || 0, right: l.right || 0, bottom: l.bottom || 0, width: (l.right || 0) - (l.left || 0), height: (l.bottom || 0) - (l.top || 0) } : undefined,
  }));
  const classified = classifyLayers(rawLayers as any, scan.docWidth, scan.docHeight);
  const now = new Date().toISOString();
  const byId = new Map(classified.map(l => [l.layerId, l]));
  const manifest: TemplateManifest = {
    schemaVersion: 1,
    templateId: id('template'),
    templateName: scan.docName.replace(/\.[^.]+$/, '') || 'Untitled Template',
    sourceFilename: scan.docName,
    documentWidth: scan.docWidth,
    documentHeight: scan.docHeight,
    resolution: scan.docResolution,
    createdAt: now,
    updatedAt: now,
    fingerprint: fp,
    layers: classified,
    hierarchy: rebuild(scan.layers, byId),
    reviewLayerIds: classified.filter(l => l.confidence < 65 || l.conflict).map(l => l.layerId),
    tagged: false,
  };
  onProgress?.('Saving template manifest', 92);
  await saveManifest(manifest);
  onProgress?.('Template ready', 100);
  return { manifest, reused: false, warnings: manifest.reviewLayerIds.length ? [`${manifest.reviewLayerIds.length} uncertain layers need optional review.`] : [] };
}
