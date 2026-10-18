import { useState } from "react";
import "./_group.css";
import { CheckCircle, Heart, Package } from "lucide-react";

const packages = [
  { id: "starter", name: "Starter Pack", votes: 500, bonus: 0, price: 10, description: "500 votes to support your favorite" },
  { id: "fan", name: "Fan Pack", votes: 1000, bonus: 300, price: 15, description: "1,000 votes + 300 bonus votes" },
  { id: "super", name: "Super Fan Pack", votes: 2000, bonus: 600, price: 30, description: "2,000 votes + 600 bonus votes" },
];

export function Current() {
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
        <div className="absolute inset-x-0 bottom-0 bg-white/80 px-4 py-4 text-center text-black/70">
          <p className="text-sm">Raphlahoma <span className="mx-2">/</span> Buy Votes</p>
          <h1 className="font-['Bebas_Neue'] text-[30px] tracking-[10px]">CHECKOUT</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl">
        <a href="#" className="mb-7 inline-flex text-sm text-white/40 hover:text-white/80">
          ←&nbsp; Back to competition
        </a>

        <div className="mb-9 flex items-center gap-4 border border-white/10 p-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-[#173c5b] font-['Bebas_Neue'] text-xl text-white">
            WYA
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Voting for</p>
            <h2 className="font-bold uppercase">JUNEOUTSXZDE</h2>
            <p className="text-xs text-white/40">Raphlahoma</p>
          </div>
        </div>

        <section className="mb-10">
          <p className="mb-1 text-sm text-[#5f5f5f]">Step 1</p>
          <h2 className="mb-6 text-lg font-normal uppercase tracking-[6px]">Select package</h2>

          <div
            onClick={() => setSelected("individual")}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setSelected("individual");
            }}
            className={`mb-4 w-full cursor-pointer border p-5 text-left transition-all duration-300 ${
              selected === "individual"
                ? "border-[#FF5A09] bg-[#FF5A09]/10"
                : "border-white/10 hover:border-white/30"
            }`}
          >
            <div className="mb-3 flex items-center gap-3">
              <Heart className={`h-5 w-5 ${selected === "individual" ? "text-[#FF5A09]" : "text-white/40"}`} />
              <span className="text-sm font-bold uppercase tracking-[2px]">Buy individual votes</span>
              <span className="ml-auto text-xs text-white/40">$1.00 each</span>
            </div>
            {selected === "individual" && (
              <div className="mt-2 flex items-center gap-3" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={() => setVoteCount((count) => Math.max(1, count - 1))} className="flex h-8 w-8 items-center justify-center border border-white/20 hover:border-[#FF5A09]">−</button>
                <input aria-label="Number of votes" type="number" min={1} value={voteCount} onChange={(event) => setVoteCount(Math.max(1, Number(event.target.value) || 1))} className="w-20 border border-white/20 bg-white/[0.08] px-2 py-1 text-center text-white" />
                <button type="button" onClick={() => setVoteCount((count) => count + 1)} className="flex h-8 w-8 items-center justify-center border border-white/20 hover:border-[#FF5A09]">+</button>
                <span className="ml-auto text-lg font-bold">${voteCount.toFixed(2)}</span>
              </div>
            )}
          </div>

          <p className="mb-3 text-xs uppercase tracking-[2px] text-white/30">Or choose a package</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {packages.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
                className={`cursor-pointer border p-5 text-left transition-all duration-300 ${
                  selected === item.id
                    ? "border-[#FF5A09] bg-[#FF5A09]/10"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                <div className="mb-2 flex items-center gap-3">
                  <Package className={`h-5 w-5 ${selected === item.id ? "text-[#FF5A09]" : "text-white/40"}`} />
                  <span className="text-sm font-bold uppercase tracking-[2px]">{item.name}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-white/60">
                    <Heart className="mr-1 inline h-3.5 w-3.5 text-[#FF5A09]" />
                    {item.votes.toLocaleString()} votes
                    {item.bonus > 0 && <span className="ml-1 font-bold text-[#FF5A09]">+{item.bonus.toLocaleString()} bonus</span>}
                  </span>
                  <span className="text-lg font-bold">${item.price.toFixed(2)}</span>
                </div>
                <p className="mt-2 text-xs text-white/30">{item.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <p className="mb-1 text-sm text-[#5f5f5f]">Step 2</p>
          <h2 className="mb-6 text-lg font-normal uppercase tracking-[6px]">Your info</h2>
          <div className="space-y-4">
            <label className="block text-xs uppercase tracking-wider text-white/60">
              Full name
              <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 block w-full rounded border border-white/20 bg-white/[0.08] px-3 py-2 text-sm normal-case tracking-normal text-white" />
            </label>
            <label className="block text-xs uppercase tracking-wider text-white/60">
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 block w-full rounded border border-white/20 bg-white/[0.08] px-3 py-2 text-sm normal-case tracking-normal text-white" />
            </label>
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="mb-3 text-xs uppercase tracking-wider text-white/60">Billing address</p>
              <div className="space-y-3">
                <input aria-label="Billing street address" placeholder="Street address" className="block w-full rounded border border-white/20 bg-white/[0.08] px-3 py-2 text-sm text-white" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input aria-label="Billing city" placeholder="City" className="rounded border border-white/20 bg-white/[0.08] px-3 py-2 text-sm text-white" />
                  <input aria-label="Billing state" placeholder="State" className="rounded border border-white/20 bg-white/[0.08] px-3 py-2 text-sm text-white" />
                  <input aria-label="Billing ZIP code" placeholder="ZIP code" className="rounded border border-white/20 bg-white/[0.08] px-3 py-2 text-sm text-white" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="border border-white/10 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm uppercase tracking-wider text-white/60">Order total</span>
            <span className="text-lg font-bold text-orange-400">{total ? `$${total.toFixed(2)}` : "Choose a vote option"}</span>
          </div>
          <button type="button" disabled={!selected} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 border border-[#FF5A09] bg-[#FF5A09] px-5 font-bold uppercase text-white transition-colors hover:bg-transparent hover:text-[#FF5A09] disabled:cursor-not-allowed disabled:opacity-50">
            <CheckCircle className="h-5 w-5" />
            {selected ? `Pay $${total.toFixed(2)}` : "Select a vote option"}
          </button>
        </div>
      </div>
    </main>
  );
}
