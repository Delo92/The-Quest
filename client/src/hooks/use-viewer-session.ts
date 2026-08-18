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

export function useViewerSession() {
  const [viewer, setViewer] = useState<ViewerSession | null>(getStoredSession);

  const loginViewer = useCallback((session: ViewerSession) => {
    localStorage.setItem(VIEWER_SESSION_KEY, JSON.stringify(session));
    setViewer(session);
  }, []);

  const logoutViewer = useCallback(() => {
    localStorage.removeItem(VIEWER_SESSION_KEY);
    setViewer(null);
  }, []);

  const refreshViewer = useCallback((updated: Partial<ViewerSession>) => {
    setViewer(prev => {
      if (!prev) return null;
      const merged = { ...prev, ...updated };
      localStorage.setItem(VIEWER_SESSION_KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

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
