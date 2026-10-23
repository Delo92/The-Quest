import test from "node:test";
import assert from "node:assert/strict";
import { reservePayment, type PaymentRequest } from "./payment-security";

function fixture() {
  let record: Record<string, any> | undefined;
  let writes = 0;
  const ref = {};
  const firestore = {
    collection: (name: string) => {
      assert.equal(name, "paymentAttempts");
      return { doc: () => ref };
    },
    runTransaction: async (callback: any) => callback({
      get: async () => ({ exists: Boolean(record), data: () => record }),
      set: (_ref: unknown, data: Record<string, unknown>) => {
        // Match Firestore's strict serialization instead of silently dropping
        // undefined values as JSON.stringify would.
        for (const [key, value] of Object.entries(data)) {
          assert.notEqual(value, undefined, `Undefined Firestore field: ${key}`);
        }
        record = { ...record, ...data };
        writes++;
      },
    }),
  };
  return {
    deps: { firestore: firestore as any },
    getRecord: () => record!,
    setStatus: (status: string, extra: object = {}) => {
      record = { ...record, status, ...extra };
    },
    writes: () => writes,
  };
}

const nomination: PaymentRequest = {
  idempotencyKey: "nomination-test-1234567890",
  route: "/api/join/nominate",
  amountCents: 500,
  ownerKey: "anonymous:test",
  packageKey: "nomination:21",
  competitionId: 21,
  contestantId: undefined,
  customerEmail: undefined,
  customerName: undefined,
};

test("paid nomination reservation accepts an absent contestant and customer details", async () => {
  const f = fixture();
  const result = await reservePayment(nomination, f.deps);
  assert.equal(result.state, "reserved");
  assert.equal(f.getRecord().competitionId, 21);
  assert.equal(f.getRecord().contestantId, null);
  assert.equal(f.getRecord().customerEmail, null);
  assert.equal(f.getRecord().customerName, null);
});

test("host and join reservations accept omitted optional fields", async () => {
  for (const route of ["/api/host/submit", "/api/join/submit"]) {
    const f = fixture();
    const { competitionId, contestantId, customerEmail, customerName, ...required } = nomination;
    const result = await reservePayment({ ...required, route }, f.deps);
    assert.equal(result.state, "reserved");
    assert.equal(f.getRecord().competitionId, null);
    assert.equal(f.getRecord().contestantId, null);
  }
});

test("vote reservations retain competition, contestant, and customer values", async () => {
  const f = fixture();
  await reservePayment({
    ...nomination,
    route: "/api/votes/purchase",
    contestantId: 7,
    customerEmail: "buyer@example.invalid",
    customerName: "Test Buyer",
  }, f.deps);
  assert.equal(f.getRecord().competitionId, 21);
  assert.equal(f.getRecord().contestantId, 7);
  assert.equal(f.getRecord().customerEmail, "buyer@example.invalid");
  assert.equal(f.getRecord().customerName, "Test Buyer");
});

test("processing, charged, and completed payments cannot acquire another reservation", async () => {
  for (const status of ["processing", "charged", "completed"] as const) {
    const f = fixture();
    await reservePayment(nomination, f.deps);
    f.setStatus(status, { transactionId: "pi_existing", response: { id: "saved-nomination" } });
    const result = await reservePayment(nomination, f.deps);
    assert.equal(result.state, status);
    assert.equal(f.writes(), 1);
    if (status === "completed") assert.deepEqual(result.response, { id: "saved-nomination" });
  }
});

test("the same key cannot be reused for a different purchase", async () => {
  const f = fixture();
  await reservePayment(nomination, f.deps);
  await assert.rejects(
    reservePayment({ ...nomination, amountCents: 1000 }, f.deps),
    /different payment/,
  );
  assert.equal(f.writes(), 1);
});

test("omitted and null optional identifiers share the same idempotency binding", async () => {
  const f = fixture();
  await reservePayment({ ...nomination, competitionId: undefined }, f.deps);
  const result = await reservePayment({ ...nomination, competitionId: null, contestantId: null }, f.deps);
  assert.equal(result.state, "processing");
  assert.equal(f.writes(), 1);
});
