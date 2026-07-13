// Asset validator.
//
// Guards downloaded assets before they touch Photoshop (§ Security / Visible
// Chrome workflow). Reuses the existing magic-byte sniffing in imageValidation,
// then adds minimum-dimension checks and explicit HTML-disguised-as-image
// rejection. No file that fails here is ever imported.

import { open } from 'node:fs/promises';
import { extname } from 'node:path';
import { validateImageFile, type ImageCheck } from '../imageValidation';

export const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export interface AssetValidation {
  ok: boolean;
  reason?: string;
  format?: ImageCheck['format'];
  width?: number;
  height?: number;
}

export interface AssetRules {
  minWidth: number;
  minHeight: number;
}

export const DEFAULT_ASSET_RULES: AssetRules = { minWidth: 600, minHeight: 600 };

// Detect HTML masquerading as an image (common when a scraper saves an error
// page). We read the first bytes and look for markup even if the extension lies.
async function looksLikeHtml(path: string): Promise<boolean> {
  let handle;
  try {
    handle = await open(path, 'r');
    const buf = Buffer.alloc(64);
    await handle.read(buf, 0, 64, 0);
    const head = buf.toString('utf8').trim().toLowerCase();
    return head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('<?xml') || head.startsWith('<!--');
  } catch { return false; } finally { await handle?.close().catch(() => undefined); }
}

// Read PNG/JPEG dimensions from headers without decoding the whole image.
async function readDimensions(path: string, format: ImageCheck['format']): Promise<{ width: number; height: number } | null> {
  let handle;
  try {
    handle = await open(path, 'r');
    const buf = Buffer.alloc(65536);
    const { bytesRead } = await handle.read(buf, 0, 65536, 0);
    if (format === 'png') {
      // IHDR at offset 16: width(4) height(4) big-endian
      if (bytesRead >= 24) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    } else if (format === 'jpg') {
      let off = 2;
      while (off + 9 < bytesRead) {
        if (buf[off] !== 0xff) { off++; continue; }
        const marker = buf[off + 1];
        // SOF0..SOF15 (excluding DHT/DAC/RST) carry dimensions
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
        }
        const len = buf.readUInt16BE(off + 2);
        off += 2 + len;
      }
    } else if (format === 'webp') {
      // VP8X / VP8 / VP8L — best-effort; return null to skip strict dim check
      return null;
    }
    return null;
  } catch { return null; } finally { await handle?.close().catch(() => undefined); }
}

export async function validateDownloadedAsset(path: string, rules: AssetRules = DEFAULT_ASSET_RULES): Promise<AssetValidation> {
  const ext = extname(path).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return { ok: false, reason: `extension ${ext || '(none)'} not allowed` };
  if (await looksLikeHtml(path)) return { ok: false, reason: 'file is HTML disguised as an image' };

  const check = await validateImageFile(path);
  if (!check.ok) return { ok: false, reason: check.reason };
  if (check.format && !['jpg', 'png', 'webp'].includes(check.format)) return { ok: false, reason: `format ${check.format} not allowed` };

  const dims = await readDimensions(path, check.format);
  if (dims) {
    if (dims.width < rules.minWidth || dims.height < rules.minHeight) {
      return { ok: false, reason: `image ${dims.width}×${dims.height} below minimum ${rules.minWidth}×${rules.minHeight}`, ...dims, format: check.format };
    }
    return { ok: true, format: check.format, ...dims };
  }
  return { ok: true, format: check.format };
}

// Map a declared content-type to an allowed format, else null (reject).
export function mimeToFormat(mime: string): 'jpg' | 'png' | 'webp' | null {
  const m = mime.split(';')[0].trim().toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  return null;
}
