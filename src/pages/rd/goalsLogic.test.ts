import { describe, it, expect } from 'vitest';
import { currentAge, goalCard, buildDecades, draftValid, ageAtLine, catColor, spectrumData } from './goalsLogic';
import type { Goal } from '../../services/api';

const base = (over: Partial<Goal> = {}): Goal => ({
  id: 'g1', title: 'T', description: '', category: 'Wealth', targetDate: '2035-06-01',
  milestones: [], rewards: [], completed: false, ...over,
});

describe('currentAge', () => {
  it('computes age, floors at 0', () => {
    expect(currentAge(1992, 2025)).toBe(33);
    expect(currentAge(2030, 2025)).toBe(0);
  });
});

describe('goalCard', () => {
  it('meta line, progress, reward line', () => {
    const c = goalCard(base({ milestones: [{ text: 'a', done: true }, { text: 'b', done: false }], rewards: [{ type: 'material', name: 'Boat', image: '' }] }), 1992, 2025);
    expect(c.metaLine).toBe('2035 · age 43 · Wealth');
    expect(c.progressPct).toBe('50%');
    expect(c.showProgress).toBe(true);
    expect(c.rewardLine).toBe('Boat');
  });
  it('completed => 100% + achieved + sage', () => {
    const c = goalCard(base({ completed: true, rewards: [{ type: 'material', name: 'A', image: '' }, { type: 'experience', name: 'B', image: '' }] }), 1992, 2025);
    expect(c.progressPct).toBe('100%');
    expect(c.achieved).toBe(true);
    expect(c.rewardLine).toBe('2 rewards waiting');
  });
  it('picks first image for hero + thumbs', () => {
    const c = goalCard(base({ rewards: [{ type: 'material', name: '', image: 'data:img1' }] }), 1992, 2025);
    expect(c.hasImage).toBe(true);
    expect(c.image).toBe('data:img1');
    expect(c.thumbs).toEqual(['data:img1']);
  });
  it('no rewards => empty reward line, no progress', () => {
    const c = goalCard(base(), 1992, 2025);
    expect(c.rewardLine).toBe('');
    expect(c.showProgress).toBe(false);
  });
});

describe('buildDecades', () => {
  it('spans all decades 0s → 80s and marks the current one', () => {
    const decs = buildDecades([], 1992, 2025); // curAge 33 -> now = 30s
    expect(decs.length).toBe(9);
    expect(decs[0].d0).toBe(0);
    expect(decs[decs.length - 1].d0).toBe(80);
    const now = decs.find(d => d.isNow)!;
    expect(now.d0).toBe(30);
    expect(now.years).toBe('2022 – 2031');
    expect(now.prefillYear).toBe(2026); // isNow -> thisYear+1
    expect(decs.find(d => d.d0 === 40)!.prefillYear).toBe(1992 + 40 + 2);
  });
  it('marks decades before the current one as lived', () => {
    const decs = buildDecades([], 1992, 2025);
    expect(decs.find(d => d.d0 === 20)!.lived).toBe(true);
    expect(decs.find(d => d.d0 === 30)!.lived).toBe(false); // isNow, not lived
    expect(decs.find(d => d.d0 === 40)!.lived).toBe(false);
  });
  it('places a goal into the right decade', () => {
    const decs = buildDecades([base({ targetDate: '2045-01-01' })], 1992, 2025); // age 53 -> 50s
    const fifties = decs.find(d => d.d0 === 50)!;
    expect(fifties.goals.length).toBe(1);
    expect(fifties.hasGoals).toBe(true);
  });
  it('places a past-dated goal in its true (lived) decade, not the current one', () => {
    const decs = buildDecades([base({ targetDate: '2000-01-01' })], 1992, 2025); // age 8 -> 0s
    expect(decs.find(d => d.d0 === 0)!.goals.length).toBe(1);
    expect(decs.find(d => d.d0 === 30)!.goals.length).toBe(0);
  });
  it('lived add-label reads as memory; future as goal', () => {
    const decs = buildDecades([], 1992, 2025);
    expect(decs.find(d => d.d0 === 20)!.addLabel).toBe('Add a memory from your 20s');
    expect(decs.find(d => d.d0 === 50)!.addLabel).toBe('Add a goal for your 50s');
  });
  it('goal cards carry their raw category for filtering', () => {
    const decs = buildDecades([base({ targetDate: '2045-01-01', category: 'Family' })], 1992, 2025);
    expect(decs.find(d => d.d0 === 50)!.goals[0].category).toBe('Family');
  });
});

describe('draftValid / ageAtLine / catColor', () => {
  it('valid requires title + date', () => {
    expect(draftValid({ title: 'x', targetDate: '2030-01-01' })).toBe(true);
    expect(draftValid({ title: '   ', targetDate: '2030-01-01' })).toBe(false);
    expect(draftValid({ title: 'x', targetDate: '' })).toBe(false);
  });
  it('age line', () => {
    expect(ageAtLine(1992, '2035-01-01')).toBe("You'll be 43 when this comes true.");
    expect(ageAtLine(1992, '')).toBe('');
  });
  it('category color + fallback', () => {
    expect(catColor('Wealth')).toBe('#7FB4D9');
    expect(catColor('Nope')).toBe('#A9C6B3'); // falls back to first (Health)
  });
});

describe('spectrumData', () => {
  it('needle at current age / 90', () => {
    expect(spectrumData([], 1992, 2025).nowPct).toBeCloseTo((33 / 90) * 100);
    expect(spectrumData([], 1920, 2025).nowPct).toBe(100); // age >90 clamps
  });
  it('one cluster per year, positioned by age, ascending', () => {
    const s = spectrumData([
      base({ id: 'a', targetDate: '2045-01-01' }),               // age 53
      base({ id: 'b', targetDate: '2030-06-01', category: 'Family' }), // age 38
    ], 1992, 2025);
    expect(s.clusters.length).toBe(2);
    expect(s.clusters[0].year).toBe(2030);
    expect(s.clusters[0].pct).toBeCloseTo((38 / 90) * 100);
    expect(s.clusters[0].d0).toBe(30);
    expect(s.clusters[0].dots[0]).toEqual({ goalId: 'b', color: '#C7A9B4', achieved: false, category: 'Family' });
  });
  it('caps dots at 3 with an extra count', () => {
    const gs = ['a', 'b', 'c', 'd', 'e'].map(id => base({ id, targetDate: '2045-01-01' }));
    const c = spectrumData(gs, 1992, 2025).clusters[0];
    expect(c.dots.length).toBe(3);
    expect(c.extra).toBe(2);
  });
  it('achieved dots are flagged; out-of-range years clamp onto the span', () => {
    const s = spectrumData([
      base({ id: 'won', targetDate: '2000-01-01', completed: true }), // past
      base({ id: 'far', targetDate: '2095-01-01' }),                  // beyond 90
    ], 1992, 2025);
    expect(s.clusters[0].dots[0].achieved).toBe(true);
    expect(s.clusters[0].pct).toBeCloseTo((8 / 90) * 100);
    expect(s.clusters[1].pct).toBeCloseTo((89 / 90) * 100); // clamped to age 89
  });
  it('nine decade ticks 0s..80s', () => {
    const t = spectrumData([], 1992, 2025).ticks;
    expect(t.length).toBe(9);
    expect(t[0]).toEqual({ d0: 0, pct: 0, label: '0s' });
    expect(t[8].label).toBe('80s');
  });
});
