import { describe, it, expect } from 'vitest';
import { capacityBars, alignmentRings, buildPatterns } from './insightsLogic';

describe('capacityBars', () => {
  it('returns null when capacity_index is missing', () => {
    expect(capacityBars(undefined)).toBeNull();
    expect(capacityBars({})).toBeNull();
  });

  it('treats all-default (every value 5) as empty', () => {
    expect(capacityBars({ suppression: 5, discharge: 5, capacity: 5 })).toBeNull();
  });

  it('maps the three keys to labels, pct and colors', () => {
    const bars = capacityBars({ suppression: 3, discharge: 6, capacity: 8 });
    expect(bars).not.toBeNull();
    expect(bars!.map(b => b.label)).toEqual(['Holding in', 'Releasing', 'Staying with it']);
    expect(bars!.map(b => b.pct)).toEqual([30, 60, 80]);
    expect(bars!.map(b => b.colorVar)).toEqual(['--rd-muted', '--rd-accent-bright', '--rd-sage']);
  });

  it('buckets the qualifier word by value', () => {
    const bars = capacityBars({ suppression: 2, discharge: 5.5, capacity: 9 })!;
    expect(bars.map(b => b.qualifier)).toEqual(['quiet', 'steady', 'strong']);
  });

  it('clamps pct into 0..100', () => {
    const bars = capacityBars({ suppression: -1, discharge: 12, capacity: 7 })!;
    expect(bars[0].pct).toBe(0);
    expect(bars[1].pct).toBe(100);
  });
});

describe('alignmentRings', () => {
  it('returns [] when congruence is empty or missing', () => {
    expect(alignmentRings(undefined)).toEqual([]);
    expect(alignmentRings({})).toEqual([]);
  });

  it('title-cases keys and builds the dash string', () => {
    const rings = alignmentRings({ work: 6.8, home_life: 7.9 });
    expect(rings[0]).toEqual({ label: 'Work', score: 6.8, dash: '68, 100' });
    expect(rings[1]).toEqual({ label: 'Home Life', score: 7.9, dash: '79, 100' });
  });

  it('caps at 4 rings', () => {
    const rings = alignmentRings({ a: 1, b: 2, c: 3, d: 4, e: 5 });
    expect(rings).toHaveLength(4);
  });

  it('ignores non-numeric values', () => {
    const rings = alignmentRings({ work: 5, bad: 'x' as any });
    expect(rings.map(r => r.label)).toEqual(['Work']);
  });
});

describe('buildPatterns', () => {
  it('returns [] when nothing is detected', () => {
    expect(buildPatterns({})).toEqual([]);
    expect(buildPatterns({ meta_programs: { direction: null, frame: null, chunk: null, rep_system: null } })).toEqual([]);
  });

  it('translates meta_programs to plain-language titles in order', () => {
    const p = buildPatterns({ meta_programs: { direction: 'toward', frame: 'external', chunk: 'global', rep_system: 'visual' } });
    expect(p.map(x => x.title)).toEqual([
      'You move toward, not away',
      "Other people's eyes matter a lot",
      'You think in the big picture first',
      'You think in pictures',
    ]);
  });

  it('cycles dot colors by index', () => {
    const p = buildPatterns({ meta_programs: { direction: 'toward', frame: 'external', chunk: 'global', rep_system: 'auditory' } });
    expect(p.map(x => x.colorVar)).toEqual(['--rd-accent-bright', '--rd-muted', '--rd-sage', '--rd-accent-bright']);
  });

  it('folds in victim_healer only when strongly one-sided', () => {
    expect(buildPatterns({ victim_healer: { score: 3 } }).map(x => x.title)).toEqual(["You're taking ownership of your part"]);
    expect(buildPatterns({ victim_healer: { score: -3 } }).map(x => x.title)).toEqual(['Some things still feel done to you']);
    expect(buildPatterns({ victim_healer: { score: 1 } })).toEqual([]);
  });

  it('folds in force_audit only on a clear margin', () => {
    expect(buildPatterns({ force_audit: { clean: 8, subtle: 3 } }).map(x => x.title)).toEqual(['You influence cleanly, without pushing']);
    expect(buildPatterns({ force_audit: { clean: 3, subtle: 8 } }).map(x => x.title)).toEqual(['You sometimes push harder than you need to']);
    expect(buildPatterns({ force_audit: { clean: 5, subtle: 5 } })).toEqual([]);
  });
});
