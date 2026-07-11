import type { ClassifiedLayer } from '../types';
import { psRunJsx, psReadLayers } from '../bridge/apiClient';
import { generateJsx } from '../utils/jsxBuilder';
import { log } from '../utils/logger';

export async function replaceImage(
  docId: number,
  meta: ClassifiedLayer,
  imagePath: string,
): Promise<void> {
  try {
    if (meta.smartObject || meta.type === 'smartObject') {
      await psRunJsx(generateJsx.replaceSmartObject(meta.layerId, imagePath));
    } else {
      const result = await psRunJsx(generateJsx.placeEmbedded(imagePath));
      const idMatch = result.stdout?.match(/LAYER_ID:(\d+)/);
      if (idMatch) {
        await psRunJsx(generateJsx.renameLayer(Number(idMatch[1]), 'SNHS ' + (meta.path || 'Image')));
      }
    }
    log('info', 'replaceImage', `Replaced layer ${meta.layerId} with ${imagePath}`);
  } catch (e: any) {
    log('error', 'replaceImage', `Failed: ${e.message}`);
  }
}
