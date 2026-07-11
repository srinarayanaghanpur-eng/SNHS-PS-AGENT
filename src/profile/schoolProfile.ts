import type { ProfileMediaRole, SchoolProfile } from '../types';
import { log } from '../utils/logger';
import { dataDir, readText, writeText, deleteEntry, exists } from '../bridge/apiClient';
import { join } from '../utils/path';

const PROFILE_FILE = 'school-profile.json';
const MEDIA_DIR = 'profile-media';

export const DEFAULT_PROFILE: SchoolProfile = {
  schemaVersion: 1,
  schoolName: 'SRI NARAYANA HIGH SCHOOL',
  shortName: 'SNHS',
  location: 'Ghanpur (M), Jayashankar Bhupalpally District',
  phone: '6300038389',
  altPhones: [],
  email: '',
  website: '',
  academicYear: '2026-27',
  groupName: 'Adarshavani Group of Schools',
  branchName: '',
  curriculum: 'Powered by LEAD',
  brandColors: ['#1a3d7c', '#f5b400', '#ffffff'],
  preferredFonts: ['Montserrat', 'Poppins', 'Arial'],
  footerStyle: 'brand-band',
  preferredLanguages: ['English', 'Telugu'],
  socialMedia: {},
  media: {},
  updatedAt: new Date(0).toISOString()
};

function normalize(raw: any): SchoolProfile {
  const p: SchoolProfile = { ...DEFAULT_PROFILE, ...(raw && typeof raw === 'object' ? raw : {}) };
  p.schemaVersion = 1;
  for (const k of ['altPhones', 'brandColors', 'preferredFonts', 'preferredLanguages'] as const)
    if (!Array.isArray(p[k])) (p as any)[k] = [...DEFAULT_PROFILE[k]];
  if (!p.socialMedia || typeof p.socialMedia !== 'object') p.socialMedia = {};
  if (!p.media || typeof p.media !== 'object') p.media = {};
  for (const k of ['schoolName', 'shortName', 'location', 'phone', 'email', 'website',
    'academicYear', 'groupName', 'branchName', 'curriculum', 'footerStyle'] as const)
    if (typeof p[k] !== 'string') (p as any)[k] = DEFAULT_PROFILE[k];
  return p;
}

async function profilePath(): Promise<string> {
  const base = await dataDir();
  return `${base}/${PROFILE_FILE}`;
}

async function mediaFolderPath(role: ProfileMediaRole): Promise<string> {
  const base = await dataDir();
  const dir = `${base}/${MEDIA_DIR}/${role}`;
  if (!(await exists(dir))) await writeText(`${dir}/.keep`, '');
  return dir;
}

export async function loadProfile(): Promise<SchoolProfile> {
  try {
    const p = await profilePath();
    if (!(await exists(p))) return { ...DEFAULT_PROFILE };
    return normalize(JSON.parse(await readText(p)));
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveProfile(profile: SchoolProfile): Promise<SchoolProfile> {
  const p = normalize(profile);
  p.updatedAt = new Date().toISOString();
  await writeText(await profilePath(), JSON.stringify(p, null, 2));
  log('info', 'saveProfile', 'School profile saved');
  return p;
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export async function addProfileMedia(profile: SchoolProfile, role: ProfileMediaRole): Promise<SchoolProfile> {
  const file = await pickFile('.png,.jpg,.jpeg,.webp');
  if (!file) return profile;
  const folder = await mediaFolderPath(role);
  const fd = new FormData();
  fd.append('dir', folder);
  fd.append('file', file);
  const res = await fetch('/api/fs/upload', { method: 'POST', body: fd });
  const data = await res.json();
  const safe = data.files?.[0]?.name || file.name;
  const list = profile.media[role] ?? [];
  const next = { ...profile, media: { ...profile.media, [role]: list.includes(safe) ? list : [...list, safe] } };
  return saveProfile(next);
}

export async function removeProfileMedia(profile: SchoolProfile, role: ProfileMediaRole, fileName: string): Promise<SchoolProfile> {
  try {
    const folder = await mediaFolderPath(role);
    await deleteEntry(`${folder}/${fileName}`);
  } catch (err) {
    log('warn', 'removeProfileMedia', String(err));
  }
  const next = { ...profile, media: { ...profile.media, [role]: (profile.media[role] ?? []).filter(n => n !== fileName) } };
  return saveProfile(next);
}

export async function getProfileMediaPath(role: ProfileMediaRole, fileName: string): Promise<string | undefined> {
  try {
    const folder = await mediaFolderPath(role);
    const p = `${folder}/${fileName}`;
    if (await exists(p)) return p;
    return undefined;
  } catch { return undefined; }
}
