import { useState } from "react";
import "./_group.css";
import { Check, CheckCircle, Heart, Package } from "lucide-react";

const packages = [
  { id: "starter", name: "Starter Pack", votes: 500, bonus: 0, price: 10, description: "500 votes to support your favorite" },
  { id: "fan", name: "Fan Pack", votes: 1000, bonus: 300, price: 15, description: "1,000 votes + 300 bonus votes" },
  { id: "super", name: "Super Fan Pack", votes: 2000, bonus: 600, price: 30, description: "2,000 votes + 600 bonus votes" },
];

function StepHeading({ number, title, hint }: { number: string; title: string; hint?: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#FF5A09]/70 bg-[#FF5A09]/10 font-['Bebas_Neue'] text-lg text-[#ff9a6d]">
        {number}
      </span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ff9a6d]">Step {number}</p>
        <h2 className="font-['Bebas_Neue'] text-xl uppercase tracking-[0.16em] text-white">{title}</h2>
      </div>
      {hint && <p className="ml-auto hidden text-right text-xs text-white/55 sm:block">{hint}</p>}
    </div>
  );
}

function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        selected ? "border-[#FF5A09] bg-[#FF5A09]" : "border-white/55 bg-transparent"
      }`}
    >
      {selected && <Check className="h-3 w-3 stroke-[3] text-white" />}
    </span>
  );
}

export function ClearAffordances() {
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("John Test");
  const [email, setEmail] = useState("Johntest@test.com");
  const [voteCount, setVoteCount] = useState(1);
  const currentPackage = packages.find((item) => item.id === selected);
  const total = currentPackage?.price ?? (selected === "individual" ? voteCount : 0);

  return (
    <main className="min-h-screen bg-[#111] px-4 pb-10 text-white sm:px-6">
      <header className="relative -mx-4 mb-8 h-36 overflow-hidden sm:-mx-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_10%,rgba(255,90,9,.32),transparent_62%),linear-gradient(120deg,#0d1110,#271813,#101112)]" />
        <div className="absolute inset-x-0 bottom-0 bg-white/90 px-4 py-4 text-center text-black/70">
          <p className="text-sm">Raphlahoma <span className="mx-2">/</span> Buy Votes</p>
          <h1 className="font-['Bebas_Neue'] text-[30px] tracking-[10px]">CHECKOUT</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl">
        <a href="#" className="mb-7 inline-flex min-h-10 items-center text-sm text-white/65 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09]">
          ←&nbsp; Back to competition
        </a>

        <div className="mb-9 flex items-center gap-4 border border-white/20 border-l-4 border-l-[#FF5A09] bg-white/[0.035] p-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-[#173c5b] font-['Bebas_Neue'] text-xl text-white">
            WYA
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/65">Voting for</p>
            <h2 className="font-bold uppercase">JUNEOUTSXZDE</h2>
            <p className="text-xs text-white/55">Raphlahoma</p>
          </div>
        </div>

        <section className="mb-8">
          <StepHeading number="1" title="Choose your votes" hint="Select one option" />

          <div className="space-y-3">
            <div className={`overflow-hidden rounded-sm border transition-colors ${
              selected === "individual"
                ? "border-[#FF5A09] bg-[#ff5a09]/[0.09] shadow-[inset_0_0_0_1px_rgba(255,90,9,0.42)]"
                : "border-white/30 bg-[#171918] hover:border-[#ff9a6d]/80"
            }`}>
              <button
                type="button"
                aria-pressed={selected === "individual"}
                onClick={() => setSelected("individual")}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FF5A09]"
              >
                <SelectionMark selected={selected === "individual"} />
                <span className={`flex h-9 w-9 items-center justify-center rounded-sm ${
                  selected === "individual" ? "bg-[#FF5A09]/15 text-[#ff9a6d]" : "bg-white/[0.07] text-white/70"
                }`}>
                  <Heart className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold uppercase tracking-[0.12em]">Buy individual votes</span>
                  <span className="mt-0.5 block text-xs text-white/60">Add as many as you need</span>
                </span>
                <span className="ml-auto whitespace-nowrap rounded-sm border border-white/20 px-2.5 py-1 text-sm font-semibold text-white">$1.00 each</span>
              </button>
              {selected === "individual" && (
                <div className="flex items-center gap-3 border-t border-[#FF5A09]/35 bg-black/20 px-4 py-3">
                  <span className="text-xs uppercase tracking-wider text-white/65">Number of votes</span>
                  <div className="ml-auto flex items-center gap-2">
                    <button type="button" aria-label="Decrease votes" onClick={() => setVoteCount((count) => Math.max(1, count - 1))} className="flex h-10 w-10 items-center justify-center border border-white/35 bg-white/[0.05] text-lg transition-colors hover:border-[#FF5A09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09]">−</button>
                    <input aria-label="Number of votes" type="number" min={1} value={voteCount} onChange={(event) => setVoteCount(Math.max(1, Number(event.target.value) || 1))} className="h-10 w-20 border border-white/30 bg-[#111] px-2 text-center text-white focus-visible:border-[#FF5A09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50" />
                    <button type="button" aria-label="Increase votes" onClick={() => setVoteCount((count) => count + 1)} className="flex h-10 w-10 items-center justify-center border border-white/35 bg-white/[0.05] text-lg transition-colors hover:border-[#FF5A09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09]">+</button>
                    <span className="ml-2 min-w-16 text-right text-lg font-bold">${voteCount.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <p className="pt-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Or choose a vote package</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {packages.map((item) => {
                const isSelected = selected === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelected(item.id)}
                    className={`group relative min-h-36 rounded-sm border-2 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111] ${
                      isSelected
                        ? "border-[#FF5A09] bg-[#ff5a09]/[0.1] shadow-[inset_0_0_0_1px_rgba(255,90,9,0.38)]"
                        : "border-white/30 bg-[#171918] hover:border-[#ff9a6d] hover:bg-[#211b18]"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <SelectionMark selected={isSelected} />
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm ${
                          isSelected ? "bg-[#FF5A09]/15 text-[#ff9a6d]" : "bg-white/[0.07] text-white/70"
                        }`}>
                          <Package className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-bold uppercase tracking-[0.1em]">{item.name}</span>
                      </span>
                      <span className={`shrink-0 rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        isSelected ? "bg-[#FF5A09] text-white" : "border border-white/25 text-white/70 group-hover:border-[#ff9a6d]/70 group-hover:text-[#ffb28b]"
                      }`}>
                        {isSelected ? "Selected" : "Choose"}
                      </span>
                    </span>
                    <span className="mt-4 flex items-end justify-between gap-2">
                      <span className="text-sm text-white/80">
                        <Heart className="mr-1 inline h-3.5 w-3.5 text-[#ff9a6d]" />
                        {item.votes.toLocaleString()} votes
                        {item.bonus > 0 && <span className="ml-1 font-bold text-[#ff9a6d]">+{item.bonus.toLocaleString()} bonus</span>}
                      </span>
                      <span className="whitespace-nowrap text-lg font-bold text-white">${item.price.toFixed(2)}</span>
                    </span>
                    <span className="mt-2 block text-xs text-white/55">{item.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mb-8 border-t border-white/15 pt-7">
          <StepHeading number="2" title="Your information" hint="Required fields marked *" />
          <div className="space-y-4">
            <label className="block text-xs font-medium uppercase tracking-wider text-white/80">
              Full name <span className="text-[#ff9a6d]">*</span>
              <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 block min-h-11 w-full rounded-sm border border-white/30 bg-[#171918] px-3 py-2 text-sm normal-case tracking-normal text-white transition-colors hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50" />
            </label>
            <label className="block text-xs font-medium uppercase tracking-wider text-white/80">
              Email <span className="text-[#ff9a6d]">*</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 block min-h-11 w-full rounded-sm border border-white/30 bg-[#171918] px-3 py-2 text-sm normal-case tracking-normal text-white transition-colors hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50" />
            </label>
            <div className="mt-5 border-t border-white/15 pt-4">
              <p className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-white/80">
                Billing address
                <span className="rounded-sm border border-white/20 px-2 py-1 text-[10px] text-white/55">Optional</span>
              </p>
              <div className="space-y-3">
                <input aria-label="Billing street address" placeholder="Street address" className="min-h-11 w-full rounded-sm border border-white/30 bg-[#171918] px-3 py-2 text-sm text-white placeholder:text-white/40 hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input aria-label="Billing city" placeholder="City" className="min-h-11 rounded-sm border border-white/30 bg-[#171918] px-3 py-2 text-sm text-white placeholder:text-white/40 hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50" />
                  <input aria-label="Billing state" placeholder="State" className="min-h-11 rounded-sm border border-white/30 bg-[#171918] px-3 py-2 text-sm text-white placeholder:text-white/40 hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50" />
                  <input aria-label="Billing ZIP code" placeholder="ZIP code" className="min-h-11 rounded-sm border border-white/30 bg-[#171918] px-3 py-2 text-sm text-white placeholder:text-white/40 hover:border-white/50 focus-visible:border-[#FF5A09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A09]/50" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-white/15 pt-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold uppercase tracking-wider text-white/75">Order total</span>
            <span className="text-xl font-bold text-white">{total ? `$${total.toFixed(2)}` : "Select a vote option"}</span>
          </div>
          <button type="button" disabled={!selected} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-sm border border-[#FF5A09] bg-[#FF5A09] px-5 font-bold uppercase tracking-wider text-white shadow-[0_6px_18px_rgba(255,90,9,0.18)] transition-all hover:bg-[#ff7434] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111] disabled:cursor-not-allowed disabled:border-white/20 disabled:bg-white/10 disabled:text-white/55 disabled:shadow-none">
            <CheckCircle className="h-5 w-5" />
            {selected ? `Pay $${total.toFixed(2)}` : "Select a vote option"}
          </button>
          {!selected && <p className="mt-2 text-center text-xs text-white/55">Choose a package above to continue.</p>}
        </div>
      </div>
    </main>
  );
}
