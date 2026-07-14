import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ReferenceAnalysis, ReferenceSceneGraph, ContentMap, RequiredAssetsChecklist,
  AccuracyReport, ReconstructionJob, UserCorrection, GenerationMode,
  RecreationStrength, NormalizedRect, DetectedRegion, RoleMapping, SlotRole,
} from './referenceTypes';
import { analyseReference, getCanvasDimensions, type AnalysisResult } from './referenceAnalyzer';
import { buildSceneGraph } from './referenceSceneGraph';
import { buildRequiredChecklist, mapContent, type ReplacementContent } from './referenceContentMapper';
import { computeAccuracyReport, type MetricInput } from './referenceMetrics';
import { renderCompareRevise } from './referenceRenderer';
import type { Plan, PlanGroup, PlanNode } from '../types';

export interface ReconstructionRequest {
  mode: GenerationMode;
  strength: RecreationStrength;
  referencePath: string;
  content: ReplacementContent;
  outputDir: string;
  referenceWidth?: number;
  referenceHeight?: number;
}

export interface ReconstructionResponse {
  jobId: string;
  analysis: ReferenceAnalysis;
  sceneGraph: ReferenceSceneGraph;
  contentMap: ContentMap;
  checklist: RequiredAssetsChecklist;
  accuracyReport: AccuracyReport;
  plan: Plan;
  psdJsx: string;
  warnings: string[];
}

function detectRoleFromMapping(role: SlotRole): 'image' | 'text' | 'shape' | 'gradient' | 'group' {
  switch (role) {
    case 'schoolLogo':
    case 'chairmanPortrait':
    case 'principalPortrait':
    case 'managementPortrait':
    case 'heroPhoto':
    case 'supportingPhoto':
    case 'programmePhoto':
    case 'leadLogo':
    case 'groupBranding':
    case 'backgroundImage':
      return 'image';
    case 'schoolName':
    case 'schoolAddress':
    case 'eventTitle':
    case 'posterDate':
    case 'posterDay':
    case 'quote':
    case 'message':
    case 'footerPhone':
    case 'footerAddress':
    case 'footerYear':
    case 'footerLeadBranding':
    case 'prayerContent':
    case 'programmeList':
      return 'text';
    case 'background':
    case 'decorativeShape':
    case 'divider':
    case 'border':
    case 'topAccentEdge':
      return 'shape';
    default:
      return 'shape';
  }
}

function mappingToPlanNode(
  mapping: RoleMapping,
  referenceBounds: NormalizedRect,
  canvasW: number,
  canvasH: number,
  _analysis: ReferenceAnalysis,
): PlanNode | null {
  const b = {
    x: Math.round(referenceBounds.x * canvasW),
    y: Math.round(referenceBounds.y * canvasH),
    w: Math.round(referenceBounds.width * canvasW),
    h: Math.round(referenceBounds.height * canvasH),
  };

  const nodeType = detectRoleFromMapping(mapping.referenceRole);

  if (nodeType === 'text' && mapping.replacementContent) {
    return {
      kind: 'text',
      name: mapping.referenceSlot,
      content: mapping.replacementContent,
      rect: b,
      font: 'Arial-BoldMT',
      size: Math.round(b.h * 0.7),
      minSize: 10,
      maxLines: 3,
      hex: '000000',
      align: 'center',
    };
  }

  if (nodeType === 'image' && mapping.replacementAsset) {
    return {
      kind: 'photo',
      name: mapping.referenceSlot,
      rect: b,
      path: mapping.replacementAsset,
      mask: 'rounded',
      radius: Math.round(Math.min(b.w, b.h) * 0.04),
      fit: 'cover',
      focusY: 0.38,
    };
  }

  if (nodeType === 'shape') {
    return {
      kind: 'rect',
      name: mapping.referenceSlot,
      rect: b,
      hex: 'CCCCCC',
      opacity: 50,
    };
  }

  return null;
}

