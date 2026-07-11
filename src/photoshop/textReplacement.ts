import type { ClassifiedLayer, OperationWarning } from '../types';
import { psRunJsx, psReadLayers } from '../bridge/apiClient';
import { generateJsx } from '../utils/jsxBuilder';
import { fitTextToRegion, readActualBounds } from '../layout/textFitEngine';
import { getTextRegionForRole, getSectionForRole, getRegionForSection } from '../layout/layoutHelpers';
import { log } from '../utils/logger';

export async function replaceText(
  docId: number,
  meta: ClassifiedLayer,
  value: string,
  docW?: number,
  docH?: number
): Promise<OperationWarning | undefined> {
  const layerInfo = await psReadLayers(docId);
  const layer = layerInfo.layers?.find((l: any) => l.id === meta.layerId);
  const text = layerInfo.texts?.find((t: any) => t.id === meta.layerId);

  if (!layer) return { operation: 'Replace text', message: 'Layer ' + meta.path + ' was deleted or renamed.', solution: 'Re-analyze the changed PSD.', layerId: meta.layerId };
  if (meta.type !== 'text') return { operation: 'Replace text', message: meta.path + ' is not an editable text layer.', solution: 'Use an editable Photoshop text layer.', layerId: meta.layerId };

  try {
    const w = docW ?? 1080;
    const h = docH ?? 1080;
    const section = getSectionForRole(meta.semanticRole);
    const sectionRegion = getRegionForSection(w, h, section);
    const textRegion = getTextRegionForRole(meta.semanticRole, w, h, sectionRegion);

    log('info', 'replaceText',
      `Replacing layer=${meta.path} role=${meta.semanticRole} text="${value.slice(0, 40)}" region=${textRegion.width}x${textRegion.height}`);

    await psRunJsx(generateJsx.setTextContents(meta.layerId, value));

    const result = await fitTextToRegion(docId, meta, value, textRegion);

    if (result.overflow) {
      return {
        operation: 'Fit text',
        message: `Text "${value.slice(0, 40)}" overflows ${meta.path} at min size ${textRegion.minFontSize}px (${result.lineCount} lines, max ${textRegion.maxLines})`,
        solution: 'Shorten the wording or adjust the template text box.',
        layerId: meta.layerId
      };
    }

    const finalBounds = await readActualBounds(docId, meta.layerId);
    log('info', 'replaceText',
      `Role=${meta.semanticRole} bounds=${finalBounds.width}x${finalBounds.height} pos=${finalBounds.left},${finalBounds.top} font=${result.finalSize}px lines=${result.lineCount}`);

    return undefined;
  } catch (e: any) {
    return { operation: 'Replace text', message: String(e), solution: 'Unlock the text layer/group and ensure its font is installed.', layerId: meta.layerId };
  }
}
