import { describe, it, expect } from 'vitest';
import { recordingMeta, formatTime } from './libraryLogic';

const NOW = new Date('2026-07-05T20:00:00');

describe('recordingMeta', () => {
  it('labels same-day as Today', () => {
    expect(recordingMeta('2026-07-05T09:00:00', 18, NOW)).toBe('Today · 18 min');
  });
  it('labels previous day as Yesterday', () => {
    expect(recordingMeta('2026-07-04T22:00:00', 16, NOW)).toBe('Yesterday · 16 min');
  });
  it('uses a short date for older recordings', () => {
    expect(recordingMeta('2026-06-30T10:00:00', 21, NOW)).toBe('Jun 30 · 21 min');
  });
  it('omits the minutes clause when estimatedMinutes is falsy', () => {
    expect(recordingMeta('2026-07-05T09:00:00', 0, NOW)).toBe('Today');
    expect(recordingMeta('2026-07-05T09:00:00', NaN, NOW)).toBe('Today');
  });
  it('rounds fractional minutes', () => {
    expect(recordingMeta('2026-07-05T09:00:00', 17.6, NOW)).toBe('Today · 18 min');
  });
});

describe('formatTime', () => {
  it('formats zero and sub-10-second values with a leading zero', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5)).toBe('0:05');
  });
  it('formats minutes and seconds', () => {
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(600)).toBe('10:00');
  });
  it('floors fractional seconds', () => {
    expect(formatTime(65.9)).toBe('1:05');
  });
  it('clamps NaN and negatives to 0:00', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
  });
});
