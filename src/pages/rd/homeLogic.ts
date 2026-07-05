const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // JS getDay(): 0=Sun
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun

export function greeting(date: Date): { dateLabel: string; timeOfDay: 'morning' | 'afternoon' | 'evening' } {
  const h = date.getHours();
  const timeOfDay = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return { dateLabel, timeOfDay };
}

export function weekDots(
  streak: { last_session_date?: string; current_streak?: number } | null,
  today: Date,
): Array<{ day: string; state: 'filled' | 'empty' | 'today' }> {
  const todayDow = today.getDay();
  const streakLen = streak?.current_streak || 0;
  // Days (from today backwards) that are part of the current streak.
  const filledDates = new Set<string>();
  for (let i = 0; i < streakLen; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    filledDates.add(d.toISOString().slice(0, 10));
  }
  return WEEK_ORDER.map((dow) => {
    // Find the date in the current week (Mon..Sun) for this weekday.
    const delta = dow - todayDow;
    const d = new Date(today);
    d.setDate(today.getDate() + delta);
    const iso = d.toISOString().slice(0, 10);
    const isToday = dow === todayDow;
    let state: 'filled' | 'empty' | 'today' = 'empty';
    if (isToday) state = 'today';
    else if (filledDates.has(iso)) state = 'filled';
    return { day: DAY_LABELS[dow], state };
  });
}
