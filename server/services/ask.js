// Pure helpers for the Ask (knowledge-base Q&A) route. No I/O — unit-tested.

export function sourceToFilename(source) {
  if (typeof source !== 'string' || !source) return '';
  const withoutPrefix = source.replace(/^dropbox:/, '');
  const parts = withoutPrefix.split('/');
  return parts[parts.length - 1] || '';
}

// Collapse Dropbox's " (N)" re-upload suffix so duplicate copies group as one
// source: "Foo Transcript (3).txt" -> "Foo Transcript.txt".
export function baseFilename(filename) {
  return String(filename || '').replace(/ \(\d+\)(\.[^.]+)?$/, '$1');
}

// Highest score per file (duplicate " (N)" copies collapsed), sorted desc,
// capped at 5. Chunks with no derivable filename are dropped.
export function dedupeSources(chunks) {
  const best = new Map();
  for (const c of chunks || []) {
    const filename = baseFilename(sourceToFilename(c && c.source));
    if (!filename) continue;
    const score = typeof c.score === 'number' ? c.score : 0;
    if (!best.has(filename) || score > best.get(filename)) best.set(filename, score);
  }
  return [...best.entries()]
    .map(([filename, score]) => ({ filename, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// Drop chunks whose text exactly matches an earlier one (duplicate files index
// identical text), so the LLM context isn't wasted on copies. Order preserved;
// blank chunks dropped.
export function dedupeChunks(chunks) {
  const seen = new Set();
  const out = [];
  for (const c of chunks || []) {
    const key = (c && c.text ? String(c.text) : '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export function isBelowRelevanceFloor(chunks, minScore) {
  if (!Array.isArray(chunks) || chunks.length === 0) return true;
  const top = Math.max(...chunks.map((c) => (typeof c.score === 'number' ? c.score : 0)));
  return top < minScore;
}
