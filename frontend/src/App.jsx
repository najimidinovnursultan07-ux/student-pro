import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { telegramAuthRequest, parseApiError } from "./api/client";
import { saveAuth, clearAuth } from "./utils/authStorage";
import ChatApp from "./components/ChatApp";
import { SparkleIcon } from "./components/Icons";

function getTelegramUser() {
  return (
    WebApp.initDataUnsafe?.user ||
    window.Telegram?.WebApp?.initDataUnsafe?.user ||
    null
  );
}

export default function App() {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
    document.documentElement.classList.add("dark");

    let cancelled = false;

    async function authenticate() {
      const tgUser = getTelegramUser();

      if (!tgUser?.id) {
        if (!cancelled) {
          setError("Откройте приложение через Telegram — данные пользователя недоступны.");
          setLoading(false);
        }
        return;
      }

      try {
        const data = await telegramAuthRequest({
          id: tgUser.id,
          username: tgUser.username || "",
          first_name: tgUser.first_name || "",
          last_name: tgUser.last_name || "",
        });

        const authPayload = {
          access: data.access,
          refresh: data.refresh,
          user: data.user || {
            id: tgUser.id,
            username: tgUser.username || `tg_${tgUser.id}`,
            first_name: tgUser.first_name || "",
            telegram_id: tgUser.id,
          },
        };

        saveAuth(authPayload);
        if (!cancelled) {
          setAuth(authPayload);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(parseApiError(err, "telegram"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    authenticate();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    clearAuth();
    setAuth(null);
    setLoading(true);
    setError("");
    window.location.reload();
  };

  if (auth?.access) {
    return <ChatApp user={auth.user} onLogout={handleLogout} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#131314] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#1e1e24]/90 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
          <SparkleIcon className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-semibold text-white">AI Student PRO</h1>

        {loading && (
          <p className="mt-6 text-sm text-slate-400">Вход через Telegram…</p>
        )}

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-400/60 bg-red-950/90 px-4 py-3 text-left text-sm font-medium leading-relaxed text-red-50"
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
