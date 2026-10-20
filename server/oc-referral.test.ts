import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import {
  createOCReferralService, hashReferralValue, OCReferralError, sameOCReferralEvent,
  type OCReferralStore, type OCReferralRecord, type OCReferralClaim,
} from "./oc-referral-service";
import { registerOCReferralRoutes } from "./oc-referral-routes";
import type { OCBenefitEntry, OCBenefitEvent } from "../shared/oc-event-benefit";

function fixture(role: "artist" | "host" = "artist") {
  let clock = Date.parse("2026-10-20T12:00:00Z");
  let user: { level: number; email: string; displayName: string } | null = {
    level: role === "host" ? 3 : 2, email: "quest@example.com", displayName: "Saved Account Name",
  };
  const profile = { id: 40, displayName: "Saved Profile", stageName: "Saved Stage", socialLinks: '{"instagram":"https://instagram.com/example"}' };
  const events = new Map<number, OCBenefitEvent>([1, 2].map((id) => [id, {
    id, title: `Event ${id}`, category: "Music", status: "active",
    startDate: "2026-10-01", endDate: "2026-12-21", createdBy: "quest-user",
  }]));
  const entries = new Map<number, OCBenefitEntry>([1, 2].map((competitionId) => [competitionId, {
    id: competitionId + 20, competitionId, talentProfileId: 40, applicationStatus: "approved",
  }]));
  const records = new Map<string, OCReferralRecord>();
  let claim: OCReferralClaim | null = null;
  const copy = <T>(value: T): T => structuredClone(value);
  const store: OCReferralStore = {
    async create(key, value) { records.set(key, copy(value)); },
    async get(key) { return copy(records.get(key) ?? null); },
    async getClaim() { return copy(claim); },
    async activate(key, value, ocAccountId, at) {
      const current = records.get(key)!;
      if (current.revokedAt || claim?.revokedAt) throw new OCReferralError(409, "benefit_revoked", "Revoked");
      if ((current.ocAccountId && current.ocAccountId !== ocAccountId)
        || (claim && (!sameOCReferralEvent(claim, value) || claim.ocAccountId !== ocAccountId))) {
        throw new OCReferralError(409, "offer_already_assigned", "Assigned");
      }
      current.ocAccountId = ocAccountId;
      current.claimedAt ||= at;
      claim ||= {
        competitionId: value.competitionId, role: value.role, contestantId: value.contestantId,
        profileId: value.profileId, ocAccountId, revokedAt: null, revocationReason: null,
      };
    },
    async revoke(key, value, reason, at) {
      const current = records.get(key)!;
      if (!current.revokedAt) { current.revokedAt = at; current.revocationReason = reason; }
      if (reason !== "handoff_expired" && claim
        && sameOCReferralEvent(claim, value) && !claim.revokedAt) {
        claim.revokedAt = at; claim.revocationReason = reason;
      }
    },
  };
  const service = createOCReferralService({
    store, now: () => clock, getUser: async () => user, getProfile: async () => profile,
    getEvent: async (id) => events.get(id) ?? null,
    getHostedEvents: async (uid) => [...events.values()].filter((event) => event.createdBy === uid),
    getEntries: async () => [...entries.values()], getEntry: async (id) => entries.get(id) ?? null,
  });
  const start = async (id = 1) => {
    const result = await service.start("quest-user", id);
    return { ...result, referralId: new URL(result.referralUrl).searchParams.get("questReferralId")! };
  };
  const verify = (id: string, account = "oc-account", email = "quest@example.com") => service.verify(id, account, email);
  return { service, start, verify, events, entries, records, store, setClock: (at: string) => { clock = Date.parse(at); }, removeUser: () => { user = null; }, changeLevel: (level: number) => { user!.level = level; } };
}

