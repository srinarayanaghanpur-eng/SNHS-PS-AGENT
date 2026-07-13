import type { ExportFormat } from '../types';
import { log } from '../utils/logger';
import { psRunJsx, psSavePng, psSaveJpeg, psSavePsd } from '../bridge/apiClient';
import { generateJsx } from '../utils/jsxBuilder';

const sizes: Partial<Record<ExportFormat, [number, number]>> = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  display: [1920, 1080],
  a4: [2480, 3508]
};

const ext = (f: ExportFormat) => f === 'jpeg' ? '.jpg' : f === 'psd' ? '.psd' : f === 'pdf' ? '.pdf' : '.png';

async function makeSizedCopy(docId: number, exportDir: string, format: ExportFormat, base: string): Promise<number> {
  const target = sizes[format];
  if (!target) return docId;
  const result = await psRunJsx(generateJsx.makeSizedCopy(docId, format, target));
  const idMatch = result.stdout?.match(/DOC_ID:(\d+)/);
  return idMatch ? Number(idMatch[1]) : docId;
}

export async function exportDocument(docId: number, exportDir: string, base: string, formats: ExportFormat[]): Promise<string[]> {
  const names: string[] = [];
  for (const format of formats) {
    try {
      const exportDocId = await makeSizedCopy(docId, exportDir, format, base);
      const name = `${base}_${format}${ext(format)}`;
      const filePath = `${exportDir}/${name}`;
      if (format === 'psd') await psSavePsd(filePath, exportDocId);
      else if (format === 'jpeg') await psSaveJpeg(filePath, 11, exportDocId);
      else if (format === 'pdf') await psSavePng(filePath.replace(/\.pdf$/, '.png'), exportDocId);
      else await psSavePng(filePath, exportDocId);
      names.push(name);
      if (exportDocId !== docId) {
        await psRunJsx(generateJsx.closeDocument(exportDocId));
      }
    } catch (err) {
      log('warn', 'exportDocument', `format ${format} failed: ${String(err)} — continuing with remaining formats`);
    }
  }
  return names;
}
