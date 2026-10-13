import { useLayoutEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import TalentDashboard from "./talent-dashboard";
import HostDashboard from "./host-dashboard";
import AdminDashboard from "./admin-dashboard";
import ViewerDashboard from "./viewer-dashboard";
import CompetitionDetail from "./competition-detail";
import { DemoAuthProvider } from "@/hooks/use-auth";
import { getQueryFn } from "@/lib/queryClient";
import { installDemoApiGuard } from "@/lib/app-demo-data";
import CBLogo from "@/components/cb-logo";
import { useLivery } from "@/hooks/use-livery";

type DemoRole = "artist" | "host-admin" | "voter";
type HostAdminPanel = "host" | "admin";
type VoterPanel = "competition" | "dashboard";

const artistUser = {
  uid: "demo-artist-01",
  email: "jordan.vale@example.com",
  displayName: "Jordan Vale",
  stageName: "Jordan Vale",
  level: 2,
  profileImageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=320&q=80",
  socialLinks: {},
  billingAddress: null,
  hasProfile: true,
  profileRole: "talent",
};

const artistProfile = {
  id: 501,
  userId: artistUser.uid,
  displayName: "Jordan Vale",
  stageName: "Jordan Vale",
  email: artistUser.email,
  showEmail: false,
  bio: "Indie soul vocalist blending warm acoustic arrangements with modern R&B. Based in Austin, Texas.",
  category: "Music",
  location: "Austin, TX",
  profileColor: "#FF5A09",
  profileBgImage: null,
  imageUrls: [artistUser.profileImageUrl],
  socialLinks: { instagram: "https://instagram.com/", youtube: "https://youtube.com/" },
  payoutInfo: { method: "ach", accountType: "checking", legalName: "Jordan Vale" },
  nonprofitDeclaration: {},
};

const hostUser = {
  uid: "demo-host-01",
  email: "morgan.ellis@example.com",
  displayName: "Morgan Ellis",
  stageName: "Morgan Ellis",
  level: 3,
  profileImageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=320&q=80",
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

const roles: { id: DemoRole; label: string; description: string }[] = [
  { id: "artist", label: "Artist / Competitor", description: "Artist profile and competition tools" },
  { id: "host-admin", label: "Host / Admin", description: "Event host and platform administration" },
  { id: "voter", label: "Voter", description: "Competition and voting history" },
];

function isRole(value: string | null): value is DemoRole {
  return value === "artist" || value === "host-admin" || value === "voter";
}

function DemoReadOnlySurface({ children }: { children: ReactNode }) {
  const blockAction = (event: React.SyntheticEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[role="tab"], [data-demo-navigation="allowed"]')) return;
    const control = target.closest("a, button, input, textarea, select, [role='button'], [role='switch']");
    if (control) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <div
      aria-label="Read-only sample dashboard"
      aria-disabled="true"
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
    const restoreFetch = installDemoApiGuard();
    setApiGuardReady(true);
    return () => {
      restoreFetch();
      demoQueryClient.clear();
    };
  }, [demoQueryClient]);

  const panelLabel = role === "host-admin"
    ? hostAdminPanel === "host" ? "Host dashboard" : "Admin dashboard"
    : role === "voter"
      ? voterPanel === "competition" ? "Competition preview" : "Voter dashboard"
      : "Artist dashboard";

  return (
    <QueryClientProvider client={demoQueryClient}>
      <DemoAuthProvider>
        <div className="min-h-screen bg-[#080808] text-white">
          <header className="relative z-[70] border-b border-white/10 bg-[#101010]">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <CBLogo size="sm" showText={false} />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-300/80">The Quest</p>
                  <h1 className="text-base font-semibold leading-tight sm:text-lg">Platform demo</h1>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-300/[0.06] px-3 py-1.5 text-xs text-orange-100/80">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                Sample data · Demo only
              </div>
            </div>

            <div className="mx-auto max-w-[1600px] px-4 pb-4 sm:px-6 lg:px-8">
              <nav aria-label="Choose a demo role" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {roles.map((item) => {
                  const selected = role === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-demo-navigation="allowed"
                      aria-pressed={selected}
                      onClick={() => setRole(item.id)}
                      className={`min-h-[58px] rounded-lg border px-4 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                        selected
                          ? "border-orange-400/70 bg-orange-400/10"
                          : "border-white/10 bg-white/[0.025] hover:border-white/25"
                      }`}
                    >
                      <span className={`block text-sm font-semibold ${selected ? "text-orange-100" : "text-white/80"}`}>{item.label}</span>
                      <span className="mt-0.5 block text-xs text-white/45">{item.description}</span>
                    </button>
                  );
                })}
              </nav>

              {role === "host-admin" && (
                <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Host or administrator view">
                  <span className="mr-1 text-xs uppercase tracking-[0.14em] text-white/40">View</span>
                  {(["host", "admin"] as const).map((panel) => (
                    <button
                      key={panel}
                      type="button"
                      data-demo-navigation="allowed"
                      aria-pressed={hostAdminPanel === panel}
                      onClick={() => setHostAdminPanel(panel)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        hostAdminPanel === panel
                          ? "border-orange-400/60 bg-orange-400/10 text-orange-100"
                          : "border-white/10 text-white/55 hover:border-white/25 hover:text-white/80"
                      }`}
                    >
                      {panel === "host" ? "Host dashboard" : "Admin dashboard"}
                    </button>
                  ))}
                </div>
              )}

              {role === "voter" && (
                <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Voter experience view">
                  <span className="mr-1 text-xs uppercase tracking-[0.14em] text-white/40">View</span>
                  {(["competition", "dashboard"] as const).map((panel) => (
                    <button
                      key={panel}
                      type="button"
                      data-demo-navigation="allowed"
                      aria-pressed={voterPanel === panel}
                      onClick={() => setVoterPanel(panel)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
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
          </header>

          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-white/50 sm:px-6 lg:px-8">
            <p>Viewing: <span className="font-medium text-white/75">{panelLabel}</span></p>
            <p>Sign-in, voting, uploads, and data changes are disabled.</p>
          </div>

          <main className="pb-10">
            {!apiGuardReady ? (
              <div className="mx-auto max-w-4xl px-4 py-24 text-center text-sm text-white/45">
                Preparing isolated demo data…
              </div>
            ) : (
              <DemoReadOnlySurface key={`${role}-${hostAdminPanel}-${voterPanel}`}>
                {role === "artist" && (
                  <TalentDashboard user={artistUser} profile={artistProfile as any} />
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
