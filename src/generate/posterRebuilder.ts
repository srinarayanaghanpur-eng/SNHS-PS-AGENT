import type { DetectedRegion, ReconstructionMode, ReferenceProject } from '../types';
import { log } from '../utils/logger';
import { PluginError } from '../utils/errors';
import { saveProject } from '../project/projectStore';
import { reopenReference } from '../ingest/posterUpload';
import { getProfileMediaPath } from '../profile/schoolProfile';
import { psRunJsx, psCreateDocument, psAddGroup, psAddTextLayer, psPlaceImage, psReadLayers, psSavePng, psSaveJpeg, psSavePsd } from '../bridge/apiClient';
import { buildBrandingPlan, type BrandingPlan } from './brandingPlan';
import { runQualityControl, type PlacedElement, type QCReport } from './qualityControl';
import { generateJsx } from '../utils/jsxBuilder';
import type { ExportFormat } from '../types';

export interface RebuildResult {
  mode: ReconstructionMode;
  qc: QCReport;
  exports: string[];
  placed: PlacedElement[];
}

export function chooseMode(project: ReferenceProject): ReconstructionMode {
  if (project.mode === 'safe') return 'safe';
  const textRegions = project.regions.filter(r => r.kind === 'text');
  if (!textRegions.length) return 'safe';
  if (project.overallConfidence >= 75 && textRegions.every(r => r.confidence >= 50)) return 'full';
  if (project.overallConfidence >= 45) return 'hybrid';
  return 'safe';
}

const GROUP_ORDER = ['01_BACKGROUND', '02_DECORATIONS', '03_MAIN_IMAGES', '04_STUDENT_PHOTOS',
  '05_EVENT_TEXT', '06_SCHOOL_BRANDING', '07_CONTACT_DETAILS', '08_EFFECTS', '09_FOOTER'];

