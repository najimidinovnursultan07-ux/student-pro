const LEGACY_STORAGE_KEY = "ai-student-pro-history";
export const MAX_MESSAGES_PER_CHAT = 100;

let currentUserId = "guest";

export function setHistoryUser(userId) {
  currentUserId = userId ? String(userId) : "guest";
}

function storageKey() {
  return `ai_student_chats_${currentUserId}`;
}

function activeChatKey() {
  return `ai_student_active_chat_${currentUserId}`;
}

export function chatTitle(text, maxWords = 4) {
  const words = (text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "Новый чат";
  const head = words.slice(0, maxWords).join(" ");
  return words.length > maxWords ? `${head}…` : head;
}

function createMessageId() {
  return crypto.randomUUID();
}

function migrateLegacyEntry(entry) {
  if (Array.isArray(entry.messages)) {
    return normalizeChat(entry);
  }

  const createdAt = entry.createdAt || new Date().toISOString();
  const messages = [];

  if (entry.task || entry.imageUrl) {
    messages.push({
      id: createMessageId(),
      role: "user",
      text: entry.task || "",
      imageUrl: entry.imageUrl || null,
      createdAt,
    });
  }

  if (entry.answer || entry.status === "pending" || entry.status === "error") {
    messages.push({
      id: createMessageId(),
      role: "assistant",
      text: entry.answer || "",
      createdAt,
      status: entry.status === "pending" ? "pending" : entry.status === "error" ? "error" : "done",
    });
  }

  return normalizeChat({
    id: entry.id || createMessageId(),
    title: entry.title || chatTitle(entry.task),
    messages,
    createdAt,
    updatedAt: createdAt,
    status: entry.status || "done",
  });
}

function normalizeMessage(message) {
  return {
    id: message.id || createMessageId(),
    role: message.role,
    text: message.text || "",
    imageUrl: message.imageUrl || null,
    createdAt: message.createdAt || new Date().toISOString(),
    status: message.status || "done",
  };
}

function normalizeChat(chat) {
  const messages = (chat.messages || []).map(normalizeMessage);
  const updatedAt = chat.updatedAt || messages.at(-1)?.createdAt || chat.createdAt;

  return {
    id: chat.id,
    title: chat.title || chatTitle(messages.find((m) => m.role === "user")?.text),
    messages,
    createdAt: chat.createdAt || updatedAt || new Date().toISOString(),
    updatedAt: updatedAt || new Date().toISOString(),
    status: chat.status || "done",
  };
}

function readRawStorage() {
  const key = storageKey();
  const raw =
    localStorage.getItem(key) ??
    (currentUserId !== "guest" ? null : localStorage.getItem("ai_student_chats")) ??
    localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadHistory() {
  const items = readRawStorage().map(migrateLegacyEntry);
  if (items.length > 0) {
    saveHistory(items);
  }
  return items;
}

export function saveHistory(items) {
  localStorage.setItem(storageKey(), JSON.stringify(items));
  if (currentUserId === "guest" && localStorage.getItem(LEGACY_STORAGE_KEY)) {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}

export function saveActiveChatId(chatId) {
  if (chatId) {
    localStorage.setItem(activeChatKey(), chatId);
  } else {
    localStorage.removeItem(activeChatKey());
  }
}

export function loadActiveChatId() {
  return localStorage.getItem(activeChatKey());
}

export function countMessages(chat) {
  return chat?.messages?.length ?? 0;
}

export function isChatLimitReached(chat) {
  return countMessages(chat) >= MAX_MESSAGES_PER_CHAT;
}

export function getChatById(id) {
  return loadHistory().find((item) => item.id === id) ?? null;
}

export function createChat({ id, title, messages, status = "pending" }) {
  const now = new Date().toISOString();
  const chat = normalizeChat({
    id: id || createMessageId(),
    title,
    messages,
    createdAt: now,
    updatedAt: now,
    status,
  });
  const items = [chat, ...loadHistory().filter((item) => item.id !== chat.id)];
  saveHistory(items);
  return chat;
}

export function createPendingChat({ id, task, imageUrl = null }) {
  const userMessage = {
    id: createMessageId(),
    role: "user",
    text: task,
    imageUrl,
    createdAt: new Date().toISOString(),
  };

  const assistantPlaceholder = {
    id: createMessageId(),
    role: "assistant",
    text: "",
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  return createChat({
    id,
    title: chatTitle(task) || (imageUrl ? "Задача с фото" : "Новый чат"),
    messages: [userMessage, assistantPlaceholder],
    status: "pending",
  });
}

export function appendMessagesToChat(chatId, newMessages) {
  const chat = getChatById(chatId);
  if (!chat) return null;

  const merged = [...chat.messages, ...newMessages.map(normalizeMessage)];
  if (merged.length > MAX_MESSAGES_PER_CHAT) {
    return null;
  }

  return updateChatEntry(chatId, {
    messages: merged,
    updatedAt: new Date().toISOString(),
    status: "pending",
  });
}

export function updateChatEntry(id, updates) {
  const items = loadHistory().map((item) =>
    item.id === id ? normalizeChat({ ...item, ...updates }) : item
  );
  saveHistory(items);
  return items.find((item) => item.id === id) ?? null;
}

export function deleteChatEntry(id) {
  const items = loadHistory().filter((item) => item.id !== id);
  saveHistory(items);

  if (loadActiveChatId() === id) {
    saveActiveChatId(null);
  }

  return items;
}

export function finalizeAssistantMessage(chatId, { answer, imageUrl, status = "done" }) {
  const chat = getChatById(chatId);
  if (!chat) return null;

  const messages = chat.messages.map((message, index, array) => {
    const isLastAssistant =
      message.role === "assistant" && index === array.length - 1 && message.status === "pending";

    if (isLastAssistant) {
      return normalizeMessage({
        ...message,
        text: answer,
        status,
      });
    }
    return message;
  });

  const userMessages = messages.filter((m) => m.role === "user");
  const lastUser = userMessages.at(-1);

  return updateChatEntry(chatId, {
    messages: messages.map((message) => {
      if (message.id === lastUser?.id && imageUrl) {
        return { ...message, imageUrl };
      }
      return message;
    }),
    status,
    updatedAt: new Date().toISOString(),
  });
}
