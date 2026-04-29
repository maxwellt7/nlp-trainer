function extractDatePart(parts, type) {
  return parts.find((part) => part.type === type)?.value || '';
}

export function normalizeTimezone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return null;

  const trimmed = timeZone.trim();
  if (!trimmed) return null;

  try {
    Intl.DateTimeFormat('en-US', { timeZone: trimmed }).format(new Date());
    return trimmed;
  } catch {
    return null;
  }
}

export function getDateKeyForTimezone(timeZone, date = new Date()) {
  const normalized = normalizeTimezone(timeZone) || 'UTC';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: normalized,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = extractDatePart(parts, 'year');
  const month = extractDatePart(parts, 'month');
  const day = extractDatePart(parts, 'day');

  return `${year}-${month}-${day}`;
}
