import { describe, expect, it } from 'vitest';
import { jpegDimensions, jpegToPdf } from './jpegToPdf';

/** Minimal synthetic JPEG: SOI + SOF0 (120×80) + EOI — enough for header parsing. */
function fakeJpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,                                     // SOI
    0xff, 0xc0, 0x00, 0x0b, 0x08,                   // SOF0, length 11, precision 8
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01,                                           // 1 component
    0xff, 0xd9                                      // EOI
  ]);
}

describe('jpegDimensions', () => {
  it('reads SOF0 dimensions', () => {
    expect(jpegDimensions(fakeJpeg(120, 80))).toEqual({ width: 120, height: 80 });
  });
  it('rejects non-JPEG data', () => {
    expect(() => jpegDimensions(new Uint8Array([0, 1, 2]))).toThrow();
  });
});

describe('jpegToPdf', () => {
  const pdf = jpegToPdf(fakeJpeg(120, 80), 72);
  const text = new TextDecoder('latin1').decode(pdf);
  it('emits a structurally valid one-page PDF', () => {
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('/Type /Page ');
    expect(text).toContain('/Subtype /Image');
    expect(text).toContain('/Filter /DCTDecode');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });
  it('maps pixels to points via dpi', () => {
    expect(text).toContain('/MediaBox [0 0 120.00 80.00]'); // 72 dpi → 1px = 1pt
  });
  it('xref startxref offset points at the xref table', () => {
    const start = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(new TextDecoder('latin1').decode(pdf.subarray(start, start + 4))).toBe('xref');
  });
  it('embeds the full JPEG stream', () => {
    expect(text).toContain(`/Length ${fakeJpeg(120, 80).length} >> stream`);
  });
});
