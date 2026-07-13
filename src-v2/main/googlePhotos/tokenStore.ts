// Secure at-rest storage for Google OAuth tokens (§18). Tokens are encrypted
// with Electron safeStorage (OS keychain / DPAPI on Windows) and written to a
// binary file under the app's userData folder. Tokens are ONLY ever read inside
// the main process; nothing here is exposed across the IPC bridge, so the
// renderer can never see an access or refresh token.

import { app, safeStorage } from 'electron';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  // epoch ms when the access token stops being valid
  expiresAt: number;
  scope: string;
  tokenType: string;
}

function tokenFilePath(): string {
  return join(app.getPath('userData'), 'google-photos', 'tokens.bin');
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  const path = tokenFilePath();
  await mkdir(dirname(path), { recursive: true });
  const json = Buffer.from(JSON.stringify(tokens), 'utf8');
  // Prefer OS-backed encryption; fall back to a length-prefixed plain blob only
  // if the platform cannot encrypt (rare — keeps dev machines working).
  if (safeStorage.isEncryptionAvailable()) {
    const enc = safeStorage.encryptString(JSON.stringify(tokens));
    await writeFile(path, Buffer.concat([Buffer.from('ENC1'), enc]));
  } else {
    await writeFile(path, Buffer.concat([Buffer.from('RAW1'), json]));
  }
}

export async function loadTokens(): Promise<StoredTokens | null> {
  let buf: Buffer;
  try { buf = await readFile(tokenFilePath()); } catch { return null; }
  try {
    const tag = buf.subarray(0, 4).toString('ascii');
    const body = buf.subarray(4);
    if (tag === 'ENC1') return JSON.parse(safeStorage.decryptString(body)) as StoredTokens;
    if (tag === 'RAW1') return JSON.parse(body.toString('utf8')) as StoredTokens;
    return null;
  } catch { return null; }
}

export async function clearTokens(): Promise<void> {
  await rm(tokenFilePath(), { force: true }).catch(() => undefined);
}
