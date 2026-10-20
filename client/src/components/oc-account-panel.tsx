import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOCAccountStatus,
  useGetOCBrandKits,
  useGetSelectedOCBrandKit,
  useStartOCAccountConnection,
  useSelectOCBrandKit,
  usePublishOCBrandKitPost,
  useDisconnectOCAccount,
  getGetOCAccountStatusQueryKey,
  getGetOCBrandKitsQueryKey,
  getGetSelectedOCBrandKitQueryKey,
  type OCBrandKitPostResponse,
} from "@workspace/api-client-react";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  PlugZap,
  Send,
  Unplug,
  Video,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import OCReferralBanner from "@/components/oc-referral-banner";

interface OCAccountPanelProps {
  returnTo: "/thequest/dashboard";
  referralHref: string;
  referralAudience: "artist" | "host";
  demoMode?: boolean;
}

const platformLabel = (platform: string) =>
  platform.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function OCAccountPanel({
  returnTo,
  referralHref,
  referralAudience,
  demoMode = false,
}: OCAccountPanelProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const [consentChecked, setConsentChecked] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [publishResult, setPublishResult] = useState<OCBrandKitPostResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const userId = user?.uid;

  const statusQuery = useGetOCAccountStatus({
    query: {
      enabled: !demoMode && !isAuthLoading && !!user,
      queryKey: [...getGetOCAccountStatusQueryKey(), userId],
      retry: 1,
    },
  });
  const connected = statusQuery.data?.connected === true;
  const kitsQuery = useGetOCBrandKits({
    query: {
      enabled: connected,
      queryKey: [...getGetOCBrandKitsQueryKey(), userId],
      retry: 1,
    },
  });
  const selectedKitQuery = useGetSelectedOCBrandKit({
    query: {
      enabled: connected && !!statusQuery.data?.selectedBrandKitId,
      queryKey: [...getGetSelectedOCBrandKitQueryKey(), userId, statusQuery.data?.selectedBrandKitId],
      retry: 1,
    },
  });
  const connectMutation = useStartOCAccountConnection();
  const selectMutation = useSelectOCBrandKit();
  const publishMutation = usePublishOCBrandKitPost();
  const disconnectMutation = useDisconnectOCAccount();
  const [busy, setBusy] = useState<"connect" | "select" | "publish" | "disconnect" | null>(null);

  const brandKits = kitsQuery.data?.brandKits ?? [];
  const brandKit = selectedKitQuery.data?.brandKit;
  const availableTargets = useMemo(
    () => (brandKit?.socialAccounts ?? []).filter((account) => account.canPublish),
    [brandKit?.socialAccounts],
  );
  const availableMedia = useMemo(
    () => (brandKit?.media ?? []).filter((media) => media.canPublish),
    [brandKit?.media],
  );
  const selectedMedia = availableMedia.find((media) => media.id === selectedMediaId);
  const selectedTargets = availableTargets.filter((target) => selectedTargetIds.includes(target.id));
  const needsReconnect = connected && /reconnect/i.test(error);
  const identityRef = useRef<{ value: string | null; seen: boolean }>({
    value: userId ?? null,
    seen: Boolean(userId),
  });

  useEffect(() => {
    const nextUserId = userId ?? null;
    const previous = identityRef.current;
    const firstAuthenticatedRender = !previous.seen && nextUserId !== null;
    if (!firstAuthenticatedRender && previous.value !== nextUserId) {
      setSelectedMediaId("");
      setSelectedTargetIds([]);
      setCaption("");
      setPublishResult(null);
      setConsentChecked(false);
      setBusy(null);
      setConfirmDisconnect(false);
      setError("");
      setNotice("");
      idempotencyRef.current = null;
    }
    identityRef.current = {
      value: nextUserId,
      seen: previous.seen || nextUserId !== null,
    };
  }, [userId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("ocConnection");
    if (!result) return;
    if (result === "connected") setNotice("Your OC account is connected. Choose a brand kit to continue.");
    else if (result === "cancelled") setNotice("OC authorization was cancelled. No connection was added.");
    else setError("The OC account connection could not be completed. Try connecting again.");
    params.delete("ocConnection");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, []);

  useEffect(() => {
    if (!statusQuery.isError) return;
    setError(statusQuery.error instanceof Error
      ? statusQuery.error.message
      : "Could not load the OC connection.");
  }, [statusQuery.error, statusQuery.isError]);

  useEffect(() => {
    if (!kitsQuery.isError && !selectedKitQuery.isError) return;
    const queryError = kitsQuery.error ?? selectedKitQuery.error;
    setError(queryError instanceof Error ? queryError.message : "Could not load your OC brand kit.");
  }, [kitsQuery.error, kitsQuery.isError, selectedKitQuery.error, selectedKitQuery.isError]);

  const refresh = async () => {
    setError("");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetOCAccountStatusQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetOCBrandKitsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetSelectedOCBrandKitQueryKey() }),
    ]);
  };

  const connect = async () => {
    setBusy("connect");
    setError("");
    setNotice("");
    try {
      const result = await connectMutation.mutateAsync({ data: { returnTo } });
      window.location.assign(result.authorizationUrl);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not connect to OC.");
      setBusy(null);
    }
  };

  const selectBrandKit = async (brandKitId: string) => {
    if (!brandKitId || brandKitId === statusQuery.data?.selectedBrandKitId) return;
    setBusy("select");
    setError("");
    setNotice("");
    setPublishResult(null);
    setSelectedMediaId("");
    setSelectedTargetIds([]);
    try {
      const result = await selectMutation.mutateAsync({ data: { brandKitId } });
      queryClient.setQueryData(
        [...getGetSelectedOCBrandKitQueryKey(), userId, result.selectedBrandKitId],
        { brandKit: result.brandKit },
      );
      queryClient.setQueryData(statusQuery.queryKey, (old) =>
        old ? { ...old, selectedBrandKitId: result.selectedBrandKitId, selectedBrandKitName: result.brandKit.name } : old,
      );
      setNotice(`${result.brandKit.name} is now selected for Quest.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not select that brand kit.");
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (!brandKit || !caption.trim() || selectedTargetIds.length === 0) return;
    const orderedTargetIds = [...selectedTargetIds].sort();
    const fingerprint = JSON.stringify({
      brandKitId: brandKit.id,
      targetIds: orderedTargetIds,
      caption: caption.trim(),
      mediaAssetId: selectedMediaId || null,
    });
    const storageKey = userId ? `quest:oc-post-idempotency:${userId}` : null;
    let idempotencyKey: string | null = null;
    if (storageKey) {
      try {
        const stored = JSON.parse(window.sessionStorage.getItem(storageKey) || "null");
        if (stored?.fingerprint === fingerprint && typeof stored?.key === "string") {
          idempotencyKey = stored.key;
        }
      } catch {
        // Continue with a fresh in-memory key if session storage is unavailable.
      }
    }
    if (!idempotencyKey && idempotencyRef.current?.fingerprint === fingerprint) {
      idempotencyKey = idempotencyRef.current.key;
    }
    if (!idempotencyKey) idempotencyKey = crypto.randomUUID();
    idempotencyRef.current = { fingerprint, key: idempotencyKey };
    if (storageKey) {
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify({ fingerprint, key: idempotencyKey }));
      } catch {
        // The in-memory key still protects retries during this page session.
      }
    }
    setBusy("publish");
    setError("");
    setNotice("");
    setPublishResult(null);
    try {
      const result = await publishMutation.mutateAsync({
        data: {
          targetIds: orderedTargetIds,
          caption: caption.trim(),
          ...(selectedMediaId ? { mediaAssetId: selectedMediaId } : {}),
          idempotencyKey,
        },
      });
      setPublishResult(result);
      if (result.success) {
        setNotice("Your post was submitted to OC for publishing.");
        idempotencyRef.current = null;
        if (storageKey) {
          try {
            window.sessionStorage.removeItem(storageKey);
          } catch {
            // A retained key is safe: a later identical post should not duplicate.
          }
        }
      }
      else setError("Some or all targets could not publish. Review each result below.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not publish this post.");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    setError("");
    setNotice("");
    try {
      const result = await disconnectMutation.mutateAsync();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetOCAccountStatusQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetOCBrandKitsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetSelectedOCBrandKitQueryKey() }),
      ]);
      setSelectedTargetIds([]);
      setSelectedMediaId("");
      idempotencyRef.current = null;
      setPublishResult(null);
      setCaption("");
      setConsentChecked(false);
      if (userId) {
        try {
          window.sessionStorage.removeItem(`quest:oc-post-idempotency:${userId}`);
        } catch {
          // The server-side connection is already removed.
        }
      }
      setNotice(result.revocationConfirmed
        ? "Your OC account is disconnected."
        : "Quest removed its saved connection, but OC did not confirm token revocation. Revoke Quest from your OC connected-app settings.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not disconnect the OC account.");
    } finally {
      setBusy(null);
      setConfirmDisconnect(false);
    }
  };

  if (demoMode || isAuthLoading || !user) return null;

  const isLoading = statusQuery.isLoading;

  return (
    <section
      className="oc-account-panel space-y-5 rounded-xl border border-white/10 bg-white/[0.035] p-4 sm:p-5"
      aria-labelledby="oc-account-panel-title"
      data-testid="oc-account-panel"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-orange-400/20 bg-orange-400/10 text-orange-300">
            <PlugZap className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-300/80">Connected identity</p>
            <h3 id="oc-account-panel-title" className="text-base font-semibold text-white">
              Original Concepts
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/60">
              Bring your OC brand identity and media into The Quest. Authorization allows Quest to publish to socials connected to your selected kit; it never sends a post on its own.
            </p>
          </div>
        </div>
        {connected && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-10 shrink-0 self-start text-white/65 hover:bg-red-400/10 hover:text-red-200"
            onClick={() => setConfirmDisconnect(true)}
            disabled={busy !== null}
            data-testid="button-oc-disconnect"
          >
            <Unplug className="mr-2 h-4 w-4" aria-hidden="true" />
            Disconnect
          </Button>
        )}
      </div>

      <div className="border-t border-white/10 pt-4">
        <OCReferralBanner href={referralHref} audience={referralAudience} />
      </div>

      {isLoading ? (
        <div className="space-y-3 border-t border-white/10 pt-4" role="status" aria-label="Loading OC connection">
          <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
          <div className="h-11 w-full animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="h-20 w-full animate-pulse rounded-lg bg-white/[0.04]" />
        </div>
      ) : !connected ? (
        <div className="space-y-4 border-t border-white/10 pt-4">
          <div className="flex items-start gap-3 rounded-lg border border-orange-300/15 bg-orange-300/[0.04] p-3">
            <Checkbox
              id="oc-social-publishing-consent"
              checked={consentChecked}
              onCheckedChange={(checked) => setConsentChecked(checked === true)}
              aria-describedby="oc-social-publishing-consent-copy"
              data-testid="checkbox-oc-social-publishing-consent"
            />
            <div className="space-y-1">
              <Label htmlFor="oc-social-publishing-consent" className="cursor-pointer text-sm font-medium leading-relaxed text-white">
                I authorize Quest to use my selected OC brand kit and publish to its connected social accounts.
              </Label>
              <p id="oc-social-publishing-consent-copy" className="text-xs leading-relaxed text-white/55">
                Authorization does not submit posts. Each post is published only after you review its content and explicitly submit it here. OC retains your social credentials.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void connect()}
            disabled={!consentChecked || busy !== null}
            className="min-h-11 w-full gap-2 bg-orange-500 text-white hover:bg-orange-400 sm:w-auto"
            data-testid="button-oc-connect"
          >
            {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PlugZap className="h-4 w-4" aria-hidden="true" />}
            Connect OC account
          </Button>
        </div>
      ) : (
        <div className="space-y-5 border-t border-white/10 pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2 text-sm text-white/80">
              <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
              <span className="truncate">
                Connected as <strong className="font-semibold text-white">{statusQuery.data?.account?.displayName || "OC account"}</strong>
              </span>
            </div>
            <span className="w-fit rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1 text-xs font-medium text-emerald-100">
              Publishing authorized
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="oc-brand-kit-select" className="text-xs font-medium uppercase tracking-wide text-white/65">
                Your OC brand kit
              </Label>
              <select
                id="oc-brand-kit-select"
                value={statusQuery.data?.selectedBrandKitId || ""}
                onChange={(event) => void selectBrandKit(event.target.value)}
                disabled={busy !== null || kitsQuery.isLoading || brandKits.length === 0}
                className="min-h-11 w-full rounded-md border border-white/15 bg-[#222] px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="select-oc-brand-kit"
              >
                <option value="" disabled>{kitsQuery.isLoading ? "Loading your kits…" : brandKits.length ? "Choose a brand kit" : "No brand kits available"}</option>
                {brandKits.map((kit) => (
                  <option key={kit.id} value={kit.id}>{kit.businessName || kit.name}</option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              onClick={() => void refresh()}
              disabled={busy !== null || kitsQuery.isFetching || selectedKitQuery.isFetching}
              data-testid="button-oc-refresh"
            >
              {kitsQuery.isFetching || selectedKitQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Refresh kits
            </Button>
          </div>

          {kitsQuery.isLoading && (
            <div className="h-24 animate-pulse rounded-lg border border-white/10 bg-white/[0.03]" role="status" aria-label="Loading brand kits" />
          )}
          {!kitsQuery.isLoading && brandKits.length === 0 && (
            <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-4 text-sm leading-relaxed text-white/60">
              No brand kits are available for this OC account. Create or share a kit in Original Concepts, then refresh.
            </div>
          )}
          {selectedKitQuery.isLoading && statusQuery.data?.selectedBrandKitId && (
            <div className="h-28 animate-pulse rounded-lg border border-white/10 bg-white/[0.03]" role="status" aria-label="Loading selected brand kit" />
          )}

          {brandKit && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 rounded-lg border border-white/10 bg-black/10 p-4 sm:grid-cols-[auto_minmax(0,1fr)]">
                {brandKit.identity.logoUrl ? (
                  <img
                    src={brandKit.identity.logoUrl}
                    alt={`${brandKit.identity.businessName || brandKit.name} logo`}
                    className="h-20 w-20 rounded-lg border border-white/10 bg-white/5 object-contain p-2"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    data-testid="img-oc-brand-logo"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xs text-white/55">No logo</div>
                )}
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-semibold text-white">{brandKit.identity.businessName || brandKit.name}</h4>
                    {brandKit.identity.brandSlug && <span className="text-xs text-white/50">/{brandKit.identity.brandSlug}</span>}
                  </div>
                  {brandKit.identity.tagline && <p className="text-sm text-white/70">{brandKit.identity.tagline}</p>}
                  {brandKit.identity.description && <p className="line-clamp-3 text-sm leading-relaxed text-white/55">{brandKit.identity.description}</p>}
                  {brandKit.identity.websiteUrl && (
                    <a href={brandKit.identity.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 text-xs text-orange-200 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
                      Visit website <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1" aria-label="Brand colors">
                    {[
                      ["Primary", brandKit.identity.primaryColor],
                      ["Secondary", brandKit.identity.secondaryColor],
                      ["Accent", brandKit.identity.accentColor],
                    ].filter((entry): entry is [string, string] => Boolean(entry[1])).map(([label, color]) => (
                      <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-1 text-xs text-white/65">
                        <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: color }} aria-hidden="true" />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border-b border-white/10 pb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-300/80">Publishing workspace</p>
                  <h4 className="mt-1 text-base font-semibold text-white">Prepare a post</h4>
                  <p className="mt-1 text-sm leading-relaxed text-white/55">
                    Select this kit’s publishable accounts and optional media. Nothing is sent until you review the summary and submit the post.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="oc-post-caption" className="text-xs font-medium uppercase tracking-wide text-white/65">Caption</Label>
                  <Textarea
                    id="oc-post-caption"
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    maxLength={2200}
                    rows={4}
                    placeholder="Write the post you want OC to publish…"
                    className="resize-y border-white/15 bg-white/[0.04] text-white placeholder:text-white/40 focus-visible:ring-orange-400"
                    data-testid="input-oc-post-caption"
                  />
                  <p className="text-right text-xs tabular-nums text-white/50">{caption.length.toLocaleString()}/2,200</p>
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-xs font-medium uppercase tracking-wide text-white/65">Publish to</legend>
                  {availableTargets.length === 0 ? (
                    <p className="rounded-lg border border-white/10 p-3 text-sm leading-relaxed text-white/60">
                      This kit has no publishing-ready socials. Connect a social account to this kit in OC, then refresh.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {availableTargets.map((account) => {
                        const checked = selectedTargetIds.includes(account.id);
                        return (
                          <label key={account.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-orange-400 ${checked ? "border-orange-400/40 bg-orange-400/[0.06]" : "border-white/10 hover:border-white/25 hover:bg-white/[0.03]"}`} data-testid={`target-oc-social-${account.id}`}>
                        <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => setSelectedTargetIds((current) => value === true
                                ? [...new Set([...current, account.id])]
                                : current.filter((id) => id !== account.id))}
                              aria-label={`Publish to ${account.displayName} on ${platformLabel(account.platform)}`}
                          data-testid={`checkbox-oc-target-${account.id}`}
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-white">{account.displayName}</span>
                              <span className="text-xs text-white/55">{platformLabel(account.platform)}</span>
                            </span>
                            {checked && <Check className="ml-auto h-4 w-4 shrink-0 text-orange-300" aria-hidden="true" />}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-xs font-medium uppercase tracking-wide text-white/65">
                    Brand-kit media <span className="font-normal normal-case text-white/50">(optional)</span>
                  </legend>
                  {availableMedia.length === 0 ? (
                    <p className="text-sm text-white/55">No publishable media is available in this kit.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      <label className={`cursor-pointer overflow-hidden rounded-lg border p-2 transition-colors focus-within:ring-2 focus-within:ring-orange-400 ${selectedMediaId === "" ? "border-orange-400/60 bg-orange-400/[0.07]" : "border-white/10 hover:border-white/25"}`}>
                        <input type="radio" name="oc-brand-kit-media" value="" checked={selectedMediaId === ""} onChange={() => setSelectedMediaId("")} className="sr-only" data-testid="radio-oc-media-none" />
                        <span className="flex aspect-square items-center justify-center rounded bg-white/[0.04] text-xs text-white/55"><ImageIcon className="mr-2 h-4 w-4" aria-hidden="true" />No media</span>
                      </label>
                      {availableMedia.map((media) => (
                        <label key={media.id} className={`cursor-pointer overflow-hidden rounded-lg border p-2 transition-colors focus-within:ring-2 focus-within:ring-orange-400 ${selectedMediaId === media.id ? "border-orange-400/60 bg-orange-400/[0.07]" : "border-white/10 hover:border-white/25"}`} data-testid={`media-oc-asset-${media.id}`}>
                          <input type="radio" name="oc-brand-kit-media" value={media.id} checked={selectedMediaId === media.id} onChange={() => setSelectedMediaId(media.id)} className="sr-only" data-testid={`radio-oc-media-${media.id}`} />
                          {media.kind === "video" ? (
                            <div className="relative">
                              <video src={media.previewUrl} className="aspect-square w-full rounded bg-black object-cover" muted playsInline preload="metadata" aria-label={`Preview of ${media.name}`} />
                              <Video className="absolute bottom-2 right-2 h-4 w-4 text-white drop-shadow" aria-hidden="true" />
                            </div>
                          ) : (
                            <img src={media.previewUrl} alt={media.name} className="aspect-square w-full rounded bg-black/20 object-cover" loading="lazy" referrerPolicy="no-referrer" />
                          )}
                          <span className="mt-2 block truncate text-xs text-white/75">{media.name}</span>
                          <span className="sr-only">{selectedMediaId === media.id ? "Selected" : "Select media"}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>

                <div className="rounded-lg border border-orange-300/20 bg-orange-300/[0.045] p-4" aria-label="Post review">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-orange-300/10 text-orange-200">
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-sm font-semibold text-white">Review before submitting</h5>
                      <p className="mt-1 text-xs leading-relaxed text-white/60">
                        {selectedTargets.length
                          ? `This post will be sent to ${selectedTargets.length} selected ${selectedTargets.length === 1 ? "social account" : "social accounts"} under ${brandKit.identity.businessName || brandKit.name}.`
                          : "Choose at least one publishable social account to continue."}
                      </p>
                      {selectedTargets.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Selected publishing targets">
                          {selectedTargets.map((target) => (
                            <li key={target.id} className="rounded-full border border-white/15 bg-black/10 px-2 py-1 text-xs text-white/75">
                              {target.displayName} · {platformLabel(target.platform)}
                            </li>
                          ))}
                        </ul>
                      )}
                      {selectedMedia && <p className="mt-2 text-xs text-white/60">Media: <span className="text-white/80">{selectedMedia.name}</span></p>}
                      <p className="mt-2 line-clamp-3 break-words text-xs leading-relaxed text-white/75">
                        {caption.trim() || "Your caption will appear here for review."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-start gap-2 text-xs leading-relaxed text-white/55">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-200/80" aria-hidden="true" />
                    Submitting asks OC to publish to these accounts. Published posts may not be recalled.
                  </p>
                  <Button
                    type="button"
                    onClick={() => void publish()}
                    disabled={busy !== null || !caption.trim() || selectedTargetIds.length === 0}
                    className="min-h-11 w-full shrink-0 gap-2 bg-orange-500 text-white hover:bg-orange-400 sm:w-auto"
                    data-testid="button-oc-publish"
                  >
                    {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                    Submit post for publishing
                  </Button>
                </div>

                {publishResult && (
                  <div className="space-y-3 rounded-lg border border-white/10 bg-black/10 p-4" aria-live="polite" data-testid="results-oc-publishing">
                    <div>
                      <h5 className="text-sm font-semibold text-white">Publishing results</h5>
                      <p className="mt-1 text-xs text-white/55">
                        {publishResult.success
                          ? "OC reported that all selected targets were published."
                          : `${publishResult.results.filter((result) => result.success).length} of ${publishResult.results.length} selected targets published. Review the results below.`}
                      </p>
                      {!publishResult.success && (
                        <p className="mt-1 text-xs leading-relaxed text-white/50">
                          To retry only failed targets, change the selected accounts to leave out those already published.
                        </p>
                      )}
                    </div>
                    <ul className="divide-y divide-white/10">
                      {publishResult.results.map((result) => (
                        <li key={`${result.targetId}:${result.platform}`} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                          <span className={`text-sm ${result.success ? "text-emerald-100" : "text-red-100"}`}>
                            <span className="font-medium">{result.success ? "Published" : "Not published"}</span>
                            {" "}to {platformLabel(result.platform)}
                            {!result.success && result.error ? <span className="block text-xs leading-relaxed text-white/55 sm:inline"> — {result.error}</span> : null}
                          </span>
                          {result.success && result.postUrl && (
                            <a href={result.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 text-xs text-orange-200 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
                              View post <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-400/25 bg-red-400/[0.06] p-3 text-sm text-red-100" role="alert">
          <span>{error}</span>
          {needsReconnect ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-9 shrink-0 border-orange-300/30 bg-orange-300/[0.06] px-3 text-xs text-orange-100 hover:bg-orange-300/10"
              onClick={() => void connect()}
              disabled={busy !== null}
              data-testid="button-oc-reconnect"
            >
              {busy === "connect" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              Reconnect OC account
            </Button>
          ) : (statusQuery.isError || kitsQuery.isError || selectedKitQuery.isError) ? (
            <Button type="button" variant="ghost" className="min-h-8 shrink-0 px-2 text-red-100 hover:bg-red-400/10" onClick={() => void refresh()} data-testid="button-oc-retry">
              Retry
            </Button>
          ) : null}
        </div>
      )}
      {notice && (
        <p className="flex items-start gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] p-3 text-sm text-emerald-100" role="status" data-testid="status-oc-notice">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </p>
      )}

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent className="border-white/10 bg-[#202020] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Original Concepts?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Quest will remove its saved OC authorization and selected brand kit. This does not delete your OC account or posts already published.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 bg-transparent text-white hover:bg-white/[0.06]">Keep connected</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void disconnect();
              }}
              className="bg-red-700 text-white hover:bg-red-600"
              disabled={busy === "disconnect"}
              data-testid="button-oc-confirm-disconnect"
            >
              {busy === "disconnect" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Disconnect account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
