import { compareDays, toDayKey } from './dates';
import type { DayKey, Todo } from './types';

/**
 * Incomplete todos scheduled before `today` move onto `today`.
 * Completed items stay on the day they were finished.
 */
export function applyRollover(todos: Todo[], today: DayKey = toDayKey()): Todo[] {
  return todos.map((todo) => {
    if (todo.completed) return todo;
    if (compareDays(todo.day, today) >= 0) return todo;
    return {
      ...todo,
      day: today,
      rolledCount: todo.rolledCount + 1,
    };
  });
}
