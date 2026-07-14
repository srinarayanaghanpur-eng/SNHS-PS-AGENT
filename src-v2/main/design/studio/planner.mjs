// DesignPlan generator. Produces the internal plan BEFORE rendering.
// The plan is validated by the quality gate and can be rejected/regenerated.

export function buildDesignPlan({ width, height, content, assets, palette, typo, family, seed = 0 }) {
  const margin = Math.round(width * 0.06);
  const hasHero = !!assets.hero;
  const hasLogo = !!assets.schoolLogo;
  const hasLead = !!assets.leadLogo;
  const mgmt = (content.management || []).filter((m) => m.name && (m.image || m.allowTextOnly));

  // Region layout for hero-editorial composition (portrait 1080x1350).
  const headerH = Math.round(height * 0.085);
  const heroTop = margin + headerH;
  const heroH = hasHero ? Math.round(height * 0.36) : Math.round(height * 0.20);
  const heroBottom = heroTop + heroH;
  const footerH = Math.round(height * 0.075);
  const footerTop = height - footerH;

  // Title sits FULLY inside the lower hero (white on the dark scrim), never on canvas.
  const titleH = Math.round(height * 0.165);
  const schedTop = heroBottom + Math.round(height * 0.085);
  const boxes = {
    header: { x: margin, y: margin, w: width - margin * 2, h: headerH },
    hero: { x: 0, y: heroTop, w: width, h: heroH },
    dateBadge: { x: margin, y: heroBottom - titleH - Math.round(height * 0.05), w: width - margin * 2, h: Math.round(height * 0.04) },
    titleBlock: { x: margin, y: heroBottom - titleH - Math.round(height * 0.004), w: width - margin * 2, h: titleH },
    subtitle: { x: margin, y: heroBottom + Math.round(height * 0.02), w: width - margin * 2, h: Math.round(height * 0.05) },
    schedule: { x: margin, y: schedTop, w: width - margin * 2, h: footerTop - schedTop - Math.round(height * 0.02) },
    footer: { x: 0, y: footerTop, w: width, h: footerH },
  };

  return {
    chosenCompositionFamily: family || 'hero-editorial',
    seed,
    canvas: { width, height, margin },
    focalElement: hasHero ? 'hero-photo + title overlay' : 'oversized-title',
    visualHierarchy: ['event-title', 'hero-photo', 'date-badge', 'schedule', 'school-identity', 'footer-contact'],
    assetRoles: {
      schoolLogo: hasLogo ? 'header-left emblem' : 'omitted (not supplied)',
      leadLogo: hasLead ? 'footer-right co-brand' : 'omitted (not supplied)',
      hero: hasHero ? 'full-width hero band with gradient scrim' : 'omitted -> title-led hero band',
      management: mgmt.length ? `${mgmt.length} circular portraits above footer` : 'omitted (none supplied)',
    },
    textPriority: { title: 1, date: 2, schedule: 3, subtitle: 4, footer: 5 },
    colourPalette: {
      primary: palette.primary, accent: palette.accent, canvas: palette.canvas, ink: palette.ink,
    },
    typographyPairing: { display: typo.display.family, body: typo.body.family },
    sectionBoundingBoxes: boxes,
    whitespaceIntent: 'Structured rhythm: full-bleed hero kills top dead space; schedule fills mid-canvas in cards; navy footer bar anchors base. No region left as untreated flat block.',
    photoCropInstructions: hasHero
      ? { hero: 'center-weighted cover crop, focus upper-center for faces; navy->transparent bottom scrim for title legibility' }
      : {},
    decorativeStrategy: 'Accent rule under school name; accent number chips on schedule cards; thin accent keyline on hero.',
    mobileReadabilityEstimate: null, // filled by quality gate after render
  };
}
// end planner
