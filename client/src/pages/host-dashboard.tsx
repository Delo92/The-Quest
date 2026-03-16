import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import CBLogo from "@/components/cb-logo";
import { Trophy, BarChart3, Users, Plus, Check, X as XIcon, LogOut, Vote, Calendar, Award, Mail, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Eye, ExternalLink, Search, ShoppingCart, DollarSign, Pencil, Save, ImageUp, QrCode, Download } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InviteDialog } from "@/components/invite-dialog";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useMemo } from "react";
import { useAuth, getAuthToken } from "@/hooks/use-auth";
import * as tus from "tus-js-client";
import { CompetitionDetailModal } from "@/components/competition-detail-modal";

interface HostStats {
  totalCompetitions: number;
  totalContestants: number;
  totalVotes: number;
  pendingApplications: number;
}

interface HostCompetition {
  id: number;
  title: string;
  description: string | null;
  category: string;
  coverImage: string | null;
  coverVideo: string | null;
  status: string;
  voteCost: number;
  maxVotesPerDay: number;
  maxImagesPerContestant: number | null;
  maxVideosPerContestant: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string | null;
  createdBy: string | null;
}

interface ContestantItem {
  id: number;
  competitionId: number;
  talentProfileId: number;
  applicationStatus: string;
  appliedAt: string;
  competitionTitle: string;
  talentProfile: {
    id: number;
    displayName: string;
    bio: string | null;
    category: string | null;
    imageUrls: string[] | null;
  };
}

interface CompReportResponse {
  competition: HostCompetition;
  leaderboard: { rank: number; contestantId: number; displayName: string; voteCount: number; votePercentage: number }[];
  totalVotes: number;
  totalRevenue: number;
  totalContestants: number;
  totalPurchases: number;
}

interface PlatformSettings {
  eventPackages?: { name: string; price: number; maxEvents: number; description: string }[];
  maxVotesPerDay?: number;
  defaultVoteCost?: number;
  freeVotesPerDay?: number;
}

