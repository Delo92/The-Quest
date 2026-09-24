import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck } from "lucide-react";
import { MAX_NONPROFIT_CONTRIBUTION_PERCENT, type NonprofitContributionRates } from "@shared/nonprofit-policy";

export type NonprofitDeclaration = {
  publicName: string;
  legalName: string;
  legalStatus: string;
  taxIdStatus: string;
  taxIdLast4: string;
  mailingAddress: string;
  website: string;
  donationContactName: string;
  donationContactEmail: string;
  donationContactPhone: string;
  designation: string;
  programAcknowledged: boolean;
  programAcknowledgedAt?: string | null;
  consentToDonate: boolean;
  verificationStatus?: string;
  verifiedAt?: string | null;
};

export const emptyNonprofitDeclaration: NonprofitDeclaration = {
  publicName: "",
  legalName: "",
  legalStatus: "pending",
  taxIdStatus: "not_provided",
  taxIdLast4: "",
  mailingAddress: "",
  website: "",
  donationContactName: "",
  donationContactEmail: "",
  donationContactPhone: "",
  designation: "",
  programAcknowledged: false,
  consentToDonate: false,
};

export default function NonprofitDeclarationForm({
  value,
  onChange,
  level,
}: {
  value: NonprofitDeclaration;
  onChange: (value: NonprofitDeclaration) => void;
  level: "contestant" | "host";
}) {
  const { data: settings } = useQuery<{ nonprofitContributionRates?: NonprofitContributionRates }>({
    queryKey: ["/api/join/settings"],
    staleTime: 60_000,
  });
  const contributionRate = settings?.nonprofitContributionRates?.[level];
  const set = (key: keyof NonprofitDeclaration, next: string | boolean) => onChange({ ...value, [key]: next });
  const field = (key: keyof NonprofitDeclaration, label: string, placeholder: string, type = "text") => (
    <div className="space-y-1.5">
      <Label className="text-white/65">{label}</Label>
      <Input type={type} value={String(value[key] || "")} onChange={(event) => set(key, event.target.value)} placeholder={placeholder} className="bg-white/[0.07] border-white/15 text-white placeholder:text-white/25" />
    </div>
  );

  return (
    <div className="space-y-4 rounded-md border border-orange-400/20 bg-white/[0.03] p-5" data-testid="nonprofit-declaration-form">
      <div className="flex items-start gap-3 border-b border-white/10 pb-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-orange-300" />
        <div>
          <p className="text-sm font-semibold text-white">Required nonprofit declaration</p>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            A nonprofit contribution is required for prize earnings. Your {level} rate is{" "}
            {typeof contributionRate === "number"
              ? <strong className="text-orange-200">{contributionRate}%</strong>
              : <>not configured yet (the maximum is {MAX_NONPROFIT_CONTRIBUTION_PERCENT}%)</>}.
            You can save this declaration in stages; prize payments remain on hold until you provide a nonprofit name and acknowledge the policy.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {field("publicName", "Public nonprofit name", "Name shown in donation records")}
        {field("legalName", "Legal organization name", "Registered legal name")}
        <div className="space-y-1.5">
          <Label className="text-white/65">Legal status</Label>
          <select value={value.legalStatus} onChange={(event) => set("legalStatus", event.target.value)} className="h-10 w-full rounded-md border border-white/15 bg-white/[0.07] px-3 text-sm text-white">
            <option value="501c3">501(c)(3)</option><option value="other">Other nonprofit</option><option value="pending">Verification pending</option><option value="not_verified">Not verified</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/65">Tax ID status</Label>
          <select value={value.taxIdStatus} onChange={(event) => set("taxIdStatus", event.target.value)} className="h-10 w-full rounded-md border border-white/15 bg-white/[0.07] px-3 text-sm text-white">
            <option value="not_provided">Not provided</option><option value="on_file_external">Held in external records</option><option value="verified">Verified</option>
          </select>
        </div>
        {field("taxIdLast4", "Tax ID last four (optional)", "Last four only")}
        {field("website", "Website", "https://example.org", "url")}
        {field("donationContactName", "Donation contact", "Contact name")}
        {field("donationContactEmail", "Donation contact email", "donations@example.org", "email")}
        {field("donationContactPhone", "Donation contact phone", "(555) 555-5555", "tel")}
      </div>
      <div className="space-y-1.5">
        <Label className="text-white/65">Mailing address</Label>
        <Textarea value={value.mailingAddress} onChange={(event) => set("mailingAddress", event.target.value)} placeholder="Address needed for formal donation records" className="min-h-20 bg-white/[0.07] border-white/15 text-white placeholder:text-white/25" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-white/65">Nonprofit designation or instructions</Label>
        <Textarea value={value.designation} onChange={(event) => set("designation", event.target.value)} placeholder="Optional restrictions or program designation" className="min-h-20 bg-white/[0.07] border-white/15 text-white placeholder:text-white/25" />
      </div>
      <label className="flex items-start gap-3 rounded-md border border-orange-400/20 bg-orange-400/5 p-3 text-xs text-white/65">
        <input
          type="checkbox"
          checked={value.programAcknowledged === true}
          onChange={(event) => onChange({ ...value, programAcknowledged: event.target.checked, consentToDonate: event.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-orange-500"
          aria-label="Acknowledge the required nonprofit contribution policy"
        />
        <span>
          I acknowledge that a nonprofit contribution at the configured {level} rate is required for prize earnings, and I designate the nonprofit named above for that allocation. I can save remaining organization details later.
        </span>
      </label>
    </div>
  );
}