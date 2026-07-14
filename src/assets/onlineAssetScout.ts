import type {
  AssetRole, OnlineAssetResult, OnlineAssetRequirement,
  SearchIntent, EventMode, SchoolProfile
} from '../types';
import { searchOnlineAssets, searchWithCustomQuery } from './searchEngine';
import { checkAssetQuality, rankByQuality, filterRejected, selectBestAsset } from './assetQuality';
import { cacheAsset, getCachedAsset, isAssetCached, getAssetByUrl } from './assetCache';
import { log } from '../utils/logger';
import { fnv1a } from '../utils/hash';

export interface ScoutConfig {
  autoSelect: boolean;
  maxResults: number;
  showThumbnails: boolean;
}

const DEFAULT_CONFIG: ScoutConfig = {
  autoSelect: false,
  maxResults: 8,
  showThumbnails: true
};

const EVENT_SEARCH_TERMS: Record<string, string[]> = {
  prayer: ['school morning assembly', 'prayer hands', 'sunrise school campus', 'golden light rays', 'academic morning background', 'school assembly silhouette'],
  birthday: ['birthday confetti', 'colourful balloon corner', 'kids birthday abstract background', 'gold sparkle overlay', 'birthday celebration school'],
  achievement: ['achievement award ceremony', 'winner trophy', 'success celebration', 'medal school', 'academic achievement background'],
  dance: ['dance performance stage', 'dance silhouette', 'colourful dance background', 'cultural dance school'],
  karate: ['karate action pose', 'martial arts silhouette', 'karate dojo background', 'sports martial arts'],
  sports: ['sports competition background', 'school sports day', 'athletic track field', 'sports trophy award'],
  examination: ['minimal academic stationery background', 'exam paper pencil illustration', 'formal blue geometric background', 'education line icons'],
  holiday: ['holiday vacation background', 'school holiday celebration', 'festive seasonal background'],
  festival: ['festival celebration background', 'diwali decoration', 'christmas backdrop', 'colourful festival elements'],
  admissions: ['school admissions open', 'welcome students background', 'open house school', 'education enrolment'],
  notice: ['formal notice board background', 'announcement school', 'academic circular background'],
  teacher: ['teachers day background', 'teacher appreciation', 'thank you teacher', 'teacher classroom illustration'],
  special: ['special event celebration', 'celebration background school', 'special assembly backdrop'],
  custom: ['school event background', 'academic design background', 'education abstract background']
};

function buildIntentFromRequirement(
  req: OnlineAssetRequirement,
  mode: EventMode,
  profile: SchoolProfile,
  docWidth: number,
  docHeight: number
): SearchIntent {
  const schoolLevel = profile.schoolName.toLowerCase().includes('primary') ? 'primary' :
    profile.schoolName.toLowerCase().includes('senior') ? 'senior' : 'secondary';

  return {
    posterCategory: mode,
    event: req.searchQuery,
    schoolAgeGroup: schoolLevel as SearchIntent['schoolAgeGroup'],
    designFamily: req.style || 'modern',
    colourPalette: req.preferredColours || profile.brandColors,
    requiredRole: req.role,
    orientation: req.requiredOrientation,
    requiredWidth: req.minimumWidth || docWidth,
    requiredHeight: req.minimumHeight || docHeight,
    transparencyRequired: req.transparencyRequired,
    preferredStyle: req.style,
    preferredColours: req.preferredColours || profile.brandColors.slice(0, 3)
  };
}

export function determineAssetRequirements(
  mode: EventMode,
  docWidth: number,
  docHeight: number,
  existingRoles: AssetRole[]
): OnlineAssetRequirement[] {
  const requirements: OnlineAssetRequirement[] = [];
  const orientation: 'portrait' | 'landscape' | 'square' =
    docHeight > docWidth ? 'portrait' :
    docWidth > docHeight ? 'landscape' : 'square';

  const hasBg = existingRoles.includes('heroBackground');
  const hasOverlay = existingRoles.includes('decorativeOverlay');

  const keywords = EVENT_SEARCH_TERMS[mode] || EVENT_SEARCH_TERMS.custom;

  if (!hasBg) {
    requirements.push({
      role: 'heroBackground',
      searchQuery: keywords[0] || `${mode} background`,
      requiredOrientation: orientation,
      minimumWidth: Math.round(docWidth * 0.8),
      minimumHeight: Math.round(docHeight * 0.8),
      transparencyRequired: false,
      style: 'clean professional',
      preferredColours: []
    });
  }

  if (!hasOverlay && (mode === 'prayer' || mode === 'birthday' || mode === 'festival')) {
    requirements.push({
      role: 'decorativeOverlay',
      searchQuery: keywords[1] || `${mode} decoration transparent`,
      requiredOrientation: orientation,
      minimumWidth: Math.round(docWidth * 0.3),
      minimumHeight: Math.round(docHeight * 0.3),
      transparencyRequired: true,
      style: 'decorative',
      preferredColours: []
    });
  }

  if (mode === 'examination' || mode === 'notice') {
    requirements.push({
      role: 'academicIcon',
      searchQuery: 'education icon academic illustration',
      requiredOrientation: 'square',
      minimumWidth: 128,
      minimumHeight: 128,
      transparencyRequired: true,
      style: 'line art minimal',
      preferredColours: []
    });
  }

  if (mode === 'prayer') {
    requirements.push({
      role: 'lightEffect',
      searchQuery: 'golden light rays overlay transparent',
      requiredOrientation: orientation,
      minimumWidth: Math.round(docWidth * 0.5),
      minimumHeight: Math.round(docHeight * 0.5),
      transparencyRequired: true,
      style: 'warm glowing',
      preferredColours: ['#FFD700', '#FFF8DC']
    });
  }

  if (mode === 'birthday' || mode === 'festival') {
    requirements.push({
      role: 'confetti',
      searchQuery: `${mode === 'birthday' ? 'birthday' : 'festival'} confetti transparent`,
      requiredOrientation: 'square',
      minimumWidth: 400,
      minimumHeight: 400,
      transparencyRequired: true,
      style: 'colourful celebration',
      preferredColours: []
    });
  }

  if (mode === 'admissions') {
    requirements.push({
      role: 'academicIcon',
      searchQuery: 'book pencil school icon education',
      requiredOrientation: 'square',
      minimumWidth: 128,
      minimumHeight: 128,
      transparencyRequired: true,
      style: 'professional academic',
      preferredColours: []
    });
  }

  return requirements;
}

