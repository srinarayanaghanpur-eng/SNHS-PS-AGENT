// History & version manager.
//
// Every assistant command is reversible. Before each command a *named* Photoshop
// history checkpoint is created (via the executor JSX). This module owns the
// deterministic naming, the undo/redo stacks, and version-file naming. It never
// overwrites the original uploaded PSD without explicit approval.

import type { Operation } from './types';

export interface Checkpoint {
  id: string;
  name: string;          // Photoshop history state name, e.g. "Assistant: before move logo"
  command: string;
  createdAt: string;
  modifiedLayerIds: number[];
}

// Human-readable checkpoint name from a command (§ named history checkpoints).
export function checkpointName(command: string, operations: Operation[]): string {
  const verb = summariseOps(operations);
  const short = command.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);
  return `Assistant: before ${verb || short}`;
}

function summariseOps(operations: Operation[]): string {
  if (operations.length === 0) return '';
  const t = operations[0].type;
  const map: Partial<Record<Operation['type'], string>> = {
    translate: 'move', scale: 'resize', setSize: 'resize', align: 'align',
    setTextColor: 'change colours', setFillColor: 'change colours', setStrokeColor: 'change colours',
    replaceBackground: 'replace background', replaceSmartObject: 'replace image',
    delete: 'delete element', setVisibility: 'toggle visibility', replaceText: 'replace text',
  };
  return map[t] ?? t;
}

// Version file naming (§ Undo, redo and versions).
export function versionName(index: number): string {
  if (index <= 0) return 'poster-original.psd';
  return `poster-assistant-v${String(index).padStart(3, '0')}.psd`;
}
export const APPROVED_VERSION_NAME = 'poster-approved.psd';

export class HistoryManager {
  private undoStack: Checkpoint[] = [];
  private redoStack: Checkpoint[] = [];
  private versionCounter = 0;

  constructor(private readonly originalPsdPath: string) {}

  makeCheckpoint(command: string, operations: Operation[], modifiedLayerIds: number[]): Checkpoint {
    const cp: Checkpoint = {
      id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: checkpointName(command, operations),
      command,
      createdAt: new Date().toISOString(),
      modifiedLayerIds,
    };
    return cp;
  }

  // Record a successfully-applied command; clears the redo stack.
  push(cp: Checkpoint): void {
    this.undoStack.push(cp);
    this.redoStack = [];
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

  undo(): Checkpoint | null {
    const cp = this.undoStack.pop();
    if (!cp) return null;
    this.redoStack.push(cp);
    return cp;
  }

  redo(): Checkpoint | null {
    const cp = this.redoStack.pop();
    if (!cp) return null;
    this.undoStack.push(cp);
    return cp;
  }

  history(): Checkpoint[] { return [...this.undoStack]; }

  nextVersionName(): string { return versionName(++this.versionCounter); }

  originalPath(): string { return this.originalPsdPath; }
}
