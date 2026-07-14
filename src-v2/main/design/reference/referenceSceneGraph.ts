import type {
  ReferenceAnalysis, ReferenceSceneGraph, ReferenceSceneGraphLayer,
  NormalizedRect, DetectedRegion, DecorativeElement,
} from './referenceTypes';

function nr(x: number, y: number, w: number, h: number): NormalizedRect {
  return { x, y, width: w, height: h };
}

function deNormalize(r: NormalizedRect, cw: number, ch: number): NormalizedRect {
  return nr(
    Math.round(r.x * cw),
    Math.round(r.y * ch),
    Math.round(r.width * cw),
    Math.round(r.height * ch),
  );
}

function regionToLayer(
  region: DetectedRegion,
  canvasW: number,
  canvasH: number,
): ReferenceSceneGraphLayer {
  const b = deNormalize(region.bounds, canvasW, canvasH);
  const base: ReferenceSceneGraphLayer = {
    name: region.id,
    type: region.type === 'image' ? 'photo-slot' : region.type === 'text' ? 'text' : region.type === 'gradient' ? 'gradient' : 'shape',
    bounds: b,
    opacity: 1,
  };
  if (region.shape === 'rounded' || region.shape === 'circle') {
    base.mask = region.shape === 'circle' ? 'circle' : 'rounded';
    base.radius = region.shape === 'rounded' ? Math.round(Math.min(b.width, b.height) * 0.06) : undefined;
  }
  return base;
}

function decorativeToLayer(
  deco: DecorativeElement,
  canvasW: number,
  canvasH: number,
  index: number,
): ReferenceSceneGraphLayer {
  const b = deNormalize(deco.bounds, canvasW, canvasH);
  return {
    name: `DECORATION_${index + 1}`,
    type: deco.type === 'gradient' ? 'gradient' : 'shape',
    bounds: b,
    fill: deco.colour,
    opacity: deco.opacity / 100,
  };
}

