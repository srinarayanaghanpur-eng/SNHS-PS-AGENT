// Stable, renderer-safe plan hashing. This deliberately avoids Node-only
// crypto so the sandboxed Electron preview and the main process calculate the
// exact same identifier for the same immutable design plan.

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
}

export function stableDesignPlanJson(plan: unknown): string { return stable(plan); }

export function hashDesignPlan(plan: unknown): string {
  const text = stable(plan);
  let a = 0x811c9dc5; let b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a ^= c; a = Math.imul(a, 0x01000193) >>> 0;
    b ^= c + i; b = Math.imul(b, 0x85ebca6b) >>> 0;
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}
