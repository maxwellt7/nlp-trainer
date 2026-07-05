import { describe, it, expect } from 'vitest';
import { capacityBars, alignmentRings } from './insightsLogic';

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
