import { useCallback, useEffect, useMemo, useState } from "react";
import WebApp from "@twa-dev/sdk";
import axios from "axios";
import ChatArea from "./components/ChatArea";
import Sidebar from "./components/Sidebar";
import { SOLVE_API_URL } from "./config/api";
import {
  appendMessagesToChat,
  createPendingChat,
  deleteChatEntry,
  finalizeAssistantMessage,
  isChatLimitReached,
  loadActiveChatId,
  loadHistory,
  saveActiveChatId,
} from "./utils/historyStorage";

function revokePreviewUrl(url) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export default function App() {
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

  const userName = useMemo(() => {
    try {
      return WebApp.initDataUnsafe?.user?.first_name || "Вы";
    } catch {
      return "Вы";
    }
  }, []);

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
    WebApp.ready();
    WebApp.expand();
    document.documentElement.classList.add("dark");

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
  }, []);

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

    if (activeEntry && isChatLimitReached(activeEntry)) {
      return;
    }

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
      const { data } = await axios.post(SOLVE_API_URL, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      finalizeAssistantMessage(chatId, {
        answer: data.answer || "",
        imageUrl: data.image_url || localPreview || null,
        status: "done",
      });
      syncHistory();
    } catch (err) {
      let message;
      if (err.code === "ERR_NETWORK" || !err.response) {
        message =
          "Network Error: не удалось связаться с сервером. " +
          `Проверьте VITE_API_URL (${SOLVE_API_URL}) и CORS на Render.`;
      } else {
        message =
          err.response?.data?.error ||
          err.message ||
          "Не удалось получить ответ от сервера.";
      }

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
    return <div className="flex h-screen items-center justify-center bg-[#131314] text-slate-500">Загрузка…</div>;
  }

  return (
    <div className="flex h-full min-h-screen overflow-hidden bg-[#131314]">
      <Sidebar
        history={history}
        activeId={activeId}
        onSelect={handleSelectHistory}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <ChatArea
        userName={userName}
        messages={activeEntry?.messages ?? []}
        chatStatus={activeEntry?.status ?? null}
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
