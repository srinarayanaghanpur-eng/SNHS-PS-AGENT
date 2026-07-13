// Operation → ExtendScript (ES3) emitter for the Design Assistant.
//
// Emits targeted JSX that operates on Photoshop layers *by layer ID* (never by
// blind mouse/keyboard automation). Each command runs inside a snapshot-first
// wrapper so a failed operation does not leave the document half-modified
// (§ Photoshop execution). Only trusted emitter functions here produce JSX;
// raw AI/renderer strings are never evaluated.

import type { ActionPlan, Operation } from './types';

const NON_ASCII = new RegExp('[\\u0080-\\uffff]', 'g');
const escapeUnicode = (v: string) => v.replace(NON_ASCII, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
const jsStr = (v: string) => escapeUnicode(JSON.stringify(v));
const rgb = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');

// Friendly blend-mode names → DOM BlendMode enum member.
const BLEND_MODES: Record<string, string> = {
  normal: 'NORMAL', multiply: 'MULTIPLY', screen: 'SCREEN', overlay: 'OVERLAY',
  darken: 'DARKEN', lighten: 'LIGHTEN', 'soft light': 'SOFTLIGHT', softlight: 'SOFTLIGHT',
  'hard light': 'HARDLIGHT', hardlight: 'HARDLIGHT', 'color dodge': 'COLORDODGE',
  'color burn': 'COLORBURN', difference: 'DIFFERENCE', exclusion: 'EXCLUSION',
  hue: 'HUE', saturation: 'SATURATION', color: 'COLORBLEND', luminosity: 'LUMINOSITY',
  add: 'LINEARDODGE', linear: 'LINEARDODGE',
};
function blendEnum(mode: string): string { return BLEND_MODES[mode.toLowerCase()] ?? 'NORMAL'; }

// Shared ES3 helpers. Uses ActionManager for effects/fills that the DOM cannot
// express, and reads existing layer effects before modifying so removing one
// effect preserves the others.
const HELPERS = String.raw`
function cTID(s){return charIDToTypeID(s);}function sTID(s){return stringIDToTypeID(s);}
function selectById(id){var r=new ActionReference();r.putIdentifier(cTID('Lyr '),id);var d=new ActionDescriptor();d.putReference(cTID('null'),r);d.putBoolean(cTID('MkVs'),false);executeAction(cTID('slct'),d,DialogModes.NO);return doc.activeLayer;}
function snapshot(name){var d=new ActionDescriptor();var r=new ActionReference();r.putClass(cTID('SnpS'));d.putReference(cTID('null'),r);var f=new ActionReference();f.putProperty(cTID('HstS'),cTID('CrnH'));var fr=new ActionDescriptor();fr.putReference(cTID('From'),f);d.putObject(cTID('Usng'),cTID('HstS'),fr);d.putString(cTID('Nm  '),name);executeAction(cTID('Mk  '),d,DialogModes.NO);}
function solid(r,g,b){var c=new SolidColor();c.rgb.red=r;c.rgb.green=g;c.rgb.blue=b;return c;}
function rgbDesc(r,g,b){var c=new ActionDescriptor();c.putDouble(cTID('Rd  '),r);c.putDouble(cTID('Grn '),g);c.putDouble(cTID('Bl  '),b);return c;}
function boundsOf(l){var b=l.bounds;return{x:b[0].value,y:b[1].value,w:b[2].value-b[0].value,h:b[3].value-b[1].value};}
function centerTranslate(l,edge,dw,dh){var b=boundsOf(l);var dx=0,dy=0;
  if(edge=='centerH')dx=(dw-b.w)/2-b.x;else if(edge=='centerV')dy=(dh-b.h)/2-b.y;
  else if(edge=='left')dx=-b.x;else if(edge=='right')dx=dw-b.w-b.x;
  else if(edge=='top')dy=-b.y;else if(edge=='bottom')dy=dh-b.h-b.y;
  l.translate(new UnitValue(dx,'px'),new UnitValue(dy,'px'));}
function setLayerVisible(l,v){l.visible=v;}
function toTitle(s){return s.replace(/\w\S*/g,function(t){return t.charAt(0).toUpperCase()+t.substr(1).toLowerCase();});}

// ── Fill ────────────────────────────────────────────────────────────────
function setFillLayerColor(r,g,b){var d=new ActionDescriptor();var ref=new ActionReference();ref.putEnumerated(cTID('Lyr '),cTID('Ordn'),cTID('Trgt'));d.putReference(cTID('null'),ref);var t=new ActionDescriptor();t.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(r,g,b));d.putObject(cTID('T   '),sTID('solidColorLayer'),t);executeAction(cTID('setd'),d,DialogModes.NO);}
function fillWithColor(L,r,g,b){
  try{setFillLayerColor(r,g,b);return;}catch(e){}
  // pixel layer: fill only opaque pixels (preserve transparency)
  var fg=app.foregroundColor;app.foregroundColor=solid(r,g,b);
  try{var d=new ActionDescriptor();d.putEnumerated(cTID('Usng'),cTID('FlCn'),cTID('FrgC'));d.putUnitDouble(cTID('Opct'),cTID('#Prc'),100);d.putBoolean(cTID('PrsT'),true);d.putEnumerated(cTID('Md  '),cTID('BlnM'),cTID('Nrml'));executeAction(cTID('Fl  '),d,DialogModes.NO);}catch(e2){}
  app.foregroundColor=fg;}

// ── Layer effects (read-modify-write so we never wipe other effects) ──────
function getLefx(){try{var ref=new ActionReference();ref.putProperty(cTID('Prpr'),cTID('Lefx'));ref.putEnumerated(cTID('Lyr '),cTID('Ordn'),cTID('Trgt'));var d=executeActionGet(ref);if(d.hasKey(cTID('Lefx')))return d.getObjectValue(cTID('Lefx'));}catch(e){}var n=new ActionDescriptor();n.putUnitDouble(cTID('Scl '),cTID('#Prc'),100);return n;}
function putLefx(lefx){var d=new ActionDescriptor();var ref=new ActionReference();ref.putProperty(cTID('Prpr'),cTID('Lefx'));ref.putEnumerated(cTID('Lyr '),cTID('Ordn'),cTID('Trgt'));d.putReference(cTID('null'),ref);d.putObject(cTID('T   '),cTID('Lefx'),lefx);executeAction(cTID('setd'),d,DialogModes.NO);}
function shadowDesc(r,g,b,opacity,distance,size,angle){var d=new ActionDescriptor();d.putBoolean(cTID('enab'),true);d.putEnumerated(cTID('Md  '),cTID('BlnM'),cTID('Mltp'));d.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(r,g,b));d.putUnitDouble(cTID('Opct'),cTID('#Prc'),opacity);d.putBoolean(cTID('uglg'),false);d.putUnitDouble(cTID('lagl'),cTID('#Ang'),angle);d.putUnitDouble(cTID('Dstn'),cTID('#Pxl'),distance);d.putUnitDouble(cTID('Ckmt'),cTID('#Pxl'),0);d.putUnitDouble(cTID('blur'),cTID('#Pxl'),size);return d;}
function strokeDesc(r,g,b,size,opacity){var d=new ActionDescriptor();d.putBoolean(cTID('enab'),true);d.putEnumerated(cTID('Styl'),cTID('FStl'),cTID('OutF'));d.putEnumerated(cTID('PntT'),cTID('FrFl'),cTID('SClr'));d.putEnumerated(cTID('Md  '),cTID('BlnM'),cTID('Nrml'));d.putUnitDouble(cTID('Opct'),cTID('#Prc'),opacity);d.putUnitDouble(cTID('Sz  '),cTID('#Pxl'),size);d.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(r,g,b));return d;}
function addShadowFx(){var fx=getLefx();fx.putObject(cTID('DrSh'),cTID('DrSh'),shadowDesc(0,0,0,35,5,10,120));putLefx(fx);}
function addStrokeFx(r,g,b,size){var fx=getLefx();fx.putObject(cTID('FrFX'),cTID('FrFX'),strokeDesc(r,g,b,size,100));putLefx(fx);}
function disableFx(effChar){var fx=getLefx();if(fx.hasKey(cTID(effChar))){var e=fx.getObjectValue(cTID(effChar));e.putBoolean(cTID('enab'),false);fx.putObject(cTID(effChar),cTID(effChar),e);putLefx(fx);}}

// ── Overlay (full-canvas solid fill layer above the active layer) ─────────
function makeOverlay(r,g,b,opacity){
  var d=new ActionDescriptor();var ref=new ActionReference();ref.putClass(sTID('contentLayer'));d.putReference(cTID('null'),ref);
  var use=new ActionDescriptor();var typ=new ActionDescriptor();typ.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(r,g,b));
  use.putObject(cTID('Type'),sTID('solidColorLayer'),typ);d.putObject(cTID('Usng'),sTID('contentLayer'),use);
  executeAction(cTID('Mk  '),d,DialogModes.NO);
  var ov=doc.activeLayer;ov.name='Assistant Overlay';ov.opacity=opacity;return ov;}

// ── Clipped adjustment layers (non-destructive) ───────────────────────────
function clipToPrevious(){var d=new ActionDescriptor();var ref=new ActionReference();ref.putEnumerated(cTID('Lyr '),cTID('Ordn'),cTID('Trgt'));d.putReference(cTID('null'),ref);executeAction(sTID('groupEvent'),d,DialogModes.NO);}
function addBrightnessContrast(brightness){
  var d=new ActionDescriptor();var ref=new ActionReference();ref.putClass(cTID('AdjL'));d.putReference(cTID('null'),ref);
  var type=new ActionDescriptor();var bc=new ActionDescriptor();bc.putEnumerated(cTID('Type'),cTID('adjustment'),sTID('brightnessEvent'));
  type.putObject(cTID('Type'),sTID('brightnessEvent'),bc);d.putObject(cTID('Usng'),cTID('AdjL'),type);
  executeAction(cTID('Mk  '),d,DialogModes.NO);
  var set=new ActionDescriptor();var sref=new ActionReference();sref.putEnumerated(cTID('Lyr '),cTID('Ordn'),cTID('Trgt'));set.putReference(cTID('null'),sref);
  var v=new ActionDescriptor();v.putInteger(sTID('brightness'),Math.round(brightness));v.putInteger(cTID('Cntr'),0);v.putBoolean(sTID('useLegacy'),false);
  set.putObject(cTID('T   '),sTID('brightnessEvent'),v);executeAction(cTID('setd'),set,DialogModes.NO);
  clipToPrevious();}
function addHueSaturation(sat){
  var d=new ActionDescriptor();var ref=new ActionReference();ref.putClass(cTID('AdjL'));d.putReference(cTID('null'),ref);
  var type=new ActionDescriptor();var hs=new ActionDescriptor();hs.putEnumerated(cTID('Type'),cTID('adjustment'),cTID('HStr'));
  type.putObject(cTID('Type'),cTID('HStr'),hs);d.putObject(cTID('Usng'),cTID('AdjL'),type);
  executeAction(cTID('Mk  '),d,DialogModes.NO);
  var set=new ActionDescriptor();var sref=new ActionReference();sref.putEnumerated(cTID('Lyr '),cTID('Ordn'),cTID('Trgt'));set.putReference(cTID('null'),sref);
  var v=new ActionDescriptor();v.putBoolean(cTID('Clrz'),false);var list=new ActionList();var a=new ActionDescriptor();a.putInteger(cTID('H   '),0);a.putInteger(cTID('Strt'),Math.round(sat));a.putInteger(cTID('Lght'),0);list.putObject(cTID('Hst2'),a);v.putList(cTID('Adjs'),list);
  set.putObject(cTID('T   '),cTID('HStr'),v);executeAction(cTID('setd'),set,DialogModes.NO);
  clipToPrevious();}

// ── Rounded-corner mask from the layer's own bounds ───────────────────────
function selRoundedRect(l,t,r,b,radius){var d=new ActionDescriptor();var ref=new ActionReference();ref.putProperty(cTID('Chnl'),cTID('fsel'));d.putReference(cTID('null'),ref);var rc=new ActionDescriptor();rc.putUnitDouble(cTID('Top '),cTID('#Pxl'),t);rc.putUnitDouble(cTID('Left'),cTID('#Pxl'),l);rc.putUnitDouble(cTID('Btom'),cTID('#Pxl'),b);rc.putUnitDouble(cTID('Rght'),cTID('#Pxl'),r);if(radius>0){rc.putUnitDouble(sTID('topLeft'),cTID('#Pxl'),radius);rc.putUnitDouble(sTID('topRight'),cTID('#Pxl'),radius);rc.putUnitDouble(sTID('bottomLeft'),cTID('#Pxl'),radius);rc.putUnitDouble(sTID('bottomRight'),cTID('#Pxl'),radius);}d.putObject(cTID('T   '),cTID('Rctn'),rc);executeAction(cTID('setd'),d,DialogModes.NO);}
function maskFromSelection(){var d=new ActionDescriptor();d.putClass(cTID('Nw  '),cTID('Chnl'));var ref=new ActionReference();ref.putEnumerated(cTID('Chnl'),cTID('Chnl'),cTID('Msk '));d.putReference(cTID('At  '),ref);d.putEnumerated(cTID('Usng'),cTID('UsrM'),cTID('RvlS'));executeAction(cTID('Mk  '),d,DialogModes.NO);}
function roundCorners(L,radius){var b=boundsOf(L);selRoundedRect(b.x,b.y,b.x+b.w,b.y+b.h,radius);maskFromSelection();try{doc.selection.deselect();}catch(e){}}

// ── Replace Smart Object contents ─────────────────────────────────────────
function replaceSOContents(path){var d=new ActionDescriptor();d.putPath(cTID('null'),new File(path));d.putInteger(cTID('PgNm'),1);executeAction(sTID('placedLayerReplaceContents'),d,DialogModes.NO);}
`;

// Emit the JSX for a single operation given the active layer var `L`.
function emitOperation(op: Operation): string {
  switch (op.type) {
    case 'translate':
      return `L.translate(new UnitValue(${op.x},'px'),new UnitValue(${op.y},'px'));`;
    case 'align':
      return `centerTranslate(L,${jsStr(op.edge)},doc.width.value,doc.height.value);`;
    case 'scale': {
      const p = op.percentage;
      return `L.resize(${p},${op.maintainAspectRatio ? p : p},AnchorPosition.MIDDLECENTER);`;
    }
    case 'setSize': {
      const parts: string[] = ['var b=boundsOf(L);'];
      if (op.width != null && op.height != null && !op.maintainAspectRatio) {
        parts.push(`L.resize(${op.width}/b.w*100,${op.height}/b.h*100,AnchorPosition.MIDDLECENTER);`);
      } else if (op.width != null) {
        parts.push(`var s=${op.width}/b.w*100;L.resize(s,s,AnchorPosition.MIDDLECENTER);`);
      } else if (op.height != null) {
        parts.push(`var s=${op.height}/b.h*100;L.resize(s,s,AnchorPosition.MIDDLECENTER);`);
      }
      return parts.join('');
    }
    case 'reorder': {
      const map: Record<string, string> = { forward: 'ElementPlacement.PLACEBEFORE', backward: 'ElementPlacement.PLACEAFTER' };
      if (op.direction === 'front') return `L.move(doc,ElementPlacement.PLACEATBEGINNING);`;
      if (op.direction === 'back') return `L.move(doc,ElementPlacement.PLACEATEND);`;
      return `try{L.move(L,${map[op.direction]});}catch(eR){}`;
    }
    case 'setTextColor':
      return `if(L.kind==LayerKind.TEXT){L.textItem.color=solid(${rgb(op.hex)});}`;
    case 'setFillColor':
      return `fillWithColor(L,${rgb(op.hex)});`;
    case 'setStrokeColor':
      return `addStrokeFx(${rgb(op.hex)},${op.size});`;
    case 'removeStroke':
      return `disableFx('FrFX');`;
    case 'setOpacity':
      return `L.opacity=${op.opacity};`;
    case 'adjustOpacity':
      return `L.opacity=Math.max(0,Math.min(100,L.opacity+(${op.delta})));`;
    case 'setBlendMode':
      return `try{L.blendMode=BlendMode.${blendEnum(op.mode)};}catch(eBm){}`;
    case 'setVisibility':
      return `setLayerVisible(L,${op.visible});`;
    case 'delete':
      // non-destructive default: hide + preserve (executor overrides for true delete)
      return `L.visible=false;`;
    case 'duplicate':
      return `L.duplicate();`;
    case 'setLock':
      return `L.allLocked=${op.locked};`;
    case 'rename':
      return `L.name=${jsStr(op.name)};`;
    case 'replaceText':
      return `if(L.kind==LayerKind.TEXT){L.textItem.contents=${jsStr(op.text)};}`;
    case 'setFont':
      return `if(L.kind==LayerKind.TEXT){try{L.textItem.font=${jsStr(op.fontName)};}catch(eFo){}}`;
    case 'setFontSize':
      return `if(L.kind==LayerKind.TEXT){L.textItem.size=new UnitValue(${op.size},'px');}`;
    case 'setTextCase':
      return op.mode === 'upper'
        ? `if(L.kind==LayerKind.TEXT){L.textItem.contents=String(L.textItem.contents).toUpperCase();}`
        : op.mode === 'title'
          ? `if(L.kind==LayerKind.TEXT){L.textItem.contents=toTitle(String(L.textItem.contents));}`
          : `if(L.kind==LayerKind.TEXT){var s=String(L.textItem.contents);L.textItem.contents=s.charAt(0).toUpperCase()+s.slice(1).toLowerCase();}`;
    case 'setBold':
      return `if(L.kind==LayerKind.TEXT){try{L.textItem.fauxBold=${op.bold};}catch(eB){}}`;
    case 'setAlignment': {
      const jn = { left: 'Justification.LEFT', center: 'Justification.CENTER', right: 'Justification.RIGHT' }[op.align];
      return `if(L.kind==LayerKind.TEXT){try{L.textItem.justification=${jn};}catch(eJ){}}`;
    }
    case 'addShadow':
      return `addShadowFx();`;
    case 'removeShadow':
      return `disableFx('DrSh');`;
    case 'addOverlay': {
      // dark → black, light → white, gradient handled as dark for now.
      const hex = op.tone === 'light' ? 'ffffff' : '000000';
      return `makeOverlay(${rgb(hex)},${op.opacity});modified.push(-1);`;
    }
    case 'adjustBrightness':
      return `addBrightnessContrast(${op.delta});modified.push(-1);`;
    case 'adjustSaturation':
      return `addHueSaturation(${op.delta});modified.push(-1);`;
    case 'roundedCorners':
      return `roundCorners(L,${op.radius});`;
    case 'replaceSmartObject':
      return `if(L.kind==LayerKind.SMARTOBJECT){replaceSOContents(${jsStr(op.assetPath.replace(/\\/g, '/'))});}else{warn.push('NOT_A_SMART_OBJECT');}`;
    case 'replaceBackground':
      // Handled by the dedicated executor path (emitReplaceBackgroundJsx); the
      // generic emitter records a warning if it is ever reached directly.
      return `warn.push('REPLACE_BACKGROUND_USES_DEDICATED_PATH');`;
    default:
      return `/* unsupported */`;
  }
}

export interface EmitExecuteOptions {
  outputDir: string;
  previewPng: boolean;
  checkpointName: string;
  trueDelete?: boolean;
}

const PREVIEW_JS = (out: string) => `try{var pf=new File(${jsStr(out)}+'/preview.png');var dup=doc.duplicate('__assist_preview',true);var mx=1200;var sc=Math.min(1,mx/dup.width.value);if(sc<1)dup.resizeImage(new UnitValue(dup.width.value*sc,'px'),new UnitValue(dup.height.value*sc,'px'),null,ResampleMethod.BICUBIC);var po=new PNGSaveOptions();po.compression=7;dup.saveAs(pf,po,true,Extension.LOWERCASE);dup.close(SaveOptions.DONOTSAVECHANGES);preview=pf.fsName;}catch(eP){warn.push('PREVIEW_FAILED:'+eP.message);}`;

function wrapExecute(out: string, checkpointName: string, targetLayerId: number, body: string, previewPng: boolean): string {
  const outFs = out.replace(/\\/g, '/');
  return `#target photoshop
(function(){
var out=new Folder(${jsStr(outFs)});if(!out.exists)out.create();
var resultFile=new File(out.fsName+'/result.json');var warn=[];var modified=[];
function esc(s){return String(s).replace(/\\\\/g,'\\\\\\\\').replace(/"/g,'\\\\"').replace(/\\r/g,'\\\\r').replace(/\\n/g,'\\\\n');}
function writeResult(ok,detail,preview,checkpoint){resultFile.encoding='UTF8';resultFile.open('w');resultFile.write('{"success":'+(ok?'true':'false')+',"details":"'+esc(detail)+'","previewPath":"'+esc(preview||'')+'","checkpointId":"'+esc(checkpoint||'')+'","modifiedLayerIds":['+modified.join(',')+'],"warnings":["'+warn.join('","')+'"]}');resultFile.close();}
${HELPERS}
var doc=null;var preview='';
try{
if(app.documents.length===0)throw new Error('NO_DOCUMENT_OPEN');
doc=app.activeDocument;
app.displayDialogs=DialogModes.NO;
var prevRuler=app.preferences.rulerUnits;app.preferences.rulerUnits=Units.PIXELS;
snapshot(${jsStr(checkpointName)});
var L=selectById(${targetLayerId});
modified.push(${targetLayerId});
${body}
${previewPng ? PREVIEW_JS(outFs) : ''}
app.preferences.rulerUnits=prevRuler;
writeResult(true,'applied',preview,${jsStr(checkpointName)});
}catch(e){
try{app.preferences.rulerUnits=prevRuler;}catch(eU){}
writeResult(false,(e&&e.message)?e.message:String(e),'','');
}
}());`;
}

// Build a complete, atomic execution JSX for one plan against one target layer.
export function emitExecuteJsx(plan: ActionPlan, targetLayerId: number, opts: EmitExecuteOptions): string {
  const body = plan.operations.map((op) => {
    if (op.type === 'delete' && opts.trueDelete) return `L.remove();`;
    return emitOperation(op);
  }).join('\n');
  return wrapExecute(opts.outputDir, opts.checkpointName, targetLayerId, body, opts.previewPng);
}

// ── Dedicated background-replacement JSX ────────────────────────────────────
// Places `assetPath` as a Smart Object, cover-fits it to the canvas using the
// pre-computed scale/offset (from computeCover in TS), moves it below all
// content, and hides — but does not delete — the previous background layer.
export interface BackgroundPlacement {
  outputDir: string;
  assetPath: string;
  scalePercent: number;
  offsetX: number;
  offsetY: number;
  previousBackgroundId: number | null;
  checkpointName: string;
  previewPng: boolean;
}

export function emitReplaceBackgroundJsx(p: BackgroundPlacement): string {
  const outFs = p.outputDir.replace(/\\/g, '/');
  const hidePrev = p.previousBackgroundId != null
    ? `try{var prev=selectById(${p.previousBackgroundId});prev.visible=false;modified.push(${p.previousBackgroundId});}catch(eHid){warn.push('HIDE_PREV_BG_FAILED');}`
    : `warn.push('NO_PREVIOUS_BACKGROUND_ID');`;
  return `#target photoshop
(function(){
var out=new Folder(${jsStr(outFs)});if(!out.exists)out.create();
var resultFile=new File(out.fsName+'/result.json');var warn=[];var modified=[];
function esc(s){return String(s).replace(/\\\\/g,'\\\\\\\\').replace(/"/g,'\\\\"').replace(/\\r/g,'\\\\r').replace(/\\n/g,'\\\\n');}
function writeResult(ok,detail,preview,checkpoint){resultFile.encoding='UTF8';resultFile.open('w');resultFile.write('{"success":'+(ok?'true':'false')+',"details":"'+esc(detail)+'","previewPath":"'+esc(preview||'')+'","checkpointId":"'+esc(checkpoint||'')+'","modifiedLayerIds":['+modified.join(',')+'],"warnings":["'+warn.join('","')+'"]}');resultFile.close();}
${HELPERS}
function placeFile(path){var d=new ActionDescriptor();d.putPath(cTID('null'),new File(path));d.putEnumerated(cTID('FTcs'),cTID('QCSt'),cTID('Qcsa'));executeAction(cTID('Plc '),d,DialogModes.NO);return doc.activeLayer;}
var doc=null;var preview='';
try{
if(app.documents.length===0)throw new Error('NO_DOCUMENT_OPEN');
doc=app.activeDocument;app.displayDialogs=DialogModes.NO;
var prevRuler=app.preferences.rulerUnits;app.preferences.rulerUnits=Units.PIXELS;
snapshot(${jsStr(p.checkpointName)});
${hidePrev}
// place as Smart Object, cover-fit, centre, then push to the bottom of the stack
var bg=placeFile(${jsStr(p.assetPath.replace(/\\/g, '/'))});bg.name='Assistant Background';
bg.resize(${p.scalePercent},${p.scalePercent},AnchorPosition.MIDDLECENTER);
var b=boundsOf(bg);
var tx=${p.offsetX}-b.x;var ty=${p.offsetY}-b.y;
bg.translate(new UnitValue(tx,'px'),new UnitValue(ty,'px'));
bg.move(doc,ElementPlacement.PLACEATEND);
modified.push(bg.id);
${p.previewPng ? PREVIEW_JS(outFs) : ''}
app.preferences.rulerUnits=prevRuler;
writeResult(true,'background replaced',preview,${jsStr(p.checkpointName)});
}catch(e){
try{app.preferences.rulerUnits=prevRuler;}catch(eU){}
writeResult(false,(e&&e.message)?e.message:String(e),'','');
}
}());`;
}
