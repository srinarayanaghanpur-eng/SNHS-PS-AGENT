import type { ClassifiedLayer, LayoutIssue, AutoFix, PosterData } from '../types';
import { getLayerBounds } from '../photoshop/layerLookup';
import { psRunJsx } from '../bridge/apiClient';
import { generateJsx } from '../utils/jsxBuilder';
import { fitTextToRegion, readActualBounds } from './textFitEngine';
import { getTextRegionForRole, getSectionForRole, getRegionForSection, calculateSafeArea } from './layoutHelpers';
import { log } from '../utils/logger';

export async function applyAutomaticLayoutFixes(
  docId: number,
  docW: number,
  docH: number,
  issues: LayoutIssue[],
  manifestLayers: ClassifiedLayer[],
  data: PosterData
): Promise<{ fixes: AutoFix[]; remaining: LayoutIssue[] }> {
  const fixes: AutoFix[] = [];
  const remaining: LayoutIssue[] = [];
  const safe = calculateSafeArea(docW, docH);

  for (const issue of issues) {
    let fixed = false;

    if (issue.code === 'OUTSIDE_CANVAS' || issue.code === 'OUTSIDE_SAFE_AREA')
      fixed = await fixOutsideBounds(docId, docW, docH, issue, manifestLayers, safe);
    if (issue.code === 'HEADLINE_OVER_SCHOOL_NAME' || issue.code === 'HEADLINE_OVER_POWERED_BY_LEAD')
      fixed = await fixHeadlineCollision(docId, docW, docH, issue, manifestLayers);
    if (issue.code === 'DUPLICATE_ROLE')
      fixed = await fixDuplicateRole(docId, issue, manifestLayers);
    if (issue.code === 'TEXT_OVER_TEXT')
      fixed = await fixTextOverlap(docId, issue, manifestLayers);
    if (issue.code === 'SMALL_TEXT')
      fixed = await fixSmallText(docId, docW, docH, issue, manifestLayers, data);
    if (issue.code === 'HIDDEN_REQUIRED')
      fixed = await fixHiddenRequired(docId, issue, manifestLayers);
    if (issue.code === 'IMAGE_DISTORTED')
      fixed = await fixImageDistortion(docId, issue, manifestLayers);
    if (issue.code === 'FOOTER_TEXT_OVER_PORTRAIT')
      fixed = await fixFooterCollision(docId, issue, manifestLayers);

    if (fixed) {
      fixes.push({ description: 'Fixed: ' + issue.message, target: issue.layerId ? 'layer:' + issue.layerId : 'layout', success: true });
      log('info', 'autoRepair', 'Fixed: ' + issue.message);
    } else {
      remaining.push(issue);
      log('warn', 'autoRepair', 'Could not fix: ' + issue.message);
    }
  }
  return { fixes, remaining };
}

async function fixOutsideBounds(docId: number, docW: number, docH: number, issue: LayoutIssue, layers: ClassifiedLayer[], safe: { left: number; top: number; right: number; bottom: number }): Promise<boolean> {
  const layer = layers.find(l => l.layerId === issue.layerId);
  if (!layer) return false;
  const section = getSectionForRole(layer.semanticRole);
  const region = getRegionForSection(docW, docH, section);
  const bounds = await getLayerBounds(docId, layer.layerId);
  if (!bounds) return false;
  const layerW = bounds.width, layerH = bounds.height;
  if (layerW <= 0 || layerH <= 0) return false;
  let targetX = region.x + Math.round((region.width - layerW) / 2);
  let targetY = region.y + Math.round((region.height - layerH) / 2);
  targetX = Math.max(safe.left, Math.min(targetX, safe.right - layerW));
  targetY = Math.max(safe.top, Math.min(targetY, safe.bottom - layerH));
  const dx = targetX - bounds.left, dy = targetY - bounds.top;
  await psRunJsx(generateJsx.translateAndScale(layer.layerId, dx, dy, 1));
  return true;
}

