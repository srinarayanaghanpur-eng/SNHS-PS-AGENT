// Google OAuth 2.0 for a native/desktop app using the loopback-IP redirect and
// PKCE (RFC 8252). The system browser is opened (a real, visible browser window
// — §1/§2) and a short-lived localhost server captures the redirect. Tokens are
// persisted encrypted via tokenStore and never returned to the renderer.

import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { createHash, randomBytes } from 'node:crypto';
import { shell } from 'electron';
import { GooglePhotosConfigError, PHOTOS_PICKER_SCOPE, loadOAuthConfig, type OAuthClientConfig } from './config';
import { clearTokens, loadTokens, saveTokens, type StoredTokens } from './tokenStore';
import { log } from '../logger';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface PkcePair { verifier: string; challenge: string }
function makePkce(): PkcePair {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

const DONE_HTML = (ok: boolean) =>
  `<!doctype html><meta charset="utf-8"><title>SNHS Poster Agent</title>` +
  `<body style="font-family:system-ui;background:#0f1f38;color:#fff;display:grid;place-items:center;height:100vh;margin:0">` +
  `<div style="text-align:center"><h2>${ok ? 'Google Photos connected' : 'Connection cancelled'}</h2>` +
  `<p>You can close this tab and return to SNHS Smart Poster Agent.</p></div></body>`;

// Runs the interactive authorization-code + PKCE exchange. Resolves once tokens
// are stored. Rejects on user cancel, timeout, or Google error.
async function runAuthorizationFlow(cfg: OAuthClientConfig): Promise<StoredTokens> {
  const { verifier, challenge } = makePkce();
  const state = base64url(randomBytes(16));

  return new Promise<StoredTokens>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        if (url.pathname !== '/') { res.writeHead(404).end(); return; }
        const error = url.searchParams.get('error');
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        if (error || !code || returnedState !== state) {
          res.writeHead(400, { 'content-type': 'text/html' }).end(DONE_HTML(false));
          cleanup(); reject(new Error(error ? `GOOGLE_OAUTH_${error.toUpperCase()}` : 'GOOGLE_OAUTH_INVALID_RESPONSE'));
          return;
        }
        const redirectUri = `http://127.0.0.1:${port}`;
        const tokens = await exchangeCode(cfg, code, verifier, redirectUri);
        await saveTokens(tokens);
        res.writeHead(200, { 'content-type': 'text/html' }).end(DONE_HTML(true));
        cleanup(); resolve(tokens);
      } catch (e) {
        try { res.writeHead(500, { 'content-type': 'text/html' }).end(DONE_HTML(false)); } catch { /* ignore */ }
        cleanup(); reject(e instanceof Error ? e : new Error(String(e)));
      }
    });

    let port = 0;
    const timeout = setTimeout(() => { cleanup(); reject(new Error('GOOGLE_OAUTH_TIMEOUT')); }, 5 * 60_000);
    function cleanup() { clearTimeout(timeout); server.close(); }

    server.on('error', (e) => { cleanup(); reject(e); });
    // 127.0.0.1 loopback with an ephemeral port; matches an authorized desktop
    // client which accepts any http://127.0.0.1 / http://localhost redirect.
    server.listen(0, '127.0.0.1', () => {
      port = (server.address() as AddressInfo).port;
      const authUrl = new URL(AUTH_ENDPOINT);
      authUrl.search = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: `http://127.0.0.1:${port}`,
        response_type: 'code',
        scope: PHOTOS_PICKER_SCOPE,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent',
        state,
      }).toString();
      log('INFO', 'google-photos.oauth.open', { port });
      void shell.openExternal(authUrl.toString());
    });
  });
}

async function exchangeCode(cfg: OAuthClientConfig, code: string, verifier: string, redirectUri: string): Promise<StoredTokens> {
  const body = new URLSearchParams({
    client_id: cfg.clientId, client_secret: cfg.clientSecret, code,
    code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: redirectUri,
  });
  const res = await fetch(TOKEN_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || typeof json.access_token !== 'string') {
    throw new Error(`GOOGLE_OAUTH_TOKEN_FAILED: ${json.error ?? res.status} ${json.error_description ?? ''}`.trim());
  }
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
    expiresAt: Date.now() + (typeof json.expires_in === 'number' ? json.expires_in : 3600) * 1000,
    scope: typeof json.scope === 'string' ? json.scope : PHOTOS_PICKER_SCOPE,
    tokenType: typeof json.token_type === 'string' ? json.token_type : 'Bearer',
  };
}

async function refresh(cfg: OAuthClientConfig, tokens: StoredTokens): Promise<StoredTokens> {
  if (!tokens.refreshToken) throw new Error('GOOGLE_OAUTH_NO_REFRESH_TOKEN');
  const body = new URLSearchParams({
    client_id: cfg.clientId, client_secret: cfg.clientSecret,
    refresh_token: tokens.refreshToken, grant_type: 'refresh_token',
  });
  const res = await fetch(TOKEN_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || typeof json.access_token !== 'string') {
    throw new Error(`GOOGLE_OAUTH_REFRESH_FAILED: ${json.error ?? res.status}`);
  }
  const updated: StoredTokens = {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : tokens.refreshToken,
    expiresAt: Date.now() + (typeof json.expires_in === 'number' ? json.expires_in : 3600) * 1000,
    scope: typeof json.scope === 'string' ? json.scope : tokens.scope,
    tokenType: typeof json.token_type === 'string' ? json.token_type : tokens.tokenType,
  };
  await saveTokens(updated);
  return updated;
}

export interface ConnectionStatus { configured: boolean; connected: boolean }

export async function getStatus(): Promise<ConnectionStatus> {
  const cfg = await loadOAuthConfig();
  if (!cfg) return { configured: false, connected: false };
  const tokens = await loadTokens();
  return { configured: true, connected: Boolean(tokens) };
}

// Interactive connect (§1). Idempotent: if already connected with valid tokens
// it returns immediately without opening the browser again.
export async function connect(): Promise<ConnectionStatus> {
  const cfg = await loadOAuthConfig();
  if (!cfg) throw new GooglePhotosConfigError();
  const existing = await loadTokens();
  if (existing) return { configured: true, connected: true };
  await runAuthorizationFlow(cfg);
  return { configured: true, connected: true };
}

export async function disconnect(): Promise<void> { await clearTokens(); }

// Returns a valid bearer access token for main-process API calls, refreshing
// (with a 60s safety margin) when needed. Never call from the renderer.
export async function getAccessToken(): Promise<string> {
  const cfg = await loadOAuthConfig();
  if (!cfg) throw new GooglePhotosConfigError();
  let tokens = await loadTokens();
  if (!tokens) throw new Error('GOOGLE_PHOTOS_NOT_CONNECTED');
  if (Date.now() >= tokens.expiresAt - 60_000) tokens = await refresh(cfg, tokens);
  return tokens.accessToken;
}

// Exposed for unit tests without opening a browser.
export const oauthInternals = { makePkce, base64url, exchangeCode, refresh };
