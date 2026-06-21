import { useCallback, useEffect, useMemo, useState } from "react";
import WebApp from "@twa-dev/sdk";
import axios from "axios";
import ChatArea from "./components/ChatArea";
import Sidebar from "./components/Sidebar";
import { SOLVE_API_URL } from "./config/api";
import { addHistoryEntry, loadHistory } from "./utils/historyStorage";

export default function App() {
  const [history, setHistory] = useState(() => loadHistory());
  const [activeId, setActiveId] = useState(null);
  const [task, setTask] = useState("");
  const [liveTask, setLiveTask] = useState("");
  const [liveAnswer, setLiveAnswer] = useState("");
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

  const displayTask = activeEntry?.task ?? liveTask;
  const displayAnswer = activeEntry?.answer ?? liveAnswer;

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
    document.documentElement.classList.add("dark");
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveId(null);
    setTask("");
    setLiveTask("");
    setLiveAnswer("");
    setError("");
    setIsNewChat(true);
    setSidebarOpen(false);
  }, []);

  const handleSelectHistory = useCallback((id) => {
    setActiveId(id);
    setLiveTask("");
    setLiveAnswer("");
    setError("");
    setTask("");
    setIsNewChat(false);
    setSidebarOpen(false);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = task.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError("");
    setLiveTask(trimmed);
    setLiveAnswer("");
    setActiveId(null);
    setIsNewChat(false);

    try {
      const { data } = await axios.post(SOLVE_API_URL, { task: trimmed });
      const answer = data.answer || "";
      setLiveAnswer(answer);

      const entry = addHistoryEntry(trimmed, answer);
      setHistory(loadHistory());
      setActiveId(entry.id);
      setTask("");
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
        task={task}
        onTaskChange={setTask}
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
        isNewChat={isNewChat}
        onOpenSidebar={() => setSidebarOpen(true)}
      />
    </div>
  );
}
