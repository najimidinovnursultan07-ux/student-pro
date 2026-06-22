const POLL_MS = 150;
const MAX_ATTEMPTS = 20;

/**
 * Ждёт появления window.Telegram.WebApp (Telegram Desktop подгружает SDK с задержкой).
 */
export function waitForTelegramWebApp() {
  return new Promise((resolve) => {
    let attempts = 0;

    const check = () => {
      const webApp = window.Telegram?.WebApp;
      if (webApp) {
        resolve(webApp);
        return;
      }

      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) {
        resolve(null);
        return;
      }

      setTimeout(check, POLL_MS);
    };

    check();
  });
}

export function initTelegramWebApp(webApp) {
  if (!webApp) return;

  try {
    webApp.ready();
  } catch (err) {
    console.warn("[Telegram] WebApp.ready() failed:", err);
  }

  try {
    webApp.expand();
  } catch (err) {
    console.warn("[Telegram] WebApp.expand() failed:", err);
  }

  try {
    webApp.setHeaderColor?.("#131314");
    webApp.setBackgroundColor?.("#131314");
  } catch {
    // optional API
  }
}

export function getTelegramUserFromWindow() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
  } catch (err) {
    console.warn("[Telegram] initDataUnsafe read failed:", err);
    return null;
  }
}

export function getTelegramUserSafe(webApp) {
  try {
    return webApp?.initDataUnsafe?.user ?? null;
  } catch (err) {
    console.warn("[Telegram] initDataUnsafe read failed:", err);
    return null;
  }
}

/**
 * Повторно читает пользователя после ready() — на Desktop данные иногда приходят с задержкой.
 */
export async function getTelegramUserWithRetry(webApp) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const user = getTelegramUserSafe(webApp);
    if (user?.id) {
      return user;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return null;
}
