import type {
  ReferenceAnalysis, DebugOverlayConfig, NormalizedRect, DetectedRegion,
} from './referenceTypes';

export interface DebugOverlayState {
  referenceOpacity: number;
  showDetectedRegions: boolean;
  showAlignmentGuides: boolean;
  showPixelDifference: boolean;
  showTextDifferences: boolean;
  showImageSlotDifferences: boolean;
}

export function defaultDebugConfig(): DebugOverlayConfig {
  return {
    referenceOpacity: 0.5,
    showDetectedRegions: true,
    showAlignmentGuides: true,
    showPixelDifference: false,
    showTextDifferences: false,
    showImageSlotDifferences: false,
  };
}

export function generateDebugOverlayJsx(
  analysis: ReferenceAnalysis,
  config: DebugOverlayConfig,
  canvasW: number,
  canvasH: number,
): string {
  const lines: string[] = [];

  lines.push('// ---- REFERENCE OVERLAY DEBUGGER ----');
  lines.push(`var doc = app.activeDocument;`);
  lines.push(`var debugGroup = doc.layerSets.add();`);
  lines.push(`debugGroup.name = "DEBUG_REFERENCE_OVERLAY";`);

  if (config.showAlignmentGuides) {
    const majorGuides = [
      { position: 0, label: 'top' },
      { position: 0.15, label: 'header-bottom' },
      { position: 0.50, label: 'midpoint' },
      { position: 0.92, label: 'footer-top' },
      { position: 1, label: 'bottom' },
    ];

    for (const guide of majorGuides) {
      const y = Math.round(canvasH * guide.position);
      lines.push(`var guideRef = app.activeDocument.guides.add(Direction.HORIZONTAL, ${y});`);
    }

    for (const region of analysis.allRegions) {
      if (!config.showDetectedRegions) continue;
      const b = region.bounds;
      const x = Math.round(b.x * canvasW);
      const y = Math.round(b.y * canvasH);
      const w = Math.round(b.width * canvasW);
      const h = Math.round(b.height * canvasH);

      lines.push(`var regionLayer = debugGroup.artLayers.add();`);
      lines.push(`regionLayer.name = "REGION_${region.id.replace(/[^a-zA-Z0-9_]/g, '_')}";`);
      lines.push([
        `var regionBounds = [${x}, ${y}, ${x + w}, ${y + h}];`,
      ].join(''));
      lines.push(`regionLayer.bounds = regionBounds;`);

      const colour = regionColour(region.role);
      lines.push(`var regionColor = new SolidColor();`);
      lines.push(`regionColor.rgb.red = ${parseInt(colour.slice(0, 2), 16)};`);
      lines.push(`regionColor.rgb.green = ${parseInt(colour.slice(2, 4), 16)};`);
      lines.push(`regionColor.rgb.blue = ${parseInt(colour.slice(4, 6), 16)};`);
      lines.push(`regionLayer.fill(regionColor);`);
      lines.push(`regionLayer.opacity = 25;`);
    }
  }

  if (config.showPixelDifference) {
    lines.push(`// Pixel difference mode would render here`);
    lines.push(`// Requires reference image placed at 50% opacity and compared`);
  }

  lines.push(`// ---- END DEBUG OVERLAY ----`);

  return lines.join('\n');
}

function regionColour(role: string): string {
  const colours: Record<string, string> = {
    schoolLogo: 'FF0000',
    schoolName: '00FF00',
    chairmanPortrait: '0000FF',
    eventTitle: 'FFFF00',
    posterDate: 'FF00FF',
    heroPhoto: '00FFFF',
    supportingPhoto: 'FF8800',
    programmePhoto: '8800FF',
    quote: '0088FF',
    footerRegion: 'FF0088',
    leadLogo: '00FF88',
    contactInfoRegion: '888800',
    decorativeShape: '888888',
    divider: '444444',
  };
  return colours[role] || 'AAAAAA';
}

export function generateRegionLabelsJsx(analysis: ReferenceAnalysis, canvasW: number, canvasH: number): string {
  const lines: string[] = [];
  lines.push(`var labelGroup = app.activeDocument.layerSets.add();`);
  lines.push(`labelGroup.name = "DEBUG_REGION_LABELS";`);

  for (const region of analysis.allRegions) {
    const b = region.bounds;
    const x = Math.round(b.x * canvasW);
    const y = Math.round(b.y * canvasH);

    lines.push(`var labelLayer = labelGroup.artLayers.add();`);
    lines.push(`labelLayer.name = "LABEL_${region.role}";`);
    lines.push(`var textItem = labelLayer.textItem;`);
    lines.push(`textItem.contents = "${region.role} (${region.confidence}%)";`);
    lines.push(`textItem.position = [${x + 4}, ${y + 14}];`);
    lines.push(`textItem.size = 10;`);
    lines.push(`textItem.font = "ArialMT";`);
  }

  return lines.join('\n');
}

export function generateDifferenceHeatmapJsx(
  referencePath: string,
  outputPath: string,
  canvasW: number,
  canvasH: number,
): string {
  return [
    `// Difference heatmap generation`,
    `// Opens reference, compares pixel by pixel with generated output`,
    `var refFile = File("${referencePath.replace(/\\/g, '\\\\')}");`,
    `var refDoc = app.open(refFile);`,
    `// Align both documents and create difference layer`,
    `// Export difference to ${outputPath.replace(/\\/g, '\\\\')}`,
  ].join('\n');
}
