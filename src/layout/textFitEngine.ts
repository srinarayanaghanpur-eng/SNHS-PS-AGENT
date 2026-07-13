import type { ClassifiedLayer, FitResult, TextRegion } from '../types';
import { psRunJsx, psReadLayers } from '../bridge/apiClient';
import { generateJsx } from '../utils/jsxBuilder';
import { log } from '../utils/logger';
import { getSectionForRole, getRegionForSection, getTextRegionForRole as gtr } from '../layout/layoutHelpers';

export const getTextRegionForRole = gtr;

export async function readActualBounds(docId: number, layerId: number): Promise<{ width: number; height: number; left: number; top: number }> {
  const jsx = `var doc = app.activeDocument;
try {
  var layer = doc.layers.getById(${layerId});
  var b = layer.bounds;
  $.writeln("BOUNDS:" + b[0].value + "," + b[1].value + "," + b[2].value + "," + b[3].value);
} catch(e) { $.writeln("BOUNDS:0,0,0,0"); }`;
  const result = await psRunJsx(jsx);
  const match = result.stdout?.match(/BOUNDS:([\d.]+),([\d.]+),([\d.]+),([\d.]+)/);
  if (match) {
    const [left, top, right, bottom] = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
    return { width: right - left, height: bottom - top, left, top };
  }
  return { width: 0, height: 0, left: 0, top: 0 };
}

export async function fitTextToRegion(
  docId: number,
  meta: ClassifiedLayer,
  text: string,
  region: TextRegion
): Promise<FitResult> {
  const jsx = generateFitTextJsx(meta.layerId, text, region);
  const result = await psRunJsx(jsx);
  const fitMatch = result.stdout?.match(/FIT_RESULT:([\d.]+)\|(\d+)\|(\w+)\|(\w+)/);
  if (fitMatch) {
    return {
      success: fitMatch[3] === 'true',
      finalSize: Number(fitMatch[1]),
      lineCount: Number(fitMatch[2]),
      overflow: fitMatch[3] !== 'true',
      wasTrimmed: fitMatch[4] === 'true',
    };
  }
  return { success: false, finalSize: region.minFontSize, lineCount: 0, overflow: true, wasTrimmed: false };
}

function generateFitTextJsx(layerId: number, text: string, region: TextRegion): string {
  const safeText = text.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  return [
    `var doc = app.activeDocument;`,
    `try {`,
    `  var layer = doc.layers.getById(${layerId});`,
    `  if (!layer || layer.kind != LayerKind.TEXT) { $.writeln("FIT_RESULT:0|0|false|false"); throw new Error("not text"); }`,
    `  var ti = layer.textItem;`,
    `  ti.contents = "${safeText}";`,
    `  var maxSize = ${region.maxFontSize};`,
    `  var minSize = ${region.minFontSize};`,
    `  var maxLines = ${region.maxLines};`,
    `  var boxW = ${region.width};`,
    `  var boxH = ${region.height};`,
    `  var boxX = ${region.x};`,
    `  var boxY = ${region.y};`,
    `  var currentSize = maxSize;`,
    `  ti.size = currentSize;`,
    `  var bestSize = currentSize;`,
    `  var lineCount = 1;`,
    `  var fits = false;`,
    `  for (var att = 0; att < 40; att++) {`,
    `    ti.size = currentSize;`,
    `    var b = layer.bounds;`,
    `    var w = b[2].value - b[0].value;`,
    `    var h = b[3].value - b[1].value;`,
    `    var lh = Math.round(currentSize * 1.35);`,
    `    lineCount = Math.max(1, Math.round(h / lh));`,
    `    if (w <= boxW * 1.05 && lineCount <= maxLines && h <= boxH * 1.1) {`,
    `      fits = true;`,
    `      bestSize = currentSize;`,
    `      break;`,
    `    }`,
    `    if (currentSize <= minSize) {`,
    `      bestSize = minSize;`,
    `      ti.size = minSize;`,
    `      break;`,
    `    }`,
    `    currentSize = Math.max(minSize, currentSize - 1);`,
    `  }`,
    `  if (!fits && text.length > 80) {`,
    `    ti.contents = "${safeText.slice(0, 75)}...";`,
    `    $.writeln("FIT_RESULT:" + bestSize + "|" + lineCount + "|false|true");`,
    `  } else {`,
    `    var fb = layer.bounds;`,
    `    var targetX = boxX + Math.round((boxW - (fb[2].value - fb[0].value)) / 2);`,
    `    var targetY = boxY + Math.round((boxH - (fb[3].value - fb[1].value)) / 2);`,
    `    var dx = targetX - fb[0].value;`,
    `    var dy = targetY - fb[1].value;`,
    `    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {`,
    `      var desc = new ActionDescriptor();`,
    `      var ref = new ActionReference();`,
    `      ref.putIdentifier(charIDToTypeID("Lyr "), ${layerId});`,
    `      desc.putReference(charIDToTypeID("null"), ref);`,
    `      var offset = new ActionDescriptor();`,
    `      if (dx != 0) offset.putUnitDouble(charIDToTypeID("Hrz "), charIDToTypeID("#Pxl"), dx);`,
    `      if (dy != 0) offset.putUnitDouble(charIDToTypeID("Vrt "), charIDToTypeID("#Pxl"), dy);`,
    `      desc.putObject(charIDToTypeID("T   "), charIDToTypeID("Ofst"), offset);`,
    `      executeAction(charIDToTypeID("move"), desc, DialogModes.NO);`,
    `    }`,
    `    $.writeln("FIT_RESULT:" + bestSize + "|" + lineCount + "|true|false");`,
    `  }`,
    `} catch(e) { $.writeln("FIT_RESULT:0|0|false|false"); }`,
  ].join('\n');
}
