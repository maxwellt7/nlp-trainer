export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayLabel(createdAt: string, now: Date): string {
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return '';
  if (sameDay(d, now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function recordingMeta(createdAt: string, estimatedMinutes: number, now: Date): string {
  const day = dayLabel(createdAt, now);
  const mins = Number(estimatedMinutes);
  if (!Number.isFinite(mins) || mins <= 0) return day;
  const clause = `${Math.round(mins)} min`;
  return day ? `${day} · ${clause}` : clause;
}
