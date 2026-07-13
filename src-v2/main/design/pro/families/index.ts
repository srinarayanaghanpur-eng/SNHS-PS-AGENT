// Design Family index - exports all three composition families

import { composeEditorialMinimal } from './editorialMinimal';
import { composeBoldGraphic } from './boldGraphic';
import { composePhotoStory } from './photoStory';

export { composeEditorialMinimal, composeBoldGraphic, composePhotoStory };

import type { SceneGraph } from '../sceneGraph';
import type { DerivedPalette } from '../colour';
import type { FontPairing } from '../typography';
import type { BatchPhotoAnalysis } from '../photo';
import type { ContentInput } from '../nodeFactory';

export type FamilyComposer = (
  width: number,
  height: number,
  palette: DerivedPalette,
  typography: FontPairing,
  photoBatch: BatchPhotoAnalysis,
  content: ContentInput,
  seed: number
) => SceneGraph;

export const FAMILY_COMPOSERS: Record<string, FamilyComposer> = {
  'editorial-minimal': composeEditorialMinimal,
  'bold-graphic': composeBoldGraphic,
  'photo-story': composePhotoStory,
};

export const FAMILY_VARIANTS: Record<string, number> = {
  'editorial-minimal': 2,
  'bold-graphic': 2,
  'photo-story': 2,
};
