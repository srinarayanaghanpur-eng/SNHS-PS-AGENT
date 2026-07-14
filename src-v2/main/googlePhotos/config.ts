// Resolves the Google OAuth "Desktop app" client credentials the Picker
// connector needs. Credentials are read from (in order):
//   1. Environment variables SNHS_GOOGLE_CLIENT_ID / SNHS_GOOGLE_CLIENT_SECRET
//   2. <configured data root>/settings/google-photos/google-oauth.json
//      { "clientId": "...", "clientSecret": "..." }
//
// The client secret for a Google "Desktop app" OAuth client is not a true
// secret (RFC 8252 §8.5) — it is shipped with the installer. We still combine it
// with PKCE so a leaked secret alone cannot complete an authorization.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getStoragePaths } from '../storage';

// Read-only scope for the new Picker API. The deprecated unrestricted Library
// scope (photoslibrary.readonly) is deliberately NOT requested (§19).
export const PHOTOS_PICKER_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';

export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
}

export function configFilePath(): string {
  return join(getStoragePaths().getSettingsDirectory(), 'google-oauth.json');
}

let cached: OAuthClientConfig | null | undefined;

export async function loadOAuthConfig(): Promise<OAuthClientConfig | null> {
  if (cached !== undefined) return cached;
  const envId = process.env.SNHS_GOOGLE_CLIENT_ID?.trim();
  const envSecret = process.env.SNHS_GOOGLE_CLIENT_SECRET?.trim();
  if (envId && envSecret) { cached = { clientId: envId, clientSecret: envSecret }; return cached; }
  try {
    const raw = JSON.parse(await readFile(configFilePath(), 'utf8')) as Partial<OAuthClientConfig>;
    if (raw.clientId && raw.clientSecret) {
      cached = { clientId: String(raw.clientId).trim(), clientSecret: String(raw.clientSecret).trim() };
      return cached;
    }
  } catch { /* not configured yet */ }
  cached = null;
  return cached;
}

// Test hook — clears the memoised config so a new file/env can be picked up.
export function resetOAuthConfigCache(): void { cached = undefined; }

export class GooglePhotosConfigError extends Error {
  constructor() {
    super(
      'Google Photos is not configured. Add your Google OAuth "Desktop app" credentials to ' +
      `${configFilePath()} as {"clientId":"...","clientSecret":"..."} (or set the ` +
      'SNHS_GOOGLE_CLIENT_ID and SNHS_GOOGLE_CLIENT_SECRET environment variables), then reconnect.',
    );
    this.name = 'GooglePhotosConfigError';
  }
}
