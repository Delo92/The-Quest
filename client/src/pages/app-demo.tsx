import { useLayoutEffect, useState, type ReactNode, type SyntheticEvent } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TalentDashboard from "./talent-dashboard";
import HostDashboard from "./host-dashboard";
import AdminDashboard from "./admin-dashboard";
import ViewerDashboard from "./viewer-dashboard";
import CompetitionDetail from "./competition-detail";
import { DemoAuthProvider } from "@/hooks/use-auth";
import { getQueryFn } from "@/lib/queryClient";
import { installDemoApiGuard } from "@/lib/app-demo-data";

type DemoRole = "artist" | "host-admin" | "voter";
type HostAdminPanel = "host" | "admin";
type VoterPanel = "competition" | "dashboard";

const artistUser = {
  uid: "demo-artist-01",
  email: "",
  displayName: "Most Hated Twinz",
  stageName: null,
  level: 2,
  profileImageUrl: "https://storage.googleapis.com/thequest-2dc77.firebasestorage.app/talent-images%2FCB%20Publishing%20-%20Music%20Quest%2FMost%20Hated%20Twinz%2F1778105736665-4itkhi.jpeg",
  socialLinks: {
    instagram: "https://www.instagram.com/most_hatedtwinz",
    youtube: "https://youtube.com/@mosthatedtwinz",
    tiktok: "https://www.tiktok.com/@mosthatedtwinz",
    facebook: "https://www.facebook.com/share/1bYTcgLDZw/",
  },
  billingAddress: null,
  hasProfile: true,
  profileRole: "talent",
};

const artistProfile = {
  id: 501,
  userId: artistUser.uid,
  displayName: "Most Hated Twinz",
  stageName: null,
  email: artistUser.email,
  showEmail: false,
  bio: "We are Most Hated Twinz — twin artists, creators, entrepreneurs, and visionaries focused on turning pain, hustle, and creativity into a movement. From music and content creation to custom jewelry and branding, we bring raw talent and real energy into everything we touch. Inspired by the grind and built from experience, our sound blends storytelling, emotion, aggression, and authenticity while creating a lane that stands out from the crowd.\n\nBut we’re bigger than just music. Our mission is to bring artists, creators, vendors, and entrepreneurs together to build a stronger network and open more opportunities for independent talent. Through events, collaborations, performances, and creative platforms, we’re creating spaces where people can connect, grow their fanbase, sharpen their craft, and support each other’s success.\n\nWe believe talent deserves exposure, hard work deserves recognition, and the next generation of creators deserves a platform. Whether it’s through music, live events, content, or business ventures, Most Hated Twinz is about building a community where creativity, ambition, and loyalty come first.",
  category: "Music",
  location: "Oklahoma City",
  profileColor: "#FF5A09",
  profileBgImage: null,
  imageUrls: [
    artistUser.profileImageUrl,
    "https://storage.googleapis.com/thequest-2dc77.firebasestorage.app/talent-images%2FCB%20Publishing%20-%20Music%20Quest%2FMost%20Hated%20Twinz%2F1778105776119-9na6f6.jpeg",
    "https://storage.googleapis.com/thequest-2dc77.firebasestorage.app/talent-images%2FCB%20Publishing%20-%20Music%20Quest%2FMost%20Hated%20Twinz%2F1778105869259-0hnuzp.jpeg",
  ],
  socialLinks: artistUser.socialLinks,
  payoutInfo: {},
  nonprofitDeclaration: {},
};

const hostUser = {
  uid: "demo-host-01",
  email: "",
  displayName: "Ouuuuwwwweeeej",
  stageName: null,
  level: 3,
  profileImageUrl: "",
  socialLinks: {},
  billingAddress: null,
  hasProfile: true,
  profileRole: "host",
};

const adminUser = {
  ...hostUser,
  uid: "demo-admin-01",
  email: "admin@example.com",
  displayName: "Quest Admin",
  stageName: "Quest Admin",
  level: 4,
  profileRole: "admin",
};

const roles: { id: DemoRole; label: string; mobileLabel: string; description: string }[] = [
  { id: "artist", label: "Artist / Competitor", mobileLabel: "Artist", description: "Artist profile and competition tools" },
  { id: "host-admin", label: "Host / Admin", mobileLabel: "Host / Admin", description: "Event host and platform administration" },
  { id: "voter", label: "Voter", mobileLabel: "Voter", description: "Competition and voting history" },
];

function isRole(value: string | null): value is DemoRole {
  return value === "artist" || value === "host-admin" || value === "voter";
}

function DemoReadOnlySurface({ children }: { children: ReactNode }) {
  const blockAction = (event: SyntheticEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[role="tab"], [data-demo-navigation="allowed"], [data-demo-safe-action="true"]')) return;
    const control = target.closest("a, button, input, textarea, select, [role='button'], [role='switch']");
    if (control) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <div
      className="demo-read-only-surface"
      aria-label="Read-only sample dashboard"
      data-demo-read-only="true"
      onClickCapture={blockAction}
      onSubmitCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onChangeCapture={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.matches("input, textarea, select")) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {children}
    </div>
  );
}

