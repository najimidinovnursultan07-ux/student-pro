const STORAGE_KEY = "ai-student-pro-history";

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistory(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function createHistoryEntry(task, answer) {
  return {
    id: crypto.randomUUID(),
    task,
    answer,
    createdAt: new Date().toISOString(),
  };
}

export function addHistoryEntry(task, answer) {
  const entry = createHistoryEntry(task, answer);
  const items = [entry, ...loadHistory()];
  saveHistory(items);
  return entry;
}
