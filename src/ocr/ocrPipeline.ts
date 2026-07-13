/**
 * Phase 2 orchestrator: pixels → preprocessing variants → full-poster OCR →
 * region proposals → per-region OCR → confidence merge → semantic
 * classification → persisted DetectedRegions on the project.
 *
 * Fallback chain (mandated): poor full-pass confidence → next variant →
 * region-only OCR → if everything fails, project continues with zero text
 * regions flagged for hybrid-region preservation; the job is never cancelled.
 */
import type { DetectedRegion, ReferenceProject } from '../types';
import { id } from '../utils/hash';
import { log } from '../utils/logger';
import { getDocumentPixels, crop, type GrayImage } from './imaging';
import { buildVariants } from './preprocess';
import { detectTextRegions } from './regionDetector';
import { ocrReady, recognize, type OcrLine } from './tesseractEngine';
import { classifyText, detectLanguage, toSemanticRole } from './textClassifier';
import { mergeCandidates, type MergeCandidate } from './merge';
import { reopenReference } from '../ingest/posterUpload';
import { saveProject } from '../project/projectStore';
import { runFullDetection, finalizeProjectAnalysis } from '../services/detection/index';

const GOOD_CONFIDENCE = 62;

function linesToCandidates(lines: OcrLine[], source: string, offsetX = 0, offsetY = 0, scale = 1): MergeCandidate[] {
  return lines.map(l => ({
    text: l.text, confidence: l.confidence, source,
    left: offsetX + l.left * scale, top: offsetY + l.top * scale,
    width: l.width * scale, height: l.height * scale
  }));
}

/**
 * Run the complete OCR analysis for a project. Mutates + persists the project.
 * `onProgress` drives the UI. Never throws for OCR-quality reasons — only for
 * missing models or missing reference (both user-fixable and reported).
 */
export async function analyzeProjectText(
  project: ReferenceProject,
  onProgress?: (message: string, percent: number) => void
): Promise<ReferenceProject> {
  if (!(await ocrReady())) {
    throw Object.assign(new Error('OCR models are not installed.'), {
      solution: 'Open AI Models and download or import the offline model pack first.'
    });
  }
  let p: ReferenceProject = { ...project, status: 'analyzing', failedElements: [...project.failedElements] };
  p = await saveProject(p);

  onProgress?.('Reading poster pixels…', 5);
  let gray: GrayImage;
  try {
    gray = await getDocumentPixels(p.reference.psDocumentId ?? -1);
  } catch {
    // document not open any more — reopen from the stored copy (resume support)
    p = await reopenReference(p);
    gray = await getDocumentPixels(p.reference.psDocumentId!);
  }
  const scaleToDoc = p.reference.width / gray.width; // detection ran on the preview

  onProgress?.('Preparing image variants…', 12);
  const variants = buildVariants(gray);
  const candidates: MergeCandidate[] = [];
  let deskewAngle = 0;

  // Pass 1: full-poster OCR, variant by variant until good enough
  let best = -1;
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    onProgress?.(`OCR full poster (${v.name})…`, 15 + Math.round((i / variants.length) * 35));
    try {
      const scale = gray.width / v.image.width;
      const res = await recognize(v.image, 'eng+tel', 11);
      candidates.push(...linesToCandidates(res.lines, `full:${v.name}`, 0, 0, scale));
      if (v.deskewAngle) deskewAngle = v.deskewAngle;
      if (res.meanConfidence > best) best = res.meanConfidence;
      log('info', 'ocrPipeline', `${v.name}: ${res.lines.length} lines, mean conf ${res.meanConfidence.toFixed(1)}`);
      if (res.meanConfidence >= GOOD_CONFIDENCE && res.lines.length > 0) break;
    } catch (err) {
      p.failedElements.push({ stage: 'ocr-full', elementId: v.name, message: String(err), recovered: true });
      log('warn', 'ocrPipeline', `variant ${v.name} failed: ${String(err)}`);
    }
  }

  // Pass 2: per-region OCR (denser PSM, better for headings and small blocks)
  onProgress?.('Detecting text regions…', 55);
  let regionBoxes: ReturnType<typeof detectTextRegions> = [];
  try { regionBoxes = detectTextRegions(gray); }
  catch (err) { p.failedElements.push({ stage: 'region-detect', message: String(err), recovered: true }); }
  for (let i = 0; i < Math.min(regionBoxes.length, 40); i++) {
    const b = regionBoxes[i];
    onProgress?.(`OCR region ${i + 1}/${Math.min(regionBoxes.length, 40)}…`, 58 + Math.round((i / Math.max(1, regionBoxes.length)) * 30));
    try {
      const sub = crop(gray, b.left, b.top, b.width, b.height);
      if (sub.width < 8 || sub.height < 8) continue;
      const res = await recognize(sub, 'eng+tel', 6);
      candidates.push(...linesToCandidates(res.lines, 'region', b.left, b.top, 1));
    } catch (err) {
      p.failedElements.push({ stage: 'ocr-region', elementId: `region-${i}`, message: String(err), recovered: true });
    }
  }

  onProgress?.('Merging and classifying…', 92);
  const merged = mergeCandidates(candidates);
  const regions: DetectedRegion[] = merged.map(c => {
    const cls = classifyText(c.text, p.profileSnapshot, {
      yNorm: (c.top + c.height / 2) / gray.height,
      heightNorm: c.height / gray.height
    });
    return {
      id: id('txt'),
      kind: 'text' as const,
      bounds: {
        left: Math.round(c.left * scaleToDoc), top: Math.round(c.top * scaleToDoc),
        right: Math.round((c.left + c.width) * scaleToDoc), bottom: Math.round((c.top + c.height) * scaleToDoc),
        width: Math.round(c.width * scaleToDoc), height: Math.round(c.height * scaleToDoc)
      },
      rotation: deskewAngle || undefined,
      text: c.text,
      language: detectLanguage(c.text),
      confidence: Math.round(Math.min(100, Math.max(0, (c.confidence + cls.confidence) / 2))),
      semanticRole: toSemanticRole(cls.textClass),
      replace: cls.replace,
      notes: `${cls.textClass} (${cls.reasons.join('; ')}) via ${c.source}`
    };
  });

  const textConf = merged.length ? merged.reduce((s, c) => s + c.confidence, 0) / merged.length : 0;

  // Phase 3: visual detection (object, face, logo, layout)
  onProgress?.('Running visual detection…', 95);
  let detectionPhase: import('../services/detection/index').DetectionResults | undefined;
  try {
    detectionPhase = await runFullDetection(gray, regions);
  } catch (err) {
    p.failedElements.push({ stage: 'detection', message: String(err), recovered: true });
  }
  if (detectionPhase) {
    p = finalizeProjectAnalysis(p, regions, detectionPhase);
    onProgress?.(
      `Found ${p.regions.length} total regions (${p.regions.filter(r => r.replace).length} to replace), mode: ${p.mode}`,
      100
    );
  } else {
    p = {
      ...p,
      status: 'analyzed',
      regions: [...p.regions.filter(r => r.kind !== 'text'), ...regions],
      overallConfidence: Math.round(textConf),
      mode: merged.length === 0 ? 'safe' : textConf >= GOOD_CONFIDENCE ? p.mode : 'hybrid'
    };
  }
  if (merged.length === 0)
    p.failedElements.push({ stage: 'ocr', message: 'No readable text found — poster flagged for hybrid-region preservation.', recovered: true });
  return saveProject(p);
}
