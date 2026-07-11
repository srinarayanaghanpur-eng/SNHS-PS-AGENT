import type { GrayImage } from './imaging';
import { encodeGrayBmp } from './imaging';
import { log } from '../utils/logger';

export type OcrLang = 'eng' | 'tel' | 'eng+tel';
export interface OcrWord { text: string; confidence: number; left: number; top: number; width: number; height: number; lineIndex: number }
export interface OcrLine { text: string; confidence: number; left: number; top: number; width: number; height: number; words: OcrWord[] }
export interface OcrResult { lines: OcrLine[]; meanConfidence: number; lang: OcrLang; variant?: string }

let tesseractWorker: any = null;

async function getWorker(): Promise<any> {
  if (tesseractWorker) return tesseractWorker;
  const Tesseract = (window as any).Tesseract;
  if (!Tesseract) {
    try {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Tesseract.js from CDN'));
        document.head.appendChild(script);
      });
    } catch (err) {
      log('warn', 'tesseractEngine', `CDN load failed: ${err}. OCR will be unavailable.`);
      return null;
    }
  }
  const T = (window as any).Tesseract;
  if (!T) return null;
  try {
    tesseractWorker = await T.createWorker('eng', 1, {
      logger: (m: any) => m.status === 'loading tesseract core' && log('info', 'tesseract', `Loading core: ${m.progress || 0}%`),
    });
    return tesseractWorker;
  } catch (err) {
    log('error', 'tesseractEngine', `Failed to create Tesseract worker: ${err}`);
    return null;
  }
}

export async function ocrReady(lang: OcrLang = 'eng+tel'): Promise<boolean> {
  const w = await getWorker();
  return w !== null;
}

export async function recognize(img: GrayImage, lang: OcrLang = 'eng+tel', psm = 11): Promise<OcrResult> {
  const worker = await getWorker();
  if (!worker) return { lines: [], meanConfidence: 0, lang };

  const bmp = encodeGrayBmp(img);
  const blob = new Blob([bmp as BlobPart], { type: 'image/bmp' });
  const url = URL.createObjectURL(blob);

  try {
    const result = await worker.recognize(url);
    const lines: OcrLine[] = (result.data.words || []).reduce((acc: OcrLine[], word: any) => {
      const lineIdx = word.line || 0;
      if (!acc[lineIdx]) {
        acc[lineIdx] = { text: '', confidence: 0, left: word.bbox.x0, top: word.bbox.y0, width: word.bbox.x1 - word.bbox.x0, height: word.bbox.y1 - word.bbox.y0, words: [] };
      }
      acc[lineIdx].words.push({
        text: word.text,
        confidence: word.confidence,
        left: word.bbox.x0, top: word.bbox.y0,
        width: word.bbox.x1 - word.bbox.x0, height: word.bbox.y1 - word.bbox.y0,
        lineIndex: lineIdx,
      });
      acc[lineIdx].text += (acc[lineIdx].text ? ' ' : '') + word.text;
      return acc;
    }, []);

    for (const l of lines) {
      l.confidence = l.words.length ? l.words.reduce((s, w) => s + w.confidence, 0) / l.words.length : 0;
    }

    const meanConfidence = lines.length ? lines.reduce((s, l) => s + l.confidence, 0) / lines.length : 0;
    return { lines, meanConfidence, lang };
  } finally {
    URL.revokeObjectURL(url);
  }
}