export async function scoutAsset(
  requirement: OnlineAssetRequirement,
  mode: EventMode,
  profile: SchoolProfile,
  docWidth: number,
  docHeight: number,
  config: Partial<ScoutConfig> = {}
): Promise<{
  results: OnlineAssetResult[];
  selected: OnlineAssetResult | null;
  query: string;
}> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const intent = buildIntentFromRequirement(requirement, mode, profile, docWidth, docHeight);

  log('info', 'onlineAssetScout', `Scouting for role: ${requirement.role} (${requirement.searchQuery})`);

  const { results, query } = await searchOnlineAssets(intent, cfg.maxResults * 3);

  const qualified = rankByQuality(results, intent);
  const valid = filterRejected(qualified);
  const topResults = valid.slice(0, cfg.maxResults);

  let selected: OnlineAssetResult | null = null;

  if (topResults.length > 0 && cfg.autoSelect) {
    selected = selectBestAsset(topResults, intent);
  }

  log('info', 'onlineAssetScout',
    `Role: ${requirement.role} | Found: ${results.length} | Valid: ${valid.length} | Selected: ${selected ? 'yes' : 'no'}`);

  return { results: topResults, selected, query };
}

export async function scoutAssetsForPoster(
  mode: EventMode,
  profile: SchoolProfile,
  docWidth: number,
  docHeight: number,
  existingRoles: AssetRole[],
  config: Partial<ScoutConfig> = {}
): Promise<OnlineAssetRequirement[]> {
  const requirements = determineAssetRequirements(mode, docWidth, docHeight, existingRoles);

  for (const req of requirements) {
    const { results, selected, query } = await scoutAsset(req, mode, profile, docWidth, docHeight, config);
    req.searchQuery = query;
    if (selected) {
      req.selectedAssetPath = selected.localCachedPath || selected.directUrl;
      req.sourceUrl = selected.sourceUrl;
      req.licenceStatus = selected.licence;
    }
  }

  return requirements;
}

export async function downloadAndCacheAsset(
  asset: OnlineAssetResult,
  role: AssetRole
): Promise<string | null> {
  try {
    if (asset.localCachedPath) return asset.localCachedPath;

    const existing = await getAssetByUrl(asset.directUrl);
    if (existing) return existing.localCachedPath;

    const response = await fetch(asset.directUrl);
    if (!response.ok) {
      log('warn', 'onlineAssetScout', `Failed to download ${asset.directUrl}: ${response.status}`);
      return null;
    }

    const imageData = await response.arrayBuffer();

    const cached = await cacheAsset(
      asset.directUrl,
      asset.sourceUrl,
      asset.websiteName,
      asset.licence,
      imageData,
      asset.width,
      asset.height,
      asset.fileType,
      asset.tags,
      role
    );

    return cached.localCachedPath;
  } catch (err) {
    log('warn', 'onlineAssetScout', `Download failed for ${asset.id}: ${err}`);
    return null;
  }
}

export function buildOnlineLayerName(role: AssetRole, description: string): string {
  const prefix = 'ONLINE';
  const rolePart = role.replace(/([A-Z])/g, '_$1').toUpperCase();
  const descPart = description
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
    .slice(0, 30);
  return `${prefix}_${rolePart}_${descPart}`;
}

export function generateFallbackQuery(requirement: OnlineAssetRequirement): string {
  const role = requirement.role;
  const roleQueries: Record<string, string> = {
    heroBackground: `${requirement.searchQuery} background royalty free`,
    decorativeOverlay: `${requirement.searchQuery} decoration overlay transparent PNG`,
    cornerDecoration: 'frame corner decoration PNG transparent',
    academicIcon: 'education school icon SVG transparent',
    festivalIllustration: 'festival decoration illustration transparent background',
    texture: 'paper texture subtle background seamless',
    lightEffect: 'light rays glow effect overlay transparent PNG',
    sectionDivider: 'decorative line divider transparent PNG',
    scheduleIcons: 'schedule time icon set transparent',
    patternBackground: 'pattern background seamless geometric',
    frame: 'frame border decorative PNG transparent',
    floralDecoration: 'floral decoration corner PNG transparent',
    confetti: 'confetti celebration overlay transparent PNG',
    abstractShape: 'abstract shape graphic design modern',
    transparentOverlay: 'transparent overlay PNG design element'
  };

  return roleQueries[role] || `${role.replace(/([A-Z])/g, ' $1').toLowerCase()} design asset`;
}
