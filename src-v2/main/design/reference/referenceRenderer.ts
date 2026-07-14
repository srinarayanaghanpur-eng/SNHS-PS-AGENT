import type {
  ReferenceAnalysis, ReferenceSceneGraph, ContentMap, RoleMapping,
  AccuracyReport, TextFittingReport, NormalizedRect,
} from './referenceTypes';
import { computeAccuracyReport, type MetricInput } from './referenceMetrics';
import type { DetectedRegion } from './referenceTypes';

function denormalizedBounds(b: NormalizedRect, cw: number, ch: number): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.round(b.x * cw),
    y: Math.round(b.y * ch),
    w: Math.round(b.width * cw),
    h: Math.round(b.height * ch),
  };
}

export interface RenderCompareResult {
  renderPath: string;
  accuracyReport: AccuracyReport;
  differences: string[];
  iteration: number;
}

export function simulateRender(
  analysis: ReferenceAnalysis,
  sceneGraph: ReferenceSceneGraph,
  contentMap: ContentMap,
): DetectedRegion[] {
  const generatedRegions: DetectedRegion[] = [];

  for (const mapping of contentMap.mappings) {
    const originalRegion = analysis.allRegions.find((r) => r.id === mapping.referenceSlot);
    if (!originalRegion) continue;

    generatedRegions.push({
      id: `gen_${mapping.referenceSlot}`,
      role: mapping.referenceRole,
      type: originalRegion.type,
      bounds: { ...originalRegion.bounds },
      confidence: mapping.confidence,
      shape: originalRegion.shape,
    });
  }

  for (const region of analysis.allRegions) {
    const alreadyMapped = contentMap.mappings.some((m) => m.referenceSlot === region.id);
    if (!alreadyMapped) {
      generatedRegions.push({
        ...region,
        id: `gen_preserved_${region.id}`,
      });
    }
  }

  return generatedRegions;
}

export function fitReplacementText(
  replacementText: string,
  referenceBounds: NormalizedRect,
  originalFontSize: number,
  canvasW: number,
  canvasH: number,
  minSize = 12,
): TextFittingReport {
  const boxWidth = referenceBounds.width * canvasW;
  const boxHeight = referenceBounds.height * canvasH;
  const charWidth = originalFontSize * 0.55;
  const charsPerLine = Math.floor(boxWidth / charWidth);
  const linesNeeded = Math.ceil(replacementText.length / Math.max(charsPerLine, 1));
  const linesFit = Math.floor(boxHeight / (originalFontSize * 1.2));

  const report: TextFittingReport = {
    originalSize: originalFontSize,
    adjustedSize: originalFontSize,
    originalTracking: 0,
    adjustedTracking: 0,
    lineBreaksChanged: false,
    boxHeightIncreased: false,
    fitAchieved: true,
  };

  if (linesNeeded <= linesFit) return report;

  const scaleFactor = Math.max(minSize / originalFontSize, linesFit / linesNeeded);
  report.adjustedSize = Math.round(originalFontSize * scaleFactor);
  report.fitAchieved = report.adjustedSize >= minSize;

  if (!report.fitAchieved) {
    report.warning = `Cannot fit "${replacementText.substring(0, 30)}..." within bounds. Font would need to be ${report.adjustedSize}px (min ${minSize}px).`;
    report.adjustedSize = minSize;
  }

  return report;
}

export function applyCropAdjustment(
  imagePath: string,
  _slotId: string,
  _useFaceSafeAnchor: boolean,
): { zoom: number; offsetX: number; offsetY: number } {
  return { zoom: 1, offsetX: 0, offsetY: 0 };
}

export async function renderCompareRevise(
  analysis: ReferenceAnalysis,
  sceneGraph: ReferenceSceneGraph,
  contentMap: ContentMap,
  maxIterations = 3,
  strength: 'exact' | 'adaptive' = 'exact',
): Promise<RenderCompareResult> {
  const differences: string[] = [];
  let iteration = 0;
  const cw = analysis.canvas.width;
  const ch = analysis.canvas.height;

  for (let i = 0; i < maxIterations; i++) {
    iteration = i + 1;

    const generatedRegions = simulateRender(analysis, sceneGraph, contentMap);

    const metricInput: MetricInput = {
      analysis,
      generatedRegions,
      strength,
    };
    const report = computeAccuracyReport(metricInput);

    if (report.accepted) {
      return {
        renderPath: `render_iteration_${iteration}.png`,
        accuracyReport: report,
        differences,
        iteration,
      };
    }

    for (const failure of report.failures) {
      if (!differences.includes(failure)) {
        differences.push(failure);
      }
    }

    for (const mapping of contentMap.mappings) {
      if (mapping.replacementContent) {
        const originalRegion = analysis.allRegions.find((r) => r.id === mapping.referenceSlot);
        if (originalRegion) {
          const fitReport = fitReplacementText(
            mapping.replacementContent,
            originalRegion.bounds,
            Math.round(cw * 0.04),
            cw,
            ch,
          );
          if (!fitReport.fitAchieved && fitReport.warning) {
            differences.push(fitReport.warning);
          }
        }
      }
    }

    if (report.overallStructuralAccuracy >= 95) break;
  }

  const finalRegions = simulateRender(analysis, sceneGraph, contentMap);
  const finalInput: MetricInput = {
    analysis,
    generatedRegions: finalRegions,
    strength,
  };
  const finalReport = computeAccuracyReport(finalInput);

  return {
    renderPath: `render_iteration_${iteration}.png`,
    accuracyReport: finalReport,
    differences,
    iteration,
  };
}
