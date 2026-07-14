// Photo intelligence pipeline: analyse (faces/brightness/crop) + preprocess
// (cover-crop to the target box at the detected focus). Never invents imagery.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { join } from 'node:path';

export function analysePhoto(pyDir, imgPath, targetW, targetH) {
  try {
    const out = execFileSync('python3', [join(pyDir, 'analyze_photo.py'), imgPath, String(targetW), String(targetH)], { encoding: 'utf8' });
    return JSON.parse(out);
  } catch (e) {
    return { error: String(e.message || e), faces: 0 };
  }
}

// Cover-crop an image to targetW x targetH honouring a focus point (0..1),
// keeping faces in frame. Returns output path.
export async function coverCrop(imgPath, targetW, targetH, focus, outPath) {
  const meta = await sharp(imgPath).metadata();
  const scale = Math.max(targetW / meta.width, targetH / meta.height);
  const rw = Math.round(meta.width * scale);
  const rh = Math.round(meta.height * scale);
  const fx = focus?.x ?? 0.5, fy = focus?.y ?? 0.5;
  let left = Math.round(fx * rw - targetW / 2);
  let top = Math.round(fy * rh - targetH / 2);
  left = Math.max(0, Math.min(left, rw - targetW));
  top = Math.max(0, Math.min(top, rh - targetH));
  await sharp(imgPath)
    .resize(rw, rh)
    .extract({ left, top, width: Math.min(targetW, rw), height: Math.min(targetH, rh) })
    .png()
    .toFile(outPath);
  return outPath;
}

// Flatten a logo that has a white (non-alpha) background onto transparency by
// keying near-white to transparent — so partner marks sit cleanly on dark bars.
export async function keyWhiteToAlpha(imgPath, outPath, threshold = 238) {
  const img = sharp(imgPath).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  for (let i = 0; i < data.length; i += ch) {
    if (data[i] >= threshold && data[i + 1] >= threshold && data[i + 2] >= threshold) {
      data[i + 3] = 0;
    }
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: ch } }).png().toFile(outPath);
  return outPath;
}

export function isReadable(p) { return p && existsSync(p); }
