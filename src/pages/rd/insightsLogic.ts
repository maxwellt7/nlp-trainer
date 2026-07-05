function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function qualifier(value: number): string {
  if (value < 4) return 'quiet';
  if (value < 7) return 'steady';
  return 'strong';
}

function titleCase(key: string): string {
  return key
    .split('_')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export type CapacityBar = {
  key: 'suppression' | 'discharge' | 'capacity';
  label: string;
  value: number;
  pct: number;
  qualifier: string;
  desc: string;
  colorVar: string;
};

const CAPACITY_DEFS: Array<Omit<CapacityBar, 'value' | 'pct' | 'qualifier'>> = [
  { key: 'suppression', label: 'Holding in', desc: 'How much you hold back instead of feel.', colorVar: '--rd-muted' },
  { key: 'discharge', label: 'Releasing', desc: 'How freely emotion moves through you when it arrives.', colorVar: '--rd-accent-bright' },
  { key: 'capacity', label: 'Staying with it', desc: 'Your ability to sit with discomfort without escaping it.', colorVar: '--rd-sage' },
];

export function capacityBars(capacityIndex: any): CapacityBar[] | null {
  if (!capacityIndex || typeof capacityIndex !== 'object') return null;
  const vals = CAPACITY_DEFS.map(d => Number(capacityIndex[d.key]));
  if (vals.some(v => !Number.isFinite(v))) return null;
  // All-default (every value 5) reads as "no real data yet".
  if (vals.every(v => v === 5)) return null;
  return CAPACITY_DEFS.map((d, i) => {
    const value = vals[i];
    return { ...d, value, pct: clamp(value * 10, 0, 100), qualifier: qualifier(value) };
  });
}

export type AlignmentRing = { label: string; score: number; dash: string };

export function alignmentRings(congruence: any): AlignmentRing[] {
  if (!congruence || typeof congruence !== 'object') return [];
  const nums = Object.values(congruence).map((v) => Number(v)).filter((v) => Number.isFinite(v));
  // All-default seed (every domain 5) reads as "no real data yet". Require more
  // than one value so a single legitimate domain scored 5 isn't mistaken for the seed.
  if (nums.length > 1 && nums.every((v) => v === 5)) return [];
  const rings: AlignmentRing[] = [];
  for (const [key, raw] of Object.entries(congruence)) {
    const score = Number(raw);
    if (!Number.isFinite(score)) continue;
    const pct = Math.round(clamp(score, 0, 10) * 10);
    rings.push({ label: titleCase(key), score, dash: `${pct}, 100` });
    if (rings.length === 4) break;
  }
  return rings;
}

export type Pattern = { title: string; desc: string; colorVar: string };

const PATTERN_COLORS = ['--rd-accent-bright', '--rd-muted', '--rd-sage'];

const META_COPY: Record<string, Record<string, { title: string; desc: string }>> = {
  direction: {
    toward: { title: 'You move toward, not away', desc: 'You frame goals as things you want, rather than things you fear. That gives your sessions forward pull.' },
    away: { title: "You move away from what you don't want", desc: "You're motivated by moving away from discomfort. Naming what you do want can add pull." },
  },
  frame: {
    external: { title: "Other people's eyes matter a lot", desc: "Much of your stress traces back to how you imagine being seen. We're gently loosening this." },
    internal: { title: 'You check decisions against your own compass', desc: 'You weigh choices by your own standards more than outside approval.' },
  },
  chunk: {
    global: { title: 'You think in the big picture first', desc: 'You reach for the overall shape before the details.' },
    specific: { title: 'You work from the details up', desc: 'You build understanding from specifics toward the whole.' },
  },
  rep_system: {
    visual: { title: 'You think in pictures', desc: 'You process experience most vividly through images.' },
    auditory: { title: 'You think in words and tone', desc: 'You process experience most vividly through sound and language.' },
    kinesthetic: { title: 'You think through feeling', desc: 'You process experience most vividly through bodily sensation.' },
  },
};

export function buildPatterns(profile: any): Pattern[] {
  const out: Array<{ title: string; desc: string }> = [];
  const mp = profile?.meta_programs || {};
  for (const key of ['direction', 'frame', 'chunk', 'rep_system']) {
    const val = mp[key];
    const copy = val && META_COPY[key]?.[val];
    if (copy) out.push(copy);
  }

  const vhScore = Number(profile?.victim_healer?.score);
  if (Number.isFinite(vhScore)) {
    if (vhScore >= 2) out.push({ title: "You're taking ownership of your part", desc: 'You increasingly meet situations as something you can shape, not just endure.' });
    else if (vhScore <= -2) out.push({ title: 'Some things still feel done to you', desc: "A few areas still feel outside your control. We'll keep widening where you have a say." });
  }

  const clean = Number(profile?.force_audit?.clean);
  const subtle = Number(profile?.force_audit?.subtle);
  if (Number.isFinite(clean) && Number.isFinite(subtle)) {
    if (clean - subtle >= 2) out.push({ title: 'You influence cleanly, without pushing', desc: 'You tend to create conditions where people want to follow, rather than forcing.' });
    else if (subtle - clean >= 2) out.push({ title: 'You sometimes push harder than you need to', desc: 'Overexplaining or managing reactions can creep in. Trusting the point to land is the practice.' });
  }

  return out.map((p, i) => ({ ...p, colorVar: PATTERN_COLORS[i % PATTERN_COLORS.length] }));
}
