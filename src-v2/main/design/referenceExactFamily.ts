import type { Plan, PlanGroup, PlanNode, Rect, ResolvedAsset } from './types';
import type { ReferenceSceneGraph, ReferenceSceneGraphLayer } from './reference/referenceTypes';

const r = (x: number, y: number, w: number, h: number): Rect => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
const g = (name: string, nodes: PlanNode[] = []): PlanGroup => ({ name, nodes });

function layerToNode(
  layer: ReferenceSceneGraphLayer,
  assetPaths: Record<string, string>,
): PlanNode | null {
  const b = layer.bounds;

  if (layer.type === 'background') {
    if (layer.fill) {
      return {
        kind: 'rect',
        name: layer.name,
        rect: r(b.x, b.y, b.width, b.height),
        hex: layer.fill,
      };
    }
    if (layer.imagePath || assetPaths[layer.name]) {
      return {
        kind: 'photo',
        name: layer.name,
        rect: r(b.x, b.y, b.width, b.height),
        path: assetPaths[layer.name] || layer.imagePath || '',
        mask: 'none',
        fit: layer.fit || 'cover',
      };
    }
  }

  if (layer.type === 'photo-slot') {
    const path = assetPaths[layer.name];
    if (!path) return null;
    return {
      kind: 'photo',
      name: layer.name,
      rect: r(b.x, b.y, b.width, b.height),
      path,
      mask: layer.mask || 'rounded',
      radius: layer.radius,
      fit: layer.fit || 'cover',
      focusY: layer.focusY,
      effects: layer.effects ? {
        shadow: layer.effects.shadow,
        stroke: layer.effects.stroke,
      } : undefined,
    };
  }

  if (layer.type === 'text') {
    return {
      kind: 'text',
      name: layer.name,
      content: layer.content || '',
      rect: r(b.x, b.y, b.width, b.height),
      font: layer.style?.font || 'ArialMT',
      size: layer.style?.size || Math.round(b.height * 0.7),
      minSize: 10,
      maxLines: 3,
      hex: layer.style?.colour || '000000',
      align: layer.style?.align || 'left',
      lineHeight: layer.style?.lineHeight,
      tracking: layer.style?.tracking,
      allCaps: layer.style?.allCaps,
      surfaceHex: layer.style?.surfaceHex,
      effects: layer.effects ? {
        shadow: layer.effects.shadow,
        glow: layer.effects.glow,
      } : undefined,
    };
  }

  if (layer.type === 'shape') {
    return {
      kind: 'rect',
      name: layer.name,
      rect: r(b.x, b.y, b.width, b.height),
      hex: layer.fill || '000000',
      opacity: layer.opacity ? Math.round(layer.opacity * 100) : 100,
      radius: layer.radius,
      effects: layer.effects ? {
        shadow: layer.effects.shadow,
        stroke: layer.effects.stroke,
      } : undefined,
    };
  }

  if (layer.type === 'gradient') {
    return null;
  }

  return null;
}

export function composeReferenceExactReconstruction(
  sceneGraph: ReferenceSceneGraph,
  assetPaths: Record<string, string>,
  _contentOverrides?: Record<string, string>,
): Plan {
  const CW = sceneGraph.canvas.width;
  const CH = sceneGraph.canvas.height;
  const groups: PlanGroup[] = [];

  const bgGroup = g('00_BACKGROUND');
  const headerGroup = g('02_HEADER');
  const logoGroup = g('03_SCHOOL_LOGO');
  const schoolNameGroup = g('04_SCHOOL_NAME');
  const chairmanGroup = g('05_CHAIRMAN');
  const titleGroup = g('06_EVENT_TITLE');
  const heroGroup = g('07_HERO_PHOTO');
  const supportingGroup = g('08_SUPPORTING_PHOTOS');
  const quoteGroup = g('09_QUOTE');
  const programmeGroup = g('10_PROGRAMME_GALLERY');
  const footerGroup = g('11_FOOTER');
  const groupBrandingGroup = g('12_GROUP_BRANDING');
  const leadLogoGroup = g('13_LEAD_LOGO');
  const contactGroup = g('14_CONTACT_DETAILS');
  const decorGroup = g('15_DECORATIONS');

  const groupMap: Record<string, PlanGroup> = {
    '00_REFERENCE_GUIDES': g('00_REFERENCE_GUIDES'),
    '01_BACKGROUND': bgGroup,
    '02_HEADER': headerGroup,
    '03_SCHOOL_LOGO': logoGroup,
    '04_SCHOOL_NAME': schoolNameGroup,
    '05_CHAIRMAN': chairmanGroup,
    '06_EVENT_TITLE': titleGroup,
    '07_HERO_PHOTO': heroGroup,
    '08_SUPPORTING_PHOTOS': supportingGroup,
    '09_QUOTE': quoteGroup,
    '10_PROGRAMME_GALLERY': programmeGroup,
    '11_FOOTER': footerGroup,
    '12_GROUP_BRANDING': groupBrandingGroup,
    '13_LEAD_LOGO': leadLogoGroup,
    '14_CONTACT_DETAILS': contactGroup,
    '15_DECORATIONS': decorGroup,
  };

  for (const layer of sceneGraph.layers) {
    if (layer.type === 'group' && layer.children) {
      for (const child of layer.children) {
        const node = layerToNode(child, assetPaths);
        if (node) {
          const parentGroup = groupMap[layer.name] || decorGroup;
          parentGroup.nodes.push(node);
        }
      }
      continue;
    }

    const node = layerToNode(layer, assetPaths);
    if (!node) continue;

    const targetGroup = groupMap[layer.name] || decorGroup;
    targetGroup.nodes.push(node);
  }

  groups.push(groupMap['00_REFERENCE_GUIDES'] || g('00_REFERENCE_GUIDES'));
  groups.push(bgGroup);
  groups.push(headerGroup);
  groups.push(logoGroup);
  groups.push(schoolNameGroup);
  groups.push(chairmanGroup);
  groups.push(titleGroup);
  groups.push(heroGroup);
  groups.push(supportingGroup);
  groups.push(quoteGroup);
  groups.push(programmeGroup);
  groups.push(footerGroup);
  groups.push(groupBrandingGroup);
  groups.push(leadLogoGroup);
  groups.push(contactGroup);
  groups.push(decorGroup);

  return {
    width: CW,
    height: CH,
    baseHex: 'FFFFFF',
    groups,
    metadata: {
      compositionFamily: 'referenceExactReconstruction',
      rendererName: 'reference-exact-reconstruction',
      legacyRendererUsed: false,
    },
  };
}
