const LOCAL_API_URL = "http://127.0.0.1:8000/api/solve/";

const configuredUrl = import.meta.env.VITE_API_URL?.trim();

if (import.meta.env.PROD && !configuredUrl) {
  console.error(
    "VITE_API_URL is missing. Set it in Vercel → Settings → Environment Variables and redeploy."
  );
}

export const SOLVE_API_URL = configuredUrl || LOCAL_API_URL;
