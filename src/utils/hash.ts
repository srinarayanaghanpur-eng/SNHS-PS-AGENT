export function stableStringify(value:unknown):string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value&&typeof value==='object') return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function fnv1a(input:string):string { let h=0x811c9dc5; for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;} return h.toString(16).padStart(8,'0'); }
export function id(prefix='snhs'):string { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`; }
