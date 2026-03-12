import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  initFirebase,
  firebaseLogin,
  firebaseRegister,
  firebaseLogout,
  firebaseResetPassword,
  onFirebaseIdTokenChanged,
  getIdToken,
  getFirebaseAuth,
} from "@/lib/firebase";
import { queryClient as globalQueryClient } from "@/lib/queryClient";

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  stageName: string | null;
  level: number;
  profileImageUrl: string | null;
  socialLinks: Record<string, string> | null;
  billingAddress: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  } | null;
  hasProfile: boolean;
  profileRole: string | null;
}

const AUTH_CACHE_KEY = "thequest_auth_user";
const AUTH_TIMEOUT_MS = 10000;

function getCachedUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function setCachedUser(user: AuthUser | null) {
  try {
    if (user) {
      sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(AUTH_CACHE_KEY);
    }
  } catch {}
}

let globalToken: string | null = null;
let hasInvalidatedAfterRestore = false;

export function getAuthToken(): string | null {
  return globalToken;
}

export function useAuth() {
  const cached = getCachedUser();
  const [user, setUser] = useState<AuthUser | null>(cached);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const syncUserWithBackend = useCallback(async (token: string): Promise<AuthUser | null> => {
    try {
      const res = await fetch("/api/auth/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const syncRes = await fetch("/api/auth/sync", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!syncRes.ok) return null;
        return syncRes.json();
      }
      return res.json();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;
    let hasSynced = false;
    let loadingResolved = false;

    const authTimeout = setTimeout(() => {
      if (!loadingResolved && !cancelled) {
        loadingResolved = true;
        console.warn("Auth timeout: forcing session clear after", AUTH_TIMEOUT_MS, "ms");
        firebaseLogout().catch(() => {});
        setUser(null);
        setCachedUser(null);
        globalToken = null;
        setIsLoading(false);
      }
    }, AUTH_TIMEOUT_MS);

    async function init() {
      await initFirebase();

      const unsub = onFirebaseIdTokenChanged(async (firebaseUser) => {
        if (cancelled) return;

        if (firebaseUser) {
          try {
            const token = await firebaseUser.getIdToken(!hasSynced);
            globalToken = token;

            if (!hasSynced) {
              hasSynced = true;
              const userData = await syncUserWithBackend(token);
              if (!cancelled) {
                if (userData) {
                  setUser(userData);
                  setCachedUser(userData);
                } else {
                  await firebaseLogout().catch(() => {});
                  setUser(null);
                  setCachedUser(null);
                  globalToken = null;
                }
                loadingResolved = true;
                clearTimeout(authTimeout);
                setIsLoading(false);
                if (!hasInvalidatedAfterRestore) {
                  hasInvalidatedAfterRestore = true;
                  globalQueryClient.invalidateQueries();
                }
              }
            } else {
              if (!cancelled) {
                loadingResolved = true;
                clearTimeout(authTimeout);
                setIsLoading(false);
              }
            }
          } catch (err) {
            console.warn("Token refresh failed, clearing session:", err);
            if (!cancelled) {
              await firebaseLogout().catch(() => {});
              setUser(null);
              setCachedUser(null);
              globalToken = null;
              loadingResolved = true;
              clearTimeout(authTimeout);
              setIsLoading(false);
            }
          }
        } else {
          hasSynced = false;
          if (!cancelled) {
            setUser(null);
            setCachedUser(null);
            globalToken = null;
            loadingResolved = true;
            clearTimeout(authTimeout);
            setIsLoading(false);
          }
        }
      });

      tokenRefreshInterval = setInterval(async () => {
        const auth = getFirebaseAuth();
        if (auth?.currentUser) {
          try {
            const freshToken = await auth.currentUser.getIdToken(true);
            globalToken = freshToken;
          } catch {
            console.warn("Background token refresh failed, logging out");
            await firebaseLogout().catch(() => {});
            setUser(null);
            setCachedUser(null);
            globalToken = null;
          }
        }
      }, 45 * 60 * 1000);

      return unsub;
    }

    const cleanup = init();
    return () => {
      cancelled = true;
      clearTimeout(authTimeout);
      if (tokenRefreshInterval) clearInterval(tokenRefreshInterval);
      cleanup.then(unsub => unsub?.());
    };
  }, [syncUserWithBackend]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await firebaseLogin(email, password);
    } catch (err: any) {
      const msg = err.code === "auth/user-not-found" ? "No account found with this email"
        : err.code === "auth/wrong-password" ? "Incorrect password"
        : err.code === "auth/invalid-credential" ? "Invalid email or password"
        : err.code === "auth/too-many-requests" ? "Too many attempts. Try again later."
        : "Login failed";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, displayName?: string, inviteToken?: string, level?: number) => {
    setError(null);
    try {
      await firebaseRegister(email, password);
      const token = await getIdToken();
      if (token) {
        await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email, password, displayName, inviteToken, level }),
        });
      }
    } catch (err: any) {
      const msg = err.code === "auth/email-already-in-use" ? "Email already in use"
        : err.code === "auth/weak-password" ? "Password must be at least 6 characters"
        : err.code === "auth/invalid-email" ? "Invalid email address"
        : "Registration failed";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const logout = useCallback(async () => {
    setCachedUser(null);
    globalToken = null;
    hasInvalidatedAfterRestore = false;
    setUser(null);
    await firebaseLogout();
    queryClient.clear();
  }, [queryClient]);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      await firebaseResetPassword(email);
    } catch (err: any) {
      const msg = err.code === "auth/user-not-found" ? "No account found with this email"
        : "Password reset failed";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    register,
    logout,
    resetPassword,
  };
}
