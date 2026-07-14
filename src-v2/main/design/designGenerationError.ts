export interface DesignGenerationFailure {
  code: 'VALID_COMPOSITION_NOT_AVAILABLE' | 'DESIGN_PLAN_HASH_MISMATCH' | 'QUALITY_GATE_REJECTED';
  requestedFamily?: string;
  missingAssets?: string[];
  attemptedFamilies?: string[];
  fallbackReason?: string;
  failures?: string[];
}

export class DesignGenerationError extends Error {
  readonly details: DesignGenerationFailure;
  constructor(details: DesignGenerationFailure) {
    super(`${details.code}: ${details.failures?.join('; ') || details.fallbackReason || 'Professional composition could not be generated.'}`);
    this.name = 'DesignGenerationError';
    this.details = details;
  }
}
