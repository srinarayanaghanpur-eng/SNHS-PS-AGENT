import { describe, expect, it } from 'vitest';
import { classifyPsdLayer } from '../src-v2/main/psdAnalysis';

const doc = { width: 1080, height: 1350 };
const base = {
  id: 1, parentPath: '', depth: 0, visible: true, locked: false, opacity: 100,
  blendMode: 'normal', clipping: false, mask: false, children: [], bounds: { left: 700, top: 500, right: 900, bottom: 700 },
};

describe('V2 PSD role classification', () => {
  it('does not classify a WhatsApp filename containing a date as a date layer', () => {
    const result = classifyPsdLayer({ ...base, name: 'WhatsApp Image 2026-07-09 at 9.36.04 AM', type: 'pixel', text: null, smartObject: false }, doc);
    expect(result.probableRole).toBe('unknown');
  });

  it('classifies an actual date text layer as date', () => {
    const result = classifyPsdLayer({ ...base, name: 'Label', type: 'text', text: '13 July 2026', smartObject: false }, doc);
    expect(result.probableRole).toBe('date');
    expect(result.confidence).toBeGreaterThan(90);
  });

  it('does not classify programme text as a birthday photograph', () => {
    const result = classifyPsdLayer({ ...base, name: 'PROGRAMME_ITEM_07', type: 'text', text: 'Birthday Wishes', smartObject: false }, doc);
    expect(result.probableRole).toBe('bodyText');
  });
});
