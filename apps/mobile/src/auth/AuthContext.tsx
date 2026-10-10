import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";

import { apiRequest } from "../api/client";
import type { ApiError } from "../api/types";
import { clearStoredToken, getStoredToken, setStoredToken } from "./storage";

export type User = {
  id: string;
  email: string;
  displayName: string;
  avatarKey: string | null;
  points: number;
};

type AuthState =
  | { status: "loading"; token: null; user: null }
  | { status: "signedOut"; token: null; user: null }
  | { status: "signedIn"; token: string; user: User };

type AuthContextValue = {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  lastError: ApiError | null;
  clearError: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider(props: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", token: null, user: null });
  const [lastError, setLastError] = useState<ApiError | null>(null);

  const clearError = useCallback(() => setLastError(null), []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const token = await getStoredToken();
      if (!mounted) return;
      if (!token) {
        setState({ status: "signedOut", token: null, user: null });
        return;
      }
      try {
        const me = await apiRequest<User>({ path: "/api/me", token });
        if (!mounted) return;
        setState({ status: "signedIn", token, user: me });
      } catch {
        await clearStoredToken();
        if (!mounted) return;
        setState({ status: "signedOut", token: null, user: null });
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const refreshMe = useCallback(async () => {
    if (state.status !== "signedIn") return;
    const me = await apiRequest<User>({ path: "/api/me", token: state.token });
    setState({ status: "signedIn", token: state.token, user: me });
  }, [state]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const data = await apiRequest<{ token: string; user: User }>({
        path: "/api/auth/login",
        method: "POST",
        body: { email, password },
      });
      await setStoredToken(data.token);
      setState({ status: "signedIn", token: data.token, user: data.user });
      setLastError(null);
    } catch (err) {
      setLastError(err as ApiError);
      throw err;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    try {
      const data = await apiRequest<{ token: string; user: User }>({
        path: "/api/auth/register",
        method: "POST",
        body: { email, password, displayName },
      });
      await setStoredToken(data.token);
      setState({ status: "signedIn", token: data.token, user: data.user });
      setLastError(null);
    } catch (err) {
      setLastError(err as ApiError);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await clearStoredToken();
    setState({ status: "signedOut", token: null, user: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, login, register, logout, refreshMe, lastError, clearError }),
    [state, login, register, logout, refreshMe, lastError, clearError],
  );

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}
