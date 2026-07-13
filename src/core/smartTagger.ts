import type { TemplateManifest } from '../types';
import { PluginError } from '../utils/errors';
import { psRunJsx, psReadLayers } from '../bridge/apiClient';

export async function tagLayers(manifest: TemplateManifest): Promise<void> {
  const docInfo = await psReadLayers();
  if (!docInfo.layers?.length) throw new PluginError('NO_DOCUMENT', 'No document open.', 'Open the analyzed PSD.');

  const byId = new Map(manifest.layers.map(l => [l.layerId, l]));
  const jsx: string[] = [];

  function walk(layers: any[], path: string) {
    for (const l of layers) {
      const m = byId.get(Number(l.id));
      if (m && m.semanticRole !== 'unknown' && !l.name?.includes('[SNHS:')) {
        jsx.push(`try {
  var desc = new ActionDescriptor();
  var ref = new ActionReference();
  ref.putIdentifier(charIDToTypeID("Lyr "), ${l.id});
  desc.putReference(charIDToTypeID("null"), ref);
  desc.putString(charIDToTypeID("Nm  "), "${(l.name || '').replace(/"/g, '\\"')} [SNHS:${m.semanticRole}]");
  executeAction(charIDToTypeID("setd"), desc, DialogModes.NO);
} catch(e) { $.writeln("WARN:tag " + e); }`);
      }
      if (l.layers) walk(l.layers, path + '/' + l.name);
    }
  }
  walk(docInfo.layers, docInfo.name || '');
  if (jsx.length) await psRunJsx(jsx.join('\n'));
  manifest.tagged = true;
}
