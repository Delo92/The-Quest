import { Switch, Route, Redirect, useSearch, useParams, useLocation } from "wouter";
import { lazy, Suspense, useEffect, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ErrorTelemetryBoundary } from "@/components/error-telemetry-boundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useLivery } from "@/hooks/use-livery";
import { useGATracking } from "@/hooks/use-ga-tracking";
import { installClientErrorHandlers } from "@/lib/client-error-logger";
import { WeeklyConsentGate } from "@/components/weekly-consent-gate";

const NotFound = lazy(() => import("@/pages/not-found"));
const CodeLandingPage = lazy(() => import("@/pages/code-landing"));
const HomePage = lazy(() => import("@/pages/home"));
const Landing = lazy(() => import("@/pages/landing"));
const Competitions = lazy(() => import("@/pages/competitions"));
const CompetitionDetail = lazy(() => import("@/pages/competition-detail"));
const TalentProfilePublic = lazy(() => import("@/pages/talent-profile-public"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const LoginPage = lazy(() => import("@/pages/login"));
const CheckoutPage = lazy(() => import("@/pages/checkout"));
const MyPurchasesPage = lazy(() => import("@/pages/my-purchases"));
const JoinPage = lazy(() => import("@/pages/join"));
const HostPage = lazy(() => import("@/pages/host"));
const ContestantSharePage = lazy(() => import("@/pages/contestant-share"));
const HostProfilePublic = lazy(() => import("@/pages/host-profile-public"));
const AboutPage = lazy(() => import("@/pages/about"));
const NonprofitsPage = lazy(() => import("@/pages/nonprofits"));
const FAQPage = lazy(() => import("@/pages/faq"));
const ViewerDashboard = lazy(() => import("@/pages/viewer-dashboard"));
const AppDemoPage = lazy(() => import("@/pages/app-demo"));
const ReferralLandingPage = lazy(() => import("@/pages/referral-landing"));
const AdminFormsPage = lazy(() => import("@/pages/admin-forms"));
const PublicFormPage = lazy(() => import("@/pages/public-form"));

function RootEntryPage() {
  const search = useSearch();
  const hasReferral = Boolean(new URLSearchParams(search).get("ref"));
  return hasReferral ? <ReferralLandingPage /> : <HomePage />;
}

function QuestRouter() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={LoginPage} />
      <Route path="/competitions" component={Competitions} />
      <Route path="/talent/:id" component={TalentProfilePublic} />
      <Route path="/Competitor/:name" component={CompetitorByName} />
      <Route path="/checkout/:competitionId/:contestantId" component={CheckoutPage} />
      <Route path="/my-purchases" component={MyPurchasesPage} />
      <Route path="/nominate" component={JoinPage} />
      <Route path="/join">{() => <Redirect to="/nominate" />}</Route>
      <Route path="/host" component={HostPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/NonProfits" component={NonprofitsPage} />
      <Route path="/faq" component={FAQPage} />
      <Route path="/host/:hostSlug" component={HostProfilePublic} />
      <Route path="/viewer" component={() => <ViewerDashboard />} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/admin" component={Dashboard} />
      <Route path="/admin/forms" component={AdminFormsPage} />
      <Route path="/f/:slug" component={PublicFormPage} />
      <Route path="/:categorySlug/:compSlug/:talentSlug" component={ContestantSharePage} />
      <Route path="/:categorySlug/:compSlug" component={() => <CompetitionDetail />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function QuestApplication() {
  return (
    <WeeklyConsentGate>
      <QuestRouter />
    </WeeklyConsentGate>
  );
}

function DynamicFavicon() {
  const { getImage, isLoading } = useLivery();
  const [location] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    // Competition pages set their own icon from the competition image after
    // resolving competition data; do not overwrite it with the site logo.
    if (/^\/thequest\/[^/]+\/[^/]+\/?$/.test(location)) return;
    const uploadedUrl = getImage("site_favicon", "");
    const faviconUrl = uploadedUrl || "/cb-logo-favicon.png";
    document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="shortcut icon"]').forEach(el => el.remove());
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.href = faviconUrl + "?v=" + Date.now();
    document.head.appendChild(icon);
    const apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    apple.href = faviconUrl;
    document.head.appendChild(apple);
  }, [isLoading, getImage, location]);

  return null;
}

// /thequest/Competitor/{StageName} resolves the stage name to the profile page.
function CompetitorByName() {
  const params = useParams<{ name: string }>();
  const name = decodeURIComponent(params.name || "");
  const [state, setState] = useState<{ id?: number; missing?: boolean }>({});
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/talent-profiles/by-name/${encodeURIComponent(name)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
      .then((d) => { if (!cancelled) setState({ id: d.id }); })
      .catch(() => { if (!cancelled) setState({ missing: true }); });
    return () => { cancelled = true; };
  }, [name]);
  if (state.id) return <Redirect to={`/talent/${state.id}`} replace />;
  if (state.missing) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Competitor not found</div>;
  return <div className="min-h-screen bg-black" aria-busy="true" />;
}

// Redirect bare /talent/:id links to the correct /thequest/talent/:id path.
// Links are generated without the /thequest prefix throughout the app.
function TalentProfileRedirect() {
  const params = useParams<{ id: string }>();
  return <Redirect to={`/thequest/talent/${params.id}`} />;
}

function App() {
  useGATracking();
  useEffect(() => installClientErrorHandlers(), []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      localStorage.setItem("hfc_ref", ref);
      localStorage.setItem("hfc_inbound_ref", ref);
      localStorage.removeItem("hfc_auto_ref");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorTelemetryBoundary>
        <TooltipProvider>
          <DynamicFavicon />
          <Toaster />
          <Suspense
            fallback={
              <div className="flex min-h-[40vh] items-center justify-center px-4 text-sm text-white/60" role="status">
                Loading page…
              </div>
            }
          >
            <Switch>
              <Route path="/" component={RootEntryPage} />
              <Route path="/app-demo" component={AppDemoPage} />
              <Route path="/talent/:id" component={TalentProfileRedirect} />
              <Route path="/thequest" nest component={QuestApplication} />
              <Route path="/:slug" component={CodeLandingPage} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </TooltipProvider>
      </ErrorTelemetryBoundary>
    </QueryClientProvider>
  );
}

export default App;
