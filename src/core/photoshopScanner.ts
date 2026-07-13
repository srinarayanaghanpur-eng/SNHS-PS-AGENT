import { PluginError } from '../utils/errors';
import { psReadLayers, psDocumentInfo } from '../bridge/apiClient';

export interface ScanResult {
  layers: any[];
  bounds: any[];
  texts: any[];
  docWidth: number;
  docHeight: number;
  docResolution: number;
  docName: string;
  docId: number;
}

export async function scanActiveDocument(onProgress?: (message: string, percent: number) => void): Promise<ScanResult> {
  onProgress?.('Reading PSD', 5);
  const info = await psDocumentInfo();
  const docIdMatch = info.stdout?.match(/DOC_ID:(\d+)/);
  const docNameMatch = info.stdout?.match(/DOC_NAME:(.+)/);
  const docWidthMatch = info.stdout?.match(/DOC_WIDTH:(\d+)/);
  const docHeightMatch = info.stdout?.match(/DOC_HEIGHT:(\d+)/);
  const docResMatch = info.stdout?.match(/DOC_RES:([\d.]+)/);

  if (!docIdMatch) throw new PluginError('NO_DOCUMENT', 'No Photoshop document is open.', 'Open a PSD template, then click Analyze Current PSD.');

  const docId = Number(docIdMatch[1]);
  onProgress?.('Reading layer hierarchy', 45);

  const data = await psReadLayers(docId);

  return {
    layers: data.layers || [],
    bounds: data.bounds || [],
    texts: data.texts || [],
    docWidth: Number(docWidthMatch?.[1] || 1920),
    docHeight: Number(docHeightMatch?.[1] || 1080),
    docResolution: Number(docResMatch?.[1] || 72),
    docName: (docNameMatch?.[1] || 'Untitled').trim(),
    docId,
  };
}
