import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import { z } from 'zod';
import { atomicJson, baseFolder } from './storage';
import { smokeResultSchema, type SmokeResult } from '../shared/ipc';

const jsxResultSchema = z.object({ success: z.literal(true), stage: z.literal('completed'), details: z.string(), psdPath: z.string(), jpgPath: z.string() });

function resource(relative: string): string {
  return app.isPackaged ? join(process.resourcesPath, relative) : join(app.getAppPath(), '..', relative);
}

async function waitForFile(path: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { await access(path); return; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  throw new Error(`Timed out waiting for ${path}`);
}

export async function runPhotoshopSmoke(): Promise<SmokeResult> {
  const jobId = `smoke-${randomUUID()}`;
  const jobDir = join(baseFolder(), 'Jobs', jobId);
  const outputDir = join(jobDir, 'output');
  const resultPath = join(outputDir, 'result.json');
  await mkdir(outputDir, { recursive: true });
  await atomicJson(join(jobDir, 'job.json'), { schemaVersion: 1, jobId, type: 'photoshop-smoke', createdAt: new Date().toISOString() });

  const vbs = resource(join('photoshop', 'smoke-test-dojavascript.vbs'));
  const sourceJsx = resource(join('photoshop', 'smoke-test.jsx'));
  const jsx = join(jobDir, 'smoke-test.jsx');
  try {
    const jsxSource = await readFile(sourceJsx, 'utf8');
    const jsxOutput = outputDir.replace(/\\/g, '/').replace(/"/g, '\\"');
    const jobJsx = jsxSource.replace('$.getenv("SNHS_SMOKE_OUTPUT")', `"${jsxOutput}"`);
    if (jobJsx === jsxSource) throw new Error('Could not bind the smoke JSX to its job output directory.');
    await writeFile(jsx, jobJsx, 'utf8');
    await new Promise<void>((resolve, reject) => {
      const child = spawn('cscript.exe', ['//Nologo', vbs, jsx], {
        shell: false, windowsHide: true, env: { ...process.env, SNHS_SMOKE_OUTPUT: outputDir }, stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = ''; let stderr = '';
      const timer = setTimeout(() => { child.kill(); reject(new Error(`Photoshop smoke timed out. ${stdout} ${stderr}`)); }, 120_000);
      child.stdout.on('data', (chunk) => { stdout += String(chunk); });
      child.stderr.on('data', (chunk) => { stderr += String(chunk); });
      child.on('error', (error) => { clearTimeout(timer); reject(error); });
      child.on('exit', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`VBS_EXIT_${code}: ${stdout} ${stderr}`)); });
    });
    await waitForFile(resultPath, 90_000);
    const parsed = jsxResultSchema.parse(JSON.parse(await readFile(resultPath, 'utf8')));
    const [psd, jpg] = await Promise.all([stat(parsed.psdPath), stat(parsed.jpgPath)]);
    if (!psd.isFile() || !jpg.isFile() || psd.size === 0 || jpg.size === 0) throw new Error('Photoshop returned empty output files.');
    const finalPsd = join(baseFolder(), 'Outputs', `${jobId}.psd`);
    const finalJpg = join(baseFolder(), 'Outputs', `${jobId}.jpg`);
    await Promise.all([copyFile(parsed.psdPath, finalPsd), copyFile(parsed.jpgPath, finalJpg)]);
    const success = smokeResultSchema.parse({ success: true, jobId, stage: 'completed', psdPath: finalPsd, jpgPath: finalJpg });
    await atomicJson(join(jobDir, 'final-result.json'), success);
    return success;
  } catch (error) {
    const failure = smokeResultSchema.parse({ success: false, jobId, stage: 'photoshop-smoke', error: {
      code: 'PHOTOSHOP_SMOKE_FAILED', stage: 'photoshop-smoke', message: 'Photoshop automation smoke test failed.',
      details: error instanceof Error ? error.message : String(error), retryable: true,
    } });
    await atomicJson(join(jobDir, 'final-result.json'), failure);
    return failure;
  }
}
