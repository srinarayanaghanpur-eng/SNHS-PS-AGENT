export function allLayers(document:any){const out:any[]=[];const walk=(ls:any[])=>ls.forEach(l=>{out.push(l);walk(Array.from(l.layers??[]))});walk(Array.from(document.layers??[]));return out}
export function findLayer(document:any,id:number){return allLayers(document).find(l=>Number(l.id)===id)}
export function descendants(group:any){const out:any[]=[];const walk=(ls:any[])=>ls.forEach(l=>{out.push(l);walk(Array.from(l.layers??[]))});walk(Array.from(group.layers??[]));return out}