function analysisToPlan(
  analysis: ReferenceAnalysis,
  contentMap: ContentMap,
): Plan {
  const CW = analysis.canvas.width;
  const CH = analysis.canvas.height;
  const groups: PlanGroup[] = [];

  const namedGroups: Record<string, PlanGroup> = {
    '00_REFERENCE_GUIDES': { name: '00_REFERENCE_GUIDES', nodes: [] },
    '01_BACKGROUND': { name: '01_BACKGROUND', nodes: [] },
    '02_HEADER': { name: '02_HEADER', nodes: [] },
    '03_SCHOOL_LOGO': { name: '03_SCHOOL_LOGO', nodes: [] },
    '04_SCHOOL_NAME': { name: '04_SCHOOL_NAME', nodes: [] },
    '05_CHAIRMAN': { name: '05_CHAIRMAN', nodes: [] },
    '06_EVENT_TITLE': { name: '06_EVENT_TITLE', nodes: [] },
    '07_HERO_PHOTO': { name: '07_HERO_PHOTO', nodes: [] },
    '08_SUPPORTING_PHOTOS': { name: '08_SUPPORTING_PHOTOS', nodes: [] },
    '09_QUOTE': { name: '09_QUOTE', nodes: [] },
    '10_PROGRAMME_GALLERY': { name: '10_PROGRAMME_GALLERY', nodes: [] },
    '11_FOOTER': { name: '11_FOOTER', nodes: [] },
    '12_GROUP_BRANDING': { name: '12_GROUP_BRANDING', nodes: [] },
    '13_LEAD_LOGO': { name: '13_LEAD_LOGO', nodes: [] },
    '14_CONTACT_DETAILS': { name: '14_CONTACT_DETAILS', nodes: [] },
    '15_DECORATIONS': { name: '15_DECORATIONS', nodes: [] },
  };

  namedGroups['01_BACKGROUND'].nodes.push({
    kind: 'rect',
    name: 'BG_BASE',
    rect: { x: 0, y: 0, w: CW, h: CH },
    hex: analysis.canvas.backgroundColour || 'FFFFFF',
  });

  for (const mapping of contentMap.mappings) {
    const referenceRegion = analysis.allRegions.find((r) => r.id === mapping.referenceSlot);
    if (!referenceRegion) continue;

    const node = mappingToPlanNode(mapping, referenceRegion.bounds, CW, CH, analysis);
    if (!node) continue;

    let groupName = '15_DECORATIONS';
    if (mapping.referenceRole === 'schoolLogo') groupName = '03_SCHOOL_LOGO';
    else if (mapping.referenceRole === 'schoolName' || mapping.referenceRole === 'schoolAddress') groupName = '04_SCHOOL_NAME';
    else if (mapping.referenceRole === 'chairmanPortrait' || mapping.referenceRole === 'principalPortrait') groupName = '05_CHAIRMAN';
    else if (mapping.referenceRole === 'eventTitle' || mapping.referenceRole === 'posterDate' || mapping.referenceRole === 'posterDay') groupName = '06_EVENT_TITLE';
    else if (mapping.referenceRole === 'heroPhoto') groupName = '07_HERO_PHOTO';
    else if (mapping.referenceRole === 'supportingPhoto') groupName = '08_SUPPORTING_PHOTOS';
    else if (mapping.referenceRole === 'programmePhoto') groupName = '10_PROGRAMME_GALLERY';
    else if (mapping.referenceRole === 'quote' || mapping.referenceRole === 'message') groupName = '09_QUOTE';
    else if (mapping.referenceRole === 'leadLogo') groupName = '13_LEAD_LOGO';
    else if (mapping.referenceRole === 'footerPhone' || mapping.referenceRole === 'footerAddress' || mapping.referenceRole === 'footerYear' || mapping.referenceRole === 'footerLeadBranding') groupName = '14_CONTACT_DETAILS';
    else if (mapping.referenceRole === 'contactInfoRegion') groupName = '11_FOOTER';
    else if (mapping.referenceRole === 'decorativeShape' || mapping.referenceRole === 'divider' || mapping.referenceRole === 'border' || mapping.referenceRole === 'topAccentEdge') groupName = '15_DECORATIONS';

    if (namedGroups[groupName]) {
      namedGroups[groupName].nodes.push(node);
    }
  }

  for (const _deco of analysis.decorativeShapes) {
    if (namedGroups['15_DECORATIONS']) {
      namedGroups['15_DECORATIONS'].nodes.push({
        kind: 'rect',
        name: `DECO_PRESERVED`,
        rect: { x: 0, y: 0, w: 1, h: 1 },
        hex: '000000',
        opacity: 0,
      });
    }
  }

  for (const key of Object.keys(namedGroups)) {
    groups.push(namedGroups[key]);
  }

  return {
    width: CW,
    height: CH,
    baseHex: analysis.canvas.backgroundColour || 'FFFFFF',
    groups,
    metadata: {
      compositionFamily: 'referenceExactReconstruction',
      rendererName: 'reference-exact-reconstruction',
      legacyRendererUsed: false,
      assetUsage: {
        used: contentMap.mappings.filter((m) => m.replacementAsset).map((m) => m.replacementAsset!),
        missing: [],
        invalid: [],
      },
    },
  };
}

