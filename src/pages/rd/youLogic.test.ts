import { describe, it, expect } from 'vitest';
import { overallCongruence, valueBars } from './youLogic';

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
});
