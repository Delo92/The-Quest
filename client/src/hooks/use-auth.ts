import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  initFirebase,
  firebaseLogin,
  firebaseSignInWithCustomToken,
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
    let authStateGeneration = 0;
    let observedUid: string | null | undefined;

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
        const firebaseUid = firebaseUser?.uid ?? null;
        if (firebaseUid !== observedUid) {
          observedUid = firebaseUid;
          authStateGeneration += 1;
        }
        const eventGeneration = authStateGeneration;

        if (firebaseUser) {
          try {
            const token = await firebaseUser.getIdToken(!hasSynced);
            if (
              cancelled
              || eventGeneration !== authStateGeneration
              || getFirebaseAuth()?.currentUser?.uid !== firebaseUser.uid
            ) return;
            globalToken = token;

            if (!hasSynced) {
              hasSynced = true;
              const userData = await syncUserWithBackend(token);
              if (
                !cancelled
                && eventGeneration === authStateGeneration
                && getFirebaseAuth()?.currentUser?.uid === firebaseUser.uid
              ) {
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
              if (
                !cancelled
                && eventGeneration === authStateGeneration
                && getFirebaseAuth()?.currentUser?.uid === firebaseUser.uid
              ) {
                loadingResolved = true;
                clearTimeout(authTimeout);
                setIsLoading(false);
              }
            }
          } catch (err) {
            console.warn("Token refresh failed, clearing session:", err);
            if (
              !cancelled
              && eventGeneration === authStateGeneration
              && getFirebaseAuth()?.currentUser?.uid === firebaseUser.uid
            ) {
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

  const login = useCallback(async (
    email: string,
    password: string,
    inviteToken?: string,
    expectedAccountLevel?: number,
  ) => {
    setError(null);
    try {
      await firebaseLogin(email, password);

      if (expectedAccountLevel !== undefined) {
        const clearUnverifiedSession = async () => {
          setUser(null);
          setCachedUser(null);
          globalToken = null;
          await firebaseLogout().catch(() => {});
          setUser(null);
          setCachedUser(null);
          globalToken = null;
        };

        let actualLevel: number;
        let isAdminAccount = false;
        try {
          const token = await getIdToken();
          if (!token) throw new Error("Missing authentication token");
          const response = await fetch("/api/auth/user", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) throw new Error("Account lookup failed");
          const account = await response.json();
          actualLevel = Number(account.level);
          if (!Number.isFinite(actualLevel)) throw new Error("Invalid account level");
          isAdminAccount = account.profileRole === "admin" || actualLevel >= 4;
        } catch {
          await clearUnverifiedSession();
          throw Object.assign(
            new Error("Could not verify your account type. Please sign in again."),
            { code: "auth/account-type-check-failed" },
          );
        }

        const isHostAdminAccount = isAdminAccount || actualLevel >= 3;
        const accountTypeMatches = inviteToken
          ? expectedAccountLevel >= 4
            ? isAdminAccount
            : expectedAccountLevel === 3
              ? actualLevel === 3 && !isAdminAccount
              : actualLevel === expectedAccountLevel && !isAdminAccount
          : expectedAccountLevel === 3
            ? isHostAdminAccount
            : !isAdminAccount && actualLevel === expectedAccountLevel;

        if (!accountTypeMatches) {
          await clearUnverifiedSession();
          const actualType = isAdminAccount
            ? "Admin"
            : actualLevel === 3
              ? "Host"
              : actualLevel === 2
                ? "Artist / Competitor"
                : actualLevel === 1
                  ? "Viewer"
                  : "unknown";
          const selectedType = inviteToken
            ? expectedAccountLevel >= 4
              ? "Admin"
              : expectedAccountLevel === 3
                ? "Host"
                : expectedAccountLevel === 2
                  ? "Artist / Competitor"
                  : "Viewer"
            : expectedAccountLevel === 3
              ? "Host/Admin"
              : expectedAccountLevel === 2
                ? "Artist / Competitor"
                : "Viewer";
          const mismatchMessage = inviteToken
            ? `This invitation requires the ${selectedType} account type. Your account is ${actualType}.`
            : `This account is registered as ${actualType}. Select ${selectedType} and try again.`;
          throw Object.assign(
            new Error(mismatchMessage),
            { code: "auth/account-type-mismatch" },
          );
        }
      }

      if (inviteToken) {
        const token = await getIdToken();
        if (token) {
          const response = await fetch("/api/invitations/accept", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ inviteToken }),
          });
          if (!response.ok) {
            console.warn("Invitation could not be marked accepted:", await response.text());
          }
        }
      }
    } catch (err: any) {
      const msg = err.code === "auth/account-type-mismatch" || err.code === "auth/account-type-check-failed" ? err.message
        : err.code === "auth/user-not-found" ? "No account found with this email"
        : err.code === "auth/wrong-password" ? "Incorrect password"
        : err.code === "auth/invalid-credential" ? "Invalid email or password"
        : err.code === "auth/too-many-requests" ? "Too many attempts. Try again later."
        : "Login failed";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const register = useCallback(async (
    email: string,
    password: string,
    displayName?: string,
    inviteToken?: string,
    level?: number,
    acknowledgements?: {
      competitionEntryFeesAcknowledged?: boolean;
      hostEventFeesAcknowledged?: boolean;
      marketingGuidelinesAcknowledged?: boolean;
      votedArtistReminderAcknowledged?: boolean;
      referralCode?: string;
    },
  ) => {
    setError(null);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          displayName,
          inviteToken,
          level,
          ...acknowledgements,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || "Registration failed");
      }
      if (typeof result.customToken !== "string" || !result.customToken) {
        throw new Error("Registration completed without a sign-in token. Please log in.");
      }

      await firebaseSignInWithCustomToken(result.customToken);
      const token = await getIdToken(true);
      if (token) {
        globalToken = token;
        const userData = await syncUserWithBackend(token);
        if (userData) {
          setUser(userData);
          setCachedUser(userData);
        }
      }
    } catch (err: any) {
      const msg = err.code === "auth/email-already-in-use" ? "Email already in use"
        : err.code === "auth/weak-password" ? "Password must be at least 6 characters"
        : err.code === "auth/invalid-email" ? "Invalid email address"
        : err.message || "Registration failed";
      setError(msg);
      throw new Error(msg);
    }
  }, [syncUserWithBackend]);

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
