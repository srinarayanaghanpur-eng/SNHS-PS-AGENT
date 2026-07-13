export const generateJsx = {
  selectLayer(layerId: number): string {
    return `var desc = new ActionDescriptor();
var ref = new ActionReference();
ref.putIdentifier(charIDToTypeID("Lyr "), ${layerId});
desc.putReference(charIDToTypeID("null"), ref);
desc.putBoolean(charIDToTypeID("MkVs"), false);
executeAction(charIDToTypeID("slct"), desc, DialogModes.NO);`;
  },

  translateAndScale(layerId: number, dx: number, dy: number, scale: number): string {
    return `var ref = new ActionReference();
ref.putIdentifier(charIDToTypeID("Lyr "), ${layerId});
var desc = new ActionDescriptor();
desc.putReference(charIDToTypeID("null"), ref);
desc.putObject(charIDToTypeID("T   "), charIDToTypeID("Trnf"), {
  ${dx !== 0 ? `horizontal: {_unit: "pixelsUnit", _value: ${dx}},` : ''}
  ${dy !== 0 ? `vertical: {_unit: "pixelsUnit", _value: ${dy}},` : ''}
  width: {_unit: "percentUnit", _value: ${scale * 100}},
  height: {_unit: "percentUnit", _value: ${scale * 100}}
});
executeAction(charIDToTypeID("Trnf"), desc, DialogModes.NO);`;
  },

  replaceSmartObject(layerId: number, filePath: string): string {
    const p = filePath.replace(/\\/g, '\\\\');
    return `var desc = new ActionDescriptor();
var ref = new ActionReference();
ref.putIdentifier(charIDToTypeID("Lyr "), ${layerId});
desc.putReference(charIDToTypeID("null"), ref);
desc.putPath(charIDToTypeID("null"), new File("${p}"));
executeAction(stringIDToTypeID("placedLayerReplaceContents"), desc, DialogModes.NO);`;
  },

  placeEmbedded(filePath: string): string {
    const p = filePath.replace(/\\/g, '\\\\');
    return `var desc = new ActionDescriptor();
desc.putPath(charIDToTypeID("null"), new File("${p}"));
desc.putEnumerate(stringIDToTypeID("freeTransformCenterState"), stringIDToTypeID("quadCenterState"), stringIDToTypeID("QCSAverage"));
executeAction(stringIDToTypeID("placeEvent"), desc, DialogModes.NO);
$.writeln("LAYER_ID:" + app.activeDocument.activeLayer.id);`;
  },

  setLayerOpacity(layerId: number, opacity: number): string {
    return `var desc = new ActionDescriptor();
var ref = new ActionReference();
ref.putIdentifier(charIDToTypeID("Lyr "), ${layerId});
desc.putReference(charIDToTypeID("null"), ref);
desc.putInteger(charIDToTypeID("Opct"), ${Math.max(0, Math.min(100, opacity))});
executeAction(charIDToTypeID("setd"), desc, DialogModes.NO);`;
  },

  setLayerVisibility(layerId: number, visible: boolean): string {
    const action = visible ? 'stringIDToTypeID("show")' : 'stringIDToTypeID("hide")';
    return `var desc = new ActionDescriptor();
var ref = new ActionReference();
ref.putIdentifier(charIDToTypeID("Lyr "), ${layerId});
desc.putReference(charIDToTypeID("null"), ref);
executeAction(${action}, desc, DialogModes.NO);`;
  },

  renameLayer(layerId: number, name: string): string {
    return `var desc = new ActionDescriptor();
var ref = new ActionReference();
ref.putIdentifier(charIDToTypeID("Lyr "), ${layerId});
desc.putReference(charIDToTypeID("null"), ref);
desc.putString(charIDToTypeID("Nm  "), "${name.replace(/"/g, '\\"')}");
executeAction(charIDToTypeID("setd"), desc, DialogModes.NO);`;
  },

  addGroup(name: string): string {
    return `var desc = new ActionDescriptor();
desc.putString(charIDToTypeID("Nm  "), "${name.replace(/"/g, '\\"')}");
var ref = new ActionReference();
ref.putClass(charIDToTypeID("Lyr "));
desc.putReference(charIDToTypeID("null"), ref);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
$.writeln("LAYER_ID:" + app.activeDocument.activeLayer.id);`;
  },

  duplicateLayer(layerId: number): string {
    return `var desc = new ActionDescriptor();
var ref = new ActionReference();
ref.putIdentifier(charIDToTypeID("Lyr "), ${layerId});
desc.putReference(charIDToTypeID("null"), ref);
executeAction(stringIDToTypeID("duplicate"), desc, DialogModes.NO);
$.writeln("LAYER_ID:" + app.activeDocument.activeLayer.id);`;
  },

  moveLayerIntoGroup(layerId: number, groupId: number): string {
    return `var desc = new ActionDescriptor();
var ref = new ActionReference();
ref.putIdentifier(charIDToTypeID("Lyr "), ${layerId});
desc.putReference(charIDToTypeID("null"), ref);
var toRef = new ActionReference();
toRef.putIdentifier(charIDToTypeID("Lyr "), ${groupId});
desc.putReference(charIDToTypeID("T   "), toRef);
executeAction(stringIDToTypeID("move"), desc, DialogModes.NO);`;
  },

  closeDocument(docId: number): string {
    return `var doc = app.documents.getById(${docId});
if (doc) doc.close(SaveOptions.DONOTSAVECHANGES);`;
  },

  makeSizedCopy(docId: number, format: string, target: [number, number]): string {
    return `var src = app.documents.getById(${docId});
if (!src) { $.writeln("ERROR:doc not found"); }
var copy = src.duplicate("${format}_copy", false);
var w = copy.width, h = copy.height;
var scale = Math.min(${target[0]} / w, ${target[1]} / h);
copy.resizeImage(Math.round(w * scale), Math.round(h * scale), copy.resolution, ResampleMethod.BICUBIC);
copy.resizeCanvas(${target[0]}, ${target[1]}, AnchorPosition.MIDDLECENTER);
$.writeln("DOC_ID:" + copy.id);`;
  },

  setTextContents(layerId: number, text: string): string {
    return `var desc = new ActionDescriptor();
var ref = new ActionReference();
ref.putIdentifier(charIDToTypeID("Lyr "), ${layerId});
desc.putReference(charIDToTypeID("null"), ref);
var td = new ActionDescriptor();
td.putString(charIDToTypeID("Txt "), "${text.replace(/"/g, '\\"').replace(/\n/g, '\\n')}");
desc.putObject(charIDToTypeID("T   "), charIDToTypeID("Txt "), td);
executeAction(charIDToTypeID("setd"), desc, DialogModes.NO);`;
  },
};
