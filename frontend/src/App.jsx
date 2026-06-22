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

function isTelegramMiniApp() {
  return Boolean(window.Telegram?.WebApp);
}

function getActiveTelegramUser() {
  return getTelegramUserFromWindow();
}

async function syncAuth(tgUser) {
  const payload = {
    id: tgUser.id,
    username: tgUser.username || "",
    first_name: tgUser.first_name || "",
    last_name: tgUser.last_name || "",
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const data = await telegramAuthRequest(payload);
    if (data?.access) {
      const auth = {
        access: data.access,
        refresh: data.refresh,
        user: data.user || mapTelegramUser(tgUser),
      };
      saveAuth(auth);
      return auth.user;
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }

  return mapTelegramUser(tgUser);
}

export default function App() {
  const initialTgUser = getActiveTelegramUser();
  const [user, setUser] = useState(
    () => getAuth()?.user ?? (initialTgUser ? mapTelegramUser(initialTgUser) : null)
  );

  useEffect(() => {
    document.documentElement.classList.add("dark");

    if (!isTelegramMiniApp() && !initialTgUser?.id) {
      return;
    }

    let cancelled = false;

    (async () => {
      const webApp = await waitForTelegramWebApp();
      initTelegramWebApp(webApp);

      const tgUser = webApp ? await getTelegramUserWithRetry(webApp) : getActiveTelegramUser();
      if (cancelled || !tgUser?.id) return;

      const authedUser = await syncAuth(tgUser);
      if (!cancelled) {
        setUser(authedUser);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialTgUser?.id]);

  const tgUser = getActiveTelegramUser();
  const inMiniApp = isTelegramMiniApp();

  if (inMiniApp || tgUser?.id) {
    const fallbackUser = tgUser
      ? mapTelegramUser(tgUser)
      : { id: 0, username: "user", first_name: "Студент", telegram_id: null };

    return (
      <ChatApp
        user={user ?? fallbackUser}
        onLogout={() => {
          clearAuth();
          window.location.reload();
        }}
      />
    );
  }

  return <TelegramGate />;
}
