const TOKEN_KEY = "ai_student_access_token";
const REFRESH_KEY = "ai_student_refresh_token";
const USER_KEY = "ai_student_user";

export function getAuth() {
  try {
    const access = localStorage.getItem(TOKEN_KEY);
    const refresh = localStorage.getItem(REFRESH_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    if (!access || !userRaw) return null;
    return {
      access,
      refresh,
      user: JSON.parse(userRaw),
    };
  } catch {
    return null;
  }
}

export function saveAuth({ access, refresh, user }) {
  localStorage.setItem(TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}

function parseJwtPayload(token) {
  try {
    const base64 = token.split(".")[1];
    return JSON.parse(atob(base64.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

export function getUserIdFromToken(token) {
  const payload = parseJwtPayload(token);
  return payload.user_id ?? null;
}