function EventAnalyticsCard({ comp }: { comp: HostCompetition }) {
  const { data: report, isLoading } = useQuery<CompReportResponse>({
    queryKey: ["/api/host/competitions", comp.id, "report"],
  });

  const { data: breakdown } = useQuery<{ online: number; inPerson: number; total: number; onlineVoteWeight: number }>({
    queryKey: ["/api/competitions", comp.id, "vote-breakdown"],
  });

  if (isLoading) return <div className="rounded-md bg-white/5 border border-white/5 p-4 animate-pulse h-24" />;

  return (
    <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid={`analytics-event-${comp.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-white/80 truncate">{comp.title}</h4>
          <Badge className={`border-0 text-[10px] ${comp.status === "active" || comp.status === "voting" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/50"}`}>{comp.status === "voting" ? "Active" : comp.status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={async () => {
            try {
              const token = getAuthToken();
              const res = await fetch(`/api/competitions/${comp.id}/qrcode`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              if (!res.ok) throw new Error("Failed to download QR code");
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `qr-${comp.title.toLowerCase().replace(/\s+/g, "-")}.png`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (err) {
              console.error("QR download error:", err);
            }
          }} className="text-white/40 text-xs" title="Download QR Code" data-testid={`analytics-qr-${comp.id}`}>
            <QrCode className="h-3 w-3 mr-1" /> QR
          </Button>
          <Link href={`/competitions/${comp.id}`} className="text-xs text-orange-400 flex items-center gap-1">
            <Eye className="h-3 w-3" /> View
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wider">Votes</p>
          <p className="text-lg font-bold text-orange-400">{report?.totalVotes ?? 0}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wider">Contestants</p>
          <p className="text-lg font-bold">{report?.totalContestants ?? 0}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wider">Revenue</p>
          <p className="text-lg font-bold text-green-400">${((report?.totalRevenue ?? 0) / 100).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wider">Purchases</p>
          <p className="text-lg font-bold">{report?.totalPurchases ?? 0}</p>
        </div>
      </div>
      {breakdown && (breakdown.online > 0 || breakdown.inPerson > 0) && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Vote Source Breakdown</p>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
              <span className="text-white/60">Online: <span className="text-white font-medium">{breakdown.online}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
              <span className="text-white/60">In-Person: <span className="text-white font-medium">{breakdown.inPerson}</span></span>
            </div>
            {breakdown.onlineVoteWeight < 100 && (
              <span className="text-white/30">Online weight: {breakdown.onlineVoteWeight}%</span>
            )}
          </div>
          {breakdown.total > 0 && (
            <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden flex">
              <div className="bg-blue-400 h-full" style={{ width: `${(breakdown.online / breakdown.total) * 100}%` }} />
              <div className="bg-orange-400 h-full" style={{ width: `${(breakdown.inPerson / breakdown.total) * 100}%` }} />
            </div>
          )}
        </div>
      )}
      {report && report.leaderboard.length > 0 && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Top 3</p>
          <div className="space-y-1">
            {report.leaderboard.slice(0, 3).map((entry) => (
              <div key={entry.contestantId} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${entry.rank <= 3 ? "text-orange-400" : "text-white/30"}`}>#{entry.rank}</span>
                  <span className="text-white/70">{entry.displayName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/40">{entry.voteCount} votes</span>
                  <span className="text-orange-400">{entry.votePercentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HostDashboard({ user }: { user: any }) {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCompId, setSelectedCompId] = useState<number | null>(null);
  const [compDetailId, setCompDetailId] = useState<number | null>(null);
  const [expandedCompId, setExpandedCompId] = useState<number | null>(null);
  const [compSearch, setCompSearch] = useState("");
  const [compCategoryFilter, setCompCategoryFilter] = useState("all");
  const [compPage, setCompPage] = useState(1);
  const COMPS_PER_PAGE = 10;
  const [contestantFilter, setContestantFilter] = useState("all");
  const [contestantSearch, setContestantSearch] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<number | null>(null);
  const [calendarSelectedComp, setCalendarSelectedComp] = useState<number | null>(null);
  const [editingCompId, setEditingCompId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const { data: stats } = useQuery<HostStats>({
    queryKey: ["/api/host/stats"],
  });

  const { data: competitions = [] } = useQuery<HostCompetition[]>({
    queryKey: ["/api/host/competitions"],
  });

  const { data: allContestants = [] } = useQuery<ContestantItem[]>({
    queryKey: ["/api/host/contestants"],
  });

  const { data: platformSettings } = useQuery<PlatformSettings>({
    queryKey: ["/api/platform-settings"],
  });

  const { data: calendarReport, isLoading: calendarReportLoading } = useQuery<CompReportResponse>({
    queryKey: ["/api/host/competitions", calendarSelectedComp, "report"],
    enabled: calendarSelectedComp !== null,
  });

  const hostCategories = useMemo(() => {
    const cats = Array.from(new Set(competitions.map(c => c.category).filter(Boolean)));
    return cats.sort();
  }, [competitions]);

  const filteredComps = useMemo(() => {
    let filtered = competitions;
    if (compSearch.trim()) {
      const q = compSearch.toLowerCase();
      filtered = filtered.filter(c => c.title.toLowerCase().includes(q) || (c.category && c.category.toLowerCase().includes(q)));
    }
    if (compCategoryFilter !== "all") {
      filtered = filtered.filter(c => c.category === compCategoryFilter);
    }
    return filtered;
  }, [competitions, compSearch, compCategoryFilter]);

  const totalCompPages = Math.max(1, Math.ceil(filteredComps.length / COMPS_PER_PAGE));
  const paginatedComps = useMemo(() => {
    const start = (compPage - 1) * COMPS_PER_PAGE;
    return filteredComps.slice(start, start + COMPS_PER_PAGE);
  }, [filteredComps, compPage]);

  const filteredContestants = useMemo(() => {
    let filtered = allContestants;
    if (contestantFilter !== "all") {
      filtered = filtered.filter(c => c.applicationStatus === contestantFilter);
    }
    if (contestantSearch.trim()) {
      const q = contestantSearch.toLowerCase();
      filtered = filtered.filter(c =>
        (c.talentProfile?.displayName || "").toLowerCase().includes(q) ||
        (c.competitionTitle || "").toLowerCase().includes(q) ||
        (c.talentProfile?.category || "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allContestants, contestantFilter, contestantSearch]);


  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/host/competitions/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/host/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/host/stats"] });
      toast({ title: "Status updated" });
    },
  });

  const approveContestantMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/host/contestants/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/host/contestants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/host/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/host/stats"] });
      toast({ title: "Application updated" });
    },
  });

  const deleteCompMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/host/competitions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/host/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/host/stats"] });
      setSelectedCompId(null);
      toast({ title: "Event deleted" });
    },
  });

  const editCompMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/host/competitions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/host/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/host/stats"] });
      setEditingCompId(null);
      setEditForm({});
      toast({ title: "Event updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const isVideoFile = (file: File) =>
    file.type.startsWith("video/") || /\.(mp4|webm|mov|avi|mkv|m4v)$/i.test(file.name);

  const fetchVimeoEmbedUrl = async (videoUri: string): Promise<string> => {
    const videoId = videoUri.replace("/videos/", "");
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch(`/api/admin/vimeo/video/${videoId}/embed-url`, { headers });
      if (r.ok) {
        const data = await r.json();
        return data.playerEmbedUrl || `https://player.vimeo.com/video/${videoId}`;
      }
    } catch {}
    return `https://player.vimeo.com/video/${videoId}`;
  };

  const coverUploadMutation = useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const token = getAuthToken();
      const authHeaders: Record<string, string> = {};
      if (token) authHeaders["Authorization"] = `Bearer ${token}`;

      if (isVideoFile(file)) {
        const ticketRes = await fetch(`/api/host/competitions/${id}/cover-vimeo-ticket`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ fileSize: file.size }),
        });
        if (!ticketRes.ok) {
          const err = await ticketRes.json();
          throw new Error(err.message || "Failed to create upload ticket");
        }
        const ticket = await ticketRes.json();

        await new Promise<void>((resolve, reject) => {
          const upload = new tus.Upload(file, {
            uploadUrl: ticket.uploadLink,
            onError: (error) => reject(new Error(error.message || "Upload failed")),
            onSuccess: () => resolve(),
          });
          upload.start();
        });

        if (ticket.completeUri) {
          try { await fetch(`https://api.vimeo.com${ticket.completeUri}`, { method: "DELETE" }); } catch {}
        }

        const playerUrl = await fetchVimeoEmbedUrl(ticket.videoUri);

        const saveRes = await fetch(`/api/host/competitions/${id}/cover-video-url`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ videoUrl: playerUrl }),
        });
        if (!saveRes.ok) throw new Error("Failed to save cover video URL");
        return saveRes.json();
      }

      const formData = new FormData();
      formData.append("cover", file);
      const res = await fetch(`/api/host/competitions/${id}/cover`, {
        method: "PUT",
        headers: authHeaders,
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/host/competitions"] });
      toast({ title: "Cover updated!" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to upload cover", description: err.message, variant: "destructive" });
    },
  });

  const eventPackages = platformSettings?.eventPackages || [
    { name: "Starter", price: 49, maxEvents: 1, description: "Perfect for your first competition" },
    { name: "Pro", price: 149, maxEvents: 5, description: "For experienced hosts running multiple events" },
    { name: "Enterprise", price: 399, maxEvents: 0, description: "Unlimited events with premium support" },
  ];

  return (
    <div className="min-h-screen bg-black text-white" data-testid="host-dashboard">
      <nav className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-16 lg:h-20">
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            <CBLogo size="sm" showText={false} />
            <span className="font-serif text-xl font-bold">The Quest</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-sm text-white/40 hidden sm:inline truncate max-w-[150px]">{user?.displayName || user?.email}</span>
            <Badge className="bg-purple-500/20 text-purple-300 border-0">Host</Badge>
            <Button variant="ghost" size="icon" onClick={() => logout()} data-testid="button-logout">
              <LogOut className="h-4 w-4 text-white/60" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-xl sm:text-2xl font-bold" data-testid="host-dashboard-title">Host Dashboard</h1>
            <p className="text-white/40 text-sm mt-1">Manage your competitions and contestants</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white" data-testid="button-create-event">
                <Plus className="h-4 w-4 mr-2" /> New Event
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#111] border-white/10 text-white max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">Event Packages</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-white/50 mb-4">Choose a package to host your competition on The Quest.</p>
              <div className="space-y-4">
                {eventPackages.map((pkg, i) => (
                  <div key={i} className="rounded-md border border-white/10 p-4 hover:bg-white/5 transition-colors" data-testid={`package-${pkg.name.toLowerCase()}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-serif font-bold text-lg">{pkg.name}</h3>
                      <span className="text-xl font-bold text-orange-400">${pkg.price}</span>
                    </div>
                    <p className="text-sm text-white/50 mb-3">{pkg.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/30">
                        {pkg.maxEvents === 0 ? "Unlimited events" : `Up to ${pkg.maxEvents} event${pkg.maxEvents > 1 ? "s" : ""}`}
                      </span>
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white"
                        onClick={() => {
                          toast({ title: "Coming soon", description: "Payment processing will be available shortly." });
                        }}
                        data-testid={`button-buy-${pkg.name.toLowerCase()}`}
                      >
                        <ShoppingCart className="h-3 w-3 mr-1" /> Purchase
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-white/20 text-center mt-2">Contact admin for custom enterprise pricing</p>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid="stat-competitions">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-4 w-4 text-orange-400" />
              <span className="text-xs text-white/40 uppercase tracking-wider">My Events</span>
            </div>
            <p className="text-2xl font-bold">{stats?.totalCompetitions ?? 0}</p>
          </div>
          <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid="stat-contestants">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-white/40 uppercase tracking-wider">Contestants</span>
            </div>
            <p className="text-2xl font-bold">{stats?.totalContestants ?? 0}</p>
          </div>
          <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid="stat-votes">
            <div className="flex items-center gap-2 mb-1">
              <Vote className="h-4 w-4 text-green-400" />
              <span className="text-xs text-white/40 uppercase tracking-wider">Total Votes</span>
            </div>
            <p className="text-2xl font-bold">{stats?.totalVotes ?? 0}</p>
          </div>
          <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid="stat-pending">
            <div className="flex items-center gap-2 mb-1">
              <Award className="h-4 w-4 text-yellow-400" />
              <span className="text-xs text-white/40 uppercase tracking-wider">Pending</span>
            </div>
            <p className="text-2xl font-bold">{stats?.pendingApplications ?? 0}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <InviteDialog senderLevel={3} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
            <TabsList className="bg-white/5 border border-white/10 inline-flex w-max sm:w-auto">
              <TabsTrigger value="overview" className="text-xs sm:text-sm data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300" data-testid="tab-overview">
                <Trophy className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Events</span>
              </TabsTrigger>
              <TabsTrigger value="contestants" className="text-xs sm:text-sm data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300" data-testid="tab-contestants">
                <Users className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Contestants</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs sm:text-sm data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300" data-testid="tab-analytics">
                <BarChart3 className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="calendar" className="text-xs sm:text-sm data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300" data-testid="tab-calendar">
                <Calendar className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Calendar</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview">
            {competitions.length === 0 ? (
              <div className="text-center py-16 text-white/30" data-testid="empty-events">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg mb-2">No events yet</p>
                <p className="text-sm">Purchase an event package to get started.</p>
              </div>
            ) : (
              <>
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input
                    placeholder="Search events..."
                    value={compSearch}
                    onChange={(e) => { setCompSearch(e.target.value); setCompPage(1); }}
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-event-search"
                  />
                </div>
                <Select value={compCategoryFilter} onValueChange={(val) => { setCompCategoryFilter(val); setCompPage(1); }}>
                  <SelectTrigger className="w-44 bg-white/5 border-white/10 text-white text-sm" data-testid="select-event-category-filter">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10">
                    <SelectItem value="all">All Categories</SelectItem>
                    {hostCategories.map(cat => (
                      <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-white/30" data-testid="text-event-count">{filteredComps.length} result{filteredComps.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {paginatedComps.map(comp => (
                  <div key={comp.id} className="rounded-md bg-white/5 border border-white/5 overflow-hidden" data-testid={`event-card-${comp.id}`}>
                    <div
                      className="relative h-[200px] bg-gradient-to-b from-orange-900/40 to-black"
                      style={comp.coverImage && !comp.coverVideo ? { backgroundImage: `url(${comp.coverImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                    >
                      {comp.coverVideo && (
                        comp.coverVideo.includes("vimeo.com") ? (
                          <iframe src={`${comp.coverVideo}&background=1&autoplay=1&loop=1&muted=1`} className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ border: "none" }} allow="autoplay" />
                        ) : (
                          <video src={comp.coverVideo} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" />
                        )
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                      {!comp.coverImage && !comp.coverVideo && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-20">
                          <Trophy className="h-16 w-16 text-white" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="font-serif font-bold text-lg text-white truncate" data-testid={`event-title-${comp.id}`}>{comp.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge className="border-0 text-xs bg-white/10 text-white/80">{comp.category}</Badge>
                          <Badge className={`border-0 text-xs ${comp.status === "active" || comp.status === "voting" ? "bg-green-500/20 text-green-400" : comp.status === "completed" ? "bg-white/10 text-white/60" : "bg-yellow-500/20 text-yellow-400"}`} data-testid={`event-status-${comp.id}`}>
                            {comp.status === "voting" ? "Active" : comp.status}
                          </Badge>
                          {(comp as any).inPersonOnly && (
                            <Badge className="border-0 text-xs bg-purple-500/20 text-purple-300" data-testid={`badge-in-person-${comp.id}`}>
                              In-Person Only
                            </Badge>
                          )}
                          {(comp.startDate || (comp as any).startDateTbd) && (
                            <span className="text-xs text-white/40 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {(comp as any).startDateTbd ? <span className="text-orange-400">TBD</span> : new Date(comp.startDate!).toLocaleDateString()}
                              {(comp as any).endDateTbd ? <span> - <span className="text-orange-400">TBD</span></span> : comp.endDate ? <span> - {new Date(comp.endDate).toLocaleDateString()}</span> : null}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-orange-400"
                          onClick={() => setCompDetailId(comp.id)}
                          data-testid={`button-details-${comp.id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" /> Details
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-white/60"
                          onClick={() => {
                            if (editingCompId === comp.id) {
                              setEditingCompId(null);
                              setEditForm({});
                            } else {
                              setEditingCompId(comp.id);
                              setEditForm({
                                title: comp.title,
                                description: comp.description || "",
                                category: comp.category,
                                startDate: comp.startDate ? comp.startDate.split("T")[0] : "",
                                endDate: comp.endDate ? comp.endDate.split("T")[0] : "",
                                startDateTbd: (comp as any).startDateTbd || false,
                                endDateTbd: (comp as any).endDateTbd || false,
                                maxVotesPerDay: comp.maxVotesPerDay,
                                voteCost: comp.voteCost,
                                maxImagesPerContestant: comp.maxImagesPerContestant,
                                maxVideosPerContestant: comp.maxVideosPerContestant,
                                inPersonOnly: (comp as any).inPersonOnly || false,
                              });
                              setExpandedCompId(comp.id);
                            }
                          }}
                          data-testid={`button-edit-${comp.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          {editingCompId === comp.id ? "Cancel Edit" : "Edit"}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={comp.status} onValueChange={(v) => updateStatusMutation.mutate({ id: comp.id, status: v })}>
                          <SelectTrigger className="bg-white/[0.08] border-white/20 text-white text-xs w-28" data-testid={`select-status-${comp.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#222] border-white/20 text-white">
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={async () => {
                          try {
                            const token = getAuthToken();
                            const res = await fetch(`/api/competitions/${comp.id}/qrcode`, {
                              headers: token ? { Authorization: `Bearer ${token}` } : {},
                            });
                            if (!res.ok) throw new Error("Failed to download QR code");
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `qr-${comp.title.toLowerCase().replace(/\s+/g, "-")}.png`;
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch (err) {
                            console.error("QR download error:", err);
                          }
                        }} title="Download QR Code for live voting" data-testid={`button-qr-${comp.id}`}>
                          <QrCode className="h-4 w-4 text-white/60" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedCompId(comp.id); setActiveTab("contestants"); }} data-testid={`button-view-contestants-${comp.id}`}>
                          <Users className="h-4 w-4 text-white/60" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedCompId(comp.id); setActiveTab("analytics"); }} data-testid={`button-view-analytics-${comp.id}`}>
                          <BarChart3 className="h-4 w-4 text-white/60" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this event?")) deleteCompMutation.mutate(comp.id); }} data-testid={`button-delete-${comp.id}`}>
                          <XIcon className="h-4 w-4 text-red-400/60" />
                        </Button>
                      </div>
                    </div>
                    {expandedCompId === comp.id && editingCompId === comp.id && (
                      <div className="border-t border-white/5 p-4 space-y-4" data-testid={`edit-form-${comp.id}`}>
                        <h4 className="text-xs uppercase tracking-widest text-orange-400 font-bold">Edit Event</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-white/50 text-xs">Title</Label>
                            <Input
                              value={editForm.title || ""}
                              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                              className="bg-white/[0.08] border-white/20 text-white"
                              data-testid={`edit-title-${comp.id}`}
                            />
                          </div>
                          <div>
                            <Label className="text-white/50 text-xs">Category</Label>
                            <Select value={editForm.category || ""} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                              <SelectTrigger className="bg-white/[0.08] border-white/20 text-white" data-testid={`edit-category-${comp.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-[#222] border-white/20 text-white">
                                <SelectItem value="Music">Music</SelectItem>
                                <SelectItem value="Dance">Dance</SelectItem>
                                <SelectItem value="Modeling">Modeling</SelectItem>
                                <SelectItem value="Bodybuilding">Bodybuilding</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <Label className="text-white/50 text-xs">Start Date</Label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <span className="text-[10px] text-white/40">TBD</span>
                                <Switch checked={editForm.startDateTbd || false}
                                  onCheckedChange={(v) => setEditForm({ ...editForm, startDateTbd: v, ...(v ? { startDate: "" } : {}) })}
                                  className="data-[state=checked]:bg-orange-500 scale-75" data-testid={`edit-start-tbd-${comp.id}`} />
                              </label>
                            </div>
                            {editForm.startDateTbd ? (
                              <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-orange-400 font-medium">
                                TBD — Starts once enough enter
                              </div>
                            ) : (
                              <Input type="date" value={editForm.startDate || ""}
                                onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                                className="bg-white/[0.08] border-white/20 text-white" data-testid={`edit-start-${comp.id}`} />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <Label className="text-white/50 text-xs">End Date</Label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <span className="text-[10px] text-white/40">TBD</span>
                                <Switch checked={editForm.endDateTbd || false}
                                  onCheckedChange={(v) => setEditForm({ ...editForm, endDateTbd: v, ...(v ? { endDate: "" } : {}) })}
                                  className="data-[state=checked]:bg-orange-500 scale-75" data-testid={`edit-end-tbd-${comp.id}`} />
                              </label>
                            </div>
                            {editForm.endDateTbd ? (
                              <div className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-xs text-orange-400 font-medium">
                                TBD — End date to be determined
                              </div>
                            ) : (
                              <Input type="date" value={editForm.endDate || ""}
                                onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                                className="bg-white/[0.08] border-white/20 text-white" data-testid={`edit-end-${comp.id}`} />
                            )}
                          </div>
                          <div>
                            <Label className="text-white/50 text-xs">Max Votes Per Day</Label>
                            <Input
                              type="number"
                              value={editForm.maxVotesPerDay ?? 10}
                              onChange={(e) => setEditForm({ ...editForm, maxVotesPerDay: parseInt(e.target.value) || 0 })}
                              className="bg-white/[0.08] border-white/20 text-white"
                              data-testid={`edit-maxvotes-${comp.id}`}
                            />
                          </div>
                          <div>
                            <Label className="text-white/50 text-xs">Vote Cost ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min={platformSettings?.defaultVoteCost ?? 0}
                              value={editForm.voteCost ?? 0}
                              onChange={(e) => setEditForm({ ...editForm, voteCost: parseFloat(e.target.value) || 0 })}
                              className="bg-white/[0.08] border-white/20 text-white"
                              data-testid={`edit-votecost-${comp.id}`}
                            />
                            {(platformSettings?.defaultVoteCost ?? 0) > 0 && (
                              <p className="text-orange-400/70 text-[10px] mt-0.5">Min: ${(platformSettings?.defaultVoteCost ?? 0).toFixed(2)}</p>
                            )}
                          </div>
                          <div>
                            <Label className="text-white/50 text-xs">Max Images Per Contestant</Label>
                            <Input
                              type="number"
                              min={1}
                              value={editForm.maxImagesPerContestant ?? ""}
                              onChange={(e) => setEditForm({ ...editForm, maxImagesPerContestant: e.target.value ? parseInt(e.target.value) : null })}
                              placeholder="Use global default"
                              className="bg-white/[0.08] border-white/20 text-white"
                              data-testid={`edit-max-images-${comp.id}`}
                            />
                            <p className="text-[10px] text-white/25 mt-1">Leave empty to use global default</p>
                          </div>
                          <div>
                            <Label className="text-white/50 text-xs">Max Videos Per Contestant</Label>
                            <Input
                              type="number"
                              min={1}
                              value={editForm.maxVideosPerContestant ?? ""}
                              onChange={(e) => setEditForm({ ...editForm, maxVideosPerContestant: e.target.value ? parseInt(e.target.value) : null })}
                              placeholder="Use global default"
                              className="bg-white/[0.08] border-white/20 text-white"
                              data-testid={`edit-max-videos-${comp.id}`}
                            />
                            <p className="text-[10px] text-white/25 mt-1">Leave empty to use global default</p>
                          </div>
                          <div className="col-span-2">
                            <div className="flex items-center justify-between rounded-md bg-white/[0.04] border border-white/10 px-3 py-2.5">
                              <div>
                                <Label className="text-white/70 text-xs font-medium">In-Person Only Event</Label>
                                <p className="text-[10px] text-white/30 mt-0.5">When enabled, only QR code votes are accepted. Online voting is disabled.</p>
                              </div>
                              <Switch
                                checked={editForm.inPersonOnly || false}
                                onCheckedChange={(v) => setEditForm({ ...editForm, inPersonOnly: v })}
                                className="data-[state=checked]:bg-orange-500"
                                data-testid={`edit-in-person-only-${comp.id}`}
                              />
                            </div>
                          </div>
                        </div>
                        <div>
                          <Label className="text-white/50 text-xs">Description</Label>
                          <Textarea
                            value={editForm.description || ""}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            className="bg-white/[0.08] border-white/20 text-white resize-none"
                            rows={3}
                            data-testid={`edit-desc-${comp.id}`}
                          />
                        </div>
                        <div>
                          <Label className="text-white/50 text-xs">Cover Image / Thumbnail</Label>
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            {(comp.coverImage || comp.coverVideo) && (
                              <div className="relative w-24 h-16 rounded-md overflow-hidden border border-white/10">
                                {comp.coverVideo ? (
                                  comp.coverVideo.includes("vimeo.com") ? (
                                    <iframe src={`${comp.coverVideo}&background=1&muted=1`} className="w-full h-full object-cover pointer-events-none" style={{ border: "none" }} allow="autoplay" />
                                  ) : (
                                    <video src={comp.coverVideo} muted className="w-full h-full object-cover" />
                                  )
                                ) : (
                                  <img src={comp.coverImage!} alt="Cover" className="w-full h-full object-cover" />
                                )}
                              </div>
                            )}
                            <input
                              id={`cover-input-${comp.id}`}
                              type="file"
                              accept="image/*,video/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  coverUploadMutation.mutate({ id: comp.id, file });
                                }
                                e.target.value = "";
                              }}
                              data-testid={`edit-cover-input-${comp.id}`}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => document.getElementById(`cover-input-${comp.id}`)?.click()}
                              disabled={coverUploadMutation.isPending}
                              className="text-xs text-white/60 border border-white/10"
                              data-testid={`edit-cover-btn-${comp.id}`}
                            >
                              <ImageUp className="h-3.5 w-3.5 mr-1" />
                              {coverUploadMutation.isPending ? "Uploading..." : comp.coverImage || comp.coverVideo ? "Change Cover" : "Upload Cover"}
                            </Button>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingCompId(null); setEditForm({}); }} className="text-white/50" data-testid={`edit-cancel-${comp.id}`}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={editCompMutation.isPending}
                            onClick={() => {
                              const data: any = { ...editForm };
                              if (data.startDateTbd) { data.startDate = null; }
                              else if (data.startDate) { data.startDate = new Date(data.startDate).toISOString(); }
                              else { data.startDate = null; }
                              if (data.endDateTbd) { data.endDate = null; }
                              else if (data.endDate) { data.endDate = new Date(data.endDate).toISOString(); }
                              else { data.endDate = null; }
                              editCompMutation.mutate({ id: comp.id, data });
                            }}
                            className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white"
                            data-testid={`edit-save-${comp.id}`}
                          >
                            <Save className="h-3.5 w-3.5 mr-1" />
                            {editCompMutation.isPending ? "Saving..." : "Save Changes"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {filteredComps.length === 0 && (
                <div className="text-center py-12 text-white/30 text-sm" data-testid="text-no-events">
                  No events found matching your search.
                </div>
              )}
              {totalCompPages > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-2 mt-6" data-testid="event-pagination">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={compPage <= 1}
                    onClick={() => setCompPage(p => p - 1)}
                    className="text-white/60"
                    data-testid="button-event-prev"
                  >
                    Previous
                  </Button>
                  {Array.from({ length: totalCompPages }, (_, i) => i + 1).map(page => (
                    <Button
                      key={page}
                      variant={page === compPage ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setCompPage(page)}
                      className={page === compPage ? "bg-orange-500 text-white" : "text-white/40"}
                      data-testid={`button-event-page-${page}`}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={compPage >= totalCompPages}
                    onClick={() => setCompPage(p => p + 1)}
                    className="text-white/60"
                    data-testid="button-event-next"
                  >
                    Next
                  </Button>
                </div>
              )}
              </>
            )}
          </TabsContent>

          <TabsContent value="contestants">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  placeholder="Search by name, event, or category..."
                  value={contestantSearch}
                  onChange={(e) => setContestantSearch(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  data-testid="input-contestant-search"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {["all", "approved", "pending", "rejected"].map(s => (
                  <Button
                    key={s}
                    variant="ghost"
                    size="sm"
                    onClick={() => setContestantFilter(s)}
                    className={`text-xs sm:text-sm ${contestantFilter === s ? "bg-orange-500/20 text-orange-300" : "text-white/40"}`}
                    data-testid={`button-filter-${s}`}
                  >
                    {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </Button>
                ))}
              </div>
              <span className="text-xs text-white/30">{filteredContestants.length} contestant{filteredContestants.length !== 1 ? "s" : ""}</span>
            </div>

            {filteredContestants.length === 0 ? (
              <div className="text-center py-12 text-white/30" data-testid="no-contestants">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>{allContestants.length === 0 ? "No contestants have applied to your events yet" : "No contestants match your filters"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredContestants.map(c => (
                  <div key={c.id} className="rounded-md bg-white/5 border border-white/5 p-4 flex flex-wrap items-center justify-between gap-3" data-testid={`contestant-card-${c.id}`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={c.talentProfile?.imageUrls?.[0] || ""} />
                        <AvatarFallback className="bg-white/10 text-white text-xs">
                          {(c.talentProfile?.displayName || "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate" data-testid={`contestant-name-${c.id}`}>{c.talentProfile?.displayName || "Unknown"}</p>
                        <p className="text-xs text-white/30 truncate">{c.competitionTitle} {c.talentProfile?.category ? `| ${c.talentProfile.category}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`border-0 text-xs ${c.applicationStatus === "approved" ? "bg-green-500/20 text-green-400" : c.applicationStatus === "rejected" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`} data-testid={`contestant-status-${c.id}`}>
                        {c.applicationStatus}
                      </Badge>
                      {c.applicationStatus === "pending" && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => approveContestantMutation.mutate({ id: c.id, status: "approved" })} data-testid={`button-approve-${c.id}`}>
                            <Check className="h-4 w-4 text-green-400" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => approveContestantMutation.mutate({ id: c.id, status: "rejected" })} data-testid={`button-reject-${c.id}`}>
                            <XIcon className="h-4 w-4 text-red-400" />
                          </Button>
                        </>
                      )}
                      <Link href={"/talent/" + c.talentProfileId} className="text-xs text-orange-400 flex items-center gap-1" data-testid={`link-profile-contestant-${c.id}`}>
                        <ExternalLink className="h-3 w-3" /> Profile
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics">
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-md bg-white/5 border border-white/5 p-4">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Events</p>
                  <p className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">{stats?.totalCompetitions ?? 0}</p>
                </div>
                <div className="rounded-md bg-white/5 border border-white/5 p-4">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Contestants</p>
                  <p className="text-2xl font-bold">{stats?.totalContestants ?? 0}</p>
                </div>
                <div className="rounded-md bg-white/5 border border-white/5 p-4">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Votes</p>
                  <p className="text-2xl font-bold text-orange-400">{stats?.totalVotes ?? 0}</p>
                </div>
                <div className="rounded-md bg-white/5 border border-white/5 p-4">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Pending Apps</p>
                  <p className="text-2xl font-bold text-yellow-400">{stats?.pendingApplications ?? 0}</p>
                </div>
              </div>

              <h3 className="text-xs uppercase tracking-widest text-orange-400 font-bold">Per-Event Analytics</h3>
              {competitions.length === 0 ? (
                <div className="text-center py-12 text-white/30">
                  <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No events to show analytics for</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {competitions.map(comp => (
                    <EventAnalyticsCard key={comp.id} comp={comp} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="calendar">
            {(() => {
              const year = calendarMonth.getFullYear();
              const month = calendarMonth.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const monthName = calendarMonth.toLocaleString("default", { month: "long", year: "numeric" });

              const calendarComps = competitions.filter((c) => {
                if (!c.startDate && !c.endDate) return false;
                const start = c.startDate ? new Date(c.startDate) : null;
                const end = c.endDate ? new Date(c.endDate) : null;
                if (start && start.getFullYear() === year && start.getMonth() === month) return true;
                if (end && end.getFullYear() === year && end.getMonth() === month) return true;
                if (start && end && start <= new Date(year, month + 1, 0) && end >= new Date(year, month, 1)) return true;
                return false;
              });

              const getCompsForDay = (day: number) => {
                const date = new Date(year, month, day);
                return calendarComps.filter((c) => {
                  const start = c.startDate ? new Date(c.startDate) : null;
                  const end = c.endDate ? new Date(c.endDate) : null;
                  const dateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                  const dayTime = dateOnly(date);
                  if (start && dayTime === dateOnly(start)) return true;
                  if (end && dayTime === dateOnly(end)) return true;
                  return false;
                });
              };

              const statusColor = (s: string) => s === "active" || s === "voting" ? "bg-green-500" : s === "upcoming" ? "bg-blue-500" : "bg-zinc-500";
              const days: (number | null)[] = [];
              for (let i = 0; i < firstDay; i++) days.push(null);
              for (let d = 1; d <= daysInMonth; d++) days.push(d);

              return (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" onClick={() => { setCalendarMonth(new Date(year, month - 1, 1)); setCalendarSelectedDay(null); setCalendarSelectedComp(null); }} data-testid="button-calendar-prev">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <h3 className="text-sm sm:text-lg font-serif tracking-wider uppercase text-white min-w-[140px] sm:min-w-[200px] text-center">{monthName}</h3>
                      <Button size="icon" variant="ghost" onClick={() => { setCalendarMonth(new Date(year, month + 1, 1)); setCalendarSelectedDay(null); setCalendarSelectedComp(null); }} data-testid="button-calendar-next">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button variant="ghost" onClick={() => { setCalendarMonth(new Date()); setCalendarSelectedDay(null); }} className="text-xs text-white/50" data-testid="button-calendar-today">Today</Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-white/40">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500 inline-block" /> Active</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-zinc-500 inline-block" /> Other</span>
                    <span className="text-white/25 hidden sm:inline">Dots show start & end dates only</span>
                  </div>

                  <div className="grid grid-cols-7 gap-px bg-white/5 rounded-md overflow-hidden">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                      <div key={d} className="bg-zinc-900 p-1 sm:p-2 text-center text-[10px] sm:text-xs font-semibold text-white/40 uppercase tracking-wider">{d}</div>
                    ))}
                    {days.map((day, i) => {
                      const comps = day ? getCompsForDay(day) : [];
                      const isToday = day !== null && new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
                      const isSelected = day !== null && calendarSelectedDay === day;
                      return (
                        <button
                          key={i}
                          onClick={() => { if (day && comps.length > 0) { setCalendarSelectedDay(isSelected ? null : day); setCalendarSelectedComp(null); } }}
                          disabled={!day || comps.length === 0}
                          className={`bg-zinc-900/80 min-h-[56px] sm:min-h-[100px] p-1.5 sm:p-3 text-left transition-colors ${!day ? "bg-zinc-950/50 cursor-default" : comps.length > 0 ? "cursor-pointer hover:bg-white/5" : "cursor-default"} ${isToday ? "ring-1 ring-inset ring-orange-500/50" : ""} ${isSelected ? "bg-orange-500/10" : ""}`}
                          data-testid={day ? `calendar-day-${day}` : undefined}
                        >
                          {day && (
                            <div className="flex flex-col items-start gap-2">
                              <span className={`text-xs sm:text-sm font-medium ${isToday ? "text-orange-400 font-bold" : isSelected ? "text-orange-300" : "text-white/50"}`}>{day}</span>
                              {comps.length > 0 && comps.length <= 3 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {comps.map((c) => (
                                    <span key={c.id} className={`w-2.5 h-2.5 rounded-full ${statusColor(c.status)}`} title={c.title} />
                                  ))}
                                </div>
                              )}
                              {comps.length > 3 && (
                                <span className="text-[10px] font-semibold text-orange-400/80">3+</span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {calendarSelectedDay !== null && (() => {
                    const dayComps = getCompsForDay(calendarSelectedDay);
                    if (dayComps.length === 0) return null;
                    const dateLabel = new Date(year, month, calendarSelectedDay).toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
                    return (
                      <div className="rounded-md bg-white/5 border border-white/10 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-serif text-white/70">{dateLabel}</h4>
                          <Button size="icon" variant="ghost" onClick={() => { setCalendarSelectedDay(null); setCalendarSelectedComp(null); }} data-testid="button-close-calendar-day">
                            <XIcon className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {dayComps.map((c) => (
                            <div key={c.id}>
                              <button
                                onClick={() => setCalendarSelectedComp(calendarSelectedComp === c.id ? null : c.id)}
                                className={`w-full flex items-center justify-between rounded-md px-3 py-2.5 transition-colors ${calendarSelectedComp === c.id ? "bg-orange-500/15 ring-1 ring-orange-500/30" : "bg-white/5 hover:bg-white/10"}`}
                                data-testid={`calendar-comp-${c.id}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor(c.status)}`} />
                                  <span className="text-sm text-white/80">{c.title}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={`border-0 text-[10px] ${c.status === "active" || c.status === "voting" ? "bg-green-500/20 text-green-400" : "bg-zinc-500/20 text-zinc-400"}`}>
                                    {c.status === "voting" ? "Active" : c.status}
                                  </Badge>
                                  {calendarSelectedComp === c.id ? <ChevronUp className="h-3 w-3 text-white/30" /> : <ChevronDown className="h-3 w-3 text-white/30" />}
                                </div>
                              </button>

                              {calendarSelectedComp === c.id && (
                                <div className="mt-2 ml-4 space-y-3">
                                  {calendarReportLoading ? (
                                    <div className="flex items-center justify-center py-6">
                                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-500 border-t-transparent" />
                                    </div>
                                  ) : calendarReport ? (
                                    <>
                                      <div className="text-xs text-white/40">
                                        {calendarReport.competition.startDate && new Date(calendarReport.competition.startDate).toLocaleDateString()}
                                        {calendarReport.competition.endDate && ` — ${new Date(calendarReport.competition.endDate).toLocaleDateString()}`}
                                      </div>
                                      <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-white/5 rounded-md p-2.5 text-center">
                                          <p className="text-xl font-bold text-orange-400">{calendarReport.totalContestants}</p>
                                          <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Contestants</p>
                                        </div>
                                        <div className="bg-white/5 rounded-md p-2.5 text-center">
                                          <p className="text-xl font-bold text-orange-400">{calendarReport.totalVotes}</p>
                                          <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Total Votes</p>
                                        </div>
                                        <div className="bg-white/5 rounded-md p-2.5 text-center">
                                          <p className="text-xl font-bold text-orange-400">${(calendarReport.totalRevenue / 100).toFixed(2)}</p>
                                          <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Revenue</p>
                                        </div>
                                      </div>
                                      {calendarReport.leaderboard.length > 0 && (
                                        <div>
                                          <h5 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">Leaderboard</h5>
                                          <div className="space-y-1">
                                            {calendarReport.leaderboard.map((entry) => (
                                              <div key={entry.contestantId} className="flex items-center justify-between bg-white/5 rounded px-3 py-1.5">
                                                <div className="flex items-center gap-2">
                                                  <span className={`text-xs font-bold ${entry.rank <= 3 ? "text-orange-400" : "text-white/30"}`}>#{entry.rank}</span>
                                                  <span className="text-sm text-white/80">{entry.displayName}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs">
                                                  <span className="text-white/50">{entry.voteCount} votes</span>
                                                  <span className="text-orange-400 font-medium">{entry.votePercentage}%</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <p className="text-xs text-white/30 text-center py-3">No report data available.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={compDetailId !== null} onOpenChange={(open) => { if (!open) setCompDetailId(null); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-2xl" data-testid="host-comp-detail-modal">
          <DialogHeader>
            <DialogTitle className="text-lg font-serif bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              Competition Details
            </DialogTitle>
          </DialogHeader>
          {compDetailId && <CompetitionDetailModal compId={compDetailId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
