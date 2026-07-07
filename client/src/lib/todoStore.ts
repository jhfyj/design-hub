import { useCallback, useEffect, useState } from "react";

export interface TodoTask {
  id: number;
  text: string;
  duration: string;
  completed: boolean;
  completedAt?: number;
  remainingSeconds: number;
  running: boolean;
  startedAt?: number;
}

export interface TodoList {
  id: number;
  name: string;
  tasks: TodoTask[];
}

const STORAGE_KEY = "dh_todo_lists";

function nextId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

function parseDurationToSeconds(duration: string): number {
  const minutes = parseInt(duration, 10);
  return (Number.isFinite(minutes) ? minutes : 15) * 60;
}

export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Live remaining time for a task — computed from the persisted baseline plus
// elapsed wall-clock time since it was last started, so it stays correct even
// if the tab was backgrounded or the page reloaded mid-run.
export function liveRemainingSeconds(task: TodoTask): number {
  if (!task.running || !task.startedAt) return task.remainingSeconds;
  const elapsed = Math.floor((Date.now() - task.startedAt) / 1000);
  return Math.max(0, task.remainingSeconds - elapsed);
}

function normalizeTask(t: Partial<TodoTask> & { text: string }): TodoTask {
  return {
    id: t.id ?? nextId(),
    text: t.text,
    duration: t.duration ?? "15 min",
    completed: t.completed ?? false,
    completedAt: t.completedAt,
    remainingSeconds: t.remainingSeconds ?? parseDurationToSeconds(t.duration ?? "15 min"),
    running: t.running ?? false,
    startedAt: t.startedAt,
  };
}

const DEFAULT_LISTS: TodoList[] = [
  {
    id: 1,
    name: "To do 1",
    tasks: [
      normalizeTask({ id: 1, text: "Do portfolio", duration: "15 min", completed: false }),
      normalizeTask({ id: 2, text: "Update resume", duration: "30 min", completed: false }),
      normalizeTask({ id: 3, text: "Review job board", duration: "15 min", completed: false }),
      normalizeTask({ id: 4, text: "Do portfolio", duration: "15 min", completed: true, completedAt: Date.now() - 1000 }),
      normalizeTask({ id: 5, text: "Do portfolio", duration: "15 min", completed: true, completedAt: Date.now() - 2000 }),
      normalizeTask({ id: 6, text: "Do portfolio", duration: "15 min", completed: true, completedAt: Date.now() - 3000 }),
    ],
  },
];

function load(): TodoList[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LISTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_LISTS;
    return parsed.map((l: TodoList) => ({ ...l, tasks: l.tasks.map(normalizeTask) }));
  } catch {
    return DEFAULT_LISTS;
  }
}