export default function AppDemoPage() {
  const [role, setRole] = useState<DemoRole>(() => {
    const requested = new URLSearchParams(window.location.search).get("role");
    return isRole(requested) ? requested : "artist";
  });
  const [hostAdminPanel, setHostAdminPanel] = useState<HostAdminPanel>(() =>
    new URLSearchParams(window.location.search).get("panel") === "admin" ? "admin" : "host",
  );
  const [voterPanel, setVoterPanel] = useState<VoterPanel>(() =>
    new URLSearchParams(window.location.search).get("panel") === "dashboard" ? "dashboard" : "competition",
  );
  const [apiGuardReady, setApiGuardReady] = useState(false);
  const [demoQueryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: getQueryFn({ on401: "throw" }),
        retry: false,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    },
  }));

  useLayoutEffect(() => {
    const restoreFetch = installDemoApiGuard(role === "host-admin" ? "host" : "talent");
    setApiGuardReady(true);
    return () => {
      restoreFetch();
      demoQueryClient.clear();
    };
  }, [demoQueryClient, role]);

  return (
    <QueryClientProvider client={demoQueryClient}>
      <DemoAuthProvider>
        <div className="min-h-screen bg-[#080808] text-white">
          <header className="sticky top-0 z-[70] border-b border-white/10 bg-[#101010]/95 backdrop-blur">
            <nav
              aria-label="The Quest website"
              className="mx-auto grid max-w-[1600px] grid-cols-2 gap-2 px-3 py-2 sm:grid-cols-5 sm:px-6 lg:px-8"
            >
              <a href="/thequest" className="inline-flex min-h-11 items-center justify-center rounded-md bg-orange-500 px-3 text-center text-sm font-semibold text-white transition-colors hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300">
                Visit The Quest
              </a>
              <a href="/thequest/competitions" className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/15 px-3 text-sm text-white/80 transition-colors hover:border-white/35 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300">
                Competitions
              </a>
              <a href="/thequest/nominate" className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/15 px-3 text-sm text-white/80 transition-colors hover:border-white/35 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300">
                Nominate
              </a>
              <a href="/thequest/host" className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/15 px-3 text-sm text-white/80 transition-colors hover:border-white/35 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300">
                Host an event
              </a>
              <a href="/thequest/login" className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/15 px-3 text-sm text-white/80 transition-colors hover:border-white/35 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300">
                Log in
              </a>
            </nav>
          </header>

          <section className="border-b border-white/10 bg-[#0d0d0d]" aria-label="Demo view controls">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-3 py-2.5 sm:px-6 lg:px-8">
              <span className="mr-1 text-xs font-medium uppercase tracking-wider text-white/50">Preview</span>
              <nav aria-label="Choose a demo role" className="grid flex-1 grid-cols-3 gap-1.5 sm:flex sm:flex-none">
                {roles.map((item) => {
                  const selected = role === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-demo-navigation="allowed"
                      aria-pressed={selected}
                      aria-label={`${item.label}. ${item.description}`}
                      onClick={() => setRole(item.id)}
                      className={`min-h-10 rounded-md border px-2 text-xs font-semibold tracking-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 sm:px-3 sm:text-sm ${
                        selected
                          ? "border-orange-400/70 bg-orange-400/10 text-orange-100"
                          : "border-white/10 text-white/60 hover:border-white/25 hover:text-white/90"
                      }`}
                    >
                      {item.mobileLabel}
                    </button>
                  );
                })}
              </nav>
              <p className="w-full text-[11px] text-white/40 sm:ml-auto sm:w-auto">
                Real media · fictional demo metrics
              </p>

              {role === "host-admin" && (
                <div className="flex w-full flex-wrap items-center gap-2 pt-1 sm:w-auto sm:pt-0" aria-label="Host or administrator preview">
                  <span className="text-xs text-white/45">View</span>
                  {(["host", "admin"] as const).map((panel) => (
                    <button
                      key={panel}
                      type="button"
                      data-demo-navigation="allowed"
                      aria-pressed={hostAdminPanel === panel}
                      onClick={() => setHostAdminPanel(panel)}
                      className={`min-h-9 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        hostAdminPanel === panel
                          ? "border-orange-400/60 bg-orange-400/10 text-orange-100"
                          : "border-white/10 text-white/55 hover:border-white/25 hover:text-white/80"
                      }`}
                    >
                      {panel === "host" ? "Host" : "Admin"}
                    </button>
                  ))}
                </div>
              )}

              {role === "voter" && (
                <div className="flex w-full flex-wrap items-center gap-2 pt-1 sm:w-auto sm:pt-0" aria-label="Voter preview">
                  <span className="text-xs text-white/45">View</span>
                  {(["competition", "dashboard"] as const).map((panel) => (
                    <button
                      key={panel}
                      type="button"
                      data-demo-navigation="allowed"
                      aria-pressed={voterPanel === panel}
                      onClick={() => setVoterPanel(panel)}
                      className={`min-h-9 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        voterPanel === panel
                          ? "border-orange-400/60 bg-orange-400/10 text-orange-100"
                          : "border-white/10 text-white/55 hover:border-white/25 hover:text-white/80"
                      }`}
                    >
                      {panel === "competition" ? "Competition" : "Voter dashboard"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <main className="pb-10">
            {!apiGuardReady ? (
              <div className="mx-auto max-w-4xl px-4 py-24 text-center text-sm text-white/45">
                Preparing isolated demo data…
              </div>
            ) : (
              <DemoReadOnlySurface key={`${role}-${hostAdminPanel}-${voterPanel}`}>
                {role === "artist" && (
                  <TalentDashboard user={artistUser} profile={artistProfile as any} demoMode />
                )}
                {role === "host-admin" && hostAdminPanel === "host" && (
                  <HostDashboard user={hostUser} />
                )}
                {role === "host-admin" && hostAdminPanel === "admin" && (
                  <AdminDashboard user={adminUser} />
                )}
                {role === "voter" && voterPanel === "competition" && (
                  <CompetitionDetail demoMode />
                )}
                {role === "voter" && voterPanel === "dashboard" && (
                  <ViewerDashboard demoMode />
                )}
              </DemoReadOnlySurface>
            )}
          </main>
        </div>
      </DemoAuthProvider>
    </QueryClientProvider>
  );
}
