// Heals assistant messages that were persisted as raw JSON blobs when a
// previous AI response failed to parse cleanly (typically max_tokens
// truncation in the coaching pipeline). Used both for outbound responses to
// the frontend and for context fed back into the model on subsequent turns.

// Extracts a single string field value out of a (possibly malformed or
// truncated) JSON blob. Used to recover content when JSON.parse fails on
// the model's response — both for chat replies and hypnosis script segments.
function extractStringField(text, fieldName) {
  if (typeof text !== 'string' || typeof fieldName !== 'string') return '';
  // Escape any regex metacharacters in the field name (none today, but keeps
  // this safe if a caller passes an unusual name).
  const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Normal case: a fully-formed "field": "..." string with a closing quote.
  let match = text.match(new RegExp(`"${escapedField}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  // Truncation fallback: max_tokens cut the response off mid-value, so there
  // is no closing quote. Capture from the opening quote to end-of-string,
  // tolerating a dangling backslash (a half-written escape).
  if (!match) {
    match = text.match(new RegExp(`"${escapedField}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)\\\\?$`));
  }
  if (!match) return '';
  const raw = match[1];
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
}

export function extractReplyField(text) {
  return extractStringField(text, 'reply');
}

export function extractScriptField(text) {
  return extractStringField(text, 'script');
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

// Derives a chat-safe assistant message from a model response. Prefers an
// already-parsed reply, falls back to extracting/healing the raw text, and
// returns '' when nothing usable can be salvaged — signalling the caller to
// surface an error instead of persisting a raw JSON blob into the chat.
export function recoverChatReply(text, parsedReply) {
  if (typeof parsedReply === 'string' && parsedReply.trim() && !looksLikeRawJson(parsedReply)) {
    return parsedReply;
  }
  const cleaned = sanitizeAssistantContent(typeof text === 'string' ? text : '');
  if (typeof cleaned === 'string' && cleaned.trim() && !looksLikeRawJson(cleaned)) {
    return cleaned;
  }
  return '';
}

// Detects a hypnosis-script JSON wrapper (the shape returned by the chunked
// script generator). Used to decide whether raw model text would leak the
// JSON envelope ("title", "script") into TTS if passed through unchanged.
export function looksLikeScriptWrapperJson(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.startsWith('{') && /"script"|"title"|"sessionSummary"/.test(trimmed);
}

// Derives the TTS-safe script text from a model response. Prefers an
// already-parsed script, otherwise extracts the "script" field out of a
// (possibly truncated) JSON wrapper. Returns '' when nothing salvageable
// remains — caller should fail the segment rather than feed raw JSON to TTS
// (which would make the synth speak the literal word "script").
export function recoverScriptText(text, parsedScript) {
  if (typeof parsedScript === 'string' && parsedScript.trim() && !looksLikeScriptWrapperJson(parsedScript)) {
    return parsedScript;
  }
  if (typeof text !== 'string' || !text.trim()) return '';
  if (looksLikeScriptWrapperJson(text)) {
    const recovered = extractScriptField(text);
    if (recovered && recovered.trim() && !looksLikeScriptWrapperJson(recovered)) {
      return recovered;
    }
    return '';
  }
  return text;
}

export function sanitizeMessageHistory(list = []) {
  return list.map((m) => {
    if (m && m.role === 'assistant' && typeof m.content === 'string') {
      return { ...m, content: sanitizeAssistantContent(m.content) };
    }
    return m;
  });
}
