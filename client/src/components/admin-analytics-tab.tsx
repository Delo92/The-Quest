import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart3, Trophy, Users, Vote, TrendingUp, Copy, Check, Share2,
  Trash2, Search, Globe, MapPin, DollarSign, RefreshCw, Link2,
  ChevronLeft, ChevronRight, Eye, Plus, UserPlus, Mail, Pencil
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthToken } from "@/hooks/use-auth";

interface AnalyticsOverview {
  totalVotes: number;
  totalOnline: number;
  totalInPerson: number;
  totalRevenue: number;
  totalCompetitions: number;
  activeCompetitions: number;
  totalContestants: number;
  competitionStats: {
    id: number;
    title: string;
    category: string;
    status: string;
    totalVotes: number;
    onlineVotes: number;
    inPersonVotes: number;
    contestantCount: number;
    revenue: number;
  }[];
  topContestants: {
    id: number;
    name: string;
    competitionTitle: string;
    competitionId: number;
    totalVotes: number;
    onlineVotes: number;
    inPersonVotes: number;
  }[];
}

interface ReferralCode {
  code: string;
  ownerId: string;
  ownerType: "talent" | "host" | "admin" | "custom";
  ownerName: string;
  ownerEmail?: string | null;
  talentProfileId?: number | null;
  competitionId?: number | null;
  contestantId?: number | null;
  createdAt: string;
}

interface ReferralStats {
  code: string;
  ownerId: string;
  ownerType: "talent" | "host" | "admin" | "custom";
  ownerName: string;
  totalVotesDriven: number;
  uniqueVoters: number;
}

interface ReferralData {
  stats: ReferralStats[];
  codes: ReferralCode[];
}

interface VoteDetail {
  total: number;
  online: number;
  inPerson: number;
  referral: number;
  free: number;
  purchased: number;
  byContestant?: Record<number, number>;
  contributors: {
    name: string | null;
    email: string | null;
    userId: string | null;
    contestantId?: number;
    voteCount: number;
    amount: number;
    date: string | null;
  }[];
}

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ef4444", "#eab308"];
const PAGE_SIZE = 10;

