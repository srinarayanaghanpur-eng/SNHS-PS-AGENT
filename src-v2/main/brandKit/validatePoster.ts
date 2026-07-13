// Pre-generation validation (§9). Returns exactly which required items are
// missing so the renderer can block the Generate button with clear messages.
// Never silently substitutes an image.

import { access, constants } from 'node:fs/promises';
import type { PosterRequest, ValidationIssue, ValidationResult } from '../../shared/ipc';
import { formatAddress, type SchoolProfile } from '../../shared/brandKit';
import { validateImageFile } from '../imageValidation';

async function pathUsable(path: string): Promise<boolean> {
  const check = await validateImageFile(path);
  return check.ok;
}

async function folderWritable(path: string): Promise<boolean> {
  try { await access(path, constants.W_OK); return true; } catch { return false; }
}

// `profile` may be undefined when no profile was selected — that itself is an error.
export async function validatePosterRequest(request: PosterRequest, profile: SchoolProfile | null): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  const add = (field: string, message: string) => issues.push({ field, message });

  if (!request.schoolProfileId) add('schoolProfileId', 'No school profile is selected. Choose a school before generating.');
  if (request.schoolProfileId && !profile) add('schoolProfileId', 'The selected school profile could not be loaded.');

  const name = request.schoolOverride?.name ?? profile?.name ?? '';
  if (!name.trim()) add('schoolName', 'School name is required.');

  const address = request.schoolOverride?.address ?? (profile ? formatAddress(profile) : '');
  if (!address.trim()) add('address', 'School address or location is required.');

  if (!request.details?.trim()) add('date', 'Poster date is required.');

  const hasPrayerContent = Boolean(
    request.message?.trim() ||
    request.prayer && Object.values(request.prayer).some((v) => (Array.isArray(v) ? v.length : typeof v === 'string' ? v.trim() : v)),
  );
  if (!hasPrayerContent) add('prayerContent', 'At least one piece of prayer content (thought, prayer, programme, news…) is required.');

  // Main logo: if branding wants a logo, a valid one must exist (§9).
  const showLogo = request.schoolOverride?.showLead ?? true; // logo always expected unless text-only
  const logoAsset = profile?.assets.mainLogo;
  if (profile && !logoAsset && !request.logoPath) {
    add('mainLogo', 'School logo is enabled but no school logo has been uploaded. Upload a logo or switch to a text-only layout.');
  } else if (logoAsset && !(await pathUsable(logoAsset.path))) {
    add('mainLogo', `The school logo file is missing or unreadable: ${logoAsset.path}`);
  }

  // LEAD logo, when LEAD branding is on.
  if ((request.schoolOverride?.showLead ?? profile?.branding.showLead) && profile?.assets.leadLogo && !(await pathUsable(profile.assets.leadLogo.path))) {
    add('leadLogo', `The LEAD logo file is missing or unreadable: ${profile.assets.leadLogo.path}`);
  }

  // Management photos when enabled.
  for (const [role, person] of [['chairman', request.management?.chairman], ['principal', request.management?.principal]] as const) {
    if (person?.show) {
      const asset = person.assetKey ? profile?.assets[person.assetKey] : undefined;
      // §16/§17: stop and tell the operator exactly what to do — never substitute
      // an unrelated image when a required school asset is unavailable.
      if (!asset) add(`${role}Photo`, `${role[0].toUpperCase() + role.slice(1)} photo is missing. Select it from Google Photos.`);
      else if (!(await pathUsable(asset.path))) add(`${role}Photo`, `The ${role} photo file is missing or unreadable: ${asset.path}`);
    }
  }

  // Student photos: every provided path must exist and be a real image (§9).
  for (const [i, photo] of (request.photos ?? []).entries()) {
    if (!(await pathUsable(photo.path))) add(`photo[${i}]`, `Student photo ${i + 1} is missing, unreadable or not a supported image: ${photo.path}`);
  }

  // Output folder writable when a custom one is given.
  if (request.outputFolder && !(await folderWritable(request.outputFolder))) {
    add('outputFolder', `The output folder is not writable: ${request.outputFolder}`);
  }

  void showLogo;
  return { ok: issues.length === 0, issues };
}
