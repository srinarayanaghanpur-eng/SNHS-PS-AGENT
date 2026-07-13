// Registers all Google Photos connector IPC handlers. Every payload is validated
// with zod in the main process; no OAuth token or client secret ever crosses the
// bridge (§18) — handlers return only file paths, metadata and small preview
// data URLs the renderer needs.

import { ipcMain } from 'electron';
import {
  channels, gpAddTodaySchema, gpCommitSchema, gpListApprovedSchema, gpPlaceSchema, gpReplaceSchema,
} from '../../shared/ipc';
import { BRAND_ASSET_KEYS, type BrandAssetKey } from '../../shared/brandKit';
import { z } from 'zod';
import * as gp from './service';

const assetKeySchema = z.enum(BRAND_ASSET_KEYS);

export function registerGooglePhotosIpc(): void {
  ipcMain.handle(channels.gpStatus, async () => gp.status());
  ipcMain.handle(channels.gpConnect, async () => gp.connect());
  ipcMain.handle(channels.gpDisconnect, async () => gp.disconnect());
  ipcMain.handle(channels.gpRoleCatalog, async () => gp.roleCatalog());
  ipcMain.handle(channels.gpPick, async () => gp.pickForAssignment());
  ipcMain.handle(channels.gpCommit, async (_e, input) => {
    const { profileId, jobId, assignments } = gpCommitSchema.parse(input);
    return gp.commitAssignments(profileId, jobId, assignments);
  });
  ipcMain.handle(channels.gpAddToday, async (_e, input) => {
    const { role } = gpAddTodaySchema.parse(input ?? {});
    return gp.addTodaysPhotos(role);
  });
  ipcMain.handle(channels.gpReplace, async (_e, input) => {
    const { profileId, assetKey } = gpReplaceSchema.parse(input);
    return gp.replaceApprovedAsset(profileId, assetKeySchema.parse(assetKey) as BrandAssetKey);
  });
  ipcMain.handle(channels.gpListApproved, async (_e, input) => {
    const { profileId } = gpListApprovedSchema.parse(input);
    return gp.listApprovedAssets(profileId);
  });
  ipcMain.handle(channels.gpPlaceSmartObjects, async (_e, input) => {
    const { placements } = gpPlaceSchema.parse(input);
    return gp.placePhotos(placements);
  });
}
