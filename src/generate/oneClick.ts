/**
 * One-click workflow (the spec's minimum user flow):
 * Upload reference poster → automatic analysis (OCR + detection) → automatic
 * generation → exports. Each stage's own fallback chains apply; a stage
 * failure surfaces the saved project so the user can resume, never losing work.
 */
import type { ExportFormat, ReferenceProject, SchoolProfile } from '../types';
import { PluginError } from '../utils/errors';
import { uploadReferencePoster } from '../ingest/posterUpload';
import { analyzeProjectText } from '../ocr/ocrPipeline';
import { ocrReady } from '../ocr/tesseractEngine';
import { generateFromReference, type RebuildResult } from './posterRebuilder';

export interface OneClickOutcome { project: ReferenceProject; result?: RebuildResult }

export async function uploadAnalyzeGenerate(
  profile: SchoolProfile,
  exportFolder: any,
  onProgress?: (message: string, percent: number) => void,
  formats: ExportFormat[] = ['psd', 'png', 'jpeg', 'pdf']
): Promise<OneClickOutcome | undefined> {
  if (!exportFolder)
    throw new PluginError('NO_EXPORT_FOLDER', 'Choose an export folder first.', 'Click "Choose Export Folder…" before One-Click Generate.');
  if (!(await ocrReady()))
    throw new PluginError('MODELS_MISSING', 'OCR models are not installed.', 'Open AI Models and download or import the offline model pack first.');

  const stage = (base: number, span: number) => (m: string, p: number) => onProgress?.(m, Math.round(base + (p / 100) * span));

  const uploaded = await uploadReferencePoster(profile, stage(0, 15));
  if (!uploaded) return undefined; // user cancelled the picker

  let project = uploaded;
  try {
    project = await analyzeProjectText(project, stage(15, 45));
  } catch (err) {
    // analysis failure → project persists; report with resume guidance
    throw new PluginError('ANALYZE_FAILED', `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      'The uploaded project is saved under Reference Posters — fix the issue and click Analyze Text (OCR) there.', err);
  }
  const result = await generateFromReference(project, exportFolder, stage(60, 40), formats);
  return { project, result };
}
