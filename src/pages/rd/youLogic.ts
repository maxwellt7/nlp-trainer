function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function titleCase(s: string): string {
  if (!s) return '';
  return s
    .split(/[\s_]+/)
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function overallCongruence(scores: any): number | null {
  if (!scores || typeof scores !== 'object') return null;
  const v = Number(scores.overall_congruence);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v;
}

export type ValueBar = {
  name: string;
  badge: 'living it' | 'mixed' | 'emerging';
  badgeColorVar: string;
  fillPct: number;
  desc: string;
};

export function valueBars(values: any): ValueBar[] {
  if (!Array.isArray(values)) return [];
  return values.map((v: any) => {
    const confidence = Number(v?.confidence) || 0;
    const purity = Number(v?.purity_score) || 0;
    const pure = (v?.pure_expression || '').trim();
    const distorted = (v?.distorted_expression || '').trim();

    let badge: ValueBar['badge'];
    let badgeColorVar: string;
    let desc: string;
    if (confidence < 0.5) {
      badge = 'emerging';
      badgeColorVar = '--rd-muted';
      desc = 'Newly surfaced in recent conversations.';
    } else if (v?.expression === 'pure') {
      badge = 'living it';
      badgeColorVar = '--rd-sage';
      desc = pure || 'Shows up cleanly in what you share.';
    } else {
      badge = 'mixed';
      badgeColorVar = '--rd-accent-bright';
      desc = distorted || pure || 'Sometimes clean, sometimes a cover — worth watching.';
    }

    return { name: titleCase(v?.value_name || ''), badge, badgeColorVar, fillPct: clamp(purity * 10, 0, 100), desc };
  });
}

export type Tension = { a: string; b: string; desc: string };

export function topTension(conflicts: any): Tension | null {
  if (!Array.isArray(conflicts) || conflicts.length === 0) return null;
  const c = conflicts[0];
  if (!c || (!c.value_a && !c.value_b)) return null;
  return { a: titleCase(c.value_a || ''), b: titleCase(c.value_b || ''), desc: c.description || '' };
}

export type Belief = { content: string; colorVar: string };

const SAGE_TYPES = new Set(['empowering_belief', 'core_identity']);

export function beliefs(statements: any): Belief[] {
  if (!Array.isArray(statements)) return [];
  return statements
    .filter((s: any) => s && (s.content || '').trim())
    .map((s: any) => ({
      content: s.content,
      colorVar: SAGE_TYPES.has(s.statement_type) ? '--rd-sage' : '--rd-danger',
    }));
}
