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

function timeOfDayLabel(hour24) {
  if (hour24 < 5) return 'late night';
  if (hour24 < 12) return 'morning';
  if (hour24 < 17) return 'afternoon';
  if (hour24 < 21) return 'evening';
  return 'night';
}

// Produces a short, prompt-ready block describing the user's local clock so
// the LLM can greet appropriately ("good evening" at 10pm) and reason about
// time-of-day context. Caller injects this into the system prompt.
export function getLocalTimeContext(timeZone, date = new Date()) {
  const normalized = normalizeTimezone(timeZone) || 'UTC';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: normalized,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const get = (type) => extractDatePart(parts, type);
  const hour24 = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: normalized,
    hour: 'numeric',
    hour12: false,
  }).format(date).replace(/[^\d]/g, '')) || 0;

  const weekday = get('weekday');
  const month = get('month');
  const day = get('day');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  const dayPeriod = get('dayPeriod');
  const label = timeOfDayLabel(hour24);

  return [
    `Current user-local time: ${weekday}, ${month} ${day}, ${year}, ${hour}:${minute} ${dayPeriod} (${normalized}).`,
    `Time of day: ${label}.`,
    `If you greet the user, match this time of day — do NOT say "good morning" in the afternoon/evening/night.`,
  ].join(' ');
}
