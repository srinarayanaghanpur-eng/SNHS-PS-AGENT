// Copies a user-selected image into a brand-kit folder, validating format and
// size and extracting basic metadata (dimensions, alpha). Never stores bytes in
// JSON — the file is copied to disk and only its path/metadata are returned.

import { copyFile, mkdir, open, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateImageFile } from '../imageValidation';
import { brandAssetSchema, type BrandAsset, type BrandAssetKey } from '../../shared/brandKit';

export interface ImportRequest { sourcePath: string; maxBytes?: number }

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED = new Set(['jpg', 'png', 'webp']); // §2 accepts JPG/JPEG/PNG/WebP

export class AssetImportError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'AssetImportError'; }
}

// Reads intrinsic width/height + alpha for the common formats. Best-effort: on
// any parse issue we return zeros and hasAlpha=false rather than failing import.
async function readImageMeta(path: string, format: string): Promise<{ width: number; height: number; hasAlpha: boolean }> {
  try {
    const handle = await open(path, 'r');
    try {
      const head = Buffer.alloc(4096);
      await handle.read(head, 0, 4096, 0);
      if (format === 'png') {
        // IHDR starts at byte 16: width(4) height(4) bitDepth(1) colorType(1)
        const width = head.readUInt32BE(16); const height = head.readUInt32BE(20);
        const colorType = head[25];
        return { width, height, hasAlpha: colorType === 4 || colorType === 6 };
      }
      if (format === 'jpg') {
        let offset = 2;
        while (offset < head.length - 8) {
          if (head[offset] !== 0xff) { offset++; continue; }
          const marker = head[offset + 1];
          if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            const height = head.readUInt16BE(offset + 5); const width = head.readUInt16BE(offset + 7);
            return { width, height, hasAlpha: false };
          }
          offset += 2 + head.readUInt16BE(offset + 2);
        }
      }
      if (format === 'webp') {
        // VP8X extended header carries an alpha flag at byte 20 bit 4
        if (head.toString('ascii', 12, 16) === 'VP8X') return { width: 0, height: 0, hasAlpha: (head[20] & 0x10) !== 0 };
      }
    } finally { await handle.close(); }
  } catch { /* fall through */ }
  return { width: 0, height: 0, hasAlpha: false };
}

export async function importAssetFile(request: ImportRequest, destDir: string, key: BrandAssetKey): Promise<BrandAsset> {
  const check = await validateImageFile(request.sourcePath);
  if (!check.ok) throw new AssetImportError('INVALID_IMAGE', `The selected file for "${key}" is not a usable image (${check.reason}).`);
  if (!check.format || !ALLOWED.has(check.format)) {
    throw new AssetImportError('UNSUPPORTED_FORMAT', `"${key}" must be a JPG, PNG or WebP image (got ${check.format ?? 'unknown'}).`);
  }
  const info = await stat(request.sourcePath);
  const maxBytes = request.maxBytes ?? DEFAULT_MAX_BYTES;
  if (info.size > maxBytes) {
    throw new AssetImportError('FILE_TOO_LARGE', `"${key}" is ${(info.size / 1048576).toFixed(1)} MB; the limit is ${(maxBytes / 1048576).toFixed(0)} MB.`);
  }
  await mkdir(destDir, { recursive: true });
  const ext = (extname(request.sourcePath) || `.${check.format}`).toLowerCase();
  const destName = `${key}-${randomUUID().slice(0, 8)}${ext}`;
  const destPath = join(destDir, destName);
  await copyFile(request.sourcePath, destPath);
  const meta = await readImageMeta(destPath, check.format);
  return brandAssetSchema.parse({
    path: destPath, originalName: basename(request.sourcePath), format: check.format, bytes: info.size,
    width: meta.width, height: meta.height, hasAlpha: meta.hasAlpha, importedAt: new Date().toISOString(),
  });
}
