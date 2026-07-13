// Downloads a picked media item's original bytes into a target directory and
// validates it before it is ever offered as an asset (§5–§7, §14). Guarantees:
//   • only the explicitly selected item's full bytes are written (never a
//     thumbnail / screenshot);
//   • MIME type, file extension, real decodable signature, dimensions and
//     non-zero size are all checked (§6);
//   • a safe, unique on-disk filename is generated (§7).

import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateImageFile } from '../imageValidation';
import { downloadOriginalBytes, type PickedMediaItem } from './pickerClient';
import { readDimensions, safeBase } from './imageMeta';

// Picker delivers JPEG/PNG/WebP for photos; these are the formats the poster
// engine accepts. Anything else (incl. video) is rejected up front.
const ALLOWED = new Set(['jpg', 'png', 'webp'] as const);
const EXT_FOR: Record<string, string> = { jpg: '.jpg', png: '.png', webp: '.webp' };
const MIME_FOR: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const MAX_BYTES = 40 * 1024 * 1024;

export interface DownloadedPhoto {
  googleId: string;
  path: string;          // absolute path of the validated file on disk
  filename: string;      // safe unique filename
  originalName: string;  // filename reported by Google
  format: 'jpg' | 'png' | 'webp';
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  thumbnailDataUrl?: string; // small preview for the renderer (§8), never the asset
}

export class GooglePhotosDownloadError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'GooglePhotosDownloadError'; }
}

export interface DownloadOptions { withThumbnail?: boolean }

export async function downloadAndValidate(item: PickedMediaItem, destDir: string, opts: DownloadOptions = {}): Promise<DownloadedPhoto> {
  const file = item.mediaFile;
  if (!file?.baseUrl) throw new GooglePhotosDownloadError('NO_BASE_URL', 'The selected item has no downloadable media.');
  if (item.type && item.type !== 'PHOTO') throw new GooglePhotosDownloadError('NOT_A_PHOTO', `"${file.filename ?? item.id}" is not a photo.`);

  const bytesBuf = await downloadOriginalBytes(file.baseUrl);
  if (bytesBuf.length === 0) throw new GooglePhotosDownloadError('EMPTY_DOWNLOAD', 'Downloaded file was empty.');
  if (bytesBuf.length > MAX_BYTES) throw new GooglePhotosDownloadError('TOO_LARGE', `Image is ${(bytesBuf.length / 1048576).toFixed(1)} MB; the limit is ${MAX_BYTES / 1048576} MB.`);

  await mkdir(destDir, { recursive: true });
  // Write first, then validate the real file on disk so the integrity check
  // covers exactly the bytes that will be used.
  const tempPath = join(destDir, `.gp-${randomUUID()}.part`);
  await writeFile(tempPath, bytesBuf);

  const check = await validateImageFile(tempPath);
  if (!check.ok || !check.format || !ALLOWED.has(check.format as 'jpg' | 'png' | 'webp')) {
    await rmQuiet(tempPath);
    throw new GooglePhotosDownloadError('INVALID_IMAGE', `The download is not a supported image (${check.reason ?? check.format ?? 'unknown'}).`);
  }
  const format = check.format as 'jpg' | 'png' | 'webp';

  // Cross-check the MIME type Google declared against the sniffed format (§6).
  const declared = (file.mimeType ?? '').toLowerCase();
  if (declared && MIME_FOR[format] && declared !== MIME_FOR[format] && !(format === 'jpg' && declared === 'image/jpg')) {
    await rmQuiet(tempPath);
    throw new GooglePhotosDownloadError('MIME_MISMATCH', `Declared type ${declared} does not match the downloaded ${format} content.`);
  }

  const dims = readDimensions(bytesBuf.subarray(0, 65_536), format);
  const width = dims.width || (file.mediaFileMetadata?.width ?? 0);
  const height = dims.height || (file.mediaFileMetadata?.height ?? 0);
  if (width <= 0 || height <= 0) {
    await rmQuiet(tempPath);
    throw new GooglePhotosDownloadError('INVALID_DIMENSIONS', 'The image has unreadable or zero dimensions.');
  }

  const finalName = `${safeBase(file.filename ?? 'google-photo')}-${randomUUID().slice(0, 8)}${EXT_FOR[format]}`;
  const finalPath = join(destDir, finalName);
  await writeFile(finalPath, bytesBuf);
  await rmQuiet(tempPath);
  const info = await stat(finalPath);

  let thumbnailDataUrl: string | undefined;
  if (opts.withThumbnail && info.size <= 5 * 1024 * 1024) {
    thumbnailDataUrl = `data:${MIME_FOR[format]};base64,${(await readFile(finalPath)).toString('base64')}`;
  }

  return {
    googleId: item.id, path: finalPath, filename: finalName, originalName: file.filename ?? finalName,
    format, mimeType: MIME_FOR[format], bytes: info.size, width, height, thumbnailDataUrl,
  };
}

async function rmQuiet(path: string): Promise<void> {
  await rm(path, { force: true }).catch(() => undefined);
}
