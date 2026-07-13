import { PluginError } from '../utils/errors';
import { psDuplicateDocument } from '../bridge/apiClient';

export async function duplicateActiveDocument(name: string): Promise<number> {
  const result = await psDuplicateDocument();
  const idMatch = result.stdout?.match(/DOC_ID:(\d+)/);
  if (!idMatch) throw new PluginError('NO_DOCUMENT', 'No document open.', 'Open the template PSD first.');
  return Number(idMatch[1]);
}
