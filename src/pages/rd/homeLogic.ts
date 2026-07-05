export function greeting(date: Date): { dateLabel: string; timeOfDay: 'morning' | 'afternoon' | 'evening' } {
  const h = date.getHours();
  const timeOfDay = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return { dateLabel, timeOfDay };
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function weekDots(
  streak: { last_session_date?: string; current_streak?: number } | null,
  today: Date,
): Array<{ day: string; state: 'filled' | 'empty' | 'today' }> {
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Mon..Sun
  const streakLen = streak?.current_streak || 0;

  // Dates (today going backwards) that are part of the current streak.
  const filled = new Set<string>();
  for (let i = 0; i < streakLen; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    filled.add(isoDay(d));
  }

  // Monday of the week containing `today` (getDay(): 0=Sun..6=Sat).
  const daysSinceMonday = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysSinceMonday);

  const todayIso = isoDay(today);
  return labels.map((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = isoDay(d);
    let state: 'filled' | 'empty' | 'today' = 'empty';
    if (iso === todayIso) state = 'today';
    else if (filled.has(iso)) state = 'filled';
    return { day, state };
  });
}
