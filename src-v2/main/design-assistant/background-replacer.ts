// Background replacement math + protected-element rules.
//
// Pure, testable geometry for cover-fitting a placed image to the canvas
// without stretching (§ Background replacement workflow), plus the branding
// protection rules (§ School branding protection). The actual Photoshop
// placement is emitted by photoshop-command-executor using these numbers.

import { PROTECTED_ROLES, type SemanticRole } from './types';

export interface CoverFit {
  scalePercent: number; // uniform scale applied to the placed image, in %
  drawWidth: number;
  drawHeight: number;
  offsetX: number;      // translate to position top-left of the scaled image
  offsetY: number;
  cropped: { x: number; y: number; width: number; height: number }; // visible region
}

// Cover: scale so the image fully covers the canvas, preserve aspect ratio,
// centre, and crop the overflow. focusY in 0..1 biases the vertical crop.
export function computeCover(
  imageWidth: number, imageHeight: number,
  canvasWidth: number, canvasHeight: number,
  focusY = 0.5,
): CoverFit {
  if (imageWidth <= 0 || imageHeight <= 0) throw new Error('invalid image dimensions');
  const scale = Math.max(canvasWidth / imageWidth, canvasHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const offsetX = (canvasWidth - drawWidth) / 2;
  const offsetY = -(drawHeight - canvasHeight) * focusY;
  return {
    scalePercent: Number((scale * 100).toFixed(4)),
    drawWidth: Number(drawWidth.toFixed(2)),
    drawHeight: Number(drawHeight.toFixed(2)),
    offsetX: Number(offsetX.toFixed(2)),
    offsetY: Number(offsetY.toFixed(2)),
    cropped: { x: 0, y: 0, width: canvasWidth, height: canvasHeight },
  };
}

// Contain: fit the whole image inside the canvas, preserve aspect ratio, letterbox.
export function computeContain(
  imageWidth: number, imageHeight: number,
  canvasWidth: number, canvasHeight: number,
): CoverFit {
  if (imageWidth <= 0 || imageHeight <= 0) throw new Error('invalid image dimensions');
  const scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const offsetX = (canvasWidth - drawWidth) / 2;
  const offsetY = (canvasHeight - drawHeight) / 2;
  return {
    scalePercent: Number((scale * 100).toFixed(4)),
    drawWidth: Number(drawWidth.toFixed(2)),
    drawHeight: Number(drawHeight.toFixed(2)),
    offsetX: Number(offsetX.toFixed(2)),
    offsetY: Number(offsetY.toFixed(2)),
    cropped: { x: offsetX, y: offsetY, width: drawWidth, height: drawHeight },
  };
}

// ── Protected-element rules ─────────────────────────────────────────────────
export interface ProtectionConfig {
  // roles the user has explicitly unlocked from protection
  overrides?: SemanticRole[];
}

const DESTRUCTIVE = new Set(['delete', 'setVisibility', 'replaceBackground', 'replaceSmartObject']);

export interface ProtectionCheck {
  protected: boolean;
  requiresConfirmation: boolean;
  warning?: string;
}

export function checkProtection(role: SemanticRole | undefined, operationType: string, cfg: ProtectionConfig = {}): ProtectionCheck {
  if (!role) return { protected: false, requiresConfirmation: false };
  const isProtected = PROTECTED_ROLES.has(role) && !(cfg.overrides ?? []).includes(role);
  if (!isProtected) return { protected: false, requiresConfirmation: false };
  // Movement / restyling of protected elements is allowed but destructive ops warn.
  if (DESTRUCTIVE.has(operationType)) {
    const label = role.replace(/_/g, ' ');
    return {
      protected: true,
      requiresConfirmation: true,
      warning: `This command will ${operationType === 'delete' ? 'delete' : operationType === 'setVisibility' ? 'hide' : 'replace'} the ${label}. The original layer will be hidden and preserved. Continue?`,
    };
  }
  return { protected: true, requiresConfirmation: false };
}
