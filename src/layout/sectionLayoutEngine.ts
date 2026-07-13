import type { ClassifiedLayer, LayoutSection } from '../types';
import { getSectionForRole, getRegionForSection, calculateSafeArea, moveLayerInsideRegion, resizeLayerToFitRegion } from './safeAreaCalculator';
import { getLayerBounds } from '../photoshop/layerLookup';
import { log } from '../utils/logger';

const SECTION_ORDER: LayoutSection[] = ['header', 'content', 'footer'];

export async function applySectionLayout(
  docId: number,
  docW: number,
  docH: number,
  layers: ClassifiedLayer[]
): Promise<void> {
  const safe = calculateSafeArea(docW, docH);
  log('info', 'sectionLayout', `Document ${docW}x${docH}, safe area: ${safe.left},${safe.top} - ${safe.right},${safe.bottom}`);

  const sectionLayers: Record<LayoutSection, ClassifiedLayer[]> = { header: [], content: [], footer: [] };

  for (const layer of layers) {
    if (layer.type === 'group') continue;
    if (layer.semanticRole === 'background' || layer.semanticRole === 'decorative_element') continue;
    if (layer.semanticRole === 'repeated_student_card') continue;
    if (layer.semanticRole === 'unknown') continue;
    const section = getSectionForRole(layer.semanticRole);
    sectionLayers[section].push(layer);
  }

  for (const section of SECTION_ORDER) {
    const sectionLayersList = sectionLayers[section];
    if (sectionLayersList.length === 0) continue;
    const region = getRegionForSection(docW, docH, section);
    log('info', 'sectionLayout', `${section}: ${sectionLayersList.length} layers in region (${region.x},${region.y} ${region.width}x${region.height})`);

    for (const layer of sectionLayersList) {
      try {
        await positionLayerInSection(docId, layer, section, docW, docH);
      } catch (e: any) {
        log('warn', 'sectionLayout', `Failed to position layer ${layer.path}: ${e.message}`);
      }
    }
  }
}

async function positionLayerInSection(
  docId: number,
  layer: ClassifiedLayer,
  section: LayoutSection,
  docW: number,
  docH: number
): Promise<void> {
  const region = getRegionForSection(docW, docH, section);
  const bounds = await getLayerBounds(docId, layer.layerId);
  if (!bounds) {
    log('warn', 'positionLayerInSection', `Layer ${layer.path} not found in document`);
    return;
  }

  const layerW = bounds.width;
  const layerH = bounds.height;
  if (layerW <= 0 || layerH <= 0) return;

  const isImage = ['event_image', 'school_logo', 'chairman_photo', 'principal_photo', 'student_photo'].includes(layer.semanticRole);

  if (isImage) {
    const maxDim = section === 'footer' ? Math.min(docW, docH) * 0.12 : Math.min(docW, docH) * 0.38;
    const fitRegion = {
      x: region.x,
      y: region.y + Math.round(region.height * 0.05),
      width: Math.min(region.width, maxDim),
      height: Math.min(region.height * 0.8, maxDim)
    };
    await resizeLayerToFitRegion(docId, layer.layerId, fitRegion, { preserveAspect: true, maxScale: 1 });
    await moveLayerInsideRegion(docId, layer.layerId, { x: region.x, y: region.y + Math.round(region.height * 0.05), width: region.width, height: Math.round(region.height * 0.9) }, section === 'header' ? 'left' : 'center');
  } else {
    const align = ['school_name', 'powered_by_lead'].includes(layer.semanticRole) ? 'left' : 'center';
    await moveLayerInsideRegion(docId, layer.layerId, region, align);
  }

  log('info', 'positionLayerInSection', `Layer "${layer.path}" (${layer.semanticRole}) positioned in ${section}`);
}
