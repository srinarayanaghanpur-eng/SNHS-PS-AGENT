import { _electron as electron } from 'playwright';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createStoragePaths } from '../src-v2/main/storage/storagePaths.mjs';

const mode = process.argv[2] || 'inspect';
const screenshotDir = resolve(createStoragePaths().testRuns, `electron-ui-${Date.now()}`);
await mkdir(screenshotDir, { recursive: true });
const app = await electron.launch({ args: [resolve('electron-v2/main.js')] });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');
await page.getByRole('button', { name: /Daily Prayer/ }).first().click();
await page.getByText('STEP 2').waitFor();

const facts = {
  title: await page.title(),
  programmeRows: await page.locator('.programme-row').count(),
  generateButtons: await page.getByRole('button', { name: 'Generate in Photoshop', exact: true }).count(),
  googlePhotosText: await page.getByText(/Google Photos/i).count(),
  horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
};

await page.screenshot({ path: resolve(screenshotDir, 'daily-prayer-ui.png'), fullPage: false });

if (mode === 'generate') {
  await page.locator('.step-tabs button').nth(2).click();
  await page.getByRole('button', { name: 'Generate in Photoshop', exact: true }).click();
  await page.getByText('Photoshop generation completed').waitFor({ timeout: 300_000 });
  facts.resultText = await page.locator('.result-card').innerText();
  facts.finalImageCount = await page.locator('.poster-canvas > img').count();
  await page.screenshot({ path: resolve(screenshotDir, 'daily-prayer-generated.png'), fullPage: false });
}

process.stdout.write(`ELECTRON_UI_E2E=${JSON.stringify(facts)}\n`);
await app.close();
