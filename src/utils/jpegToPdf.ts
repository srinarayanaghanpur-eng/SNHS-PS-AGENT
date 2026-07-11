/**
 * Minimal pure-TS JPEG→PDF wrapper (mandated PDF-export fallback: when
 * Photoshop's PDF save fails, wrap the exported JPEG into a valid one-page
 * PDF). Emits PDF 1.4 with a DCTDecode image XObject — universally readable.
 */

/** Read pixel dimensions from JPEG SOF0/1/2 markers. */
export function jpegDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Not a JPEG file');
  let i = 2;
  while (i < bytes.length - 9) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  throw new Error('JPEG dimensions not found');
}

export function jpegToPdf(jpeg: Uint8Array, dpi = 300): Uint8Array {
  const { width, height } = jpegDimensions(jpeg);
  const wPt = (width / dpi) * 72, hPt = (height / dpi) * 72;
  const enc = (s: string) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff; return b; };

  const content = `q ${wPt.toFixed(2)} 0 0 ${hPt.toFixed(2)} 0 0 cm /Im0 Do Q`;
  const objects: Uint8Array[] = [
    enc('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n'),
    enc('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n'),
    enc(`3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt.toFixed(2)} ${hPt.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >> endobj\n`),
    (() => {
      const head = enc(`4 0 obj << /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >> stream\n`);
      const tail = enc('\nendstream endobj\n');
      const out = new Uint8Array(head.length + jpeg.length + tail.length);
      out.set(head); out.set(jpeg, head.length); out.set(tail, head.length + jpeg.length);
      return out;
    })(),
    enc(`5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj\n`)
  ];

  const header = enc('%PDF-1.4\n%\xff\xff\xff\xff\n');
  const offsets: number[] = [];
  let pos = header.length;
  for (const o of objects) { offsets.push(pos); pos += o.length; }
  const xrefPos = pos;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  xref += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  const xrefBytes = enc(xref);

  const total = header.length + objects.reduce((s, o) => s + o.length, 0) + xrefBytes.length;
  const pdf = new Uint8Array(total);
  let p = 0;
  pdf.set(header, p); p += header.length;
  for (const o of objects) { pdf.set(o, p); p += o.length; }
  pdf.set(xrefBytes, p);
  return pdf;
}
