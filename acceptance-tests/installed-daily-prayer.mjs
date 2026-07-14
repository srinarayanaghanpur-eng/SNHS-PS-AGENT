import { _electron as electron } from 'playwright';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const installedExe = 'C:\\Users\\ADMIN\\AppData\\Local\\Programs\\SNHS SMART POSTER AGENT V2\\SNHS SMART POSTER AGENT V2.exe';
const bridgeVbs = 'C:\\Users\\ADMIN\\AppData\\Local\\Programs\\SNHS SMART POSTER AGENT V2\\resources\\photoshop\\smoke-test-dojavascript.vbs';
const storageRoot = 'E:\\AI AGENTS\\SmartPosterAgent';
const originalPsd = `${storageRoot}\\psd\\SNHS\\2026\\07\\SNHS_daily-prayer_2026-07-14_002.psd`;
const acceptanceDirectory = `${storageRoot}\\acceptance`;
const tempDirectory = `${storageRoot}\\temp\\installed-acceptance`;
const assistantScreenshot = `${acceptanceDirectory}\\assistant-populated.png`;
const resultPath = `${acceptanceDirectory}\\installed-daily-prayer-result.json`;
const requiredGroups = [
  '00_BACKGROUND', '01_MAIN_PHOTO', '02_DARK_OVERLAY', '03_SCHOOL_BRANDING', '04_TITLE',
  '05_DATE', '06_QUOTE', '07_PROGRAMME', '08_FOOTER', '09_EFFECTS',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertBridge(label, value) {
  assert(value && typeof value === 'object', `${label}: bridge returned no result`);
  assert(typeof value.success === 'boolean', `${label}: missing success`);
  assert(typeof value.operation === 'string', `${label}: missing operation`);
  assert(typeof value.message === 'string', `${label}: missing message`);
  assert(value.success, `${label}: ${value.message} ${value.technicalDetails || ''}`.trim());
  return value;
}

async function invoke(window, method, ...args) {
  return window.evaluate(({ method, args }) => window.posterApi[method](...args), { method, args });
}

async function selectPhotoshopLayer(layerName) {
  await mkdir(tempDirectory, { recursive: true });
  const jsxPath = `${tempDirectory}\\select-layer.jsx`;
  const outputDirectory = `${tempDirectory}\\transport`;
  const quotedName = JSON.stringify(layerName);
  const jsx = `#target photoshop\n(function(){\n` +
    `function find(layers,name){for(var i=0;i<layers.length;i++){var item=layers[i];if(item.name===name)return item;if(item.typename==='LayerSet'){var found=find(item.layers,name);if(found)return found;}}return null;}\n` +
    `if(app.documents.length===0)throw new Error('NO_DOCUMENT_OPEN');var layer=find(app.activeDocument.layers,${quotedName});if(!layer)throw new Error('LAYER_NOT_FOUND: '+${quotedName});app.activeDocument.activeLayer=layer;app.refresh();\n` +
    `}());\n`;
  await writeFile(jsxPath, jsx, 'utf8');
  await execFileAsync('cscript.exe', ['//Nologo', bridgeVbs, jsxPath], {
    windowsHide: true,
    env: { ...process.env, SNHS_SMOKE_OUTPUT: outputDirectory },
    timeout: 60_000,
  });
}

function layerFrom(state) {
  return state?.data?.layer;
}

function roundedGeometry(layer) {
  return { x: Math.round(layer.x), y: Math.round(layer.y), width: Math.round(layer.width), height: Math.round(layer.height) };
}

async function launchInstalled() {
  const app = await electron.launch({ executablePath: installedExe, timeout: 45_000 });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForFunction(() => Boolean(window.posterApi), null, { timeout: 30_000 });
  return { app, window };
}

async function waitForState(mainWindow, predicate, message, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await invoke(mainWindow, 'assistantReadState');
    if (state?.success && predicate(state)) return state;
    await mainWindow.waitForTimeout(300);
  }
  throw new Error(message);
}

await mkdir(acceptanceDirectory, { recursive: true });
const evidence = { installedExe, originalPsd, testedAt: new Date().toISOString() };
let app;

