import type { GenerationResult, PosterData, TemplateManifest, ClassifiedLayer, LayoutValidationResult, AssetRole } from '../types';
import type { PlannedOnlineAsset } from '../generate/brandingPlan';
import { PluginError } from '../utils/errors';
import { log } from '../utils/logger';
import { duplicateActiveDocument } from '../photoshop/documentDuplicator';
import { replaceText } from '../photoshop/textReplacement';
import { replaceImage } from '../photoshop/imageReplacement';
import { arrangeStudentCards } from '../photoshop/groupDuplicator';
import { smartHidePlaceholders } from '../photoshop/layerVisibility';
import { validatePosterLayout } from '../layout/layoutValidator';
import { exportDocument } from '../photoshop/exporter';
import { applySectionLayout } from '../layout/sectionLayoutEngine';
import { applySpacing } from '../layout/spacingEngine';
import { refreshAllBounds } from '../layout/layerBoundsReader';
import { applyAutomaticLayoutFixes } from '../layout/automaticRepairEngine';
import { psPlaceImage, psSetBlendMode, psSetOpacity, psAddGaussianBlur, psAddDropShadow, psAddGradientOverlay, psMoveLayerIntoGroup, psAddGroup } from '../bridge/apiClient';
import { buildOnlineLayerName } from '../assets/onlineAssetScout';

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 70) || 'Poster';

const NON_REPEATABLE = new Set([
  'school_logo', 'school_name', 'school_address', 'school_phone',
  'poster_title', 'event_name', 'event_date', 'event_description',
  'academic_year', 'footer', 'powered_by_lead', 'contact_information'
]);

function selectPrimaryLayers(layers: ClassifiedLayer[]): ClassifiedLayer[] {
  const grouped: Record<string, ClassifiedLayer[]> = {};
  const multiRoleLayers: ClassifiedLayer[] = [];

  for (const layer of layers) {
    if (!NON_REPEATABLE.has(layer.semanticRole) || layer.confidence < 50) {
      multiRoleLayers.push(layer);
      continue;
    }
    if (!grouped[layer.semanticRole]) grouped[layer.semanticRole] = [];
    grouped[layer.semanticRole].push(layer);
  }

  for (const [role, matches] of Object.entries(grouped)) {
    if (matches.length === 1) multiRoleLayers.push(matches[0]);
    else {
      matches.sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return (a.zIndex ?? 0) - (b.zIndex ?? 0);
      });
      multiRoleLayers.push(matches[0]);
      for (let i = 1; i < matches.length; i++) {
        multiRoleLayers.push({ ...matches[i], conflict: true });
        log('warn', 'selectPrimaryLayers', `Multiple layers for "${role}": keeping "${matches[0].path}", hiding "${matches[i].path}"`);
      }
    }
  }
  return multiRoleLayers;
}

function qualityLabel(score: number): 'Excellent' | 'Good' | 'Needs Review' | 'Invalid' {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs Review';
  return 'Invalid';
}

const ONLINE_ASSET_GROUP_MAP: Record<string, string> = {
  heroBackground: '01_ONLINE_BACKGROUND',
  decorativeOverlay: '03_ONLINE_OVERLAYS',
  lightEffect: '03_ONLINE_OVERLAYS',
  confetti: '03_ONLINE_OVERLAYS',
  texture: '02_ONLINE_TEXTURES',
  academicIcon: '08_ONLINE_ICONS',
  scheduleIcons: '08_ONLINE_ICONS',
  cornerDecoration: '04_ONLINE_DECORATIONS',
  festivalIllustration: '04_ONLINE_DECORATIONS',
  floralDecoration: '04_ONLINE_DECORATIONS',
  frame: '04_ONLINE_DECORATIONS',
  sectionDivider: '04_ONLINE_DECORATIONS',
  abstractShape: '04_ONLINE_DECORATIONS',
  patternBackground: '02_ONLINE_TEXTURES',
  transparentOverlay: '03_ONLINE_OVERLAYS'
};

async function placeOnlineAssets(
  docId: number,
  docW: number,
  docH: number,
  onlineAssets: PlannedOnlineAsset[],
  onProgress?: (m: string, p: number) => void
): Promise<void> {
  const groupIds: Record<string, number> = {};

  for (const asset of onlineAssets) {
    onProgress?.(`Placing online asset: ${asset.name}`, 0);
    try {
      const groupName = ONLINE_ASSET_GROUP_MAP[asset.role] || '04_ONLINE_DECORATIONS';

      if (!groupIds[groupName]) {
        const groupResult = await psAddGroup(groupName);
        if (groupResult?.success) {
          const gIdMatch = groupResult.stdout?.match(/LAYER_ID:(\d+)/);
          if (gIdMatch) groupIds[groupName] = parseInt(gIdMatch[1], 10);
        }
      }

      const result = await psPlaceImage(asset.localPath, asset.name);
      if (!result?.success) {
        log('warn', 'posterGenerator', `Failed to place online asset: ${asset.name}`);
        continue;
      }

      const layerIdMatch = result.stdout?.match(/LAYER_ID:(\d+)/);
      if (!layerIdMatch) continue;
      const layerId = parseInt(layerIdMatch[1], 10);

      if (asset.opacity !== 1.0) {
        await psSetOpacity(layerId, Math.round(asset.opacity * 100));
      }

      if (asset.blendMode !== 'normal') {
        await psSetBlendMode(layerId, asset.blendMode);
      }

      const groupId = groupIds[groupName];
      if (groupId) {
        await psMoveLayerIntoGroup(layerId, groupId);
      }

      if (asset.role === 'heroBackground') {
        const maxDim = Math.max(docW, docH);
        if (maxDim > 0) {
          await psAddGaussianBlur(layerId, Math.round(maxDim * 0.005));
        }
        await psSetOpacity(layerId, 60);
      }

      if (asset.role === 'lightEffect') {
        await psSetBlendMode(layerId, 'screen');
        await psSetOpacity(layerId, 35);
      }

      if (asset.role === 'texture') {
        await psSetBlendMode(layerId, 'multiply');
        await psSetOpacity(layerId, 25);
      }

      log('info', 'posterGenerator', `Placed online asset: ${asset.name} (layer ${layerId})`);
    } catch (err) {
      log('warn', 'posterGenerator', `Failed to place ${asset.name}: ${err}`);
    }
  }
}

