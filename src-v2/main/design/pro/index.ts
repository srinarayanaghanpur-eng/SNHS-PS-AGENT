// Pro Design Engine - Professional adaptive design pipeline
// Exports all modules for the professional design engine.

export * from './sceneGraph';
export * from './typography';
export * from './colour';
export * from './photo';
export * from './layoutSolver';
export * from './critic';
export * from './nodeFactory';
export * from './variantGenerator';
export * from './refinementLoop';
export * from './orchestrator';

import type { SceneGraph } from './sceneGraph';
import { makeSceneGraph, makeGroup, makeText, makeImage, makeShape, makeGradient, makeLine } from './nodeFactory';
import type { DerivedPalette } from './colour';
import type { FontPairing } from './typography';
import type { BatchPhotoAnalysis } from './photo';

export const sceneGraphHelpers = {
  makeSceneGraph, makeGroup, makeText, makeImage, makeShape, makeGradient, makeLine,
};
