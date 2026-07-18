import type { Goal } from '../../services/api';

// Pure logic for the Goals "Your 90 years" timeline. Ported verbatim from the
// design prototype (docs/superpowers/reference/alignment-goals-prototype.html,
// logic class ~lines 940–990) so the age math and decade placement match the
// approved design exactly.

export const GOAL_CATS = [
  { name: 'Health', color: '#A9C6B3' },
  { name: 'Wealth', color: '#7FB4D9' },
  { name: 'Family', color: '#C7A9B4' },
  { name: 'Craft', color: '#9DB4CC' },
  { name: 'Adventure', color: '#B3D6EC' },
  { name: 'Spirit', color: '#A5A3C9' },
];

export function catColor(name: string): string {
  return (GOAL_CATS.find(c => c.name === name) || GOAL_CATS[0]).color;
}

export function currentAge(birthYear: number, thisYear: number): number {
  return Math.max(0, thisYear - birthYear);
}

export interface GoalCard {
  id: string;
  hasImage: boolean;
  image: string;
  catColor: string;
  category: string;
  metaLine: string;
  title: string;
  thumbs: string[];
  rewardLine: string;
  showProgress: boolean;
  progressPct: string;
  achieved: boolean;
}

export function goalCard(g: Goal, birthYear: number, thisYear: number): GoalCard {
  const img = (g.rewards.find(r => r.image) || { image: '' }).image;
  const year = parseInt((g.targetDate || '').slice(0, 4)) || thisYear;
  const age = year - birthYear;
  const total = g.milestones.length;
  const done = g.milestones.filter(m => m.done).length;
  const prog = g.completed ? 100 : (total ? Math.round((done / total) * 100) : 0);
  const thumbs = g.rewards.filter(r => r.image).slice(0, 3).map(r => r.image);
  const named = g.rewards.filter(r => r.name && r.name.trim());
  const rewardLine = !g.rewards.length
    ? ''
    : (g.rewards.length === 1
        ? (named[0] ? named[0].name : 'A reward waiting')
        : `${g.rewards.length} rewards waiting`);
  return {
    id: g.id,
    hasImage: !!img,
    image: img || '',
    catColor: catColor(g.category),
    category: g.category,
    metaLine: `${year} · age ${age} · ${g.category}`,
    title: g.title,
    thumbs,
    rewardLine,
    showProgress: prog > 0,
    progressPct: `${prog}%`,
    achieved: g.completed,
  };
}

export interface Decade {
  d0: number;
  label: string;
  years: string;
  isNow: boolean;
  lived: boolean;
  hasGoals: boolean;
  goals: GoalCard[];
  addLabel: string;
  prefillYear: number;
}

// Decade (0/10/…/80) a goal belongs to, from its target year; ages clamp into 0–89.
export function goalDecade(g: Goal, birthYear: number, thisYear: number): number {
  const y = parseInt((g.targetDate || '').slice(0, 4)) || thisYear;
  const a = Math.min(89, Math.max(0, y - birthYear));
  return Math.floor(a / 10) * 10;
}

export function buildDecades(goals: Goal[], birthYear: number, thisYear: number): Decade[] {
  const curAge = currentAge(birthYear, thisYear);
  const nowD0 = Math.min(80, Math.floor(curAge / 10) * 10);
  const out: Decade[] = [];
  for (let d0 = 0; d0 <= 80; d0 += 10) {
    const gs = goals
      .filter(g => goalDecade(g, birthYear, thisYear) === d0)
      .sort((a, b) => (a.targetDate || '').localeCompare(b.targetDate || ''));
    const isNow = d0 === nowD0;
    const lived = d0 < nowD0;
    out.push({
      d0,
      label: `${d0}s`,
      years: `${birthYear + d0} – ${birthYear + d0 + 9}`,
      isNow,
      lived,
      hasGoals: gs.length > 0,
      goals: gs.map(g => goalCard(g, birthYear, thisYear)),
      addLabel: gs.length
        ? '+ add another'
        : lived ? `Add a memory from your ${d0}s` : `Add a goal for your ${d0}s`,
      prefillYear: isNow ? thisYear + 1 : birthYear + d0 + 2,
    });
  }
  return out;
}

export function draftValid(d: { title: string; targetDate: string }): boolean {
  return d.title.trim().length > 0 && !!d.targetDate;
}

export function ageAtLine(birthYear: number, targetDate: string): string {
  if (!targetDate) return '';
  const year = parseInt(targetDate.slice(0, 4));
  if (!year) return '';
  return `You'll be ${year - birthYear} when this comes true.`;
}
