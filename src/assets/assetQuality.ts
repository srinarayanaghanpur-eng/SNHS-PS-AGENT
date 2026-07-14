import type { OnlineAssetResult, SearchIntent } from '../types';
import { log } from '../utils/logger';

const WATERMARK_PATTERNS = [
  /watermark/i, /shutterstock/i, /istock/i, /getty.?images/i,
  /adobe.?stock/i, /123rf/i, /dreamstime/i, /depositphotos/i,
  /canstock/i, /alamy/i, /fotolia/i, /bigstock/i,
  /^[a-z0-9._-]+\.com\/(watermark|stock)/i
];

const COPYRIGHT_PATTERNS = [
  /©/i, /copyright/i, /all rights reserved/i, /®/i, /™/i
];

const LOW_RES_THRESHOLD = 300;

const INAPPROPRIATE_PATTERNS = [
  /nudity/i, /violence/i, /weapon/i, /drug/i, /alcohol/i,
  /nsfw/i, /adult/i, /explicit/i
];

const SOCIAL_MEDIA_PATTERNS = [
  /instagram/i, /facebook/i, /twitter/i, /whatsapp/i, /tiktok/i,
  /snapchat/i, /social.?media/i, /screenshot/i
];

const TEMPLATE_PATTERNS = [
  /poster.?template/i, /flyer.?template/i, /banner.?template/i,
  /editable.?template/i, /pikbest/i, /freepik/i, /template/i
];

const UNRELATED_ORGANISATION_PATTERNS = [
  /another.?school/i, /other.?institution/i, /competing.?brand/i
];

const POOR_BG_PATTERNS = [
  /jagged/i, /poorly.?removed/i, /rough.?edge/i
];

const MIN_ASSET_WIDTH = 600;
const MIN_ASSET_HEIGHT = 600;

export interface QualityCheckResult {
  passed: boolean;
  score: number;
  reasons: string[];
}

export function checkAssetQuality(
  asset: OnlineAssetResult,
  intent?: SearchIntent
): QualityCheckResult {
  const reasons: string[] = [];
  let score = 100;

  const url = asset.directUrl || '';
  const thumbnailUrl = asset.thumbnailUrl || '';
  const combinedUrl = url + ' ' + thumbnailUrl;
  const tags = (asset.tags || []).join(' ').toLowerCase();
  const combined = combinedUrl.toLowerCase() + ' ' + tags;
  const name = asset.id || '';

  if (WATERMARK_PATTERNS.some(p => p.test(combined) || p.test(name))) {
    score -= 40;
    reasons.push('Watermark detected');
  }

  if (COPYRIGHT_PATTERNS.some(p => p.test(combined))) {
    score -= 30;
    reasons.push('Copyright marking detected');
  }

  if (asset.width > 0 && asset.height > 0) {
    if (asset.width < LOW_RES_THRESHOLD || asset.height < LOW_RES_THRESHOLD) {
      score -= 35;
      reasons.push(`Low resolution: ${asset.width}x${asset.height}`);
    }
    if (asset.width < MIN_ASSET_WIDTH || asset.height < MIN_ASSET_HEIGHT) {
      score -= 15;
      reasons.push(`Below minimum dimensions: ${asset.width}x${asset.height}`);
    }
  }

  if (asset.width > 0 && asset.height > 0) {
    const aspectRatio = asset.width / asset.height;
    if (aspectRatio > 4 || aspectRatio < 0.25) {
      score -= 15;
      reasons.push(`Extreme aspect ratio: ${aspectRatio.toFixed(2)}`);
    }
  }

  if (INAPPROPRIATE_PATTERNS.some(p => p.test(combined))) {
    score -= 50;
    reasons.push('Potentially inappropriate content');
  }

  if (SOCIAL_MEDIA_PATTERNS.some(p => p.test(combined))) {
    score -= 25;
    reasons.push('Social media screenshot or branding');
  }

  if (TEMPLATE_PATTERNS.some(p => p.test(combined))) {
    score -= 30;
    reasons.push('Poster template with other organisation branding');
  }

  if (UNRELATED_ORGANISATION_PATTERNS.some(p => p.test(combined))) {
    score -= 30;
    reasons.push('Unrelated organisation branding');
  }

  if (POOR_BG_PATTERNS.some(p => p.test(combined))) {
    score -= 20;
    reasons.push('Poorly removed background');
  }

  if (asset.licence && !/free|cc0|public domain|pixabay|unsplash|pexels/i.test(asset.licence)) {
    if (/rights? managed|editorial|restricted/i.test(asset.licence)) {
      score -= 25;
      reasons.push('Restricted licence');
    }
  }

  if (intent) {
    if (intent.transparencyRequired && asset.fileType !== 'png' && asset.fileType !== 'svg') {
      score -= 10;
      reasons.push('Transparency required but asset is not PNG/SVG');
    }

    if (intent.requiredWidth > 0 && asset.width > 0) {
      if (asset.width < intent.requiredWidth * 0.5) {
        score -= 15;
        reasons.push(`Asset too small (${asset.width}px) for required width (${intent.requiredWidth}px)`);
      }
    }

    if (intent.requiredHeight > 0 && asset.height > 0) {
      if (asset.height < intent.requiredHeight * 0.5) {
        score -= 15;
        reasons.push(`Asset too short (${asset.height}px) for required height (${intent.requiredHeight}px)`);
      }
    }

    if (asset.fileType === 'svg' && intent.transparencyRequired) {
      score += 5;
    }
  }

  if (asset.licence && /cc0|public domain/i.test(asset.licence)) {
    score += 10;
  }

  const passed = score >= 40;
  score = Math.max(0, Math.min(100, score));

  return { passed, score, reasons };
}

export function rankByQuality(
  assets: OnlineAssetResult[],
  intent?: SearchIntent
): OnlineAssetResult[] {
  return assets
    .map(asset => {
      const quality = checkAssetQuality(asset, intent);
      asset.rejected = !quality.passed;
      asset.rejectionReasons = quality.reasons;
      asset.score = quality.score;
      return asset;
    })
    .sort((a, b) => {
      if (a.rejected !== b.rejected) return a.rejected ? 1 : -1;
      return b.score - a.score;
    });
}

export function filterRejected(assets: OnlineAssetResult[]): OnlineAssetResult[] {
  return assets.filter(a => !a.rejected && a.passed !== false);
}

export function selectBestAsset(
  assets: OnlineAssetResult[],
  intent?: SearchIntent
): OnlineAssetResult | null {
  const ranked = rankByQuality(assets, intent);
  const valid = ranked.filter(a => !a.rejected);
  return valid.length > 0 ? valid[0] : null;
}

export function formatAssetLicenceInfo(asset: OnlineAssetResult): string {
  return `${asset.websiteName} | ${asset.licence} | ${asset.width}x${asset.height} | ${asset.downloadDate.slice(0, 10)}`;
}
