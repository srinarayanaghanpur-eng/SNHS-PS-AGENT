/**
 * Semantic classification of OCR text: what is it, and must it be replaced?
 * Pure functions — fully unit-testable.
 */
import type { SchoolProfile } from '../types';

export type TextClass =
  | 'school_name' | 'organisation_name' | 'event_title' | 'subtitle' | 'date'
  | 'academic_year' | 'address' | 'phone' | 'website' | 'email'
  | 'student_name' | 'staff_name' | 'description' | 'call_to_action' | 'footer'
  | 'generic_keep' | 'unknown';

export interface Classification { textClass: TextClass; replace: boolean; confidence: number; reasons: string[] }

const PHONE_RE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|\b0\d{2,4}[\s-]?\d{6,8}\b/;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i;
const URL_RE = /\b(?:www\.|https?:\/\/)[\w.-]+\.[a-z]{2,}\b/i;
const YEAR_RE = /\b(20\d{2})\s*[-–\/]\s*(20)?\d{2}\b/;
const DATE_RE = /\b\d{1,2}(?:st|nd|rd|th)?[\s.\-\/]+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s.\-\/]*\d{0,4}\b|\b\d{1,2}[\-\/.]\d{1,2}[\-\/.]\d{2,4}\b/i;
const TELUGU_RE = /[ఀ-౿]/;

const SCHOOL_WORDS = /\b(high\s*school|school|vidyalaya|vidyalayam|college|academy|concept|techno|e[\s-]?m|em\b|residential|junior|public school|international school|convent|pathasala|badi|బడి|పాఠశాల)\b/i;
const GROUP_WORDS = /\b(group of (schools|institutions)|educational (society|trust|institutions)|society|trust)\b/i;
const ADDRESS_WORDS = /\b(road|rd\.?|street|st\.?|colony|nagar|mandal|district|dist\.?|village|beside|opp\.?|opposite|near|behind|main road|circle|chowrasta|x\s*road|pin\s*code|\d{6})\b/i;
const KEEP_PHRASES = [
  'admissions open', 'admission open', 'admissions started', 'qualified faculty', 'experienced faculty',
  'digital classrooms', 'digital class', 'transport facility', 'bus facility', 'hostel facility',
  'cbse', 'ssc', 'state syllabus', 'best results', 'limited seats', 'enroll now', 'join now',
  'happy birthday', 'congratulations', 'republic day', 'independence day', 'annual day', 'sports day',
  'spoken english', 'karate', 'yoga', 'dance', 'abacus', 'play school', 'pre primary', 'primary', 'nursery',
  'lkg', 'ukg'
];
const CTA_WORDS = /\b(call|contact|visit|join|enroll|admit|register|apply)\b/i;
const STAFF_WORDS = /\b(principal|correspondent|chairman|director|head\s*master|head\s*mistress|hm\b|secretary|founder)\b/i;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const digitsOf = (s: string) => s.replace(/\D+/g, '');

/** Similarity between the detected school-ish name and the configured school (0..1). */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(norm(a).split(/[^a-zఀ-౿]+/i).filter(w => w.length > 2));
  const tb = new Set(norm(b).split(/[^a-zఀ-౿]+/i).filter(w => w.length > 2));
  if (!ta.size || !tb.size) return 0;
  let common = 0;
  for (const w of ta) if (tb.has(w)) common++;
  return common / Math.max(ta.size, tb.size);
}

export function detectLanguage(text: string): 'te' | 'en' | 'mixed' {
  const hasTe = TELUGU_RE.test(text);
  const hasEn = /[a-z]/i.test(text);
  return hasTe && hasEn ? 'mixed' : hasTe ? 'te' : 'en';
}

