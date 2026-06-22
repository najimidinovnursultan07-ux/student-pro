import { useEffect, useState } from "react";
import { telegramAuthRequest, parseApiError } from "./api/client";
import { saveAuth, clearAuth } from "./utils/authStorage";
import {
  GUEST_USER,
  getTelegramUserWithRetry,
  initTelegramWebApp,
  waitForTelegramWebApp,
} from "./utils/telegramWebApp";
import ChatApp from "./components/ChatApp";
import { SparkleIcon } from "./components/Icons";
import TelegramOpenPrompt from "./components/TelegramOpenPrompt";

function WelcomeShell({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#131314] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#1e1e24]/90 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
          <SparkleIcon className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-semibold text-white">AI Student PRO</h1>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(null);
  const [guestMode, setGuestMode] = useState(false);
  const [outsideTelegram, setOutsideTelegram] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    document.documentElement.classList.add("dark");

    let cancelled = false;

    async function bootstrap() {
      try {
        const webApp = await waitForTelegramWebApp();
        initTelegramWebApp(webApp);

        if (!webApp) {
          if (!cancelled) {
            setOutsideTelegram(true);
            setGuestMode(false);
            setLoading(false);
          }
          return;
        }

        const tgUser = await getTelegramUserWithRetry(webApp);

        if (!tgUser?.id) {
          if (!cancelled) {
            setGuestMode(true);
            setError(
              "Не удалось получить профиль Telegram на этом устройстве. Интерфейс открыт в гостевом режиме."
            );
            setLoading(false);
          }
          return;
        }

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
          setGuestMode(false);
          setOutsideTelegram(false);
          setError("");
        }
      } catch (err) {
        console.error("[AI Student PRO] Bootstrap failed:", err);
        if (!cancelled) {
          setGuestMode(true);
          setError(
            parseApiError(err, "telegram") ||
              "Ошибка авторизации. Интерфейс открыт в гостевом режиме."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    clearAuth();
    setAuth(null);
    setGuestMode(false);
    setOutsideTelegram(false);
    setLoading(true);
    setError("");
    window.location.reload();
  };

  if (auth?.access) {
    return <ChatApp user={auth.user} onLogout={handleLogout} />;
  }

  if (guestMode && !loading) {
    return (
      <ChatApp
        user={GUEST_USER}
        isGuest
        guestNotice={error}
        onLogout={() => window.location.reload()}
      />
    );
  }

  if (outsideTelegram && !loading) {
    return (
      <WelcomeShell>
        <TelegramOpenPrompt />
      </WelcomeShell>
    );
  }

  return (
    <WelcomeShell>
      {loading && (
        <p className="mt-6 text-sm text-slate-400">Подключение к Telegram…</p>
      )}

      {error && !loading && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-400/60 bg-red-950/90 px-4 py-3 text-left text-sm font-medium leading-relaxed text-red-50"
        >
          {error}
        </div>
      )}
    </WelcomeShell>
  );
}
