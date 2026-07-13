import type { GenerationResult, PosterData, TemplateManifest, ClassifiedLayer, LayoutValidationResult } from '../types';
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

export async function generatePoster(
  manifest: TemplateManifest,
  data: PosterData,
  onProgress?: (m: string, p: number) => void
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
