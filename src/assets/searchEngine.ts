import type { AssetRole, OnlineAssetResult, SearchIntent } from '../types';
import { log } from '../utils/logger';
import { fnv1a } from '../utils/hash';

interface SearchProvider {
  name: string;
  search(query: string, orientation: string, limit: number): Promise<OnlineAssetResult[]>;
}

const DEFAULT_LIMIT = 20;

function buildSearchQuery(intent: SearchIntent): string {
  const parts: string[] = [];
  const event = intent.event || '';
  const role = intent.requiredRole || '';

  const roleKeywords: Record<string, string> = {
    heroBackground: 'background',
    decorativeOverlay: 'overlay transparent PNG',
    cornerDecoration: 'corner decoration frame PNG',
    academicIcon: 'academic icon illustration',
    festivalIllustration: 'festival decoration illustration',
    texture: 'texture seamless',
    lightEffect: 'light rays effect overlay PNG',
    sectionDivider: 'divider line decorative',
    scheduleIcons: 'schedule icon set',
    patternBackground: 'pattern background',
    frame: 'frame border decorative PNG',
    floralDecoration: 'floral decoration PNG',
    confetti: 'confetti transparent PNG',
    abstractShape: 'abstract shape graphic',
    transparentOverlay: 'overlay transparent PNG'
  };

  if (event) parts.push(event);
  if (roleKeywords[role]) parts.push(roleKeywords[role]);

  const style = intent.preferredStyle || intent.designFamily || '';
  if (style && !parts.some(p => p.toLowerCase().includes(style.toLowerCase()))) {
    parts.push(style);
  }

  const orientationWord = intent.orientation === 'portrait' ? 'vertical' :
    intent.orientation === 'landscape' ? 'horizontal' : 'square';
  parts.push(orientationWord);

  if (intent.transparencyRequired && !parts.some(p => p.toLowerCase().includes('png'))) {
    parts.push('PNG');
  }

  if (intent.transparencyRequired && !parts.some(p => p.toLowerCase().includes('transparent'))) {
    parts.push('transparent');
  }

  if (intent.preferredColours && intent.preferredColours.length > 0) {
    const colourWords = intent.preferredColours.slice(0, 2);
    parts.push(...colourWords);
  }

  parts.push('royalty free');

  if (intent.schoolAgeGroup === 'primary') parts.push('children');
  else if (intent.schoolAgeGroup === 'secondary') parts.push('teen');

  return parts.join(' ');
}

async function searchPixabay(query: string, orientation: string, limit: number): Promise<OnlineAssetResult[]> {
  const results: OnlineAssetResult[] = [];
  try {
    const orient = orientation === 'portrait' ? 'vertical' :
      orientation === 'landscape' ? 'horizontal' : 'all';
    const url = `https://pixabay.com/api/?key=48584830-5eae3f4a3148ebda8c0a5d7e2&q=${encodeURIComponent(query)}&image_type=all&orientation=${orient}&per_page=${limit}&safesearch=true`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.hits && Array.isArray(data.hits)) {
      for (const hit of data.hits) {
        const id = `pixabay_${hit.id}`;
        results.push({
          id,
          sourceUrl: hit.pageURL || '',
          directUrl: hit.largeImageURL || hit.webformatURL || '',
          thumbnailUrl: hit.webformatURL || hit.previewURL || '',
          websiteName: 'Pixabay',
          downloadDate: new Date().toISOString(),
          licence: 'Pixabay License (Free for commercial use, no attribution required)',
          width: hit.imageWidth || hit.webformatWidth || 0,
          height: hit.imageHeight || hit.webformatHeight || 0,
          fileSize: undefined,
          fileType: 'jpg',
          tags: (hit.tags || '').split(',').map((t: string) => t.trim()),
          score: 0,
          rejected: false,
          rejectionReasons: [],
          approved: false,
          favourite: false,
          hidden: false
        });
      }
    }
  } catch (err) {
    log('warn', 'searchEngine', `Pixabay search failed: ${err}`);
  }
  return results;
}

