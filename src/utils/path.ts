export function join(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

export function dirname(p: string): string {
  return p.substring(0, Math.max(0, p.lastIndexOf('/'))) || '.';
}

export function basename(p: string): string {
  return p.split('/').pop() || p;
}

export function extname(p: string): string {
  const b = basename(p);
  const dot = b.lastIndexOf('.');
  return dot >= 0 ? b.substring(dot) : '';
}
