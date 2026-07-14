// Resolves a saved school profile + per-poster request into the brand data the
// composition engine consumes (school text, colours/fonts, real asset paths,
// management block). Keeps the composer decoupled from storage/schema details.

import type { PosterRequest } from '../../shared/ipc';
import { formatAddress, type SchoolProfile } from '../../shared/brandKit';
import type { BrandAssetsInput, BrandOptions, ComposeInput, ManagementPerson, ResolvedAsset } from '../design/types';
import { validateImageFile } from '../imageValidation';

function toResolved(asset: SchoolProfile['assets'][keyof SchoolProfile['assets']] | undefined): ResolvedAsset | undefined {
  if (!asset) return undefined;
  return { path: asset.path, hasAlpha: asset.hasAlpha, crop: asset.crop };
}

// Only keep assets whose files still exist, so a moved/deleted asset degrades to
// a clean text layout rather than a Photoshop placement failure.
async function usable(asset: ResolvedAsset | undefined): Promise<ResolvedAsset | undefined> {
  if (!asset) return undefined;
  return (await validateImageFile(asset.path)).ok ? asset : undefined;
}

export interface ResolvedBrand {
  school: ComposeInput['school'];
  brand: BrandOptions;
  assets: BrandAssetsInput;
  management: { chairman?: ManagementPerson; principal?: ManagementPerson };
  droppedAssets: string[];
}

export async function resolveBrand(request: PosterRequest, profile: SchoolProfile | null): Promise<ResolvedBrand> {
  const dropped: string[] = [];
  const track = async (label: string, a: ResolvedAsset | undefined): Promise<ResolvedAsset | undefined> => {
    if (!a) return undefined;
    const ok = await usable(a);
    if (!ok) dropped.push(label);
    return ok;
  };

  const school: ComposeInput['school'] = {
    name: request.schoolOverride?.name ?? profile?.name ?? 'Sri Narayana High School',
    address: request.schoolOverride?.address ?? (profile ? formatAddress(profile) : 'Ghanpur (M), Jayashankar Bhupalpally District · PIN 506135'),
    phone: request.schoolOverride?.phone ?? profile?.phone1 ?? '6300038389',
    academicYear: (request.schoolOverride?.academicYear ?? profile?.academicYear)
      ? `Academic Year ${request.schoolOverride?.academicYear ?? profile?.academicYear}` : 'Academic Year 2026–27',
  };

  const b = profile?.branding;
  const brand: BrandOptions = b ? {
    colors: { primary: b.primary, secondary: b.secondary, accent: b.accent, background: b.background },
    headingFont: b.headingFont, bodyFont: b.bodyFont, footerStyle: b.footerStyle,
    logoPlacement: b.logoPlacement, leadPlacement: b.leadPlacement,
    showLead: request.schoolOverride?.showLead ?? b.showLead,
  } : { showLead: request.schoolOverride?.showLead };

  const mainLogo = await track('mainLogo', toResolved(profile?.assets.mainLogo)
    ?? (request.logoPath ? { path: request.logoPath } : undefined));
  const leadLogo = await track('leadLogo', toResolved(profile?.assets.leadLogo));
  const studentPhoto = await track('studentPhoto', toResolved(profile?.assets.studentPhoto));
  const assemblyPhoto = await track('assemblyPhoto', toResolved(profile?.assets.assemblyPhoto));
  const campusPhoto = await track('campusPhoto', toResolved(profile?.assets.campusPhoto));
  const background = await track('background', toResolved(profile?.assets.defaultBackground));
  const assets: BrandAssetsInput = { mainLogo, leadLogo, studentPhoto, assemblyPhoto, campusPhoto, background };

  const resolvePerson = async (
    role: 'chairman' | 'principal', req: PosterRequest['management'],
  ): Promise<ManagementPerson | undefined> => {
    const person = req?.[role];
    if (!person?.show) return undefined;
    const asset = person.assetKey ? await track(`${role}Photo`, toResolved(profile?.assets[person.assetKey])) : undefined;
    return { show: true, asset, name: person.name, designation: person.designation, frame: person.frame, message: person.message };
  };

  return {
    school, brand, assets,
    management: { chairman: await resolvePerson('chairman', request.management), principal: await resolvePerson('principal', request.management) },
    droppedAssets: dropped,
  };
}