export function classifyText(rawText: string, profile: SchoolProfile, context?: { yNorm?: number; heightNorm?: number }): Classification {
  const text = rawText.trim();
  const n = norm(text);
  const reasons: string[] = [];
  const R = (textClass: TextClass, replace: boolean, confidence: number): Classification => ({ textClass, replace, confidence, reasons });

  if (!n) return R('unknown', false, 0);

  // hard identifiers first
  if (EMAIL_RE.test(text)) {
    reasons.push('email pattern');
    const ours = profile.email && n.includes(norm(profile.email));
    return R('email', !ours, 90);
  }
  if (URL_RE.test(text) && !EMAIL_RE.test(text)) {
    reasons.push('url pattern');
    const ours = profile.website && n.includes(norm(profile.website).replace(/^https?:\/\//, ''));
    return R('website', !ours, 88);
  }
  if (PHONE_RE.test(text)) {
    reasons.push('phone pattern');
    const found = digitsOf(text);
    const ours = [profile.phone, ...profile.altPhones].filter(Boolean).some(p => found.includes(digitsOf(p)));
    return R('phone', !ours, 92);
  }
  if (YEAR_RE.test(text) && n.length < 40) {
    reasons.push('academic-year pattern');
    const ours = n.includes(norm(profile.academicYear));
    return R('academic_year', !ours, 85);
  }
  if (DATE_RE.test(text) && n.length < 40) { reasons.push('date pattern'); return R('date', false, 80); }

  // whitelisted generic marketing content — keep
  for (const phrase of KEEP_PHRASES) if (n.includes(phrase)) {
    reasons.push(`generic phrase "${phrase}"`);
    // still institution-specific if it ALSO carries a school name
    if (!SCHOOL_WORDS.test(n) || nameSimilarity(n, profile.schoolName) > 0.6) return R('generic_keep', false, 82);
  }

  // school / organisation names
  if (SCHOOL_WORDS.test(n)) {
    reasons.push('school keyword');
    const sim = nameSimilarity(n, profile.schoolName);
    if (sim > 0.6) { reasons.push('matches configured school'); return R('school_name', false, 85); }
    reasons.push('different institution');
    return R('school_name', true, Math.min(95, 60 + n.length));
  }
  if (GROUP_WORDS.test(n)) {
    reasons.push('organisation keyword');
    const ours = nameSimilarity(n, profile.groupName) > 0.6;
    return R('organisation_name', !ours, 78);
  }
  if (ADDRESS_WORDS.test(n) && n.length > 8) {
    reasons.push('address keyword');
    const ours = nameSimilarity(n, profile.location) > 0.5;
    return R('address', !ours, 75);
  }
  if (STAFF_WORDS.test(n)) { reasons.push('staff designation'); return R('staff_name', true, 65); }
  if (CTA_WORDS.test(n) && n.length < 60) { reasons.push('call-to-action verb'); return R('call_to_action', false, 60); }

  // layout hints: near the bottom → footer; big top text → title
  if (context?.yNorm !== undefined) {
    if (context.yNorm > 0.9) { reasons.push('bottom strip'); return R('footer', false, 55); }
    if (context.yNorm < 0.28 && (context.heightNorm ?? 0) > 0.035 && n.length > 6) {
      reasons.push('large top text'); return R('event_title', false, 55);
    }
  }
  if (n.length > 80) { reasons.push('long body text'); return R('description', false, 55); }
  return R('unknown', false, 30);
}

/** Map a text class onto the plugin's existing SemanticRole vocabulary. */
export function toSemanticRole(c: TextClass): import('../types').SemanticRole {
  switch (c) {
    case 'school_name': case 'organisation_name': return 'school_name';
    case 'address': return 'school_address';
    case 'phone': return 'school_phone';
    case 'academic_year': return 'academic_year';
    case 'event_title': return 'poster_title';
    case 'subtitle': return 'poster_subtitle';
    case 'date': return 'event_date';
    case 'description': return 'event_description';
    case 'student_name': return 'student_name';
    case 'footer': return 'footer';
    case 'email': case 'website': return 'contact_information';
    default: return 'unknown';
  }
}
