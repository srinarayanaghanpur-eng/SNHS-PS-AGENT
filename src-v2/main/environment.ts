// Environment detection: verify the Photoshop COM automation chain is usable
// before a job is attempted, so failures are reported as clear preconditions
// instead of opaque VBS exit codes.

import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import { log } from './logger';

export interface EnvironmentReport {
  photoshopComRegistered: boolean;
  cscriptAvailable: boolean;
  bridgeScriptPresent: boolean;
  ok: boolean;
}

function run(command: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, { shell: false, windowsHide: true });
      const timer = setTimeout(() => { child.kill(); resolve(-1); }, 10_000);
      child.on('exit', (code) => { clearTimeout(timer); resolve(code ?? -1); });
      child.on('error', () => { clearTimeout(timer); resolve(-1); });
    } catch { resolve(-1); }
  });
}

export function bridgeVbsPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'photoshop', 'smoke-test-dojavascript.vbs')
    : join(app.getAppPath(), '..', 'photoshop', 'smoke-test-dojavascript.vbs');
}

export async function detectEnvironment(): Promise<EnvironmentReport> {
  const [regCode, cscriptCode, bridge] = await Promise.all([
    run('reg', ['query', 'HKCR\\Photoshop.Application']),
    run('cscript.exe', ['//Nologo', '/?']),
    access(bridgeVbsPath()).then(() => true, () => false),
  ]);
  const report: EnvironmentReport = {
    photoshopComRegistered: regCode === 0,
    cscriptAvailable: cscriptCode !== -1,
    bridgeScriptPresent: bridge,
    ok: regCode === 0 && cscriptCode !== -1 && bridge,
  };
  log(report.ok ? 'INFO' : 'WARN', 'environment', report);
  return report;
}

export function environmentError(report: EnvironmentReport): string | null {
  if (!report.photoshopComRegistered) return 'PHOTOSHOP_NOT_INSTALLED: Adobe Photoshop COM automation is not registered on this machine. Install Photoshop 2020+ and start it once.';
  if (!report.cscriptAvailable) return 'CSCRIPT_MISSING: Windows Script Host (cscript.exe) is unavailable; it is required for the Photoshop bridge.';
  if (!report.bridgeScriptPresent) return 'BRIDGE_SCRIPT_MISSING: the packaged photoshop/smoke-test-dojavascript.vbs resource was not found. Reinstall the application.';
  return null;
}
