// Pure, dependency-free helpers for the connector: intrinsic-dimension reading
// and safe filename generation. Kept free of Electron/Node-only imports so they
// can be unit-tested directly.

export function safeBase(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '');
  const cleaned = stem.normalize('NFKC').replace(/[<>:"/\\|?* -]/g, '_').replace(/[. ]+$/g, '').trim();
  return cleaned.slice(0, 80) || 'google-photo';
}

// Reads intrinsic width/height for JPEG/PNG/WebP from a header buffer. Returns
// zeros when it cannot parse (callers reject on the zero check).
export function readDimensions(buf: Buffer, format: string): { width: number; height: number } {
  try {
    if (format === 'png' && buf.length >= 24) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (format === 'webp' && buf.length >= 30) {
      const kind = buf.toString('ascii', 12, 16);
      if (kind === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
      if (kind === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      if (kind === 'VP8L') {
        const b = buf.readUInt32LE(21);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
    }
    if (format === 'jpg') {
      let offset = 2;
      while (offset + 9 < buf.length) {
        if (buf[offset] !== 0xff) { offset += 1; continue; }
        const marker = buf[offset + 1];
        if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
        const length = buf.readUInt16BE(offset + 2);
        if (length < 2 || offset + length + 2 > buf.length) break;
        if (marker >= 0xc0 && marker <= 0xc3) return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
        offset += length + 2;
      }
    }
  } catch { /* fall through */ }
  return { width: 0, height: 0 };
}
