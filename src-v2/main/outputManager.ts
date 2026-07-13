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

  const dir = join(outputsRoot(), shortForm, year, month, safeBase);
  let version = 1;
  let finalDir = dir;
  let finalBase = safeBase;

  let existing: string[] = [];
  try {
    existing = await readdir(join(outputsRoot(), shortForm, year, month));
  } catch {
    // Directory doesn't exist yet
  }

  const matchPrefix = `${safeBase}_v`;
  const versionedMatch = existing.filter((n) => {
    if (n === safeBase) return true;
    if (n.startsWith(matchPrefix)) {
      const rest = n.slice(matchPrefix.length);
      const num = parseInt(rest, 10);
      return !isNaN(num) && String(num) === rest;
    }
    return false;
  });

  if (versionedMatch.length > 0) {
    let maxV = 0;
    for (const n of versionedMatch) {
      if (n === safeBase) { maxV = Math.max(maxV, 1); continue; }
      const rest = n.slice(matchPrefix.length);
      const num = parseInt(rest, 10);
      if (!isNaN(num)) maxV = Math.max(maxV, num);
    }
    version = maxV + 1;
    if (version === 1) {
      finalDir = dir;
      finalBase = safeBase;
    } else {
      finalBase = `${safeBase}_v${version}`;
      finalDir = join(outputsRoot(), shortForm, year, month, finalBase);
    }
  }

  return {
    folderPath: finalDir,
    baseName: finalBase,
    psdPath: join(finalDir, `${finalBase}.psd`),
    pngPath: join(finalDir, `${finalBase}.png`),
    jpgPath: join(finalDir, `${finalBase}.jpg`),
    jsonPath: join(finalDir, `${finalBase}.json`),
    version: version === 1 ? 1 : version,
  };
}

export async function createOutputFolder(paths: OutputPaths): Promise<void> {
  await mkdir(paths.folderPath, { recursive: true });
}

export async function copyOutputFile(source: string, dest: string): Promise<void> {
  await copyFile(source, dest);
}