function planToJsx(plan: Plan): string {
  const lines: string[] = [];
  lines.push('// ---- AUTO-GENERATED REFERENCE RECONSTRUCTION ----');
  lines.push(`var doc = app.documents.add(${plan.width}, ${plan.height}, 72, "REFERENCE_RECONSTRUCTION", NewDocumentMode.RGB, DocumentFill.TRANSPARENT);`);

  for (const group of plan.groups) {
    const safeName = group.name.replace(/[^a-zA-Z0-9_]/g, '_');
    lines.push(`var ${safeName}Group = doc.layerSets.add();`);
    lines.push(`${safeName}Group.name = "${group.name}";`);

    for (const node of group.nodes) {
      if (node.kind === 'rect') {
        lines.push(`var shapeLayer = ${safeName}Group.artLayers.add();`);
        lines.push(`shapeLayer.name = "${node.name}";`);
        lines.push([
          `var bounds = [${node.rect.x}, ${node.rect.y}, ${node.rect.x + node.rect.w}, ${node.rect.y + node.rect.h}];`,
        ].join(''));
      } else if (node.kind === 'text' && 'content' in node) {
        lines.push(`var textLayer = ${safeName}Group.artLayers.add();`);
        lines.push(`textLayer.name = "${node.name}";`);
        lines.push(`textLayer.kind = LayerKind.TEXT;`);
        lines.push(`textLayer.textItem.contents = "${(node.content || '').replace(/"/g, '\\"').replace(/\r/g, '\\r')}";`);
        lines.push(`textLayer.textItem.position = [${node.rect.x}, ${node.rect.y + node.rect.h * 0.8}];`);
        lines.push(`textLayer.textItem.size = ${node.size};`);
        lines.push(`textLayer.textItem.font = "${node.font}";`);
      } else if (node.kind === 'photo' && 'path' in node) {
        lines.push(`var photoLayer = ${safeName}Group.artLayers.add();`);
        lines.push(`photoLayer.name = "${node.name}";`);
        lines.push(`var photoFile = File("${node.path.replace(/\\/g, '\\\\')}");`);
        lines.push(`var photoDoc = app.open(photoFile);`);
        lines.push(`photoDoc.selection.selectAll();`);
        lines.push(`photoDoc.selection.copy();`);
        lines.push(`photoDoc.close(SaveOptions.DONOTSAVECHANGES);`);
        lines.push(`doc.selection.select([${node.rect.x}, ${node.rect.y}, ${node.rect.x + node.rect.w}, ${node.rect.y + node.rect.h}]);`);
        lines.push(`doc.paste();`);
        lines.push(`doc.selection.deselect();`);
      }
    }
  }

  lines.push(`doc.saveAs(File(doc.name + ".psd"), new PhotoshopSaveOptions(), true, Extension.LOWERCASE);`);
  lines.push(`// ---- END REFERENCE RECONSTRUCTION ----`);

  return lines.join('\n');
}

export async function runReconstruction(request: ReconstructionRequest): Promise<ReconstructionResponse> {
  const warnings: string[] = [];
  const jobId = `recon_${randomUUID()}`;

  const dims = await getCanvasDimensions(request.referencePath);
  const cw = request.referenceWidth || dims.width;
  const ch = request.referenceHeight || dims.height;

  const analysisResult: AnalysisResult = await analyseReference(request.referencePath, cw, ch);
  warnings.push(...analysisResult.warnings);

  const analysis = analysisResult.analysis;

  const sceneGraph = buildSceneGraph(analysis, request.strength);

  const checklist = buildRequiredChecklist(analysis);

  const contentMap = mapContent(analysis, request.content);

  if (checklist.missingCount > 0) {
    const missingDescriptions = checklist.required
      .filter((r) => !r.provided)
      .map((r) => r.description);
    warnings.push(`Missing assets: ${missingDescriptions.join(', ')}`);
  }

  const plan = analysisToPlan(analysis, contentMap);

  const result = await renderCompareRevise(analysis, sceneGraph, contentMap, 3, request.strength);
  const accuracyReport = result.accuracyReport;

  if (!accuracyReport.accepted) {
    warnings.push(`Reconstruction accuracy ${accuracyReport.overallStructuralAccuracy.toFixed(1)}% — below ${request.strength === 'exact' ? '90%' : '80%'} threshold`);
    for (const failure of accuracyReport.failures) {
      warnings.push(`  - ${failure}`);
    }
  }

  const psdJsx = planToJsx(plan);

  const response: ReconstructionResponse = {
    jobId,
    analysis,
    sceneGraph,
    contentMap,
    checklist,
    accuracyReport,
    plan,
    psdJsx,
    warnings,
  };

  await mkdir(join(request.outputDir, jobId), { recursive: true });
  await writeFile(join(request.outputDir, jobId, 'analysis.json'), JSON.stringify(analysis, null, 2), 'utf8');
  await writeFile(join(request.outputDir, jobId, 'scene-graph.json'), JSON.stringify(sceneGraph, null, 2), 'utf8');
  await writeFile(join(request.outputDir, jobId, 'content-map.json'), JSON.stringify(contentMap, null, 2), 'utf8');
  await writeFile(join(request.outputDir, jobId, 'accuracy-report.json'), JSON.stringify(accuracyReport, null, 2), 'utf8');
  await writeFile(join(request.outputDir, jobId, 'plan.json'), JSON.stringify(plan, null, 2), 'utf8');
  await writeFile(join(request.outputDir, jobId, 'generate.jsx'), psdJsx, 'utf8');

  return response;
}
