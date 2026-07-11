import type { ClassifiedLayer, FileRef, LayoutRegion, ImageFitOptions } from '../types';
import { psRunJsx, psReadLayers } from '../bridge/apiClient';
import { generateJsx } from '../utils/jsxBuilder';
import { log } from '../utils/logger';

export async function fitImageToRegion(
  docId: number,
  meta: ClassifiedLayer,
  fileRef: FileRef,
  region: LayoutRegion,
  options: ImageFitOptions = {}
): Promise<void> {
  try {
    const maxWPercent = options.maxWidthPercent ?? 0.40;
    const maxHPercent = options.maxHeightPercent ?? 0.40;
    const docInfo = await psReadLayers(docId);
    const layers = docInfo.layers || [];
    const target = layers.find((l: any) => l.id === meta.layerId);

    const docW = docInfo.width || 1920;
    const docH = docInfo.height || 1080;
    const maxW = Math.min(region.width, docW * maxWPercent);
    const maxH = Math.min(region.height, docH * maxHPercent);

    let placedLayerId: number | undefined;
    const imagePath = fileRef.path || '';
    if (meta.smartObject || meta.type === 'smartObject') {
      await psRunJsx(generateJsx.replaceSmartObject(meta.layerId, imagePath));
      placedLayerId = meta.layerId;
    } else {
      const result = await psRunJsx(generateJsx.placeEmbedded(imagePath));
      const idMatch = result.stdout?.match(/LAYER_ID:(\d+)/);
      if (idMatch) {
        placedLayerId = Number(idMatch[1]);
        await psRunJsx(generateJsx.renameLayer(placedLayerId, 'SNHS ' + fileRef.name));
      }
    }

    if (!placedLayerId) {
      log('warn', 'fitImageToRegion', 'No layer after placement');
      return;
    }

    const bounds = await psReadLayers(docId);
    const placedBounds = bounds.bounds?.find((b: any) => b.id === placedLayerId);
    if (!placedBounds) {
      log('warn', 'fitImageToRegion', 'Could not read placed layer bounds');
      return;
    }

    const imgW = placedBounds.right - placedBounds.left;
    const imgH = placedBounds.bottom - placedBounds.top;
    if (imgW <= 0 || imgH <= 0) {
      log('warn', 'fitImageToRegion', 'Image has zero dimensions');
      return;
    }

    const fitW = Math.min(region.width, maxW);
    const fitH = Math.min(region.height, maxH);
    const scaleX = fitW / imgW;
    const scaleY = fitH / imgH;
    const scale = options.coverFit !== false ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);

    const scaledW = imgW * scale;
    const scaledH = imgH * scale;
    const centerX = region.x + Math.round((region.width - scaledW) / 2);
    const centerY = region.y + Math.round((region.height - scaledH) / 2);

    const dx = centerX - placedBounds.left;
    const dy = centerY - placedBounds.top;

    await psRunJsx(generateJsx.translateAndScale(placedLayerId, dx, dy, scale));

    log('info', 'fitImageToRegion',
      `Placed ${fileRef.name} at scale ${(scale * 100).toFixed(0)}% in region ${Math.round(fitW)}x${Math.round(fitH)} pos=${centerX},${centerY}`);
  } catch (e: any) {
    log('error', 'fitImageToRegion', 'Failed: ' + e.message);
  }
}
