import { useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useAuth, getAuthToken } from "@/hooks/use-auth";

interface PostResult { platform: string; status: "published" | "scheduled" | "failed"; postUrl?: string }
interface PostActivity {
  postCount: number;
  totals: { published: number; scheduled: number; failed: number };
  byPlatform: Record<string, { published: number; scheduled: number; failed: number }>;
  recent: { postId: string; receivedAt: string; results: PostResult[] }[];
}

async function loadActivity(): Promise<PostActivity> {
  const token = getAuthToken();
  const res = await fetch(`${import.meta.env.BASE_URL}api/oc/referral/post-results`.replace(/\/{2,}/g, "/"), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Post activity is unavailable.");
  return res.json();
}

export default function OCPostActivity() {
  const { user, isLoading } = useAuth();
  const query = useQuery({
    queryKey: ["oc-post-activity", user?.uid],
    queryFn: loadActivity,
    enabled: !!user && !isLoading,
    retry: 1,
    staleTime: 30_000,
  });
  // Nothing to show until OC has reported a post, or while unavailable.
  if (!query.data || query.data.postCount === 0) return null;
  const { totals, byPlatform, recent } = query.data;
  const stats = [
    ["Published", totals.published],
    ["Scheduled", totals.scheduled],
    ["Failed", totals.failed],
  ] as const;
  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5" aria-labelledby="oc-post-activity-title" data-testid="oc-post-activity">
      <div className="flex items-center gap-2">
        <Send className="h-4 w-4 text-orange-300" aria-hidden="true" />
        <h3 id="oc-post-activity-title" className="text-sm font-semibold text-white">Social posting activity</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white/[0.05] p-3 text-center">
            <p className="text-xl font-semibold text-white" data-testid={`oc-posts-${label.toLowerCase()}`}>{value}</p>
            <p className="text-xs text-white/70">{label}</p>
          </div>
        ))}
      </div>
      <ul className="flex flex-wrap gap-2 text-xs text-white/80">
        {Object.entries(byPlatform).map(([platform, c]) => (
          <li key={platform} className="rounded-full border border-white/10 px-3 py-1 capitalize">{platform}: {c.published} published</li>
        ))}
      </ul>
      <ul className="divide-y divide-white/10 text-sm">
        {recent.slice(0, 5).map((post) => (
          <li key={post.postId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-white/80">
            <span className="min-w-0">{post.results.map((r) => `${r.platform} (${r.status})`).join(", ")}</span>
            <time className="text-xs text-white/60" dateTime={post.receivedAt}>{new Date(post.receivedAt).toLocaleDateString()}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}
