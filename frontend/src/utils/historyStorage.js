const STORAGE_KEY = "ai-student-pro-history";

export function chatTitle(text, maxWords = 4) {
  const words = (text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "Новый чат";
  const head = words.slice(0, maxWords).join(" ");
  return words.length > maxWords ? `${head}…` : head;
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEntry);
  } catch {
    return [];
  }
}

function normalizeEntry(entry) {
  return {
    id: entry.id,
    title: entry.title || chatTitle(entry.task),
    task: entry.task || "",
    answer: entry.answer || "",
    imageUrl: entry.imageUrl || null,
    status: entry.status || "done",
    createdAt: entry.createdAt || new Date().toISOString(),
  };
}

export function saveHistory(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function createPendingChat({ id, task, imageUrl = null }) {
  const entry = {
    id,
    title: chatTitle(task) || (imageUrl ? "Задача с фото" : "Новый чат"),
    task,
    answer: "",
    imageUrl,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  const items = [entry, ...loadHistory().filter((item) => item.id !== id)];
  saveHistory(items);
  return entry;
}

export function updateChatEntry(id, updates) {
  const items = loadHistory().map((item) =>
    item.id === id ? normalizeEntry({ ...item, ...updates }) : item
  );
  saveHistory(items);
  return items.find((item) => item.id === id) ?? null;
}

export function getChatById(id) {
  return loadHistory().find((item) => item.id === id) ?? null;
}
