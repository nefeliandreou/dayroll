/** Calendar day key YYYY-MM-DD in local server time (or override via client today). */
export function toDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function compareDays(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function applyRollover(todos, today = toDayKey()) {
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
