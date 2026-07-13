// Design-system presets. Each preset is a real design direction: composition,
// background construction, typography pairing, decoration vocabulary, photo
// treatment, footer style and spacing — not just a colour swap.

export type TitlePosition = 'top-center' | 'top-left' | 'banner' | 'center';
export type BackgroundStyle = 'vertical-gradient' | 'diagonal-gradient' | 'radial-glow' | 'split-panel' | 'deep-vignette';
export type Decoration = 'circles' | 'diagonal-ribbons' | 'corner-frames' | 'dot-grid' | 'rays' | 'confetti' | 'waves' | 'side-band' | 'arch' | 'halo';
export type PhotoTreatment = 'circle' | 'rounded' | 'card' | 'polaroid';
export type FooterStyle = 'solid-bar' | 'gradient-bar' | 'minimal-line';

export interface Typography {
  title: string; titleAlt: string; // PostScript names; alt is the in-Photoshop fallback
  body: string; accent: string;
  titleCase: boolean; titleTracking: number;
}

export interface Palette {
  bgA: string; bgB: string;        // background gradient stops
  panel: string;                    // content surface
  primary: string;                  // dominant brand tone (dark)
  accent: string;                   // highlight (gold/orange/etc.)
  textOnDark: string; textOnLight: string; muted: string;
}

export interface DesignPreset {
  id: string; label: string;
  suits: string[];                  // poster categories this fits
  palette: Palette;
  typography: Typography;
  titlePosition: TitlePosition;
  background: BackgroundStyle;
  decorations: Decoration[];
  photoTreatment: PhotoTreatment;
  footer: FooterStyle;
  spacing: number;                  // base spacing unit in px at 1080 wide
  panelOpacity: number;             // content panel translucency 0..100
  recommendedPhotos: [number, number];
}

const serifTitle: Typography = { title: 'Georgia-Bold', titleAlt: 'TimesNewRomanPS-BoldMT', body: 'ArialMT', accent: 'Georgia-Italic', titleCase: true, titleTracking: 40 };
const strongSans: Typography = { title: 'Arial-Black', titleAlt: 'Arial-BoldMT', body: 'ArialMT', accent: 'Arial-BoldMT', titleCase: true, titleTracking: 10 };
const impactDisplay: Typography = { title: 'Impact', titleAlt: 'Arial-Black', body: 'Verdana', accent: 'Verdana-Bold', titleCase: true, titleTracking: 30 };
const humanist: Typography = { title: 'TrebuchetMS-Bold', titleAlt: 'Verdana-Bold', body: 'TrebuchetMS', accent: 'TrebuchetMS-Italic', titleCase: false, titleTracking: 0 };
const elegant: Typography = { title: 'PalatinoLinotype-Bold', titleAlt: 'Georgia-Bold', body: 'PalatinoLinotype-Roman', accent: 'PalatinoLinotype-Italic', titleCase: true, titleTracking: 60 };

