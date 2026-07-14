export function jsxOpenDocument(filePath: string): string {
  const p = filePath.replace(/\\/g, '\\\\');
  return `app.open(File("${p}"));
var doc = app.activeDocument;
$.writeln("DOC_ID:" + doc.id);
$.writeln("DOC_WIDTH:" + doc.width);
$.writeln("DOC_HEIGHT:" + doc.height);
$.writeln("DOC_RES:" + doc.resolution);`;
}

export function jsxCreateDocument(width: number, height: number, resolution: number, name: string): string {
  return `var doc = app.documents.add(${width}, ${height}, ${resolution}, "${name.replace(/"/g, '\\"')}", NewDocumentMode.RGB, DocumentFill.WHITE);
$.writeln("DOC_ID:" + doc.id);`;
}

export function jsxCloseDocument(docId: number): string {
  return `var doc = app.documents.getById(${docId});
if (doc) doc.close(SaveOptions.DONOTSAVECHANGES);`;
}

export function jsxDuplicateDocument(docId?: number): string {
  if (docId) return `var doc = app.documents.getById(${docId}); var copy = doc.duplicate(); $.writeln("DOC_ID:" + copy.id);`;
  return `var doc = app.activeDocument; var copy = doc.duplicate(); $.writeln("DOC_ID:" + copy.id);`;
}

export function jsxSavePsd(filePath: string): string {
  const p = filePath.replace(/\\/g, '\\\\');
  return `var f = new File("${p}");
doc.saveAs(f, new PhotoshopSaveOptions(), true);`;
}

export function jsxSavePng(filePath: string): string {
  const p = filePath.replace(/\\/g, '\\\\');
  return `var f = new File("${p}");
var opts = new PNGSaveOptions();
opts.compression = 6;
doc.saveAs(f, opts, true);`;
}

export function jsxSaveJpeg(filePath: string, quality = 11): string {
  const p = filePath.replace(/\\/g, '\\\\');
  return `var f = new File("${p}");
var opts = new JPEGSaveOptions();
opts.quality = ${quality};
doc.saveAs(f, opts, true);`;
}

export function jsxAddGroup(name: string): string {
  return `var group = doc.layerSets.add();
group.name = "${name.replace(/"/g, '\\"')}";
$.writeln("LAYER_ID:" + group.id);`;
}

export function jsxAddTextLayer(text: string, font: string, size: number, color: [number, number, number], left: number, top: number, alignment?: string): string {
  return `var layer = doc.artLayers.add();
layer.kind = LayerKind.TEXT;
var ti = layer.textItem;
ti.contents = "${text.replace(/"/g, '\\"').replace(/\n/g, '\\n')}";
try { ti.font = "${font}"; } catch(e) {}
try { ti.size = ${size}; } catch(e) {}
try { ti.color.rgb.red = ${color[0]}; ti.color.rgb.green = ${color[1]}; ti.color.rgb.blue = ${color[2]}; } catch(e) {}
try { ti.position = Array(${left}, ${top}); } catch(e) {}
${alignment ? `try { ti.justification = Justification.${alignment.toUpperCase()}; } catch(e) {}` : ''}
$.writeln("LAYER_ID:" + layer.id);`;
}

export function jsxAddImageLayer(imagePath: string, name: string): string {
  const p = imagePath.replace(/\\/g, '\\\\');
  return `var f = new File("${p}");
var layer = doc.artLayers.add();
layer.name = "${name.replace(/"/g, '\\"')}";
var idplc = stringIDToTypeID("placeEvent");
var desc = new ActionDescriptor();
desc.putPath(charIDToTypeID("null"), f);
desc.putEnumerate(stringIDToTypeID("freeTransformCenterState"), stringIDToTypeID("quadCenterState"), stringIDToTypeID("QCSAverage"));
executeAction(idplc, desc, DialogModes.NO);
$.writeln("LAYER_ID:" + doc.activeLayer.id);`;
}

export function jsxSetLayerVisibility(layerId: number, visible: boolean): string {
  return `try {
var desc = new ActionDescriptor();
var ref = new ActionReference();
ref.putIdentifier(charIDToTypeID("Lyr "), ${layerId});
desc.putReference(charIDToTypeID("null"), ref);
executeAction(${visible ? 'stringIDToTypeID("show")' : 'stringIDToTypeID("hide")'}, desc, DialogModes.NO);
} catch(e) { $.writeln("WARN:setVisibility:" + e); }`;
}

export function jsxSetLayerOpacity(layerId: number, opacity: number): string {
  return `try {
var desc = new ActionDescriptor();
var ref = new ActionReference();
ref.putIdentifier(charIDToTypeID("Lyr "), ${layerId});
desc.putReference(charIDToTypeID("null"), ref);
desc.putInteger(charIDToTypeID("Opct"), ${Math.max(0, Math.min(100, opacity))});
executeAction(charIDToTypeID("setd"), desc, DialogModes.NO);
} catch(e) { $.writeln("WARN:setOpacity:" + e); }`;
}

