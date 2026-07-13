import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, open, stat } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, resolve, sep } from 'node:path';
import {
  assertPlainSerializable,
  importedFileSchema,
  importRequestSchema,
  supportedReferenceExtensions,
  type ImportedFile,
  type SupportedReferenceExtension,
} from '../shared/importSchemas';

const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
const HEADER_BYTES = 64 * 1024;

const expectedMime: Record<SupportedReferenceExtension, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  psd: 'image/vnd.adobe.photoshop', pdf: 'application/pdf',
};

export class ImportError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

function safeFilename(value: string): string {
  const cleaned = value.normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/[. ]+$/g, '');
  return cleaned.slice(0, 180) || 'reference';
}

function isWithin(root: string, candidate: string): boolean {
  const normalizedRoot = resolve(root) + sep;
  return resolve(candidate).startsWith(normalizedRoot);
}

function readUInt24BE(buffer: Buffer, offset: number): number {
  return (buffer[offset] << 16) | (buffer[offset + 1] << 8) | buffer[offset + 2];
}

function dimensions(buffer: Buffer, extension: SupportedReferenceExtension): { width?: number; height?: number } {
  if (extension === 'png' && buffer.length >= 24) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (extension === 'psd' && buffer.length >= 22) return { height: buffer.readUInt32BE(14), width: buffer.readUInt32BE(18) };
  if (extension === 'webp' && buffer.length >= 30) {
    const kind = buffer.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  if ((extension === 'jpg' || extension === 'jpeg') && buffer.length >= 4) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2 || offset + length + 2 > buffer.length) break;
      if (marker >= 0xc0 && marker <= 0xc3) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      offset += length + 2;
    }
  }
  return {};
}

function validateSignature(buffer: Buffer, extension: SupportedReferenceExtension): void {
  const valid = extension === 'png' ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : extension === 'jpg' || extension === 'jpeg' ? buffer[0] === 0xff && buffer[1] === 0xd8
    : extension === 'webp' ? buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
    : extension === 'psd' ? buffer.toString('ascii', 0, 4) === '8BPS' && buffer.readUInt16BE(4) === 1
    : buffer.toString('ascii', 0, 5) === '%PDF-';
  if (!valid) throw new ImportError('IMPORT_MIME_MISMATCH', `File content does not match ${expectedMime[extension]}.`);
}

export async function importReferenceFile(input: unknown, jobsRoot: string): Promise<ImportedFile> {
  const { sourcePath } = importRequestSchema.parse(input);
  if (!isAbsolute(sourcePath)) throw new ImportError('IMPORT_PATH_NOT_ABSOLUTE', 'The selected file path must be absolute.');
  const sourceInfo = await stat(sourcePath).catch(() => null);
  if (!sourceInfo?.isFile()) throw new ImportError('IMPORT_FILE_NOT_FOUND', 'The selected file does not exist.');
  if (sourceInfo.size <= 0) throw new ImportError('IMPORT_EMPTY_FILE', 'The selected file is empty.');
  if (sourceInfo.size > MAX_IMPORT_BYTES) throw new ImportError('IMPORT_FILE_TOO_LARGE', 'The selected file exceeds 100 MB.');

  const extension = extname(sourcePath).slice(1).toLowerCase() as SupportedReferenceExtension;
  if (!supportedReferenceExtensions.includes(extension)) throw new ImportError('IMPORT_UNSUPPORTED_FILE', `Unsupported extension: .${extension || '(none)'}`);

  const handle = await open(sourcePath, 'r');
  const header = Buffer.alloc(Math.min(HEADER_BYTES, sourceInfo.size));
  try { await handle.read(header, 0, header.length, 0); } finally { await handle.close(); }
  validateSignature(header, extension);
  const measured = dimensions(header, extension);
  if ((measured.width !== undefined && measured.width <= 0) || (measured.height !== undefined && measured.height <= 0)) {
    throw new ImportError('IMPORT_INVALID_DIMENSIONS', 'The selected image has invalid dimensions.');
  }

  const jobId = `import-${randomUUID()}`;
  const jobDirectory = join(resolve(jobsRoot), jobId);
  if (!isWithin(jobsRoot, jobDirectory)) throw new ImportError('IMPORT_PATH_TRAVERSAL', 'Unsafe job path rejected.');
  await mkdir(jobDirectory, { recursive: true });
  const filename = safeFilename(basename(sourcePath));
  const copiedPath = join(jobDirectory, filename);
  if (!isWithin(jobDirectory, copiedPath)) throw new ImportError('IMPORT_PATH_TRAVERSAL', 'Unsafe destination path rejected.');
  await copyFile(sourcePath, copiedPath);

  const result = importedFileSchema.parse({ jobId, path: copiedPath, filename, extension, size: sourceInfo.size, ...measured });
  assertPlainSerializable(result);
  return result;
}

export const importInternals = { dimensions, safeFilename, validateSignature, isWithin };
