// Execution planner.
//
// Converts a parsed command + resolved targets into a validated ActionPlan,
// and validates any externally-supplied plan (e.g. from Gemini) against the
// strict schema + operation allow-list. Raw AI JSX is NEVER executed: the AI
// may only propose a structured plan that must pass validation here.

import {
  actionPlanSchema, CONFIRM_OPERATION_TYPES, SUPPORTED_OPERATION_TYPES,
  type ActionPlan, type ActionTarget, type Operation,
} from './types';

export interface PlanValidation {
  ok: boolean;
  plan?: ActionPlan;
  errors: string[];
}

const ALLOWED = new Set<string>(SUPPORTED_OPERATION_TYPES);

// Validate an arbitrary object as an ActionPlan. Used for both deterministic
// plans (belt-and-braces) and untrusted Gemini output.
export function validateActionPlan(candidate: unknown): PlanValidation {
  const parsed = actionPlanSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  // Allow-list guard: discriminatedUnion already restricts types, but we assert
  // explicitly so an accidental schema widening can never smuggle an op through.
  const bad = parsed.data.operations.filter((op) => !ALLOWED.has(op.type));
  if (bad.length > 0) {
    return { ok: false, errors: [`unsupported operations: ${bad.map((b) => b.type).join(', ')}`] };
  }
  return { ok: true, plan: parsed.data, errors: [] };
}

// Does any operation in this list require a preview/confirmation?
export function planRequiresPreview(operations: Operation[]): boolean {
  if (operations.some((op) => CONFIRM_OPERATION_TYPES.has(op.type))) return true;
  // Multi-layer operations always preview.
  return false;
}

export interface BuildPlanInput {
  command: string;
  targets: ActionTarget[];
  operations: Operation[];
  source?: 'deterministic' | 'gemini';
  liveApply?: boolean; // when true, simple reversible actions skip preview
  extraWarnings?: string[];
}

export function buildActionPlan(input: BuildPlanInput): PlanValidation {
  if (input.targets.length === 0) return { ok: false, errors: ['no target layer resolved'] };
  if (input.operations.length === 0) return { ok: false, errors: ['no operations derived'] };

  const multiLayer = input.targets.length > 1;
  const requiresPreview =
    planRequiresPreview(input.operations) || multiLayer || !input.liveApply;

  const candidate: ActionPlan = {
    command: input.command,
    targets: input.targets,
    operations: input.operations,
    requiresPreview,
    source: input.source ?? 'deterministic',
    warnings: input.extraWarnings ?? [],
  };
  return validateActionPlan(candidate);
}