async function fixHeadlineCollision(docId: number, docW: number, docH: number, issue: LayoutIssue, layers: ClassifiedLayer[]): Promise<boolean> {
  const headline = layers.find(l => l.semanticRole === 'poster_title' && l.layerId === issue.layerId);
  if (!headline) return false;
  const section = getSectionForRole('poster_title');
  const region = getRegionForSection(docW, docH, section);
  const bounds = await getLayerBounds(docId, headline.layerId);
  if (!bounds) return false;
  const layerW = bounds.width;
  if (layerW <= 0) return false;
  const movedDown = region.y + Math.round(region.height * 0.3);
  const dx = region.x + Math.round((region.width - layerW) / 2) - bounds.left;
  const dy = movedDown - bounds.top;
  await psRunJsx(generateJsx.translateAndScale(headline.layerId, dx, dy, 1));
  return true;
}

async function fixDuplicateRole(docId: number, issue: LayoutIssue, layers: ClassifiedLayer[]): Promise<boolean> {
  const parts = issue.message.split(':');
  if (parts.length < 2) return false;
  const paths = parts[1].trim().split(',').map(p => p.trim());
  if (paths.length <= 1) return false;
  const roleLayers = layers.filter(l => paths.includes(l.path));
  if (roleLayers.length <= 1) return false;
  roleLayers.sort((a, b) => b.confidence - a.confidence);
  const keep = roleLayers[0];
  if (!keep) return false;
  let hidden = 0;
  for (const layer of roleLayers) {
    if (layer.layerId !== keep.layerId) {
      await psRunJsx(generateJsx.setLayerVisibility(layer.layerId, false));
      hidden++;
    }
  }
  return hidden > 0;
}

async function fixTextOverlap(docId: number, issue: LayoutIssue, layers: ClassifiedLayer[]): Promise<boolean> {
  const layer = layers.find(l => l.layerId === issue.layerId);
  if (!layer) return false;
  await psRunJsx(generateJsx.translateAndScale(layer.layerId, 10, 5, 1));
  return true;
}

async function fixSmallText(docId: number, docW: number, docH: number, issue: LayoutIssue, layers: ClassifiedLayer[], data: PosterData): Promise<boolean> {
  const layer = layers.find(l => l.layerId === issue.layerId);
  if (!layer || layer.type !== 'text') return false;
  const value = data.values[layer.semanticRole];
  if (!value) return false;
  const section = getSectionForRole(layer.semanticRole);
  const sectionRegion = getRegionForSection(docW, docH, section);
  const textRegion = getTextRegionForRole(layer.semanticRole, docW, docH, sectionRegion);
  textRegion.minFontSize = Math.max(textRegion.minFontSize - 2, 6);
  await fitTextToRegion(docId, layer, value, textRegion);
  return true;
}

async function fixHiddenRequired(docId: number, issue: LayoutIssue, layers: ClassifiedLayer[]): Promise<boolean> {
  const layer = layers.find(l => l.layerId === issue.layerId);
  if (!layer) return false;
  await psRunJsx(generateJsx.setLayerVisibility(layer.layerId, true));
  return true;
}

async function fixImageDistortion(docId: number, issue: LayoutIssue, layers: ClassifiedLayer[]): Promise<boolean> {
  const layer = layers.find(l => l.layerId === issue.layerId);
  if (!layer) return false;
  const bounds = await getLayerBounds(docId, layer.layerId);
  if (!bounds) return false;
  const imgW = bounds.width, imgH = bounds.height;
  if (imgW <= 0 || imgH <= 0) return false;
  const aspect = imgW / imgH;
  const targetW = Math.min(layer.bounds.width, imgW);
  const targetH = targetW / aspect;
  const scale = Math.min(targetW / imgW, targetH / imgH);
  const centerX = layer.bounds.left + Math.round((layer.bounds.width - imgW * scale) / 2);
  const centerY = layer.bounds.top + Math.round((layer.bounds.height - imgH * scale) / 2);
  const dx = centerX - bounds.left, dy = centerY - bounds.top;
  await psRunJsx(generateJsx.translateAndScale(layer.layerId, dx, dy, scale));
  return true;
}

async function fixFooterCollision(docId: number, issue: LayoutIssue, layers: ClassifiedLayer[]): Promise<boolean> {
  const textLayer = layers.find(l => l.layerId === issue.layerId && l.type === 'text');
  if (!textLayer) return false;
  await psRunJsx(generateJsx.translateAndScale(textLayer.layerId, 0, 30, 1));
  return true;
}
