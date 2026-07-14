// Creative supervisor.
//
// Orchestrates a single natural-language command end to end:
//   read state → parse (deterministic, Gemini fallback) → map targets →
//   protection check → build+validate plan → checkpoint → execute → verify.
// It reuses the existing Photoshop transport and storage services and never
// executes raw JSX. This is the main entry point the IPC layer calls.

import { parseCommand } from './command-interpreter';
import { buildActionPlan, validateActionPlan } from './execution-planner';
import { mapScene, resolveTargets } from './semantic-layer-mapper';
import type { MapperContext } from './semantic-layer-mapper';
import { readSceneGraph } from './photoshop-state-reader';
import { executePlan } from './photoshop-command-executor';
import { checkProtection } from './background-replacer';
import { verifyScene } from './visual-verifier';
import { HistoryManager, checkpointName } from './history-manager';
import { SessionStore } from './assistant-session-store';
import { interpretWithGemini, geminiConfigured, targetsFromMatches, type GeminiConfig } from './gemini-command-interpreter';
import { findLayer } from './document-analyzer';
import type { ActionPlan, ExecutionResult, SceneGraph, VerificationIssue } from './types';

export interface SupervisorOptions {
  liveApply?: boolean;
  gemini?: GeminiConfig;
  mapperContext?: MapperContext;
  protectionOverrides?: Parameters<typeof checkProtection>[2];
}

export interface CommandOutcome {
  status: 'applied' | 'needs_preview' | 'needs_selection' | 'needs_confirmation' | 'error';
  plan?: ActionPlan;
  result?: ExecutionResult;
  issues?: VerificationIssue[];
  candidates?: { layerId: number; role: string; confidence: number; name: string }[];
  warning?: string;
  message?: string;
}

export class CreativeSupervisor {
  private history?: HistoryManager;

  constructor(private readonly session: SessionStore, private readonly opts: SupervisorOptions = {}) {}

  attachHistory(originalPsdPath: string): void { this.history = new HistoryManager(originalPsdPath); }
  get historyManager(): HistoryManager | undefined { return this.history; }

  async handleCommand(command: string): Promise<CommandOutcome> {
    let scene: SceneGraph;
    try { scene = await readSceneGraph(); }
    catch (e) { return { status: 'error', message: (e as Error).message }; }

    const matches = mapScene(scene, this.opts.mapperContext ?? {});
    const parsed = parseCommand(command);

    // Undo/redo shortcuts are handled by the caller; surface them clearly.
    if (parsed.notes.includes('UNDO') || parsed.notes.includes('REDO')) {
      return { status: 'error', message: 'Use the Undo/Redo controls for this command.' };
    }

    // Resolve targets.
    let targets = resolveTargets(scene, matches, { roleHint: parsed.roleHint, targetsActiveLayer: parsed.targetsActiveLayer });
    let operations = parsed.operations;
    let source: 'deterministic' | 'gemini' = 'deterministic';

    // Gemini fallback ONLY when deterministic parsing is unresolved and Gemini
    // is configured. Its output is schema-validated before use.
    if ((parsed.unresolved || targets.targets.length === 0) && this.opts.gemini && geminiConfigured(this.opts.gemini)) {
      const g = await interpretWithGemini(command, matches, this.opts.gemini);
      if (g.ok && g.plan) {
        const revalidated = validateActionPlan(g.plan);
        if (revalidated.ok && revalidated.plan) {
          return this.finishPlan(revalidated.plan, scene, matches);
        }
      }
    }

    if (parsed.unresolved && operations.length === 0) {
      return { status: 'error', message: 'Could not interpret that command. Try rephrasing, or select a layer and use a quick control.' };
    }
    if (targets.needsUserSelection || targets.targets.length === 0) {
      return {
        status: 'needs_selection',
        candidates: targets.targets.map((t) => ({ layerId: t.layerId, role: t.role, confidence: t.confidence, name: findLayer(scene, t.layerId)?.name ?? String(t.layerId) })),
        message: 'Please pick the intended layer from the detected-elements panel.',
      };
    }

    const built = buildActionPlan({
      command,
      targets: targetsFromMatches(targets.targets),
      operations,
      source,
      liveApply: this.opts.liveApply,
    });
    if (!built.ok || !built.plan) return { status: 'error', message: built.errors.join('; ') };
    return this.finishPlan(built.plan, scene, matches);
  }

  // Protection + preview gating, then execution + verification.
  private async finishPlan(plan: ActionPlan, scene: SceneGraph, matches: ReturnType<typeof mapScene>): Promise<CommandOutcome> {
    // Protection check on every target/operation combination.
    for (const t of plan.targets) {
      const role = matches.find((m) => m.layerId === t.layerId)?.role ?? t.semanticRole;
      for (const op of plan.operations) {
        const prot = checkProtection(role, op.type, this.opts.protectionOverrides);
        if (prot.requiresConfirmation) {
          return { status: 'needs_confirmation', plan, warning: prot.warning };
        }
      }
    }
    if (plan.requiresPreview && !this.opts.liveApply) {
      return { status: 'needs_preview', plan, message: 'Preview required before applying.' };
    }
    return this.applyPlan(plan);
  }

  // Executes a plan (called directly after user confirmation/preview approval).
  async applyPlan(plan: ActionPlan): Promise<CommandOutcome> {
    const name = checkpointName(plan.command, plan.operations);
    // Quick/controlled Assistant commands rely on Photoshop's native history
    // states. Full named snapshots can block large PSDs for minutes.
    const result = await executePlan(plan, { checkpointName: name, previewPng: false, createSnapshot: false });
    if (this.history && result.success) {
      this.history.push(this.history.makeCheckpoint(plan.command, plan.operations, result.modifiedLayerIds));
    }
    await this.session.record(plan, result);

    if (!result.success) return { status: 'error', plan, result, message: result.error };

    // Verify the resulting document — never assume success from an export.
    let issues: VerificationIssue[] = [];
    try { issues = verifyScene(await readSceneGraph(), this.opts.mapperContext ?? {}); }
    catch { /* verification best-effort */ }
    return { status: 'applied', plan, result, issues };
  }
}