export default function AdminAnalyticsTab() {
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [refSearch, setRefSearch] = useState("");
  const [compPage, setCompPage] = useState(0);
  const [contestantPage, setContestantPage] = useState(0);
  const [selectedContestant, setSelectedContestant] = useState<{ id: number; competitionId: number; name: string; competitionTitle: string } | null>(null);
  const [selectedCompetition, setSelectedCompetition] = useState<{ id: number; title: string } | null>(null);
  const [showCreateRef, setShowCreateRef] = useState(false);
  const [newRefName, setNewRefName] = useState("");
  const [newRefEmail, setNewRefEmail] = useState("");
  const [newRefCustomCode, setNewRefCustomCode] = useState("");
  const [newRefCompId, setNewRefCompId] = useState<number | null>(null);
  const [editingRef, setEditingRef] = useState<{ code: string; ownerName: string; ownerEmail: string; ownerType: string; competitionId?: number | null; contestantId?: number | null } | null>(null);
  const [editRefCode, setEditRefCode] = useState("");
  const [editRefName, setEditRefName] = useState("");
  const [editRefEmail, setEditRefEmail] = useState("");
  const [editRefType, setEditRefType] = useState("");
  const [editRefCompId, setEditRefCompId] = useState<number | null>(null);

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsOverview>({
    queryKey: ["/api/analytics/overview"],
    staleTime: 30000,
  });

  const { data: referralData, isLoading: referralLoading } = useQuery<ReferralData>({
    queryKey: ["/api/referral/stats"],
    staleTime: 30000,
  });

  const { data: contestantVoteDetail, isLoading: contestantDetailLoading } = useQuery<VoteDetail>({
    queryKey: ["/api/analytics/contestant", selectedContestant?.id, "competition", selectedContestant?.competitionId, "votes"],
    queryFn: async () => {
      const token = await getAuthToken();
      const res = await fetch(`/api/analytics/contestant/${selectedContestant!.id}/competition/${selectedContestant!.competitionId}/votes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedContestant,
  });

  const { data: competitionVoteDetail, isLoading: competitionDetailLoading } = useQuery<VoteDetail>({
    queryKey: ["/api/analytics/competition", selectedCompetition?.id, "votes"],
    queryFn: async () => {
      const token = await getAuthToken();
      const res = await fetch(`/api/analytics/competition/${selectedCompetition!.id}/votes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedCompetition,
  });

  const deleteMutation = useMutation({
    mutationFn: async (code: string) => {
      await apiRequest("DELETE", `/api/referral/${code}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral/stats"] });
      toast({ title: "Referral code deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete code", variant: "destructive" });
    },
  });

  const generateForAdminMutation = useMutation({
    mutationFn: async () => {
      const token = await getAuthToken();
      const res = await fetch("/api/referral/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral/stats"] });
      toast({ title: "Referral code generated!" });
    },
  });

  const createRefMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; customCode?: string; competitionId?: number | null }) => {
      await apiRequest("POST", "/api/referral/create", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral/stats"] });
      toast({ title: "Referral code created!" });
      setShowCreateRef(false);
      setNewRefName("");
      setNewRefEmail("");
      setNewRefCustomCode("");
      setNewRefCompId(null);
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to create referral code", variant: "destructive" });
    },
  });

  const updateRefMutation = useMutation({
    mutationFn: async (data: { oldCode: string; newCode?: string; ownerName?: string; ownerEmail?: string; ownerType?: string; competitionId?: number | null }) => {
      const { oldCode, ...body } = data;
      await apiRequest("PUT", `/api/referral/${oldCode}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral/stats"] });
      toast({ title: "Referral code updated!" });
      setEditingRef(null);
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to update referral code", variant: "destructive" });
    },
  });

  const handleCopyLink = (code: string) => {
    const url = `${window.location.origin}?ref=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(code);
      toast({ title: "Link copied!", description: `Referral link with code ${code} copied to clipboard.` });
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const handleShareLink = async (code: string, ownerName: string) => {
    const url = `${window.location.origin}?ref=${code}`;
    const text = `Check out The Quest! Use promo code ${code} when you sign up or vote for bonus rewards. Shared by ${ownerName}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "The Quest - Vote & Win!", text, url });
      } catch {}
    } else {
      handleCopyLink(code);
    }
  };

  const stats = referralData?.stats || [];
  const codes = referralData?.codes || [];
  const mergedReferrals = codes.map(c => {
    const s = stats.find(st => st.code === c.code);
    return {
      ...c,
      totalVotesDriven: s?.totalVotesDriven || 0,
      uniqueVoters: s?.uniqueVoters || 0,
    };
  }).sort((a, b) => b.totalVotesDriven - a.totalVotesDriven);

  const filteredReferrals = mergedReferrals.filter(r =>
    r.ownerName.toLowerCase().includes(refSearch.toLowerCase()) ||
    r.code.toLowerCase().includes(refSearch.toLowerCase()) ||
    (r.ownerEmail && r.ownerEmail.toLowerCase().includes(refSearch.toLowerCase()))
  );

  const totalReferralVotes = mergedReferrals.reduce((sum, r) => sum + r.totalVotesDriven, 0);
  const totalUniqueVoters = mergedReferrals.reduce((sum, r) => sum + r.uniqueVoters, 0);

  const compStats = analytics?.competitionStats || [];
  const compPageCount = Math.ceil(compStats.length / PAGE_SIZE);
  const pagedComps = compStats.slice(compPage * PAGE_SIZE, (compPage + 1) * PAGE_SIZE);

  const allContestants = analytics?.topContestants || [];
  const contestantPageCount = Math.ceil(allContestants.length / PAGE_SIZE);
  const pagedContestants = allContestants.slice(contestantPage * PAGE_SIZE, (contestantPage + 1) * PAGE_SIZE);

  const buildPieData = (detail: VoteDetail) => {
    const data = [];
    if (detail.online > 0) data.push({ name: "Online", value: detail.online });
    if (detail.inPerson > 0) data.push({ name: "In-Person", value: detail.inPerson });
    return data;
  };

  const buildSourcePieData = (detail: VoteDetail) => {
    const data = [];
    if (detail.free > 0) data.push({ name: "Free Votes", value: detail.free });
    if (detail.purchased > 0) data.push({ name: "Purchased", value: detail.purchased });
    if (detail.referral > 0) data.push({ name: "Via Referral", value: detail.referral });
    return data;
  };

  return (
    <Tabs defaultValue="voting">
      <TabsList className="bg-white/5 border border-white/5 mb-6">
        <TabsTrigger value="voting" className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white" data-testid="analytics-tab-voting">
          <BarChart3 className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Voting Analytics</span>
        </TabsTrigger>
        <TabsTrigger value="referrals" className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white" data-testid="analytics-tab-referrals">
          <Link2 className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Referral System</span>
        </TabsTrigger>
      </TabsList>

      {/* ── Voting Analytics Sub-Tab ──────────────────── */}
      <TabsContent value="voting">
        {analyticsLoading ? (
          <div className="text-center py-20 text-white/40">Loading analytics...</div>
        ) : analytics ? (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Vote} label="Total Votes" value={analytics.totalVotes.toLocaleString()} color="text-orange-400" />
              <StatCard icon={Globe} label="Online Votes" value={analytics.totalOnline.toLocaleString()} color="text-blue-400" />
              <StatCard icon={MapPin} label="In-Person Votes" value={analytics.totalInPerson.toLocaleString()} color="text-green-400" />
              <StatCard icon={DollarSign} label="Revenue" value={`$${analytics.totalRevenue.toFixed(2)}`} color="text-emerald-400" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard icon={Trophy} label="Total Competitions" value={String(analytics.totalCompetitions)} color="text-amber-400" />
              <StatCard icon={TrendingUp} label="Active/Voting" value={String(analytics.activeCompetitions)} color="text-orange-400" />
              <StatCard icon={Users} label="Approved Contestants" value={String(analytics.totalContestants)} color="text-purple-400" />
            </div>

            {analytics.totalVotes > 0 && (
              <div className="rounded-md bg-white/5 border border-white/5 p-5">
                <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Vote Source Breakdown</h3>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 bg-white/10 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                      style={{ width: `${(analytics.totalOnline / analytics.totalVotes * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-white/60 w-24 text-right">
                    Online {Math.round(analytics.totalOnline / analytics.totalVotes * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white/10 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                      style={{ width: `${(analytics.totalInPerson / analytics.totalVotes * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-white/60 w-24 text-right">
                    In-Person {Math.round(analytics.totalInPerson / analytics.totalVotes * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Competition Performance - paginated */}
            <div className="rounded-md bg-white/5 border border-white/5 p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Competition Performance</h3>
                {compPageCount > 1 && (
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" className="text-white/40" disabled={compPage === 0} onClick={() => setCompPage(p => p - 1)} data-testid="button-comp-prev">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-white/50">{compPage + 1} / {compPageCount}</span>
                    <Button size="icon" variant="ghost" className="text-white/40" disabled={compPage >= compPageCount - 1} onClick={() => setCompPage(p => p + 1)} data-testid="button-comp-next">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-white/50 pb-3 pr-4 font-medium">Competition</th>
                      <th className="text-left text-white/50 pb-3 pr-4 font-medium">Category</th>
                      <th className="text-right text-white/50 pb-3 pr-4 font-medium">Votes</th>
                      <th className="text-right text-white/50 pb-3 pr-4 font-medium">Online</th>
                      <th className="text-right text-white/50 pb-3 pr-4 font-medium">In-Person</th>
                      <th className="text-right text-white/50 pb-3 pr-4 font-medium">Contestants</th>
                      <th className="text-right text-white/50 pb-3 pr-4 font-medium">Revenue</th>
                      <th className="text-right text-white/50 pb-3 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedComps.map(comp => (
                      <tr key={comp.id} className="border-b border-white/5 cursor-pointer" onClick={() => setSelectedCompetition({ id: comp.id, title: comp.title })} data-testid={`analytics-comp-${comp.id}`}>
                        <td className="py-3 pr-4 text-white font-medium">{comp.title}</td>
                        <td className="py-3 pr-4">
                          <Badge className="bg-orange-500/20 text-orange-300 border-0 text-[10px]">{comp.category}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-right text-orange-400 font-bold">{comp.totalVotes.toLocaleString()}</td>
                        <td className="py-3 pr-4 text-right text-blue-300">{comp.onlineVotes.toLocaleString()}</td>
                        <td className="py-3 pr-4 text-right text-green-300">{comp.inPersonVotes.toLocaleString()}</td>
                        <td className="py-3 pr-4 text-right text-white/60">{comp.contestantCount}</td>
                        <td className="py-3 pr-4 text-right text-emerald-400">${comp.revenue.toFixed(2)}</td>
                        <td className="py-3 text-right">
                          <Button size="icon" variant="ghost" className="text-orange-400/60" data-testid={`button-comp-detail-${comp.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Contestants - paginated */}
            <div className="rounded-md bg-white/5 border border-white/5 p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Top Contestants</h3>
                {contestantPageCount > 1 && (
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" className="text-white/40" disabled={contestantPage === 0} onClick={() => setContestantPage(p => p - 1)} data-testid="button-contestant-prev">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-white/50">{contestantPage + 1} / {contestantPageCount}</span>
                    <Button size="icon" variant="ghost" className="text-white/40" disabled={contestantPage >= contestantPageCount - 1} onClick={() => setContestantPage(p => p + 1)} data-testid="button-contestant-next">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-white/50 pb-3 pr-4 font-medium">#</th>
                      <th className="text-left text-white/50 pb-3 pr-4 font-medium">Contestant</th>
                      <th className="text-left text-white/50 pb-3 pr-4 font-medium">Competition</th>
                      <th className="text-right text-white/50 pb-3 pr-4 font-medium">Total</th>
                      <th className="text-right text-white/50 pb-3 pr-4 font-medium">Online</th>
                      <th className="text-right text-white/50 pb-3 pr-4 font-medium">In-Person</th>
                      <th className="text-right text-white/50 pb-3 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedContestants.map((c, i) => (
                      <tr
                        key={`${c.id}-${c.competitionId}`}
                        className="border-b border-white/5 cursor-pointer"
                        onClick={() => setSelectedContestant({ id: c.id, competitionId: c.competitionId, name: c.name, competitionTitle: c.competitionTitle })}
                        data-testid={`analytics-contestant-${c.id}`}
                      >
                        <td className="py-3 pr-4 text-white/40 font-mono">{contestantPage * PAGE_SIZE + i + 1}</td>
                        <td className="py-3 pr-4 text-white font-medium">{c.name}</td>
                        <td className="py-3 pr-4 text-white/60">{c.competitionTitle}</td>
                        <td className="py-3 pr-4 text-right text-orange-400 font-bold">{c.totalVotes.toLocaleString()}</td>
                        <td className="py-3 pr-4 text-right text-blue-300">{c.onlineVotes.toLocaleString()}</td>
                        <td className="py-3 pr-4 text-right text-green-300">{c.inPersonVotes.toLocaleString()}</td>
                        <td className="py-3 text-right">
                          <Button size="icon" variant="ghost" className="text-orange-400/60" data-testid={`button-contestant-detail-${c.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {allContestants.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-white/30">No contestant data yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-white/40">Failed to load analytics</div>
        )}
      </TabsContent>

      {/* ── Referral System Sub-Tab ──────────────────── */}
      <TabsContent value="referrals">
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Link2} label="Total Referral Codes" value={String(mergedReferrals.length)} color="text-orange-400" />
            <StatCard icon={Vote} label="Votes via Referrals" value={totalReferralVotes.toLocaleString()} color="text-blue-400" />
            <StatCard icon={Users} label="Unique Voters Referred" value={totalUniqueVoters.toLocaleString()} color="text-green-400" />
            <StatCard icon={TrendingUp} label="Top Referrer Votes" value={mergedReferrals.length > 0 ? mergedReferrals[0].totalVotesDriven.toLocaleString() : "0"} color="text-purple-400" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                placeholder="Search by name, email, or code..."
                value={refSearch}
                onChange={(e) => setRefSearch(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                data-testid="input-referral-search"
              />
            </div>
            <Button
              variant="outline"
              className="border-orange-500/50 text-orange-400"
              onClick={() => setShowCreateRef(true)}
              data-testid="button-create-referral"
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Referral
            </Button>
            <Button
              variant="outline"
              className="border-orange-500/50 text-orange-400"
              onClick={() => generateForAdminMutation.mutate()}
              disabled={generateForAdminMutation.isPending}
              data-testid="button-generate-admin-referral"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${generateForAdminMutation.isPending ? "animate-spin" : ""}`} />
              Generate My Code
            </Button>
            <Button
              variant="ghost"
              className="text-white/50"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/referral/stats"] })}
              data-testid="button-refresh-referrals"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {referralLoading ? (
            <div className="text-center py-20 text-white/40">Loading referral data...</div>
          ) : (
            <div className="rounded-md bg-white/5 border border-white/5 p-5">
              <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Referral Leaderboard</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-white/50 pb-3 pr-4 font-medium">#</th>
                      <th className="text-left text-white/50 pb-3 pr-4 font-medium">Name</th>
                      <th className="text-left text-white/50 pb-3 pr-4 font-medium">Email</th>
                      <th className="text-left text-white/50 pb-3 pr-4 font-medium">Type</th>
                      <th className="text-left text-white/50 pb-3 pr-4 font-medium">Code</th>
                      <th className="text-left text-white/50 pb-3 pr-4 font-medium">Competition</th>
                      <th className="text-right text-white/50 pb-3 pr-4 font-medium">Votes Driven</th>
                      <th className="text-right text-white/50 pb-3 pr-4 font-medium">Unique Voters</th>
                      <th className="text-right text-white/50 pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReferrals.map((r, i) => (
                      <tr key={r.code} className="border-b border-white/5" data-testid={`referral-row-${r.code}`}>
                        <td className="py-3 pr-4 text-white/40 font-mono">{i + 1}</td>
                        <td className="py-3 pr-4 text-white font-medium">{r.ownerName}</td>
                        <td className="py-3 pr-4 text-white/50 text-xs">{r.ownerEmail || "-"}</td>
                        <td className="py-3 pr-4">
                          <Badge className={`border-0 text-[10px] ${
                            r.ownerType === "admin" ? "bg-red-500/20 text-red-300" :
                            r.ownerType === "host" ? "bg-blue-500/20 text-blue-300" :
                            r.ownerType === "custom" ? "bg-purple-500/20 text-purple-300" :
                            "bg-orange-500/20 text-orange-300"
                          }`}>
                            {r.ownerType}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <code className="bg-white/10 px-2 py-0.5 rounded text-orange-300 text-xs font-mono">{r.code}</code>
                        </td>
                        <td className="py-3 pr-4 text-white/50 text-xs">
                          {r.competitionId ? (
                            <span className="bg-white/10 px-2 py-0.5 rounded text-blue-300 text-[10px]">
                              {analytics?.competitionStats?.find(c => c.id === r.competitionId)?.title || `#${r.competitionId}`}
                            </span>
                          ) : (
                            <span className="text-white/20">All</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right text-orange-400 font-bold">{r.totalVotesDriven.toLocaleString()}</td>
                        <td className="py-3 pr-4 text-right text-white/60">{r.uniqueVoters.toLocaleString()}</td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-white/40"
                              onClick={() => {
                                setEditingRef({ code: r.code, ownerName: r.ownerName, ownerEmail: r.ownerEmail || "", ownerType: r.ownerType, competitionId: r.competitionId, contestantId: r.contestantId });
                                setEditRefCode(r.code);
                                setEditRefName(r.ownerName);
                                setEditRefEmail(r.ownerEmail || "");
                                setEditRefType(r.ownerType);
                                setEditRefCompId(r.competitionId || null);
                              }}
                              data-testid={`button-edit-ref-${r.code}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-white/40"
                              onClick={() => handleCopyLink(r.code)}
                              data-testid={`button-copy-ref-${r.code}`}
                            >
                              {copiedCode === r.code ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-white/40"
                              onClick={() => handleShareLink(r.code, r.ownerName)}
                              data-testid={`button-share-ref-${r.code}`}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-red-400/60"
                              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(r.code); }}
                              data-testid={`button-delete-ref-${r.code}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredReferrals.length === 0 && (
                      <tr><td colSpan={9} className="py-8 text-center text-white/30">No referral codes yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      {/* ── Contestant Vote Detail Modal ──────────────── */}
      <Dialog open={!!selectedContestant} onOpenChange={(open) => { if (!open) setSelectedContestant(null); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-orange-400 uppercase tracking-wider text-sm">
              Vote Details: {selectedContestant?.name}
            </DialogTitle>
          </DialogHeader>
          {contestantDetailLoading ? (
            <div className="text-center py-10 text-white/40">Loading vote details...</div>
          ) : contestantVoteDetail ? (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-400">{contestantVoteDetail.total}</div>
                <div className="text-xs text-white/50 mt-1">Total Votes in {selectedContestant?.competitionTitle}</div>
              </div>

              {contestantVoteDetail.total > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs text-white/50 uppercase tracking-wider mb-2 text-center">Source</h4>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={buildPieData(contestantVoteDetail)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {buildPieData(contestantVoteDetail).map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h4 className="text-xs text-white/50 uppercase tracking-wider mb-2 text-center">Type</h4>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={buildSourcePieData(contestantVoteDetail)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {buildSourcePieData(contestantVoteDetail).map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[(idx + 2) % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-white/5 p-3">
                  <div className="text-lg font-bold text-blue-400">{contestantVoteDetail.online}</div>
                  <div className="text-[10px] text-white/40">Online</div>
                </div>
                <div className="rounded-md bg-white/5 p-3">
                  <div className="text-lg font-bold text-green-400">{contestantVoteDetail.inPerson}</div>
                  <div className="text-[10px] text-white/40">In-Person</div>
                </div>
                <div className="rounded-md bg-white/5 p-3">
                  <div className="text-lg font-bold text-purple-400">{contestantVoteDetail.purchased}</div>
                  <div className="text-[10px] text-white/40">Purchased</div>
                </div>
              </div>

              {contestantVoteDetail.contributors.length > 0 && (
                <div>
                  <h4 className="text-xs text-white/50 uppercase tracking-wider mb-3">Vote Contributors (Purchases)</h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {contestantVoteDetail.contributors.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 rounded-md bg-white/5 p-3 text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{c.name || c.userId || "Anonymous"}</div>
                          {c.email && <div className="text-white/40 truncate">{c.email}</div>}
                          {c.date && <div className="text-white/30">{new Date(c.date).toLocaleDateString()}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-orange-400 font-bold">{c.voteCount} votes</div>
                          <div className="text-emerald-400">${c.amount.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {contestantVoteDetail.contributors.length === 0 && contestantVoteDetail.total > 0 && (
                <div className="text-center text-white/30 text-xs py-3">All votes are free (no purchases yet)</div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-white/40">Failed to load details</div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Competition Vote Detail Modal ──────────────── */}
      <Dialog open={!!selectedCompetition} onOpenChange={(open) => { if (!open) setSelectedCompetition(null); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-orange-400 uppercase tracking-wider text-sm">
              Vote Details: {selectedCompetition?.title}
            </DialogTitle>
          </DialogHeader>
          {competitionDetailLoading ? (
            <div className="text-center py-10 text-white/40">Loading vote details...</div>
          ) : competitionVoteDetail ? (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-400">{competitionVoteDetail.total}</div>
                <div className="text-xs text-white/50 mt-1">Total Votes</div>
              </div>

              {competitionVoteDetail.total > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs text-white/50 uppercase tracking-wider mb-2 text-center">Source</h4>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={buildPieData(competitionVoteDetail)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {buildPieData(competitionVoteDetail).map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h4 className="text-xs text-white/50 uppercase tracking-wider mb-2 text-center">Type</h4>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={buildSourcePieData(competitionVoteDetail)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {buildSourcePieData(competitionVoteDetail).map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[(idx + 2) % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-white/5 p-3">
                  <div className="text-lg font-bold text-blue-400">{competitionVoteDetail.online}</div>
                  <div className="text-[10px] text-white/40">Online</div>
                </div>
                <div className="rounded-md bg-white/5 p-3">
                  <div className="text-lg font-bold text-green-400">{competitionVoteDetail.inPerson}</div>
                  <div className="text-[10px] text-white/40">In-Person</div>
                </div>
                <div className="rounded-md bg-white/5 p-3">
                  <div className="text-lg font-bold text-purple-400">{competitionVoteDetail.purchased}</div>
                  <div className="text-[10px] text-white/40">Purchased</div>
                </div>
              </div>

              {competitionVoteDetail.contributors.length > 0 && (
                <div>
                  <h4 className="text-xs text-white/50 uppercase tracking-wider mb-3">Vote Contributors (Purchases)</h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {competitionVoteDetail.contributors.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 rounded-md bg-white/5 p-3 text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{c.name || c.userId || "Anonymous"}</div>
                          {c.email && <div className="text-white/40 truncate">{c.email}</div>}
                          {c.date && <div className="text-white/30">{new Date(c.date).toLocaleDateString()}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-orange-400 font-bold">{c.voteCount} votes</div>
                          <div className="text-emerald-400">${c.amount.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {competitionVoteDetail.contributors.length === 0 && competitionVoteDetail.total > 0 && (
                <div className="text-center text-white/30 text-xs py-3">All votes are free (no purchases yet)</div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-white/40">Failed to load details</div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Referral Code Modal ──────────────── */}
      <Dialog open={showCreateRef} onOpenChange={setShowCreateRef}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-orange-400 uppercase tracking-wider text-sm flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Create Referral Code
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/60 text-xs">Name *</Label>
              <Input
                placeholder="Referral holder name"
                value={newRefName}
                onChange={(e) => setNewRefName(e.target.value)}
                className="bg-white/5 border-white/10 text-white mt-1"
                data-testid="input-create-ref-name"
              />
            </div>
            <div>
              <Label className="text-white/60 text-xs">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  placeholder="email@example.com"
                  type="email"
                  value={newRefEmail}
                  onChange={(e) => setNewRefEmail(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white"
                  data-testid="input-create-ref-email"
                />
              </div>
            </div>
            <div>
              <Label className="text-white/60 text-xs">Custom Code (optional)</Label>
              <Input
                placeholder="e.g. ALOHA2025 (leave blank for auto-generated)"
                value={newRefCustomCode}
                onChange={(e) => setNewRefCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                maxLength={20}
                className="bg-white/5 border-white/10 text-white mt-1 font-mono uppercase"
                data-testid="input-create-ref-custom-code"
              />
              <p className="text-white/30 text-[10px] mt-1">3-20 characters: letters, numbers, dashes, underscores</p>
            </div>
            <div>
              <Label className="text-white/60 text-xs">Competition (optional)</Label>
              <select
                value={newRefCompId ?? ""}
                onChange={(e) => setNewRefCompId(e.target.value ? Number(e.target.value) : null)}
                className="w-full mt-1 rounded-md bg-white/5 border border-white/10 text-white px-3 py-2 text-sm"
                data-testid="select-create-ref-competition"
              >
                <option value="" className="bg-zinc-900">All Competitions</option>
                {(analytics?.competitionStats || []).map(c => (
                  <option key={c.id} value={c.id} className="bg-zinc-900">{c.title} ({c.category})</option>
                ))}
              </select>
              <p className="text-white/30 text-[10px] mt-1">Optionally link this code to a specific competition</p>
            </div>
            <Button
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white"
              onClick={() => createRefMutation.mutate({ name: newRefName, email: newRefEmail, customCode: newRefCustomCode || undefined, competitionId: newRefCompId })}
              disabled={!newRefName.trim() || createRefMutation.isPending || (newRefCustomCode.length > 0 && newRefCustomCode.length < 3)}
              data-testid="button-submit-create-referral"
            >
              {createRefMutation.isPending ? "Creating..." : "Create Referral Code"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Referral Code Modal ──────────────── */}
      <Dialog open={!!editingRef} onOpenChange={(open) => { if (!open) setEditingRef(null); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-orange-400 uppercase tracking-wider text-sm flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Edit Referral Code
            </DialogTitle>
          </DialogHeader>
          {editingRef && (
            <div className="space-y-4">
              <div>
                <Label className="text-white/60 text-xs">Code</Label>
                <Input
                  value={editRefCode}
                  onChange={(e) => setEditRefCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                  maxLength={20}
                  className="bg-white/5 border-white/10 text-white mt-1 font-mono uppercase"
                  data-testid="input-edit-ref-code"
                />
                <p className="text-white/30 text-[10px] mt-1">3-20 characters: letters, numbers, dashes, underscores</p>
              </div>
              <div>
                <Label className="text-white/60 text-xs">Name</Label>
                <Input
                  value={editRefName}
                  onChange={(e) => setEditRefName(e.target.value)}
                  className="bg-white/5 border-white/10 text-white mt-1"
                  data-testid="input-edit-ref-name"
                />
              </div>
              <div>
                <Label className="text-white/60 text-xs">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input
                    placeholder="email@example.com"
                    type="email"
                    value={editRefEmail}
                    onChange={(e) => setEditRefEmail(e.target.value)}
                    className="pl-10 bg-white/5 border-white/10 text-white"
                    data-testid="input-edit-ref-email"
                  />
                </div>
              </div>
              <div>
                <Label className="text-white/60 text-xs">Type</Label>
                <select
                  value={editRefType}
                  onChange={(e) => setEditRefType(e.target.value)}
                  className="w-full mt-1 rounded-md bg-white/5 border border-white/10 text-white px-3 py-2 text-sm"
                  data-testid="select-edit-ref-type"
                >
                  <option value="talent" className="bg-zinc-900">Talent</option>
                  <option value="host" className="bg-zinc-900">Host</option>
                  <option value="admin" className="bg-zinc-900">Admin</option>
                  <option value="custom" className="bg-zinc-900">Custom</option>
                </select>
              </div>
              <div>
                <Label className="text-white/60 text-xs">Competition</Label>
                <select
                  value={editRefCompId ?? ""}
                  onChange={(e) => setEditRefCompId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full mt-1 rounded-md bg-white/5 border border-white/10 text-white px-3 py-2 text-sm"
                  data-testid="select-edit-ref-competition"
                >
                  <option value="" className="bg-zinc-900">All Competitions</option>
                  {(analytics?.competitionStats || []).map(c => (
                    <option key={c.id} value={c.id} className="bg-zinc-900">{c.title} ({c.category})</option>
                  ))}
                </select>
                <p className="text-white/30 text-[10px] mt-1">Link this code to a specific competition or leave as "All"</p>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white"
                onClick={() => {
                  updateRefMutation.mutate({
                    oldCode: editingRef.code,
                    newCode: editRefCode !== editingRef.code ? editRefCode : undefined,
                    ownerName: editRefName,
                    ownerEmail: editRefEmail,
                    ownerType: editRefType,
                    competitionId: editRefCompId,
                  });
                }}
                disabled={!editRefName.trim() || editRefCode.length < 3 || updateRefMutation.isPending}
                data-testid="button-submit-edit-referral"
              >
                {updateRefMutation.isPending ? "Updating..." : "Save Changes"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="rounded-md bg-white/5 border border-white/5 p-4" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <Icon className={`h-5 w-5 ${color} mb-2`} />
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-white/40 mt-1">{label}</div>
    </div>
  );
}