function save(lists: TodoList[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch {
    // ignore write failures (e.g. storage disabled)
  }
}

// Keep only the 3 most recently completed tasks per list — older completed
// tasks are dropped permanently rather than archived anywhere.
function pruneCompleted(tasks: TodoTask[]): TodoTask[] {
  const completed = tasks
    .filter(t => t.completed)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const keepIds = new Set(completed.slice(0, 3).map(t => t.id));
  return tasks.filter(t => !t.completed || keepIds.has(t.id));
}

export function useTodoStore() {
  const [lists, setLists] = useState<TodoList[]>(() => load());

  const update = useCallback((fn: (prev: TodoList[]) => TodoList[]) => {
    setLists(prev => {
      const next = fn(prev);
      save(next);
      return next;
    });
  }, []);

  const addList = useCallback(() => {
    update(prev => [...prev, { id: nextId(), name: `To do ${prev.length + 1}`, tasks: [] }]);
  }, [update]);

  const renameList = useCallback((listId: number, name: string) => {
    update(prev => prev.map(l => (l.id === listId ? { ...l, name } : l)));
  }, [update]);

  const deleteList = useCallback((listId: number) => {
    update(prev => prev.filter(l => l.id !== listId));
  }, [update]);

  const addTask = useCallback((listId: number, text: string) => {
    update(prev => prev.map(l =>
      l.id === listId
        ? { ...l, tasks: [...l.tasks, normalizeTask({ text })] }
        : l
    ));
  }, [update]);

  const toggleTask = useCallback((listId: number, taskId: number) => {
    update(prev => prev.map(l => {
      if (l.id !== listId) return l;
      const tasks = l.tasks.map(t => {
        if (t.id !== taskId) return t;
        const completed = !t.completed;
        // Completing a task stops its timer where it stands.
        return {
          ...t,
          completed,
          completedAt: completed ? Date.now() : undefined,
          remainingSeconds: liveRemainingSeconds(t),
          running: false,
          startedAt: undefined,
        };
      });
      return { ...l, tasks: pruneCompleted(tasks) };
    }));
  }, [update]);

  const startTimer = useCallback((listId: number, taskId: number) => {
    update(prev => prev.map(l =>
      l.id !== listId ? l : {
        ...l,
        tasks: l.tasks.map(t => (t.id === taskId ? { ...t, running: true, startedAt: Date.now() } : t)),
      }
    ));
  }, [update]);

  const pauseTimer = useCallback((listId: number, taskId: number) => {
    update(prev => prev.map(l =>
      l.id !== listId ? l : {
        ...l,
        tasks: l.tasks.map(t =>
          t.id === taskId ? { ...t, running: false, startedAt: undefined, remainingSeconds: liveRemainingSeconds(t) } : t
        ),
      }
    ));
  }, [update]);

  const setCustomMinutes = useCallback((listId: number, taskId: number, minutes: number) => {
    update(prev => prev.map(l =>
      l.id !== listId ? l : {
        ...l,
        tasks: l.tasks.map(t =>
          t.id === taskId
            ? { ...t, duration: `${minutes} min`, remainingSeconds: minutes * 60, running: false, startedAt: undefined }
            : t
        ),
      }
    ));
  }, [update]);

  const INTERVAL_SECONDS = 15 * 60;

  const bumpByInterval = useCallback((listId: number, taskId: number) => {
    update(prev => prev.map(l =>
      l.id !== listId ? l : {
        ...l,
        tasks: l.tasks.map(t => {
          if (t.id !== taskId) return t;
          // Snap up to the next 15-minute mark (15, 30, 45, ...) rather than
          // just adding 15 minutes to whatever odd value is left.
          const current = liveRemainingSeconds(t);
          const next = (Math.floor(current / INTERVAL_SECONDS) + 1) * INTERVAL_SECONDS;
          return t.running ? { ...t, remainingSeconds: next, startedAt: Date.now() } : { ...t, remainingSeconds: next };
        }),
      }
    ));
  }, [update]);

  // Drag-to-reorder only touches the active (incomplete) tasks — completed
  // tasks stay pinned under Recents in their existing relative order.
  const reorderTasks = useCallback((listId: number, orderedActiveIds: number[]) => {
    update(prev => prev.map(l => {
      if (l.id !== listId) return l;
      const byId = new Map(l.tasks.map(t => [t.id, t] as const));
      const reorderedActive = orderedActiveIds.map(id => byId.get(id)).filter((t): t is TodoTask => !!t);
      const completed = l.tasks.filter(t => t.completed);
      return { ...l, tasks: [...reorderedActive, ...completed] };
    }));
  }, [update]);

  // Re-render every second while any timer is running so countdowns tick live.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const anyRunning = lists.some(l => l.tasks.some(t => t.running));
    if (!anyRunning) return;
    const id = setInterval(() => forceTick(v => v + 1), 1000);
    return () => clearInterval(id);
  }, [lists]);

  return { lists, addList, renameList, deleteList, addTask, toggleTask, startTimer, pauseTimer, setCustomMinutes, bumpByInterval, reorderTasks };
}
