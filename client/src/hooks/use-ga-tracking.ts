import { useEffect } from "react";
import { useLocation } from "wouter";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export function useGATracking() {
  const [location] = useLocation();

  useEffect(() => {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", {
      page_path: location,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [location]);
}
