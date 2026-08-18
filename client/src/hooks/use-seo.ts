import { useEffect } from "react";

interface SEOOptions {
  title: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
}

const DEFAULT_TITLE = "The Quest - Competition & Voting Platform";
const DEFAULT_DESC = "The Quest is the ultimate competition and voting platform. Browse competitions, vote for your favorites, join as a competitor, or host your own event today.";

function setMetaTag(property: string, content: string, isProperty = false) {
  const attr = isProperty ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(url: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

export function useSEO({ title, description, canonical, ogImage, ogType }: SEOOptions) {
  useEffect(() => {
    const fullTitle = title.includes("The Quest") ? title : `${title} | The Quest`;
    document.title = fullTitle;

    const desc = description || DEFAULT_DESC;
    setMetaTag("description", desc);
    setMetaTag("og:title", fullTitle, true);
    setMetaTag("og:description", desc, true);
    setMetaTag("twitter:title", fullTitle);
    setMetaTag("twitter:description", desc);

    setMetaTag("og:type", ogType || "website", true);
    const defaultOgImage = "https://storage.googleapis.com/thequest-2dc77.firebasestorage.app/livery%2Fsite_favicon.jpg";
    setMetaTag("og:image", ogImage || defaultOgImage, true);
    setMetaTag("twitter:image", ogImage || defaultOgImage);

    const url = canonical || "https://thequest-2dc77.firebaseapp.com";
    setCanonical(url);
    setMetaTag("og:url", url, true);

    return () => {
      document.title = DEFAULT_TITLE;
      setMetaTag("description", DEFAULT_DESC);
      setMetaTag("og:title", DEFAULT_TITLE, true);
      setMetaTag("og:description", DEFAULT_DESC, true);
      setMetaTag("og:image", defaultOgImage, true);
      setMetaTag("og:url", "https://thequest-2dc77.firebaseapp.com", true);
      setMetaTag("og:type", "website", true);
      setMetaTag("twitter:title", DEFAULT_TITLE);
      setMetaTag("twitter:description", DEFAULT_DESC);
      setMetaTag("twitter:image", defaultOgImage);
      setCanonical("https://thequest-2dc77.firebaseapp.com");
    };
  }, [title, description, canonical, ogImage, ogType]);
}
