import { _electron as electron } from 'playwright';

const installedExe = 'C:\\Users\\ADMIN\\AppData\\Local\\Programs\\SNHS SMART POSTER AGENT V2\\SNHS SMART POSTER AGENT V2.exe';
const screenshotPath = 'E:\\AI AGENTS\\SmartPosterAgent\\acceptance\\assistant-populated.png';
const expectedDocument = 'SNHS_daily-prayer_2026-07-14_002_v004.psd';

const app = await electron.launch({ executablePath: installedExe, timeout: 45_000 });
try {
  const mainWindow = await app.firstWindow();
  await mainWindow.waitForFunction(() => Boolean(window.posterApi), null, { timeout: 30_000 });
  await mainWindow.evaluate(() => window.posterApi.assistantOpen());
  let assistantWindow;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    assistantWindow = app.windows().find((candidate) => candidate !== mainWindow);
    if (assistantWindow) break;
    await mainWindow.waitForTimeout(250);
  }
  if (!assistantWindow) throw new Error('Assistant window did not open');
  await assistantWindow.getByRole('button', { name: 'Refresh Photoshop' }).click();
  await assistantWindow.getByText(expectedDocument, { exact: false }).first().waitFor({ timeout: 30_000 });
  await assistantWindow.getByText('MAIN_TITLE', { exact: false }).first().waitFor({ timeout: 30_000 });
  await assistantWindow.bringToFront();
  await assistantWindow.evaluate(() => window.scrollTo(0, 0));
  await assistantWindow.waitForTimeout(1_200);
  await assistantWindow.screenshot({ path: screenshotPath });
  process.stdout.write(`${JSON.stringify({ success: true, screenshotPath, expectedDocument }, null, 2)}\n`);
} finally {
  await app.close();
}
