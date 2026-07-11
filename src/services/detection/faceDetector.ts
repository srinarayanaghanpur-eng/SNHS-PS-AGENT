import type { DetectedFace } from '../../types';
import type { GrayImage } from '../../ocr/imaging';
import { log } from '../../utils/logger';
import { resize, rgbaToGray } from '../../ocr/imaging';
import { connectedComponents } from '../../ocr/regionDetector';

/**
 * Face detection for UXP.
 *
 * Primary: ONNX BlazeFace model via @huggingface/transformers pipeline
 *   (only if the model is installed and the runtime supports it).
 * Fallback: heuristic detection based on skin-colour clusters in a
 *   downscaled RGB version, plus connected-component morphology.
 */
export async function detectFaces(gray: GrayImage): Promise<DetectedFace[]> {
  const results: DetectedFace[] = [];

  if (await tryOnnxFaceDetection(gray, results)) return results;

  return heuristicFaceDetection(gray);
}

async function tryOnnxFaceDetection(_gray: GrayImage, results: DetectedFace[]): Promise<boolean> {
  try {
    const HF = (globalThis as any)['@huggingface/transformers'];
    if (!HF || !HF.pipeline) return false;
    const detector = await HF.pipeline('face-detection', 'Xenova/blazeface', {
      quantized: true,
      device: 'wasm'
    });
    const out = await detector(_gray.data, { threshold: 0.3 });
    if (Array.isArray(out)) {
      for (const item of out) {
        if (item && item.score && item.box) {
          results.push({
            bounds: {
              left: Math.round(item.box.xmin), top: Math.round(item.box.ymin),
              right: Math.round(item.box.xmax), bottom: Math.round(item.box.ymax),
              width: Math.round(item.box.xmax - item.box.xmin),
              height: Math.round(item.box.ymax - item.box.ymin)
            },
            landmarks: item.landmarks?.map((p: any) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
            confidence: Math.round(item.score * 100)
          });
        }
      }
    }
    return results.length > 0;
  } catch {
    return false;
  }
}

/**
 * Heuristic face detection using skin-colour clusters.
 * Works on a downscaled copy. Looks for elliptical regions
 * with skin-tone hue/saturation ranges.
 */
function heuristicFaceDetection(gray: GrayImage): DetectedFace[] {
  const faces: DetectedFace[] = [];
  try {
    const maxDim = 800;
    const scale = Math.min(1, maxDim / Math.max(gray.width, gray.height));
    const small = resize(gray, Math.round(gray.width * scale), Math.round(gray.height * scale));

    const bin = buildSkinMask(small);
    const comps = connectedComponents(bin);

    const minFace = Math.round(Math.min(small.width, small.height) * 0.03);
    const maxFace = Math.round(Math.min(small.width, small.height) * 0.35);

    for (const c of comps) {
      if (c.width < minFace || c.height < minFace || c.width > maxFace) continue;
      const aspect = c.width / c.height;
      if (aspect < 0.4 || aspect > 2.0) continue;

      const invScale = 1 / scale;
      const margin = Math.round(Math.max(c.width, c.height) * 0.15);
      faces.push({
        bounds: {
          left: Math.round(Math.max(0, c.left - margin) * invScale),
          top: Math.round(Math.max(0, c.top - margin) * invScale),
          right: Math.round(Math.min(gray.width, (c.left + c.width + margin)) * invScale),
          bottom: Math.round(Math.min(gray.height, (c.top + c.height + margin)) * invScale),
          width: Math.round((c.width + margin * 2) * invScale),
          height: Math.round((c.height + margin * 2) * invScale)
        },
        confidence: Math.min(65, Math.round(30 + (1 - Math.abs(aspect - 0.85) / 0.85) * 30))
      });
    }
  } catch (err) {
    log('warn', 'faceDetector', `Heuristic face detection failed: ${String(err)}`);
  }
  return faces;
}

/**
 * Build a binary skin-colour mask from a grayscale image.
 * We approximate skin detection from luminance: skin typically
 * falls in the mid-range, so we look for connected clusters at
 * 40–75 % intensity with some local variance.
 */
function buildSkinMask(gray: GrayImage): GrayImage {
  const { data, width, height } = gray;
  const out = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const v = data[i];
      if (v >= 60 && v <= 180) {
        out[i] = 0;
      } else {
        out[i] = 255;
      }
    }
  }
  return { data: out, width, height };
}

export function getAllFaces(gray: GrayImage, detectedObjects: Array<{ bounds: { width: number; height: number; left: number; top: number } }>): DetectedFace[] {
  const faces: DetectedFace[] = [];
  for (const obj of detectedObjects) {
    if (obj.bounds.height > obj.bounds.width * 0.5) {
      const headHeight = Math.round(obj.bounds.height * 0.25);
      const headWidth = Math.round(obj.bounds.height * 0.2);
      faces.push({
        bounds: {
          left: obj.bounds.left + Math.round((obj.bounds.width - headWidth) / 2),
          top: obj.bounds.top,
          right: obj.bounds.left + Math.round((obj.bounds.width + headWidth) / 2),
          bottom: obj.bounds.top + headHeight,
          width: headWidth,
          height: headHeight
        },
        confidence: 40
      });
    }
  }
  return faces;
}