export function buildSceneGraph(
  analysis: ReferenceAnalysis,
  strength: 'exact' | 'adaptive' = 'exact',
): ReferenceSceneGraph {
  const { canvas } = analysis;
  const CW = canvas.width;
  const CH = canvas.height;
  const layers: ReferenceSceneGraphLayer[] = [];
  const layerOrder: string[] = [];

  const pushLayer = (layer: ReferenceSceneGraphLayer): void => {
    layers.push(layer);
    layerOrder.push(layer.name);
  };

  pushLayer({
    name: '00_REFERENCE_GUIDES',
    type: 'group',
    bounds: nr(0, 0, CW, CH),
    children: [],
  });

  pushLayer({
    name: '01_BACKGROUND',
    type: 'background',
    bounds: nr(0, 0, CW, CH),
    fill: canvas.backgroundColour || 'FFFFFF',
  });

  if (analysis.background?.type === 'image' || canvas.backgroundImage) {
    pushLayer({
      name: 'BACKGROUND_IMAGE',
      type: 'background',
      bounds: nr(0, 0, CW, CH),
      imagePath: canvas.backgroundImage,
      fit: 'cover',
    });
  }

  if (analysis.decorativeShapes.length > 0) {
    analysis.decorativeShapes.forEach((deco, i) => {
      pushLayer(decorativeToLayer(deco, CW, CH, i));
    });
  }

  if (analysis.schoolLogoRegion) {
    const logoLayer = regionToLayer(analysis.schoolLogoRegion, CW, CH);
    logoLayer.name = '03_SCHOOL_LOGO';
    logoLayer.fit = 'contain';
    pushLayer(logoLayer);
  }

  if (analysis.headerRegion) {
    const headerLayer: ReferenceSceneGraphLayer = {
      name: '02_HEADER',
      type: 'group',
      bounds: deNormalize(analysis.headerRegion.bounds, CW, CH),
      children: [],
    };

    const nameRegion = analysis.allRegions.find((r) => r.role === 'schoolName');
    if (nameRegion) {
      headerLayer.children!.push({
        name: '04_SCHOOL_NAME',
        type: 'text',
        bounds: deNormalize(nameRegion.bounds, CW, CH),
        style: {
          font: 'Arial-BoldMT',
          size: Math.round(CH * 0.03),
          colour: 'FFFFFF',
          align: 'center',
        },
      });
    }
    pushLayer(headerLayer);
  }

  for (const mgmtRegion of analysis.managementPhotoRegions) {
    const mgmtLayer = regionToLayer(mgmtRegion, CW, CH);
    mgmtLayer.name = `05_${mgmtRegion.role === 'chairmanPortrait' ? 'CHAIRMAN' : 'PRINCIPAL'}`;
    mgmtLayer.fit = 'cover';
    pushLayer(mgmtLayer);
  }

  if (analysis.eventTitleRegion) {
    const titleLayer: ReferenceSceneGraphLayer = {
      name: '06_EVENT_TITLE',
      type: 'text',
      bounds: deNormalize(analysis.eventTitleRegion.bounds, CW, CH),
      style: {
        font: 'Arial-BoldMT',
        size: Math.round(CH * 0.05),
        colour: '000000',
        align: 'center',
        allCaps: true,
      },
    };
    pushLayer(titleLayer);
  }

  if (analysis.heroPhotoRegion) {
    const heroLayer = regionToLayer(analysis.heroPhotoRegion, CW, CH);
    heroLayer.name = '07_HERO_PHOTO';
    heroLayer.fit = 'cover';
    pushLayer(heroLayer);
  }

  for (const spRegion of analysis.supportingPhotoRegions) {
    const spLayer = regionToLayer(spRegion, CW, CH);
    spLayer.name = `08_SUPPORTING_PHOTO_${spRegion.id}`;
    spLayer.fit = 'cover';
    pushLayer(spLayer);
  }

  if (analysis.quoteRegion) {
    const quoteLayer: ReferenceSceneGraphLayer = {
      name: '09_QUOTE',
      type: 'text',
      bounds: deNormalize(analysis.quoteRegion.bounds, CW, CH),
      style: {
        font: 'Georgia-Italic',
        size: Math.round(CH * 0.022),
        colour: '333333',
        align: 'left',
      },
    };
    pushLayer(quoteLayer);
  }

  for (const progRegion of analysis.programmePhotoRegions) {
    const progLayer = regionToLayer(progRegion, CW, CH);
    progLayer.name = `10_PROGRAMME_GALLERY_${progRegion.id}`;
    progLayer.fit = 'cover';
    pushLayer(progLayer);
  }

  if (analysis.footerRegion) {
    const footerLayer: ReferenceSceneGraphLayer = {
      name: '11_FOOTER',
      type: 'group',
      bounds: deNormalize(analysis.footerRegion.bounds, CW, CH),
      children: [],
    };

    const phoneRegion = analysis.allRegions.find((r) => r.role === 'footerPhone');
    if (phoneRegion) {
      footerLayer.children!.push({
        name: 'FOOTER_PHONE',
        type: 'text',
        bounds: deNormalize(phoneRegion.bounds, CW, CH),
        style: { font: 'ArialMT', size: Math.round(CH * 0.018), colour: '000000', align: 'left' },
      });
    }

    pushLayer(footerLayer);
  }

  if (analysis.leadLogoRegion) {
    const leadLayer = regionToLayer(analysis.leadLogoRegion, CW, CH);
    leadLayer.name = '13_LEAD_LOGO';
    leadLayer.fit = 'contain';
    pushLayer(leadLayer);
  }

  if (analysis.contactInfoRegion) {
    const contactLayer: ReferenceSceneGraphLayer = {
      name: '14_CONTACT_DETAILS',
      type: 'text',
      bounds: deNormalize(analysis.contactInfoRegion.bounds, CW, CH),
      style: {
        font: 'ArialMT',
        size: Math.round(CH * 0.016),
        colour: '666666',
        align: 'left',
      },
    };
    pushLayer(contactLayer);
  }

  for (const region of analysis.allRegions) {
    if (region.role === 'decorativeShape' || region.role === 'divider' || region.role === 'border' || region.role === 'topAccentEdge') {
      const decoLayer = regionToLayer(region, CW, CH);
      decoLayer.name = `15_${region.id}`;
      pushLayer(decoLayer);
    }
  }

  const sceneGraph: ReferenceSceneGraph = {
    referenceId: analysis.referenceId,
    mode: 'exact-reconstruction',
    canvas: { width: CW, height: CH },
    layers,
    layerOrder,
  };

  if (strength === 'exact') {
    const bgLayerIndex = layerOrder.indexOf('01_BACKGROUND');
    if (bgLayerIndex >= 0) {
      const sorted = [...layers];
      const bg = sorted.splice(bgLayerIndex, 1)[0];
      sorted.unshift(bg);
      sceneGraph.layers = sorted;
      sceneGraph.layerOrder = sorted.map((l) => l.name);
    }
  }

  return sceneGraph;
}
