import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateImageFile } from '../src-v2/main/imageValidation';

let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'snhs-img-')); });
afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

const write = (name: string, bytes: number[]): string => {
  const p = join(dir, name);
  writeFileSync(p, Buffer.from(bytes));
  return p;
};

describe('image validation', () => {
  it('rejects a missing file', async () => {
    expect(await validateImageFile(join(dir, 'nope.jpg'))).toMatchObject({ ok: false, reason: 'missing' });
  });

  it('rejects an empty file', async () => {
    expect(await validateImageFile(write('empty.jpg', []))).toMatchObject({ ok: false, reason: 'empty' });
  });

  it('rejects a tiny junk file (the corrupt-image case)', async () => {
    expect(await validateImageFile(write('junk.jpg', Array.from({ length: 64 }, (_, i) => i)))).toMatchObject({ ok: false, reason: 'too-small' });
  });

  it('rejects a large non-image file', async () => {
    const bytes = Array.from({ length: 300 }, () => 0x41); // 'A' repeated
    expect(await validateImageFile(write('notimage.jpg', bytes))).toMatchObject({ ok: false, reason: 'unsupported-format' });
  });

  it('accepts a valid JPEG signature', async () => {
    const bytes = [0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 300 }, () => 0)];
    expect(await validateImageFile(write('ok.jpg', bytes))).toMatchObject({ ok: true, format: 'jpg' });
  });

  it('accepts a valid PNG signature', async () => {
    const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 300 }, () => 0)];
    expect(await validateImageFile(write('ok.png', bytes))).toMatchObject({ ok: true, format: 'png' });
  });
});
