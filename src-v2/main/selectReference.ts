import { resolve } from 'node:path';
import { assertPlainSerializable, importedFileSchema, type ImportedFile } from '../shared/importSchemas';
import { importReferenceFile } from './fileImport';

export const referenceDialogFilters = [{
  name: 'Reference posters',
  extensions: ['jpg', 'jpeg', 'png', 'webp', 'psd', 'pdf'],
}] as const;

export interface FileSelectionResult {
  canceled: boolean;
  filePaths: string[];
}

export type SelectFile = () => Promise<FileSelectionResult>;

export async function selectAndImportReference(selectFile: SelectFile, jobsRoot: string): Promise<ImportedFile | null> {
  const selection = await selectFile();
  if (selection.canceled || selection.filePaths.length === 0) return null;
  if (selection.filePaths.length !== 1) throw new Error('IMPORT_SELECTION_COUNT_INVALID');
  const sourcePath = resolve(selection.filePaths[0]);
  const result = importedFileSchema.parse(await importReferenceFile({ sourcePath }, jobsRoot));
  assertPlainSerializable(result);
  return result;
}
