// Visible Chrome controller (Playwright).
//
// Drives a VISIBLE, agent-controlled Chrome window with a SEPARATE persistent
// profile stored under the app data directory (§ Visible Chrome workflow). It
// prefers installed Google Chrome via the Playwright 'chrome' channel and falls
// back to bundled Chromium, reporting which was used. It NEVER reuses the user's
// personal Chrome profile.
//
// Playwright is an optional dependency: it is required only when the user asks
// the assistant to search the web for an asset. It is loaded lazily so the core
// application builds and runs without it; if it is not installed we surface a
// clear, recoverable error instead of crashing.

import { join } from 'node:path';
import { app } from 'electron';
import { log } from '../logger';

export interface BrowserLaunch {
  ok: boolean;
  channel: 'chrome' | 'chromium';
  reason?: string;
  context?: unknown; // Playwright BrowserContext (kept opaque to avoid a hard dep type)
}

export interface Candidate {
  thumbnailUrl: string;
  fullUrl: string;
  width?: number;
  height?: number;
  source: string;
  license?: string;
  pageUrl?: string;
}

function profileDir(): string {
  // Dedicated profile inside app data — never the user's personal Chrome data.
  return join(app.getPath('userData'), 'assistant-browser-profile');
}

async function loadPlaywright(): Promise<any | null> {
  try {
    // Indirect require so bundlers/tsc don't hard-fail when the dep is absent.
    const mod = await import(/* webpackIgnore: true */ 'playwright' as any).catch(() => null);
    return mod;
  } catch { return null; }
}

export async function launchVisibleBrowser(): Promise<BrowserLaunch> {
  const playwright = await loadPlaywright();
  if (!playwright) {
    return { ok: false, channel: 'chromium', reason: 'Playwright is not installed. Run: npm i playwright && npx playwright install chrome' };
  }
  const userDataDir = profileDir();
  // Prefer installed Google Chrome.
  try {
    const context = await playwright.chromium.launchPersistentContext(userDataDir, {
      channel: 'chrome', headless: false, viewport: { width: 1280, height: 800 },
    });
    log('INFO', 'design-assistant.browser.launch', { channel: 'chrome' });
    return { ok: true, channel: 'chrome', context };
  } catch (chromeError) {
    log('WARN', 'design-assistant.browser.chrome-failed', { message: (chromeError as Error).message });
    // Fall back to bundled Chromium and clearly report it.
    try {
      const context = await playwright.chromium.launchPersistentContext(userDataDir, {
        headless: false, viewport: { width: 1280, height: 800 },
      });
      return { ok: true, channel: 'chromium', reason: 'Google Chrome could not be launched; using bundled Chromium.', context };
    } catch (chromiumError) {
      return { ok: false, channel: 'chromium', reason: `Browser launch failed: ${(chromiumError as Error).message}` };
    }
  }
}

// Scrape candidate thumbnails from an Openverse results page (licence-safe).
// Returns 6–12 candidates. This is the visible-browser fallback path; the
// primary path uses provider APIs in asset-scout.
export async function collectCandidates(context: any, searchUrl: string, max = 12): Promise<Candidate[]> {
  const page = await context.newPage();
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  // Best-effort DOM harvest of <img> with usable src; caller filters/validates.
  const raw: Candidate[] = await page.evaluate((m: number) => {
    const imgs = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
    const out: any[] = [];
    for (const img of imgs) {
      const src = img.currentSrc || img.src;
      if (!src || !/^https?:/.test(src)) continue;
      if ((img.naturalWidth || img.width) < 200) continue;
      out.push({ thumbnailUrl: src, fullUrl: src, width: img.naturalWidth || undefined, height: img.naturalHeight || undefined, source: location.hostname, pageUrl: location.href });
      if (out.length >= m) break;
    }
    return out;
  }, max);
  return raw.slice(0, max);
}

export async function closeBrowser(context: any): Promise<void> {
  try { await context?.close?.(); } catch { /* ignore */ }
}
