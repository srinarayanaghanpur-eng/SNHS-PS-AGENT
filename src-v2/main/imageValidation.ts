// Validates that a path points to a real, decodable raster image before it is
// handed to Photoshop. Missing, empty, non-image and truncated files are all
// rejected here so the composition never lays out a frame for content that
// Photoshop cannot place.

import { open, stat } from 'node:fs/promises';

export type ImageReject = 'missing' | 'empty' | 'unreadable' | 'unsupported-format' | 'too-small';

export interface ImageCheck { ok: boolean; reason?: ImageReject; format?: 'jpg' | 'png' | 'webp' | 'gif' | 'bmp' | 'psd' | 'tiff' }

// Minimum bytes for a plausible image; guards against 64-byte junk files.
const MIN_BYTES = 100;

function sniff(buf: Buffer): ImageCheck['format'] | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'gif';
  if (buf[0] === 0x42 && buf[1] === 0x4d) return 'bmp';
  if (buf[0] === 0x38 && buf[1] === 0x42 && buf[2] === 0x50 && buf[3] === 0x53) return 'psd'; // 8BPS
  if ((buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a) || (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00)) return 'tiff';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export async function validateImageFile(path: string): Promise<ImageCheck> {
  let info;
  try { info = await stat(path); } catch { return { ok: false, reason: 'missing' }; }
  if (!info.isFile()) return { ok: false, reason: 'missing' };
  if (info.size === 0) return { ok: false, reason: 'empty' };
  if (info.size < MIN_BYTES) return { ok: false, reason: 'too-small' };

  let handle;
  try {
    handle = await open(path, 'r');
    const buf = Buffer.alloc(16);
    await handle.read(buf, 0, 16, 0);
    const format = sniff(buf);
    if (!format) return { ok: false, reason: 'unsupported-format' };
    return { ok: true, format };
  } catch {
    return { ok: false, reason: 'unreadable' };
  } finally {
    await handle?.close().catch(() => undefined);
  }
}
