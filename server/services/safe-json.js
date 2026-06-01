// Defensive JSON.parse for stored column values that *might* be malformed
// (legacy rows from before sanitization, corrupted writes, etc.). Returns
// the fallback on any failure or non-string input so a single bad row
// cannot 500 an entire list endpoint.

export function safeJsonParse(value, fallback) {
  if (typeof value !== 'string' || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
