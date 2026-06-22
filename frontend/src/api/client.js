import { getApiUrl } from "../config/api";
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
    const isTelegramAuth = url.includes("/telegram-auth");

    if (response.status === 401 && !isTelegramAuth && getAccessToken()) {
      clearAuth();
      window.location.reload();
    }

    return null;
  }

  return data;
}

export function parseApiError(error) {
  const data = error?.response?.data;
  if (typeof data === "object" && data?.error) return String(data.error);
  if (data?.detail) return typeof data.detail === "string" ? data.detail : String(data.detail);
  return "Не удалось выполнить запрос.";
}

export async function telegramAuthRequest(telegramUser) {
  return apiFetch("/api/telegram-auth/", {
    method: "POST",
    body: JSON.stringify({
      id: telegramUser.id,
      telegram_id: telegramUser.id,
      username: telegramUser.username || "",
      first_name: telegramUser.first_name || "",
      last_name: telegramUser.last_name || "",
    }),
  });
}

export async function solveRequest(formData) {
  const data = await apiFetch("/api/solve/", {
    method: "POST",
    body: formData,
  });
  if (!data) {
    throw new Error("Не удалось получить ответ от сервера.");
  }
  return data;
}
