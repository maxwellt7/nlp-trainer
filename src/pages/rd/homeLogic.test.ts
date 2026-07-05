import { describe, it, expect } from 'vitest';
import { greeting, weekDots } from './homeLogic';

describe('greeting', () => {
  it('labels the date and picks morning/afternoon/evening', () => {
    const g = greeting(new Date('2026-07-04T09:00:00'));
    expect(g.timeOfDay).toBe('morning');
    expect(g.dateLabel.toUpperCase()).toContain('JULY');
    expect(greeting(new Date('2026-07-04T15:00:00')).timeOfDay).toBe('afternoon');
    expect(greeting(new Date('2026-07-04T20:00:00')).timeOfDay).toBe('evening');
  });
});

describe('weekDots', () => {
  it('returns 7 days Mon..Sun with today marked', () => {
    const dots = weekDots({ current_streak: 4, last_session_date: '2026-07-04' }, new Date('2026-07-04T12:00:00'));
    expect(dots).toHaveLength(7);
    expect(dots.map(d => d.day)).toEqual(['M','T','W','T','F','S','S']);
    // 2026-07-04 is a Saturday -> index 5 is "today"
    expect(dots[5].state).toBe('today');
  });
  it('handles no streak', () => {
    const dots = weekDots(null, new Date('2026-07-04T12:00:00'));
    expect(dots).toHaveLength(7);
    expect(dots.every(d => d.state !== 'filled')).toBe(true);
  });
  it('maps the current week correctly when today is Sunday (regression)', () => {
    // 2026-07-05 is a Sunday; streak of 3 covers Sun 07-05, Sat 07-04, Fri 07-03.
    const dots = weekDots({ current_streak: 3, last_session_date: '2026-07-05' }, new Date('2026-07-05T12:00:00'));
    expect(dots).toHaveLength(7);
    expect(dots[6].state).toBe('today');   // Sunday slot
    expect(dots[5].state).toBe('filled');  // Saturday 07-04
    expect(dots[4].state).toBe('filled');  // Friday 07-03
    expect(dots[0].state).toBe('empty');   // Monday
  });
});
