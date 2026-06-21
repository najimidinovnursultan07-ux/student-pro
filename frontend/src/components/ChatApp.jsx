import { useCallback, useEffect, useMemo, useState } from "react";
import { solveRequest } from "../api/client";
import {
  appendMessagesToChat,
  createPendingChat,
  deleteChatEntry,
  finalizeAssistantMessage,
  isChatLimitReached,
  loadActiveChatId,
  loadHistory,
  saveActiveChatId,
  setHistoryUser,
} from "../utils/historyStorage";
import ChatArea from "./ChatArea";
import Sidebar from "./Sidebar";

function revokePreviewUrl(url) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export default function ChatApp({ user, onLogout }) {
  const [history, setHistory] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [task, setTask] = useState("");
  const [attachedImage, setAttachedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isNewChat, setIsNewChat] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const userName = user?.username || "Вы";

  const activeEntry = useMemo(
    () => history.find((item) => item.id === activeId) ?? null,
    [history, activeId]
  );

  const messageLimitReached = useMemo(
    () => Boolean(activeEntry && isChatLimitReached(activeEntry)),
    [activeEntry]
  );

  const syncHistory = useCallback(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    setHistoryUser(user?.id);
    const chats = loadHistory();
    setHistory(chats);

    const savedActiveId = loadActiveChatId();
    const savedChat = chats.find((chat) => chat.id === savedActiveId);

    if (savedChat) {
      setActiveId(savedChat.id);
      setIsNewChat(false);
    } else {
      setIsNewChat(true);
      saveActiveChatId(null);
    }

    setHydrated(true);
  }, [user?.id]);

  useEffect(() => {
    if (!hydrated) return;
    saveActiveChatId(activeId);
  }, [activeId, hydrated]);

  useEffect(() => {
    return () => revokePreviewUrl(imagePreview);
  }, [imagePreview]);

  const clearAttachment = useCallback(() => {
    revokePreviewUrl(imagePreview);
    setAttachedImage(null);
    setImagePreview(null);
  }, [imagePreview]);

  const resetToNewChat = useCallback(() => {
    setActiveId(null);
    setTask("");
    clearAttachment();
    setError("");
    setIsNewChat(true);
    saveActiveChatId(null);
  }, [clearAttachment]);

  const handleNewChat = useCallback(() => {
    resetToNewChat();
    setSidebarOpen(false);
  }, [resetToNewChat]);

  const handleStudentSection = useCallback(
    (prompt) => {
      resetToNewChat();
      setTask(prompt);
      setSidebarOpen(false);
    },
    [resetToNewChat]
  );

  const handleSelectHistory = useCallback(
    (id) => {
      setActiveId(id);
      setTask("");
      clearAttachment();
      setError("");
      setIsNewChat(false);
      saveActiveChatId(id);
      setSidebarOpen(false);
    },
    [clearAttachment]
  );

  const handleDeleteChat = useCallback(
    (chatId) => {
      const updated = deleteChatEntry(chatId);
      setHistory(updated);
      if (activeId === chatId) {
        resetToNewChat();
      }
    },
    [activeId, resetToNewChat]
  );

  const handleImageSelect = useCallback(
    (file) => {
      revokePreviewUrl(imagePreview);
      setAttachedImage(file);
      setImagePreview(URL.createObjectURL(file));
    },
    [imagePreview]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = task.trim();
    if ((!trimmed && !attachedImage) || loading) return;
    if (activeEntry && isChatLimitReached(activeEntry)) return;

    const localPreview = imagePreview;
    const submittedTask = trimmed;
    const submittedImage = attachedImage;

    setTask("");
    clearAttachment();
    setError("");
    setLoading(true);
    setIsNewChat(false);

    let chatId = activeId;

    if (!chatId) {
      chatId = crypto.randomUUID();
      createPendingChat({
        id: chatId,
        task: submittedTask,
        imageUrl: localPreview,
      });
    } else {
      const userMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: submittedTask,
        imageUrl: localPreview,
        createdAt: new Date().toISOString(),
      };
      const assistantPlaceholder = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "",
        createdAt: new Date().toISOString(),
        status: "pending",
      };

      const updated = appendMessagesToChat(chatId, [userMessage, assistantPlaceholder]);
      if (!updated) {
        setLoading(false);
        setError("Достигнут лимит в 100 сообщений. Пожалуйста, откройте «+ Новый чат».");
        return;
      }
    }

    syncHistory();
    setActiveId(chatId);
    saveActiveChatId(chatId);

    const formData = new FormData();
    formData.append("text", submittedTask);
    formData.append("chat_id", chatId);
    if (submittedImage) {
      formData.append("image", submittedImage);
    }

    try {
      const data = await solveRequest(formData);

      finalizeAssistantMessage(chatId, {
        answer: data.answer || "",
        imageUrl: data.image_url || localPreview || null,
        status: "done",
      });
      syncHistory();
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.message ||
        "Не удалось получить ответ от сервера.";

      finalizeAssistantMessage(chatId, {
        answer: "",
        imageUrl: localPreview || null,
        status: "error",
      });
      syncHistory();
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#131314] text-slate-500">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen overflow-hidden bg-[#131314]">
      <Sidebar
        history={history}
        activeId={activeId}
        onSelect={handleSelectHistory}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onStudentSection={handleStudentSection}
        onLogout={onLogout}
        username={userName}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <ChatArea
        userName={userName}
        messages={activeEntry?.messages ?? []}
        task={task}
        onTaskChange={setTask}
        attachedImage={attachedImage}
        imagePreview={imagePreview}
        onImageSelect={handleImageSelect}
        onImageRemove={clearAttachment}
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
        isNewChat={isNewChat}
        messageLimitReached={messageLimitReached}
        onOpenSidebar={() => setSidebarOpen(true)}
      />
    </div>
  );
}
