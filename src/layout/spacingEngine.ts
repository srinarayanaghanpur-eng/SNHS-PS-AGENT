import type { ClassifiedLayer } from '../types';
import { getLayerBounds } from '../photoshop/layerLookup';
import { psRunJsx } from '../bridge/apiClient';
import { generateJsx } from '../utils/jsxBuilder';
import { log } from '../utils/logger';

interface SpacingRule {
  roleA: string; roleB: string;
  minHorizontalPercent: number; minVerticalPercent: number;
}

const SPACING_RULES: SpacingRule[] = [
  { roleA: 'school_logo', roleB: 'school_name', minHorizontalPercent: 1.5, minVerticalPercent: 0 },
  { roleA: 'school_name', roleB: 'poster_title', minHorizontalPercent: 0, minVerticalPercent: 2 },
  { roleA: 'branding', roleB: 'poster_title', minHorizontalPercent: 0, minVerticalPercent: 2 },
  { roleA: 'powered_by_lead', roleB: 'poster_title', minHorizontalPercent: 0, minVerticalPercent: 2 },
  { roleA: 'poster_title', roleB: 'event_image', minHorizontalPercent: 0, minVerticalPercent: 2 },
  { roleA: 'poster_title', roleB: 'event_date', minHorizontalPercent: 0, minVerticalPercent: 2 },
  { roleA: 'event_image', roleB: 'event_description', minHorizontalPercent: 3, minVerticalPercent: 0 },
  { roleA: 'event_image', roleB: 'features', minHorizontalPercent: 3, minVerticalPercent: 0 },
  { roleA: 'chairman_photo', roleB: 'contact_information', minHorizontalPercent: 2, minVerticalPercent: 0 },
  { roleA: 'chairman_photo', roleB: 'footer', minHorizontalPercent: 0, minVerticalPercent: 1.5 },
  { roleA: 'contact_information', roleB: 'footer', minHorizontalPercent: 0, minVerticalPercent: 1 },
  { roleA: 'school_address', roleB: 'school_phone', minHorizontalPercent: 0, minVerticalPercent: 0.5 },
  { roleA: 'school_address', roleB: 'footer', minHorizontalPercent: 0, minVerticalPercent: 1 },
  { roleA: 'principal_photo', roleB: 'contact_information', minHorizontalPercent: 2, minVerticalPercent: 0 },
  { roleA: 'principal_photo', roleB: 'footer', minHorizontalPercent: 0, minVerticalPercent: 1.5 },
];

export async function applySpacing(
  docId: number,
  docW: number,
  docH: number,
  layers: ClassifiedLayer[]
): Promise<void> {
  const layerMap = new Map<string, ClassifiedLayer>();
  for (const layer of layers) layerMap.set(layer.semanticRole, layer);

  let fixCount = 0;
  for (const rule of SPACING_RULES) {
    const layerA = layerMap.get(rule.roleA);
    const layerB = layerMap.get(rule.roleB);
    if (!layerA || !layerB) continue;

    const minH = Math.round(docW * (rule.minHorizontalPercent / 100));
    const minV = Math.round(docH * (rule.minVerticalPercent / 100));
    if (minH <= 0 && minV <= 0) continue;

    const bA = await getLayerBounds(docId, layerA.layerId);
    const bB = await getLayerBounds(docId, layerB.layerId);
    if (!bA || !bB) continue;

    if (minV > 0) {
      const gap = bB.top - bA.bottom;
      if (gap < minV && gap >= 0) {
        const dy = minV - gap;
        await psRunJsx(generateJsx.translateAndScale(layerB.layerId, 0, dy, 1));
        fixCount++;
        log('info', 'applySpacing', `Moved ${rule.roleB} down ${dy}px`);
      }
    }

    if (minH > 0) {
      const gap = bB.left - bA.right;
      if (gap < minH && gap >= 0) {
        const dx = minH - gap;
        await psRunJsx(generateJsx.translateAndScale(layerB.layerId, dx, 0, 1));
        fixCount++;
        log('info', 'applySpacing', `Moved ${rule.roleB} right ${dx}px`);
      }
    }
  }

  if (fixCount > 0) log('info', 'applySpacing', `Applied ${fixCount} spacing fixes`);
}
