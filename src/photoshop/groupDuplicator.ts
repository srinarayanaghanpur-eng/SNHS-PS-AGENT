import type { ClassifiedLayer, StudentRecord, OperationWarning } from '../types';
import { cardLayout } from '../layout/cardLayoutEngine';
import { safeArea } from '../layout/safeAreaCalculator';
import { psRunJsx, psReadLayers } from '../bridge/apiClient';
import { generateJsx } from '../utils/jsxBuilder';
import { log } from '../utils/logger';

export async function arrangeStudentCards(
  docId: number,
  manifestLayers: ClassifiedLayer[],
  students: StudentRecord[]
): Promise<{ groups: number[]; warnings: OperationWarning[] }> {
  const warnings: OperationWarning[] = [];
  const cards = manifestLayers.filter(l => l.semanticRole === 'repeated_student_card');
  if (!cards.length || !students.length) return { groups: [], warnings };

  const base = cards[0]!;
  const layerInfo = await psReadLayers(docId);
  const original = layerInfo.layers?.find((l: any) => l.id === base.layerId);
  if (!original) return { groups: [], warnings: [{ operation: 'Student cards', message: 'Repeated card group is missing.', solution: 'Re-analyze the PSD.' }] };

  const groups: number[] = [base.layerId];
  for (let i = 1; i < students.length; i++) {
    const result = await psRunJsx(generateJsx.duplicateLayer(base.layerId));
    const idMatch = result.stdout?.match(/LAYER_ID:(\d+)/);
    if (idMatch) groups.push(Number(idMatch[1]));
  }

  for (let i = cards.length - 1; i >= students.length; i--) {
    const c = cards[i];
    if (c) await psRunJsx(generateJsx.setLayerVisibility(c.layerId, false));
  }

  const docInfo = layerInfo as any;
  const area = safeArea(Number(docInfo.width) || 1920, Number(docInfo.height) || 1080, manifestLayers);
  const w = Number(original.width) || 200;
  const h = Number(original.height) || 200;
  const placements = cardLayout(students.length, area, base.bounds?.width || w, base.bounds?.height || h);

  for (let i = 0; i < groups.length; i++) {
    const p = placements[i];
    if (!p) continue;
    await psRunJsx(generateJsx.setLayerVisibility(groups[i], true));
    await psRunJsx(generateJsx.translateAndScale(groups[i], p.left, p.top, p.scale));
  }

  return { groups, warnings };
}