test("referral carries a specific event, entry, saved identity, and opaque server reference", async () => {
  const f = fixture();
  const { referralUrl, referralId } = await f.start();
  const url = new URL(referralUrl);
  assert.equal(url.origin + url.pathname, "https://oraginalconcepts.com/s/TheQuest/referral");
  assert.equal(url.searchParams.get("promoCode"), "THE QUEST");
  assert.equal(url.searchParams.get("email"), "quest@example.com");
  assert.equal(url.searchParams.get("brandName"), "Saved Stage");
  assert.equal(JSON.parse(url.searchParams.get("questEvent")!).competitionId, 1);
  assert.equal(JSON.parse(url.searchParams.get("questEvent")!).contestantId, 21);
  assert.match(referralId, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(f.records.has(referralId), false);
  assert.equal(f.records.has(hashReferralValue(referralId)), true);
});

test("host referrals use verified ownership, not the displayed artist or video selection", async () => {
  const f = fixture("host");
  assert.equal((await f.service.listEvents("quest-user")).events.length, 2);
  const { referralId, event } = await f.start(2);
  assert.equal(event.competitionId, 2);
  assert.equal(event.contestantId, null);
  assert.equal((await f.verify(referralId)).role, "host");
  f.events.get(1)!.createdBy = "someone-else";
  await assert.rejects(() => f.start(1), (error: any) => error.code === "host_removed");
});

test("only approved original event entries qualify", async () => {
  const f = fixture();
  f.entries.get(1)!.applicationStatus = "pending";
  assert.equal((await f.service.listEvents("quest-user")).events[0].eligible, false);
  await assert.rejects(() => f.start(1), (error: any) => error.code === "entry_not_approved");
  f.entries.delete(1);
  await assert.rejects(() => f.start(1), (error: any) => error.code === "entry_removed");
  await assert.rejects(() => f.start(999), (error: any) => error.code === "event_removed");
});

test("OC must verify the client's email and bind one account before granting the feature", async () => {
  const f = fixture();
  const { referralId } = await f.start();
  await assert.rejects(() => f.verify(referralId, "oc-account", "other@example.com"), (error: any) => error.code === "email_mismatch");
  const result = await f.verify(referralId, "oc-account", " QUEST@example.com ");
  assert.equal(result.eligible, true);
  assert.equal(result.questUserId, "quest-user");
  assert.equal(result.ocAccountId, "oc-account");
  assert.equal(result.event?.competitionId, 1);
  assert.equal(result.offer.feature, "social_media_automation");
  assert.equal(result.offer.planMonthlyPriceCents, 10500);
  assert.equal(result.expiresAt, "2026-12-21T23:59:59.999Z");
  await assert.rejects(() => f.verify(referralId, "different-oc-account"), (error: any) => error.code === "account_mismatch");
  assert.equal((await f.verify(referralId)).eligible, true);
});

test("the one-time benefit cannot be switched to another event using a second signup link", async () => {
  const f = fixture();
  const one = await f.start(1);
  const two = await f.start(2);
  await f.verify(one.referralId);
  await assert.rejects(() => f.verify(two.referralId), (error: any) => error.code === "offer_already_assigned");
  await assert.rejects(() => f.start(2), (error: any) => error.code === "offer_already_assigned");
  const list = await f.service.listEvents("quest-user");
  assert.equal(list.claimedCompetitionId, 1);
  assert.equal(list.events.find((event) => event.competitionId === 2)?.eligible, false);
});

const cutoffCases: Array<[string, string, (f: ReturnType<typeof fixture>) => void, ("artist" | "host")?]> = [
  ["completion", "event_ended", (f) => { f.events.get(1)!.status = "completed"; }],
  ["cancellation", "event_cancelled", (f) => { f.events.get(1)!.status = "cancelled"; }],
  ["event deletion", "event_removed", (f) => { f.events.delete(1); }],
  ["scheduled end", "event_ended", (f) => { f.setClock("2026-12-22T00:00:00Z"); }],
  ["withdrawal/removal", "entry_removed", (f) => { f.entries.delete(1); }],
  ["entry rejection", "entry_not_approved", (f) => { f.entries.get(1)!.applicationStatus = "rejected"; }],
  ["elimination", "contestant_eliminated", (f) => { f.entries.get(1)!.stageResults = { semifinal: "eliminated" }; }],
  ["replacement entry", "entry_replaced", (f) => { f.entries.get(1)!.id = 500; }],
  ["host removal", "host_removed", (f) => { f.events.get(1)!.createdBy = "another-host"; }, "host"],
  ["account removal", "account_removed", (f) => f.removeUser()],
  ["role change", "role_changed", (f) => f.changeLevel(1)],
];
for (const [label, reason, change, role] of cutoffCases) {
  test(`live verification ends the benefit after ${label}`, async () => {
    const f = fixture(role);
    const { referralId } = await f.start();
    await f.verify(referralId);
    change(f);
    const result = await f.verify(referralId);
    assert.equal(result.eligible, false);
    assert.equal(result.reason, reason);
    assert.ok(result.revokedAt);
    assert.equal(result.expiresAt, null);
    assert.equal(f.records.get(hashReferralValue(referralId))!.revocationReason, reason);
  });
}

test("a revoked benefit does not silently restart after the event or entry is restored", async () => {
  const f = fixture();
  const { referralId } = await f.start();
  await f.verify(referralId);
  f.entries.get(1)!.stageResults = { round1: "eliminated" };
  await f.verify(referralId);
  f.entries.get(1)!.stageResults = { round1: "active" };
  assert.equal((await f.verify(referralId)).eligible, false);
  await assert.rejects(() => f.start(1), (error: any) => error.code === "offer_already_assigned");
});

test("changed event dates are re-read; unknown and TBD end dates never grant open-ended access", async () => {
  const f = fixture();
  const { referralId } = await f.start();
  await f.verify(referralId);
  f.events.get(1)!.endDate = "2026-11-01T15:00:00Z";
  assert.equal((await f.verify(referralId)).expiresAt, "2026-11-01T15:00:00.000Z");
  f.events.get(1)!.endDateTbd = true;
  assert.equal((await f.verify(referralId)).reason, "event_end_unconfirmed");
  for (const endDate of [null, "invalid", "2026-02-31"]) {
    const fresh = fixture();
    fresh.events.get(1)!.endDate = endDate;
    await assert.rejects(() => fresh.start(), (error: any) => error.code === "event_end_unconfirmed");
  }
});

test("expired unclaimed links cannot activate, and do not revoke an already active same-event claim", async () => {
  const f = fixture();
  const first = await f.start();
  const unused = await f.start();
  await f.verify(first.referralId);
  f.setClock("2026-10-22T12:00:00Z");
  assert.equal((await f.verify(unused.referralId)).reason, "handoff_expired");
  assert.equal((await f.verify(first.referralId)).eligible, true);
});

test("an ended event observed through a fresh same-event link also revokes the original claim", async () => {
  const f = fixture();
  const first = await f.start();
  await f.verify(first.referralId);
  const second = await f.start();
  f.entries.get(1)!.stageResults = { round1: "eliminated" };
  assert.equal((await f.verify(second.referralId)).eligible, false);
  f.entries.get(1)!.stageResults = {};
  assert.equal((await f.verify(first.referralId)).eligible, false);
});

test("competing event claims cannot both activate the one-time offer", async () => {
  const f = fixture();
  const one = await f.start(1);
  const two = await f.start(2);
  const results = await Promise.allSettled([f.verify(one.referralId), f.verify(two.referralId)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
});

test("HTTP routes enforce separate user/service auth, strict inputs, and no-store eligibility responses", async (t) => {
  const f = fixture();
  const app = express();
  app.use(express.json());
  registerOCReferralRoutes(app, {
    service: f.service,
    userAuth: (req, res, next) => {
      if (req.headers.authorization !== "Bearer test-user") return void res.sendStatus(401);
      req.firebaseUser = { uid: "quest-user", email: "quest@example.com", level: 2 };
      next();
    },
    integrationConfigured: () => true,
    integrationAuthorized: (value) => value === "Bearer test-service",
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const post = (path: string, body: unknown, auth?: string) => fetch(base + path, {
    method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify(body),
  });
  assert.equal((await fetch(base + "/oc/referral/events")).status, 401);
  assert.equal((await post("/oc/referral/start", { competitionId: 1 })).status, 401);
  assert.equal((await post("/oc/referral/start", { competitionId: 1, uid: "another-user" }, "test-user")).status, 400);
  const startResponse = await post("/oc/referral/start", { competitionId: 1 }, "test-user");
  assert.equal(startResponse.status, 200);
  const referralId = new URL((await startResponse.json()).referralUrl).searchParams.get("questReferralId");
  const input = { referralId, ocAccountId: "oc-account", verifiedEmail: "quest@example.com" };
  assert.equal((await post("/integrations/oc/referral/eligibility", input)).status, 401);
  assert.equal((await post("/integrations/oc/referral/eligibility", input, "test-user")).status, 401);
  assert.equal((await post("/integrations/oc/referral/eligibility", { ...input, referralId: "bad" }, "test-service")).status, 400);
  const response = await post("/integrations/oc/referral/eligibility", input, "test-service");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).eligible, true);
  f.events.get(1)!.status = "cancelled";
  assert.equal((await (await post("/integrations/oc/referral/eligibility", input, "test-service")).json()).eligible, false);
});

test("unavailable verification fails closed rather than granting an entitlement", async (t) => {
  const f = fixture();
  const app = express();
  app.use(express.json());
  registerOCReferralRoutes(app, {
    service: { ...f.service, verify: async () => { throw new Error("Database unavailable"); } },
    integrationConfigured: () => true, integrationAuthorized: () => true,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const response = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/api/integrations/oc/referral/eligibility`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ referralId: "a".repeat(43), ocAccountId: "oc-account", verifiedEmail: "quest@example.com" }),
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, "eligibility_unavailable");
  assert.notEqual(body.eligible, true);
});
