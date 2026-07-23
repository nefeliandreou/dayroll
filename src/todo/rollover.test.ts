import { describe, it, expect } from 'vitest';
import { addDays, compareDays, formatDayLabel, toDayKey } from './dates';
import { applyRollover } from './rollover';
import type { Todo } from './types';

function makeTodo(overrides: Partial<Todo> & Pick<Todo, 'day' | 'completed'>): Todo {
  return {
    id: overrides.id ?? '1',
    text: overrides.text ?? 'Task',
    completed: overrides.completed,
    day: overrides.day,
    createdAt: overrides.createdAt ?? '2026-07-20T10:00:00.000Z',
    completedAt: overrides.completedAt ?? null,
    rolledCount: overrides.rolledCount ?? 0,
  };
}

describe('applyRollover', () => {
  it('moves incomplete todos from earlier days to today', () => {
    const today = '2026-07-23';
    const todos = [
      makeTodo({ id: 'a', day: '2026-07-21', completed: false, rolledCount: 0 }),
      makeTodo({ id: 'b', day: '2026-07-22', completed: false, rolledCount: 1 }),
    ];

    const next = applyRollover(todos, today);

    expect(next.every((t) => t.day === today)).toBe(true);
    expect(next.find((t) => t.id === 'a')?.rolledCount).toBe(1);
    expect(next.find((t) => t.id === 'b')?.rolledCount).toBe(2);
  });

  it('does not move completed todos', () => {
    const today = '2026-07-23';
    const todos = [
      makeTodo({
        id: 'done',
        day: '2026-07-21',
        completed: true,
        completedAt: '2026-07-21T18:00:00.000Z',
        rolledCount: 0,
      }),
    ];

    const next = applyRollover(todos, today);
    expect(next[0].day).toBe('2026-07-21');
    expect(next[0].rolledCount).toBe(0);
  });

  it('leaves todos already on today or in the future alone', () => {
    const today = '2026-07-23';
    const todos = [
      makeTodo({ id: 'now', day: today, completed: false }),
      makeTodo({ id: 'later', day: '2026-07-24', completed: false }),
    ];

    const next = applyRollover(todos, today);
    expect(next.find((t) => t.id === 'now')?.day).toBe(today);
    expect(next.find((t) => t.id === 'later')?.day).toBe('2026-07-24');
    expect(next.every((t) => t.rolledCount === 0)).toBe(true);
  });

  it('still moves past incomplete todos when called again the same day', () => {
    // Simulates: rollover already ran today, then user added a task on yesterday
    const today = '2026-07-23';
    const todos = [
      makeTodo({ id: 'late-add', day: '2026-07-22', completed: false, rolledCount: 0 }),
      makeTodo({ id: 'already-here', day: today, completed: false, rolledCount: 1 }),
    ];

    const next = applyRollover(todos, today);
    expect(next.find((t) => t.id === 'late-add')?.day).toBe(today);
    expect(next.find((t) => t.id === 'late-add')?.rolledCount).toBe(1);
    expect(next.find((t) => t.id === 'already-here')?.day).toBe(today);
    expect(next.find((t) => t.id === 'already-here')?.rolledCount).toBe(1);
  });
});

describe('dates', () => {
  it('formats today / yesterday / tomorrow labels', () => {
    const today = '2026-07-23';
    expect(formatDayLabel(today, today)).toBe('Today');
    expect(formatDayLabel(addDays(today, -1), today)).toBe('Yesterday');
    expect(formatDayLabel(addDays(today, 1), today)).toBe('Tomorrow');
  });

  it('compares day keys chronologically', () => {
    expect(compareDays('2026-07-22', '2026-07-23')).toBe(-1);
    expect(compareDays('2026-07-23', '2026-07-23')).toBe(0);
    expect(compareDays('2026-07-24', '2026-07-23')).toBe(1);
  });

  it('toDayKey uses local Y-M-D', () => {
    expect(toDayKey(new Date(2026, 6, 23))).toBe('2026-07-23');
  });
});
