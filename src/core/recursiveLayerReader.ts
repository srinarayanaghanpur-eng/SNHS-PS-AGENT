import type {LayerSnapshot,LayerType,Rect,TextMetadata} from '../types';
import {layerDetails} from '../photoshop/batchPlayHelpers';

const n=(v:any)=>typeof v==='number'?v:Number(v?._value??v?.value??0);
const rect=(b:any):Rect=>{const left=n(b?.left),top=n(b?.top),right=n(b?.right),bottom=n(b?.bottom);return{left,top,right,bottom,width:Math.max(0,right-left),height:Math.max(0,bottom-top)}};
function kind(layer:any,detail:any):LayerType{const k=String(layer.kind??'').toLowerCase();if(k.includes('group'))return'group';if(k.includes('text'))return'text';if(detail.smartObject||k.includes('smart'))return'smartObject';if(k.includes('solid')||k.includes('gradient')||k.includes('pattern'))return'shape';if(k.includes('adjust'))return'adjustment';if(layer.isBackgroundLayer)return'background';if(k.includes('pixel'))return'pixel';return'other'}
function textMeta(layer:any):TextMetadata|undefined{try{const t=layer.textItem;if(!t)return;const cs=t.characterStyle??{},ps=t.paragraphStyle??{};return{contents:String(t.contents??''),font:String(cs.font??cs.fontName??''),size:n(cs.size),alignment:String(ps.justification??''),color:cs.color?.rgb?.hexValue?`#${cs.color.rgb.hexValue}`:undefined,leading:n(cs.leading),pointText:Boolean(t.isPointText)}}catch{return}}
export async function readLayerTree(document:any,onProgress?:(done:number)=>void):Promise<LayerSnapshot[]>{
  let done=0;
  async function walk(layers:any[],parentPath:string|null,depth:number):Promise<LayerSnapshot[]>{
    const out:LayerSnapshot[]=[];const ids=layers.map(l=>Number(l.id));
    for(let i=0;i<layers.length;i++){const l=layers[i];let detail:any={};try{detail=await layerDetails(document.id,l.id)}catch{}const path=parentPath?`${parentPath} > ${l.name}`:String(l.name);const children=Array.from(l.layers??[]) as any[];const snap:LayerSnapshot={layerId:Number(l.id),name:String(l.name),path,parentPath,parentGroup:parentPath?.split(' > ').at(-1)??null,depth,type:kind(l,detail),bounds:rect(l.bounds),boundsNoEffects:rect(l.boundsNoEffects??l.bounds),visible:Boolean(l.visible),opacity:n(l.opacity),blendMode:String(l.blendMode??'normal'),locked:Boolean(l.locked),locks:{all:Boolean(l.allLocked),pixels:Boolean(l.pixelsLocked),position:Boolean(l.positionLocked),transparent:Boolean(l.transparentPixelsLocked)},clipping:Boolean(l.isClippingMask??detail.group),masks:{pixel:Boolean(detail.hasUserMask),vector:Boolean(detail.hasVectorMask),filter:Boolean(detail.hasFilterMask)},smartObject:Boolean(detail.smartObject),text:textMeta(l),children:[],childIds:children.map(c=>Number(c.id)),siblingIds:ids.filter(id=>id!==Number(l.id)),zIndex:i};snap.children=await walk(children,path,depth+1);out.push(snap);onProgress?.(++done)}return out
  }
  return walk(Array.from(document.layers??[]) as any[],null,0);
}
export function flattenLayers(tree:LayerSnapshot[]):LayerSnapshot[]{return tree.flatMap(l=>[l,...flattenLayers(l.children)])}
