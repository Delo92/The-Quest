import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, FileCheck2, Landmark, Plus, Save, ShieldCheck, Users, Wallet } from "lucide-react";
import AdminTaxNonprofit from "@/components/admin-tax-nonprofit";

type PaymentMethod = "manual" | "ach" | "paypal" | "check" | "other";

interface PayrollSettings {
  entityType: "independent_contractor";
  payoutDueDay: number;
  paymentInfoDeadline: "competition_final_day";
  missingPaymentPolicy: "forfeit" | "block";
  defaultPlacementModel: "winner_only" | "top_three" | "custom";
  defaultPlacements: Array<{ place: number; percentage: number; label?: string }>;
  enabledPaymentMethods: PaymentMethod[];
  payoutProvider: "manual";
  requiredAgreementTypes: string[];
  nonprofitTrackingEnabled: boolean;
}

interface Payee {
  id: string;
  name: string;
  email: string;
  type: "contestant" | "host" | "referrer" | "nonprofit";
  status: "active" | "inactive";
  paymentMethodType?: PaymentMethod | null;
  paymentMethodLabel?: string | null;
  paymentInfoProvided?: boolean;
  agreementStatus?: "pending" | "partial" | "signed";
  userId?: string;
  talentProfileId?: number;
}

interface ContestantProfileOption {
  id: number;
  userId: string;
  name: string;
  email: string;
}

interface Agreement {
  id: string;
  title: string;
  type: string;
  version: string;
  status: "draft" | "active" | "archived";
  required: boolean;
  content: string;
}

interface PayrollSummary {
  payees: number;
  activePayees: number;
  pendingCents: number;
  paidCents: number;
  forfeitedCents: number;
  nonprofitCents: number;
  batches: number;
  transactions: number;
}

interface PayrollBatch {
  id: string;
  competitionTitle: string;
  competitionEndDate: string;
  payoutDueDate: string;
  status: string;
  grossCents: number;
  deductionsCents: number;
  nonprofitCents: number;
  netCents: number;
  forfeitedCents: number;
  participantCount: number;
}

interface PayrollTransaction {
  id: string;
  type: string;
  amountCents: number;
  memo?: string;
  nonprofitSelection?: string | null;
  createdAt: string;
}

const defaultSettings: PayrollSettings = {
  entityType: "independent_contractor",
  payoutDueDay: 1,
  paymentInfoDeadline: "competition_final_day",
  missingPaymentPolicy: "forfeit",
  defaultPlacementModel: "winner_only",
  defaultPlacements: [{ place: 1, percentage: 100, label: "Winner" }],
  enabledPaymentMethods: ["manual", "ach", "paypal", "check"],
  payoutProvider: "manual",
  requiredAgreementTypes: ["independent_contractor", "winner_payout_terms"],
  nonprofitTrackingEnabled: true,
};

