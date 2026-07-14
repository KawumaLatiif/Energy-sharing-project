import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getAccessToken } from "@/lib/storage";
import { getUserConfig, login as loginApi, logout as logoutApi } from "@/lib/auth-api";
import type { AuthUser } from "@/types/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  mustChangePassword: boolean;
  signIn: (email: string, password: string) => Promise<LoginResult>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export interface LoginResult {
  mustChangePassword: boolean;
  redirectTo: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapConfigToUser(config: Awaited<ReturnType<typeof getUserConfig>>): AuthUser | null {
  if (!config?.email && !config?.user?.email) return null;
  return {
    id: config.id ?? config.user?.id ?? 0,
    email: config.email ?? config.user?.email ?? "",
    first_name: config.first_name ?? config.user?.first_name ?? "",
    last_name: config.last_name ?? config.user?.last_name ?? "",
    user_role: (config.user_role ?? config.user?.user_role ?? "CLIENT") as AuthUser["user_role"],
    is_admin: config.is_admin ?? config.user?.is_admin ?? false,
    must_change_password: config.must_change_password ?? config.user?.must_change_password,
    redirect_to: config.user?.redirect_to,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const config = await getUserConfig();
      setUser(mapConfigToUser(config));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 8000);

    refreshUser().finally(() => {
      if (!cancelled) {
        clearTimeout(timeout);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [refreshUser]);

  const signIn = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const res = await loginApi(email, password);
    setUser(res.user);
    const mustChangePassword = !!(res.must_change_password || res.user?.must_change_password);
    const redirectTo = mustChangePassword
      ? "/change-password"
      : (res.redirect_to || res.user?.redirect_to || "/(app)/(tabs)");
    return { mustChangePassword, redirectTo };
  }, []);

  const signOut = useCallback(async () => {
    await logoutApi();
    setUser(null);
  }, []);

  const mustChangePassword = !!user?.must_change_password;

  const value = useMemo(
    () => ({ user, loading, mustChangePassword, signIn, signOut, refreshUser }),
    [user, loading, mustChangePassword, signIn, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
