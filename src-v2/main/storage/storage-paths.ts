import { join } from 'node:path';

export class StoragePaths {
  constructor(private root: string) {}

  getStorageRoot(): string { return this.root; }

  getProjectsDirectory(): string { return join(this.root, 'Projects'); }
  getProjectDirectory(projectId: string): string { return join(this.root, 'Projects', projectId); }

  getAssetsDirectory(): string { return join(this.root, 'Assets'); }
  getAssetsSchoolLogosDirectory(): string { return join(this.root, 'Assets', 'School Logos'); }
  getAssetsLeadLogosDirectory(): string { return join(this.root, 'Assets', 'LEAD Logos'); }
  getAssetsLeadershipPhotosDirectory(): string { return join(this.root, 'Assets', 'Leadership Photos'); }
  getAssetsCampusPhotosDirectory(): string { return join(this.root, 'Assets', 'Campus Photos'); }
  getAssetsStudentPhotosDirectory(): string { return join(this.root, 'Assets', 'Student Photos'); }
  getAssetsEventPhotosDirectory(): string { return join(this.root, 'Assets', 'Event Photos'); }
  getAssetsDecorativeDirectory(): string { return join(this.root, 'Assets', 'Decorative Assets'); }

  getPhotoshopDirectory(): string { return join(this.root, 'Photoshop'); }
  getPhotoshopPsdDirectory(): string { return join(this.root, 'Photoshop', 'PSD'); }
  getPhotoshopPngDirectory(): string { return join(this.root, 'Photoshop', 'PNG'); }
  getPhotoshopJpgDirectory(): string { return join(this.root, 'Photoshop', 'JPG'); }
  getPhotoshopTemplateDirectory(): string { return join(this.root, 'Photoshop', 'Templates'); }

  getPremiereDirectory(): string { return join(this.root, 'Premiere'); }
  getPremiereProjectDirectory(): string { return join(this.root, 'Premiere', 'Projects'); }
  getPremiereExportDirectory(): string { return join(this.root, 'Premiere', 'Exports'); }
  getPremiereMediaDirectory(): string { return join(this.root, 'Premiere', 'Media'); }

  getWordDirectory(): string { return join(this.root, 'Word'); }
  getWordDocxDirectory(): string { return join(this.root, 'Word', 'DOCX'); }
  getWordPdfDirectory(): string { return join(this.root, 'Word', 'PDF'); }
  getWordTemplateDirectory(): string { return join(this.root, 'Word', 'Templates'); }

  getModelsDirectory(): string { return join(this.root, 'AI Models'); }
  getDatabaseDirectory(): string { return join(this.root, 'Database'); }
  getCacheDirectory(): string { return join(this.root, 'Cache'); }
  getTempDirectory(): string { return join(this.root, 'Temp'); }
  getLogsDirectory(): string { return join(this.root, 'Logs'); }
  getBackupsDirectory(): string { return join(this.root, 'Backups'); }
  getJobsDirectory(): string { return join(this.root, 'Jobs'); }
  getBrandKitsDirectory(): string { return join(this.root, 'BrandKits'); }
  getConfigDirectory(): string { return join(this.root, 'Config'); }
  getAssistantSessionsDirectory(): string { return join(this.root, 'Projects', 'assistant-sessions'); }

  getDatabasePath(): string { return join(this.root, 'Database', 'automation.db'); }
  getHistoryPath(): string { return join(this.root, 'Logs', 'poster-history.json'); }
  getLoggerPath(dateStr: string): string { return join(this.root, 'Logs', `agent-${dateStr}.log`); }
  getOAuthConfigPath(): string { return join(this.root, 'Config', 'google-oauth.json'); }
  getProfilesIndexPath(): string { return join(this.root, 'BrandKits', 'profiles.json'); }
  getDefaultProfilePath(): string { return join(this.root, 'BrandKits', '_default.json'); }
  getProfileDir(profileId: string): string { return join(this.root, 'BrandKits', profileId); }
  getProfilePath(profileId: string): string { return join(this.root, 'BrandKits', profileId, 'profile.json'); }
  getJobDir(jobId: string): string { return join(this.root, 'Jobs', jobId); }
  getJobOutputDir(jobId: string): string { return join(this.root, 'Jobs', jobId, 'output'); }

  // Resolve a relative path against storage root
  resolve(relativePath: string): string {
    return join(this.root, relativePath);
  }

  // Convert absolute path to relative (for database storage)
  relativize(absolutePath: string): string {
    const normalized = absolutePath.replace(/\\/g, '/');
    const root = this.root.replace(/\\/g, '/');
    if (normalized.startsWith(root + '/')) {
      return normalized.slice(root.length + 1);
    }
    return absolutePath;
  }

  // All subdirectories for creation
  getAllDirectories(): string[] {
    return [
      this.getProjectsDirectory(),
      this.getAssetsDirectory(),
      this.getAssetsSchoolLogosDirectory(),
      this.getAssetsLeadLogosDirectory(),
      this.getAssetsLeadershipPhotosDirectory(),
      this.getAssetsCampusPhotosDirectory(),
      this.getAssetsStudentPhotosDirectory(),
      this.getAssetsEventPhotosDirectory(),
      this.getAssetsDecorativeDirectory(),
      this.getPhotoshopDirectory(),
      this.getPhotoshopPsdDirectory(),
      this.getPhotoshopPngDirectory(),
      this.getPhotoshopJpgDirectory(),
      this.getPhotoshopTemplateDirectory(),
      this.getPremiereDirectory(),
      this.getPremiereProjectDirectory(),
      this.getPremiereExportDirectory(),
      this.getPremiereMediaDirectory(),
      this.getWordDirectory(),
      this.getWordDocxDirectory(),
      this.getWordPdfDirectory(),
      this.getWordTemplateDirectory(),
      this.getModelsDirectory(),
      this.getDatabaseDirectory(),
      this.getCacheDirectory(),
      this.getTempDirectory(),
      this.getLogsDirectory(),
      this.getBackupsDirectory(),
      this.getJobsDirectory(),
      this.getBrandKitsDirectory(),
      this.getConfigDirectory(),
      this.getAssistantSessionsDirectory(),
    ];
  }
}
