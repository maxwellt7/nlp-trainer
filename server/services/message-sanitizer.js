// Heals assistant messages that were persisted as raw JSON blobs when a
// previous AI response failed to parse cleanly (typically max_tokens
// truncation in the coaching pipeline). Used both for outbound responses to
// the frontend and for context fed back into the model on subsequent turns.

export function extractReplyField(text) {
  if (typeof text !== 'string') return '';
  const match = text.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!match) return '';
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
}

export function extractReadyFlag(text) {
  if (typeof text !== 'string') return false;
  const match = text.match(/"readyToGenerate"\s*:\s*(true|false)/);
  return Boolean(match && match[1] === 'true');
}

export function looksLikeRawJson(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return (
    trimmed.startsWith('{') &&
    /"reply"|"readyToGenerate"|"profileUpdates"|"valueDetections"/.test(trimmed)
  );
}

export function sanitizeAssistantContent(content) {
  if (typeof content !== 'string') return content;
  if (!looksLikeRawJson(content)) return content;
  const recovered = extractReplyField(content);
  if (recovered && !looksLikeRawJson(recovered)) {
    return recovered;
  }
  return content;
}

export function sanitizeMessageHistory(list = []) {
  return list.map((m) => {
    if (m && m.role === 'assistant' && typeof m.content === 'string') {
      return { ...m, content: sanitizeAssistantContent(m.content) };
    }
    return m;
  });
}
