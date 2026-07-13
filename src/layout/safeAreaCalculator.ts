import type { ClassifiedLayer } from '../types';
import { psRunJsx } from '../bridge/apiClient';
import { generateJsx } from '../utils/jsxBuilder';
import { getLayerBounds } from '../photoshop/layerLookup';

export function safeArea(docW: number, docH: number, _manifestLayers?: ClassifiedLayer[]): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
  return calculateSafeArea(docW, docH);
}

export function calculateSafeArea(docW: number, docH: number): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
  const marginPct = 0.05;
  return {
    left: Math.round(docW * marginPct),
    top: Math.round(docH * marginPct),
    right: Math.round(docW * (1 - marginPct)),
    bottom: Math.round(docH * (1 - marginPct)),
    width: Math.round(docW * (1 - 2 * marginPct)),
    height: Math.round(docH * (1 - 2 * marginPct))
  };
}

export function getSectionForRole(role: string): 'header' | 'content' | 'footer' {
  const headerRoles = new Set(['school_logo', 'school_name', 'poster_title', 'event_name', 'academic_year', 'branding']);
  const footerRoles = new Set(['footer', 'powered_by_lead', 'contact_information', 'school_address', 'school_phone', 'email', 'website', 'social_media']);
  if (headerRoles.has(role)) return 'header';
  if (footerRoles.has(role)) return 'footer';
  return 'content';
}

export function getRegionForSection(docW: number, docH: number, section: 'header' | 'content' | 'footer'): { x: number; y: number; width: number; height: number } {
  const safe = calculateSafeArea(docW, docH);
  const headerH = Math.round(docH * 0.20);
  const footerH = Math.round(docH * 0.12);
  if (section === 'header') return { x: safe.left, y: safe.top, width: safe.right - safe.left, height: headerH };
  if (section === 'footer') return { x: safe.left, y: docH - footerH - Math.round(docH * 0.02), width: safe.right - safe.left, height: footerH };
  return { x: safe.left, y: safe.top + headerH, width: safe.right - safe.left, height: safe.bottom - safe.top - headerH - footerH };
}

export async function moveLayerInsideRegion(docId: number, layerId: number, region: { x: number; y: number; width: number; height: number }, align: 'left' | 'center' | 'right'): Promise<void> {
  const bounds = await getLayerBounds(docId, layerId);
  if (!bounds) return;
  const layerW = bounds.width;
  const layerH = bounds.height;
  if (layerW <= 0 || layerH <= 0) return;

  let targetX = region.x;
  if (align === 'center') targetX = region.x + Math.round((region.width - layerW) / 2);
  else if (align === 'right') targetX = region.x + region.width - layerW;

  const targetY = region.y + Math.round((region.height - layerH) / 2);
  const dx = targetX - bounds.left;
  const dy = targetY - bounds.top;
  if (dx !== 0 || dy !== 0) await psRunJsx(generateJsx.translateAndScale(layerId, dx, dy, 1));
}

export async function resizeLayerToFitRegion(docId: number, layerId: number, region: { x: number; y: number; width: number; height: number }, options: { preserveAspect: boolean; maxScale: number }): Promise<void> {
  const bounds = await getLayerBounds(docId, layerId);
  if (!bounds) return;
  const imgW = bounds.width;
  const imgH = bounds.height;
  if (imgW <= 0 || imgH <= 0) return;

  const scaleX = region.width / imgW;
  const scaleY = region.height / imgH;
  const scale = options.preserveAspect ? Math.min(scaleX, scaleY) : Math.min(scaleX, scaleY, options.maxScale);
  const finalScale = Math.min(scale, options.maxScale);

  const newW = imgW * finalScale;
  const newH = imgH * finalScale;
  const centerX = region.x + Math.round((region.width - newW) / 2);
  const centerY = region.y + Math.round((region.height - newH) / 2);

  const dx = centerX - bounds.left;
  const dy = centerY - bounds.top;
  await psRunJsx(generateJsx.translateAndScale(layerId, dx, dy, finalScale));
}
