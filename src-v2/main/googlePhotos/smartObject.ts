// Places validated Google-Photos assets into the active Photoshop document as
// Smart Objects, preserving each image's original aspect ratio (§12, §13).
// Reuses the existing DoJavaScript + $.evalFile transport (ps-transport.runJsx),
// the same pathway the poster generator and smoke test use — no new transport.

import { join } from 'node:path';
import { runJsx } from '../design-assistant/ps-transport';
import { createJobWorkspace } from '../storage';

export interface SmartObjectPlacement { path: string; layerName: string }
export interface PlaceResult { placed: string[]; skipped: { name: string; reason: string }[] }

// The "Plc " action creates a placed Smart Object; Photoshop keeps the source
// image's aspect ratio, so no width/height distortion is applied. Files are
// verified to exist inside the JSX before placing, and NOTHING is substituted
// when a path is missing — the layer is skipped and reported (§15, §17).
function buildJsx(placements: SmartObjectPlacement[], outDir: string): string {
  const items = JSON.stringify(placements.map((p) => ({ path: p.path.replace(/\\/g, '/'), name: p.layerName })));
  const out = outDir.replace(/\\/g, '/');
  return `#target photoshop
function cTID(s){return charIDToTypeID(s);}
function placeSmartObject(path){
  var f=new File(path);
  if(!f.exists){throw new Error('MISSING:'+path);}
  var d=new ActionDescriptor();
  d.putPath(cTID('null'), f);
  d.putEnumerated(cTID('FTcs'), cTID('QCSt'), cTID('Qcsa'));
  executeAction(cTID('Plc '), d, DialogModes.NO);
  return app.activeDocument.activeLayer; // placed layers are Smart Objects
}
var result={placed:[],skipped:[]};
try{
  if(app.documents.length===0){throw new Error('NO_ACTIVE_DOCUMENT');}
  var items=${items};
  for(var i=0;i<items.length;i++){
    try{ var lyr=placeSmartObject(items[i].path); lyr.name=items[i].name; result.placed.push(items[i].name); }
    catch(e){ result.skipped.push({name:items[i].name, reason:String(e.message||e)}); }
  }
  result.success=true;
}catch(e){ result.success=false; result.error=String(e.message||e); }
var out=new File('${out}/result.json');
out.encoding='UTF-8'; out.open('w'); out.write(JSON.stringify(result)); out.close();`;
}

export async function placeAsSmartObjects(placements: SmartObjectPlacement[]): Promise<PlaceResult> {
  if (placements.length === 0) return { placed: [], skipped: [] };
  const outDir = (await createJobWorkspace(`google-photos-place-${Date.now()}`)).output;
  const jsxPath = join(outDir, 'place-smart-objects.jsx');
  const { raw } = await runJsx<{ success: boolean; error?: string; placed: string[]; skipped: { name: string; reason: string }[] }>({
    outputDir: outDir, jsxPath, jsxSource: buildJsx(placements, outDir),
  });
  if (!raw.success) throw new Error(`PS_PLACE_FAILED: ${raw.error ?? 'unknown'}`);
  return { placed: raw.placed ?? [], skipped: raw.skipped ?? [] };
}
