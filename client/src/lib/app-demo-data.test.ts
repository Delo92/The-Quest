import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoEarnings } from "./app-demo-finances";
import { installDemoApiGuard } from "./app-demo-data";

test("demo earnings split the after-contribution balance into nonoverlapping payout buckets", () => {
  const earnings = buildDemoEarnings(74400, 22320, 22320);
  assert.equal(earnings.estimatedNonprofitCents, 7440);
  assert.equal(earnings.nextPayoutCents, 22320);
  assert.equal(earnings.pendingCents, 22320);
  assert.equal(earnings.paidCents, 22320);
  assert.equal(earnings.grossCents,
    earnings.estimatedNonprofitCents + earnings.nextPayoutCents + earnings.pendingCents + earnings.paidCents);
  assert.throws(() => buildDemoEarnings(74400, 70000, 0));
  assert.throws(() => buildDemoEarnings(74400, 22320, 50000));
  assert.throws(() => buildDemoEarnings(74400, 22320, -1));
});

test("both demo roles receive reconciled earnings and sample recipients without allowing writes", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const browser = { fetch: globalThis.fetch, location: { origin: "https://quest.example" } };
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
  try {
    for (const role of ["talent", "host"] as const) {
      const restore = installDemoApiGuard(role);
      try {
        const overview = await (await browser.fetch("/api/payroll/my-overview")).json();
        const { earnings } = overview;
        assert.ok(earnings.nextPayoutCents > 0);
        assert.ok(earnings.pendingCents > 0);
        assert.ok(earnings.paidCents > 0);
        if (role === "talent") {
          assert.equal(earnings.nextPayoutCents, 22320);
          assert.equal(earnings.pendingCents, 22320);
          assert.equal(earnings.paidCents, 22320);
        }
        assert.equal(earnings.grossCents,
          earnings.estimatedNonprofitCents + earnings.nextPayoutCents + earnings.pendingCents + earnings.paidCents);
        assert.equal(overview.pendingPayouts.filter((p: any) => p.status === "approved")
          .reduce((sum: number, p: any) => sum + p.netCents, 0), earnings.nextPayoutCents);
        assert.equal(overview.pendingPayouts.filter((p: any) => p.status === "pending_approval")
          .reduce((sum: number, p: any) => sum + p.netCents, 0), earnings.pendingCents);
        const profile = await (await browser.fetch("/api/talent-profiles/me")).json();
        assert.equal(profile.nonprofitDeclaration.publicName,
          role === "talent" ? "It Stops Now Foundation" : "Event Pro Group Foundation");
        assert.equal((await browser.fetch("/api/talent-profiles/me", { method: "PATCH" })).status, 403);
      } finally {
        restore();
      }
    }
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
