import { describe, it, expect } from 'vitest';
import { overallCongruence, valueBars } from './youLogic';
import { topTension, beliefs } from './youLogic';

describe('overallCongruence', () => {
  it('returns null for missing scores or non-positive congruence', () => {
    expect(overallCongruence(null)).toBeNull();
    expect(overallCongruence(undefined)).toBeNull();
    expect(overallCongruence({ overall_congruence: 0 })).toBeNull();
    expect(overallCongruence({ overall_congruence: -1 })).toBeNull();
  });
  it('returns the numeric congruence when positive', () => {
    expect(overallCongruence({ overall_congruence: 7.2 })).toBe(7.2);
  });
});

describe('valueBars', () => {
  it('returns [] for empty or missing input', () => {
    expect(valueBars([])).toEqual([]);
    expect(valueBars(undefined)).toEqual([]);
  });
  it('marks low-confidence values as emerging regardless of expression', () => {
    const [bar] = valueBars([{ value_name: 'belonging', confidence: 0.3, purity_score: 4.4, expression: 'pure' }]);
    expect(bar.badge).toBe('emerging');
    expect(bar.badgeColorVar).toBe('--rd-muted');
    expect(bar.desc).toBe('Newly surfaced in recent conversations.');
    expect(bar.name).toBe('Belonging');
    expect(bar.fillPct).toBe(44);
  });
  it('marks confident pure values as living it with pure_expression desc', () => {
    const [bar] = valueBars([{ value_name: 'honesty', confidence: 0.9, purity_score: 8.4, expression: 'pure', pure_expression: 'Shows up cleanly in most of what you share.' }]);
    expect(bar.badge).toBe('living it');
    expect(bar.badgeColorVar).toBe('--rd-sage');
    expect(bar.fillPct).toBe(84);
    expect(bar.desc).toBe('Shows up cleanly in most of what you share.');
  });
  it('marks confident mixed/distorted values as mixed with distorted_expression desc', () => {
    const [bar] = valueBars([{ value_name: 'freedom', confidence: 0.8, purity_score: 6.2, expression: 'distorted', distorted_expression: 'Sometimes independence, sometimes avoidance.' }]);
    expect(bar.badge).toBe('mixed');
    expect(bar.badgeColorVar).toBe('--rd-accent-bright');
    expect(bar.desc).toBe('Sometimes independence, sometimes avoidance.');
  });
  it('clamps fill and falls back when desc fields are missing', () => {
    const [bar] = valueBars([{ value_name: 'growth', confidence: 0.7, purity_score: 12, expression: 'pure' }]);
    expect(bar.fillPct).toBe(100);
    expect(bar.desc).toBe('Shows up cleanly in what you share.');
  });
  it('treats confidence exactly 0.5 as not emerging', () => {
    const [bar] = valueBars([{ value_name: 'growth', confidence: 0.5, purity_score: 7, expression: 'pure' }]);
    expect(bar.badge).toBe('living it');
  });
  it('caps the list to the top 8 values (input is pre-sorted by confidence DESC)', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ value_name: `v${i}`, confidence: 0.9, purity_score: 7, expression: 'pure' }));
    const bars = valueBars(many);
    expect(bars).toHaveLength(8);
    expect(bars[0].name).toBe('V0');
    expect(bars[7].name).toBe('V7');
  });
});

describe('topTension', () => {
  it('returns null when there are no conflicts', () => {
    expect(topTension([])).toBeNull();
    expect(topTension(undefined)).toBeNull();
  });
  it('returns only the first conflict, title-cased', () => {
    const t = topTension([
      { value_a: 'freedom', value_b: 'belonging', description: 'You want both.' },
      { value_a: 'x', value_b: 'y', description: 'ignored' },
    ]);
    expect(t).toEqual({ a: 'Freedom', b: 'Belonging', desc: 'You want both.' });
  });
});

describe('beliefs', () => {
  it('returns [] for empty or missing input', () => {
    expect(beliefs([])).toEqual([]);
    expect(beliefs(undefined)).toEqual([]);
  });
  it('colors empowering/core sage and limiting/worthiness/root danger', () => {
    const b = beliefs([
      { statement_type: 'empowering_belief', content: 'I can handle hard things.' },
      { statement_type: 'core_identity', content: 'I am a builder.' },
      { statement_type: 'limiting_belief', content: 'I am behind.' },
      { statement_type: 'worthiness_pattern', content: 'I must earn rest.' },
      { statement_type: 'root_belief', content: 'Love is conditional.' },
    ]);
    expect(b.map(x => x.colorVar)).toEqual(['--rd-sage', '--rd-sage', '--rd-danger', '--rd-danger', '--rd-danger']);
    expect(b[0].content).toBe('I can handle hard things.');
  });
  it('skips items with empty content', () => {
    expect(beliefs([{ statement_type: 'core_identity', content: '' }])).toEqual([]);
  });
});
