import { join } from 'node:path';
import { createStoragePaths, REQUIRED_DIRECTORIES, type RuntimeStoragePaths } from './storagePaths.mjs';

export class StoragePaths {
  private readonly runtime: RuntimeStoragePaths;
  constructor(private root: string) { this.runtime = createStoragePaths(root); }

  getStorageRoot(): string { return this.root; }

  getJobsDirectory(): string { return join(this.root, 'jobs'); }
  getJobDir(jobId: string): string { return join(this.root, 'jobs', jobId); }
  getJobOutputDir(jobId: string): string { return join(this.root, 'jobs', jobId, 'output'); }

  getOutputsDirectory(): string { return join(this.root, 'exports'); }
  getOutputsPsdDirectory(): string { return join(this.root, 'psd'); }
  getOutputsPngDirectory(): string { return join(this.root, 'exports', 'png'); }
  getOutputsJpgDirectory(): string { return join(this.root, 'exports', 'jpg'); }
  getOutputsPdfDirectory(): string { return join(this.root, 'exports', 'pdf'); }

  getAssetsDirectory(): string { return join(this.root, 'assets'); }

  getCacheDirectory(): string { return join(this.root, 'temp', 'cache'); }
  getCachePreviewsDirectory(): string { return join(this.root, 'previews'); }
  getCacheThumbnailsDirectory(): string { return join(this.root, 'previews', 'thumbnails'); }
  getCacheTemporaryDirectory(): string { return join(this.root, 'temp'); }
  getCacheFontsDirectory(): string { return this.runtime.cacheFonts; }
  getCacheImageAnalysisDirectory(): string { return this.runtime.cacheImageAnalysis; }

  getHistoryDirectory(): string { return join(this.root, 'history'); }
  getLogsDirectory(): string { return join(this.root, 'logs'); }
  getBackupsDirectory(): string { return join(this.root, 'backups'); }

  getPosterBrainDirectory(): string { return join(this.root, 'poster-brain'); }
  getPosterBrainDatasetsDirectory(): string { return join(this.root, 'poster-brain', 'datasets'); }
  getPosterBrainModelsDirectory(): string { return join(this.root, 'poster-brain', 'models'); }
  getPosterBrainEmbeddingsDirectory(): string { return this.runtime.posterBrainEmbeddings; }
  getPosterBrainCheckpointsDirectory(): string { return this.runtime.posterBrainCheckpoints; }
  getPosterBrainTrainingRunsDirectory(): string { return this.runtime.posterBrainTrainingRuns; }

  getAcceptanceDirectory(): string { return join(this.root, 'acceptance'); }
  getTestRunsDirectory(): string { return join(this.root, 'test-runs'); }
  getSettingsDirectory(): string { return this.runtime.settings; }
  getSchoolProfilesDirectory(): string { return this.runtime.schoolProfiles; }
  getAssistantDownloadsDirectory(): string { return this.runtime.assistantDownloads; }
  getApprovedLibraryDirectory(): string { return this.runtime.approvedLibrary; }
  getTemplatesDirectory(): string { return this.runtime.templates; }
  getAssetsSchoolLogosDirectory(): string { return this.runtime.assetsSchoolLogos; }
  getAssetsLeadLogosDirectory(): string { return this.runtime.assetsLeadLogos; }
  getAssetsChairmanDirectory(): string { return this.runtime.assetsChairman; }
  getAssetsPrincipalDirectory(): string { return this.runtime.assetsPrincipal; }
  getAssetsCampusesDirectory(): string { return this.runtime.assetsCampuses; }
  getAssetsEventPhotosDirectory(): string { return this.runtime.assetsEventPhotos; }
  getAssetsBackgroundsDirectory(): string { return this.runtime.assetsBackgrounds; }

  getHistoryPath(): string { return join(this.root, 'history', 'poster-history.json'); }
  getLoggerPath(dateStr: string): string { return join(this.root, 'logs', `agent-${dateStr}.log`); }
  getProfilesIndexPath(): string { return join(this.root, 'poster-brain', 'profiles.json'); }
  getDefaultProfilePath(): string { return join(this.root, 'poster-brain', '_default.json'); }
  getProfileDir(profileId: string): string { return join(this.root, 'poster-brain', 'profiles', profileId); }
  getProfilePath(profileId: string): string { return join(this.root, 'poster-brain', 'profiles', profileId, 'profile.json'); }

  resolve(relativePath: string): string {
    return join(this.root, relativePath);
  }

  relativize(absolutePath: string): string {
    const normalized = absolutePath.replace(/\\/g, '/');
    const root = this.root.replace(/\\/g, '/');
    if (normalized.startsWith(root + '/')) {
      return normalized.slice(root.length + 1);
    }
    return absolutePath;
  }

  getAllDirectories(): string[] { return REQUIRED_DIRECTORIES.map((relative) => join(this.root, relative)); }
}
