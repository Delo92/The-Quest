import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, AlertCircle, Info, ShieldAlert,
  ChevronDown, ChevronRight, RefreshCw, Search,
  BarChart3, TrendingUp, Users, Eye, Clock,
  Globe, FileText, Loader2, Activity, Tv2, CheckCircle2, XCircle,
} from "lucide-react";

interface ErrorLog {
  id: string;
  errorType: string;
  severity: string;
  message: string;
  stackTrace?: string;
  userUid?: string;
  userName?: string;
  userEmail?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  context?: Record<string, any>;
  wasShownToUser?: boolean;
  timestamp: string;
  createdAt: string;
}

interface GA4Data {
  overview: {
    activeUsers: number;
    sessions: number;
    pageViews: number;
    avgSessionDuration: number;
    bounceRate: number;
    newUsers: number;
  };
  topPages: Array<{ path: string; views: number; users: number }>;
  dailyData: Array<{ date: string; users: number; sessions: number; pageViews: number }>;
  trafficSources: Array<{ source: string; sessions: number }>;
}

const severityColors: Record<string, string> = {
  critical: "bg-red-950/40 text-red-300 border-red-800/40",
  error: "bg-orange-950/40 text-orange-300 border-orange-800/40",
  warning: "bg-yellow-950/40 text-yellow-300 border-yellow-800/40",
  info: "bg-blue-950/40 text-blue-300 border-blue-800/40",
};

