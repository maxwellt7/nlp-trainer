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
