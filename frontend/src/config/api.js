const LOCAL_API_BASE = "http://127.0.0.1:8000/api";

const configuredBase = import.meta.env.VITE_API_BASE?.trim();
const configuredSolve = import.meta.env.VITE_API_URL?.trim();

export const API_BASE = configuredBase || (configuredSolve ? configuredSolve.replace(/\/solve\/?$/, "") : LOCAL_API_BASE);

export const SOLVE_API_URL = configuredSolve || `${API_BASE}/solve/`;

if (import.meta.env.PROD && !configuredBase && !configuredSolve) {
  console.error(
    "VITE_API_BASE or VITE_API_URL is missing. Set in Vercel Environment Variables and redeploy."
  );
}