async function searchUnsplash(query: string, orientation: string, limit: number): Promise<OnlineAssetResult[]> {
  const results: OnlineAssetResult[] = [];
  try {
    const orient = orientation === 'portrait' ? 'portrait' :
      orientation === 'landscape' ? 'landscape' : 'squarish';
    const perPage = Math.min(limit, 30);
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=${orient}&per_page=${perPage}&client_id=H4s6l6BAqgJTFXX7NRCOdF7VCP50cLoOHdQz10q7_5U`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.results && Array.isArray(data.results)) {
      for (const hit of data.results) {
        const id = `unsplash_${hit.id}`;
        results.push({
          id,
          sourceUrl: hit.links?.html || '',
          directUrl: hit.urls?.raw || hit.urls?.full || '',
          thumbnailUrl: hit.urls?.thumb || hit.urls?.small || '',
          websiteName: 'Unsplash',
          downloadDate: new Date().toISOString(),
          licence: 'Unsplash License (Free for commercial and non-commercial use)',
          width: hit.width || 0,
          height: hit.height || 0,
          fileSize: undefined,
          fileType: 'jpg',
          tags: (hit.tags || []).map((t: any) => typeof t === 'string' ? t : t.title || ''),
          score: 0,
          rejected: false,
          rejectionReasons: [],
          approved: false,
          favourite: false,
          hidden: false
        });
      }
    }
  } catch (err) {
    log('warn', 'searchEngine', `Unsplash search failed: ${err}`);
  }
  return results;
}

async function searchPexels(query: string, orientation: string, limit: number): Promise<OnlineAssetResult[]> {
  const results: OnlineAssetResult[] = [];
  try {
    const orient = orientation === 'portrait' ? 'portrait' :
      orientation === 'landscape' ? 'landscape' : 'square';
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=${orient}&per_page=${Math.min(limit, 80)}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': 'vpMfK6iYjqJQCDU1QIL5dA2AqQnCB3PKJQHhVpqEjxwPvVvqCG5MI3zK'
      }
    });
    const data = await response.json();
    if (data.photos && Array.isArray(data.photos)) {
      for (const photo of data.photos) {
        const id = `pexels_${photo.id}`;
        results.push({
          id,
          sourceUrl: photo.url || '',
          directUrl: photo.src?.original || photo.src?.large2x || '',
          thumbnailUrl: photo.src?.medium || photo.src?.small || '',
          websiteName: 'Pexels',
          downloadDate: new Date().toISOString(),
          licence: 'Pexels License (Free for commercial and non-commercial use, no attribution required)',
          width: photo.width || 0,
          height: photo.height || 0,
          fileSize: undefined,
          fileType: 'jpg',
          tags: [],
          score: 0,
          rejected: false,
          rejectionReasons: [],
          approved: false,
          favourite: false,
          hidden: false
        });
      }
    }
  } catch (err) {
    log('warn', 'searchEngine', `Pexels search failed: ${err}`);
  }
  return results;
}

async function searchSVGRepo(query: string, _orientation: string, limit: number): Promise<OnlineAssetResult[]> {
  const results: OnlineAssetResult[] = [];
  try {
    const url = `https://api.svgrepo.com/v3/search?query=${encodeURIComponent(query)}&limit=${Math.min(limit, 50)}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        const id = `svgrepo_${item.id || fnv1a(item.title || '')}`;
        const svgUrl = item.image?.svg || item.image || '';
        const pngUrl = item.image?.png || '';
        results.push({
          id,
          sourceUrl: item.url || '',
          directUrl: svgUrl || pngUrl,
          thumbnailUrl: pngUrl || svgUrl,
          websiteName: 'SVGRepo',
          downloadDate: new Date().toISOString(),
          licence: 'Free License (CC Attribution required for some icons)',
          width: item.width || 128,
          height: item.height || 128,
          fileSize: undefined,
          fileType: svgUrl ? 'svg' : 'png',
          tags: item.tags || item.categories || [],
          score: 0,
          rejected: false,
          rejectionReasons: [],
          approved: false,
          favourite: false,
          hidden: false
        });
      }
    }
  } catch (err) {
    log('warn', 'searchEngine', `SVGRepo search failed: ${err}`);
  }
  return results;
}

const providers: SearchProvider[] = [
  { name: 'Pixabay', search: searchPixabay },
  { name: 'Unsplash', search: searchUnsplash },
  { name: 'Pexels', search: searchPexels },
  { name: 'SVGRepo', search: searchSVGRepo }
];

function rankResults(results: OnlineAssetResult[], intent: SearchIntent): OnlineAssetResult[] {
  const colours = intent.preferredColours || intent.colourPalette || [];
  const isTransparent = intent.transparencyRequired;
  const targetArea = intent.requiredWidth * intent.requiredHeight;

  for (const r of results) {
    let score = 50;

    const area = r.width * r.height;
    const aspectRatio = r.width / r.height;
    const targetRatio = intent.requiredWidth / intent.requiredHeight;

    if (area >= targetArea) score += 15;
    else if (area >= targetArea * 0.5) score += 8;
    else score -= 10;

    const ratioDiff = Math.abs(aspectRatio - targetRatio);
    if (ratioDiff < 0.1) score += 15;
    else if (ratioDiff < 0.3) score += 8;
    else if (ratioDiff > 0.5) score -= 5;

    if (isTransparent && (r.fileType === 'png' || r.fileType === 'svg')) score += 10;

    if (r.directUrl) score += 5;

    if (r.licence && /free|cc0|public domain/i.test(r.licence)) score += 10;

    if (colours.length > 0) {
      const colourMatch = colours.some(c => {
        const nameMatch = r.tags.some(t => t.toLowerCase().includes(c.replace('#', '')));
        return nameMatch;
      });
      if (colourMatch) score += 8;
    }

    r.score = score;
  }

  return results.sort((a, b) => b.score - a.score);
}

export async function searchOnlineAssets(
  intent: SearchIntent,
  limit: number = DEFAULT_LIMIT
): Promise<{ results: OnlineAssetResult[]; query: string; engine: string }> {
  const query = buildSearchQuery(intent);
  log('info', 'searchEngine', `Searching for: ${query}`);

  const allResults: OnlineAssetResult[] = [];

  const providerResults = await Promise.allSettled(
    providers.map(p => p.search(query, intent.orientation, limit))
  );

  for (const result of providerResults) {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value);
    }
  }

  const ranked = rankResults(allResults, intent);

  const topResults = ranked.slice(0, Math.min(limit, ranked.length));

  log('info', 'searchEngine', `Found ${allResults.length} results, showing ${topResults.length}`);

  return {
    results: topResults,
    query,
    engine: 'Pixabay+Unsplash+Pexels+SVGRepo'
  };
}

export async function searchWithCustomQuery(
  query: string,
  orientation: 'portrait' | 'landscape' | 'square' = 'portrait',
  limit: number = DEFAULT_LIMIT
): Promise<{ results: OnlineAssetResult[]; query: string; engine: string }> {
  log('info', 'searchEngine', `Custom search: ${query}`);

  const allResults: OnlineAssetResult[] = [];

  const providerResults = await Promise.allSettled(
    providers.map(p => p.search(query, orientation, limit))
  );

  for (const result of providerResults) {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value);
    }
  }

  allResults.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  const topResults = allResults.slice(0, Math.min(limit, allResults.length));

  return {
    results: topResults,
    query,
    engine: 'Pixabay+Unsplash+Pexels+SVGRepo'
  };
}
