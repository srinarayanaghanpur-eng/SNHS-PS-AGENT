// Assistant tool window.
//
// A compact, resizable, always-on-top Electron window that visually attaches to
// the right side of the Photoshop window and follows it while active. It is a
// standard secure BrowserWindow (contextIsolation on, sandbox on, nodeIntegration
// off) loading the assistant renderer bundle. Snapping/following uses the
// Photoshop window rectangle read via the same cscript bridge (best-effort).

import { spawn } from 'node:child_process';
import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { log } from '../logger';

let assistantWindow: BrowserWindow | null = null;
let followTimer: NodeJS.Timeout | null = null;

interface Rect { x: number; y: number; width: number; height: number }

// Read the Photoshop main window rectangle via PowerShell (Win32). Best-effort:
// returns null when Photoshop is not found or on any error. This does not drive
// Photoshop — it only reads geometry so the panel can snap beside it.
function readPhotoshopRect(): Promise<Rect | null> {
  const ps = [
    'Add-Type @"',
    'using System;using System.Runtime.InteropServices;',
    'public struct R{public int L;public int T;public int Rg;public int B;}',
    'public class W{[DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out R r);}',
    '"@;',
    '$p=Get-Process photoshop -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1;',
    'if($p){$r=New-Object R;[void][W]::GetWindowRect($p.MainWindowHandle,[ref]$r);',
    'Write-Output ("{0},{1},{2},{3}" -f $r.L,$r.T,$r.Rg,$r.B)}',
  ].join('');
  return new Promise((resolve) => {
    try {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true });
      let out = '';
      const timer = setTimeout(() => { child.kill(); resolve(null); }, 4000);
      child.stdout.on('data', (c) => { out += String(c); });
      child.on('error', () => { clearTimeout(timer); resolve(null); });
      child.on('exit', () => {
        clearTimeout(timer);
        const m = out.trim().match(/^(-?\d+),(-?\d+),(-?\d+),(-?\d+)$/);
        if (!m) return resolve(null);
        const [l, t, r, b] = m.slice(1).map(Number);
        resolve({ x: l, y: t, width: r - l, height: b - t });
      });
    } catch { resolve(null); }
  });
}

async function snapToPhotoshop(): Promise<void> {
  if (!assistantWindow || assistantWindow.isDestroyed()) return;
  const rect = await readPhotoshopRect();
  if (!rect) return;
  const display = screen.getDisplayMatching(rect);
  const width = assistantWindow.getBounds().width;
  // Attach to the right edge, clamped to the display work area.
  let x = rect.x + rect.width - 4;
  if (x + width > display.workArea.x + display.workArea.width) {
    x = Math.max(display.workArea.x, rect.x - width + 4); // flip to the left if no room
  }
  const y = Math.max(display.workArea.y, rect.y);
  const height = Math.min(rect.height, display.workArea.height);
  try { assistantWindow.setBounds({ x: Math.round(x), y: Math.round(y), width, height: Math.round(height) }); } catch { /* ignore */ }
}

export function openAssistantWindow(preloadPath: string, indexHtml: string, iconPath: string): BrowserWindow {
  if (assistantWindow && !assistantWindow.isDestroyed()) { assistantWindow.focus(); return assistantWindow; }
  assistantWindow = new BrowserWindow({
    width: 380, height: 900, minWidth: 320, minHeight: 520,
    title: 'Design Assistant', alwaysOnTop: true, resizable: true, fullscreenable: false,
    minimizable: true, maximizable: false, skipTaskbar: false, icon: iconPath, show: false,
    webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  assistantWindow.setAlwaysOnTop(true, 'floating');
  void assistantWindow.loadFile(indexHtml);
  assistantWindow.once('ready-to-show', () => { assistantWindow?.show(); void snapToPhotoshop(); });
  // Follow Photoshop while active (throttled). Stops when the window closes.
  followTimer = setInterval(() => { void snapToPhotoshop(); }, 1500);
  assistantWindow.on('closed', () => {
    if (followTimer) { clearInterval(followTimer); followTimer = null; }
    assistantWindow = null;
  });
  log('INFO', 'design-assistant.window.open');
  return assistantWindow;
}

export function closeAssistantWindow(): void {
  if (assistantWindow && !assistantWindow.isDestroyed()) assistantWindow.close();
}

export function getAssistantWindow(): BrowserWindow | null { return assistantWindow; }
