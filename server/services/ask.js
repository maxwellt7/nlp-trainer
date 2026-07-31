// Pure helpers for the Ask (knowledge-base Q&A) route. No I/O — unit-tested.

export function sourceToFilename(source) {
  if (typeof source !== 'string' || !source) return '';
  const withoutPrefix = source.replace(/^dropbox:/, '');
  const parts = withoutPrefix.split('/');
  return parts[parts.length - 1] || '';
}

// Highest score per file, sorted desc, capped at 5. Chunks with no derivable
// filename are dropped.
export function dedupeSources(chunks) {
  const best = new Map();
  for (const c of chunks || []) {
    const filename = sourceToFilename(c && c.source);
    if (!filename) continue;
    const score = typeof c.score === 'number' ? c.score : 0;
    if (!best.has(filename) || score > best.get(filename)) best.set(filename, score);
  }
  return [...best.entries()]
    .map(([filename, score]) => ({ filename, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function isBelowRelevanceFloor(chunks, minScore) {
  if (!Array.isArray(chunks) || chunks.length === 0) return true;
  const top = Math.max(...chunks.map((c) => (typeof c.score === 'number' ? c.score : 0)));
  return top < minScore;
}
