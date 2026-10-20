import assert from "node:assert/strict";
import test from "node:test";
import { createOCPostResultService, type OCPostResultRecord, type OCPostResultStore } from "./oc-post-results";
import { hashReferralValue } from "./oc-referral-service";

const referralId = "A".repeat(43);
function setup(ocAccountId: string | null = "oc-1") {
  const saved = new Map<string, OCPostResultRecord>();
  const store: OCPostResultStore = {
    getReferral: async (key) => key === hashReferralValue(referralId)
      ? { uid: "u1", role: "talent", competitionId: 11, contestantId: 1, profileId: 2, createdAt: "", handoffExpiresAt: "", ocAccountId, claimedAt: null, revokedAt: null, revocationReason: null }
      : null,
    save: async (id, v) => { saved.set(id, saved.get(id) ? { ...v, receivedAt: saved.get(id)!.receivedAt } : v); },
    listByUser: async (uid) => [...saved.values()].filter((v) => v.uid === uid),
  };
  let t = 1_000;
  return { saved, service: createOCPostResultService(store, () => (t += 1000)) };
}
const body = (over: object = {}) => ({ referralId, ocAccountId: "oc-1", postId: "p1", results: [{ platform: "instagram", status: "published" as const }], ...over });

test("records idempotently per post", async () => {
    const { saved, service } = setup();
    await service.record(body());
    await service.record(body());
    assert.equal(saved.size, 1);
});
test("rejects other OC accounts and unclaimed referrals", async () => {
    await assert.rejects(setup().service.record(body({ ocAccountId: "oc-2" })), { status: 403 });
    await assert.rejects(setup(null).service.record(body()), { status: 403 });
    await assert.rejects(setup().service.record(body({ referralId: "B".repeat(43) })), { status: 404 });
});
test("summarizes by platform and status", async () => {
    const { service } = setup();
    await service.record(body());
    await service.record(body({ postId: "p2", results: [{ platform: "instagram", status: "failed" }, { platform: "tiktok", status: "published" }] }));
    const s = await service.summary("u1");
    assert.equal(s.postCount, 2);
    assert.deepEqual(s.totals, { published: 2, scheduled: 0, failed: 1 });
    assert.deepEqual(s.byPlatform.instagram, { published: 1, scheduled: 0, failed: 1 });
});

