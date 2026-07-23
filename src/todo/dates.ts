import type { DayKey } from './types';

/** Local calendar day as YYYY-MM-DD. */
export function toDayKey(date: Date = new Date()): DayKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a DayKey into a local Date at midnight. */
export function fromDayKey(day: DayKey): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: DayKey, delta: number): DayKey {
  const date = fromDayKey(day);
  date.setDate(date.getDate() + delta);
  return toDayKey(date);
}

export function compareDays(a: DayKey, b: DayKey): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function formatDayLabel(day: DayKey, today: DayKey = toDayKey()): string {
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  if (day === addDays(today, 1)) return 'Tomorrow';
  return fromDayKey(day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}
