import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";
import { Mail } from "lucide-react";
import { useViewerSession } from "@/hooks/use-viewer-session";
import { apiRequest } from "@/lib/queryClient";

type Mode = "login" | "register" | "reset";

interface InviteInfo {
  invitedEmail: string;
  invitedName: string;
  targetLevel: number;
  invitedByName: string;
  message: string | null;
}

const LEVEL_LABELS: Record<number, string> = {
  1: "Viewer",
  2: "Talent",
  3: "Host",
};

export default function LoginPage() {
  useSEO({
    title: "Sign In",
    description: "Log in or create your The Quest account to vote, compete, or host talent competitions.",
    canonical: "https://thequest-2dc77.firebaseapp.com/login",
  });
  const { login, register, resetPassword, isAuthenticated, error } = useAuth();
  const { loginViewer, isViewerLoggedIn } = useViewerSession();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { getImage, getMedia } = useLivery();

  const params = new URLSearchParams(search);
  const inviteToken = params.get("invite") || "";
  const isRegisterPath = window.location.pathname === "/register";

  const [mode, setMode] = useState<Mode>(inviteToken || isRegisterPath ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [viewerName, setViewerName] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<number>(2);
  const [loading, setLoading] = useState(false);

  const isViewerMode = selectedLevel === 1;

  const { data: inviteInfo } = useQuery<InviteInfo>({
    queryKey: ["/api/invitations/token", inviteToken],
    enabled: !!inviteToken,
  });

  useEffect(() => {
    if (inviteInfo) {
      setEmail(inviteInfo.invitedEmail);
      setDisplayName(inviteInfo.invitedName);
    }
  }, [inviteInfo]);

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, setLocation]);

  useEffect(() => {
    if (isViewerLoggedIn) {
      setLocation("/viewer");
    }
  }, [isViewerLoggedIn, setLocation]);

  if (isAuthenticated || isViewerLoggedIn) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "login" && isViewerMode) {
        if (!viewerName.trim()) {
          toast({ title: "Please enter your full name", variant: "destructive" });
          setLoading(false);
          return;
        }
        const res = await apiRequest("POST", "/api/guest/lookup", {
          name: viewerName.trim(),
          email: email.trim(),
        });
        const data = await res.json();
        loginViewer(data.viewer);
        toast({ title: "Welcome back!", description: `Signed in as ${data.viewer.displayName}` });
        setLocation("/viewer");
        return;
      }

      if (mode === "login") {
        await login(email, password);
        toast({ title: "Welcome back!", description: "You have been logged in." });
        setLocation("/dashboard");
      } else if (mode === "register") {
        if (password !== confirmPassword) {
          toast({ title: "Passwords don't match", variant: "destructive" });
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          toast({ title: "Password must be at least 6 characters", variant: "destructive" });
          setLoading(false);
          return;
        }
        const registerLevel = inviteToken ? undefined : selectedLevel;
        await register(email, password, displayName, inviteToken || undefined, registerLevel);
        toast({ title: "Account created!", description: "Welcome to the platform." });
        setLocation("/dashboard");
      } else if (mode === "reset") {
        await resetPassword(email);
        toast({ title: "Reset email sent", description: "Check your inbox for a password reset link." });
        setMode("login");
      }
    } catch (err: any) {
      const isAlreadyExists = err.message?.toLowerCase().includes("already in use") || err.message?.toLowerCase().includes("already exists");
      if (mode === "register" && isAlreadyExists) {
        toast({
          title: "Account already exists",
          description: inviteToken
            ? "Your account was pre-created. Log in below — check your invitation email for your temporary password."
            : "An account with this email already exists. Please log in instead.",
          variant: "destructive",
        });
        setMode("login");
      } else {
        const msg = err.message?.replace(/^\d+:\s*/, "") || "Something went wrong";
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteNavbar />

      <div className="relative h-[300px] flex items-end justify-center overflow-hidden">
        {getMedia("breadcrumb_bg", "/images/template/breadcumb.jpg").type === "video" ? (
          <video src={getMedia("breadcrumb_bg", "/images/template/breadcumb.jpg").url} className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline />
        ) : (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${getImage("breadcrumb_bg", "/images/template/breadcumb.jpg")})` }} />
        )}
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 bg-white px-10 py-4 mb-[-1px]">
          <h1
            className="text-black text-2xl font-bold uppercase"
            style={{ letterSpacing: "10px", fontFamily: "'Playfair Display', serif" }}
            data-testid="text-page-title"
          >
            {mode === "login" ? "LOGIN" : mode === "register" ? "REGISTER" : "RESET PASSWORD"}
          </h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-16">
        {inviteInfo && mode === "register" && (
          <div className="rounded-md bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 p-4 mb-6" data-testid="invite-banner">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-medium text-orange-400">You've been invited!</span>
            </div>
            <p className="text-sm text-white/60">
              <span className="text-white">{inviteInfo.invitedByName}</span> invited you to join as a <Badge className={`border-0 text-xs ml-1 ${inviteInfo.targetLevel === 3 ? "bg-purple-500/20 text-purple-300" : inviteInfo.targetLevel === 2 ? "bg-blue-500/20 text-blue-400" : "bg-white/10 text-white/50"}`}>{LEVEL_LABELS[inviteInfo.targetLevel] || `Level ${inviteInfo.targetLevel}`}</Badge>
            </p>
            {inviteInfo.message && (
              <p className="text-xs text-white/40 mt-2 italic">"{inviteInfo.message}"</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {mode === "register" && (
            <div>
              <Label htmlFor="displayName" className="text-white/60 uppercase text-xs tracking-wider">
                Display Name
              </Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-white/[0.08] border-white/20 text-white mt-2"
                placeholder="Your stage name"
                data-testid="input-display-name"
              />
            </div>
          )}

          {(mode === "login" || (mode === "register" && !inviteToken)) && (
            <div>
              <Label className="text-white/60 uppercase text-xs tracking-wider">
                Account Type
              </Label>
              <Select
                value={String(selectedLevel)}
                onValueChange={(val) => setSelectedLevel(Number(val))}
              >
                <SelectTrigger
                  className="bg-white/[0.08] border-white/20 text-white mt-2"
                  data-testid="select-account-type"
                >
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/20">
                  <SelectItem value="1" className="text-white focus:bg-white/10 focus:text-white" data-testid="select-item-viewer">
                    Viewer
                  </SelectItem>
                  <SelectItem value="2" className="text-white focus:bg-white/10 focus:text-white" data-testid="select-item-talent">
                    Talent / Competitor
                  </SelectItem>
                  <SelectItem value="4" className="text-white focus:bg-white/10 focus:text-white" data-testid="select-item-admin">
                    Admin
                  </SelectItem>
                </SelectContent>
              </Select>
              {mode === "register" && (
                <p className="text-white/30 text-xs mt-1.5">
                  {selectedLevel === 1 && "Browse and vote on your favorite contestants"}
                  {selectedLevel === 2 && "Create a talent profile and apply to competitions"}
                </p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="email" className="text-white/60 uppercase text-xs tracking-wider">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/[0.08] border-white/20 text-white mt-2"
              placeholder="your@email.com"
              required
              data-testid="input-email"
            />
          </div>

          {mode !== "reset" && mode === "login" && isViewerMode && (
            <div>
              <Label htmlFor="viewerName" className="text-white/60 uppercase text-xs tracking-wider">
                Full Name
              </Label>
              <Input
                id="viewerName"
                type="text"
                value={viewerName}
                onChange={(e) => setViewerName(e.target.value)}
                className="bg-white/[0.08] border-white/20 text-white mt-2"
                placeholder="Name you used at checkout"
                required
                data-testid="input-viewer-name"
              />
              <p className="text-white/30 text-xs mt-1.5">
                Enter the name and email you used when purchasing votes
              </p>
            </div>
          )}

          {mode !== "reset" && !(mode === "login" && isViewerMode) && (
            <div>
              <Label htmlFor="password" className="text-white/60 uppercase text-xs tracking-wider">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/[0.08] border-white/20 text-white mt-2"
                placeholder="Min 6 characters"
                required
                data-testid="input-password"
              />
            </div>
          )}

          {mode === "register" && (
            <div>
              <Label htmlFor="confirmPassword" className="text-white/60 uppercase text-xs tracking-wider">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-white/[0.08] border-white/20 text-white mt-2"
                placeholder="Repeat password"
                required
                data-testid="input-confirm-password"
              />
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm" data-testid="text-auth-error">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF5A09] hover:bg-[#FF5A09]/80 text-white uppercase tracking-wider font-bold"
            style={{ borderRadius: 0 }}
            data-testid="button-auth-submit"
          >
            {loading ? "Please wait..." : mode === "login" && isViewerMode ? "SIGN IN" : mode === "login" ? "LOGIN" : mode === "register" ? "CREATE ACCOUNT" : "SEND RESET EMAIL"}
          </Button>
        </form>

        <div className="mt-8 text-center space-y-3">
          {mode === "login" && (
            <>
              <button
                onClick={() => setMode("register")}
                className="text-[#FF5A09] text-sm uppercase tracking-wider hover:text-[#FF5A09]/70 transition-colors"
                data-testid="button-switch-register"
              >
                Don't have an account? Register
              </button>
              <br />
              <button
                onClick={() => setMode("reset")}
                className="text-white/40 text-sm hover:text-white/60 transition-colors"
                data-testid="button-forgot-password"
              >
                Forgot your password?
              </button>

              <div className="pt-6 border-t border-white/10 mt-6">
                <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Voter?</p>
                <p className="text-white/40 text-sm">
                  Select "Viewer" above and sign in with the name and email you used at checkout
                </p>
              </div>
            </>
          )}
          {mode === "register" && (
            <button
              onClick={() => setMode("login")}
              className="text-[#FF5A09] text-sm uppercase tracking-wider hover:text-[#FF5A09]/70 transition-colors"
              data-testid="button-switch-login"
            >
              Already have an account? Login
            </button>
          )}
          {mode === "reset" && (
            <button
              onClick={() => setMode("login")}
              className="text-[#FF5A09] text-sm uppercase tracking-wider hover:text-[#FF5A09]/70 transition-colors"
              data-testid="button-back-to-login"
            >
              Back to Login
            </button>
          )}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
