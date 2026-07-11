declare global {
  interface Window {
    electronAPI?: import('../../electron/preload').ElectronAPI;
  }
}

function api(): import('../../electron/preload').ElectronAPI {
  if (!window.electronAPI) throw new Error('Electron API not available. Run as desktop app.');
  return window.electronAPI;
}

export async function uploadFile(dir: string, file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const path = dir + '/' + file.name;
  await api().fs.writeBinary(path, base64);
  return path;
}

export async function uploadFileToDir(dir: string, file: File): Promise<string> {
  return uploadFile(dir, file);
}

export async function readText(path: string): Promise<string> {
  const data = await api().fs.readText(path);
  return data.content;
}

export async function writeText(path: string, content: string): Promise<void> {
  await api().fs.writeText(path, content);
}

export async function listDir(path: string): Promise<{ name: string; isFile: boolean; isFolder: boolean; size: number }[]> {
  const data = await api().fs.list(path);
  return data.entries;
}

export async function deleteEntry(path: string): Promise<void> {
  await api().fs.delete(path);
}

export async function exists(path: string): Promise<boolean> {
  const data = await api().fs.exists(path);
  return data.exists;
}

export async function dataDir(): Promise<string> {
  const data = await api().fs.dataDir();
  return data.path;
}

export async function selectFile(accept = '.png,.jpg,.jpeg,.webp'): Promise<{ name: string; path: string } | null> {
  const filters = [{ name: 'Files', extensions: accept.replace(/\./g, '').split(',') }];
  const result = await api().dialog.openFile({ filters });
  if (!result) return null;
  const dir = await dataDir();
  const copied = await api().fs.copyFile(result.path, dir);
  return copied;
}

export async function selectFolder(): Promise<string | null> {
  return api().dialog.openFolder();
}

export async function downloadFile(path: string, filename: string): Promise<void> {
  const base64 = await api().fs.readBinary(path);
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([bytes]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function psDetect(): Promise<{ available: boolean; version?: string }> {
  return api().ps.detect();
}

export async function psRunJsx(script: string): Promise<{ stdout: string; success: boolean }> {
  return api().ps.runJsx(script);
}

export async function psOpenFile(filePath: string): Promise<any> {
  return api().ps.openFile(filePath);
}

export async function psCreateDocument(width: number, height: number, resolution = 72, name = 'Poster'): Promise<any> {
  return api().ps.createDocument(width, height, resolution, name);
}

export async function psAddGroup(name: string): Promise<any> {
  return api().ps.addGroup(name);
}

export async function psAddTextLayer(text: string, font: string, size: number, color: [number, number, number], left: number, top: number, alignment?: string): Promise<any> {
  return api().ps.addTextLayer(text, font, size, color, left, top, alignment);
}

export async function psPlaceImage(imagePath: string, name?: string): Promise<any> {
  return api().ps.placeImage(imagePath, name);
}

export async function psSetVisibility(layerId: number, visible: boolean): Promise<any> {
  return api().ps.setVisibility(layerId, visible);
}

export async function psSetOpacity(layerId: number, opacity: number): Promise<any> {
  return api().ps.setOpacity(layerId, opacity);
}

export async function psMoveLayerIntoGroup(layerId: number, groupId: number): Promise<any> {
  return api().ps.moveLayerIntoGroup(layerId, groupId);
}

export async function psListFonts(): Promise<any> {
  return api().ps.listFonts();
}

export async function psDocumentInfo(docId?: number): Promise<any> {
  return api().ps.documentInfo(docId);
}

export async function psReadLayers(docId?: number): Promise<any> {
  return api().ps.readLayers(docId);
}

export async function psSavePsd(filePath: string, docId?: number): Promise<any> {
  return api().ps.savePsd(filePath, docId);
}

export async function psSavePng(filePath: string, docId?: number): Promise<any> {
  return api().ps.savePng(filePath, docId);
}

export async function psSaveJpeg(filePath: string, quality = 11, docId?: number): Promise<any> {
  return api().ps.saveJpeg(filePath, quality, docId);
}

export async function psDuplicateDocument(docId?: number): Promise<any> {
  return api().ps.duplicateDocument(docId);
}
