import { psRunJsx } from '../bridge/apiClient';
import { generateJsx } from '../utils/jsxBuilder';
import { log } from '../utils/logger';

export interface LayerOp { ok: boolean; layerId?: number; message?: string }

async function extractLayerId(result: { stdout?: string }): Promise<number | undefined> {
  const match = result.stdout?.match(/LAYER_ID:(\d+)/);
  return match ? Number(match[1]) : undefined;
}

export async function createGroup(name: string): Promise<LayerOp> {
  try {
    const result = await psRunJsx(generateJsx.addGroup(name));
    return { ok: true, layerId: await extractLayerId(result) };
  } catch (err) { log('warn', 'createGroup', `${name}: ${String(err)}`); return { ok: false, message: String(err) }; }
}

export interface TextLayerSpec {
  name: string;
  text: string;
  fontPostScriptName: string;
  fontSizePx: number;
  tracking: number;
  leadingPx: number;
  color: [number, number, number];
  left: number; top: number;
  justification?: 'left' | 'center' | 'right';
}

export async function createTextLayer(spec: TextLayerSpec): Promise<LayerOp> {
  try {
    const jsx = [
      'var doc = app.activeDocument;',
      `var layer = doc.artLayers.add();`,
      `layer.kind = LayerKind.TEXT;`,
      `layer.name = "${spec.name.replace(/"/g, '\\"')}";`,
      `var ti = layer.textItem;`,
      `ti.contents = "${(spec.text || '').replace(/"/g, '\\"').replace(/\n/g, '\\n')}";`,
      `ti.font = "${spec.fontPostScriptName}";`,
      `ti.size = ${spec.fontSizePx};`,
      `ti.tracking = ${spec.tracking};`,
      `ti.autoLeading = false;`,
      `ti.leading = ${spec.leadingPx};`,
      `ti.color.rgb.red = ${spec.color[0]};`,
      `ti.color.rgb.green = ${spec.color[1]};`,
      `ti.color.rgb.blue = ${spec.color[2]};`,
      spec.justification ? `ti.justification = Justification.${spec.justification.toUpperCase()};` : '',
      `ti.position = Array(${spec.left}, ${spec.top + spec.fontSizePx * 0.8});`,
      `$.writeln("LAYER_ID:" + layer.id);`,
    ].filter(Boolean).join('\n');
    const result = await psRunJsx(jsx);
    return { ok: true, layerId: await extractLayerId(result) };
  } catch (err) { log('warn', 'createTextLayer', `${spec.name}: ${String(err)}`); return { ok: false, message: String(err) }; }
}

export async function renameLayer(layerId: number, name: string): Promise<LayerOp> {
  try {
    await psRunJsx(generateJsx.renameLayer(layerId, name));
    return { ok: true, layerId };
  } catch (err) { return { ok: false, message: String(err) }; }
}

export async function setLayerVisible(layerId: number, visible: boolean): Promise<LayerOp> {
  try {
    await psRunJsx(generateJsx.setLayerVisibility(layerId, visible));
    return { ok: true, layerId };
  } catch (err) { return { ok: false, message: String(err) }; }
}

export async function moveLayerIntoGroup(layerId: number, groupId: number): Promise<LayerOp> {
  try {
    await psRunJsx(generateJsx.moveLayerIntoGroup(layerId, groupId));
    return { ok: true, layerId };
  } catch (err) { return { ok: false, message: String(err) }; }
}

export async function placeImageLayer(filePath: string, name: string, box?: { left: number; top: number; width: number; height: number }): Promise<LayerOp> {
  try {
    const result = await psRunJsx(generateJsx.placeEmbedded(filePath));
    const layerId = await extractLayerId(result);
    if (layerId === undefined) return { ok: false, message: 'place produced no layer' };
    await renameLayer(layerId, name);
    return { ok: true, layerId };
  } catch (err) { log('warn', 'placeImageLayer', `${name}: ${String(err)}`); return { ok: false, message: String(err) }; }
}
