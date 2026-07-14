import { contextBridge, ipcRenderer } from 'electron';

const api = {
  dialog: {
    openFile: (options?: { filters?: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke('dialog:openFile', options),
    openFolder: () =>
      ipcRenderer.invoke('dialog:openFolder'),
    saveFile: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke('dialog:saveFile', options),
  },
  shell: {
    openPath: (path: string) =>
      ipcRenderer.invoke('shell:openPath', path),
  },
  app: {
    getPath: (name: string) =>
      ipcRenderer.invoke('app:getPath', name),
    getDataDir: () =>
      ipcRenderer.invoke('app:getDataDir'),
  },
  ps: {
    detect: () => ipcRenderer.invoke('ps:detect'),
    runJsx: (script: string) => ipcRenderer.invoke('ps:runJsx', { script }),
    openFile: (filePath: string) => ipcRenderer.invoke('ps:openFile', { filePath }),
    createDocument: (width: number, height: number, resolution?: number, name?: string) =>
      ipcRenderer.invoke('ps:createDocument', { width, height, resolution, name }),
    closeDocument: (docId: number) => ipcRenderer.invoke('ps:closeDocument', { docId }),
    duplicateDocument: (docId?: number) => ipcRenderer.invoke('ps:duplicateDocument', { docId }),
    savePsd: (filePath: string, docId?: number) => ipcRenderer.invoke('ps:savePsd', { filePath, docId }),
    savePng: (filePath: string, docId?: number) => ipcRenderer.invoke('ps:savePng', { filePath, docId }),
    saveJpeg: (filePath: string, quality?: number, docId?: number) =>
      ipcRenderer.invoke('ps:saveJpeg', { filePath, quality, docId }),
    addGroup: (name: string) => ipcRenderer.invoke('ps:addGroup', { name }),
    addTextLayer: (text: string, font: string, size: number, color: [number, number, number], left: number, top: number, alignment?: string) =>
      ipcRenderer.invoke('ps:addTextLayer', { text, font, size, color, left, top, alignment }),
    placeImage: (imagePath: string, name?: string) => ipcRenderer.invoke('ps:placeImage', { imagePath, name }),
    setVisibility: (layerId: number, visible: boolean) => ipcRenderer.invoke('ps:setVisibility', { layerId, visible }),
    setOpacity: (layerId: number, opacity: number) => ipcRenderer.invoke('ps:setOpacity', { layerId, opacity }),
    moveLayerIntoGroup: (layerId: number, groupId: number) =>
      ipcRenderer.invoke('ps:moveLayerIntoGroup', { layerId, groupId }),
    listFonts: () => ipcRenderer.invoke('ps:listFonts'),
    documentInfo: (docId?: number) => ipcRenderer.invoke('ps:documentInfo', { docId }),
    readLayers: (docId?: number) => ipcRenderer.invoke('ps:readLayers', { docId }),
    setBlendMode: (layerId: number, blendMode: string) =>
      ipcRenderer.invoke('ps:setBlendMode', { layerId, blendMode }),
    applyLayerMask: (layerId: number, maskType: string) =>
      ipcRenderer.invoke('ps:applyLayerMask', { layerId, maskType }),
    addGradientOverlay: (layerId: number, colors: string[], angle: number) =>
      ipcRenderer.invoke('ps:addGradientOverlay', { layerId, colors, angle }),
    addDropShadow: (layerId: number, distance: number, angle: number, size: number, color: string, opacity: number) =>
      ipcRenderer.invoke('ps:addDropShadow', { layerId, distance, angle, size, color, opacity }),
    addGaussianBlur: (layerId: number, radius: number) =>
      ipcRenderer.invoke('ps:addGaussianBlur', { layerId, radius }),
  },
  net: {
    fetchUrl: (url: string) => ipcRenderer.invoke('net:fetchUrl', { url }),
    fetchBinary: (url: string) => ipcRenderer.invoke('net:fetchBinary', { url }),
    searchImages: (query: string, orientation: string, limit: number) =>
      ipcRenderer.invoke('net:searchImages', { query, orientation, limit }),
    downloadImage: (url: string, destPath: string) =>
      ipcRenderer.invoke('net:downloadImage', { url, destPath }),
  },
  assetCache: {
    getCacheRoot: () => ipcRenderer.invoke('assetCache:getCacheRoot'),
    listCachedAssets: (category?: string) => ipcRenderer.invoke('assetCache:listCachedAssets', { category }),
    deleteCachedAsset: (id: string) => ipcRenderer.invoke('assetCache:deleteCachedAsset', { id }),
    clearCache: () => ipcRenderer.invoke('assetCache:clearCache'),
    getCacheStats: () => ipcRenderer.invoke('assetCache:getCacheStats'),
  },
  fs: {
    dataDir: () => ipcRenderer.invoke('fs:dataDir'),
    readText: (path: string) => ipcRenderer.invoke('fs:readText', { path }),
    writeText: (path: string, content: string) => ipcRenderer.invoke('fs:writeText', { path, content }),
    readBinary: (path: string) => ipcRenderer.invoke('fs:readBinary', { path }),
    writeBinary: (path: string, data: string) => ipcRenderer.invoke('fs:writeBinary', { path, data }),
    list: (path?: string) => ipcRenderer.invoke('fs:list', { path }),
    delete: (path: string) => ipcRenderer.invoke('fs:delete', { path }),
    copy: (src: string, dst: string) => ipcRenderer.invoke('fs:copy', { src, dst }),
    exists: (path: string) => ipcRenderer.invoke('fs:exists', { path }),
    copyFile: (sourcePath: string, destDir: string) => ipcRenderer.invoke('fs:copyFile', { sourcePath, destDir }),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
