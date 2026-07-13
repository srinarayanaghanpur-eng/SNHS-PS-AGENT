// Emits ExtendScript (ES3) that renders a Plan in Photoshop as fully editable
// layers: solid/gradient fill layers with masks, rounded-rect and ellipse
// shapes via ActionManager, layer styles (shadow/glow/stroke), placed photos
// as Smart Objects with cover-fit transforms and rounded/circle masks, and
// point-text layers with an exact in-Photoshop width-fit pass.

import type { Effects, Plan, PlanNode } from './types';
import { wrapLines } from './textFit';

// ExtendScript evaluates the .jsx in the system codepage, so any non-ASCII
// character must travel as a \uXXXX escape or it renders as mojibake.
const jsStr = (v: string) => JSON.stringify(v).replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

function hexToRgbCall(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

const HELPERS = String.raw`
function cTID(s){return charIDToTypeID(s);}function sTID(s){return stringIDToTypeID(s);}
function rgbDesc(r,g,b){var c=new ActionDescriptor();c.putDouble(cTID('Rd  '),r);c.putDouble(cTID('Grn '),g);c.putDouble(cTID('Bl  '),b);return c;}
function solid(r,g,b){var c=new SolidColor();c.rgb.red=r;c.rgb.green=g;c.rgb.blue=b;return c;}
function intoGroup(group,name){var l=doc.activeLayer;l.name=name;l.move(group,ElementPlacement.INSIDE);return l;}
function boundsDesc(l,t,r,b,radius){var d=new ActionDescriptor();d.putUnitDouble(cTID('Top '),cTID('#Pxl'),t);d.putUnitDouble(cTID('Left'),cTID('#Pxl'),l);d.putUnitDouble(cTID('Btom'),cTID('#Pxl'),b);d.putUnitDouble(cTID('Rght'),cTID('#Pxl'),r);if(radius&&radius>0){d.putUnitDouble(sTID('topLeft'),cTID('#Pxl'),radius);d.putUnitDouble(sTID('topRight'),cTID('#Pxl'),radius);d.putUnitDouble(sTID('bottomLeft'),cTID('#Pxl'),radius);d.putUnitDouble(sTID('bottomRight'),cTID('#Pxl'),radius);}return d;}
function shapeLayer(group,name,r,g,b,l,t,rr,bb,radius,ellipse){
  var d=new ActionDescriptor();var ref=new ActionReference();ref.putClass(sTID('contentLayer'));d.putReference(cTID('null'),ref);
  var use=new ActionDescriptor();var typ=new ActionDescriptor();typ.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(r,g,b));
  use.putObject(cTID('Type'),sTID('solidColorLayer'),typ);
  use.putObject(cTID('Shp '),ellipse?cTID('Elps'):cTID('Rctn'),boundsDesc(l,t,rr,bb,radius));
  d.putObject(cTID('Usng'),sTID('contentLayer'),use);
  executeAction(cTID('Mk  '),d,DialogModes.NO);
  return intoGroup(group,name);
}
function selRect(l,t,r,b,radius){var d=new ActionDescriptor();var ref=new ActionReference();ref.putProperty(cTID('Chnl'),cTID('fsel'));d.putReference(cTID('null'),ref);d.putObject(cTID('T   '),radius&&radius>0?cTID('Rctn'):cTID('Rctn'),boundsDesc(l,t,r,b,radius));executeAction(cTID('setd'),d,DialogModes.NO);}
function selEllipse(l,t,r,b){var d=new ActionDescriptor();var ref=new ActionReference();ref.putProperty(cTID('Chnl'),cTID('fsel'));d.putReference(cTID('null'),ref);d.putObject(cTID('T   '),cTID('Elps'),boundsDesc(l,t,r,b,0));executeAction(cTID('setd'),d,DialogModes.NO);}
function maskFromSelection(){var d=new ActionDescriptor();d.putClass(cTID('Nw  '),cTID('Chnl'));var ref=new ActionReference();ref.putEnumerated(cTID('Chnl'),cTID('Chnl'),cTID('Msk '));d.putReference(cTID('At  '),ref);d.putEnumerated(cTID('Usng'),cTID('UsrM'),cTID('RvlS'));executeAction(cTID('Mk  '),d,DialogModes.NO);}
function gradientLayer(group,name,stops,angle){
  var d=new ActionDescriptor();var ref=new ActionReference();ref.putClass(sTID('contentLayer'));d.putReference(cTID('null'),ref);
  var use=new ActionDescriptor();var typ=new ActionDescriptor();
  typ.putEnumerated(cTID('Type'),cTID('GrdT'),cTID('Lnr '));
  typ.putUnitDouble(cTID('Angl'),cTID('#Ang'),angle);
  var grad=new ActionDescriptor();grad.putString(cTID('Nm  '),'SNHS');grad.putEnumerated(cTID('GrdF'),cTID('GrdF'),cTID('CstS'));grad.putDouble(cTID('Intr'),4096);
  var clrs=new ActionList();
  for(var i=0;i<stops.length;i++){var s=new ActionDescriptor();s.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(stops[i][0],stops[i][1],stops[i][2]));s.putEnumerated(cTID('Type'),cTID('Clry'),cTID('UsrS'));s.putInteger(cTID('Lctn'),Math.round(stops[i][3]*40.96));s.putInteger(cTID('Mdpn'),50);clrs.putObject(cTID('Clrt'),s);}
  grad.putList(cTID('Clrs'),clrs);
  var trns=new ActionList();
  for(var j=0;j<2;j++){var o=new ActionDescriptor();o.putUnitDouble(cTID('Opct'),cTID('#Prc'),100);o.putInteger(cTID('Lctn'),j*4096);o.putInteger(cTID('Mdpn'),50);trns.putObject(cTID('TrnS'),o);}
  grad.putList(cTID('Trns'),trns);
  typ.putObject(cTID('Grad'),cTID('Grdn'),grad);
  use.putObject(cTID('Type'),sTID('gradientLayer'),typ);
  d.putObject(cTID('Usng'),sTID('contentLayer'),use);
  executeAction(cTID('Mk  '),d,DialogModes.NO);
  return intoGroup(group,name);
}
function fxDesc(){var lefx=new ActionDescriptor();lefx.putUnitDouble(cTID('Scl '),cTID('#Prc'),100);return lefx;}
function shadowDesc(r,g,b,opacity,distance,size,angle){var d=new ActionDescriptor();d.putBoolean(cTID('enab'),true);d.putEnumerated(cTID('Md  '),cTID('BlnM'),cTID('Mltp'));d.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(r,g,b));d.putUnitDouble(cTID('Opct'),cTID('#Prc'),opacity);d.putBoolean(cTID('uglg'),false);d.putUnitDouble(cTID('lagl'),cTID('#Ang'),angle);d.putUnitDouble(cTID('Dstn'),cTID('#Pxl'),distance);d.putUnitDouble(cTID('Ckmt'),cTID('#Pxl'),0);d.putUnitDouble(cTID('blur'),cTID('#Pxl'),size);d.putUnitDouble(cTID('Nose'),cTID('#Prc'),0);d.putBoolean(sTID('layerConceals'),true);return d;}
function glowDesc(r,g,b,opacity,size){var d=new ActionDescriptor();d.putBoolean(cTID('enab'),true);d.putEnumerated(cTID('Md  '),cTID('BlnM'),cTID('Scrn'));d.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(r,g,b));d.putUnitDouble(cTID('Opct'),cTID('#Prc'),opacity);d.putEnumerated(cTID('GlwT'),cTID('BETE'),cTID('SfBL'));d.putUnitDouble(cTID('Ckmt'),cTID('#Pxl'),0);d.putUnitDouble(cTID('blur'),cTID('#Pxl'),size);return d;}
function strokeDesc(r,g,b,size,opacity){var d=new ActionDescriptor();d.putBoolean(cTID('enab'),true);d.putEnumerated(cTID('Styl'),cTID('FStl'),cTID('OutF'));d.putEnumerated(cTID('PntT'),cTID('FrFl'),cTID('SClr'));d.putEnumerated(cTID('Md  '),cTID('BlnM'),cTID('Nrml'));d.putUnitDouble(cTID('Opct'),cTID('#Prc'),opacity);d.putUnitDouble(cTID('Sz  '),cTID('#Pxl'),size);d.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(r,g,b));return d;}
function applyFx(lefx){var d=new ActionDescriptor();var ref=new ActionReference();ref.putProperty(cTID('Prpr'),cTID('Lefx'));ref.putEnumerated(cTID('Lyr '),cTID('Ordn'),cTID('Trgt'));d.putReference(cTID('null'),ref);d.putObject(cTID('T   '),cTID('Lefx'),lefx);executeAction(cTID('setd'),d,DialogModes.NO);}
function placeFile(path){var d=new ActionDescriptor();d.putPath(cTID('null'),new File(path));d.putEnumerated(cTID('FTcs'),cTID('QCSt'),cTID('Qcsa'));executeAction(cTID('Plc '),d,DialogModes.NO);return doc.activeLayer;}
// Photoshop does NOT throw when asked for a missing font; it silently applies
// its default (e.g. MyriadPro). So we verify ti.font actually matches before
// accepting a candidate, otherwise the controlled Arial fallback never runs.
function setFont(ti,names){var fell=null;for(var i=0;i<names.length;i++){try{ti.font=names[i];if(ti.font==names[i])return names[i];if(!fell)fell=ti.font;}catch(e){}}return fell||ti.font;}
function addPointText(group,name,content,fonts,size,minSize,r,g,b,x,y,w,align,tracking,leadingFactor){
  var layer=group.artLayers.add();layer.kind=LayerKind.TEXT;layer.name=name;
  var ti=layer.textItem;ti.kind=TextType.POINTTEXT;
  setFont(ti,fonts);
  ti.size=new UnitValue(size,'px');
  try{ti.useAutoLeading=false;ti.leading=new UnitValue(Math.round(size*leadingFactor),'px');}catch(eL){}
  if(tracking)try{ti.tracking=tracking;}catch(eT){}
  ti.color=solid(r,g,b);
  ti.contents=content;
  ti.position=[new UnitValue(x,'px'),new UnitValue(y+size,'px')];
  // exact width fit: shrink until the rendered bounds fit the box width
  var guard=0;
  while(guard++<30){
    var bnds=layer.bounds;var tw=bnds[2].value-bnds[0].value;
    if(tw<=w*1.02||ti.size.value<=minSize)break;
    var next=Math.max(minSize,Math.floor(ti.size.value*0.94));
    ti.size=new UnitValue(next,'px');
    try{ti.leading=new UnitValue(Math.round(next*leadingFactor),'px');}catch(eL2){}
  }
  // horizontal alignment inside the box
  var fb=layer.bounds;var fw=fb[2].value-fb[0].value;var dx=0;
  if(align==='center')dx=(x+(w-fw)/2)-fb[0].value;else if(align==='right')dx=(x+w-fw)-fb[0].value;else dx=x-fb[0].value;
  if(Math.abs(dx)>0.5)layer.translate(new UnitValue(dx,'px'),new UnitValue(0,'px'));
  return layer;
}
`;

function emitEffects(fx: Effects | undefined): string {
  if (!fx) return '';
  const parts: string[] = ['var lefx=fxDesc();'];
  if (fx.shadow) parts.push(`lefx.putObject(cTID('DrSh'),cTID('DrSh'),shadowDesc(${hexToRgbCall(fx.shadow.hex)},${fx.shadow.opacity},${fx.shadow.distance},${fx.shadow.size},${fx.shadow.angle}));`);
  if (fx.glow) parts.push(`lefx.putObject(cTID('OrGl'),cTID('OrGl'),glowDesc(${hexToRgbCall(fx.glow.hex)},${fx.glow.opacity},${fx.glow.size}));`);
  if (fx.stroke) parts.push(`lefx.putObject(cTID('FrFX'),cTID('FrFX'),strokeDesc(${hexToRgbCall(fx.stroke.hex)},${fx.stroke.size},${fx.stroke.opacity ?? 100}));`);
  parts.push('applyFx(lefx);');
  return parts.join('');
}

function emitNode(node: PlanNode, groupVar: string, plan: Plan): string {
  const lines: string[] = [];
  const o = (v: number | undefined, layerVar: string) => (v !== undefined && v < 100 ? `${layerVar}.opacity=${v};` : '');
  if (node.kind === 'rect' || node.kind === 'ellipse') {
    const rct = node.rect;
    const radius = node.kind === 'rect' ? (node.radius ?? 0) : 0;
    lines.push(`var ly=shapeLayer(${groupVar},${jsStr(node.name)},${hexToRgbCall(node.hex)},${rct.x},${rct.y},${rct.x + rct.w},${rct.y + rct.h},${radius},${node.kind === 'ellipse'});`);
    lines.push(o(node.opacity, 'ly'));
    lines.push(emitEffects(node.effects));
  } else if (node.kind === 'gradient') {
    const rct = node.rect;
    const stops = node.stops.map((s) => `[${hexToRgbCall(s.hex)},${s.position}]`).join(',');
    const isFull = rct.x <= 0 && rct.y <= 0 && rct.w >= plan.width && rct.h >= plan.height;
    if (!isFull) lines.push(`selRect(${rct.x},${rct.y},${rct.x + rct.w},${rct.y + rct.h},0);`);
    lines.push(`var ly=gradientLayer(${groupVar},${jsStr(node.name)},[${stops}],${node.angle});`);
    if (!isFull) lines.push('try{doc.selection.deselect();}catch(eD){}');
    lines.push(o(node.opacity, 'ly'));
  } else if (node.kind === 'text') {
    const size = node.size;
    const lineHeight = node.lineHeight ?? 1.2;
    const wrapped = node.content.includes('\r')
      ? node.content.split('\r')
      : wrapLines(node.content, size, node.rect.w, node.font, node.tracking ?? 0);
    const content = wrapped.join('\r');
    lines.push(`var ly=addPointText(${groupVar},${jsStr(node.name)},${jsStr(content)},[${jsStr(node.font)},'Arial-BoldMT','ArialMT'],${size},${node.minSize},${hexToRgbCall(node.hex)},${node.rect.x},${node.rect.y},${node.rect.w},${jsStr(node.align)},${node.tracking ?? 0},${lineHeight});`);
    lines.push(emitEffects(node.effects));
  } else if (node.kind === 'photo') {
    const rct = node.rect;
    const fit = node.fit ?? 'cover';
    const zoom = node.zoom ?? 1;
    const focusY = node.focusY ?? 0.38;
    // offsetX/Y (-1..1) nudge the crop within the overflow; for logos they are 0.
    const offX = node.offsetX ?? 0;
    const offY = node.offsetY ?? 0;
    lines.push(`try{`);
    lines.push(`var ph=placeFile(${jsStr(node.path.replace(/\\/g, '/'))});ph.name=${jsStr(node.name)};`);
    lines.push(`var pb=ph.bounds;var pw=pb[2].value-pb[0].value;var phh=pb[3].value-pb[1].value;`);
    if (fit === 'contain') {
      // fit whole image inside the box, preserve aspect ratio, never crop
      lines.push(`var sc=Math.min(${rct.w}/pw,${rct.h}/phh)*100;ph.resize(sc,sc,AnchorPosition.MIDDLECENTER);`);
      lines.push(`pb=ph.bounds;pw=pb[2].value-pb[0].value;phh=pb[3].value-pb[1].value;`);
      lines.push(`var tx=${rct.x}+((${rct.w}-pw)/2)-pb[0].value;var tyv=${rct.y}+((${rct.h}-phh)/2)-pb[1].value;ph.translate(new UnitValue(tx,'px'),new UnitValue(tyv,'px'));`);
    } else {
      // cover-fit with user zoom, then translate honouring focus + offsets
      lines.push(`var sc=Math.max(${rct.w}/pw,${rct.h}/phh)*${zoom}*100;ph.resize(sc,sc,AnchorPosition.MIDDLECENTER);`);
      lines.push(`pb=ph.bounds;pw=pb[2].value-pb[0].value;phh=pb[3].value-pb[1].value;`);
      lines.push(`var ox=(pw-${rct.w})/2*(1+${offX});var oy=(phh-${rct.h})*(${focusY}+ ${offY}*0.5);`);
      lines.push(`var tx=${rct.x}-ox-pb[0].value;var tyv=${rct.y}-oy-pb[1].value;ph.translate(new UnitValue(tx,'px'),new UnitValue(tyv,'px'));`);
    }
    if (node.mask === 'circle') lines.push(`selEllipse(${rct.x},${rct.y},${rct.x + rct.w},${rct.y + rct.h});maskFromSelection();`);
    else if (node.mask === 'rounded') lines.push(`selRect(${rct.x},${rct.y},${rct.x + rct.w},${rct.y + rct.h},${node.radius ?? 24});maskFromSelection();`);
    else if (node.mask === 'rect') lines.push(`selRect(${rct.x},${rct.y},${rct.x + rct.w},${rct.y + rct.h},0);maskFromSelection();`);
    // mask 'none' (logos): leave the placed layer un-masked to keep transparency
    lines.push(`ph.move(${groupVar},ElementPlacement.INSIDE);`);
    lines.push(emitEffects(node.effects));
    lines.push(`}catch(ePh){warn.push('PHOTO_FAILED:'+${jsStr(node.name)}+':'+ePh.message);}`);
  }
  return lines.filter(Boolean).join('\n');
}

export interface EmitOptions { outputDir: string; exportPng: boolean; exportJpg: boolean; docName: string }

export function emitJsx(plan: Plan, opts: EmitOptions): string {
  const out = opts.outputDir.replace(/\\/g, '/');
  const body: string[] = [];
  plan.groups.forEach((group, gi) => {
    const groupVar = `grp${gi}`;
    body.push(`var ${groupVar}=doc.layerSets.add();${groupVar}.name=${jsStr(group.name)};`);
    for (const node of group.nodes) body.push(emitNode(node, groupVar, plan));
    if (group.opacity !== undefined && group.opacity < 100) body.push(`${groupVar}.opacity=${group.opacity};`);
    if (group.visible === false) body.push(`${groupVar}.visible=false;`);
  });
  // layerSets.add() stacks each new group above the previous one, so creating
  // groups in plan order leaves 00_BACKGROUND at the bottom and 08_EFFECTS on top.
  return `#target photoshop
(function(){
var out=new Folder(${jsStr(out)});if(!out.exists)out.create();
var resultFile=new File(out.fsName+'/result.json');var doc=null;var warn=[];
function esc(s){return String(s).replace(/\\\\/g,'\\\\\\\\').replace(/"/g,'\\\\"').replace(/\\r/g,'\\\\r').replace(/\\n/g,'\\\\n');}
function writeResult(ok,detail,psd,jpg,png){resultFile.encoding='UTF8';resultFile.open('w');resultFile.write('{"success":'+(ok?'true':'false')+',"details":"'+esc(detail)+'","psdPath":"'+esc(psd||'')+'","jpgPath":"'+esc(jpg||'')+'","pngPath":"'+esc(png||'')+'","warnings":"'+esc(warn.join('|'))+'"}');resultFile.close();}
${HELPERS}
try{
app.displayDialogs=DialogModes.NO;
var prevRuler=app.preferences.rulerUnits;var prevType=app.preferences.typeUnits;
app.preferences.rulerUnits=Units.PIXELS;app.preferences.typeUnits=TypeUnits.PIXELS;
doc=app.documents.add(${plan.width},${plan.height},72,${jsStr(opts.docName)},NewDocumentMode.RGB,DocumentFill.WHITE);
${body.join('\n')}
var psd=new File(out.fsName+'/poster.psd');doc.saveAs(psd,new PhotoshopSaveOptions(),true,Extension.LOWERCASE);
${opts.exportJpg ? `var jpg=new File(out.fsName+'/poster.jpg');var jo=new JPEGSaveOptions();jo.quality=12;jo.embedColorProfile=true;doc.saveAs(jpg,jo,true,Extension.LOWERCASE);` : 'var jpg={fsName:""};'}
${opts.exportPng ? `var png=new File(out.fsName+'/poster.png');var po=new PNGSaveOptions();po.compression=6;doc.saveAs(png,po,true,Extension.LOWERCASE);` : 'var png={fsName:""};'}
writeResult(true,'Poster composed with '+doc.layers.length+' top groups.',psd.fsName,jpg.fsName,png.fsName);
}catch(e){writeResult(false,(e&&e.message)?e.message:String(e),'','','');}
finally{try{app.preferences.rulerUnits=prevRuler;app.preferences.typeUnits=prevType;}catch(eU){}if(doc){try{doc.close(SaveOptions.DONOTSAVECHANGES);}catch(eC){}}}
}());`;
}
