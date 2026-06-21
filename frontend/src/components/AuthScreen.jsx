import { useState } from "react";
import { SparkleIcon } from "./Icons";
import { loginRequest, registerRequest } from "../api/client";
import { saveAuth, getUserIdFromToken } from "../utils/authStorage";

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data =
        mode === "login"
          ? await loginRequest(username.trim(), password)
          : await registerRequest(username.trim(), password, email.trim());

      const userId = data.user?.id ?? getUserIdFromToken(data.access);
      const auth = {
        access: data.access,
        refresh: data.refresh,
        user: data.user || { id: userId, username: username.trim() },
      };

      saveAuth(auth);
      onAuthenticated(auth);
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        Object.values(err.response?.data || {})[0]?.[0] ||
        "Не удалось выполнить вход. Проверьте данные.";
      setError(typeof message === "string" ? message : "Ошибка авторизации.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#131314] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#1e1e24]/90 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
            <SparkleIcon className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold text-white">AI Student PRO</h1>
          <p className="mt-2 text-sm text-slate-500">Интеллектуальное решение учебных задач</p>
        </div>

        <div className="mb-6 flex rounded-xl bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "login" ? "bg-blue-500 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Войти
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "register" ? "bg-blue-500 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Имя пользователя</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              className="w-full rounded-xl border border-white/[0.08] bg-[#131314] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500/50"
              placeholder="student_pro"
            />
          </div>

          {mode === "register" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Email (необязательно)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#131314] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500/50"
                placeholder="you@university.edu"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-white/[0.08] bg-[#131314] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500/50"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-500 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-400 disabled:opacity-50"
          >
            {loading ? "Загрузка…" : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>
      </div>
    </div>
  );
}