export function jsxMoveLayerIntoGroup(layerId: number, groupId: number): string {
  return `try {
var desc = new ActionDescriptor();
var ref = new ActionReference();
ref.putIdentifier(charIDToTypeID("Lyr "), ${layerId});
desc.putReference(charIDToTypeID("null"), ref);
var toRef = new ActionReference();
toRef.putIdentifier(charIDToTypeID("Lyr "), ${groupId});
desc.putReference(charIDToTypeID("T   "), toRef);
executeAction(stringIDToTypeID("move"), desc, DialogModes.NO);
} catch(e) { $.writeln("WARN:moveIntoGroup:" + e); }`;
}

export function jsxGetLayerBounds(layerId: number): string {
  return `try {
var layer = doc.layers.getById(${layerId});
var b = layer.bounds;
$.writeln("BOUNDS:" + b[0].value + "," + b[1].value + "," + b[2].value + "," + b[3].value);
} catch(e) { $.writeln("WARN:bounds:" + e); }`;
}

export function jsxListFonts(): string {
  return `var fonts = app.fonts;
for (var i = 0; i < fonts.length; i++) {
  $.writeln("FONT:" + fonts[i].name + "|" + fonts[i].postScriptName + "|" + fonts[i].family + "|" + fonts[i].style);
}`;
}

export function jsxGetDocumentInfo(docId?: number): string {
  const src = docId ? `app.documents.getById(${docId})` : 'app.activeDocument';
  return `var doc = ${src};
if (doc) {
$.writeln("DOC_ID:" + doc.id);
$.writeln("DOC_NAME:" + doc.name);
$.writeln("DOC_WIDTH:" + doc.width);
$.writeln("DOC_HEIGHT:" + doc.height);
$.writeln("DOC_RES:" + doc.resolution);
} else { $.writeln("ERROR:No document"); }`;
}

export function jsxSetBlendMode(layerId: number, blendMode: string): string {
  const modeMap: Record<string, string> = {
    normal: 'BlendMode.NORMAL', multiply: 'BlendMode.MULTIPLY', screen: 'BlendMode.SCREEN',
    overlay: 'BlendMode.OVERLAY', darken: 'BlendMode.DARKEN', lighten: 'BlendMode.LIGHTEN',
    color: 'BlendMode.COLOR', luminosity: 'BlendMode.LUMINOSITY', softLight: 'BlendMode.SOFTLIGHT',
    hardLight: 'BlendMode.HARDLIGHT', difference: 'BlendMode.DIFFERENCE', exclusion: 'BlendMode.EXCLUSION',
    hue: 'BlendMode.HUE', saturation: 'BlendMode.SATURATION'
  };
  const jsMode = modeMap[blendMode.toLowerCase()] || 'BlendMode.NORMAL';
  return `try {
var layer = doc.layers.getById(${layerId});
layer.blendMode = ${jsMode};
} catch(e) { $.writeln("WARN:setBlendMode:" + e); }`;
}

export function jsxAddLayerMask(layerId: number, maskType: string): string {
  return `try {
var layer = doc.layers.getById(${layerId});
${maskType === 'reveal' ?
    'layer.add();' :
    'layer.add(); layer.maskEnabled = true;'
  }
} catch(e) { $.writeln("WARN:addLayerMask:" + e); }`;
}

export function jsxAddDropShadow(layerId: number, distance: number, angle: number, size: number, color: string, opacity: number): string {
  const r = parseInt(color.slice(1, 3), 16) || 0;
  const g = parseInt(color.slice(3, 5), 16) || 0;
  const b = parseInt(color.slice(5, 7), 16) || 0;
  return `try {
var layer = doc.layers.getById(${layerId});
var desc = new ActionDescriptor();
var ref = new ActionReference();
ref.putIdentifier(charIDToTypeID("Lyr "), ${layerId});
desc.putReference(charIDToTypeID("null"), ref);
var effectDesc = new ActionDescriptor();
effectDesc.putInteger(charIDToTypeID("Dstr"), ${distance});
effectDesc.putInteger(charIDToTypeID("Std "), ${size});
effectDesc.putInteger(charIDToTypeID("blu"), ${size});
effectDesc.putUnitDouble(charIDToTypeID("Angl"), charIDToTypeID("#Ang"), ${angle});
effectDesc.putDouble(charIDToTypeID("Opct"), ${opacity});
var colorDesc = new ActionDescriptor();
colorDesc.putDouble(charIDToTypeID("Rd  "), ${r});
colorDesc.putDouble(charIDToTypeID("Grn "), ${g});
colorDesc.putDouble(charIDToTypeID("Bl  "), ${b});
effectDesc.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), colorDesc);
desc.putObject(charIDToTypeID("T   "), stringIDToTypeID("dropShadow"), effectDesc);
executeAction(charIDToTypeID("setd"), desc, DialogModes.NO);
} catch(e) { $.writeln("WARN:addDropShadow:" + e); }`;
}

