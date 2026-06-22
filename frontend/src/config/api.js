const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";

function resolveBackendRoot() {
  const raw = import.meta.env.VITE_API_URL;
  const candidate = raw && String(raw).trim() ? String(raw).trim() : DEFAULT_BACKEND_URL;
  let root = candidate.replace(/\/$/, "");

  if (!/^https?:\/\//i.test(root)) {
    if (import.meta.env.DEV) {
      console.warn(
        "[AI Student PRO] VITE_API_URL должен быть полным URL (http/https). Используется",
        DEFAULT_BACKEND_URL
      );
    }
    root = DEFAULT_BACKEND_URL;
  }

  if (root.endsWith("/api")) {
    root = root.slice(0, -4);
  }

  return root;
}

/**
 * Собирает абсолютный URL бэкенда. Никогда не возвращает относительный путь.
 * @param {string} endpoint — например `/api/telegram-auth/` или `/api/solve/`
 */
export function getApiUrl(endpoint) {
  const apiBase = resolveBackendRoot();
  let path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  if (!path.startsWith("/api")) {
    path = `/api${path}`;
  }

  return `${apiBase}${path}`;
}

export const BACKEND_URL = resolveBackendRoot();

export const isApiConfigured =
  Boolean(import.meta.env.VITE_API_URL?.trim()) || !import.meta.env.PROD;
