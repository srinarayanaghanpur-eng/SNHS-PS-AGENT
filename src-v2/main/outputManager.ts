import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { baseFolder } from './storage';
import { generateBaseName, formatDateForFilename, posterTypeFromCategory, shortNameFromSchool, templateShortName, safeFilename } from '../shared/outputNaming';

export interface OutputPaths {
  folderPath: string;
  baseName: string;
  psdPath: string;
  pngPath?: string;
  jpgPath?: string;
  jsonPath: string;
  version: number;
}

function outputsRoot(): string {
  return join(baseFolder(), 'outputs');
}

function yearMonth(date: Date): { year: string; month: string } {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return { year: y, month: m };
}

export async function resolveOutputPaths(
  schoolShortForm: string,
  schoolName: string,
  category: string,
  presetId: string | undefined,
  presetLabel: string | undefined,
  posterDate: Date,
): Promise<OutputPaths> {
  const shortForm = shortNameFromSchool(schoolName, schoolShortForm);
  const pType = posterTypeFromCategory(category);
  const tShort = templateShortName(presetId, presetLabel);
  const base = generateBaseName(shortForm, pType, tShort, posterDate);
  const safeBase = safeFilename(base);
  const { year, month } = yearMonth(posterDate);

  let version = 1;
  const outputRoot = outputsRoot();

  const psdDir = join(outputRoot, 'psd', shortForm, year, month);
  const pngDir = join(outputRoot, 'png', shortForm, year, month);
  const jpgDir = join(outputRoot, 'jpg', shortForm, year, month);

  let existing: string[] = [];
  try { existing = await readdir(psdDir); } catch { }

  const matchPrefix = `${safeBase}_v`;
  const versionedMatch = existing.filter((n) => {
    if (n === `${safeBase}.psd`) return true;
    if (n.startsWith(matchPrefix)) {
      const rest = n.slice(matchPrefix.length).replace(/\.psd$/, '');
      const num = parseInt(rest, 10);
      return !isNaN(num) && String(num) === rest;
    }
    return false;
  });

  if (versionedMatch.length > 0) {
    let maxV = 0;
    for (const n of versionedMatch) {
      if (n === `${safeBase}.psd`) { maxV = Math.max(maxV, 1); continue; }
      const rest = n.slice(matchPrefix.length).replace(/\.psd$/, '');
      const num = parseInt(rest, 10);
      if (!isNaN(num)) maxV = Math.max(maxV, num);
    }
    version = maxV + 1;
  }

  const finalBase = version > 1 ? `${safeBase}_v${version}` : safeBase;

  return {
    folderPath: join(outputRoot, 'psd', shortForm, year, month),
    baseName: finalBase,
    psdPath: join(psdDir, `${finalBase}.psd`),
    pngPath: join(pngDir, `${finalBase}.png`),
    jpgPath: join(jpgDir, `${finalBase}.jpg`),
    jsonPath: join(outputRoot, 'psd', shortForm, year, month, `${finalBase}.json`),
    version,
  };
}

export async function createOutputFolder(paths: OutputPaths): Promise<void> {
  await mkdir(paths.folderPath, { recursive: true });
  if (paths.pngPath) await mkdir(join(paths.pngPath, '..'), { recursive: true });
  if (paths.jpgPath) await mkdir(join(paths.jpgPath, '..'), { recursive: true });
}

export async function copyOutputFile(source: string, dest: string): Promise<void> {
  await copyFile(source, dest);
}
