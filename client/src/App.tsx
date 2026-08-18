import { Switch, Route, Redirect } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useLivery } from "@/hooks/use-livery";
import { useGATracking } from "@/hooks/use-ga-tracking";
import NotFound from "@/pages/not-found";
import CodeLandingPage from "@/pages/code-landing";
import HomePage from "@/pages/home";
import Landing from "@/pages/landing";
import Competitions from "@/pages/competitions";
import CompetitionDetail from "@/pages/competition-detail";
import TalentProfilePublic from "@/pages/talent-profile-public";
import Dashboard from "@/pages/dashboard";
import LoginPage from "@/pages/login";
import CheckoutPage from "@/pages/checkout";
import MyPurchasesPage from "@/pages/my-purchases";
import JoinPage from "@/pages/join";
import HostPage from "@/pages/host";
import ContestantSharePage from "@/pages/contestant-share";
import HostProfilePublic from "@/pages/host-profile-public";
import AboutPage from "@/pages/about";
import FAQPage from "@/pages/faq";
import ViewerDashboard from "@/pages/viewer-dashboard";

function QuestRouter() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={LoginPage} />
      <Route path="/competitions" component={Competitions} />
      <Route path="/talent/:id" component={TalentProfilePublic} />
      <Route path="/checkout/:competitionId/:contestantId" component={CheckoutPage} />
      <Route path="/my-purchases" component={MyPurchasesPage} />
      <Route path="/nominate" component={JoinPage} />
      <Route path="/join">{() => <Redirect to="/nominate" />}</Route>
      <Route path="/host" component={HostPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/faq" component={FAQPage} />
      <Route path="/host/:hostSlug" component={HostProfilePublic} />
      <Route path="/viewer" component={ViewerDashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/admin" component={Dashboard} />
      <Route path="/:categorySlug/:compSlug/:talentSlug" component={ContestantSharePage} />
      <Route path="/:categorySlug/:compSlug" component={CompetitionDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function DynamicFavicon() {
  const { getImage, isLoading } = useLivery();

  useEffect(() => {
    if (isLoading) return;
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
  }, [isLoading, getImage]);

  return null;
}

function App() {
  useGATracking();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      localStorage.setItem("hfc_ref", ref);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DynamicFavicon />
        <Toaster />
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/thequest" nest component={QuestRouter} />
          <Route path="/:slug" component={CodeLandingPage} />
          <Route component={NotFound} />
        </Switch>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
