import { execSync, exec } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { log } from '../../src/utils/logger';
import { ensureStorageDirectoriesSync } from '../../src-v2/main/storage/storagePaths.mjs';

const runtimeTemp = ensureStorageDirectoriesSync().cacheTemporary;

const PS_IDS = [
  'Photoshop.Application',
  'Photoshop.Application.2025',
  'Photoshop.Application.2024',
  'Photoshop.Application.2023',
  'Photoshop.Application.2022',
  'Photoshop.Application.2021',
  'Photoshop.Application.2020',
  'Photoshop.Application.CC',
  'Photoshop.Application.CS6',
  'Photoshop.Application.CS5',
];

export interface PsDetection {
  available: boolean;
  version?: string;
  comId?: string;
}

export function detectPhotoshop(): PsDetection {
  for (const comId of PS_IDS) {
    try {
      const vbs = [
        `On Error Resume Next`,
        `Set app = CreateObject("${comId}")`,
        `If Err.Number <> 0 Then`,
        `  WScript.Quit 1`,
        `End If`,
        `WScript.Echo app.Version`,
      ].join('\n');
      const out = runVbs(vbs);
      if (out) return { available: true, version: out.trim(), comId };
    } catch { }
  }
  return { available: false };
}

function runVbs(script: string): string {
  const tmpFile = join(runtimeTemp, `_ps_${Date.now()}.vbs`);
  try {
    writeFileSync(tmpFile, script, 'utf-8');
    return execSync(`cscript //Nologo "${tmpFile}"`, { encoding: 'utf-8', timeout: 15000 });
  } finally {
    try { existsSync(tmpFile) && require('fs').unlinkSync(tmpFile); } catch { }
  }
}

export function executeJsx(jsxCode: string): string {
  const tmpDir = runtimeTemp;
  const jsxFile = join(tmpDir, `_ps_${Date.now()}.jsx`);
  const vbsFile = join(tmpDir, `_ps_${Date.now()}.vbs`);
  try {
    writeFileSync(jsxFile, jsxCode, 'utf-8');
    const vbsScript = [
      `On Error Resume Next`,
      `Set app = CreateObject("Photoshop.Application")`,
      `If Err.Number <> 0 Then`,
      `  For Each id In Array(${PS_IDS.filter((_, i) => i > 0).map(id => `"${id}"`).join(',')})`,
      `    Set app = CreateObject(id)`,
      `    If Err.Number = 0 Then Exit For`,
      `  Next`,
      `End If`,
      `If Err.Number <> 0 Then`,
      `  WScript.Echo "ERROR:No Photoshop installation found"`,
      `  WScript.Quit 1`,
      `End If`,
      `On Error Resume Next`,
      `app.DoJavaScriptFile "${jsxFile.replace(/\\/g, '\\\\')}"`,
      `If Err.Number <> 0 Then WScript.Echo "ERROR:" & Err.Description`,
    ].join('\n');
    writeFileSync(vbsFile, vbsScript, 'utf-8');
    return execSync(`cscript //Nologo "${vbsFile}"`, { encoding: 'utf-8', timeout: 120000 });
  } finally {
    try { existsSync(jsxFile) && require('fs').unlinkSync(jsxFile); } catch { }
    try { existsSync(vbsFile) && require('fs').unlinkSync(vbsFile); } catch { }
  }
}

export function executeJsxAsync(jsxCode: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tmpDir = runtimeTemp;
    const jsxFile = join(tmpDir, `_ps_${Date.now()}.jsx`);
    const vbsFile = join(tmpDir, `_ps_${Date.now()}.vbs`);
    try {
      writeFileSync(jsxFile, jsxCode, 'utf-8');
      const vbsScript = [
        `On Error Resume Next`,
        `Set app = CreateObject("Photoshop.Application")`,
        `If Err.Number <> 0 Then`,
        `  For Each id In Array(${PS_IDS.filter((_, i) => i > 0).map(id => `"${id}"`).join(',')})`,
        `    Set app = CreateObject(id)`,
        `    If Err.Number = 0 Then Exit For`,
        `  Next`,
        `End If`,
        `If Err.Number <> 0 Then`,
        `  WScript.Echo "ERROR:No Photoshop installation found"`,
        `  WScript.Quit 1`,
        `End If`,
        `On Error Resume Next`,
        `app.DoJavaScriptFile "${jsxFile.replace(/\\/g, '\\\\')}"`,
        `If Err.Number <> 0 Then WScript.Echo "ERROR:" & Err.Description`,
      ].join('\n');
      writeFileSync(vbsFile, vbsScript, 'utf-8');
      exec(`cscript //Nologo "${vbsFile}"`, { timeout: 120000 }, (err, stdout) => {
        try { existsSync(jsxFile) && require('fs').unlinkSync(jsxFile); } catch { }
        try { existsSync(vbsFile) && require('fs').unlinkSync(vbsFile); } catch { }
        if (err) reject(err);
        else resolve(stdout);
      });
    } catch (e) {
      try { existsSync(jsxFile) && require('fs').unlinkSync(jsxFile); } catch { }
      try { existsSync(vbsFile) && require('fs').unlinkSync(vbsFile); } catch { }
      reject(e);
    }
  });
}

export function generateJsxDocument(options: {
  width: number; height: number; resolution?: number; name: string;
}): string {
  return [
    `var doc = app.documents.add(${options.width}, ${options.height}, ${options.resolution ?? 72}, "${options.name}", NewDocumentMode.RGB);`,
    `$.writeln("DOC_ID:" + doc.id);`,
    `$.writeln("DOC_NAME:" + doc.name);`,
  ].join('\n');
}

export function generateJsxTextLayer(options: {
  text: string; font?: string; size?: number; color?: [number, number, number];
  left?: number; top?: number; width?: number; height?: number;
  alignment?: string; name?: string;
}): string {
  const r = options;
  return [
    `var layer = doc.artLayers.add();`,
    `layer.kind = LayerKind.TEXT;`,
    r.name ? `layer.name = "${r.name.replace(/"/g, '\\"')}";` : '',
    `var ti = layer.textItem;`,
    `ti.contents = "${(r.text || '').replace(/"/g, '\\"').replace(/\n/g, '\\n')}";`,
    r.font ? `ti.font = "${r.font}";` : '',
    r.size ? `ti.size = ${r.size};` : '',
    r.color ? `ti.color = app.foregroundColor; app.foregroundColor.rgb.hexValue = "${rgbToHex(r.color)}";` : '',
    r.alignment ? `ti.justification = Justification.${r.alignment.toUpperCase()};` : '',
    r.left && r.top ? `ti.position = Array(${r.left}, ${r.top});` : '',
    `$.writeln("LAYER_ID:" + layer.id);`,
  ].filter(Boolean).join('\n');
}

function rgbToHex(c: [number, number, number]): string {
  return '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
