// Assistant session store + activity log.
//
// Persists assistant sessions and a structured activity log under the app's
// storage (§ Logging). Every operation records: timestamp, original command,
// interpreted target, target layer IDs, planned operations, Photoshop response,
// preview path, success/failure, warnings, undo checkpoint, downloaded asset
// source. API keys / tokens are NEVER logged.

import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { atomicJson, baseFolder } from '../storage';
import type { ActionPlan, ExecutionResult } from './types';

export interface ActivityEntry {
  id: string;
  timestamp: string;
  command: string;
  interpretedTargets: { layerId: number; role?: string; confidence: number }[];
  operations: { type: string }[];
  photoshopResponse: 'success' | 'failure' | 'preview';
  previewPath?: string;
  warnings: string[];
  checkpointId?: string;
  downloadedAssetSource?: string;
  error?: string;
}

export interface AssistantSession {
  id: string;
  createdAt: string;
  documentName?: string;
  originalPsdPath?: string;
  activity: ActivityEntry[];
}

function sessionPath(id: string): string {
  return join(baseFolder(), 'Projects', 'assistant-sessions', `${id}.json`);
}

export class SessionStore {
  private session: AssistantSession;

  constructor(documentName?: string, originalPsdPath?: string) {
    this.session = { id: `sess-${randomUUID()}`, createdAt: new Date().toISOString(), documentName, originalPsdPath, activity: [] };
  }

  get id(): string { return this.session.id; }

  async record(plan: ActionPlan, result: ExecutionResult, extra?: { downloadedAssetSource?: string; previewOnly?: boolean }): Promise<ActivityEntry> {
    const entry: ActivityEntry = {
      id: `act-${randomUUID()}`,
      timestamp: new Date().toISOString(),
      command: plan.command,
      interpretedTargets: plan.targets.map((t) => ({ layerId: t.layerId, role: t.semanticRole, confidence: t.confidence })),
      operations: plan.operations.map((o) => ({ type: o.type })),
      photoshopResponse: extra?.previewOnly ? 'preview' : result.success ? 'success' : 'failure',
      previewPath: result.previewPath,
      warnings: result.warnings,
      checkpointId: result.checkpointId,
      downloadedAssetSource: extra?.downloadedAssetSource,
      error: result.error,
    };
    this.session.activity.push(entry);
    await this.persist();
    return entry;
  }

  activity(): ActivityEntry[] { return [...this.session.activity]; }

  async persist(): Promise<void> {
    await atomicJson(sessionPath(this.session.id), this.session);
  }
}
