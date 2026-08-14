/**
 * Join recent user turns into a retrieval query so RAG sees conversation
 * context, not only the last sentence. Older turns are dropped first; if the
 * remainder still exceeds maxChars, the tail (most recent) is kept.
 *
 * @param {Array<{role?: string, content?: string}>} messages
 * @param {object} [opts]
 * @param {number} [opts.maxTurns=3]
 * @param {number} [opts.maxChars=900]
 * @returns {string}
 */
export function recentUserQuery(messages, { maxTurns = 3, maxChars = 900 } = {}) {
  if (!Array.isArray(messages) || maxTurns <= 0) return '';
  const userTurns = [];
  for (let i = messages.length - 1; i >= 0 && userTurns.length < maxTurns; i -= 1) {
    const m = messages[i];
    const text = m && m.role === 'user' && typeof m.content === 'string' ? m.content.trim() : '';
    if (text) userTurns.push(text);
  }
  const joined = userTurns.reverse().join('\n');
  if (!joined) return '';
  if (joined.length <= maxChars) return joined;
  return joined.slice(-maxChars);
}
