import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { isAuthenticated, getAuth, clearAuth } from "./utils/authStorage";
import AuthScreen from "./components/AuthScreen";
import ChatApp from "./components/ChatApp";

export default function App() {
  const [auth, setAuth] = useState(() => (isAuthenticated() ? getAuth() : null));

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
    document.documentElement.classList.add("dark");
  }, []);

  const handleLogout = () => {
    clearAuth();
    setAuth(null);
  };

  if (!auth?.access) {
    return <AuthScreen onAuthenticated={setAuth} />;
  }

  return <ChatApp user={auth.user} onLogout={handleLogout} />;
}
