import type { DetectedFace, DetectedLogo, DetectedObject, DetectedRegion, LayoutAnalysis, ReferenceProject } from '../../types';
import type { GrayImage } from '../../ocr/imaging';
import { log } from '../../utils/logger';
import { id } from '../../utils/hash';
import { detectObjects, objectsToRegions } from './objectDetector';
import { detectFaces, getAllFaces } from './faceDetector';
import { detectLogo } from './logoDetector';
import { analyzeLayout, computeOverallConfidence } from './layoutAnalyzer';

export interface DetectionResults {
  objects: DetectedObject[];
  faces: DetectedFace[];
  logos: DetectedLogo[];
  layout: LayoutAnalysis;
}

/**
 * Run all Phase 3 detectors on the poster preview.
 * Each detector wraps its failures, never throws.
 */
export async function runFullDetection(
  gray: GrayImage,
  existingTextRegions: DetectedRegion[]
): Promise<DetectionResults> {
  let objects: DetectedObject[] = [];
  let faces: DetectedFace[] = [];
  let logos: DetectedLogo[] = [];

  try {
    objects = await detectObjects(gray);
    log('info', 'detection', `Found ${objects.length} objects`);
  } catch (err) {
    log('warn', 'detection', `Object detection failed: ${String(err)}`);
  }

  try {
    faces = await detectFaces(gray);
    if (faces.length === 0 && objects.length > 0) {
      faces = getAllFaces(gray, objects);
    }
    log('info', 'detection', `Found ${faces.length} faces`);
  } catch (err) {
    log('warn', 'detection', `Face detection failed: ${String(err)}`);
  }

  try {
    logos = detectLogo(gray, existingTextRegions);
    log('info', 'detection', `Found ${logos.length} logo candidates`);
  } catch (err) {
    log('warn', 'detection', `Logo detection failed: ${String(err)}`);
  }

  const filteredObjects = objectsToRegions(objects, faces.map(f => f.bounds));

  const layout = analyzeLayout(gray, existingTextRegions, faces, logos, filteredObjects);

  return { objects: filteredObjects, faces, logos, layout };
}

/**
 * Convert detection results to DetectedRegion[] entries
 * and merge them into the project's region list.
 */
export function detectionToRegions(
  results: DetectionResults,
  existingTextRegions: DetectedRegion[]
): DetectedRegion[] {
  const newRegions: DetectedRegion[] = [];

  for (const face of results.faces) {
    newRegions.push({
      id: id('face'),
      kind: 'face',
      bounds: face.bounds,
      confidence: face.confidence,
      replace: false,
      notes: `Face detected (conf ${face.confidence}%)`
    });
  }

  for (const logo of results.logos) {
    newRegions.push({
      id: id('logo'),
      kind: 'logo',
      bounds: logo.bounds,
      confidence: logo.confidence,
      semanticRole: 'school_logo',
      replace: true,
      notes: `Logo via ${logo.method}`
    });
  }

  for (const obj of results.objects) {
    newRegions.push({
      id: id('obj'),
      kind: obj.label === 'person' ? 'person' : 'unknown',
      bounds: obj.bounds,
      confidence: obj.confidence,
      replace: false,
      notes: `Detected ${obj.label}`
    });
  }

  return newRegions;
}

/**
 * Select the reconstruction mode and compute overall confidence
 * after all detection phases complete.
 */
export function finalizeProjectAnalysis(
  project: ReferenceProject,
  textRegions: DetectedRegion[],
  detectionResults: DetectionResults
): ReferenceProject {
  const updated = { ...project };
  const overallConf = computeOverallConfidence(
    detectionResults.layout,
    updated.overallConfidence
  );
  return {
    ...updated,
    status: 'analyzed',
    mode: detectionResults.layout.recommendedMode,
    overallConfidence: overallConf,
    regions: [
      ...textRegions,
      ...detectionToRegions(detectionResults, textRegions)
    ],
    failedElements: [...updated.failedElements]
  };
}
