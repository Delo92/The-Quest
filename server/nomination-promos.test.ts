import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateNominationPromoQuote,
  getNominationPromoCodes,
  normalizeNominationPromoCodes,
  PromoCodeConfigurationError,
} from "./nomination-promos";

test("normalizes and validates multiple promo codes", () => {
  const promos = normalizeNominationPromoCodes([
    { id: "free", code: "  HIFITFREE ", discountType: "free", isActive: true },
    { id: "half", code: "half-off", discountType: "percentage", discountValue: 50, isActive: true },
    { id: "five", code: "FIVE", discountType: "fixed", discountValue: 500, isActive: false },
  ]);

  assert.deepEqual(promos.map((promo) => promo.code), ["HIFITFREE", "HALF-OFF", "FIVE"]);
  assert.equal(promos[0].discountValue, 0);
  assert.equal(promos[1].discountValue, 50);
  assert.equal(promos[2].discountValue, 500);
  assert.equal(promos[2].isActive, false);
});

test("accepts a leading # in nomination promo codes", () => {
  const [promo] = normalizeNominationPromoCodes([
    { id: "hashtag", code: "#1PROMOTEREJ", discountType: "free" },
  ]);
  assert.equal(promo.code, "#1PROMOTEREJ");
  assert.equal(
    calculateNominationPromoQuote(1000, "#1PROMOTEREJ", { nominationPromoCodes: [promo] }).finalAmountCents,
    0,
  );
});

test("rejects duplicate codes and invalid discount values", () => {
  assert.throws(
    () => normalizeNominationPromoCodes([
      { id: "one", code: "SAVE", discountType: "free" },
      { id: "two", code: "save", discountType: "free" },
    ]),
    PromoCodeConfigurationError,
  );
  assert.throws(
    () => normalizeNominationPromoCodes([
      { id: "bad-percent", code: "BADPCT", discountType: "percentage", discountValue: 100.01 },
    ]),
    PromoCodeConfigurationError,
  );
  assert.throws(
    () => normalizeNominationPromoCodes([
      { id: "bad-fixed", code: "BADFIX", discountType: "fixed", discountValue: 1.5 },
    ]),
    PromoCodeConfigurationError,
  );
});

test("quotes free, percentage, and fixed discounts in cents", () => {
  const settings = {
    nominationPromoCodes: normalizeNominationPromoCodes([
      { id: "free", code: "FREE", discountType: "free" },
      { id: "half", code: "HALF", discountType: "percentage", discountValue: 50 },
      { id: "five", code: "FIVE", discountType: "fixed", discountValue: 500 },
    ]),
  };

  assert.deepEqual(calculateNominationPromoQuote(1000, "free", settings), {
    valid: true,
    promoCode: settings.nominationPromoCodes[0],
    originalAmountCents: 1000,
    discountAmountCents: 1000,
    finalAmountCents: 0,
  });
  assert.equal(calculateNominationPromoQuote(1000, "half", settings).finalAmountCents, 500);
  assert.equal(calculateNominationPromoQuote(1000, "five", settings).finalAmountCents, 500);
  assert.equal(calculateNominationPromoQuote(300, "five", settings).discountAmountCents, 300);
  assert.equal(calculateNominationPromoQuote(1000, "unknown", settings).finalAmountCents, 1000);
});

test("uses the old single free code only when a multi-code list is absent", () => {
  const legacy = getNominationPromoCodes({ freeNominationPromoCode: "OLDCODE" });
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].code, "OLDCODE");
  assert.equal(legacy[0].discountType, "free");

  assert.deepEqual(getNominationPromoCodes({
    nominationPromoCodes: [],
    freeNominationPromoCode: "OLDCODE",
  }), []);
});