export { analyseReference, getCanvasDimensions, classifyRegionRole } from './referenceAnalyzer';
export type { AnalysisResult } from './referenceAnalyzer';
export { buildSceneGraph } from './referenceSceneGraph';
export { buildRequiredChecklist, mapContent } from './referenceContentMapper';
export type { ReplacementContent } from './referenceContentMapper';
export { computeAccuracyReport, accuracyLabel } from './referenceMetrics';
export type { MetricInput } from './referenceMetrics';
export { generateDebugOverlayJsx, generateDifferenceHeatmapJsx, generateRegionLabelsJsx, defaultDebugConfig } from './referenceDebugger';
export { runReconstruction } from './referenceReconstructor';
export type { ReconstructionRequest, ReconstructionResponse } from './referenceReconstructor';
export { renderCompareRevise, fitReplacementText, applyCropAdjustment } from './referenceRenderer';
export type { RenderCompareResult } from './referenceRenderer';
export { createInitialUIState, nextStep, previousStep, UI_STEPS } from './referenceUI';
export type { ReferenceRecreationUIState, UIStep } from './referenceUI';
export {
  acceptanceLabel,
  ACCEPTANCE_LABELS,
  ACCEPTANCE_THRESHOLDS,
  REFERENCE_LAYER_GROUPS,
} from './referenceTypes';
export type * from './referenceTypes';
