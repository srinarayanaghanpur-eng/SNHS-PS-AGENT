// Photoshop ExtendScript emitter for the signed-off Studio scene graph.
//
// The SVG renderer is still the fast visual-preview path. This emitter mirrors
// the same scene as editable Photoshop layers: vector fill layers, live text,
// and placed Smart Objects with non-destructive masks.

import { basename } from 'node:path';

const jsStr = (value) => JSON.stringify(String(value)).replace(/[\u0080-\uffff]/g, (char) =>
  `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);

function rgb(hex) {
  const clean = String(hex || '#000000').replace(/^#/, '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0').slice(0, 6);
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function rgbArgs(hex) {
  return rgb(hex).join(',');
}

function opacityPct(value) {
  if (value == null) return 100;
  return Math.max(0, Math.min(100, Math.round(value <= 1 ? value * 100 : value)));
}

function cleanName(value, fallback) {
  const cleaned = String(value || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (cleaned || fallback).slice(0, 70);
}

function assetLayerName(node, index) {
  const file = node.href && !String(node.href).startsWith('data:') ? basename(String(node.href)) : `asset-${index}`;
  const isLogo = /logo/i.test(file) || node.fit === 'contain';
  return `${isLogo ? 'LOGO' : 'PHOTO'}_${String(index).padStart(2, '0')}_${cleanName(file.replace(/\.[^.]+$/, ''), 'ASSET')}`;
}

function nodeLayerName(node, index) {
  if (node.name) return cleanName(node.name, `${node.type}_${index}`);
  if (node.type === 'image') return assetLayerName(node, index);
  if (node.type === 'text') return `TEXT_${String(index).padStart(2, '0')}_${cleanName(node.text, 'COPY')}`;
  if (node.type === 'line') return `RULE_${String(index).padStart(2, '0')}`;
  if (node.type === 'rect') return `${node.gradient ? 'GRADIENT' : 'SHAPE'}_${String(index).padStart(2, '0')}`;
  return `${String(node.type || 'LAYER').toUpperCase()}_${String(index).padStart(2, '0')}`;
}

function fontCandidates(node) {
  const family = String(node.family || 'Arial');
  const weight = Number(node.weight || 400);
  const italic = Boolean(node.italic);
  const names = [];
  if (/poppins/i.test(family)) {
    if (weight >= 700) names.push(italic ? 'Poppins-BoldItalic' : 'Poppins-Bold');
    else if (weight >= 600) names.push(italic ? 'Poppins-SemiBoldItalic' : 'Poppins-SemiBold');
    else if (weight >= 500) names.push(italic ? 'Poppins-MediumItalic' : 'Poppins-Medium');
    names.push(italic ? 'Poppins-Italic' : 'Poppins-Regular', 'Poppins');
  } else if (/lato/i.test(family)) {
    if (weight >= 800) names.push(italic ? 'Lato-BlackItalic' : 'Lato-Black');
    else if (weight >= 700) names.push(italic ? 'Lato-BoldItalic' : 'Lato-Bold');
    names.push(italic ? 'Lato-Italic' : 'Lato-Regular', 'Lato');
  } else if (/segoe/i.test(family)) {
    if (weight >= 700) names.push(italic ? 'SegoeUI-BoldItalic' : 'SegoeUI-Bold');
    else if (weight >= 600) names.push(italic ? 'SegoeUI-SemiboldItalic' : 'SegoeUI-Semibold');
    names.push(italic ? 'SegoeUI-Italic' : 'SegoeUI', 'Segoe UI');
  } else {
    names.push(family);
  }
  names.push(italic && weight >= 600 ? 'Arial-BoldItalicMT' : weight >= 600 ? 'Arial-BoldMT' : italic ? 'Arial-ItalicMT' : 'ArialMT');
  return [...new Set(names)];
}

const HELPERS = String.raw`
function cTID(s){return charIDToTypeID(s);}function sTID(s){return stringIDToTypeID(s);}
function rgbDesc(r,g,b){var c=new ActionDescriptor();c.putDouble(cTID('Rd  '),r);c.putDouble(cTID('Grn '),g);c.putDouble(cTID('Bl  '),b);return c;}
function solid(r,g,b){var c=new SolidColor();c.rgb.red=r;c.rgb.green=g;c.rgb.blue=b;return c;}
function intoGroup(group,name){var layer=doc.activeLayer;layer.name=name;layer.move(group,ElementPlacement.INSIDE);return layer;}
function boundsDesc(l,t,r,b,radius){var d=new ActionDescriptor();d.putUnitDouble(cTID('Top '),cTID('#Pxl'),t);d.putUnitDouble(cTID('Left'),cTID('#Pxl'),l);d.putUnitDouble(cTID('Btom'),cTID('#Pxl'),b);d.putUnitDouble(cTID('Rght'),cTID('#Pxl'),r);if(radius&&radius>0){d.putUnitDouble(sTID('topLeft'),cTID('#Pxl'),radius);d.putUnitDouble(sTID('topRight'),cTID('#Pxl'),radius);d.putUnitDouble(sTID('bottomLeft'),cTID('#Pxl'),radius);d.putUnitDouble(sTID('bottomRight'),cTID('#Pxl'),radius);}return d;}
function shapeLayer(group,name,r,g,b,l,t,rr,bb,radius,ellipse){
  var d=new ActionDescriptor();var ref=new ActionReference();ref.putClass(sTID('contentLayer'));d.putReference(cTID('null'),ref);
  var use=new ActionDescriptor();var typ=new ActionDescriptor();typ.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(r,g,b));
  use.putObject(cTID('Type'),sTID('solidColorLayer'),typ);use.putObject(cTID('Shp '),ellipse?cTID('Elps'):cTID('Rctn'),boundsDesc(l,t,rr,bb,radius));
  d.putObject(cTID('Usng'),sTID('contentLayer'),use);executeAction(cTID('Mk  '),d,DialogModes.NO);return intoGroup(group,name);
}
function selRect(l,t,r,b,radius){var d=new ActionDescriptor();var ref=new ActionReference();ref.putProperty(cTID('Chnl'),cTID('fsel'));d.putReference(cTID('null'),ref);d.putObject(cTID('T   '),cTID('Rctn'),boundsDesc(l,t,r,b,radius));executeAction(cTID('setd'),d,DialogModes.NO);}
function selEllipse(l,t,r,b){var d=new ActionDescriptor();var ref=new ActionReference();ref.putProperty(cTID('Chnl'),cTID('fsel'));d.putReference(cTID('null'),ref);d.putObject(cTID('T   '),cTID('Elps'),boundsDesc(l,t,r,b,0));executeAction(cTID('setd'),d,DialogModes.NO);}
function maskFromSelection(){var d=new ActionDescriptor();d.putClass(cTID('Nw  '),cTID('Chnl'));var ref=new ActionReference();ref.putEnumerated(cTID('Chnl'),cTID('Chnl'),cTID('Msk '));d.putReference(cTID('At  '),ref);d.putEnumerated(cTID('Usng'),cTID('UsrM'),cTID('RvlS'));executeAction(cTID('Mk  '),d,DialogModes.NO);try{doc.selection.deselect();}catch(e){}}
function gradientLayer(group,name,stops,angle){
  var d=new ActionDescriptor();var ref=new ActionReference();ref.putClass(sTID('contentLayer'));d.putReference(cTID('null'),ref);
  var use=new ActionDescriptor();var typ=new ActionDescriptor();typ.putEnumerated(cTID('Type'),cTID('GrdT'),cTID('Lnr '));typ.putUnitDouble(cTID('Angl'),cTID('#Ang'),angle);
  var grad=new ActionDescriptor();grad.putString(cTID('Nm  '),'SNHS Studio');grad.putEnumerated(cTID('GrdF'),cTID('GrdF'),cTID('CstS'));grad.putDouble(cTID('Intr'),4096);
  var colours=new ActionList();var transparencies=new ActionList();
  for(var i=0;i<stops.length;i++){var colour=new ActionDescriptor();colour.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(stops[i][0],stops[i][1],stops[i][2]));colour.putEnumerated(cTID('Type'),cTID('Clry'),cTID('UsrS'));colour.putInteger(cTID('Lctn'),Math.round(stops[i][3]*40.96));colour.putInteger(cTID('Mdpn'),50);colours.putObject(cTID('Clrt'),colour);var alpha=new ActionDescriptor();alpha.putUnitDouble(cTID('Opct'),cTID('#Prc'),stops[i][4]);alpha.putInteger(cTID('Lctn'),Math.round(stops[i][3]*40.96));alpha.putInteger(cTID('Mdpn'),50);transparencies.putObject(cTID('TrnS'),alpha);}
  grad.putList(cTID('Clrs'),colours);grad.putList(cTID('Trns'),transparencies);typ.putObject(cTID('Grad'),cTID('Grdn'),grad);use.putObject(cTID('Type'),sTID('gradientLayer'),typ);d.putObject(cTID('Usng'),sTID('contentLayer'),use);executeAction(cTID('Mk  '),d,DialogModes.NO);return intoGroup(group,name);
}
function fxDesc(){var fx=new ActionDescriptor();fx.putUnitDouble(cTID('Scl '),cTID('#Prc'),100);return fx;}
function shadowDesc(opacity,distance,size){var d=new ActionDescriptor();d.putBoolean(cTID('enab'),true);d.putEnumerated(cTID('Md  '),cTID('BlnM'),cTID('Mltp'));d.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(0,0,0));d.putUnitDouble(cTID('Opct'),cTID('#Prc'),opacity);d.putBoolean(cTID('uglg'),false);d.putUnitDouble(cTID('lagl'),cTID('#Ang'),90);d.putUnitDouble(cTID('Dstn'),cTID('#Pxl'),distance);d.putUnitDouble(cTID('Ckmt'),cTID('#Pxl'),0);d.putUnitDouble(cTID('blur'),cTID('#Pxl'),size);d.putUnitDouble(cTID('Nose'),cTID('#Prc'),0);d.putBoolean(sTID('layerConceals'),true);return d;}
function strokeDesc(r,g,b,size){var d=new ActionDescriptor();d.putBoolean(cTID('enab'),true);d.putEnumerated(cTID('Styl'),cTID('FStl'),cTID('OutF'));d.putEnumerated(cTID('PntT'),cTID('FrFl'),cTID('SClr'));d.putEnumerated(cTID('Md  '),cTID('BlnM'),cTID('Nrml'));d.putUnitDouble(cTID('Opct'),cTID('#Prc'),100);d.putUnitDouble(cTID('Sz  '),cTID('#Pxl'),size);d.putObject(cTID('Clr '),cTID('RGBC'),rgbDesc(r,g,b));return d;}
function applyFx(fx){var d=new ActionDescriptor();var ref=new ActionReference();ref.putProperty(cTID('Prpr'),cTID('Lefx'));ref.putEnumerated(cTID('Lyr '),cTID('Ordn'),cTID('Trgt'));d.putReference(cTID('null'),ref);d.putObject(cTID('T   '),cTID('Lefx'),fx);executeAction(cTID('setd'),d,DialogModes.NO);}
function applyShadow(layer,opacity,distance,size){doc.activeLayer=layer;var fx=fxDesc();fx.putObject(cTID('DrSh'),cTID('DrSh'),shadowDesc(opacity,distance,size));applyFx(fx);}
function applyStroke(layer,r,g,b,size){doc.activeLayer=layer;var fx=fxDesc();fx.putObject(cTID('FrFX'),cTID('FrFX'),strokeDesc(r,g,b,size));applyFx(fx);}
function placeFile(path){var file=new File(path);if(!file.exists)throw new Error('Asset not found: '+path);var d=new ActionDescriptor();d.putPath(cTID('null'),file);d.putEnumerated(cTID('FTcs'),cTID('QCSt'),cTID('Qcsa'));executeAction(cTID('Plc '),d,DialogModes.NO);return doc.activeLayer;}
function setFont(ti,names){for(var i=0;i<names.length;i++){try{ti.font=names[i];if(ti.font==names[i])return names[i];}catch(e){}}return ti.font;}
function addText(group,name,content,fonts,size,minSize,r,g,b,x,y,w,h,align,tracking,leadingFactor,bold,italic){
  var layer=group.artLayers.add();layer.kind=LayerKind.TEXT;layer.name=name;var ti=layer.textItem;ti.kind=TextType.POINTTEXT;
  var actual=setFont(ti,fonts);ti.size=new UnitValue(size,'px');try{ti.useAutoLeading=false;ti.leading=new UnitValue(Math.round(size*leadingFactor),'px');}catch(eLead){}
  try{ti.tracking=tracking;}catch(eTrack){}try{ti.antiAliasMethod=AntiAlias.SMOOTH;}catch(eAA){}ti.color=solid(r,g,b);ti.contents=content;
  try{ti.justification=align=='center'?Justification.CENTER:align=='right'?Justification.RIGHT:Justification.LEFT;}catch(eJust){}
  var actualLower=String(actual).toLowerCase();if(bold&&actualLower.indexOf('bold')<0&&actualLower.indexOf('black')<0)try{ti.fauxBold=true;}catch(eBold){}if(italic&&actualLower.indexOf('italic')<0)try{ti.fauxItalic=true;}catch(eItalic){}
  var anchorX=align=='center'?x+w/2:align=='right'?x+w:x;ti.position=[new UnitValue(anchorX,'px'),new UnitValue(y+size,'px')];var guard=0;
  while(guard++<32){var bnds=layer.bounds;var tw=bnds[2].value-bnds[0].value;var th=bnds[3].value-bnds[1].value;if((tw<=w*1.015&&th<=h*1.08)||ti.size.value<=minSize)break;var next=Math.max(minSize,Math.floor(ti.size.value*0.95));ti.size=new UnitValue(next,'px');try{ti.leading=new UnitValue(Math.round(next*leadingFactor),'px');}catch(eLead2){}}
  var fb=layer.bounds;var dy=y-fb[1].value;if(Math.abs(dy)>0.25)layer.translate(new UnitValue(0,'px'),new UnitValue(dy,'px'));return layer;
}
function rotateLayer(layer,degrees){if(!degrees)return;try{layer.rotate(degrees,AnchorPosition.MIDDLECENTER);}catch(eRot){warn.push('ROTATE_FAILED:'+layer.name+':'+eRot.message);}}
function jsonEscape(value){return String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n');}
function documentStats(container){var stats={groups:0,layers:0,smartObjects:0,textLayers:0,shapeLayers:0};function walk(parent){for(var i=0;i<parent.layers.length;i++){var layer=parent.layers[i];if(layer.typename=='LayerSet'){stats.groups++;walk(layer);}else{stats.layers++;try{if(layer.kind==LayerKind.SMARTOBJECT)stats.smartObjects++;else if(layer.kind==LayerKind.TEXT)stats.textLayers++;else if(layer.kind==LayerKind.SOLIDFILL||layer.kind==LayerKind.GRADIENTFILL)stats.shapeLayers++;}catch(eKind){}}}}walk(container);return stats;}
`;

function emitRect(node, groupVar, layerName, id) {
  const lines = [];
  const x = Number(node.x || 0), y = Number(node.y || 0), w = Number(node.w || 0), h = Number(node.h || 0);
  if (node.gradient) {
    const stops = node.gradient.stops.map((stop) => {
      const [r, g, b] = rgb(stop.color);
      return `[${r},${g},${b},${Number(stop.at || 0)},${opacityPct(stop.opacity)}]`;
    }).join(',');
    lines.push(`selRect(${x},${y},${x + w},${y + h},${Number(node.radius || 0)});`);
    lines.push(`var layer${id}=gradientLayer(${groupVar},${jsStr(layerName)},[${stops}],${Number(node.gradient.angle || 0)});`);
    lines.push('try{doc.selection.deselect();}catch(eD){}');
  } else {
    lines.push(`var layer${id}=shapeLayer(${groupVar},${jsStr(layerName)},${rgbArgs(node.fill)},${x},${y},${x + w},${y + h},${Number(node.radius || 0)},false);`);
  }
  if (opacityPct(node.opacity) < 100) lines.push(`layer${id}.opacity=${opacityPct(node.opacity)};`);
  if (node.rot) lines.push(`rotateLayer(layer${id},${Number(node.rot)});`);
  return lines;
}

function emitLine(node, groupVar, layerName, id) {
  const x1 = Number(node.x1 || 0), y1 = Number(node.y1 || 0), x2 = Number(node.x2 || 0), y2 = Number(node.y2 || 0);
  const thickness = Math.max(1, Number(node.strokeWidth || 1));
  const length = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  return [
    `var layer${id}=shapeLayer(${groupVar},${jsStr(layerName)},${rgbArgs(node.stroke)},${x1},${y1 - thickness / 2},${x1 + length},${y1 + thickness / 2},${node.cap === 'round' ? thickness / 2 : 0},false);`,
    angle ? `rotateLayer(layer${id},${angle});` : '',
  ].filter(Boolean);
}

function emitText(node, groupVar, layerName, id) {
  const size = Math.max(1, Number(node.size || 24));
  const lines = Array.isArray(node.lines) && node.lines.length ? node.lines : [String(node.text || '')];
  const content = lines.join('\r');
  const candidates = fontCandidates(node).map(jsStr).join(',');
  const minSize = Math.max(8, Math.floor(size * 0.62));
  const tracking = Math.round((Number(node.tracking || 0) / size) * 1000);
  const code = [
    `var layer${id}=addText(${groupVar},${jsStr(layerName)},${jsStr(content)},[${candidates}],${size},${minSize},${rgbArgs(node.color)},${Number(node.x || 0)},${Number(node.y || 0)},${Number(node.w || 1)},${Number(node.h || size * 1.3)},${jsStr(node.align || 'left')},${tracking},${Number(node.lineHeight || 1.15)},${Number(node.weight || 400) >= 600},${Boolean(node.italic)});`,
  ];
  if (node.shadow) code.push(`applyShadow(layer${id},24,5,10);`);
  if (opacityPct(node.opacity) < 100) code.push(`layer${id}.opacity=${opacityPct(node.opacity)};`);
  if (node.rot) code.push(`rotateLayer(layer${id},${Number(node.rot)});`);
  return code;
}

function emitImage(node, groupVar, layerName, id) {
  const x = Number(node.x || 0), y = Number(node.y || 0), w = Number(node.w || 1), h = Number(node.h || 1);
  const path = String(node.href || '').replace(/\\/g, '/');
  const lines = [`try{`, `var layer${id}=placeFile(${jsStr(path)});layer${id}.name=${jsStr(layerName)};`];
  lines.push(`var bounds${id}=layer${id}.bounds;var pw${id}=bounds${id}[2].value-bounds${id}[0].value;var ph${id}=bounds${id}[3].value-bounds${id}[1].value;`);
  if (node.fit === 'contain') {
    lines.push(`var scale${id}=Math.min(${w}/pw${id},${h}/ph${id})*100;layer${id}.resize(scale${id},scale${id},AnchorPosition.MIDDLECENTER);`);
    lines.push(`bounds${id}=layer${id}.bounds;pw${id}=bounds${id}[2].value-bounds${id}[0].value;ph${id}=bounds${id}[3].value-bounds${id}[1].value;layer${id}.translate(new UnitValue(${x}+(${w}-pw${id})/2-bounds${id}[0].value,'px'),new UnitValue(${y}+(${h}-ph${id})/2-bounds${id}[1].value,'px'));`);
  } else {
    lines.push(`var scale${id}=Math.max(${w}/pw${id},${h}/ph${id})*100;layer${id}.resize(scale${id},scale${id},AnchorPosition.MIDDLECENTER);`);
    lines.push(`bounds${id}=layer${id}.bounds;pw${id}=bounds${id}[2].value-bounds${id}[0].value;ph${id}=bounds${id}[3].value-bounds${id}[1].value;layer${id}.translate(new UnitValue(${x}-(pw${id}-${w})*${Number(node.focusX ?? 0.5)}-bounds${id}[0].value,'px'),new UnitValue(${y}-(ph${id}-${h})*${Number(node.focusY ?? 0.5)}-bounds${id}[1].value,'px'));`);
  }
  if (node.fit !== 'contain') {
    if (node.shape === 'circle') lines.push(`selEllipse(${x},${y},${x + w},${y + h});maskFromSelection();`);
    else lines.push(`selRect(${x},${y},${x + w},${y + h},${Number(node.radius || 0)});maskFromSelection();`);
  }
  lines.push(`layer${id}.move(${groupVar},ElementPlacement.INSIDE);`);
  if (node.shadow) lines.push(`applyShadow(layer${id},24,7,14);`);
  if (opacityPct(node.opacity) < 100) lines.push(`layer${id}.opacity=${opacityPct(node.opacity)};`);
  if (node.rot) lines.push(`rotateLayer(layer${id},${Number(node.rot)});`);
  if (node.ring) {
    const isCircle = node.shape === 'circle';
    lines.push(`var frame${id}=shapeLayer(${groupVar},${jsStr(`${layerName}_FRAME`)},${rgbArgs(node.ring)},${x},${y},${x + w},${y + h},${Number(node.radius || 0)},${isCircle});frame${id}.fillOpacity=0;applyStroke(frame${id},${rgbArgs(node.ring)},${Number(node.ringWidth || 4)});`);
    if (node.rot) lines.push(`rotateLayer(frame${id},${Number(node.rot)});`);
  }
  lines.push(`}catch(eAsset${id}){warn.push('ASSET_FAILED:'+${jsStr(layerName)}+':'+eAsset${id}.message);}`);
  return lines;
}

function emitNode(node, groupVar, index, state) {
  const id = state.nextId++;
  const name = nodeLayerName(node, index);
  state.manifestNodes.push({
    group: state.groupName,
    name,
    type: node.type,
    source: node.type === 'image' ? String(node.href || '') : undefined,
    editable: node.type === 'text' || node.type === 'rect' || node.type === 'line',
    smartObject: node.type === 'image',
  });
  if (node.type === 'rect') return emitRect(node, groupVar, name, id);
  if (node.type === 'line') return emitLine(node, groupVar, name, id);
  if (node.type === 'text') return emitText(node, groupVar, name, id);
  if (node.type === 'image') return emitImage(node, groupVar, name, id);
  return [`warn.push('UNSUPPORTED_NODE:${cleanName(node.type, 'unknown')}');`];
}

function groupManifest(group) {
  const children = Array.isArray(group.children) ? group.children : [];
  return {
    name: group.name,
    nodeCount: children.length,
    textLayers: children.filter((node) => node.type === 'text').length,
    smartObjects: children.filter((node) => node.type === 'image').length,
    vectorLayers: children.filter((node) => node.type === 'rect' || node.type === 'line').length,
    frameLayers: children.filter((node) => node.type === 'image' && node.ring).length,
  };
}

export function buildLayerManifest(scene, { omitEmptyGroups = true } = {}) {
  const sourceGroups = (scene.root || []).filter((group) => group && group.type === 'group');
  const groups = (omitEmptyGroups ? sourceGroups.filter((group) => group.children?.length) : sourceGroups).map(groupManifest);
  const totals = groups.reduce((sum, group) => ({
    groups: sum.groups + 1,
    sourceNodes: sum.sourceNodes + group.nodeCount,
    photoshopLayers: sum.photoshopLayers + group.nodeCount + group.frameLayers,
    textLayers: sum.textLayers + group.textLayers,
    smartObjects: sum.smartObjects + group.smartObjects,
    vectorLayers: sum.vectorLayers + group.vectorLayers + group.frameLayers,
  }), { groups: 0, sourceNodes: 0, photoshopLayers: 0, textLayers: 0, smartObjects: 0, vectorLayers: 0 });
  return { format: 'snhs-studio-layer-manifest/v1', width: scene.width, height: scene.height, omitEmptyGroups, groups, totals };
}

export function emitStudioJsx(scene, options) {
  if (!scene || !Number.isFinite(scene.width) || !Number.isFinite(scene.height) || !Array.isArray(scene.root)) {
    throw new TypeError('emitStudioJsx requires a Studio scene with width, height, and root nodes.');
  }
  const opts = {
    outputDir: options?.outputDir,
    docName: options?.docName || 'SNHS_Photo_Collage_Layered',
    psdName: options?.psdName || 'collage-layered.psd',
    pngName: options?.pngName || 'collage-layered.png',
    jpgName: options?.jpgName || 'collage-layered.jpg',
    resultName: options?.resultName || 'layered-result.json',
    exportPng: options?.exportPng !== false,
    exportJpg: options?.exportJpg !== false,
    omitEmptyGroups: options?.omitEmptyGroups !== false,
  };
  if (!opts.outputDir) throw new TypeError('emitStudioJsx requires options.outputDir.');

  const state = { nextId: 1, groupName: '', manifestNodes: [] };
  const body = [];
  const sourceGroups = scene.root.filter((group) => group?.type === 'group');
  const groups = opts.omitEmptyGroups ? sourceGroups.filter((group) => group.children?.length) : sourceGroups;
  groups.forEach((group, groupIndex) => {
    const groupVar = `group${groupIndex + 1}`;
    state.groupName = group.name;
    body.push(`var ${groupVar}=doc.layerSets.add();${groupVar}.name=${jsStr(group.name)};`);
    (group.children || []).forEach((node, nodeIndex) => body.push(...emitNode(node, groupVar, nodeIndex + 1, state)));
  });

  const manifest = buildLayerManifest(scene, { omitEmptyGroups: opts.omitEmptyGroups });
  manifest.layers = state.manifestNodes;
  const outputDir = String(opts.outputDir).replace(/\\/g, '/');
  const jsx = `#target photoshop
(function(){
var out=new Folder(${jsStr(outputDir)});if(!out.exists)out.create();
var resultFile=new File(out.fsName+'/'+${jsStr(opts.resultName)});var doc=null;var warn=[];var previousRuler=null;var previousType=null;
${HELPERS}
function writeResult(ok,detail,psd,jpg,png){var stats=doc?documentStats(doc):{groups:0,layers:0,smartObjects:0,textLayers:0,shapeLayers:0};resultFile.encoding='UTF8';resultFile.open('w');resultFile.write('{"success":'+(ok?'true':'false')+',"details":"'+jsonEscape(detail)+'","psdPath":"'+jsonEscape(psd||'')+'","jpgPath":"'+jsonEscape(jpg||'')+'","pngPath":"'+jsonEscape(png||'')+'","groupCount":'+stats.groups+',"layerCount":'+stats.layers+',"smartObjectCount":'+stats.smartObjects+',"textLayerCount":'+stats.textLayers+',"shapeLayerCount":'+stats.shapeLayers+',"expectedGroupCount":${manifest.totals.groups},"expectedLayerCount":${manifest.totals.photoshopLayers},"warnings":"'+jsonEscape(warn.join('|'))+'"}');resultFile.close();}
try{
app.displayDialogs=DialogModes.NO;previousRuler=app.preferences.rulerUnits;previousType=app.preferences.typeUnits;app.preferences.rulerUnits=Units.PIXELS;app.preferences.typeUnits=TypeUnits.PIXELS;
doc=app.documents.add(${scene.width},${scene.height},72,${jsStr(opts.docName)},NewDocumentMode.RGB,DocumentFill.TRANSPARENT);var bootstrapLayer=doc.activeLayer;
${body.join('\n')}
try{bootstrapLayer.remove();}catch(eBootstrap){warn.push('BOOTSTRAP_LAYER_REMOVE_FAILED:'+eBootstrap.message);}
var builtStats=documentStats(doc);if(builtStats.groups!=${manifest.totals.groups})warn.push('GROUP_COUNT_MISMATCH:'+builtStats.groups+':${manifest.totals.groups}');if(builtStats.layers!=${manifest.totals.photoshopLayers})warn.push('LAYER_COUNT_MISMATCH:'+builtStats.layers+':${manifest.totals.photoshopLayers}');if(builtStats.smartObjects!=${manifest.totals.smartObjects})warn.push('SMART_OBJECT_COUNT_MISMATCH:'+builtStats.smartObjects+':${manifest.totals.smartObjects}');if(builtStats.textLayers!=${manifest.totals.textLayers})warn.push('TEXT_LAYER_COUNT_MISMATCH:'+builtStats.textLayers+':${manifest.totals.textLayers}');
var psd=new File(out.fsName+'/'+${jsStr(opts.psdName)});var psdOptions=new PhotoshopSaveOptions();psdOptions.layers=true;psdOptions.embedColorProfile=true;doc.saveAs(psd,psdOptions,true,Extension.LOWERCASE);
${opts.exportJpg ? `var jpg=new File(out.fsName+'/'+${jsStr(opts.jpgName)});var jpgOptions=new JPEGSaveOptions();jpgOptions.quality=12;jpgOptions.embedColorProfile=true;doc.saveAs(jpg,jpgOptions,true,Extension.LOWERCASE);` : 'var jpg={fsName:""};'}
${opts.exportPng ? `var png=new File(out.fsName+'/'+${jsStr(opts.pngName)});var pngOptions=new PNGSaveOptions();pngOptions.compression=6;var pngDoc=doc.duplicate();pngDoc.flatten();pngDoc.saveAs(png,pngOptions,true,Extension.LOWERCASE);pngDoc.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=doc;` : 'var png={fsName:""};'}
writeResult(true,'Layered Studio poster created.',psd.fsName,jpg.fsName,png.fsName);
}catch(error){writeResult(false,error&&error.message?error.message:String(error),'','','');}
finally{try{if(previousRuler!==null)app.preferences.rulerUnits=previousRuler;if(previousType!==null)app.preferences.typeUnits=previousType;}catch(eUnits){}if(doc){try{doc.close(SaveOptions.DONOTSAVECHANGES);}catch(eClose){}}}
}());`;
  return { jsx, manifest };
}
