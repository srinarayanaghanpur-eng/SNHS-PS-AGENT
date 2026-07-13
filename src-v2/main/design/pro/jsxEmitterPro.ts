// JSX Emitter Adapter
// Converts the new SceneGraph to Photoshop ExtendScript (JSX).
// This adapter wraps the existing jsxEmitter.ts functionality for the new scene graph.

import { log } from '../../logger';
import type { SceneGraph, SceneNode, GroupNode, TextNode, ImageNode, ShapeNode, GradientNode, LineNode } from './sceneGraph';

export interface EmitOptions {
  outputDir: string;
  exportPng: boolean;
  exportJpg: boolean;
  docName: string;
}

function jsStr(v: string): string {
  return JSON.stringify(v).replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

function hexToRgbCall(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

const JSX_HELPERS = `
function cTID(s){return charIDToTypeID(s);}
function sTID(s){return stringIDToTypeID(s);}
function rgbDesc(r,g,b){var c=new ActionDescriptor();c.putDouble(cTID('Rd  '),r);c.putDouble(cTID('Grn '),g);c.putDouble(cTID('Bl  '),b);return c;}
function solid(r,g,b){var c=new SolidColor();c.rgb.red=r;c.rgb.green=g;c.rgb.blue=b;return c;}
function intoGroup(group,name){var l=doc.activeLayer;l.name=name;l.move(group,ElementPlacement.INSIDE);return l;}
function boundsDesc(l,t,r,b,radius){var d=new ActionDescriptor();d.putUnitDouble(cTID('Top '),cTID('#Pxl'),t);d.putUnitDouble(cTID('Left'),cTID('#Pxl'),l);d.putUnitDouble(cTID('Btom'),cTID('#Pxl'),b);d.putUnitDouble(cTID('Rght'),cTID('#Pxl'),r);if(radius&&radius>0){d.putUnitDouble(sTID('topLeft'),cTID('#Pxl'),radius);d.putUnitDouble(sTID('topRight'),cTID('#Pxl'),radius);d.putUnitDouble(sTID('bottomLeft'),cTID('#Pxl'),radius);d.putUnitDouble(sTID('bottomRight'),cTID('#Pxl'),radius);}return d;}
function shapeLayer(group,name,r,g,b,l,t,rr,bb,radius,ellipse){var d=new ActionDescriptor();var ref=new ActionReference();ref.putClass(sTID('contentLayer'));d.putReference(cTID('null'),ref);var use=new ActionDescriptor();var typ=new ActionDescriptor();typ.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(r,g,b));use.putObject(cTID('Type'),sTID('solidColorLayer'),typ);use.putObject(cTID('Shp '),ellipse?cTID('Elps'):cTID('Rctn'),boundsDesc(l,t,rr,bb,radius));d.putObject(cTID('Usng'),sTID('contentLayer'),use);executeAction(cTID('Mk  '),d,DialogModes.NO);return intoGroup(group,name);}
function selRect(l,t,r,b,radius){var d=new ActionDescriptor();var ref=new ActionReference();ref.putProperty(cTID('Chnl'),cTID('fsel'));d.putReference(cTID('null'),ref);d.putObject(cTID('T   '),radius&&radius>0?cTID('Rctn'):cTID('Rctn'),boundsDesc(l,t,r,b,radius));executeAction(cTID('setd'),d,DialogModes.NO);}
function selEllipse(l,t,r,b){var d=new ActionDescriptor();var ref=new ActionReference();ref.putProperty(cTID('Chnl'),cTID('fsel'));d.putReference(cTID('null'),ref);d.putObject(cTID('T   '),cTID('Elps'),boundsDesc(l,t,r,b,0));executeAction(cTID('setd'),d,DialogModes.NO);}
function maskFromSelection(){var d=new ActionDescriptor();d.putClass(cTID('Nw  '),cTID('Chnl'));var ref=new ActionReference();ref.putEnumerated(cTID('Chnl'),cTID('Chnl'),cTID('Msk '));d.putReference(cTID('At  '),ref);d.putEnumerated(cTID('Usng'),cTID('UsrM'),cTID('RvlS'));executeAction(cTID('Mk  '),d,DialogModes.NO);}
function gradientLayer(group,name,stops,angle){var d=new ActionDescriptor();var ref=new ActionReference();ref.putClass(sTID('contentLayer'));d.putReference(cTID('null'),ref);var use=new ActionDescriptor();var typ=new ActionDescriptor();typ.putEnumerated(cTID('Type'),cTID('GrdT'),cTID('Lnr '));typ.putUnitDouble(cTID('Angl'),cTID('#Ang'),angle);var grad=new ActionDescriptor();grad.putString(cTID('Nm  '),'SNHS');grad.putEnumerated(cTID('GrdF'),cTID('GrdF'),cTID('CstS'));grad.putDouble(cTID('Intr'),4096);var clrs=new ActionList();for(var i=0;i<stops.length;i++){var s=new ActionDescriptor();s.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(stops[i][0],stops[i][1],stops[i][2]));s.putEnumerated(cTID('Type'),cTID('Clry'),cTID('UsrS'));s.putInteger(cTID('Lctn'),Math.round(stops[i][3]*40.96));s.putInteger(cTID('Mdpn'),50);clrs.putObject(cTID('Clrt'),s);}grad.putList(cTID('Clrs'),clrs);var trns=new ActionList();for(var j=0;j<2;j++){var o=new ActionDescriptor();o.putUnitDouble(cTID('Opct'),cTID('#Prc'),100);o.putInteger(cTID('Lctn'),j*4096);o.putInteger(cTID('Mdpn'),50);trns.putObject(cTID('TrnS'),o);}grad.putList(cTID('Trns'),trns);typ.putObject(cTID('Grad'),cTID('Grdn'),grad);use.putObject(cTID('Type'),sTID('gradientLayer'),typ);d.putObject(cTID('Usng'),sTID('contentLayer'),use);executeAction(cTID('Mk  '),d,DialogModes.NO);return intoGroup(group,name);}
function setFont(ti,names){var fell=null;for(var i=0;i<names.length;i++){try{ti.font=names[i];if(ti.font==names[i])return names[i];if(!fell)fell=ti.font;}catch(e){}}return fell||ti.font;}
function addPointText(group,name,content,fonts,size,minSize,r,g,b,x,y,w,align,tracking,leadingFactor){var layer=group.artLayers.add();layer.kind=LayerKind.TEXT;layer.name=name;var ti=layer.textItem;ti.kind=TextType.POINTTEXT;setFont(ti,fonts);ti.size=new UnitValue(size,'px');try{ti.useAutoLeading=false;ti.leading=new UnitValue(Math.round(size*leadingFactor),'px');}catch(eL){}if(tracking)try{ti.tracking=tracking;}catch(eT){}ti.color=solid(r,g,b);ti.contents=content;ti.position=[new UnitValue(x,'px'),new UnitValue(y+size,'px')];var guard=0;while(guard++<30){var bnds=layer.bounds;var tw=bnds[2].value-bnds[0].value;if(tw<=w*1.02||ti.size.value<=minSize)break;var next=Math.max(minSize,Math.floor(ti.size.value*0.94));ti.size=new UnitValue(next,'px');try{ti.leading=new UnitValue(Math.round(next*leadingFactor),'px');}catch(eL2){}}var fb=layer.bounds;var fw=fb[2].value-fb[0].value;var dx=0;if(align==='center')dx=(x+(w-fw)/2)-fb[0].value;else if(align==='right')dx=(x+w-fw)-fb[0].value;else dx=x-fb[0].value;if(Math.abs(dx)>0.5)layer.translate(new UnitValue(dx,'px'),new UnitValue(0,'px'));return layer;}
`;

function emitTextNode(node: TextNode, groupVar: string, lines: string[]): void {
  const { rect, style, content } = node;
  if (!rect || !style || !content) return;

  const r = hexToRgbCall(style.color);
  const wrappedContent = content;
  const fontNames = [jsStr(style.fontPostScriptName), jsStr(style.fontFamily), jsStr('ArialMT')];
  const align = style.align;

  lines.push(`var ly=addPointText(${groupVar},${jsStr(node.name)},${jsStr(wrappedContent)},[${fontNames.join(',')}],${style.fontSize},${style.minFontSize},${r},${rect.x},${rect.y},${rect.w},${jsStr(align)},${style.tracking},${style.lineHeight});`);
  lines.push(`ly.opacity=${node.opacity};`);

  if (style.textCase === 'uppercase') {
    // handled by content being uppercased already in the text node
  }
}

function emitShapeNode(node: ShapeNode, groupVar: string, lines: string[]): void {
  const { rect, style } = node;
  if (!rect || !style) return;

  const fillColor = typeof style.fill === 'string' ? style.fill : '#000000';
  const radius = typeof style.radius === 'number' ? style.radius : 0;
  const isEllipse = node.shapeType === 'ellipse' || (node.shapeType === 'rect' && radius > rect.w / 2);

  lines.push(`var ly=shapeLayer(${groupVar},${jsStr(node.name)},${hexToRgbCall(fillColor)},${rect.x},${rect.y},${rect.x + rect.w},${rect.y + rect.h},${radius},${isEllipse ? 'true' : 'false'});`);
  lines.push(`ly.opacity=${node.opacity};`);
}

function emitImageNode(node: ImageNode, groupVar: string, lines: string[]): void {
  const { rect, style } = node;
  if (!rect || !style?.assetPath) return;

  const path = style.assetPath.replace(/\\/g, '/');
  lines.push(`try{`);
  lines.push(`var ph=placeFile(${jsStr(path)});ph.name=${jsStr(node.name)};`);
  lines.push(`var pb=ph.bounds;var pw=pb[2].value-pb[0].value;var phh=pb[3].value-pb[1].value;`);

  if (style.cropMode === 'contain') {
    lines.push(`var sc=Math.min(${rect.w}/pw,${rect.h}/phh)*100;ph.resize(sc,sc,AnchorPosition.MIDDLECENTER);`);
    lines.push(`pb=ph.bounds;pw=pb[2].value-pb[0].value;phh=pb[3].value-pb[1].value;`);
    lines.push(`var tx=${rect.x}+((${rect.w}-pw)/2)-pb[0].value;var tyv=${rect.y}+((${rect.h}-phh)/2)-pb[1].value;ph.translate(new UnitValue(tx,'px'),new UnitValue(tyv,'px'));`);
  } else {
    // cover-fit
    const zoom = 1; // can be adjusted
    lines.push(`var sc=Math.max(${rect.w}/pw,${rect.h}/phh)*${zoom}*100;ph.resize(sc,sc,AnchorPosition.MIDDLECENTER);`);
    lines.push(`pb=ph.bounds;pw=pb[2].value-pb[0].value;phh=pb[3].value-pb[1].value;`);
    lines.push(`var ox=(pw-${rect.w})/2;var oy=(phh-${rect.h})*0.38;`);
    lines.push(`var tx=${rect.x}-ox-pb[0].value;var tyv=${rect.y}-oy-pb[1].value;ph.translate(new UnitValue(tx,'px'),new UnitValue(tyv,'px'));`);
  }

  if (style.maskShape === 'circle') {
    lines.push(`selEllipse(${rect.x},${rect.y},${rect.x + rect.w},${rect.y + rect.h});maskFromSelection();`);
  } else if (style.maskShape === 'rounded' && style.maskRadius) {
    lines.push(`selRect(${rect.x},${rect.y},${rect.x + rect.w},${rect.y + rect.h},${style.maskRadius});maskFromSelection();`);
  } else if (style.maskShape === 'rect') {
    lines.push(`selRect(${rect.x},${rect.y},${rect.x + rect.w},${rect.y + rect.h},0);maskFromSelection();`);
  }

  lines.push(`ph.move(${groupVar},ElementPlacement.INSIDE);`);
  lines.push(`}catch(ePh){warn.push('PHOTO_FAILED:'+${jsStr(node.name)}+':'+ePh.message);}`);
}

function emitGradientNode(node: GradientNode, groupVar: string, lines: string[]): void {
  const { rect, gradient } = node;
  if (!rect || !gradient) return;

  const angle = gradient.angle || 90;
  const stops = gradient.stops.map(s => `[${hexToRgbCall(s.color)},${s.position}]`).join(',');

  const isFull = rect.x <= 0 && rect.y <= 0 && rect.w >= 9999 && rect.h >= 9999;
  if (!isFull) lines.push(`selRect(${rect.x},${rect.y},${rect.x + rect.w},${rect.y + rect.h},0);`);
  lines.push(`var ly=gradientLayer(${groupVar},${jsStr(node.name)},[${stops}],${angle});`);
  if (!isFull) lines.push('try{doc.selection.deselect();}catch(eD){}');
  lines.push(`ly.opacity=${node.opacity};`);
}

function emitLineNode(node: LineNode, groupVar: string, lines: string[]): void {
  const { start, end, style } = node;
  if (!start || !end || !style) return;

  // Render line as a thin rectangle for Photoshop compatibility
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return;

  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const lineW = length;
  const lineH = style.width;

  // Use a rectangle and rotate it
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;

  lines.push(`var ly=shapeLayer(${groupVar},${jsStr(node.name)},${hexToRgbCall(style.color)},${cx - lineW / 2},${cy - lineH / 2},${cx + lineW / 2},${cy + lineH / 2},0,false);`);
  lines.push(`ly.rotate(${angle},AnchorPosition.MIDDLECENTER);`);
}

function emitNodeToJSX(node: SceneNode, groupVar: string, lines: string[]): void {
  switch (node.kind) {
    case 'text':
      emitTextNode(node as TextNode, groupVar, lines);
      break;
    case 'image':
      emitImageNode(node as ImageNode, groupVar, lines);
      break;
    case 'shape':
      emitShapeNode(node as ShapeNode, groupVar, lines);
      break;
    case 'gradient':
      emitGradientNode(node as GradientNode, groupVar, lines);
      break;
    case 'line':
      emitLineNode(node as LineNode, groupVar, lines);
      break;
    // decorative and other node types fall through to shape rendering
    default:
      break;
  }
}

function emitGroupToJSX(group: GroupNode, lines: string[], allGroups: Map<string, string>): string {
  const groupVar = `grp_${group.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
  allGroups.set(group.id, groupVar);

  lines.push(`var ${groupVar}=doc.layerSets.add();${groupVar}.name=${jsStr(group.name)};`);

  // Sort children by zIndex
  const sortedChildren = [...group.children].sort((a, b) => a.zIndex - b.zIndex);

  for (const child of sortedChildren) {
    if (!child.visible) continue;

    if (child.kind === 'group') {
      emitGroupToJSX(child as GroupNode, lines, allGroups);
    } else {
      emitNodeToJSX(child, groupVar, lines);
    }
  }

  if (group.opacity !== undefined && group.opacity < 100) {
    lines.push(`${groupVar}.opacity=${group.opacity};`);
  }

  return groupVar;
}

export function emitJsxFromSceneGraph(sg: SceneGraph, opts: EmitOptions): string {
  const out = opts.outputDir.replace(/\\/g, '/');
  const lines: string[] = [];
  const allGroups = new Map<string, string>();

  // Sort root children by zIndex
  const sortedRoot = [...sg.root.children].sort((a, b) => a.zIndex - b.zIndex);

  for (const child of sortedRoot) {
    if (!child.visible) continue;

    if (child.kind === 'group') {
      emitGroupToJSX(child as GroupNode, lines, allGroups);
    } else {
      emitNodeToJSX(child, 'doc', lines);
    }
  }

  const body = lines.join('\n');

  return `#target photoshop
(function(){
var out=new Folder(${jsStr(out)});if(!out.exists)out.create();
var resultFile=new File(out.fsName+'/result.json');var doc=null;var warn=[];
function esc(s){return String(s).replace(/\\\\\\\\/g,'\\\\\\\\').replace(/"/g,'\\\\"').replace(/\\r/g,'\\\\r').replace(/\\n/g,'\\\\n');}
function writeResult(ok,detail,psd,jpg,png){resultFile.encoding='UTF8';resultFile.open('w');resultFile.write('{"success":'+(ok?'true':'false')+',"details":"'+esc(detail)+'","psdPath":"'+esc(psd||'')+'","jpgPath":"'+esc(jpg||'')+'","pngPath":"'+esc(png||'')+'","warnings":"'+esc(warn.join('|'))+'"}');resultFile.close();}
${JSX_HELPERS}
try{
app.displayDialogs=DialogModes.NO;
var prevRuler=app.preferences.rulerUnits;var prevType=app.preferences.typeUnits;
app.preferences.rulerUnits=Units.PIXELS;app.preferences.typeUnits=TypeUnits.PIXELS;
doc=app.documents.add(${sg.width},${sg.height},72,${jsStr(opts.docName)},NewDocumentMode.RGB,DocumentFill.WHITE);
${body}
var psd=new File(out.fsName+'/poster.psd');doc.saveAs(psd,new PhotoshopSaveOptions(),true,Extension.LOWERCASE);
${opts.exportJpg ? `var jpg=new File(out.fsName+'/poster.jpg');var jo=new JPEGSaveOptions();jo.quality=12;jo.embedColorProfile=true;doc.saveAs(jpg,jo,true,Extension.LOWERCASE);` : 'var jpg={fsName:""};'}
${opts.exportPng ? `var png=new File(out.fsName+'/poster.png');var po=new PNGSaveOptions();po.compression=6;doc.saveAs(png,po,true,Extension.LOWERCASE);` : 'var png={fsName:""};'}
writeResult(true,'Poster composed with '+doc.layers.length+' top groups.',psd.fsName,jpg.fsName,png.fsName);
}catch(e){writeResult(false,(e&&e.message)?e.message:String(e),'','','');}
finally{try{app.preferences.rulerUnits=prevRuler;app.preferences.typeUnits=prevType;}catch(eU){}if(doc){try{doc.close(SaveOptions.DONOTSAVECHANGES);}catch(eC){}}}
}());`;
}