export function jsxAddGradientOverlay(layerId: number, colors: string[], angle: number): string {
  const colorStops = colors.map((c, i) => {
    const r = parseInt(c.slice(1, 3), 16) || 0;
    const g = parseInt(c.slice(3, 5), 16) || 0;
    const b = parseInt(c.slice(5, 7), 16) || 0;
    return `var stop${i} = new ActionDescriptor();
    stop${i}.putDouble(charIDToTypeID("Lctn"), ${Math.round((i / (colors.length - 1)) * 100)});
    var clr${i} = new ActionDescriptor();
    clr${i}.putDouble(charIDToTypeID("Rd  "), ${r});
    clr${i}.putDouble(charIDToTypeID("Grn "), ${g});
    clr${i}.putDouble(charIDToTypeID("Bl  "), ${b});
    stop${i}.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), clr${i});`;
  }).join('\n    ');
  const stopRefs = colors.map((_, i) => `stop${i}`).join(', ');
  return `try {
var layer = doc.layers.getById(${layerId});
var desc = new ActionDescriptor();
var ref = new ActionReference();
ref.putIdentifier(charIDToTypeID("Lyr "), ${layerId});
desc.putReference(charIDToTypeID("null"), ref);
var effectDesc = new ActionDescriptor();
var gradient = new ActionDescriptor();
gradient.putDouble(charIDToTypeID("Angl"), ${angle});
gradient.putEnumerate(stringIDToTypeID("type"), stringIDToTypeID("gradientType"), stringIDToTypeID("linear"));
var colorsDesc = new ActionDescriptor();
colorsDesc.putObject(charIDToTypeID("Clrs"), stringIDToTypeID("gradientColorStops"), ${stopRefs.length > 0 ? `(function(){ var d = new ActionDescriptor(); [${stopRefs}].forEach(function(s,i){ d.putObject(i, charIDToTypeID("GClr"), s); }); return d; })()` : 'new ActionDescriptor()'});
gradient.putObject(charIDToTypeID("Grad"), charIDToTypeID("Grad"), colorsDesc);
effectDesc.putObject(stringIDToTypeID("gradientOverlay"), stringIDToTypeID("gradientOverlay"), gradient);
desc.putObject(charIDToTypeID("T   "), stringIDToTypeID("layerEffects"), effectDesc);
executeAction(charIDToTypeID("setd"), desc, DialogModes.NO);
} catch(e) { $.writeln("WARN:addGradientOverlay:" + e); }`;
}

export function jsxAddGaussianBlur(layerId: number, radius: number): string {
  return `try {
var layer = doc.layers.getById(${layerId});
var desc = new ActionDescriptor();
var ref = new ActionReference();
ref.putIdentifier(charIDToTypeID("Lyr "), ${layerId});
desc.putReference(charIDToTypeID("null"), ref);
var filterDesc = new ActionDescriptor();
filterDesc.putUnitDouble(charIDToTypeID("Rds "), charIDToTypeID("#Pxl"), ${radius});
desc.putObject(charIDToTypeID("T   "), stringIDToTypeID("gaussianBlur"), filterDesc);
executeAction(stringIDToTypeID("filter"), desc, DialogModes.NO);
} catch(e) { $.writeln("WARN:addGaussianBlur:" + e); }`;
}

export function jsxReadLayerInfo(docId?: number): string {
  const src = docId ? `app.documents.getById(${docId})` : 'app.activeDocument';
  return `var doc = ${src};
function walk(layers, path) {
  for (var i = 0; i < layers.length; i++) {
    var l = layers[i];
    var type = "unknown";
    try { if (l.typename == "LayerSet") { type = "group"; } else if (l.kind == LayerKind.TEXT) { type = "text"; } else if (l.kind == LayerKind.SMARTOBJECT) { type = "smartObject"; } else { type = "pixel"; } } catch(e) {}
    $.writeln("LAYER:" + l.id + "|" + (path + "/" + l.name) + "|" + type + "|" + l.visible + "|" + l.opacity + "|" + l.locked);
    try { var b = l.bounds; $.writeln("BOUNDS:" + l.id + "|" + b[0].value + "|" + b[1].value + "|" + b[2].value + "|" + b[3].value); } catch(e) {}
    try { if (l.textItem) { $.writeln("TEXT:" + l.id + "|" + l.textItem.contents.replace(/\\n/g, "\\\\n")); } } catch(e) {}
    try { if (l.layers) walk(l.layers, path + "/" + l.name); } catch(e) {}
  }
}
walk(doc.layers, doc.name);`;
}
