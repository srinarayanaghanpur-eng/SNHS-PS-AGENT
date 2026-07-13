import { psListFonts } from '../bridge/apiClient';

export interface FontRecord {
  name: string;
  postScriptName: string;
  family: string;
  style: string;
}

let cachedFonts: FontRecord[] | null = null;

export async function installedFonts(): Promise<FontRecord[]> {
  if (cachedFonts) return cachedFonts;
  try {
    const data = await psListFonts();
    cachedFonts = (data.fonts || []).map((f: any) => ({
      name: f.name || '',
      postScriptName: f.postScriptName || f.name || '',
      family: f.family || '',
      style: f.style || '',
    }));
    return cachedFonts || [];
  } catch {
    return [];
  }
}

export function pickFont(
  fonts: FontRecord[],
  preferred: string[],
  options?: { telugu?: boolean; display?: boolean }
): FontRecord {
  const teluguFontNames = ['nirmala', 'gautami', 'noto sans telugu', 'noto serif telugu', 'mandali', 'peddana', 'ramabhadra', 'tenali ramakrishna'];
  const supportsTelugu = (font: FontRecord) => {
    const identity = `${font.name} ${font.postScriptName} ${font.family}`.toLowerCase();
    return teluguFontNames.some(name => identity.includes(name));
  };
  const candidates = options?.telugu ? fonts.filter(supportsTelugu) : fonts;

  for (const name of preferred) {
    const match = candidates.find(f =>
      f.postScriptName.toLowerCase().includes(name.toLowerCase()) ||
      f.family.toLowerCase().includes(name.toLowerCase())
    );
    if (match) return match;
  }
  if (options?.telugu && candidates.length) return candidates[0];
  return fonts[0] || { name: 'Arial', postScriptName: 'ArialMT', family: 'Arial', style: 'Regular' };
}

export function fontScore(query: string, candidate: string): number {
  const q = query.toLowerCase(), c = candidate.toLowerCase();
  if (c === q) return 100;
  if (c.startsWith(q)) return 80;
  if (c.includes(q)) return 60;
  return 0;
}
