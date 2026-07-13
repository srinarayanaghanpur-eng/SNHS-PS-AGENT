// Gemini command interpreter (optional).
//
// Interprets complex natural-language commands into a STRUCTURED action plan.
// Gemini is NEVER allowed to return JSX; it returns JSON that MUST pass
// validateActionPlan (strict schema + operation allow-list). Basic commands do
// not depend on this — the deterministic parser handles them and this is only
// consulted when the deterministic parser is unresolved (§ AI and deterministic
// behaviour). The API key is read from configuration/env and never logged.

import { validateActionPlan, type PlanValidation } from './execution-planner';
import { SUPPORTED_OPERATION_TYPES, type ActionTarget, type SemanticMatch } from './types';
import { log } from '../logger';

export interface GeminiConfig {
  apiKey?: string;
  model?: string; // default gemini-1.5-flash
}

export function geminiConfigured(cfg: GeminiConfig): boolean {
  return typeof cfg.apiKey === 'string' && cfg.apiKey.length > 0;
}

function buildPrompt(command: string, candidates: SemanticMatch[]): string {
  const roleList = candidates.map((c) => `{layerId:${c.layerId}, role:"${c.role}", confidence:${c.confidence}}`).join(', ');
  return [
    'You convert a natural-language design edit into a STRICT JSON action plan.',
    'You must ONLY output JSON. No prose, no code fences, no ExtendScript/JSX.',
    `Allowed operation "type" values: ${SUPPORTED_OPERATION_TYPES.join(', ')}.`,
    'Schema: {"command":string,"targets":[{"semanticRole"?:string,"layerId":number,"confidence":number}],',
    '"operations":[{"type":string, ...opParams}],"requiresPreview":boolean,"source":"gemini","warnings":string[]}',
    `Detected layers: [${roleList}]`,
    `Command: ${JSON.stringify(command)}`,
    'Pick target layerId(s) from the detected layers. Output JSON only.',
  ].join('\n');
}

// Returns a validated plan or an error. Untrusted output is validated here.
export async function interpretWithGemini(
  command: string,
  candidates: SemanticMatch[],
  cfg: GeminiConfig,
): Promise<PlanValidation> {
  if (!geminiConfigured(cfg)) return { ok: false, errors: ['Gemini not configured'] };
  const model = cfg.model ?? 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey}`;
  let text: string;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(command, candidates) }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) return { ok: false, errors: [`Gemini HTTP ${res.status}`] };
    const data = await res.json() as any;
    text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  } catch (e) {
    return { ok: false, errors: [`Gemini request failed: ${(e as Error).message}`] };
  }

  let candidate: unknown;
  try { candidate = JSON.parse(text); } catch { return { ok: false, errors: ['Gemini returned non-JSON'] }; }
  // Reject anything that isn't a valid plan; this is the guard against raw or
  // malformed AI output ever reaching the executor.
  const validation = validateActionPlan(candidate);
  if (!validation.ok) log('WARN', 'design-assistant.gemini.invalid-plan', { errors: validation.errors });
  return validation;
}

export function targetsFromMatches(matches: SemanticMatch[]): ActionTarget[] {
  return matches.map((m) => ({ semanticRole: m.role, layerId: m.layerId, confidence: m.confidence }));
}