const money = (cents: number | undefined) =>
  `$${((Number(cents || 0) || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateLabel = (value: string | undefined) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

const methodLabels: Record<PaymentMethod, string> = {
  manual: "Manual record",
  ach: "ACH / bank",
  paypal: "PayPal",
  check: "Check",
  other: "Other",
};

export default function AdminPayrollSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PayrollSettings>(defaultSettings);
  const [payeeForm, setPayeeForm] = useState({ name: "", email: "", type: "contestant", userId: "", talentProfileId: "" });
  const [payeeLinkSelections, setPayeeLinkSelections] = useState<Record<string, string>>({});
  const [agreementForm, setAgreementForm] = useState({ title: "", type: "winner_payout_terms", version: "1.0", content: "" });

  const settingsQuery = useQuery<PayrollSettings>({ queryKey: ["/api/admin/payroll/settings"] });
  const summaryQuery = useQuery<PayrollSummary>({ queryKey: ["/api/admin/payroll/summary"] });
  const payeesQuery = useQuery<Payee[]>({ queryKey: ["/api/admin/payroll/payees"] });
  const contestantProfilesQuery = useQuery<ContestantProfileOption[]>({ queryKey: ["/api/admin/payroll/contestant-profiles"] });
  const agreementsQuery = useQuery<Agreement[]>({ queryKey: ["/api/admin/payroll/agreements"] });
  const batchesQuery = useQuery<PayrollBatch[]>({ queryKey: ["/api/admin/payroll/batches"] });
  const transactionsQuery = useQuery<PayrollTransaction[]>({ queryKey: ["/api/admin/payroll/transactions"] });

  useEffect(() => {
    if (settingsQuery.data) setSettings({ ...defaultSettings, ...settingsQuery.data });
  }, [settingsQuery.data]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (payload: PayrollSettings) => {
      const response = await apiRequest("PUT", "/api/admin/payroll/settings", payload);
      return response.json();
    },
    onSuccess: (saved) => {
      setSettings({ ...defaultSettings, ...saved });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payroll/settings"] });
      toast({ title: "Payroll policy saved" });
    },
    onError: (error: Error) => toast({ title: "Could not save payroll policy", description: error.message, variant: "destructive" }),
  });

  const createPayeeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/payroll/payees", payeeForm);
      return response.json();
    },
    onSuccess: () => {
      setPayeeForm({ name: "", email: "", type: "contestant", userId: "", talentProfileId: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payroll/payees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payroll/summary"] });
      toast({ title: "Freelance payee added" });
    },
    onError: (error: Error) => toast({ title: "Could not add payee", description: error.message, variant: "destructive" }),
  });

  const updatePayeeMutation = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; paymentInfoProvided?: boolean; userId?: string; talentProfileId?: number }) => {
      const response = await apiRequest("PATCH", `/api/admin/payroll/payees/${id}`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payroll/payees"] });
      toast({ title: "Payee readiness updated" });
    },
    onError: (error: Error) => toast({ title: "Could not update payee", description: error.message, variant: "destructive" }),
  });

  const createAgreementMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/payroll/agreements", {
        ...agreementForm,
        status: "draft",
        required: true,
      });
      return response.json();
    },
    onSuccess: () => {
      setAgreementForm({ title: "", type: "winner_payout_terms", version: "1.0", content: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payroll/agreements"] });
      toast({ title: "Agreement template saved" });
    },
    onError: (error: Error) => toast({ title: "Could not save agreement", description: error.message, variant: "destructive" }),
  });

  const summary = summaryQuery.data;
  const activePayees = useMemo(() => (payeesQuery.data || []).filter((payee) => payee.status === "active"), [payeesQuery.data]);
  const toggleMethod = (method: PaymentMethod) => {
    setSettings((current) => ({
      ...current,
      enabledPaymentMethods: current.enabledPaymentMethods.includes(method)
        ? current.enabledPaymentMethods.filter((item) => item !== method)
        : [...current.enabledPaymentMethods, method],
    }));
  };

  const setPlacementModel = (model: PayrollSettings["defaultPlacementModel"]) => {
    const placements = model === "top_three"
      ? [{ place: 1, percentage: 60, label: "First place" }, { place: 2, percentage: 30, label: "Second place" }, { place: 3, percentage: 10, label: "Third place" }]
      : model === "winner_only"
        ? [{ place: 1, percentage: 100, label: "Winner" }]
        : settings.defaultPlacements;
    setSettings((current) => ({ ...current, defaultPlacementModel: model, defaultPlacements: placements }));
  };
  const summaryTiles: Array<{ label: string; value: string; icon: any }> = [
    { label: "Active payees", value: String(summary?.activePayees ?? activePayees.length), icon: Users },
    { label: "Pending payouts", value: money(summary?.pendingCents), icon: Wallet },
    { label: "Paid winnings", value: money(summary?.paidCents), icon: Check },
    { label: "Nonprofit allocations", value: money(summary?.nonprofitCents), icon: Landmark },
  ];

  return (
    <div className="space-y-6" data-testid="admin-payroll-settings">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-orange-400" />
            <h3 className="font-serif text-xl text-white">Payroll, Agreements & Payouts</h3>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-white/50">
            Track freelance competition winnings and payment readiness. The Quest does not classify these recipients as employees or execute an external payout from this screen.
          </p>
        </div>
        <Badge className="w-fit border-amber-400/30 bg-amber-400/10 text-amber-200">
          <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Manual payout recording
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryTiles.map(({ label, value, icon: TileIcon }) => {
          return (
            <div key={label} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/40">
                <TileIcon className="h-3.5 w-3.5 text-orange-400" /> {label}
              </div>
              <div className="mt-2 text-xl font-semibold tabular-nums text-white">{value}</div>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="policy">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-white/[0.06] p-1 sm:grid-cols-3 lg:grid-cols-5">
          <TabsTrigger value="policy">Policy & methods</TabsTrigger>
          <TabsTrigger value="payees">Freelance payees</TabsTrigger>
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="tax-nonprofit">Tax & nonprofit</TabsTrigger>
        </TabsList>

        <TabsContent value="policy" className="mt-5 space-y-5">
          <div className="rounded-lg border border-orange-400/20 bg-orange-400/[0.06] p-4">
            <div className="flex items-start gap-3">
              <FileCheck2 className="mt-0.5 h-5 w-5 flex-none text-orange-300" />
              <div>
                <h4 className="font-medium text-white">Winner entitlement policy</h4>
                <p className="mt-1 text-sm leading-relaxed text-white/55">
                  Only eligible competition winners or placements configured by the host can receive earnings. Payouts are due on the first day of the following month. Payment information must be complete by the competition’s final day.
                </p>
              </div>
            </div>
          </div>

          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-medium text-white">Default placement structure</h4>
                <p className="text-xs text-white/40">Hosts can override this on each competition.</p>
              </div>
              <select
                value={settings.defaultPlacementModel}
                onChange={(event) => setPlacementModel(event.target.value as PayrollSettings["defaultPlacementModel"])}
                className="rounded-md border border-white/20 bg-white/[0.08] px-3 py-2 text-sm text-white"
                aria-label="Default placement structure"
              >
                <option value="winner_only">Winner only</option>
                <option value="top_three">Top three</option>
                <option value="custom">Custom structure</option>
              </select>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {settings.defaultPlacements.map((placement) => (
                <div key={placement.place} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75">
                  <span className="font-medium text-white">{placement.label || `Place ${placement.place}`}</span>
                  <span className="ml-2 text-orange-300">{placement.percentage}%</span>
                </div>
              ))}
            </div>
            {settings.defaultPlacementModel === "custom" && (
              <p className="mt-3 text-xs text-white/45">Custom placement editing is stored through the competition payout-rules API so each host can define their own placement percentages.</p>
            )}
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            <h4 className="font-medium text-white">Payment readiness rules</h4>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-white/50">Payout date</Label>
                <Input value="First day of the following month" readOnly className="mt-1 border-white/15 bg-white/[0.06] text-white/70" />
              </div>
              <div>
                <Label className="text-xs text-white/50">Missing payment information</Label>
                <select
                  value={settings.missingPaymentPolicy}
                  onChange={(event) => setSettings((current) => ({ ...current, missingPaymentPolicy: event.target.value as "forfeit" | "block" }))}
                  className="mt-1 h-10 w-full rounded-md border border-white/20 bg-white/[0.08] px-3 text-sm text-white"
                >
                  <option value="forfeit">Forfeit earnings after final day</option>
                  <option value="block">Block payout until information arrives</option>
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            <h4 className="font-medium text-white">Enabled payment methods</h4>
            <p className="mt-1 text-xs text-white/40">Only method labels and readiness are stored here. Account numbers, CVV, and processor credentials are never stored in Firestore.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {(Object.keys(methodLabels) as PaymentMethod[]).map((method) => {
                const enabled = settings.enabledPaymentMethods.includes(method);
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => toggleMethod(method)}
                    className={`flex min-h-11 items-center justify-between rounded-md border px-3 text-left text-sm transition-colors ${enabled ? "border-orange-400/50 bg-orange-400/10 text-white" : "border-white/10 bg-white/[0.03] text-white/45"}`}
                  >
                    {methodLabels[method]}
                    {enabled && <Check className="h-4 w-4 text-orange-300" />}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex justify-end">
            <Button
              onClick={() => saveSettingsMutation.mutate(settings)}
              disabled={saveSettingsMutation.isPending}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white"
            >
              <Save className="mr-2 h-4 w-4" /> {saveSettingsMutation.isPending ? "Saving..." : "Save payroll policy"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="payees" className="mt-5 space-y-5">
          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            <h4 className="font-medium text-white">Add a freelance payee</h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label className="text-xs text-white/50">Role</Label>
                <select
                  value={payeeForm.type}
                  onChange={(event) => setPayeeForm({ name: "", email: "", type: event.target.value, userId: "", talentProfileId: "" })}
                  className="mt-1 h-10 w-full rounded-md border border-white/20 bg-white/[0.08] px-3 text-sm text-white"
                >
                  <option value="contestant">Contestant</option><option value="host">Host</option><option value="referrer">Referrer</option><option value="nonprofit">Nonprofit</option>
                </select>
              </div>
              {payeeForm.type === "contestant" && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <Label className="text-xs text-white/50">Link to a contestant account (required)</Label>
                  <select
                    value={payeeForm.talentProfileId}
                    onChange={(event) => {
                      const selected = (contestantProfilesQuery.data || []).find((item) => item.id === Number(event.target.value));
                      setPayeeForm((current) => ({
                        ...current,
                        talentProfileId: selected ? String(selected.id) : "",
                        userId: selected?.userId || "",
                        name: selected?.name || "",
                        email: selected?.email || "",
                      }));
                    }}
                    className="mt-1 h-10 w-full rounded-md border border-white/20 bg-white/[0.08] px-3 text-sm text-white"
                  >
                    <option value="">Choose a contestant profile</option>
                    {(contestantProfilesQuery.data || []).map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.email}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <Label className="text-xs text-white/50">Name</Label>
                <Input value={payeeForm.name} onChange={(event) => setPayeeForm({ ...payeeForm, name: event.target.value })} className="mt-1 border-white/15 bg-white/[0.06] text-white" placeholder="Recipient name" readOnly={payeeForm.type === "contestant"} />
              </div>
              <div>
                <Label className="text-xs text-white/50">Email</Label>
                <Input type="email" value={payeeForm.email} onChange={(event) => setPayeeForm({ ...payeeForm, email: event.target.value })} className="mt-1 border-white/15 bg-white/[0.06] text-white" placeholder="recipient@example.com" readOnly={payeeForm.type === "contestant"} />
              </div>
              <Button
                onClick={() => createPayeeMutation.mutate()}
                disabled={createPayeeMutation.isPending || !payeeForm.name || !payeeForm.email || (payeeForm.type === "contestant" && !payeeForm.talentProfileId)}
                className="mt-5 bg-orange-500 text-white"
              >
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
          </section>
          <div className="space-y-2">
            {(payeesQuery.data || []).map((payee) => (
              <div key={payee.id} className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-white">{payee.name}</span><Badge variant="outline" className="border-white/15 text-white/55">{payee.type}</Badge>{payee.status === "inactive" && <Badge variant="secondary">Inactive</Badge>}</div>
                  <div className="mt-1 text-xs text-white/45">{payee.email} · {payee.paymentMethodType ? methodLabels[payee.paymentMethodType] : "Payment method not selected"} · Agreement: {payee.agreementStatus || "pending"}</div>
                  {payee.type === "contestant" && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <select
                        value={payeeLinkSelections[payee.id] ?? String(payee.talentProfileId || "")}
                        onChange={(event) => setPayeeLinkSelections((current) => ({ ...current, [payee.id]: event.target.value }))}
                        aria-label={`Link ${payee.name} to a contestant account`}
                        className="h-10 min-w-0 rounded-md border border-white/15 bg-[#171717] px-3 text-sm text-white"
                      >
                        <option value="">Choose a contestant profile</option>
                        {(contestantProfilesQuery.data || []).map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.email}</option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={updatePayeeMutation.isPending || !payeeLinkSelections[payee.id] || Number(payeeLinkSelections[payee.id]) === Number(payee.talentProfileId)}
                        onClick={() => {
                          const selected = (contestantProfilesQuery.data || []).find((item) => item.id === Number(payeeLinkSelections[payee.id]));
                          if (selected) updatePayeeMutation.mutate({ id: payee.id, userId: selected.userId, talentProfileId: selected.id });
                        }}
                        className="min-h-10 border-white/15 text-white/75"
                      >
                        Link profile
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {payee.type === "contestant" && (
                    <Badge className={payee.talentProfileId ? "border-green-400/30 bg-green-400/10 text-green-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}>
                      {payee.talentProfileId ? "Profile linked" : "Profile not linked"}
                    </Badge>
                  )}
                  {payee.type !== "contestant" && (
                    <>
                      <Badge className={payee.paymentInfoProvided ? "border-green-400/30 bg-green-400/10 text-green-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}>{payee.paymentInfoProvided ? "Details received" : "Details missing"}</Badge>
                      <Button variant="outline" size="sm" onClick={() => updatePayeeMutation.mutate({ id: payee.id, paymentInfoProvided: !payee.paymentInfoProvided })} className="border-white/15 text-white/75">{payee.paymentInfoProvided ? "Mark missing" : "Mark received"}</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {!payeesQuery.isLoading && !(payeesQuery.data || []).length && <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm text-white/40">No freelance payees have been added yet.</div>}
          </div>
        </TabsContent>

        <TabsContent value="agreements" className="mt-5 space-y-5">
          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            <h4 className="font-medium text-white">Create an agreement template</h4>
            <p className="mt-1 text-xs text-white/40">Use this for independent-contractor terms, winner payout terms, releases, or other required acknowledgements.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_190px_90px]">
              <div><Label className="text-xs text-white/50">Title</Label><Input value={agreementForm.title} onChange={(event) => setAgreementForm({ ...agreementForm, title: event.target.value })} className="mt-1 border-white/15 bg-white/[0.06] text-white" placeholder="Independent Contractor & Winner Payout Agreement" /></div>
              <div><Label className="text-xs text-white/50">Agreement type</Label><Input value={agreementForm.type} onChange={(event) => setAgreementForm({ ...agreementForm, type: event.target.value })} className="mt-1 border-white/15 bg-white/[0.06] text-white" /></div>
              <div><Label className="text-xs text-white/50">Version</Label><Input value={agreementForm.version} onChange={(event) => setAgreementForm({ ...agreementForm, version: event.target.value })} className="mt-1 border-white/15 bg-white/[0.06] text-white" /></div>
            </div>
            <div className="mt-3"><Label className="text-xs text-white/50">Agreement text</Label><Textarea value={agreementForm.content} onChange={(event) => setAgreementForm({ ...agreementForm, content: event.target.value })} className="mt-1 min-h-32 border-white/15 bg-white/[0.06] text-white" placeholder="Enter the agreement terms that the signer must review and accept." /></div>
            <div className="mt-3 flex justify-end"><Button onClick={() => createAgreementMutation.mutate()} disabled={createAgreementMutation.isPending || !agreementForm.title || !agreementForm.content} className="bg-orange-500 text-white"><Plus className="mr-2 h-4 w-4" /> Save draft</Button></div>
          </section>
          <div className="space-y-2">
            {(agreementsQuery.data || []).map((agreement) => (
              <div key={agreement.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-orange-300" /><span className="font-medium text-white">{agreement.title}</span><Badge variant="outline" className="border-white/15 text-white/55">v{agreement.version}</Badge></div><Badge variant="secondary">{agreement.status}</Badge></div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/45">{agreement.content}</p>
              </div>
            ))}
            {!agreementsQuery.isLoading && !(agreementsQuery.data || []).length && <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm text-white/40">No agreement templates have been created yet.</div>}
          </div>
        </TabsContent>

        <TabsContent value="ledger" className="mt-5 space-y-5">
          <section>
            <div className="mb-3 flex items-end justify-between"><div><h4 className="font-medium text-white">Payout batches</h4><p className="text-xs text-white/40">Payouts become due on the first day after the competition month.</p></div><Badge variant="outline" className="border-white/15 text-white/55">{summary?.batches || 0} batches</Badge></div>
            <div className="space-y-2">
              {(batchesQuery.data || []).map((batch) => (
                <div key={batch.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><span className="font-medium text-white">{batch.competitionTitle}</span><span className="ml-2 text-xs text-white/40">Due {dateLabel(batch.payoutDueDate)}</span></div><Badge variant="outline" className="w-fit border-white/15 text-white/60">{batch.status}</Badge></div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-white/50 sm:grid-cols-5"><span>Gross <b className="block text-white">{money(batch.grossCents)}</b></span><span>Deductions <b className="block text-white">{money(batch.deductionsCents)}</b></span><span>Nonprofit <b className="block text-white">{money(batch.nonprofitCents)}</b></span><span>Net <b className="block text-orange-300">{money(batch.netCents)}</b></span><span>Forfeited <b className="block text-amber-200">{money(batch.forfeitedCents)}</b></span></div>
                </div>
              ))}
              {!batchesQuery.isLoading && !(batchesQuery.data || []).length && <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm text-white/40">No payout batches have been created yet.</div>}
            </div>
          </section>
          <section>
            <div className="mb-3 flex items-end justify-between"><div><h4 className="font-medium text-white">Recent transactions</h4><p className="text-xs text-white/40">Earnings, deductions, nonprofit selections, forfeitures, and payout records.</p></div><Badge variant="outline" className="border-white/15 text-white/55">{summary?.transactions || 0} tracked</Badge></div>
            <div className="space-y-2">
              {(transactionsQuery.data || []).slice(0, 12).map((transaction) => (
                <div key={transaction.id} className="flex flex-col gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><Badge variant="outline" className="mr-2 border-white/15 text-white/55">{transaction.type.replace("_", " ")}</Badge><span className="text-sm text-white/70">{transaction.memo || transaction.nonprofitSelection || "Recorded transaction"}</span></div><span className="text-sm font-medium tabular-nums text-white">{money(transaction.amountCents)}</span></div>
              ))}
              {!transactionsQuery.isLoading && !(transactionsQuery.data || []).length && <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm text-white/40">Transactions will appear when an entitlement or payout is recorded.</div>}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="tax-nonprofit" className="mt-5">
          <AdminTaxNonprofit />
        </TabsContent>
      </Tabs>
    </div>
  );
}