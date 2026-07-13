import type { LayoutRegion, SafeArea, LayoutSection, SemanticRole, TextRegion } from '../types';

export function percentageToPixels(percent: number, dimension: number): number {
  return Math.round(dimension * (percent / 100));
}

export function calculateSafeArea(docW: number, docH: number): SafeArea {
  const left = Math.round(docW * 0.05);
  const top = Math.round(docH * 0.04);
  const right = Math.round(docW * 0.95);
  const bottom = Math.round(docH * 0.96);
  return {
    left, top, right, bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

export function calculateHeaderRegion(docW: number, docH: number): LayoutRegion {
  return {
    x: Math.round(docW * 0.05),
    y: Math.round(docH * 0.04),
    width: Math.round(docW * 0.90),
    height: Math.round(docH * 0.18)
  };
}

export function calculateContentRegion(docW: number, docH: number): LayoutRegion {
  const headerBottom = Math.round(docH * 0.22);
  return {
    x: Math.round(docW * 0.05),
    y: headerBottom,
    width: Math.round(docW * 0.90),
    height: Math.round(docH * 0.60)
  };
}

export function calculateFooterRegion(docW: number, docH: number): LayoutRegion {
  const footerTop = Math.round(docH * 0.78);
  return {
    x: Math.round(docW * 0.05),
    y: footerTop,
    width: Math.round(docW * 0.90),
    height: Math.round(docH * 0.18)
  };
}

const ROLE_SECTION_MAP: Record<string, LayoutSection> = {
  school_logo: 'header',
  school_name: 'header',
  poster_title: 'header',
  event_name: 'header',
  powered_by_lead: 'header',
  branding: 'header',
  event_image: 'content',
  poster_subtitle: 'content',
  event_date: 'content',
  event_description: 'content',
  academic_year: 'content',
  features: 'content',
  subheadline: 'content',
  student_name: 'content',
  student_class: 'content',
  student_photo: 'content',
  birthday_photo: 'content',
  birthday_name: 'content',
  achievement_photo: 'content',
  achievement_name: 'content',
  teacher_photo: 'content',
  chairman_photo: 'footer',
  principal_photo: 'footer',
  contact_information: 'footer',
  school_address: 'footer',
  school_phone: 'footer',
  footer: 'footer',
  social_media: 'footer',
  repeated_student_card: 'content',
  background: 'content',
  decorative_element: 'content',
  icon: 'content',
  optional_section: 'content',
  unknown: 'content'
};

export function getSectionForRole(role: SemanticRole): LayoutSection {
  return ROLE_SECTION_MAP[role] || 'content';
}

export function getRegionForSection(docW: number, docH: number, section: LayoutSection): LayoutRegion {
  switch (section) {
    case 'header': return calculateHeaderRegion(docW, docH);
    case 'content': return calculateContentRegion(docW, docH);
    case 'footer': return calculateFooterRegion(docW, docH);
  }
}

const TEXT_REGION_PRESETS: Record<string, TextRegion> = {
  poster_title:     { x: 0, y: 0, width: 1200, height: 200, maxLines: 2, minFontSize: 18, maxFontSize: 120, alignment: 'center' },
  event_name:       { x: 0, y: 0, width: 1200, height: 200, maxLines: 2, minFontSize: 18, maxFontSize: 120, alignment: 'center' },
  poster_subtitle:  { x: 0, y: 0, width: 1000, height: 100, maxLines: 2, minFontSize: 12, maxFontSize: 48,  alignment: 'center' },
  subheadline:      { x: 0, y: 0, width: 1000, height: 100, maxLines: 2, minFontSize: 12, maxFontSize: 48,  alignment: 'center' },
  event_description:{ x: 0, y: 0, width: 900,  height: 200, maxLines: 3, minFontSize: 10, maxFontSize: 36,  alignment: 'left' },
  features:         { x: 0, y: 0, width: 900,  height: 200, maxLines: 3, minFontSize: 10, maxFontSize: 36,  alignment: 'left' },
  school_address:   { x: 0, y: 0, width: 800,  height: 80,  maxLines: 2, minFontSize: 8,  maxFontSize: 24,  alignment: 'center' },
  footer:           { x: 0, y: 0, width: 800,  height: 80,  maxLines: 2, minFontSize: 8,  maxFontSize: 20,  alignment: 'center' },
  event_date:       { x: 0, y: 0, width: 800,  height: 60,  maxLines: 1, minFontSize: 10, maxFontSize: 36,  alignment: 'center' },
  academic_year:    { x: 0, y: 0, width: 800,  height: 50,  maxLines: 1, minFontSize: 10, maxFontSize: 24,  alignment: 'center' },
  school_phone:     { x: 0, y: 0, width: 600,  height: 40,  maxLines: 1, minFontSize: 8,  maxFontSize: 20,  alignment: 'center' },
  school_name:      { x: 0, y: 0, width: 600,  height: 60,  maxLines: 1, minFontSize: 12, maxFontSize: 48,  alignment: 'left' },
  contact_information:{ x: 0, y: 0, width: 800, height: 60, maxLines: 2, minFontSize: 8,  maxFontSize: 20,  alignment: 'center' },
  student_name:     { x: 0, y: 0, width: 400,  height: 60,  maxLines: 2, minFontSize: 8,  maxFontSize: 24,  alignment: 'left' },
  powered_by_lead:  { x: 0, y: 0, width: 400,  height: 40,  maxLines: 1, minFontSize: 7,  maxFontSize: 16,  alignment: 'right' }
};

export function getTextRegionForRole(role: string, docW: number, docH: number, sectionRegion?: { x: number; y: number; width: number; height: number }): TextRegion {
  const preset = TEXT_REGION_PRESETS[role] ?? {
    x: 0, y: 0, width: docW * 0.8, height: docH * 0.08,
    maxLines: 2, minFontSize: 8, maxFontSize: 24, alignment: 'center'
  };

  const region = { ...preset };
  if (sectionRegion) {
    region.x = sectionRegion.x + Math.round(sectionRegion.width * 0.02);
    region.width = sectionRegion.width - Math.round(sectionRegion.width * 0.04);
    region.y = sectionRegion.y + Math.round(sectionRegion.height * 0.05);
    region.height = sectionRegion.height - Math.round(sectionRegion.height * 0.1);
  }
  return region;
}