export const PRESETS: DesignPreset[] = [
  {
    id: 'premium-academic', label: 'Premium Academic', suits: ['prayer', 'achievement', 'examination', 'custom'],
    palette: { bgA: '0B2A52', bgB: '123E78', panel: 'F7FAFF', primary: '0B2A52', accent: 'D4A72C', textOnDark: 'FFFFFF', textOnLight: '13233B', muted: '5A6B84' },
    typography: elegant, titlePosition: 'top-center', background: 'deep-vignette',
    decorations: ['corner-frames', 'halo'], photoTreatment: 'rounded', footer: 'gradient-bar', spacing: 28, panelOpacity: 96, recommendedPhotos: [0, 6],
  },
  {
    id: 'modern-school', label: 'Modern School', suits: ['prayer', 'admissions', 'custom', 'holiday'],
    palette: { bgA: '10365F', bgB: '1D5FA8', panel: 'FFFFFF', primary: '10365F', accent: 'F0A928', textOnDark: 'FFFFFF', textOnLight: '17293E', muted: '607690' },
    typography: strongSans, titlePosition: 'top-left', background: 'diagonal-gradient',
    decorations: ['circles', 'side-band'], photoTreatment: 'rounded', footer: 'solid-bar', spacing: 26, panelOpacity: 100, recommendedPhotos: [1, 8],
  },
  {
    id: 'festival-celebration', label: 'Festival Celebration', suits: ['festival', 'holiday'],
    palette: { bgA: '5E1B3F', bgB: '9C2C55', panel: 'FFF4DC', primary: '5E1B3F', accent: 'F2B234', textOnDark: 'FFF6E6', textOnLight: '4A1A33', muted: '8A5568' },
    typography: serifTitle, titlePosition: 'center', background: 'radial-glow',
    decorations: ['rays', 'confetti', 'arch'], photoTreatment: 'circle', footer: 'gradient-bar', spacing: 24, panelOpacity: 92, recommendedPhotos: [0, 5],
  },
  {
    id: 'daily-prayer', label: 'Daily Prayer Proceedings', suits: ['prayer'],
    palette: { bgA: '14325C', bgB: '1E4B85', panel: 'F2F8FF', primary: '14325C', accent: 'E9A83B', textOnDark: 'FFFFFF', textOnLight: '182B45', muted: '5D7089' },
    typography: elegant, titlePosition: 'top-center', background: 'radial-glow',
    decorations: ['halo', 'corner-frames'], photoTreatment: 'circle', footer: 'gradient-bar', spacing: 26, panelOpacity: 95, recommendedPhotos: [2, 12],
  },
  {
    id: 'student-achievement', label: 'Student Achievement', suits: ['achievement', 'karate', 'sports'],
    palette: { bgA: '461325', bgB: '75203C', panel: 'FFF8EC', primary: '4A1527', accent: 'E3A62E', textOnDark: 'FFF4DF', textOnLight: '3C1520', muted: '7E5A64' },
    typography: serifTitle, titlePosition: 'banner', background: 'deep-vignette',
    decorations: ['rays', 'corner-frames'], photoTreatment: 'circle', footer: 'solid-bar', spacing: 26, panelOpacity: 96, recommendedPhotos: [1, 4],
  },
  {
    id: 'admissions-campaign', label: 'Admissions Campaign', suits: ['admissions', 'hiring'],
    palette: { bgA: '072648', bgB: '0E4C8F', panel: 'FFFFFF', primary: '072648', accent: 'FFB020', textOnDark: 'FFFFFF', textOnLight: '10243C', muted: '5B7089' },
    typography: strongSans, titlePosition: 'top-left', background: 'split-panel',
    decorations: ['diagonal-ribbons', 'dot-grid'], photoTreatment: 'card', footer: 'solid-bar', spacing: 28, panelOpacity: 100, recommendedPhotos: [1, 3],
  },
  {
    id: 'sports-event', label: 'Sports Event', suits: ['sports', 'karate'],
    palette: { bgA: '0D1B2A', bgB: '1B4368', panel: 'F2F6FA', primary: '0D1B2A', accent: 'ED7C22', textOnDark: 'FFFFFF', textOnLight: '12202E', muted: '5F7285' },
    typography: impactDisplay, titlePosition: 'banner', background: 'diagonal-gradient',
    decorations: ['diagonal-ribbons', 'rays'], photoTreatment: 'card', footer: 'solid-bar', spacing: 22, panelOpacity: 94, recommendedPhotos: [1, 8],
  },
  {
    id: 'birthday-celebration', label: 'Birthday Celebration', suits: ['birthday'],
    palette: { bgA: '4A1F63', bgB: '7A3AA0', panel: 'FFF6E8', primary: '46205C', accent: 'F2A93B', textOnDark: 'FFF3DF', textOnLight: '3C1E4E', muted: '7D6390' },
    typography: serifTitle, titlePosition: 'center', background: 'radial-glow',
    decorations: ['confetti', 'circles', 'halo'], photoTreatment: 'circle', footer: 'gradient-bar', spacing: 24, panelOpacity: 92, recommendedPhotos: [1, 12],
  },
  {
    id: 'examination-notice', label: 'Examination Notice', suits: ['examination'],
    palette: { bgA: '10365C', bgB: '10365C', panel: 'FFFFFF', primary: '10365C', accent: 'C99A22', textOnDark: 'FFFFFF', textOnLight: '182838', muted: '5C6B7E' },
    typography: strongSans, titlePosition: 'banner', background: 'split-panel',
    decorations: ['corner-frames'], photoTreatment: 'rounded', footer: 'minimal-line', spacing: 32, panelOpacity: 100, recommendedPhotos: [0, 1],
  },
  {
    id: 'cultural-programme', label: 'Cultural Programme', suits: ['dance', 'festival'],
    palette: { bgA: '43124A', bgB: '791D6C', panel: 'FFEFF7', primary: '43124A', accent: 'EFA733', textOnDark: 'FFEFDD', textOnLight: '3A1440', muted: '875C8A' },
    typography: elegant, titlePosition: 'center', background: 'radial-glow',
    decorations: ['waves', 'confetti', 'arch'], photoTreatment: 'circle', footer: 'gradient-bar', spacing: 24, panelOpacity: 90, recommendedPhotos: [1, 6],
  },
  {
    id: 'minimal-corporate', label: 'Minimal Corporate', suits: ['hiring', 'custom', 'examination'],
    palette: { bgA: 'F5F6F8', bgB: 'E7EBF0', panel: 'FFFFFF', primary: '19273A', accent: '9C7A1E', textOnDark: 'FFFFFF', textOnLight: '19273A', muted: '76839A' },
    typography: humanist, titlePosition: 'top-left', background: 'vertical-gradient',
    decorations: ['dot-grid', 'side-band'], photoTreatment: 'rounded', footer: 'minimal-line', spacing: 34, panelOpacity: 100, recommendedPhotos: [0, 2],
  },
  {
    id: 'energetic-youth', label: 'Energetic Youth', suits: ['dance', 'sports', 'birthday', 'holiday'],
    palette: { bgA: '1B1B33', bgB: '3A2B72', panel: 'FDF7EE', primary: '221E44', accent: 'FF9F2E', textOnDark: 'FFF4E4', textOnLight: '241F3D', muted: '6E6A8E' },
    typography: impactDisplay, titlePosition: 'top-left', background: 'diagonal-gradient',
    decorations: ['circles', 'confetti', 'waves'], photoTreatment: 'polaroid', footer: 'gradient-bar', spacing: 22, panelOpacity: 93, recommendedPhotos: [2, 8],
  },
];

export function presetById(id: string | undefined): DesignPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function autoPreset(category: string, seed: number): DesignPreset {
  const suited = PRESETS.filter((p) => p.suits.includes(category));
  if (!suited.length) return PRESETS[0];
  return suited[seed % suited.length];
}
