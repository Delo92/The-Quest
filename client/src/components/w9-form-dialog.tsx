import { useEffect, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ChevronDown, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  emptyW9TaxForm,
  W9TaxFormSchema,
  type W9TaxFormValues,
} from "@shared/w9-tax-form";

const w9PdfUrl = `${import.meta.env.BASE_URL}irs-w9-2024.pdf`;
const w9PageImageUrl = `${import.meta.env.BASE_URL}irs-w9-page-1.png`;

const taxClassifications = [
  { value: "individual_sole_proprietor", label: "Individual / sole proprietor" },
  { value: "c_corporation", label: "C corporation" },
  { value: "s_corporation", label: "S corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "trust_estate", label: "Trust / estate" },
  { value: "llc", label: "Limited liability company (LLC)" },
  { value: "other", label: "Other" },
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues?: Partial<Omit<W9TaxFormValues, "taxId">> | null;
  hasSavedTaxId: boolean;
  taxIdLast4?: string | null;
  canSave: boolean;
  isSaving: boolean;
  onSubmit: (values: W9TaxFormValues) => void;
};

function PreviewText({
  children,
  left,
  top,
  width,
  className = "",
}: {
  children: ReactNode;
  left: string;
  top: string;
  width: string;
  className?: string;
}) {
  if (children === null || children === undefined || children === "") return null;

  return (
    <span
      className={`absolute z-10 overflow-hidden whitespace-nowrap bg-white/80 px-[1px] font-medium leading-tight text-[#171717] ${className}`}
      style={{
        left,
        top,
        width,
        fontSize: "clamp(5px, 0.9vw, 11px)",
      }}
    >
      {children}
    </span>
  );
}

export default function W9FormDialog({
  open,
  onOpenChange,
  initialValues,
  hasSavedTaxId,
  taxIdLast4,
  canSave,
  isSaving,
  onSubmit,
}: Props) {
  const [w9PreviewOpen, setW9PreviewOpen] = useState(false);
  const hasSavedW9 = Boolean(initialValues);
  const previewValues = { ...emptyW9TaxForm, ...initialValues, taxId: "" };
  const safeTaxIdLast4 = (taxIdLast4 || "").replace(/\D/g, "").slice(-4);
  const taxClassificationLabel = taxClassifications.find(
    (classification) => classification.value === previewValues.federalTaxClassification,
  )?.label;
  const savedClassification =
    previewValues.federalTaxClassification === "llc" && previewValues.llcTaxClassification
      ? `LLC · ${previewValues.llcTaxClassification}`
      : previewValues.federalTaxClassification === "other" && previewValues.otherTaxClassification
        ? `Other · ${previewValues.otherTaxClassification}`
        : taxClassificationLabel;
  const mailingAddress = [previewValues.address1, previewValues.address2].filter(Boolean).join(", ");
  const cityStatePostal = [previewValues.city, previewValues.state, previewValues.postalCode]
    .filter(Boolean)
    .join(", ");
  const location = [cityStatePostal, previewValues.country !== "US" ? previewValues.country : ""]
    .filter(Boolean)
    .join(" · ");

  const form = useForm<W9TaxFormValues>({
    resolver: zodResolver(W9TaxFormSchema),
    defaultValues: { ...emptyW9TaxForm, ...initialValues, taxId: "" },
  });
  const federalTaxClassification = useWatch({
    control: form.control,
    name: "federalTaxClassification",
  });
  const taxIdType = useWatch({ control: form.control, name: "taxIdType" });

  useEffect(() => {
    if (open) {
      form.reset({ ...emptyW9TaxForm, ...initialValues, taxId: "" });
      setW9PreviewOpen(false);
    }
  }, [form, initialValues, open]);

  const submit = (values: W9TaxFormValues) => {
    if (!hasSavedTaxId && values.taxId.replace(/\D/g, "").length !== 9) {
      form.setError("taxId", { message: "Enter your 9-digit SSN or EIN." });
      return;
    }
    onSubmit(values);
  };

  const inputClass = "border-black/20 bg-white text-black placeholder:text-black/35 focus-visible:ring-orange-500";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[94vh] w-[calc(100vw-1rem)] max-w-5xl overflow-y-auto border-white/10 bg-[#171717] p-0 text-white sm:w-[calc(100vw-2rem)]"
        data-testid="dialog-fill-w9"
      >
        <DialogHeader className="sticky top-0 z-10 border-b border-white/10 bg-[#171717] px-5 py-4 text-left sm:px-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <DialogTitle>Form W-9</DialogTitle>
              <DialogDescription className="mt-1 text-white/60">
                Request for Taxpayer Identification Number and Certification · March 2024
              </DialogDescription>
            </div>
            <a
              href={w9PdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-orange-300 underline decoration-orange-300/50 underline-offset-4 hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              data-testid="link-attached-w9-pdf"
            >
              Open blank IRS W-9 PDF
            </a>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-5 px-4 pb-5 sm:px-7 sm:pb-7">
            <p className="rounded-md border border-orange-300/20 bg-orange-300/[0.06] p-3 text-sm text-white/75">
              Review the saved W-9 preview, then edit the secure fields below to update Tax Details. The tax ID is encrypted and only its last four digits appear in the preview.
            </p>
            {!canSave && (
              <p className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm text-amber-100/80" role="status">
                Acknowledge the tax deadline and confirm secure tax storage is available before saving.
              </p>
            )}

            <section className="space-y-3" aria-label="Saved Form W-9 preview">
              <Button
                type="button"
                variant="outline"
                aria-expanded={w9PreviewOpen}
                aria-controls="w9-saved-preview"
                onClick={() => setW9PreviewOpen((open) => !open)}
                className="min-h-11 w-full justify-between border-white/20 text-left text-white hover:bg-white/10 sm:w-auto sm:min-w-72"
                data-testid="button-toggle-w9-pdf"
              >
                <span className="flex items-center">
                  <FileText className="mr-2 h-4 w-4 shrink-0" />
                  {hasSavedW9 ? "Preview saved W-9" : "Preview blank W-9 template"}
                </span>
                <ChevronDown
                  className={`ml-3 h-4 w-4 shrink-0 transition-transform ${w9PreviewOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </Button>
              {w9PreviewOpen && (
                <div id="w9-saved-preview" className="space-y-3" data-testid="w9-saved-preview">
                  <p
                    className={`rounded-md border p-3 text-sm ${
                      hasSavedW9
                        ? "border-white/10 bg-white/[0.04] text-white/65"
                        : "border-amber-300/20 bg-amber-300/[0.06] text-amber-100/85"
                    }`}
                    role="status"
                    data-testid="w9-preview-status"
                  >
                    {hasSavedW9
                      ? "Saved profile details are shown on this form. Only the tax ID’s last four digits are visible."
                      : "No W-9 is saved yet. This is a blank IRS template; complete the fields below to save your information."}
                  </p>
                  <div className="max-h-[min(55vh,560px)] overflow-y-auto rounded-md bg-white">
                    <div className="relative mx-auto w-full" data-testid="w9-preview-page">
                      <img
                        src={w9PageImageUrl}
                        alt="Page 1 of the March 2024 IRS Form W-9 template"
                        className="block h-auto w-full"
                        data-testid="image-attached-w9-page"
                      />
                    {hasSavedW9 && (
                      <>
                        <PreviewText left="11.8%" top="15.2%" width="82%">
                          {previewValues.legalName}
                        </PreviewText>
                        <PreviewText left="11.8%" top="18.2%" width="82%">
                          {previewValues.businessName}
                        </PreviewText>

                        {[
                          { value: "individual_sole_proprietor", left: "11.8%", top: "22.7%" },
                          { value: "c_corporation", left: "29.1%", top: "22.7%" },
                          { value: "s_corporation", left: "40.7%", top: "22.7%" },
                          { value: "partnership", left: "52.4%", top: "22.7%" },
                          { value: "trust_estate", left: "63.7%", top: "22.7%" },
                          { value: "llc", left: "11.8%", top: "25.1%" },
                          { value: "other", left: "11.8%", top: "28.9%" },
                        ].map((mark) =>
                          previewValues.federalTaxClassification === mark.value ? (
                            <PreviewText
                              key={mark.value}
                              left={mark.left}
                              top={mark.top}
                              width="3%"
                              className="bg-transparent text-[1.2em] font-bold"
                            >
                              ✓
                            </PreviewText>
                          ) : null,
                        )}
                        {previewValues.federalTaxClassification === "llc" && previewValues.llcTaxClassification && (
                          <PreviewText left="26%" top="25.1%" width="17%">
                            {previewValues.llcTaxClassification}
                          </PreviewText>
                        )}
                        {previewValues.federalTaxClassification === "other" && previewValues.otherTaxClassification && (
                          <PreviewText left="20%" top="28.9%" width="32%">
                            {previewValues.otherTaxClassification}
                          </PreviewText>
                        )}
                        <PreviewText left="73.5%" top="26.1%" width="20%">
                          {previewValues.exemptPayeeCode}
                        </PreviewText>
                        <PreviewText left="73.5%" top="29.2%" width="20%">
                          {previewValues.fatcaExemptionCode}
                        </PreviewText>
                        {previewValues.hasForeignOwners && (
                          <PreviewText left="72.4%" top="33.5%" width="3%" className="bg-transparent text-[1.2em] font-bold">
                            ✓
                          </PreviewText>
                        )}
                        <PreviewText left="11.8%" top="36.1%" width="49%">
                          {mailingAddress}
                        </PreviewText>
                        <PreviewText left="62%" top="36.1%" width="31%">
                          {previewValues.requesterNameAddress}
                        </PreviewText>
                        <PreviewText left="11.8%" top="39.2%" width="82%">
                          {location}
                        </PreviewText>
                        <PreviewText left="11.8%" top="42.4%" width="82%">
                          {previewValues.accountNumbers}
                        </PreviewText>
                        <PreviewText left="68.5%" top="47.1%" width="23%">
                          {previewValues.taxIdType === "ssn"
                            ? safeTaxIdLast4
                              ? `•••-••-${safeTaxIdLast4}`
                              : "Not on file"
                            : ""}
                        </PreviewText>
                        <PreviewText left="68.5%" top="53.3%" width="23%">
                          {previewValues.taxIdType === "ein"
                            ? safeTaxIdLast4
                              ? `••-•••${safeTaxIdLast4}`
                              : "Not on file"
                            : ""}
                        </PreviewText>
                        {previewValues.backupWithholdingCrossedOut && (
                          <span
                            aria-label="Backup withholding certification crossed out"
                            className="absolute z-10 border-t border-black"
                            style={{ left: "7%", top: "66.5%", width: "88%" }}
                          />
                        )}
                        <PreviewText left="15.3%" top="74.4%" width="42%">
                          {previewValues.signature}
                        </PreviewText>
                        <PreviewText left="48.5%" top="74.4%" width="29%">
                          {previewValues.signatureDate}
                        </PreviewText>
                      </>
                    )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                    <a
                      href={w9PageImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-300 underline underline-offset-4 hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                    >
                      Open page 1 at full size
                    </a>
                    <a
                      href={w9PdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-300 underline underline-offset-4 hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                    >
                      Open full 6-page IRS template
                    </a>
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-4 rounded-md bg-white p-4 text-black sm:p-6" aria-labelledby="w9-identification-heading">
              <h3 id="w9-identification-heading" className="border-b border-black/15 pb-2 text-base font-semibold">
                Taxpayer information
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="legalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black">1 · Name of entity / individual</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="name" className={inputClass} data-testid="input-w9-legal-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black">2 · Business name / disregarded entity (if different)</FormLabel>
                      <FormControl>
                        <Input {...field} className={inputClass} data-testid="input-w9-business-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="federalTaxClassification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-black">3a · Federal tax classification (select one)</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
                        data-testid="radio-w9-tax-classification"
                      >
                        {taxClassifications.map((classification) => (
                          <Label
                            key={classification.value}
                            htmlFor={`w9-class-${classification.value}`}
                            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm font-normal hover:bg-black/[0.04]"
                          >
                            <RadioGroupItem
                              id={`w9-class-${classification.value}`}
                              value={classification.value}
                              data-testid={`radio-w9-class-${classification.value}`}
                            />
                            <span>{classification.label}</span>
                          </Label>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {federalTaxClassification === "llc" && (
                <FormField
                  control={form.control}
                  name="llcTaxClassification"
                  render={({ field }) => (
                    <FormItem className="max-w-sm">
                      <FormLabel className="text-black">LLC tax classification</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="h-10 w-full rounded-md border border-black/20 bg-white px-3 text-sm text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                          data-testid="select-w9-llc-classification"
                        >
                          <option value="">Select C, S, or P</option>
                          <option value="C">C corporation</option>
                          <option value="S">S corporation</option>
                          <option value="P">Partnership</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-black/55">If the LLC is disregarded, select the tax classification of its owner above instead.</p>
                    </FormItem>
                  )}
                />
              )}

              {federalTaxClassification === "other" && (
                <FormField
                  control={form.control}
                  name="otherTaxClassification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black">Other federal tax classification</FormLabel>
                      <FormControl>
                        <Input {...field} className={inputClass} data-testid="input-w9-other-classification" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="hasForeignOwners"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 rounded-md border border-black/10 p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-0.5 border-black/40 data-[state=checked]:border-orange-600 data-[state=checked]:bg-orange-600"
                        data-testid="checkbox-w9-foreign-owners"
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="cursor-pointer text-sm font-normal leading-relaxed text-black">
                        3b · I am a partnership, trust/estate, or LLC taxed as a partnership with foreign partners, owners, or beneficiaries as described in the W-9 instructions.
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="exemptPayeeCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black">4 · Exempt payee code (if any)</FormLabel>
                      <FormControl>
                        <Input {...field} className={inputClass} data-testid="input-w9-exempt-payee-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fatcaExemptionCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black">4 · FATCA exemption code (if any)</FormLabel>
                      <FormControl>
                        <Input {...field} className={inputClass} data-testid="input-w9-fatca-code" />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-black/55">Applies only to accounts maintained outside the United States.</p>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="address1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black">5 · Address (number, street, apartment or suite)</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="address-line1" className={inputClass} data-testid="input-w9-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="requesterNameAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black">Requester’s name and address (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} className={inputClass} data-testid="input-w9-requester-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="address2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black">Apartment, suite, etc. (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="address-line2" className={inputClass} data-testid="input-w9-address2" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accountNumbers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black">7 · List account number(s) here (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} className={inputClass} data-testid="input-w9-account-numbers" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-black">6 · City, state, and ZIP code</Label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} autoComplete="address-level2" placeholder="City" aria-label="W-9 city" className={inputClass} data-testid="input-w9-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} autoComplete="address-level1" placeholder="State / region" aria-label="W-9 state or region" maxLength={2} className={inputClass} data-testid="input-w9-state" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} autoComplete="postal-code" placeholder="ZIP / postal code" aria-label="W-9 ZIP or postal code" className={inputClass} data-testid="input-w9-postal-code" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} autoComplete="country" placeholder="Country code" aria-label="W-9 country code, if applicable" maxLength={2} className={inputClass} data-testid="input-w9-country" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-md bg-white p-4 text-black sm:p-6" aria-labelledby="w9-tin-heading">
              <h3 id="w9-tin-heading" className="border-b border-black/15 pb-2 text-base font-semibold">
                Part I · Taxpayer Identification Number (TIN)
              </h3>
              <FormField
                control={form.control}
                name="taxIdType"
                render={({ field }) => (
                  <FormItem className="max-w-sm">
                    <FormLabel className="text-black">TIN type</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="h-10 w-full rounded-md border border-black/20 bg-white px-3 text-sm text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                        data-testid="select-w9-tin-type"
                      >
                        <option value="ssn">Social Security number</option>
                        <option value="ein">Employer identification number</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="taxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-black">
                      {taxIdType === "ein" ? "Employer identification number" : "Social Security number"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={9}
                        placeholder={hasSavedTaxId ? `Saved securely · ending in ${taxIdLast4 || "••••"}` : "Enter 9 digits"}
                        className={`${inputClass} max-w-sm`}
                        data-testid="input-w9-tax-id"
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-black/55">
                      {hasSavedTaxId
                        ? "Leave blank to keep the saved number, or enter all 9 digits to replace it."
                        : "Enter the 9-digit number associated with the name above."}
                    </p>
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-4 rounded-md bg-white p-4 text-black sm:p-6" aria-labelledby="w9-certification-heading">
              <h3 id="w9-certification-heading" className="border-b border-black/15 pb-2 text-base font-semibold">
                Part II · Certification
              </h3>
              <p className="text-sm leading-relaxed">
                Under penalties of perjury, I certify that my taxpayer identification number is correct (or I am waiting for a number to be issued); I am not subject to backup withholding unless I have indicated otherwise below; I am a U.S. citizen or other U.S. person; and any FATCA exemption code entered is correct.
              </p>
              <FormField
                control={form.control}
                name="backupWithholdingCrossedOut"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 rounded-md border border-black/10 p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-0.5 border-black/40 data-[state=checked]:border-orange-600 data-[state=checked]:bg-orange-600"
                        data-testid="checkbox-w9-backup-withholding"
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="cursor-pointer text-sm font-normal leading-relaxed text-black">
                        I have been notified by the IRS that I am currently subject to backup withholding; cross out certification item 2.
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="certificationAccepted"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 rounded-md border border-black/10 p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-0.5 border-black/40 data-[state=checked]:border-orange-600 data-[state=checked]:bg-orange-600"
                        data-testid="checkbox-w9-certification"
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="cursor-pointer text-sm font-normal leading-relaxed text-black">
                        I certify that the information provided is true and correct and that I am authorized to sign this Form W-9.
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="signature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black">Signature of U.S. person (type your full legal name)</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="name" className={inputClass} data-testid="input-w9-signature" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="signatureDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black">Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className={inputClass} data-testid="input-w9-signature-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
                className="min-h-11 border-white/20 text-white hover:bg-white/10"
                data-testid="button-cancel-w9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="min-h-11 bg-orange-500 text-white hover:bg-orange-400"
                data-testid="button-save-w9"
              >
                {isSaving ? "Saving securely…" : "Save completed W-9"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}