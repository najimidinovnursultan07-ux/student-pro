import { useEffect, useState } from "react";
import { telegramAuthRequest } from "./api/client";
import { clearAuth, getAuth, saveAuth } from "./utils/authStorage";
import {
  getTelegramUserFromWindow,
  getTelegramUserWithRetry,
  initTelegramWebApp,
  waitForTelegramWebApp,
} from "./utils/telegramWebApp";
import ChatApp from "./components/ChatApp";
import TelegramGate from "./components/TelegramGate";

function mapTelegramUser(tgUser) {
  return {
    id: tgUser.id,
    username: tgUser.username || `tg_${tgUser.id}`,
    first_name: tgUser.first_name || "",
    telegram_id: tgUser.id,
  };
}

export default function App() {
  const initialTgUser = getTelegramUserFromWindow();
  const [tgUser, setTgUser] = useState(initialTgUser);
  const [user, setUser] = useState(() => getAuth()?.user ?? (initialTgUser ? mapTelegramUser(initialTgUser) : null));
  const [scanDone, setScanDone] = useState(Boolean(initialTgUser?.id));

  useEffect(() => {
    document.documentElement.classList.add("dark");

    let cancelled = false;

    async function bootstrap() {
      const webApp = await waitForTelegramWebApp();
      initTelegramWebApp(webApp);

      const resolved = webApp ? await getTelegramUserWithRetry(webApp) : null;
      if (cancelled) return;

      setTgUser(resolved);
      setScanDone(true);

      if (!resolved?.id) return;

      setUser(mapTelegramUser(resolved));

      try {
        const data = await telegramAuthRequest({
          id: resolved.id,
          username: resolved.username || "",
          first_name: resolved.first_name || "",
          last_name: resolved.last_name || "",
        });

        saveAuth({
          access: data.access,
          refresh: data.refresh,
          user: data.user || mapTelegramUser(resolved),
        });

        if (!cancelled) {
          setUser(data.user || mapTelegramUser(resolved));
        }
      } catch (err) {
        console.error("[AI Student PRO] Telegram auth:", err);
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    clearAuth();
    window.location.reload();
  };

  const telegramUser = tgUser ?? getTelegramUserFromWindow();

  if (telegramUser?.id) {
    return <ChatApp user={user ?? mapTelegramUser(telegramUser)} onLogout={handleLogout} />;
  }

  if (!scanDone) {
    return <div className="fixed inset-0 bg-[#0e0e11]" aria-hidden="true" />;
  }

  return <TelegramGate />;
}
