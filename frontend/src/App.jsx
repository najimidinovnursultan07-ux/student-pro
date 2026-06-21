import { useCallback, useEffect, useMemo, useState } from "react";
import WebApp from "@twa-dev/sdk";
import axios from "axios";
import ChatArea from "./components/ChatArea";
import Sidebar from "./components/Sidebar";
import { SOLVE_API_URL } from "./config/api";
import {
  createPendingChat,
  loadHistory,
  updateChatEntry,
} from "./utils/historyStorage";

function revokePreviewUrl(url) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export default function App() {
  const [history, setHistory] = useState(() => loadHistory());
  const [activeId, setActiveId] = useState(null);
  const [task, setTask] = useState("");
  const [attachedImage, setAttachedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isNewChat, setIsNewChat] = useState(true);

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

  const displayTask = activeEntry?.task ?? "";
  const displayAnswer = activeEntry?.answer ?? "";
  const displayImageUrl = activeEntry?.imageUrl ?? null;
  const chatStatus = activeEntry?.status ?? null;

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    return () => revokePreviewUrl(imagePreview);
  }, [imagePreview]);

  const clearAttachment = useCallback(() => {
    revokePreviewUrl(imagePreview);
    setAttachedImage(null);
    setImagePreview(null);
  }, [imagePreview]);

  const handleNewChat = useCallback(() => {
    setActiveId(null);
    setTask("");
    clearAttachment();
    setError("");
    setIsNewChat(true);
    setSidebarOpen(false);
  }, [clearAttachment]);

  const handleSelectHistory = useCallback(
    (id) => {
      setActiveId(id);
      setTask("");
      clearAttachment();
      setError("");
      setIsNewChat(false);
      setSidebarOpen(false);
    },
    [clearAttachment]
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

    const chatId = crypto.randomUUID();
    const localPreview = imagePreview;

    const pendingEntry = createPendingChat({
      id: chatId,
      task: trimmed,
      imageUrl: localPreview,
    });

    setHistory(loadHistory());
    setActiveId(chatId);
    setIsNewChat(false);
    setLoading(true);
    setError("");

    const submittedTask = trimmed;
    const submittedImage = attachedImage;

    setTask("");
    clearAttachment();

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

      const updated = updateChatEntry(chatId, {
        answer: data.answer || "",
        imageUrl: data.image_url || localPreview || null,
        status: "done",
      });

      setHistory(loadHistory());
      if (updated) setActiveId(updated.id);
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

      updateChatEntry(chatId, { status: "error", answer: "" });
      setHistory(loadHistory());
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-screen overflow-hidden bg-[#131314]">
      <Sidebar
        history={history}
        activeId={activeId}
        onSelect={handleSelectHistory}
        onNewChat={handleNewChat}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <ChatArea
        userName={userName}
        displayTask={displayTask}
        displayAnswer={displayAnswer}
        displayImageUrl={displayImageUrl}
        chatStatus={chatStatus}
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
        onOpenSidebar={() => setSidebarOpen(true)}
      />
    </div>
  );
}
