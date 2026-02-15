import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { resolveBackendUrl } from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Session {
  user: User;
  session?: {
    id?: string;
    userId?: string;
    expiresAt?: string;
    token?: string;
  };
}

interface AuthContextValue {
  session: Session | null;
  isPending: boolean;
  refresh: () => Promise<void>;
  setSession: (session: Session | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BACKEND_URL = resolveBackendUrl();
const SESSION_KEY = "optirecipe_session";

function saveSessionToStorage(session: Session | null) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function loadSessionFromStorage(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.user?.id && data?.user?.email) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Load from localStorage synchronously on mount to prevent flash of wrong page
  const [session, setSessionState] = useState<Session | null>(() => loadSessionFromStorage());
  const [isPending, setIsPending] = useState(true);

  const setSession = useCallback((s: Session | null) => {
    setSessionState(s);
    saveSessionToStorage(s);
  }, []);

  const fetchSession = useCallback(async () => {
    try {
      // Try fetching session via cookies first
      const res = await fetch(`${BACKEND_URL}/api/auth/get-session`, {
        credentials: "include",
        headers: { "Accept": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          setSession(data);
          return;
        }
      }
    } catch {
      // Cookie-based session failed, fall through
    }

    // Fallback: load from localStorage (set during sign-in/sign-up)
    const stored = loadSessionFromStorage();
    if (stored) {
      setSessionState(stored);
    } else {
      setSessionState(null);
    }
    setIsPending(false);
  }, [setSession]);

  useEffect(() => {
    fetchSession().finally(() => setIsPending(false));
  }, [fetchSession]);

  const handleSignOut = useCallback(async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/sign-out`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Ignore errors
    }
    setSession(null);
  }, [setSession]);

  return (
    <AuthContext.Provider
      value={{
        session,
        isPending,
        refresh: fetchSession,
        setSession,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
