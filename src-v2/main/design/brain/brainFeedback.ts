// Feedback controls for the learning system.
//
// Every generated poster goes through human review before entering
// positive training data. Controls:
//   - Approve
//   - Reject (with reasons)
//   - Better than previous (comparison)
//   - Wrong hero photo
//   - Bad crop
//   - Missing branding
//   - Too empty / Too crowded
//   - Looks mechanical
//   - Typography problem
//   - Correct manually (human correction overrides)

import type { TrainingRecord, DesignPlan, PreferencePair, RejectionReason, FeedbackAction, CropAnchors } from './brainTypes';
import { saveRecord, approveRecord, rejectRecord, correctRecord, savePreferencePair, loadRecord } from './brainStorage';

// ── Approve ──────────────────────────────────────────────────────────────────

export async function approvePoster(posterId: string): Promise<TrainingRecord | null> {
  return approveRecord(posterId);
}

// ── Reject ───────────────────────────────────────────────────────────────────

export async function rejectPoster(posterId: string, reasons: RejectionReason[], note: string): Promise<TrainingRecord | null> {
  return rejectRecord(posterId, reasons, note);
}

// ── Correct ──────────────────────────────────────────────────────────────────

export async function correctPoster(
  posterId: string,
  corrections: Partial<DesignPlan>,
  note: string,
): Promise<TrainingRecord | null> {
  const r = await loadRecord(posterId);
  if (!r) return null;
  r.approvalState = 'corrected';
  r.humanCorrections = corrections;
  r.rejectionNote = note;
  r.updatedAt = new Date().toISOString();
  await saveRecord(r);

  if (corrections.heroPhoto) {
    r.selectedHeroPhoto = corrections.heroPhoto.assetPath;
  }

  return r;
}

// ── Comparison (Better than previous) ────────────────────────────────────────

export async function comparePosters(
  posterAId: string,
  posterBId: string,
  winner: PreferencePair['winner'],
  reason: string,
): Promise<PreferencePair> {
  const pair: PreferencePair = {
    posterAId, posterBId, winner, reason,
    createdAt: new Date().toISOString(),
  };
  await savePreferencePair(pair);

  for (const id of [posterAId, posterBId]) {
    const r = await loadRecord(id);
    if (r) {
      r.preferencePairs.push(pair);
      r.updatedAt = new Date().toISOString();
      await saveRecord(r);
    }
  }

  return pair;
}

// ── Quick feedback actions ───────────────────────────────────────────────────

export async function recordFeedback(action: FeedbackAction): Promise<void> {
  switch (action.action) {
    case 'approve':
      await approveRecord(action.posterId);
      break;
    case 'reject':
      await rejectRecord(action.posterId, action.reasons || [], action.note || '');
      break;
    case 'correct':
      await correctRecord(action.posterId, action.corrections || {}, action.note || '');
      break;
    case 'compare':
      if (action.comparison) {
        await comparePosters(
          action.posterId,
          action.comparison.posterBId,
          action.comparison.winner,
          action.comparison.reason,
        );
      }
      break;
  }
}

// ── Auto-approve if high quality ─────────────────────────────────────────────

export async function autoApproveIfHighQuality(record: TrainingRecord, minScore: number = 70): Promise<boolean> {
  if (record.qualityScores.visualCritique >= minScore && record.qualityScores.qualityGate >= 80) {
    record.approvalState = 'approved';
    record.approvedAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    await saveRecord(record);
    return true;
  }
  return false;
}
