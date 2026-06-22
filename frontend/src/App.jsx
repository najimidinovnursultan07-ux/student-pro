import { useEffect, useState } from "react";
import { telegramAuthRequest, parseApiError } from "./api/client";
import { saveAuth, clearAuth } from "./utils/authStorage";
import {
  getTelegramUserFromWindow,
  getTelegramUserWithRetry,
  initTelegramWebApp,
  waitForTelegramWebApp,
} from "./utils/telegramWebApp";
import ChatApp from "./components/ChatApp";
import TelegramGate from "./components/TelegramGate";

export default function App() {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gateMessage, setGateMessage] = useState("");

  useEffect(() => {
    document.documentElement.classList.add("dark");

    let cancelled = false;

    async function bootstrap() {
      try {
        const webApp = await waitForTelegramWebApp();
        initTelegramWebApp(webApp);

        const tgUser = webApp ? await getTelegramUserWithRetry(webApp) : null;

        if (!tgUser?.id) {
          if (!cancelled) {
            setGateMessage("");
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
          setGateMessage("");
        }
      } catch (err) {
        console.error("[AI Student PRO] Bootstrap failed:", err);
        if (!cancelled) {
          setGateMessage(
            parseApiError(err, "telegram") ||
              "Не удалось авторизоваться. Перезапустите мини-приложение через бота."
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
    setLoading(true);
    setGateMessage("");
    window.location.reload();
  };

  if (auth?.access) {
    return <ChatApp user={auth.user} onLogout={handleLogout} />;
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0e0e11]">
        <p className="text-sm text-gray-400">Подключение к Telegram…</p>
      </div>
    );
  }

  let telegramUser = null;
  try {
    telegramUser = getTelegramUserFromWindow();
  } catch {
    telegramUser = null;
  }

  if (!telegramUser?.id) {
    return <TelegramGate message={gateMessage} />;
  }

  if (!auth?.access) {
    return (
      <TelegramGate
        message={
          gateMessage ||
          "Не удалось завершить авторизацию. Перезапустите мини-приложение через бота."
        }
      />
    );
  }

  return <ChatApp user={auth.user} onLogout={handleLogout} />;
}
