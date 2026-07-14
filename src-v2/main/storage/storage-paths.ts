import { join } from 'node:path';

export class StoragePaths {
  constructor(private root: string) {}

  getStorageRoot(): string { return this.root; }

  getJobsDirectory(): string { return join(this.root, 'jobs'); }
  getJobDir(jobId: string): string { return join(this.root, 'jobs', jobId); }
  getJobOutputDir(jobId: string): string { return join(this.root, 'jobs', jobId, 'output'); }

  getOutputsDirectory(): string { return join(this.root, 'outputs'); }
  getOutputsPsdDirectory(): string { return join(this.root, 'outputs', 'psd'); }
  getOutputsPngDirectory(): string { return join(this.root, 'outputs', 'png'); }
  getOutputsJpgDirectory(): string { return join(this.root, 'outputs', 'jpg'); }
  getOutputsPdfDirectory(): string { return join(this.root, 'outputs', 'pdf'); }

  getAssetsDirectory(): string { return join(this.root, 'assets'); }

  getCacheDirectory(): string { return join(this.root, 'cache'); }
  getCachePreviewsDirectory(): string { return join(this.root, 'cache', 'previews'); }
  getCacheThumbnailsDirectory(): string { return join(this.root, 'cache', 'thumbnails'); }
  getCacheTemporaryDirectory(): string { return join(this.root, 'cache', 'temporary'); }

  getHistoryDirectory(): string { return join(this.root, 'history'); }
  getLogsDirectory(): string { return join(this.root, 'logs'); }
  getBackupsDirectory(): string { return join(this.root, 'backups'); }

  getPosterBrainDirectory(): string { return join(this.root, 'poster-brain'); }
  getPosterBrainDatasetsDirectory(): string { return join(this.root, 'poster-brain', 'datasets'); }
  getPosterBrainModelsDirectory(): string { return join(this.root, 'poster-brain', 'models'); }

  getAcceptanceDirectory(): string { return join(this.root, 'acceptance'); }
  getTestRunsDirectory(): string { return join(this.root, 'test-runs'); }

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

  getAllDirectories(): string[] {
    return [
      this.getJobsDirectory(),
      this.getOutputsDirectory(),
      this.getOutputsPsdDirectory(),
      this.getOutputsPngDirectory(),
      this.getOutputsJpgDirectory(),
      this.getOutputsPdfDirectory(),
      this.getAssetsDirectory(),
      this.getCacheDirectory(),
      this.getCachePreviewsDirectory(),
      this.getCacheThumbnailsDirectory(),
      this.getCacheTemporaryDirectory(),
      this.getHistoryDirectory(),
      this.getLogsDirectory(),
      this.getBackupsDirectory(),
      this.getPosterBrainDirectory(),
      this.getPosterBrainDatasetsDirectory(),
      this.getPosterBrainModelsDirectory(),
      this.getAcceptanceDirectory(),
      this.getTestRunsDirectory(),
    ];
  }
}
