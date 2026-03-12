import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import CBLogo from "@/components/cb-logo";
import type { TalentProfile } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Redirect, useLocation } from "wouter";
import TalentDashboard from "./talent-dashboard";
import AdminDashboard from "./admin-dashboard";
import HostDashboard from "./host-dashboard";

export default function Dashboard() {
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: profile, isLoading: profileLoading } = useQuery<TalentProfile | null>({
    queryKey: ["/api/talent-profiles/me"],
    enabled: isAuthenticated && !authLoading,
  });

  const adminSetupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/set-admin");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/talent-profiles/me"] });
      toast({ title: "Admin access granted!", description: "You are now the platform administrator." });
    },
    onError: (err: Error) => {
      toast({ title: "Setup failed", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-10 w-3/4 mx-auto bg-white/5" />
          <Skeleton className="h-4 w-1/2 mx-auto bg-white/10" />
          <Skeleton className="h-48 w-full bg-white/5" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Redirect to="/login" />;
  }

  const isAdmin = profile?.role === "admin" || user.level >= 4;
  const isHost = user.level === 3;

  if (isAdmin) {
    return <AdminDashboard user={user as any} />;
  }

  if (isHost) {
    return <HostDashboard user={user as any} />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black text-white">
        <nav className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-16 lg:h-20">
            <a href="/" className="flex items-center gap-2" data-testid="link-home">
              <CBLogo size="sm" showText={false} />
              <span className="font-serif text-xl font-bold">The Quest</span>
            </a>
            <Button variant="ghost" onClick={() => logout()} className="text-white/60" data-testid="button-logout">
              Logout
            </Button>
          </div>
        </nav>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <Shield className="h-16 w-16 text-orange-400/30 mx-auto mb-6" />
          <h1 className="font-serif text-3xl font-bold mb-3">Welcome to The Quest</h1>
          <p className="text-white/40 mb-8">Choose how you'd like to get started on the platform.</p>
          <div className="space-y-4">
            <Button
              onClick={() => adminSetupMutation.mutate()}
              disabled={adminSetupMutation.isPending}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white"
              data-testid="button-setup-admin"
            >
              <Shield className="h-4 w-4 mr-2" />
              {adminSetupMutation.isPending ? "Setting up..." : "Set Up as Admin"}
            </Button>
            <p className="text-xs text-white/20">Only available if no admin exists yet.</p>
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
              <div className="relative flex justify-center"><span className="bg-black px-4 text-sm text-white/30">or</span></div>
            </div>
            <TalentDashboard user={user as any} profile={null} />
          </div>
        </div>
      </div>
    );
  }

  return <TalentDashboard user={user as any} profile={profile} />;
}
