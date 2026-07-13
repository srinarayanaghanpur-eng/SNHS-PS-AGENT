export interface GrayImage {
  data: Uint8Array;
  width: number;
  height: number;
}

export async function getDocumentPixels(documentId: number, maxDim = 2000): Promise<GrayImage> {
  const jsx = `var doc = app.documents.getById(${documentId});
if (!doc) { $.writeln("ERROR:No document"); }
var w = doc.width, h = doc.height;
var scale = Math.min(1, ${maxDim} / Math.max(w, h));
var tw = Math.round(w * scale), th = Math.round(h * scale);
$.writeln("GRAY:" + tw + "|" + th);`;
  const result = await (await import('../bridge/apiClient')).psRunJsx(jsx);
  const match = result.stdout?.match(/GRAY:(\d+)\|(\d+)/);
  const width = match ? Number(match[1]) : 0;
  const height = match ? Number(match[2]) : 0;
  return { data: new Uint8Array(width * height), width, height };
}

export function rgbaToGray(data: Uint8Array, width: number, height: number, components: number): GrayImage {
  const out = new Uint8Array(width * height);
  if (components === 1) { out.set(data.subarray(0, width * height)); return { data: out, width, height }; }
  for (let i = 0, p = 0; i < out.length; i++, p += components)
    out[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
  return { data: out, width, height };
}

export function resize(img: GrayImage, width: number, height: number): GrayImage {
  const out = new Uint8Array(width * height);
  const xr = img.width / width, yr = img.height / height;
  for (let y = 0; y < height; y++) {
    const sy = Math.min(img.height - 1.001, y * yr), y0 = sy | 0, fy = sy - y0;
    for (let x = 0; x < width; x++) {
      const sx = Math.min(img.width - 1.001, x * xr), x0 = sx | 0, fx = sx - x0;
      const i = y0 * img.width + x0;
      const a = img.data[i], b = img.data[i + 1], c = img.data[i + img.width], d = img.data[i + img.width + 1];
      out[y * width + x] = (a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy) | 0;
    }
  }
  return { data: out, width, height };
}

export function crop(img: GrayImage, left: number, top: number, w: number, h: number): GrayImage {
  const l = Math.max(0, left | 0), t = Math.max(0, top | 0);
  const cw = Math.min(img.width - l, w | 0), ch = Math.min(img.height - t, h | 0);
  const out = new Uint8Array(Math.max(0, cw) * Math.max(0, ch));
  for (let y = 0; y < ch; y++) out.set(img.data.subarray((t + y) * img.width + l, (t + y) * img.width + l + cw), y * cw);
  return { data: out, width: cw, height: ch };
}

export function invert(img: GrayImage): GrayImage {
  const out = new Uint8Array(img.data.length);
  for (let i = 0; i < out.length; i++) out[i] = 255 - img.data[i];
  return { data: out, width: img.width, height: img.height };
}

export function stretchContrast(img: GrayImage): GrayImage {
  const hist = new Uint32Array(256);
  for (const v of img.data) hist[v]++;
  const total = img.data.length; let lo = 0, hi = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= total * 0.02) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= total * 0.02) { hi = i; break; } }
  const range = Math.max(1, hi - lo);
  const out = new Uint8Array(total);
  for (let i = 0; i < total; i++) out[i] = Math.max(0, Math.min(255, ((img.data[i] - lo) * 255 / range) | 0));
  return { data: out, width: img.width, height: img.height };
}

export function sharpen(img: GrayImage): GrayImage {
  const { data, width, height } = img;
  const out = new Uint8Array(data.length); out.set(data);
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    const v = 5 * data[i] - data[i - 1] - data[i + 1] - data[i - width] - data[i + width];
    out[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  return { data: out, width, height };
}

export function adaptiveThreshold(img: GrayImage, c = 8): GrayImage {
  const { data, width, height } = img;
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += data[y * width + x];
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row;
    }
  }
  const win = Math.max(8, (Math.min(width, height) / 16) | 0);
  const out = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const x0 = Math.max(0, x - win), x1 = Math.min(width, x + win + 1);
    const y0 = Math.max(0, y - win), y1 = Math.min(height, y + win + 1);
    const sum = integral[y1 * (width + 1) + x1] - integral[y0 * (width + 1) + x1] - integral[y1 * (width + 1) + x0] + integral[y0 * (width + 1) + x0];
    const mean = sum / ((x1 - x0) * (y1 - y0));
    out[y * width + x] = data[y * width + x] < mean - c ? 0 : 255;
  }
  return { data: out, width, height };
}

export function rotate(img: GrayImage, degrees: number): GrayImage {
  if (Math.abs(degrees) < 0.05) return img;
  const rad = (degrees * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const { width, height } = img;
  const cx = width / 2, cy = height / 2;
  const out = new Uint8Array(width * height).fill(255);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dx = x - cx, dy = y - cy;
    const sx = cos * dx + sin * dy + cx, sy = -sin * dx + cos * dy + cy;
    if (sx < 0 || sy < 0 || sx >= width - 1 || sy >= height - 1) continue;
    const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0, i = y0 * width + x0;
    out[y * width + x] = (img.data[i] * (1 - fx) * (1 - fy) + img.data[i + 1] * fx * (1 - fy) + img.data[i + width] * (1 - fx) * fy + img.data[i + width + 1] * fx * fy) | 0;
  }
  return { data: out, width, height };
}

export function estimateSkew(img: GrayImage): number {
  const small = Math.max(img.width, img.height) > 800
    ? resize(img, Math.round(img.width * 800 / Math.max(img.width, img.height)), Math.round(img.height * 800 / Math.max(img.width, img.height)))
    : img;
  const bin = adaptiveThreshold(small);
  let bestAngle = 0, bestScore = -1;
  for (let a = -10; a <= 10; a += 0.5) {
    const r = rotate(bin, a);
    const rows = new Float64Array(r.height);
    for (let y = 0; y < r.height; y++) { let s = 0; for (let x = 0; x < r.width; x++) if (r.data[y * r.width + x] === 0) s++; rows[y] = s; }
    const mean = rows.reduce((s, v) => s + v, 0) / rows.length;
    const variance = rows.reduce((s, v) => s + (v - mean) * (v - mean), 0) / rows.length;
    if (variance > bestScore) { bestScore = variance; bestAngle = a; }
  }
  return bestAngle;
}

export function encodeGrayBmp(img: GrayImage): Uint8Array {
  const { width, height, data } = img;
  const rowSize = (width + 3) & ~3;
  const pixelBytes = rowSize * height;
  const paletteBytes = 256 * 4;
  const offset = 14 + 40 + paletteBytes;
  const buf = new Uint8Array(offset + pixelBytes);
  const dv = new DataView(buf.buffer);
  buf[0] = 0x42; buf[1] = 0x4d;
  dv.setUint32(2, buf.length, true);
  dv.setUint32(10, offset, true);
  dv.setUint32(14, 40, true);
  dv.setInt32(18, width, true); dv.setInt32(22, height, true);
  dv.setUint16(26, 1, true); dv.setUint16(28, 8, true);
  dv.setUint32(34, pixelBytes, true);
  dv.setUint32(46, 256, true);
  for (let i = 0; i < 256; i++) { const p = 54 + i * 4; buf[p] = i; buf[p + 1] = i; buf[p + 2] = i; }
  for (let y = 0; y < height; y++)
    buf.set(data.subarray(y * width, y * width + width), offset + (height - 1 - y) * rowSize);
  return buf;
}
