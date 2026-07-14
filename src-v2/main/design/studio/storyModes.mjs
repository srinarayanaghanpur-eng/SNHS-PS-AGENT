// Adaptive story-mode selection and hard programme-coverage validation.
// Photo count describes distinct, quality-approved event moments only.

export const STORY_MODES = Object.freeze({
  COMPACT: 'single-page-compact',
  PHOTO_RICH: 'single-page-photo-rich',
  CAROUSEL: 'two-page-carousel',
  AUTOMATIC: 'automatic',
});

const MODE_ALIASES = new Map([
  ['compact', STORY_MODES.COMPACT],
  ['single-page-compact', STORY_MODES.COMPACT],
  ['photo-rich', STORY_MODES.PHOTO_RICH],
  ['single-page-photo-rich', STORY_MODES.PHOTO_RICH],
  ['carousel', STORY_MODES.CAROUSEL],
  ['two-page-carousel', STORY_MODES.CAROUSEL],
  ['automatic', STORY_MODES.AUTOMATIC],
  ['auto', STORY_MODES.AUTOMATIC],
]);

export function selectStoryMode(distinctPhotoCount, requested = STORY_MODES.AUTOMATIC) {
  const normalized = MODE_ALIASES.get(String(requested || STORY_MODES.AUTOMATIC).trim().toLowerCase());
  if (!normalized) throw new Error(`Unknown layout mode: ${requested}`);
  if (normalized !== STORY_MODES.AUTOMATIC) return normalized;
  if (distinctPhotoCount >= 9) return STORY_MODES.CAROUSEL;
  if (distinctPhotoCount >= 5) return STORY_MODES.PHOTO_RICH;
  return STORY_MODES.COMPACT;
}

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']+/gi, ' ')
    .trim()
    .toLowerCase();
}

function walk(nodes, fn) {
  for (const node of nodes || []) {
    fn(node);
    if (node.children) walk(node.children, fn);
  }
}

export function renderedProgrammeItems(scene, programme = []) {
  const texts = [];
  walk(scene?.root, (node) => {
    if (node.type === 'text') texts.push(normalize(node.text));
  });
  return programme.filter((item) => {
    const target = normalize(item);
    return texts.some((value) => value === target || value.includes(target));
  });
}

export function validateProgrammeCoverage(scenes, programme = []) {
  const list = Array.isArray(scenes) ? scenes : [scenes];
  const rendered = new Set(list.flatMap((scene) => renderedProgrammeItems(scene, programme)));
  const missing = programme.filter((item) => !rendered.has(item));
  return {
    pass: missing.length === 0,
    rendered: programme.filter((item) => rendered.has(item)),
    missing,
    rejectionCode: missing.length ? 'PROGRAMME_ITEMS_DROPPED' : null,
  };
}

export function auditMobileText(scene, { exportWidth = 360, programme = [] } = {}) {
  const scale = exportWidth / Number(scene?.width || 1080);
  const groups = { schoolName: [], programme: [], footer: [], activityLabels: [] };
  let currentGroup = '';
  const visit = (nodes) => {
    for (const node of nodes || []) {
      if (node.type === 'group') {
        const previous = currentGroup;
        currentGroup = String(node.name || '');
        visit(node.children);
        currentGroup = previous;
        continue;
      }
      if (node.type !== 'text') continue;
      const size = Number(node.size || 0) * scale;
      const value = normalize(node.text);
      if (/HEADER/.test(currentGroup) && /school/.test(value)) groups.schoolName.push(size);
      if (/PROCEEDINGS_RAIL/.test(currentGroup) && programme.some((item) => normalize(item) === value)) groups.programme.push(size);
      if (/FOOTER/.test(currentGroup)) groups.footer.push(size);
      if (/PHOTO|GALLERY/.test(currentGroup) && !/MOMENTS FROM/.test(String(node.text || ''))) groups.activityLabels.push(size);
    }
  };
  visit(scene?.root);
  const minimum = (values) => values.length ? Math.min(...values) : null;
  const minima = {
    schoolName: minimum(groups.schoolName),
    programme: minimum(groups.programme),
    footer: minimum(groups.footer),
    activityLabels: minimum(groups.activityLabels),
  };
  const thresholds = { schoolName: 13, programme: 4.5, footer: 4.5, activityLabels: 5 };
  const failures = Object.entries(thresholds)
    .filter(([key, threshold]) => minima[key] != null && minima[key] < threshold)
    .map(([key]) => key);
  return { pass: failures.length === 0, exportWidth, scale, minima, thresholds, failures };
}
