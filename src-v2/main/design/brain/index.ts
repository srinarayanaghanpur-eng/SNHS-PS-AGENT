// Poster Brain — Trainable Human-Design Learning System
//
// Exports all public API for the three-layer intelligence system.
//
// Layer 1 — VisualAssetAnalyzer
//   Understands input assets before any design decisions.
//
// Layer 2 — DesignPlanGenerator
//   Produces versioned, validated DesignPlan JSON via retrieval-first
//   composition. Does NOT render directly.
//
// Layer 3 — QualityCritic
//   Scores rendered posters against 14 human-design criteria.
//
// Supporting modules:
//   brainStorage — Dataset persistence under the configured root at poster-brain/
//   brainRetrieval — Similar-poster search across the approved library
//   brainFeedback — Approve/reject/compare/correct controls
//   brainPipeline — Orchestrates all three layers end-to-end

export { BRAIN_VERSION } from './brainTypes';
export type {
  DesignPlan, PhotoPlacement, CropAnchors, DesignPalette, DesignTypography,
  DecorationSpec, QuoteSpec, ManagementSpec, FooterSpec,
  TrainingRecord, AssetManifest, QualityScores, PreferencePair,
  RejectionReason, ApprovalState, FeedbackAction, RetrievalQuery, RetrievalResult,
  CriticReport, CriticScore, CritiqueThresholds,
  PhotoshopLayerGroup, PhotoshopLayer, DesignDecision,
} from './brainTypes';
export { DEFAULT_CRITIQUE_THRESHOLDS } from './brainTypes';

export { analyzeAssets } from './visualAssetAnalyzer';
export type { AssetAnalysis, EmphasisType } from './visualAssetAnalyzer';

export { generateDesignPlan, designPlanToLegacyPlan } from './designPlanGenerator';
export type { GeneratePlanOptions } from './designPlanGenerator';

export { critiquePosterQuality, critiqueDesignPlan } from './qualityCritic';

export {
  saveRecord, loadRecord, deleteRecord,
  listRecords, listRecordsWithMeta,
  importHumanPoster,
  approveRecord, rejectRecord, correctRecord,
  savePreferencePair, loadPreferencePairs,
  recordsBySchool, recordsByCategory, recordsByState,
  allRecordIds, brainStats,
} from './brainStorage';

export {
  retrieveSimilar, findBestReference, extractKeywords,
} from './brainRetrieval';

export {
  approvePoster, rejectPoster, correctPoster,
  comparePosters, recordFeedback, autoApproveIfHighQuality,
} from './brainFeedback';

export {
  runBrainPipeline, recordRenderedOutput,
} from './brainPipeline';
export type { PipelineInput, PipelineOutput } from './brainPipeline';