export async function generatePoster(
  manifest: TemplateManifest,
  data: PosterData,
  onProgress?: (m: string, p: number) => void,
  onlineAssets?: PlannedOnlineAsset[]
): Promise<GenerationResult> {
  if (!data.exportFolder && !data.exportFormats.length) {
    throw new PluginError('NO_EXPORT_FOLDER', 'Choose an export folder.', 'Click Choose Export Folder before generating.');
  }

  const date = data.values.event_date || new Date().toISOString().slice(0, 10);
  const name = 'SNHS_' + slug(data.values.event_name || data.values.poster_title || data.mode) + '_' + slug(date);

  onProgress?.('Duplicating document', 5);
  const docId = await duplicateActiveDocument(name);
  const docW = manifest.documentWidth;
  const docH = manifest.documentHeight;

  const primaryLayers = selectPrimaryLayers(manifest.layers);
  const warnings: any[] = [];
  let finalValidation: LayoutValidationResult | null = null;
  let success = false;

  for (let attempt = 0; attempt < 5; attempt++) {
    onProgress?.('Generation attempt ' + (attempt + 1) + '/5', 15 + attempt * 14);

    for (const layer of primaryLayers) {
      if (layer.conflict) {
        const { setVisibility } = await import('../photoshop/layerVisibility');
        await setVisibility(layer.layerId, false);
        continue;
      }

      const value = data.values[layer.semanticRole];
      const file = data.files[layer.semanticRole];

      if (value && layer.type === 'text') {
        const w = await replaceText(docId, layer, value, docW, docH);
        if (w) warnings.push(w);
      }

      if (file && ['smartObject', 'pixel', 'shape'].includes(layer.type)) {
        const path = file.path || file.entry?.path || file.entry?.name || String(file.entry || '');
        const { replaceImage } = await import('../photoshop/imageReplacement');
        await replaceImage(docId, layer, path);
      }
    }

    onProgress?.('Hiding unused placeholders', 25 + attempt * 14);
    await smartHidePlaceholders(primaryLayers, data);

    onProgress?.('Applying section layout', 30 + attempt * 14);
    await applySectionLayout(docId, docW, docH, primaryLayers);

    onProgress?.('Adjusting spacing', 35 + attempt * 14);
    await applySpacing(docId, docW, docH, primaryLayers);

    onProgress?.('Arranging student cards', 40 + attempt * 14);
    warnings.push(...(await arrangeStudentCards(docId, manifest.layers, data.students)).warnings);

    if (onlineAssets && onlineAssets.length > 0) {
      onProgress?.('Placing online design assets', 45 + attempt * 14);
      await placeOnlineAssets(docId, docW, docH, onlineAssets, onProgress);
    }

    const updatedLayers = await refreshAllBounds(docId, primaryLayers);

    onProgress?.('Validating layout', 80);
    finalValidation = await validatePosterLayout(docW, docH, updatedLayers, manifest, data);

    if (finalValidation.valid && finalValidation.criticalIssueCount === 0) {
      success = true;
      break;
    }

    onProgress?.('Applying layout fixes', 85);
    const fixResult = await applyAutomaticLayoutFixes(docId, docW, docH, finalValidation.issues, primaryLayers, data);
    finalValidation.fixesApplied = fixResult.fixes;
    finalValidation.issues = fixResult.remaining;
  }

  const finalValid = success && finalValidation !== null && finalValidation.valid && finalValidation.criticalIssueCount === 0;

  let exports: string[] = [];
  if (finalValid && data.exportFolder) {
    onProgress?.('Exporting poster', 90);
    const exportPath = data.exportFolder;
    exports = await exportDocument(docId, exportPath, name, data.exportFormats.length ? data.exportFormats : ['png']);
    onProgress?.('Poster complete', 100);
    log('info', 'generation', 'Generated ' + name + ' successfully');
  } else {
    onProgress?.('Layout issues remaining - export blocked', 100);
    log('warn', 'generation', `Export blocked for ${name} - ${finalValidation?.criticalIssueCount ?? '?'} critical issues remain`);
  }

  const quality = finalValidation
    ? { score: finalValidation.score, label: qualityLabel(finalValidation.score), issues: finalValidation.issues.map(i => ({ code: i.code, severity: i.severity as 'error' | 'warning', message: i.message, layerId: i.layerId })) }
    : { score: 0, label: 'Invalid' as const, issues: [] };

  return {
    documentName: name,
    exports,
    quality,
    warnings,
    layoutValidation: finalValidation ?? { valid: false, score: 0, issues: [], fixesApplied: [], criticalIssueCount: 1 }
  };
}
