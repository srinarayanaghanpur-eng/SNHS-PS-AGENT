import type { DetectedObject } from '../../types';
import type { GrayImage } from '../../ocr/imaging';
import { log } from '../../utils/logger';
import { adaptiveThreshold } from '../../ocr/imaging';
import { connectedComponents } from '../../ocr/regionDetector';
import { resize } from '../../ocr/imaging';
export interface Box { left: number; top: number; width: number; height: number }

/**
 * Run object detection on a grayscale preview image.
 * Uses @huggingface/transformers ONNX if the model is installed and available,
 * otherwise falls back to pure-JS heuristic detection using connected-component
 * analysis on the binarised image.
 */
export async function detectObjects(gray: GrayImage): Promise<DetectedObject[]> {
  const results: DetectedObject[] = [];

  // Attempt ONNX model path first
  if (await tryOnnxDetection(gray, results)) return results;

  // Fallback: heuristic detection using connected components
  return heuristicObjectDetection(gray);
}

async function tryOnnxDetection(_gray: GrayImage, _results: DetectedObject[]): Promise<boolean> {
  try {
    const HF = (globalThis as any)['@huggingface/transformers'];
    if (!HF || !HF.pipeline) return false;
    const detector = await HF.pipeline('object-detection', 'Xenova/yolov8n', {
      quantized: true,
      device: 'wasm'
    });
    const out = await detector(_gray.data, { threshold: 0.3 });
    if (Array.isArray(out)) {
      for (const item of out) {
        if (item && item.label && typeof item.score === 'number' && item.box) {
          (_results as any[]).push({
            label: String(item.label),
            confidence: Math.round(item.score * 100),
            bounds: {
              left: Math.round(item.box.xmin), top: Math.round(item.box.ymin),
              right: Math.round(item.box.xmax), bottom: Math.round(item.box.ymax),
              width: Math.round(item.box.xmax - item.box.xmin),
              height: Math.round(item.box.ymax - item.box.ymin)
            }
          });
        }
      }
    }
    return _results.length > 0;
  } catch {
    return false;
  }
}

const PERSON_LIKE_ASPECT = { min: 0.15, max: 0.7 };
const OBJECT_LABELS: Array<{ label: string; keywords: string[] }> = [
  { label: 'person', keywords: ['person', 'student', 'people'] },
  { label: 'book', keywords: ['book'] },
  { label: 'bus', keywords: ['bus', 'vehicle'] }
];

function heuristicObjectDetection(gray: GrayImage): DetectedObject[] {
  const results: DetectedObject[] = [];
  try {
    const down = gray.width > 1000 || gray.height > 1000
      ? resize(gray, Math.min(1000, gray.width), Math.round(gray.height * Math.min(1, 1000 / Math.max(gray.width, gray.height))))
      : gray;
    const bin = adaptiveThreshold(down);
    const comps = connectedComponents(bin);
    const scaleX = gray.width / down.width;
    const scaleY = gray.height / down.height;

    const hRatio = Math.min(gray.width, gray.height) * 0.03;
    const candidates = comps.filter(c =>
      c.width >= hRatio && c.height >= hRatio &&
      c.width < gray.width * 0.5 && c.height < gray.height * 0.5
    );

    for (const c of candidates) {
      const aspect = c.width / c.height;
      if (aspect >= PERSON_LIKE_ASPECT.min && aspect <= PERSON_LIKE_ASPECT.max && c.height > gray.height * 0.08) {
        results.push({
          label: 'person',
          confidence: Math.min(70, Math.round(35 + (c.height / (gray.height * 0.3)) * 30)),
          bounds: {
            left: Math.round(c.left * scaleX), top: Math.round(c.top * scaleY),
            right: Math.round((c.left + c.width) * scaleX),
            bottom: Math.round((c.top + c.height) * scaleY),
            width: Math.round(c.width * scaleX), height: Math.round(c.height * scaleY)
          }
        });
      } else if (c.width > c.height * 1.5 && c.height < gray.height * 0.04 && c.width > gray.width * 0.05) {
        results.push({
          label: 'book',
          confidence: Math.min(55, Math.round(30 + (c.width / gray.width) * 50)),
          bounds: {
            left: Math.round(c.left * scaleX), top: Math.round(c.top * scaleY),
            right: Math.round((c.left + c.width) * scaleX),
            bottom: Math.round((c.top + c.height) * scaleY),
            width: Math.round(c.width * scaleX), height: Math.round(c.height * scaleY)
          }
        });
      }
    }
  } catch (err) {
    log('warn', 'objectDetector', `Heuristic detection failed: ${String(err)}`);
  }
  return results;
}

export function objectsToRegions(objects: DetectedObject[], faceBounds: Box[]): DetectedObject[] {
  const faceSet = new Set(faceBounds.map(f => `${f.left},${f.top},${f.width},${f.height}`));
  return objects.filter(o => {
    const key = `${o.bounds.left},${o.bounds.top},${o.bounds.width},${o.bounds.height}`;
    return !faceSet.has(key);
  });
}
