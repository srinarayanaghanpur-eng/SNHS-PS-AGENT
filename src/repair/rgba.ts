import { psRunJsx } from '../bridge/apiClient';

export interface RGBAImage {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface RectPx {
  left: number;
  top: number;
  width: number;
  height: number;
}

export async function getDocumentRGBA(docId: number): Promise<RGBAImage> {
  const jsx = `var doc = app.documents.getById(${docId});
if (!doc) { $.writeln("ERROR:No document"); }
var w = doc.width, h = doc.height;
var desc = new ActionDescriptor();
var ref = new ActionReference();
ref.putEnumerate(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
desc.putReference(charIDToTypeID("null"), ref);
desc.putInteger(charIDToTypeID("Hres"), 72);
desc.putInteger(charIDToTypeID("Vres"), 72);
desc.putInteger(charIDToTypeID("T    "), 1);
desc.putInteger(charIDToTypeID("Hrzn"), 0);
desc.putInteger(charIDToTypeID("Vrtc"), 0);
desc.putInteger(charIDToTypeID("Wth "), w);
desc.putInteger(charIDToTypeID("Hgh "), h);
var data = executeActionGet(desc);
$.writeln("RGBA:" + w + "|" + h);`;
  const result = await psRunJsx(jsx);
  const match = result.stdout?.match(/RGBA:(\d+)\|(\d+)/);
  if (!match) throw new Error('Could not read document pixels');
  return { data: new Uint8Array(0), width: Number(match[1]), height: Number(match[2]) };
}

export async function putRGBAAsLayer(docId: number, img: RGBAImage, name: string): Promise<number> {
  const b64 = btoa(String.fromCharCode(...img.data));
  const jsx = `var doc = app.documents.getById(${docId});
if (!doc) { $.writeln("ERROR:No document"); }
var layer = doc.artLayers.add();
layer.name = "${name.replace(/"/g, '\\"')}";
$.writeln("LAYER_ID:" + layer.id);`;
  const result = await psRunJsx(jsx);
  const match = result.stdout?.match(/LAYER_ID:(\d+)/);
  return match ? Number(match[1]) : -1;
}

export function estimateInkColor(img: RGBAImage, rect: RectPx): [number, number, number] {
  const { left, top, width, height } = clampRect(rect, img.width, img.height);
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let y = top; y < top + height; y++) {
    for (let x = left; x < left + width; x++) {
      const i = (y * img.width + x) * 4;
      rSum += img.data[i]; gSum += img.data[i + 1]; bSum += img.data[i + 2]; count++;
    }
  }
  if (!count) return [0, 0, 0];
  return [Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count)];
}

export function clampRect(rect: RectPx, w: number, h: number): RectPx {
  const left = Math.max(0, Math.round(rect.left));
  const top = Math.max(0, Math.round(rect.top));
  const width = Math.min(w - left, Math.round(rect.width));
  const height = Math.min(h - top, Math.round(rect.height));
  return { left, top, width: Math.max(0, width), height: Math.max(0, height) };
}

export function sampleSurroundings(img: RGBAImage, rect: RectPx, padding = 6): [number, number, number] {
  const r = clampRect(rect, img.width, img.height);
  const top = clampRect({ left: r.left - padding, top: r.top - padding, width: r.width + padding * 2, height: padding }, img.width, img.height);
  const bot = clampRect({ left: r.left - padding, top: r.top + r.height, width: r.width + padding * 2, height: padding }, img.width, img.height);
  const lft = clampRect({ left: r.left - padding, top: r.top, width: padding, height: r.height }, img.width, img.height);
  const rit = clampRect({ left: r.left + r.width, top: r.top, width: padding, height: r.height }, img.width, img.height);
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (const band of [top, bot, lft, rit]) {
    for (let y = band.top; y < band.top + band.height; y++) {
      for (let x = band.left; x < band.left + band.width; x++) {
        const i = (y * img.width + x) * 4;
        rSum += img.data[i]; gSum += img.data[i + 1]; bSum += img.data[i + 2]; count++;
      }
    }
  }
  if (!count) return estimateInkColor(img, rect);
  return [Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count)];
}

export function surroundingVariance(img: RGBAImage, rect: RectPx): number {
  const [mr, mg, mb] = sampleSurroundings(img, rect);
  const r = clampRect(rect, img.width, img.height);
  let varSum = 0, count = 0;
  for (let y = r.top; y < r.top + r.height; y++) {
    for (let x = r.left; x < r.left + r.width; x++) {
      const i = (y * img.width + x) * 4;
      varSum += (img.data[i] - mr) ** 2 + (img.data[i + 1] - mg) ** 2 + (img.data[i + 2] - mb) ** 2;
      count++;
    }
  }
  return count ? Math.sqrt(varSum / count) : 0;
}

export function rgbaToGray(data: Uint8Array, width: number, height: number, components: number): { data: Uint8Array; width: number; height: number } {
  const out = new Uint8Array(width * height);
  if (components === 1) { out.set(data.subarray(0, width * height)); return { data: out, width, height }; }
  for (let i = 0, p = 0; i < out.length; i++, p += components)
    out[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
  return { data: out, width, height };
}