try {
  ({ app, window: evidence.mainWindow } = await launchInstalled());
  const mainWindow = evidence.mainWindow;
  delete evidence.mainWindow;
  let assistantWindow;

  let state = assertBridge('initial state', await invoke(mainWindow, 'assistantReadState'));
  if (state.data?.document?.path?.toLowerCase() !== originalPsd.toLowerCase()) {
    await invoke(mainWindow, 'openPath', originalPsd);
    await mainWindow.waitForTimeout(5_000);
    state = assertBridge('opened generated PSD', await invoke(mainWindow, 'assistantReadState'));
  }
  assert(state.data?.document?.path?.toLowerCase() === originalPsd.toLowerCase(), `Wrong active PSD: ${state.data?.document?.path}`);
  evidence.photoshopStatus = assertBridge('Photoshop status', await invoke(mainWindow, 'photoshopStatus'));
  evidence.document = state.data.document;
  evidence.groups = state.data.scene.layers.filter((layer) => layer.type === 'group').map((layer) => layer.name);
  for (const name of requiredGroups) assert(evidence.groups.includes(name), `Missing PSD group: ${name}`);

  await selectPhotoshopLayer('SCHOOL_LOGO');
  state = assertBridge('school logo state', await invoke(mainWindow, 'assistantReadState'));
  assert(layerFrom(state)?.name === 'SCHOOL_LOGO', 'SCHOOL_LOGO was not selected');
  evidence.logoBefore = roundedGeometry(layerFrom(state));

  evidence.moveLeft = assertBridge('move left', await invoke(mainWindow, 'assistantQuickOperation', { operation: 'move', deltaX: -10, deltaY: 0 }));
  state = assertBridge('state after move', await invoke(mainWindow, 'assistantReadState'));
  evidence.logoAfterMove = roundedGeometry(layerFrom(state));
  assert(evidence.logoAfterMove.x === evidence.logoBefore.x - 10, 'Move left did not change X by exactly 10px');
  evidence.undoMove = assertBridge('undo move', await invoke(mainWindow, 'assistantUndo'));
  evidence.redoMove = assertBridge('redo move', await invoke(mainWindow, 'assistantRedo'));
  evidence.restoreMove = assertBridge('restore move', await invoke(mainWindow, 'assistantUndo'));

  await selectPhotoshopLayer('SCHOOL_LOGO');
  evidence.resize105 = assertBridge('resize 105%', await invoke(mainWindow, 'assistantQuickOperation', { operation: 'resize', scalePercent: 105 }));
  state = assertBridge('state after resize', await invoke(mainWindow, 'assistantReadState'));
  evidence.logoAfterResize = roundedGeometry(layerFrom(state));
  assert(evidence.logoAfterResize.width > evidence.logoBefore.width, 'Resize 105% did not enlarge the logo');
  evidence.undoResize = assertBridge('undo resize', await invoke(mainWindow, 'assistantUndo'));
  evidence.redoResize = assertBridge('redo resize', await invoke(mainWindow, 'assistantRedo'));
  evidence.restoreResize = assertBridge('restore resize', await invoke(mainWindow, 'assistantUndo'));

  await selectPhotoshopLayer('SCHOOL_LOGO');
  evidence.centreHorizontal = assertBridge('centre horizontally', await invoke(mainWindow, 'assistantQuickOperation', { operation: 'centre', horizontal: true, vertical: false }));
  evidence.restoreCentre = assertBridge('undo centre', await invoke(mainWindow, 'assistantUndo'));
  await selectPhotoshopLayer('SCHOOL_LOGO');
  evidence.hide = assertBridge('hide', await invoke(mainWindow, 'assistantQuickOperation', { operation: 'hide' }));
  state = assertBridge('hidden state', await invoke(mainWindow, 'assistantReadState'));
  assert(layerFrom(state)?.visible === false, 'Hide did not make the logo invisible');
  evidence.show = assertBridge('show', await invoke(mainWindow, 'assistantQuickOperation', { operation: 'show' }));
  state = assertBridge('shown state', await invoke(mainWindow, 'assistantReadState'));
  assert(layerFrom(state)?.visible === true, 'Show did not make the logo visible');
  evidence.lock = assertBridge('lock', await invoke(mainWindow, 'assistantQuickOperation', { operation: 'lock' }));
  state = assertBridge('locked state', await invoke(mainWindow, 'assistantReadState'));
  assert(layerFrom(state)?.locked === true, 'Lock did not lock the logo');
  evidence.unlock = assertBridge('unlock', await invoke(mainWindow, 'assistantQuickOperation', { operation: 'unlock' }));
  state = assertBridge('unlocked state', await invoke(mainWindow, 'assistantReadState'));
  assert(layerFrom(state)?.locked === false, 'Unlock did not unlock the logo');

  await invoke(mainWindow, 'assistantOpen');
  for (let attempt = 0; attempt < 30; attempt += 1) {
    assistantWindow = app.windows().find((candidate) => candidate !== mainWindow);
    if (assistantWindow) break;
    await mainWindow.waitForTimeout(250);
  }
  assert(assistantWindow, 'Assistant window did not open for UI controls');
  await assistantWindow.waitForLoadState('domcontentloaded');
  await selectPhotoshopLayer('SCHOOL_LOGO');
  await assistantWindow.getByRole('button', { name: 'Refresh Photoshop' }).click();
  await assistantWindow.getByText('SCHOOL_LOGO', { exact: false }).first().waitFor({ timeout: 30_000 });
  state = assertBridge('logo before UI controls', await invoke(mainWindow, 'assistantReadState'));
  const uiLogoBefore = roundedGeometry(layerFrom(state));
  await assistantWindow.getByRole('button', { name: 'Move left' }).click();
  const uiMoveState = await waitForState(mainWindow, (value) => Math.round(layerFrom(value)?.x) === uiLogoBefore.x - 10, 'Assistant Move left button did not move the logo by 10px');
  evidence.uiMoveLeft = { before: uiLogoBefore, after: roundedGeometry(layerFrom(uiMoveState)) };
  await assistantWindow.getByRole('button', { name: 'Undo' }).click();
  await waitForState(mainWindow, (value) => Math.round(layerFrom(value)?.x) === uiLogoBefore.x, 'Assistant Undo button did not restore the logo position');
  await assistantWindow.getByRole('button', { name: 'Larger' }).click();
  const uiLargerState = await waitForState(mainWindow, (value) => Math.round(layerFrom(value)?.width) > uiLogoBefore.width, 'Assistant Larger button did not resize the logo');
  evidence.uiLarger = { before: uiLogoBefore, after: roundedGeometry(layerFrom(uiLargerState)) };
  await assistantWindow.getByRole('button', { name: 'Undo' }).click();
  await waitForState(mainWindow, (value) => Math.round(layerFrom(value)?.width) === uiLogoBefore.width, 'Assistant Undo button did not restore the logo size');

  await selectPhotoshopLayer('MAIN_TITLE');
  state = assertBridge('title state', await invoke(mainWindow, 'assistantReadState'));
  evidence.titleBefore = layerFrom(state)?.text;
  const command = 'Change the selected text to DAILY PRAYER 2026-27';
  evidence.parsedText = assertBridge('parse text command', await invoke(mainWindow, 'assistantParseCommand', command));
  assert(evidence.parsedText.data?.label === 'replaceText', 'Text command did not parse as replaceText');
  evidence.textCommand = assertBridge('apply text command', await invoke(mainWindow, 'assistantCommand', command, true));
  state = assertBridge('title after command', await invoke(mainWindow, 'assistantReadState'));
  evidence.titleAfter = layerFrom(state)?.text;
  assert(evidence.titleAfter === 'DAILY PRAYER 2026-27', `Unexpected title text: ${evidence.titleAfter}`);
  evidence.undoText = assertBridge('undo text', await invoke(mainWindow, 'assistantUndo'));
  evidence.redoText = assertBridge('redo text', await invoke(mainWindow, 'assistantRedo'));
  await selectPhotoshopLayer('MAIN_TITLE');
  state = assertBridge('title after redo', await invoke(mainWindow, 'assistantReadState'));
  evidence.titleAfterRedo = layerFrom(state)?.text;
  assert(evidence.titleAfterRedo === evidence.titleAfter, 'Redo did not restore edited title');

  const uiTextCommand = 'Change the selected text to DAILY PRAYER 2026-2027';
  await assistantWindow.getByRole('button', { name: 'Refresh Photoshop' }).click();
  await assistantWindow.getByText('MAIN_TITLE', { exact: false }).first().waitFor({ timeout: 30_000 });
  await assistantWindow.locator('textarea').fill(uiTextCommand);
  await assistantWindow.getByRole('button', { name: 'Apply command' }).click();
  const uiTextState = await waitForState(mainWindow, (value) => layerFrom(value)?.text === 'DAILY PRAYER 2026-2027', 'Assistant command button did not update the real text layer');
  evidence.uiTextCommand = { command: uiTextCommand, text: layerFrom(uiTextState)?.text };
  await assistantWindow.getByRole('button', { name: 'Undo' }).click();
  await mainWindow.waitForTimeout(700);
  await selectPhotoshopLayer('MAIN_TITLE');
  state = assertBridge('title after UI undo', await invoke(mainWindow, 'assistantReadState'));
  assert(layerFrom(state)?.text === evidence.titleAfter, 'Assistant Undo button did not restore the prior title text');
  await assistantWindow.getByRole('button', { name: 'Redo' }).click();
  await mainWindow.waitForTimeout(700);
  await selectPhotoshopLayer('MAIN_TITLE');
  state = assertBridge('title after UI redo', await invoke(mainWindow, 'assistantReadState'));
  assert(layerFrom(state)?.text === 'DAILY PRAYER 2026-2027', 'Assistant Redo button did not restore the UI text edit');

  evidence.unsupported = await invoke(mainWindow, 'assistantParseCommand', 'Make it magical');
  assert(evidence.unsupported?.success === false, 'Unsupported command was accepted');
  assert(evidence.unsupported?.message === 'This command is not supported yet.', 'Unsupported command message changed');

  evidence.savedVersion = assertBridge('save version', await invoke(mainWindow, 'assistantSaveVersion'));
  evidence.exportedPng = assertBridge('export PNG', await invoke(mainWindow, 'assistantExportPng'));
  evidence.recentBeforeRestart = await invoke(mainWindow, 'listRecentEdits', 'school-1543550e', 10);
  assert(evidence.recentBeforeRestart[0]?.jobId === 'poster-4d19546c-2f67-405b-8a57-673eeb9555c9', 'Installed acceptance job is not first in Recent Edits');
  assert(evidence.recentBeforeRestart[0]?.psdPath === evidence.savedVersion.data.path, 'Recent Edits PSD path was not updated');
  assert(evidence.recentBeforeRestart[0]?.pngPath === evidence.exportedPng.data.path, 'Recent Edits PNG path was not updated');

  await invoke(mainWindow, 'assistantOpen');
  assistantWindow = assistantWindow || app.windows().find((candidate) => candidate !== mainWindow);
  assert(assistantWindow, 'Assistant window did not open');
  await assistantWindow.waitForLoadState('domcontentloaded');
  await assistantWindow.getByRole('button', { name: 'Refresh Photoshop' }).click();
  await assistantWindow.getByText('MAIN_TITLE', { exact: false }).first().waitFor({ timeout: 30_000 });
  await assistantWindow.screenshot({ path: assistantScreenshot });
  evidence.assistantScreenshot = assistantScreenshot;

  await app.close();
  app = undefined;

  const restarted = await launchInstalled();
  app = restarted.app;
  evidence.recentAfterRestart = await invoke(restarted.window, 'listRecentEdits', 'school-1543550e', 10);
  assert(evidence.recentAfterRestart[0]?.jobId === 'poster-4d19546c-2f67-405b-8a57-673eeb9555c9', 'Recent Edits did not persist after restart');
  assert(evidence.recentAfterRestart[0]?.psdPath === evidence.savedVersion.data.path, 'Persisted PSD version path changed after restart');
  assert(evidence.recentAfterRestart[0]?.pngPath === evidence.exportedPng.data.path, 'Persisted PNG path changed after restart');
  await app.close();
  app = undefined;

  evidence.success = true;
  evidence.completedAt = new Date().toISOString();
  await writeFile(resultPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ success: true, resultPath, psdPath: evidence.savedVersion.data.path, pngPath: evidence.exportedPng.data.path, assistantScreenshot }, null, 2)}\n`);
} catch (error) {
  evidence.success = false;
  evidence.error = error instanceof Error ? `${error.stack || error.message}` : String(error);
  await writeFile(resultPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  throw error;
} finally {
  if (app) await app.close().catch(() => undefined);
}
