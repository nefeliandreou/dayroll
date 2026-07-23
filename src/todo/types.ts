/** Calendar day key as YYYY-MM-DD in local time */
export type DayKey = string;

export type Todo = {
  id: string;
  text: string;
  completed: boolean;
  /** Day the item is scheduled for (moves forward when incomplete) */
  day: DayKey;
  createdAt: string;
  completedAt: string | null;
  /** How many times this item has rolled to a later day */
  rolledCount: number;
};

export type TodoStore = {
  todos: Todo[];
  /** Last local day when rollover was applied */
  lastRolloverDay: DayKey;
};
