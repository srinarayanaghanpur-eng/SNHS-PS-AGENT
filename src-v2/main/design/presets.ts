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
    palette: { bgA: '081C3A', bgB: '163A72', panel: 'F2F6FD', primary: '081C3A', accent: 'D4A72C', textOnDark: 'FFFFFF', textOnLight: '0F1F3A', muted: '5A6F8E' },
    typography: elegant, titlePosition: 'top-center', background: 'deep-vignette',
    decorations: ['corner-frames', 'halo', 'side-band'], photoTreatment: 'rounded', footer: 'gradient-bar', spacing: 28, panelOpacity: 96, recommendedPhotos: [0, 6],
  },
  {
    id: 'modern-school', label: 'Modern School', suits: ['prayer', 'admissions', 'custom', 'holiday'],
    palette: { bgA: '0C2B50', bgB: '1E5AA0', panel: 'FFFFFF', primary: '0C2B50', accent: 'F0A928', textOnDark: 'FFFFFF', textOnLight: '15273A', muted: '5E7590' },
    typography: strongSans, titlePosition: 'top-left', background: 'diagonal-gradient',
    decorations: ['circles', 'side-band', 'dot-grid'], photoTreatment: 'rounded', footer: 'solid-bar', spacing: 26, panelOpacity: 100, recommendedPhotos: [1, 8],
  },
  {
    id: 'festival-celebration', label: 'Festival Celebration', suits: ['festival', 'holiday'],
    palette: { bgA: '5E1B3F', bgB: 'A6335A', panel: 'FFF4DC', primary: '5E1B3F', accent: 'F4B840', textOnDark: 'FFF6E6', textOnLight: '4A1A33', muted: '8E5870' },
    typography: serifTitle, titlePosition: 'center', background: 'radial-glow',
    decorations: ['rays', 'confetti', 'arch', 'halo'], photoTreatment: 'circle', footer: 'gradient-bar', spacing: 24, panelOpacity: 90, recommendedPhotos: [0, 5],
  },
  {
    id: 'daily-prayer', label: 'Daily Prayer Proceedings', suits: ['prayer'],
    palette: { bgA: '0F2648', bgB: '1B4380', panel: 'EEF5FF', primary: '0F2648', accent: 'E9A83B', textOnDark: 'FFFFFF', textOnLight: '15253E', muted: '5C708C' },
    typography: elegant, titlePosition: 'top-center', background: 'radial-glow',
    decorations: ['halo', 'corner-frames', 'side-band'], photoTreatment: 'circle', footer: 'gradient-bar', spacing: 26, panelOpacity: 94, recommendedPhotos: [2, 12],
  },
  {
    id: 'student-achievement', label: 'Student Achievement', suits: ['achievement', 'karate', 'sports'],
    palette: { bgA: '3A0F1E', bgB: '6E1C36', panel: 'FFF6E8', primary: '3A0F1E', accent: 'E8A82E', textOnDark: 'FFF4DF', textOnLight: '341220', muted: '7A5060' },
    typography: serifTitle, titlePosition: 'banner', background: 'deep-vignette',
    decorations: ['rays', 'corner-frames', 'confetti'], photoTreatment: 'circle', footer: 'solid-bar', spacing: 26, panelOpacity: 95, recommendedPhotos: [1, 4],
  },
  {
    id: 'admissions-campaign', label: 'Admissions Campaign', suits: ['admissions', 'hiring'],
    palette: { bgA: '051E3D', bgB: '0E4C8F', panel: 'FFFFFF', primary: '051E3D', accent: 'FFB82A', textOnDark: 'FFFFFF', textOnLight: '0D1F35', muted: '58708C' },
    typography: strongSans, titlePosition: 'top-left', background: 'split-panel',
    decorations: ['diagonal-ribbons', 'dot-grid', 'circles'], photoTreatment: 'card', footer: 'solid-bar', spacing: 28, panelOpacity: 100, recommendedPhotos: [1, 3],
  },
  {
    id: 'sports-event', label: 'Sports Event', suits: ['sports', 'karate'],
    palette: { bgA: '0A1522', bgB: '1B3D62', panel: 'F0F4FA', primary: '0A1522', accent: 'ED7C22', textOnDark: 'FFFFFF', textOnLight: '0E1A28', muted: '5C7088' },
    typography: impactDisplay, titlePosition: 'banner', background: 'diagonal-gradient',
    decorations: ['diagonal-ribbons', 'rays', 'waves'], photoTreatment: 'card', footer: 'solid-bar', spacing: 22, panelOpacity: 92, recommendedPhotos: [1, 8],
  },
  {
    id: 'birthday-celebration', label: 'Birthday Celebration', suits: ['birthday'],
    palette: { bgA: '3D1650', bgB: '7A39A0', panel: 'FFF4E6', primary: '3D1650', accent: 'F5B040', textOnDark: 'FFF3DF', textOnLight: '341845', muted: '7A6090' },
    typography: serifTitle, titlePosition: 'center', background: 'radial-glow',
    decorations: ['confetti', 'circles', 'halo', 'arch'], photoTreatment: 'circle', footer: 'gradient-bar', spacing: 24, panelOpacity: 90, recommendedPhotos: [1, 12],
  },
  {
    id: 'examination-notice', label: 'Examination Notice', suits: ['examination'],
    palette: { bgA: '0E2A48', bgB: '0E2A48', panel: 'FAFCFE', primary: '0E2A48', accent: 'C6951E', textOnDark: 'FFFFFF', textOnLight: '132438', muted: '586C82' },
    typography: strongSans, titlePosition: 'banner', background: 'split-panel',
    decorations: ['corner-frames', 'side-band'], photoTreatment: 'rounded', footer: 'minimal-line', spacing: 32, panelOpacity: 100, recommendedPhotos: [0, 1],
  },
  {
    id: 'cultural-programme', label: 'Cultural Programme', suits: ['dance', 'festival'],
    palette: { bgA: '3A0E42', bgB: '721A66', panel: 'FFEDF5', primary: '3A0E42', accent: 'F2B040', textOnDark: 'FFEFDD', textOnLight: '32103A', muted: '855A88' },
    typography: elegant, titlePosition: 'center', background: 'radial-glow',
    decorations: ['waves', 'confetti', 'arch', 'circles'], photoTreatment: 'circle', footer: 'gradient-bar', spacing: 24, panelOpacity: 88, recommendedPhotos: [1, 6],
  },
  {
    id: 'minimal-corporate', label: 'Minimal Corporate', suits: ['hiring', 'custom', 'examination'],
    palette: { bgA: 'EFF1F5', bgB: 'DEE3EC', panel: 'FFFFFF', primary: '152236', accent: 'A0802A', textOnDark: 'FFFFFF', textOnLight: '152236', muted: '728098' },
    typography: humanist, titlePosition: 'top-left', background: 'vertical-gradient',
    decorations: ['dot-grid', 'side-band', 'corner-frames'], photoTreatment: 'rounded', footer: 'minimal-line', spacing: 34, panelOpacity: 100, recommendedPhotos: [0, 2],
  },
  {
    id: 'energetic-youth', label: 'Energetic Youth', suits: ['dance', 'sports', 'birthday', 'holiday'],
    palette: { bgA: '16162B', bgB: '342568', panel: 'FCF6EC', primary: '1A1836', accent: 'FFA538', textOnDark: 'FFF4E4', textOnLight: '1E1A34', muted: '6A668E' },
    typography: impactDisplay, titlePosition: 'top-left', background: 'diagonal-gradient',
    decorations: ['circles', 'confetti', 'waves', 'rays'], photoTreatment: 'polaroid', footer: 'gradient-bar', spacing: 22, panelOpacity: 92, recommendedPhotos: [2, 8],
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