function generateRebuildJsx(project: ReferenceProject, mode: ReconstructionMode, plan: BrandingPlan): string {
  const lines: string[] = [];
  lines.push(`var doc = app.activeDocument;`);

  if (mode === 'full') {
    lines.push(`try {`);
    lines.push(`  var refGroup = doc.layerSets.add();`);
    lines.push(`  refGroup.name = "REFERENCE_DO_NOT_EXPORT";`);
    lines.push(`  if (doc.layers.length > 0) {`);
    lines.push(`    var bg = doc.layers[doc.layers.length - 1];`);
    lines.push(`    bg.move(refGroup, ElementPlacement.INSIDE);`);
    lines.push(`  }`);
    lines.push(`  refGroup.visible = false;`);
    lines.push(`} catch(e) { $.writeln("WARN:refGroup " + e); }`);
  }

  lines.push(`var rasterLayer = doc.artLayers.add();`);
  lines.push(`rasterLayer.name = "${mode === 'hybrid' || mode === 'safe' ? 'HYBRID_CLEAN_BASE' : 'Recreated Background'}";`);
  lines.push(`$.writeln("BASE_LAYER:" + rasterLayer.id);`);

  const groupIds: string[] = [];
  for (const g of GROUP_ORDER.filter(g => g !== '01_BACKGROUND')) {
    const v = g.replace(/"/g, '\\"');
    lines.push(`var g_${g.replace(/[^a-z0-9]/gi, '_')} = doc.layerSets.add();`);
    lines.push(`g_${g.replace(/[^a-z0-9]/gi, '_')}.name = "${v}";`);
    groupIds.push(g);
  }

  const profile = project.profileSnapshot;
  for (const t of plan.texts) {
    const font = profile.preferredFonts[0] || 'Arial';
    lines.push(`try {`);
    lines.push(`  var tl = doc.artLayers.add();`);
    lines.push(`  tl.kind = LayerKind.TEXT;`);
    lines.push(`  tl.name = "${t.name.replace(/"/g, '\\"')}";`);
    lines.push(`  var ti = tl.textItem;`);
    lines.push(`  ti.contents = "${(t.fit?.lines?.join('\\n') || t.text || '').replace(/"/g, '\\"')}";`);
    lines.push(`  ti.font = "${font}";`);
    lines.push(`  ti.size = ${t.fit?.fontSize || 24};`);
    lines.push(`  ti.position = Array(${t.box?.left || 0}, ${t.box?.top || 0});`);
    const groupName = t.group?.replace(/[^a-z0-9]/gi, '_') || '';
    if (groupName && groupIds.includes(t.group || '')) {
      lines.push(`  tl.move(g_${groupName}, ElementPlacement.INSIDE);`);
    }
    lines.push(`  $.writeln("TEXT_LAYER:" + tl.id);`);
    lines.push(`} catch(e) { $.writeln("WARN:text " + e); }`);
  }

  for (const im of plan.images) {
    const logoFile = profile.media[im.mediaRole]?.[0];
    if (!logoFile) continue;
    const imgPath = `C:\\\\path\\\\to\\\\${logoFile}`;
    lines.push(`try {`);
    lines.push(`  var f = new File("${imgPath}");`);
    lines.push(`  if (f.exists) {`);
    lines.push(`    var desc = new ActionDescriptor();`);
    lines.push(`    desc.putPath(charIDToTypeID("null"), f);`);
    lines.push(`    executeAction(stringIDToTypeID("placeEvent"), desc, DialogModes.NO);`);
    lines.push(`    app.activeDocument.activeLayer.name = "${im.name.replace(/"/g, '\\"')}";`);
    const gName = im.group?.replace(/[^a-z0-9]/gi, '_') || '';
    if (gName && groupIds.includes(im.group || '')) {
      lines.push(`    app.activeDocument.activeLayer.move(g_${gName}, ElementPlacement.INSIDE);`);
    }
    lines.push(`  }`);
    lines.push(`} catch(e) { $.writeln("WARN:image " + e); }`);
  }

  lines.push(`$.writeln("REBUILD_DONE");`);
  return lines.join('\n');
}

export async function generateFromReference(
  project: ReferenceProject,
  exportFolder: string,
  onProgress?: (message: string, percent: number) => void,
  formats: ExportFormat[] = ['psd', 'png', 'jpeg', 'pdf']
): Promise<RebuildResult> {
  if (project.status !== 'analyzed' && project.regions.length === 0)
    throw new PluginError('NOT_ANALYZED', 'Run Analyze Text (OCR) before generating.', 'Click Analyze Text (OCR) on the project first.');
  if (!exportFolder)
    throw new PluginError('NO_EXPORT_FOLDER', 'Choose an export folder.', 'Pick a folder to receive the PSD/PNG/JPG exports.');

  let p = await saveProject({ ...project, status: 'generating' });
  let mode = chooseMode(p);

  for (let attempt = 0; attempt < 2; attempt++) {
    onProgress?.(`Building (${mode} mode)…`, 10);
    const plan = buildBrandingPlan(p);
    const placed: PlacedElement[] = [];

    try {
      onProgress?.('Opening reference in Photoshop…', 15);
      const reOpened = await reopenReference(p);
      p = reOpened;

      onProgress?.('Creating duplicate for rebuild…', 25);
      const jsx = generateRebuildJsx(p, mode, plan);
      const result = await psRunJsx(jsx);

      const baseMatch = result.stdout?.match(/BASE_LAYER:(\d+)/);
      if (baseMatch) placed.push({ kind: 'raster-base', name: 'Background', left: 0, top: 0, width: p.reference.width, height: p.reference.height, ok: true });

      const textMatches = result.stdout?.match(/TEXT_LAYER:(\d+)/g) || [];
      for (const t of plan.texts) {
        placed.push({ kind: 'text', name: t.name, left: t.box?.left || 0, top: t.box?.top || 0, width: t.box?.width || 0, height: t.box?.height || 0, ok: true, fit: t.fit, content: t.text });
      }

      onProgress?.('Quality control…', 80);
      const qc = runQualityControl(p, placed, { width: p.reference.width, height: p.reference.height }, p.regions);

      if (!qc.pass && attempt === 0) {
        mode = mode === 'full' ? 'hybrid' : 'safe';
        log('warn', 'posterRebuilder', `QC failed (${qc.criticalCount} critical) — retrying in ${mode} mode`);
        continue;
      }

      onProgress?.('Exporting…', 88);
      let exports: string[] = [];
      try {
        const baseName = `SNHS_${p.name}`.replace(/[^\w-]+/g, '_');
        for (const format of formats) {
          const ext = format === 'jpeg' ? '.jpg' : format === 'pdf' ? '.png' : `.${format}`;
          const filePath = `${exportFolder}/${baseName}_${mode}${ext}`;
          if (format === 'psd') await psSavePsd(filePath);
          else if (format === 'jpeg') await psSaveJpeg(filePath, 11);
          else if (format === 'png') await psSavePng(filePath);
          else if (format === 'pdf') await psSavePng(filePath.replace(/\.pdf$/, '.png'));
          exports.push(filePath);
        }
      } catch (err) {
        p.failedElements.push({ stage: 'export', message: String(err), recovered: false });
      }

      p = await saveProject({
        ...p, mode, status: qc.pass && exports.length ? 'generated' : 'failed',
        exports: [...p.exports, ...exports]
      });
      onProgress?.(qc.pass ? `Done — ${exports.length} files exported` : 'Completed with unresolved critical issues', 100);
      return { mode, qc, exports, placed };
    } catch (err) {
      await saveProject({ ...p, status: 'analyzed', failedElements: [...p.failedElements, { stage: 'photoshop', message: String(err), recovered: false }] });
      throw new PluginError('PS_BUILD_FAILED', `Photoshop build failed: ${String(err)}`, 'The analysis is saved — fix Photoshop and click Generate again (no re-analysis needed).');
    }
  }
  throw new PluginError('GENERATION_FAILED', 'Generation could not complete.', 'Check the error logs and retry.');
}
