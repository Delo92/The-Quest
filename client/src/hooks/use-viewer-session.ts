import { useState, useCallback } from "react";

const VIEWER_SESSION_KEY = "thequest_viewer_session";

export interface ViewerSession {
  id: string;
  email: string;
  displayName: string;
  totalVotesPurchased: number;
  totalSpent: number;
  createdAt: string;
}

function getStoredSession(): ViewerSession | null {
  try {
    const raw = localStorage.getItem(VIEWER_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function useViewerSession(demoMode = false) {
  const [viewer, setViewer] = useState<ViewerSession | null>(() => demoMode ? null : getStoredSession());

  const loginViewer = useCallback((session: ViewerSession) => {
    if (demoMode) return;
    localStorage.setItem(VIEWER_SESSION_KEY, JSON.stringify(session));
    setViewer(session);
  }, [demoMode]);

  const logoutViewer = useCallback(() => {
    if (demoMode) return;
    localStorage.removeItem(VIEWER_SESSION_KEY);
    setViewer(null);
  }, [demoMode]);

  const refreshViewer = useCallback((updated: Partial<ViewerSession>) => {
    if (demoMode) return;
    setViewer(prev => {
      if (!prev) return null;
      const merged = { ...prev, ...updated };
      localStorage.setItem(VIEWER_SESSION_KEY, JSON.stringify(merged));
      return merged;
    });
  }, [demoMode]);

  return {
    viewer,
    isViewerLoggedIn: !!viewer,
    loginViewer,
    logoutViewer,
    refreshViewer,
  };
}

export function getViewerSession(): ViewerSession | null {
  return getStoredSession();
}

export function clearViewerSession() {
  localStorage.removeItem(VIEWER_SESSION_KEY);
}
