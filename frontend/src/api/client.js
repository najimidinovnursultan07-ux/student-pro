import { getApiUrl, isApiConfigured } from "../config/api";
import { clearAuth, getAccessToken } from "../utils/authStorage";

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function createRequestError(response, data, url) {
  const error = new Error("API request failed");
  error.response = { status: response.status, data };
  error.config = { url };
  return error;
}

/**
 * Все запросы идут на полный внешний URL бэкенда через getApiUrl().
 */
async function apiFetch(endpoint, options = {}) {
  const url = getApiUrl(endpoint);
  const headers = new Headers(options.headers || {});

  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await readResponseBody(response);

  if (!response.ok) {
    const isAuthRequest =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/telegram-auth");

    if (response.status === 401 && !isAuthRequest && getAccessToken()) {
      clearAuth();
      window.location.reload();
    }

    throw createRequestError(response, data, url);
  }

  return data;
}

export function parseApiError(error, mode = "login") {
  const isRegister = mode === "register";
  const isTelegram = mode === "telegram";
  const data = error.response?.data;

  if (!error.response) {
    if (!isApiConfigured) {
      return "Бэкенд не настроен: задайте VITE_API_URL на Vercel и сделайте Redeploy.";
    }
    if (isTelegram) {
      return "Не удалось авторизоваться через Telegram. Проверьте подключение к серверу.";
    }
    return isRegister
      ? "Не удалось зарегистрироваться. Проверьте подключение к серверу и VITE_API_URL."
      : "Не удалось войти. Проверьте подключение к серверу и VITE_API_URL.";
  }

  if (typeof data === "string") {
    if (isTelegram) return "Сервер вернул неожиданный ответ при авторизации Telegram.";
    return isRegister
      ? "Сервер вернул неожиданный ответ при регистрации."
      : "Сервер вернул неожиданный ответ при входе.";
  }

  if (data?.error && typeof data.error === "string") {
    return data.error;
  }

  if (error.response?.status >= 500) {
    return (
      (typeof data === "object" && data?.error) ||
      "Ошибка сервера (500). Проверьте логи Render и выполните python manage.py migrate."
    );
  }

  if (data?.detail) {
    return typeof data.detail === "string" ? data.detail : String(data.detail);
  }

  if (data && typeof data === "object") {
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && value[0]) return String(value[0]);
      if (typeof value === "string") return value;
    }
  }

  return isTelegram
    ? "Не удалось авторизоваться через Telegram."
    : isRegister
      ? "Не удалось зарегистрироваться. Проверьте имя пользователя и пароль."
      : "Не удалось войти. Проверьте имя пользователя и пароль.";
}

export async function telegramAuthRequest(telegramUser) {
  const data = await apiFetch("/api/telegram-auth/", {
    method: "POST",
    body: JSON.stringify({
      id: telegramUser.id,
      username: telegramUser.username || "",
      first_name: telegramUser.first_name || "",
      last_name: telegramUser.last_name || "",
    }),
  });

  if (!data?.access) {
    throw new Error("Сервер не вернул токен доступа.");
  }

  return data;
}

export async function loginRequest(username, password) {
  const data = await apiFetch("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  if (!data?.access) {
    throw new Error("Сервер не вернул токен доступа.");
  }

  return data;
}

export async function registerRequest(username, password, email = "") {
  const payload = { username, password };
  if (email) {
    payload.email = email;
  }

  const data = await apiFetch("/api/auth/register/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!data?.access) {
    throw new Error("Сервер не вернул токен после регистрации.");
  }

  return data;
}

export async function solveRequest(formData) {
  return apiFetch("/api/solve/", {
    method: "POST",
    body: formData,
  });
}
