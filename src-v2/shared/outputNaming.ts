export const CATEGORY_TO_POSTER_TYPE: Record<string, string> = {
  prayer: 'Prayer',
  birthday: 'Birthday',
  festival: 'Festival',
  examination: 'Exam',
  admissions: 'Admissions',
  holiday: 'Holiday',
  dance: 'Event',
  karate: 'Event',
  sports: 'Event',
  achievement: 'Event',
  hiring: 'Notice',
  custom: 'Notice',
};

export const SHORT_FORMS: Record<string, string> = {
  'Sri Narayana High School': 'SNHS',
  'Sri Adarshavani High School': 'SAHS',
  'Sri Vidyaniketan High School': 'SVHS',
};

const PRESET_SHORT_NAMES: Record<string, string> = {
  'premium-academic': 'PremiumAcademic',
  'modern-school': 'ModernSchool',
  'festival-celebration': 'FestivalGold',
  'daily-prayer': 'DailyPrayer',
  'student-achievement': 'Achievement',
  'admissions-campaign': 'AdmissionsPro',
  'sports-event': 'SportsPro',
  'birthday-celebration': 'BirthdayCelebration',
  'examination-notice': 'ExamNotice',
  'cultural-programme': 'CulturalPro',
  'minimal-corporate': 'MinimalNotice',
  'energetic-youth': 'EnergeticYouth',
};

export function posterTypeFromCategory(category: string): string {
  return CATEGORY_TO_POSTER_TYPE[category] || category;
}

export function shortNameFromSchool(schoolName: string, shortName?: string): string {
  if (shortName) return shortName;
  return SHORT_FORMS[schoolName] || schoolName.replace(/\s+/g, '').slice(0, 4).toUpperCase();
}

export function templateShortName(presetId: string | undefined, presetLabel?: string): string {
  if (presetId && PRESET_SHORT_NAMES[presetId]) return PRESET_SHORT_NAMES[presetId];
  if (presetLabel) return presetLabel.replace(/\s+/g, '');
  if (presetId) return presetId.replace(/-/g, '').replace(/\b\w/g, (c) => c.toUpperCase());
  return 'Auto';
}

export function formatDateForFilename(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

export function generateBaseName(
  schoolShortForm: string,
  posterType: string,
  templateShort: string,
  date: Date,
): string {
  return `${schoolShortForm}_${posterType}_${templateShort}_${formatDateForFilename(date)}`;
}

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;

export function safeFilename(name: string): string {
  return name.replace(INVALID_FILENAME_CHARS, '_');
}
