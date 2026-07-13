// Persistent file logging for the V2 main process. One line per event in
// Documents/SNHS Smart Poster Agent/Logs/agent-YYYY-MM-DD.log; errors also go
// to the console so `--*-gate` CI runs show them.

import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { baseFolder } from './storage';

let queue: Promise<void> = Promise.resolve();

function logFile(): string {
  return join(baseFolder(), 'Logs', `agent-${new Date().toISOString().slice(0, 10)}.log`);
}

export function log(level: 'INFO' | 'WARN' | 'ERROR', event: string, detail?: unknown): void {
  const line = `${new Date().toISOString()} ${level} ${event}${detail === undefined ? '' : ' ' + safeJson(detail)}\n`;
  if (level === 'ERROR') console.error(line.trim());
  queue = queue.then(async () => {
    try {
      const file = logFile();
      await mkdir(join(baseFolder(), 'Logs'), { recursive: true });
      await appendFile(file, line, 'utf8');
    } catch { /* logging must never crash the app */ }
  });
}

function safeJson(value: unknown): string {
  try {
    if (value instanceof Error) return JSON.stringify({ message: value.message, stack: value.stack?.split('\n').slice(0, 4).join(' | ') });
    return JSON.stringify(value);
  } catch { return String(value); }
}

export function installCrashHandlers(): void {
  process.on('uncaughtException', (error) => log('ERROR', 'uncaughtException', error));
  process.on('unhandledRejection', (reason) => log('ERROR', 'unhandledRejection', reason));
}
