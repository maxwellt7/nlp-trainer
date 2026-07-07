import { describe, it, expect } from 'vitest';
import { currentAge, goalCard, buildDecades, draftValid, ageAtLine, catColor } from './goalsLogic';
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
  it('starts at current decade, runs to 80s, marks current', () => {
    const decs = buildDecades([], 1992, 2025); // curAge 33 -> startDec 30
    expect(decs[0].d0).toBe(30);
    expect(decs[decs.length - 1].d0).toBe(80);
    expect(decs[0].isNow).toBe(true);
    expect(decs[0].years).toBe('2022 – 2031');
    expect(decs[0].prefillYear).toBe(2026); // isNow -> thisYear+1
    expect(decs[1].prefillYear).toBe(1992 + 40 + 2);
  });
  it('places a goal into the right decade', () => {
    const decs = buildDecades([base({ targetDate: '2045-01-01' })], 1992, 2025); // age 53 -> 50s
    const fifties = decs.find(d => d.d0 === 50)!;
    expect(fifties.goals.length).toBe(1);
    expect(fifties.hasGoals).toBe(true);
  });
  it('clamps a past-dated goal into the current decade', () => {
    const decs = buildDecades([base({ targetDate: '2000-01-01' })], 1992, 2025); // age 8 < curAge -> current decade
    expect(decs[0].goals.length).toBe(1);
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
