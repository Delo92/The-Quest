import { useState } from "react";
import { ChevronDown } from "lucide-react";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import { useLivery } from "@/hooks/use-livery";
import { useSEO } from "@/hooks/use-seo";

export default function FAQPage() {
  const { getText, getImage } = useLivery();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useSEO({
    title: "FAQ - HiFitComp",
    description: "Frequently asked questions about the HI FIT Competition platform. Learn about voting, nominations, fees, and how to participate.",
    canonical: "https://thequest-2dc77.firebaseapp.com/faq",
  });

  const breadcrumbBg = getImage("breadcrumb_bg", "/images/template/breadcumb.jpg");

  const faqs: { question: string; answer: string }[] = [];
  for (let i = 1; i <= 19; i++) {
    const q = getText(`faq_${i}_q`, "");
    const a = getText(`faq_${i}_a`, "");
    if (q.trim()) {
      faqs.push({ question: q, answer: a });
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteNavbar />

      <div
        className="relative py-24 bg-cover bg-center"
        style={{ backgroundImage: `url(${breadcrumbBg})` }}
      >
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <h1
            className="font-serif text-4xl md:text-5xl uppercase tracking-[6px] mb-4"
            data-testid="text-faq-title"
          >
            Frequently Asked Questions
          </h1>
          <p className="text-white/50 text-sm uppercase tracking-wider">
            Everything you need to know about the HI FIT Competition
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="border border-white/10 rounded-lg overflow-hidden bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                data-testid={`faq-item-${index}`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer"
                  data-testid={`button-faq-toggle-${index}`}
                >
                  <span className="text-sm md:text-base font-semibold text-white pr-4">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 text-[#FF5A09] flex-shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 pt-0" data-testid={`text-faq-answer-${index}`}>
                    <div className="border-t border-white/10 pt-4">
                      <p className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {faqs.length === 0 && (
          <div className="text-center py-16">
            <p className="text-white/40 text-sm">No FAQ items have been configured yet.</p>
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
