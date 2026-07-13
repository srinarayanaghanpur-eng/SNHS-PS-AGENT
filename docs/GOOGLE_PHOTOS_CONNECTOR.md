# Google Photos Asset Connector

Import school branding and daily photos straight from Google Photos using the
official **Google Photos Picker API** — no manual downloading, no deprecated
Library API, and no browser screenshots. Selected images are downloaded as
full-resolution originals, validated, filed by role, and placed into Photoshop
as Smart Objects.

## What it does

| Button | Action |
| --- | --- |
| **Connect Google Photos** | Runs Google OAuth in your real browser (loopback + PKCE). Tokens are stored encrypted (Windows DPAPI via Electron `safeStorage`) and never reach the UI. |
| **Choose School Assets** | Opens the official Picker, lets you select one or more photos, downloads the originals, shows thumbnails, and lets you assign a **role** to each. Permanent branding is saved to the Approved Asset Library; daily photos go to today's job folder. |
| **Add Today's Photos** | Opens the Picker and drops the selected photos straight into today's job folder as activity photos. |
| **Replace Photo from Google Photos** | Picks a single photo and overwrites one Approved-Library slot (logo, chairman, principal, campus, background, …). |
| **Manage Approved Assets** | Lists the permanent branding assets currently saved in the library. |

### Semantic roles

`school logo`, `LEAD logo`, `chairman`, `correspondent`, `principal`,
`student`, `birthday student`, `activity photo`, `campus`, `background`.

Permanent roles (logo/LEAD/chairman/correspondent/principal/campus/background)
are stored in the **Approved Asset Library** (the school brand-kit profile).
`student`, `birthday student` and `activity photo` are stored **only** inside the
current job folder.

## One-time setup — Google OAuth client

The connector needs your own Google OAuth **Desktop app** client:

1. Go to <https://console.cloud.google.com/> → create/select a project.
2. **APIs & Services → Enable APIs** → enable **Photos Picker API**.
3. **APIs & Services → OAuth consent screen** → configure it and add your Google
   account as a **Test user**. Add the scope
   `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID →
   Application type: Desktop app**. Copy the Client ID and Client secret.
5. Provide the credentials to the app in **either** way:
   - Create `Documents/SNHS Smart Poster Agent/Config/google-oauth.json`:
     ```json
     { "clientId": "XXXX.apps.googleusercontent.com", "clientSecret": "YYYY" }
     ```
   - **or** set environment variables `SNHS_GOOGLE_CLIENT_ID` and
     `SNHS_GOOGLE_CLIENT_SECRET` before launching.

> A Desktop-app "client secret" is not a true secret (RFC 8252). It is combined
> with PKCE so it cannot complete an authorization on its own.

## Security & safety guarantees

- Tokens are encrypted at rest and live only in the main process (§18).
- Only the readonly Picker scope is requested; the deprecated unrestricted
  Library scope is never used (§19).
- Every download is validated for MIME type, extension, signature, dimensions
  and integrity before use (§6). The full original bytes are saved — never a
  thumbnail or screenshot (§14).
- When a required asset is missing the app **stops** with a clear message, e.g.
  *"Chairman photo is missing. Select it from Google Photos."* — it never
  substitutes an unrelated image (§15–§17).

## Files

```
src-v2/main/googlePhotos/
  config.ts        OAuth client credentials + Picker scope
  tokenStore.ts    Encrypted token storage (safeStorage)
  oauth.ts         Loopback + PKCE authorization, refresh, getAccessToken
  pickerClient.ts  sessions.create/get/delete, mediaItems.list, byte download
  download.ts      Download + validate + safe unique filename
  imageMeta.ts     Pure dimension/filename helpers (unit-testable)
  roles.ts         Semantic role → Approved-Library slot mapping
  smartObject.ts   Place validated assets into Photoshop as Smart Objects
  service.ts       Orchestration used by the IPC layer
  gp-ipc.ts        IPC handler registration (validated with zod)
src-v2/renderer/GooglePhotos.tsx   The five buttons + role assignment UI
```
