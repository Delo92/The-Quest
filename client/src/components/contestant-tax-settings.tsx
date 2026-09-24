import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TaxForm = {
  legalName: string;
  businessName: string;
  taxIdType: "ssn" | "ein";
  taxId: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type TaxProfile = {
  taxYear: number;
  encryptionReady: boolean;
  payerConfigured: boolean;
  acknowledgedAt: string | null;
  dismissedAt: string | null;
  currentVersionId: string | null;
  current: Omit<TaxForm, "taxId"> & { taxIdLast4: string } | null;
  versions: Array<{
    id: string;
    createdAt: string | null;
    legalName: string;
    businessName: string;
    taxIdType: "ssn" | "ein";
    taxIdLast4: string;
  }>;
  paidGrossCents: number;
};

type Deadline = {
  competitionId: number;
  competitionTitle: string;
  deadline: string;
  taxYear: number;
};

const emptyForm: TaxForm = {
  legalName: "",
  businessName: "",
  taxIdType: "ssn",
  taxId: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
};

const money = (cents: number) =>
  `$${(Number(cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateLabel = (value?: string | null) => value
  ? new Date(value).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
  : "Date unavailable";

export default function ContestantTaxSettings({ onOpenTaxDetails }: { onOpenTaxDetails?: () => void } = {}) {
  const { toast } = useToast();
  const currentYear = new Date().getUTCFullYear();
  const [taxYear, setTaxYear] = useState(currentYear);
  const [form, setForm] = useState<TaxForm>(emptyForm);
  const [showReminder, setShowReminder] = useState(true);
  const [taxPromptOpen, setTaxPromptOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState("");

  const yearsQuery = useQuery<number[]>({ queryKey: ["/api/tax/my-years"] });
  const profileQuery = useQuery<TaxProfile>({
    queryKey: ["/api/tax/my-profile", taxYear],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/tax/my-profile/${taxYear}`);
      return response.json();
    },
    enabled: Number.isInteger(taxYear),
  });
  const deadlinesQuery = useQuery<Deadline[]>({ queryKey: ["/api/tax/my-deadlines"] });

  useEffect(() => {
    const current = profileQuery.data?.current;
    if (current) {
      setForm({
        legalName: current.legalName || "",
        businessName: current.businessName || "",
        taxIdType: current.taxIdType,
        taxId: "",
        address1: current.address1 || "",
        address2: current.address2 || "",
        city: current.city || "",
        state: current.state || "",
        postalCode: current.postalCode || "",
        country: current.country || "US",
      });
      setSelectedVersionId(profileQuery.data?.currentVersionId || "");
    } else {
      setForm(emptyForm);
      setSelectedVersionId("");
    }
    setShowReminder(!profileQuery.data?.dismissedAt);
  }, [profileQuery.data, taxYear]);

  const updateProfileQuery = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tax/my-profile", taxYear] });
    queryClient.invalidateQueries({ queryKey: ["/api/tax/my-years"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tax/my-deadlines"] });
  };

  const acknowledgmentMutation = useMutation({
    mutationFn: async (action: "acknowledge" | "dismiss") => {
      const response = await apiRequest("POST", `/api/tax/my-profile/${taxYear}/acknowledgment`, { action });
      return response.json();
    },
    onSuccess: (_result, action) => {
      updateProfileQuery();
      if (action === "dismiss") setShowReminder(false);
      toast({ title: action === "acknowledge" ? "Deadline acknowledged" : "Reminder dismissed" });
    },
    onError: (error: Error) => toast({ title: "Could not update tax reminder", description: error.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/tax/my-profile/${taxYear}`, form);
      return response.json();
    },
    onSuccess: () => {
      updateProfileQuery();
      toast({ title: "Tax details saved securely" });
    },
    onError: (error: Error) => toast({ title: "Could not save tax details", description: error.message, variant: "destructive" }),
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const query = selectedVersionId ? `?versionId=${encodeURIComponent(selectedVersionId)}` : "";
      const response = await apiRequest("GET", `/api/tax/my-profile/${taxYear}/1099${query}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `TheQuest-1099-NEC-${taxYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    onError: (error: Error) => toast({ title: "Could not download recipient copy", description: error.message, variant: "destructive" }),
  });

  const profile = profileQuery.data;
  const deadlines = deadlinesQuery.data || [];
  const yearOptions = [...new Set([currentYear, ...(yearsQuery.data || [])])].sort((a, b) => b - a);
  const update = (key: keyof TaxForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const inputClass = "border-white/15 bg-white/[0.06] text-white placeholder:text-white/25";
  const currentHasTin = Boolean(profile?.current?.taxIdLast4);
  const needsTaxProfile = Boolean(
    profileQuery.isSuccess
    && deadlinesQuery.isSuccess
    && profile?.encryptionReady
    && !profile.currentVersionId
    && !profile.dismissedAt
    && (deadlines.length > 0 || Number(profile.paidGrossCents) > 0),
  );

  useEffect(() => {
    if (needsTaxProfile) setTaxPromptOpen(true);
  }, [needsTaxProfile]);

  return (
    <section className="space-y-5" aria-labelledby="tax-settings-heading" data-testid="contestant-tax-settings">
      <Dialog
        open={taxPromptOpen}
        onOpenChange={setTaxPromptOpen}
      >
        <DialogContent className="max-w-lg border-white/10 bg-[#111] text-white" data-testid="dialog-tax-profile-reminder">
          <DialogHeader>
            <DialogTitle>Complete your 1099 tax details</DialogTitle>
            <DialogDescription className="text-white/60">
              Enter your legal name, SSN or EIN, and mailing address so The Quest can prepare recipient 1099-NEC forms when applicable. Your tax ID is encrypted before it is saved.
            </DialogDescription>
          </DialogHeader>
          {deadlines.length > 0 && (
            <p className="text-sm leading-relaxed text-white/55">
              Save your details by your competition&apos;s final-voting cutoff to help protect your payout eligibility. You can review the deadlines in Tax Details.
            </p>
          )}
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                acknowledgmentMutation.mutate("dismiss");
                setTaxPromptOpen(false);
              }}
              disabled={acknowledgmentMutation.isPending}
              className="min-h-11 border-white/20 text-white hover:bg-white/10"
              data-testid="button-tax-prompt-later"
            >
              Remind me later
            </Button>
            <Button
              type="button"
              onClick={() => {
                setTaxPromptOpen(false);
                onOpenTaxDetails?.();
              }}
              className="min-h-11 bg-orange-500 text-white hover:bg-orange-400"
              data-testid="button-open-tax-details"
            >
              Enter tax details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-5 w-5 text-orange-300" />
            <h2 id="tax-settings-heading" className="text-lg font-semibold text-white">Tax details & forms</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/55">
            Your tax ID is encrypted before it is saved. Only you can view or update these details here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="tax-year" className="sr-only">Tax year</Label>
          <select
            id="tax-year"
            value={taxYear}
            onChange={(event) => setTaxYear(Number(event.target.value))}
            className="h-10 rounded-md border border-white/15 bg-[#171717] px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            {yearOptions.map((year) => <option key={year} value={year}>{year} tax year</option>)}
          </select>
        </div>
      </header>

      {showReminder && (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-4" role="status">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-amber-300" />
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-white">Tax details may be required for payouts</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/60">
                Acknowledge the deadline and save complete tax details by the final-voting cutoff for your competition. Missing details may affect payout eligibility under the competition terms.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!profile?.acknowledgedAt && (
                  <Button
                    type="button"
                    onClick={() => acknowledgmentMutation.mutate("acknowledge")}
                    disabled={acknowledgmentMutation.isPending}
                    className="min-h-10 bg-orange-500 text-white hover:bg-orange-400"
                  >
                    I understand the deadline
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => acknowledgmentMutation.mutate("dismiss")}
                  disabled={acknowledgmentMutation.isPending}
                  className="min-h-10 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  Dismiss for now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {profile?.dismissedAt && !showReminder && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowReminder(true)}
          className="min-h-10 px-0 text-sm text-orange-300 hover:bg-transparent hover:text-orange-200"
        >
          Show tax-information reminder
        </Button>
      )}

      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-orange-300" />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-white">Final-voting deadlines</h3>
            <p className="mt-1 text-sm text-white/50">Each date comes from the finale voting cutoff when configured, or the competition voting end date.</p>
            {deadlinesQuery.isLoading ? (
              <p className="mt-3 text-sm text-white/40">Loading deadlines…</p>
            ) : deadlines.length ? (
              <ul className="mt-3 divide-y divide-white/[0.08]">
                {deadlines.map((item) => (
                  <li key={`${item.competitionId}-${item.deadline}`} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-white/75">{item.competitionTitle}</span>
                    <span className="text-white/50">Due {dateLabel(item.deadline)} · {item.taxYear} tax year</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-white/40">No competition deadlines are available yet.</p>
            )}
          </div>
        </div>
      </section>

      {profileQuery.isLoading ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6 text-sm text-white/45">Loading your tax profile…</div>
      ) : profileQuery.isError ? (
        <div className="rounded-lg border border-red-400/25 bg-red-400/[0.06] p-4 text-sm text-red-100">Your tax profile could not be loaded. Try again shortly.</div>
      ) : (
        <>
          {!profile?.encryptionReady && (
            <div className="rounded-lg border border-red-400/25 bg-red-400/[0.06] p-4 text-sm text-red-100">
              Secure tax storage is not configured. Tax IDs cannot be saved until an administrator restores the encryption configuration.
            </div>
          )}
          {profile?.acknowledgedAt && (
            <p className="text-xs text-white/40">Deadline acknowledged {dateLabel(profile.acknowledgedAt)}.</p>
          )}
          <form
            className="space-y-5 rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tax-legal-name" className="text-white/70">Legal name</Label>
                <Input id="tax-legal-name" autoComplete="name" required value={form.legalName} onChange={(event) => update("legalName", event.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tax-business-name" className="text-white/70">Business name (optional)</Label>
                <Input id="tax-business-name" value={form.businessName} onChange={(event) => update("businessName", event.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="space-y-1.5">
                <Label htmlFor="tax-id-type" className="text-white/70">Tax ID type</Label>
                <select
                  id="tax-id-type"
                  value={form.taxIdType}
                  onChange={(event) => update("taxIdType", event.target.value as TaxForm["taxIdType"])}
                  className="h-10 w-full rounded-md border border-white/15 bg-[#171717] px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                >
                  <option value="ssn">Social Security number</option>
                  <option value="ein">Employer identification number</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tax-id" className="text-white/70">Tax ID</Label>
                <Input
                  id="tax-id"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.taxId}
                  onChange={(event) => update("taxId", event.target.value)}
                  placeholder={currentHasTin ? `Saved securely · ending in ${profile?.current?.taxIdLast4}` : "Enter 9 digits"}
                  className={inputClass}
                  aria-describedby="tax-id-help"
                />
                <p id="tax-id-help" className="text-xs text-white/40">
                  {currentHasTin ? "Leave blank to keep the saved number. Enter a new 9-digit number to replace it." : "Enter the 9-digit number associated with the legal name above."}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="tax-address1" className="text-white/70">Mailing address</Label>
                <Input id="tax-address1" autoComplete="address-line1" required value={form.address1} onChange={(event) => update("address1", event.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="tax-address2" className="text-white/70">Apartment, suite, etc. (optional)</Label>
                <Input id="tax-address2" autoComplete="address-line2" value={form.address2} onChange={(event) => update("address2", event.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tax-city" className="text-white/70">City</Label>
                <Input id="tax-city" autoComplete="address-level2" required value={form.city} onChange={(event) => update("city", event.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tax-state" className="text-white/70">State / region code</Label>
                <Input id="tax-state" required maxLength={2} placeholder="IL" value={form.state} onChange={(event) => update("state", event.target.value.toUpperCase())} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tax-postal" className="text-white/70">ZIP / postal code</Label>
                <Input id="tax-postal" autoComplete="postal-code" required value={form.postalCode} onChange={(event) => update("postalCode", event.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tax-country" className="text-white/70">Country code</Label>
                <Input id="tax-country" required maxLength={2} placeholder="US" value={form.country} onChange={(event) => update("country", event.target.value.toUpperCase())} className={inputClass} />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-white/40">Each save preserves a dated prior version. Tax IDs are never shown in full after saving.</p>
              <Button type="submit" disabled={!profile?.encryptionReady || !profile?.acknowledgedAt || saveMutation.isPending} className="min-h-11 bg-orange-500 text-white hover:bg-orange-400">
                {saveMutation.isPending ? "Saving securely…" : "Save tax details"}
              </Button>
            </div>
          </form>

          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-300" />
                  <h3 className="font-medium text-white">{taxYear} Form 1099-NEC</h3>
                </div>
                <p className="mt-1 text-sm text-white/50">Recipient copy only. The amount is calculated from Quest payout-ledger entries recorded as paid during this tax year.</p>
                <p className="mt-2 text-sm text-white/75">Paid gross amount: <span className="font-semibold tabular-nums text-white">{money(profile?.paidGrossCents || 0)}</span></p>
                {!profile?.payerConfigured && <p className="mt-2 text-xs text-amber-200/80">Payer details are not configured yet. Contact an administrator before downloading.</p>}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => exportMutation.mutate()}
                disabled={!profile?.currentVersionId || !profile?.payerConfigured || exportMutation.isPending}
                className="min-h-11 border-white/20 text-white hover:bg-white/10"
              >
                <Download className="mr-2 h-4 w-4" />
                {exportMutation.isPending ? "Preparing…" : "Download recipient copy"}
              </Button>
            </div>
            {profile?.versions?.length ? (
              <div className="mt-4 border-t border-white/10 pt-4">
                <Label htmlFor="tax-version" className="text-xs text-white/50">Use a saved profile version</Label>
                <select
                  id="tax-version"
                  value={selectedVersionId}
                  onChange={(event) => setSelectedVersionId(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-white/15 bg-[#171717] px-3 text-sm text-white sm:max-w-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                >
                  {profile.versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.legalName}{version.businessName ? ` · ${version.businessName}` : ""} · ID ending {version.taxIdLast4} · saved {dateLabel(version.createdAt)}
                    </option>
                  ))}
                </select>
                <div className="mt-3 space-y-2">
                  {profile.versions.map((version) => (
                    <div key={`history-${version.id}`} className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-white/65">{version.legalName}{version.businessName ? ` · ${version.businessName}` : ""}</span>
                      <span className="text-white/40">ID ending {version.taxIdLast4} · {dateLabel(version.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/40">Save your tax details before requesting a recipient copy.</p>
            )}
            <Badge variant="outline" className="mt-4 border-white/10 text-[10px] text-white/40">Not a filing copy</Badge>
          </section>
        </>
      )}
    </section>
  );
}