const SeverityIcon = ({ severity }: { severity: string }) => {
  const icons: Record<string, any> = {
    critical: ShieldAlert, error: AlertCircle, warning: AlertTriangle, info: Info,
  };
  const Icon = icons[severity] || Info;
  return <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />;
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function MiniBarChart({ data, dataKey, maxHeight = 80 }: {
  data: Array<Record<string, any>>; dataKey: string; maxHeight?: number;
}) {
  if (!data.length) return null;
  const values = data.map(d => d[dataKey] as number);
  const max = Math.max(...values, 1);
  const barW = Math.max(3, Math.min(16, Math.floor(560 / data.length) - 2));
  return (
    <div className="flex items-end gap-[2px]" style={{ height: maxHeight }}>
      {data.map((d, i) => {
        const h = Math.max(2, (d[dataKey] / max) * (maxHeight - 4));
        return (
          <div
            key={i}
            className="bg-orange-500/70 hover:bg-orange-500 rounded-t transition-colors cursor-default flex-shrink-0"
            style={{ width: barW, height: h }}
            title={`${d.date}: ${d[dataKey]}`}
          />
        );
      })}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, sub }: {
  label: string; value: string | number; icon: any; sub?: string;
}) {
  return (
    <div className="rounded-md bg-white/5 border border-white/10 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/50">{label}</span>
        <Icon className="h-4 w-4 text-white/30" />
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
      {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
    </div>
  );
}

function AnalyticsTab() {
  const [dateRange, setDateRange] = useState("30d");

  const { data, isLoading, error, refetch } = useQuery<GA4Data>({
    queryKey: ["/api/admin/ga4-analytics", dateRange],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/ga4-analytics?dateRange=${dateRange}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to fetch analytics");
      return json.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const rangeLabel: Record<string, string> = {
    "1d": "1 day", "3d": "3 days", "7d": "7 days",
    "30d": "30 days", "90d": "90 days", "1y": "1 year",
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting to Google Analytics...
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 bg-white/5" />)}
        </div>
        <Skeleton className="h-40 bg-white/5" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-48 bg-white/5" />
          <Skeleton className="h-48 bg-white/5" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    const msg = (error as Error)?.message || "";
    const isNotConfigured = msg.includes("GA4_PROPERTY_ID");
    return (
      <div className="rounded-md bg-white/5 border border-white/10 p-10 text-center space-y-3">
        <BarChart3 className="h-10 w-10 mx-auto text-white/20" />
        <p className="font-medium text-white">
          {isNotConfigured ? "GA4 Property ID not configured" : "Analytics unavailable"}
        </p>
        <p className="text-sm text-white/50 max-w-md mx-auto">
          {isNotConfigured
            ? "Add your numeric GA4 Property ID as the GA4_PROPERTY_ID secret to enable live traffic data."
            : msg || "Could not connect to Google Analytics. Check that the service account has Viewer access and the Analytics Data API is enabled."}
        </p>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-2 border-white/20 text-white hover:bg-white/10">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      </div>
    );
  }

  const { overview, topPages, dailyData, trafficSources } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-white/50">Last {rangeLabel[dateRange]}</p>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            GA4 Connected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => refetch()} className="gap-2 text-white/60 hover:text-white hover:bg-white/10">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-36 bg-white/[0.08] border-white/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/10 text-white">
              <SelectItem value="1d">Last 1 day</SelectItem>
              <SelectItem value="3d">Last 3 days</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Active Users" value={overview.activeUsers.toLocaleString()} icon={Users} />
        <StatCard label="New Users" value={overview.newUsers.toLocaleString()} icon={TrendingUp} />
        <StatCard label="Sessions" value={overview.sessions.toLocaleString()} icon={Activity} />
        <StatCard label="Page Views" value={overview.pageViews.toLocaleString()} icon={Eye} />
        <StatCard label="Avg. Duration" value={formatDuration(overview.avgSessionDuration)} icon={Clock} />
        <StatCard label="Bounce Rate" value={`${(overview.bounceRate * 100).toFixed(1)}%`} icon={TrendingUp} />
      </div>

      {dailyData.length > 0 && (
        <div className="rounded-md bg-white/5 border border-white/10 p-4">
          <p className="text-sm font-medium text-white/70 mb-3">Daily Users</p>
          <MiniBarChart data={dailyData} dataKey="users" maxHeight={100} />
          <div className="flex justify-between text-xs text-white/30 mt-1">
            <span>{dailyData[0]?.date}</span>
            <span>{dailyData[dailyData.length - 1]?.date}</span>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-md bg-white/5 border border-white/10 p-4 space-y-3">
          <p className="text-sm font-medium text-white/70 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Top Pages
          </p>
          {topPages.length === 0 ? (
            <p className="text-sm text-white/30">No page data yet</p>
          ) : topPages.map((page, i) => {
            const maxViews = topPages[0]?.views || 1;
            return (
              <div key={i} className="space-y-0.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate text-white/50 font-mono text-xs max-w-[65%]">{page.path}</span>
                  <span className="font-medium text-white">{page.views.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500/60 rounded-full" style={{ width: `${(page.views / maxViews) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-md bg-white/5 border border-white/10 p-4 space-y-3">
          <p className="text-sm font-medium text-white/70 flex items-center gap-2">
            <Globe className="h-4 w-4" /> Traffic Sources
          </p>
          {trafficSources.length === 0 ? (
            <p className="text-sm text-white/30">No source data yet</p>
          ) : trafficSources.map((src, i) => {
            const maxSessions = trafficSources[0]?.sessions || 1;
            return (
              <div key={i} className="space-y-0.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate text-white/50">{src.source}</span>
                  <span className="font-medium text-white">{src.sessions.toLocaleString()} sessions</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500/60 rounded-full" style={{ width: `${(src.sessions / maxSessions) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ErrorLogsTab() {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  });
  if (severityFilter !== "all") params.set("severity", severityFilter);
  if (typeFilter !== "all") params.set("errorType", typeFilter);

  const { data, isLoading, refetch } = useQuery<{ logs: ErrorLog[]; total: number }>({
    queryKey: ["/api/admin/error-logs", severityFilter, typeFilter, page],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/error-logs?${params}`);
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;

  const filtered = search
    ? logs.filter(l =>
        l.message.toLowerCase().includes(search.toLowerCase()) ||
        l.errorType.toLowerCase().includes(search.toLowerCase()) ||
        l.endpoint?.toLowerCase().includes(search.toLowerCase()) ||
        l.userEmail?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(0); }}>
            <SelectTrigger className="w-36 bg-white/[0.08] border-white/20 text-white" data-testid="select-severity-filter">
              <SelectValue placeholder="All severities" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/10 text-white">
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
            <SelectTrigger className="w-44 bg-white/[0.08] border-white/20 text-white" data-testid="select-type-filter">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/10 text-white">
              <SelectItem value="all">All types</SelectItem>
              {[
                "api", "client", "payment", "authentication", "email",
                "database", "system", "validation", "form_upload", "admin_operation_error", "uncategorized",
              ].map(t => (
                <SelectItem key={t} value={t}>
                  {t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 w-52 h-9 bg-white/[0.08] border-white/20 text-white placeholder:text-white/30"
              data-testid="input-log-search"
            />
          </div>
          <Button size="sm" variant="ghost" onClick={() => refetch()} className="gap-1.5 text-white/60 hover:text-white hover:bg-white/10" data-testid="button-refresh-logs">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 bg-white/5" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md bg-white/5 border border-white/10 p-10 text-center">
          <Activity className="h-10 w-10 mx-auto text-white/20 mb-3" />
          <p className="text-white/40">
            {search ? "No logs match your search" : "No error logs yet — that's a good sign!"}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(log => (
            <div
              key={log.id}
              className={`border rounded-lg overflow-hidden transition-colors ${severityColors[log.severity] || "bg-white/5 border-white/10 text-white/80"}`}
              data-testid={`log-entry-${log.id}`}
            >
              <button
                className="w-full text-left p-3 flex items-start gap-3"
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              >
                <SeverityIcon severity={log.severity} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs font-mono border-current/30 bg-black/20">{log.errorType}</Badge>
                    <span className="text-sm font-medium truncate">{log.message}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs opacity-60 flex-wrap">
                    {log.endpoint && <span>{log.method} {log.endpoint}</span>}
                    {log.userEmail && <span>{log.userEmail}</span>}
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                {expanded === log.id
                  ? <ChevronDown className="h-4 w-4 flex-shrink-0 mt-0.5 opacity-60" />
                  : <ChevronRight className="h-4 w-4 flex-shrink-0 mt-0.5 opacity-60" />}
              </button>

              {expanded === log.id && (
                <div className="px-4 pb-4 space-y-2 border-t border-current/10">
                  {log.userEmail && (
                    <div className="text-xs mt-2">
                      <span className="font-medium">User: </span>
                      {log.userName && <span>{log.userName} — </span>}
                      <span>{log.userEmail}</span>
                      {log.userUid && <span className="opacity-50 ml-1">({log.userUid})</span>}
                    </div>
                  )}
                  {log.statusCode && (
                    <div className="text-xs">
                      <span className="font-medium">Status: </span>{log.statusCode}
                    </div>
                  )}
                  {log.context && Object.keys(log.context).length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium">Context:</span>
                      <pre className="mt-1 bg-black/20 rounded p-2 overflow-x-auto text-xs whitespace-pre-wrap">
                        {JSON.stringify(log.context, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.stackTrace && (
                    <div className="text-xs">
                      <span className="font-medium">Stack trace:</span>
                      <pre className="mt-1 bg-black/20 rounded p-2 overflow-x-auto text-xs whitespace-pre-wrap opacity-70">
                        {log.stackTrace}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-white/40 pt-2">
          <span>{total} total logs</span>
          <div className="flex gap-2">
            <Button
              size="sm" variant="outline"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Previous
            </Button>
            <Button
              size="sm" variant="outline"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage(p => p + 1)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChronicTVSyncTab() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSync() {
    setRunning(true);
    setResults(null);
    setError(null);
    try {
      const res = await apiRequest("POST", "/api/admin/vimeo/sync-chronicTV");
      const data = await res.json();
      setResults(data.results || []);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="bg-white/[0.04] border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <Tv2 className="h-4 w-4 text-orange-400" />
          ChronicTV Vimeo Sync
        </CardTitle>
        <p className="text-xs text-white/40 mt-1">
          Links all existing contestant videos into the ChronicTV Vimeo folder tree
          (ChronicTV → Originals → CB Publishing The Quest → Competition → Talent).
          Safe to run multiple times — Vimeo ignores duplicate folder links.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={runSync}
          disabled={running}
          data-testid="button-chronicTV-sync"
          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:opacity-90"
        >
          {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing…</> : <><RefreshCw className="h-4 w-4 mr-2" /> Run ChronicTV Sync</>}
        </Button>

        {error && (
          <div className="text-red-400 text-sm flex items-center gap-2">
            <XCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {results && (
          <div className="space-y-3">
            <p className="text-white/60 text-xs">Processed {results.length} contestant(s)</p>
            {results.map((r, i) => (
              <div key={i} className="bg-white/[0.04] border border-white/10 rounded-lg p-3 space-y-1">
                <div className="text-white text-sm font-medium">{r.contestant} — {r.competition}</div>
                <div className="text-white/40 text-xs">Quest folder: {r.questFolder}</div>
                {r.error && <div className="text-red-400 text-xs flex items-center gap-1"><XCircle className="h-3 w-3" />{r.error}</div>}
                {(r.videos || []).map((v: any, j: number) => (
                  <div key={j} className={`text-xs flex items-center gap-1 ${v.status === "synced" ? "text-green-400" : v.status === "no_videos_found" ? "text-white/40" : "text-red-400"}`}>
                    {v.status === "synced" ? <CheckCircle2 className="h-3 w-3" /> : v.status === "no_videos_found" ? <Info className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {v.status === "synced" ? `Synced: ${v.uri}` : v.status === "no_videos_found" ? "No videos in Quest folder" : `Error: ${v.error}`}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDiagnostics() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-serif text-lg text-white mb-1">Diagnostics</h3>
        <p className="text-sm text-white/40">Track site traffic, visitor behavior, and system health.</p>
      </div>

      <Tabs defaultValue="analytics">
        <TabsList className="bg-white/[0.06] border border-white/10 mb-4">
          <TabsTrigger
            value="analytics"
            className="text-white/60 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white flex items-center gap-2"
            data-testid="tab-diagnostics-analytics"
          >
            <BarChart3 className="h-4 w-4" /> Analytics
          </TabsTrigger>
          <TabsTrigger
            value="errors"
            className="text-white/60 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white flex items-center gap-2"
            data-testid="tab-diagnostics-errors"
          >
            <AlertCircle className="h-4 w-4" /> Error Logs
          </TabsTrigger>
          <TabsTrigger
            value="chronicTV"
            className="text-white/60 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white flex items-center gap-2"
            data-testid="tab-diagnostics-chronicTV"
          >
            <Tv2 className="h-4 w-4" /> ChronicTV Sync
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <AnalyticsTab />
        </TabsContent>

        <TabsContent value="errors">
          <ErrorLogsTab />
        </TabsContent>

        <TabsContent value="chronicTV">
          <ChronicTVSyncTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
