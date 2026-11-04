import type { CapacitorConfig } from "@capacitor/cli";

// Test build: the native shell loads the live site, so login, payments and
// video behave exactly as on the website. Set QUEST_APP_URL to point a build
// at a different address (for example a staging site).
const rawSiteUrl = (process.env.QUEST_APP_URL || process.env.SITE_URL || "").trim().replace(/\/+$/, "");
const siteUrl = rawSiteUrl && !/^https?:\/\//i.test(rawSiteUrl) ? `https://${rawSiteUrl}` : rawSiteUrl;
if (!siteUrl) throw new Error("Set SITE_URL or QUEST_APP_URL before syncing the native apps.");

const config: CapacitorConfig = {
  appId: "live.cbpublishing.thequest",
  appName: "The Quest",
  webDir: "dist/public",
  server: {
    url: `${siteUrl}/thequest/`,
    cleartext: false,
  },
};

export default config;
