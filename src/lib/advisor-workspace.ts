// Advisor-private workspace: notes & tasks per client.
// Stored in localStorage — never visible to the family/owner side.
// Mirrors the demo-data pattern used elsewhere in the app.

const NOTES_KEY = "ll.advisor.notes.v1";
const TASKS_KEY = "ll.advisor.tasks.v1";

export type AdvisorNote = {
  id: string;
  clientId: string;
  body: string;
  createdAt: string;
};

export type AdvisorTask = {
  id: string;
  clientId: string;
  title: string;
  due?: string; // ISO
  done: boolean;
  createdAt: string;
};

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const listeners = new Set<() => void>();
export function subscribeWorkspace(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => fn());
}

// ── Notes ────────────────────────────────────────────────
export function getNotes(clientId?: string): AdvisorNote[] {
  const all = readJSON<AdvisorNote[]>(NOTES_KEY, []);
  return clientId ? all.filter((n) => n.clientId === clientId) : all;
}

export function addNote(clientId: string, body: string): AdvisorNote {
  const all = readJSON<AdvisorNote[]>(NOTES_KEY, []);
  const note: AdvisorNote = {
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    clientId,
    body,
    createdAt: new Date().toISOString(),
  };
  writeJSON(NOTES_KEY, [note, ...all]);
  notify();
  return note;
}

export function deleteNote(id: string) {
  const all = readJSON<AdvisorNote[]>(NOTES_KEY, []);
  writeJSON(
    NOTES_KEY,
    all.filter((n) => n.id !== id),
  );
  notify();
}

// ── Tasks ────────────────────────────────────────────────
export function getTasks(clientId?: string): AdvisorTask[] {
  const all = readJSON<AdvisorTask[]>(TASKS_KEY, []);
  return clientId ? all.filter((t) => t.clientId === clientId) : all;
}

export function addTask(input: { clientId: string; title: string; due?: string }): AdvisorTask {
  const all = readJSON<AdvisorTask[]>(TASKS_KEY, []);
  const task: AdvisorTask = {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    clientId: input.clientId,
    title: input.title,
    due: input.due,
    done: false,
    createdAt: new Date().toISOString(),
  };
  writeJSON(TASKS_KEY, [task, ...all]);
  notify();
  return task;
}

export function toggleTask(id: string) {
  const all = readJSON<AdvisorTask[]>(TASKS_KEY, []);
  writeJSON(
    TASKS_KEY,
    all.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
  );
  notify();
}

export function deleteTask(id: string) {
  const all = readJSON<AdvisorTask[]>(TASKS_KEY, []);
  writeJSON(
    TASKS_KEY,
    all.filter((t) => t.id !== id),
  );
  notify();
}
