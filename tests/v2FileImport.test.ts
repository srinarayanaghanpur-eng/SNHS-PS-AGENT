import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { importReferenceFile, ImportError } from '../src-v2/main/fileImport';
import { assertPlainSerializable, importedFileSchema } from '../src-v2/shared/importSchemas';
import { selectAndImportReference } from '../src-v2/main/selectReference';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });
async function root(): Promise<string> { const value = await mkdtemp(join(tmpdir(), 'snhs-import-')); roots.push(value); return value; }

function png(width = 1080, height = 1080): Buffer {
  const value = Buffer.alloc(32);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(value);
  value.writeUInt32BE(width, 16); value.writeUInt32BE(height, 20);
  return value;
}
function jpg(): Buffer { return Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 4, 56, 4, 56, 3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0, 0xff, 0xd9]); }
function psd(): Buffer { const value = Buffer.alloc(26); value.write('8BPS'); value.writeUInt16BE(1, 4); value.writeUInt32BE(1350, 14); value.writeUInt32BE(1080, 18); return value; }
function webp(): Buffer { const value = Buffer.alloc(30); value.write('RIFF'); value.writeUInt32LE(22, 4); value.write('WEBP', 8); value.write('VP8X', 12); value.writeUIntLE(1079, 24, 3); value.writeUIntLE(1349, 27, 3); return value; }

describe('V2 file-path-only import', () => {
  it.each([
    ['poster.png', png()], ['poster.jpg', jpg()], ['poster.webp', webp()],
    ['poster.psd', psd()], ['poster.pdf', Buffer.from('%PDF-1.7\n%%EOF')],
  ])('imports %s without recursive IPC payloads', async (name, bytes) => {
    const workspace = await root(); const source = join(workspace, name); await writeFile(source, bytes);
    const result = await importReferenceFile({ sourcePath: source }, join(workspace, 'Jobs'));
    expect(importedFileSchema.parse(result)).toEqual(result);
    expect(Object.keys(result).sort()).toEqual(expect.arrayContaining(['extension', 'filename', 'jobId', 'path', 'size']));
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('returns decoded dimensions when available', async () => {
    const workspace = await root(); const source = join(workspace, 'poster.png'); await writeFile(source, png(1080, 1350));
    await expect(importReferenceFile({ sourcePath: source }, join(workspace, 'Jobs'))).resolves.toMatchObject({ width: 1080, height: 1350 });
  });

  it('rejects circular, binary, and native IPC values', () => {
    const circular: Record<string, unknown> = {}; circular.self = circular;
    expect(() => assertPlainSerializable(circular)).toThrow('IPC_CIRCULAR_REJECTED');
    expect(() => assertPlainSerializable({ bytes: Buffer.from('x') })).toThrow('IPC_BINARY_REJECTED');
    expect(() => assertPlainSerializable(new Error('no'))).toThrow('IPC_NATIVE_OBJECT_REJECTED');
  });

  it('rejects extension/signature mismatches and relative paths', async () => {
    const workspace = await root(); const fake = join(workspace, 'fake.png'); await writeFile(fake, Buffer.from('%PDF-1.7'));
    await expect(importReferenceFile({ sourcePath: fake }, join(workspace, 'Jobs'))).rejects.toMatchObject({ code: 'IMPORT_MIME_MISMATCH' });
    await expect(importReferenceFile({ sourcePath: 'relative.png' }, join(workspace, 'Jobs'))).rejects.toMatchObject({ code: 'IMPORT_PATH_NOT_ABSOLUTE' });
  });

  it('rejects unsupported files without unrelated Photoshop errors', async () => {
    const workspace = await root(); const source = join(workspace, 'payload.exe'); await writeFile(source, Buffer.from('MZ'));
    try { await importReferenceFile({ sourcePath: source }, join(workspace, 'Jobs')); throw new Error('expected failure'); }
    catch (error) {
      expect(error).toBeInstanceOf(ImportError);
      expect((error as ImportError).code).toBe('IMPORT_UNSUPPORTED_FILE');
      expect((error as Error).message).not.toMatch(/Photoshop|target layer/i);
    }
  });

  it('keeps file selection in main and returns only scalar metadata', async () => {
    const workspace = await root(); const source = join(workspace, 'poster.png'); await writeFile(source, png());
    const result = await selectAndImportReference(async () => ({ canceled: false, filePaths: [source] }), join(workspace, 'Jobs'));
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty('file');
    expect(result).not.toHaveProperty('buffer');
    expect(() => assertPlainSerializable(result)).not.toThrow();
  });

  it('returns null when the main-process dialog is canceled', async () => {
    const workspace = await root();
    await expect(selectAndImportReference(async () => ({ canceled: true, filePaths: [] }), join(workspace, 'Jobs'))).resolves.toBeNull();
  });
});
