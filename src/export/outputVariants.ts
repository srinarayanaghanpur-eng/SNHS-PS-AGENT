import type { ExportFormat } from '../types';
import { psRunJsx, psDuplicateDocument, psSavePng, psSaveJpeg, psSavePsd } from '../bridge/apiClient';
import { log } from '../utils/logger';

export type OutputSizeVariant = 'original' | '1:1' | '4:5' | '16:9' | 'a4-portrait' | 'a4-landscape';

export const SIZE_PRESETS: Record<OutputSizeVariant, { width: number; height: number; resolution: number } | null> = {
  original: null,
  '1:1': { width: 1080, height: 1080, resolution: 72 },
  '4:5': { width: 1080, height: 1350, resolution: 72 },
  '16:9': { width: 1920, height: 1080, resolution: 72 },
  'a4-portrait': { width: 2480, height: 3508, resolution: 300 },
  'a4-landscape': { width: 3508, height: 2480, resolution: 300 }
};

export interface VariantExportResult {
  variant: OutputSizeVariant;
  format: ExportFormat;
  fileName: string;
  success: boolean;
  error?: string;
}

export async function generateVariants(
  sourceDocId: number,
  baseName: string,
  exportFolder: string,
  variants: OutputSizeVariant[] = ['original', '1:1', '16:9', 'a4-portrait']
): Promise<VariantExportResult[]> {
  const results: VariantExportResult[] = [];

  for (const variant of variants) {
    const preset = SIZE_PRESETS[variant];
    let workingDocId = sourceDocId;

    try {
      if (preset) {
        const dupeResult = await psDuplicateDocument(sourceDocId);
        const idMatch = dupeResult.stdout?.match(/DOC_ID:(\d+)/);
        if (idMatch) workingDocId = Number(idMatch[1]);
        await resizeToFit(workingDocId, preset.width, preset.height, preset.resolution);
      }

      const formatsToExport: ExportFormat[] = ['png', 'jpeg'];
      if (variant === 'original') formatsToExport.push('psd');

      for (const format of formatsToExport) {
        const fileName = `${baseName}_${variant}.${format === 'jpeg' ? 'jpg' : format}`;
        const filePath = `${exportFolder}/${fileName}`;
        let ok = false;
        try {
          if (format === 'png') { await psSavePng(filePath, workingDocId); ok = true; }
          else if (format === 'jpeg') { await psSaveJpeg(filePath, 11, workingDocId); ok = true; }
          else if (format === 'psd') { await psSavePsd(filePath, workingDocId); ok = true; }
        } catch { ok = false; }
        results.push({ variant, format, fileName, success: ok, error: ok ? undefined : 'Export failed' });
      }

      if (preset && workingDocId !== sourceDocId) {
        await psRunJsx(`var doc = app.documents.getById(${workingDocId}); if (doc) doc.close(SaveOptions.DONOTSAVECHANGES);`);
      }
    } catch (err) {
      log('error', 'generateVariants', `Variant ${variant} failed: ${String(err)}`);
      results.push({ variant, format: 'png', fileName: `${baseName}_${variant}.png`, success: false, error: String(err) });
    }
  }
  return results;
}

async function resizeToFit(docId: number, targetW: number, targetH: number, resolution: number): Promise<void> {
  const jsx = `var doc = app.documents.getById(${docId});
if (!doc) { $.writeln("ERROR:doc not found"); }
var w = doc.width, h = doc.height;
var scale = Math.min(${targetW} / w, ${targetH} / h);
doc.resizeImage(Math.round(w * scale), Math.round(h * scale), ${resolution}, ResampleMethod.BICUBIC);
doc.resizeCanvas(${targetW}, ${targetH}, AnchorPosition.MIDDLECENTER);`;
  await psRunJsx(jsx);
}
