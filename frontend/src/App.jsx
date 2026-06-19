import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "./App.css";
import { SOLVE_API_URL } from "./config/api";

function Spinner() {
  return (
    <div className="spinner-wrap" role="status" aria-label="Загрузка">
      <div className="spinner" />
      <p>Решаю задачу…</p>
    </div>
  );
}

export default function App() {
  const [task, setTask] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
    document.documentElement.style.setProperty(
      "--tg-theme-bg-color",
      WebApp.themeParams.bg_color || "#ffffff"
    );
    document.documentElement.style.setProperty(
      "--tg-theme-text-color",
      WebApp.themeParams.text_color || "#000000"
    );
    document.documentElement.style.setProperty(
      "--tg-theme-button-color",
      WebApp.themeParams.button_color || "#2481cc"
    );
    document.documentElement.style.setProperty(
      "--tg-theme-button-text-color",
      WebApp.themeParams.button_text_color || "#ffffff"
    );
    document.documentElement.style.setProperty(
      "--tg-theme-hint-color",
      WebApp.themeParams.hint_color || "#999999"
    );
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = task.trim();
    if (!trimmed) {
      setError("Введите текст задачи.");
      return;
    }

    setLoading(true);
    setError("");
    setAnswer("");

    try {
      const { data } = await axios.post(SOLVE_API_URL, { task: trimmed });
      setAnswer(data.answer || "");
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.message ||
        "Не удалось получить ответ от сервера.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>AI Student PRO</h1>
        <p className="subtitle">Решение учебных задач с Gemini</p>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <label htmlFor="task">Задача</label>
        <textarea
          id="task"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Введите условие задачи…"
          rows={6}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !task.trim()}>
          Решить
        </button>
      </form>

      {loading && <Spinner />}

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {answer && !loading && (
        <section className="answer">
          <h2>Решение</h2>
          <div className="markdown">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {answer}
            </ReactMarkdown>
          </div>
        </section>
      )}
    </div>
  );
}
