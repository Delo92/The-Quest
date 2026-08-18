import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreditCard, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";

export interface PaymentLineItem {
  label: string;
  value: string;
  highlight?: boolean;
}

interface PaymentConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  processing: boolean;
  title: string;
  description?: string;
  lineItems: PaymentLineItem[];
  totalLabel?: string;
  totalAmount: string;
  confirmText?: string;
  cancelText?: string;
  termsSummary?: string;
  termsFinePrint?: string;
}

export default function PaymentConfirmationModal({
  open,
  onClose,
  onConfirm,
  processing,
  title,
  description,
  lineItems,
  totalLabel = "Total",
  totalAmount,
  confirmText = "CONFIRM & PAY",
  cancelText = "CANCEL",
  termsSummary,
  termsFinePrint,
}: PaymentConfirmationModalProps) {
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [showFinePrint, setShowFinePrint] = useState(false);

  const hasTerms = !!(termsSummary?.trim());
  const summaryLines = termsSummary?.trim().split("\n").filter((l) => l.trim()) || [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !processing && onClose()}>
      <DialogContent className="bg-[#111] border-white/10 text-white max-w-md max-h-[90vh] overflow-y-auto" data-testid="modal-payment-confirmation">
        <DialogHeader>
          <DialogTitle className="text-white uppercase text-lg tracking-[4px] text-center">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-white/50 text-center text-sm mt-1">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="border border-white/10 rounded p-4 mt-2 space-y-2">
          {lineItems.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className={item.highlight ? "text-[#FF5A09]" : "text-white/60"}>{item.label}</span>
              <span className={item.highlight ? "text-[#FF5A09] font-semibold" : "text-white"}>{item.value}</span>
            </div>
          ))}

          <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/20">
            <span className="text-white font-bold uppercase tracking-wider text-sm">{totalLabel}</span>
            <span className="text-[#FF5A09] font-bold text-xl">{totalAmount}</span>
          </div>
        </div>

        {hasTerms && (
          <div className="mt-3 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer group" data-testid="label-terms-checkbox">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/30 accent-[#FF5A09] cursor-pointer flex-shrink-0"
                data-testid="checkbox-terms"
              />
              <span className="text-xs text-white/70 leading-relaxed">
                I agree to the Terms & Conditions:
              </span>
            </label>

            <ul className="pl-9 space-y-1">
              {summaryLines.map((line, i) => (
                <li key={i} className="text-[11px] text-white/50 leading-relaxed flex items-start gap-2">
                  <span className="text-[#FF5A09] mt-0.5 flex-shrink-0">•</span>
                  <span>{line.trim()}</span>
                </li>
              ))}
            </ul>

            {termsFinePrint?.trim() && (
              <div className="pl-9">
                <button
                  type="button"
                  onClick={() => setShowFinePrint(!showFinePrint)}
                  className="text-[11px] text-[#FF5A09] hover:text-orange-300 transition-colors flex items-center gap-1 mt-1"
                  data-testid="button-view-fine-print"
                >
                  {showFinePrint ? "Hide" : "View"} Full Details
                  {showFinePrint ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {showFinePrint && (
                  <div className="mt-2 p-3 bg-white/5 border border-white/10 rounded text-[11px] text-white/50 leading-relaxed max-h-[200px] overflow-y-auto whitespace-pre-wrap" data-testid="text-fine-print">
                    {termsFinePrint.trim()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 text-white/30 text-xs mt-1 justify-center">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Processed securely via Authorize.Net</span>
        </div>

        <div className="flex flex-col gap-3 mt-2">
          <button
            onClick={onConfirm}
            disabled={processing || (hasTerms && !termsAccepted)}
            className="w-full bg-[#FF5A09] text-white font-bold text-sm uppercase px-6 leading-[48px] border border-[#FF5A09] transition-all duration-500 hover:bg-transparent hover:text-[#FF5A09] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            data-testid="button-confirm-payment"
          >
            <CreditCard className="h-4 w-4" />
            {processing ? "PROCESSING..." : confirmText}
          </button>
          <button
            onClick={onClose}
            disabled={processing}
            className="w-full text-white/50 text-sm uppercase tracking-wider hover:text-white transition-colors disabled:opacity-30"
            data-testid="button-cancel-payment"
          >
            {cancelText}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
