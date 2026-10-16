import test from "node:test";
import assert from "node:assert/strict";
import { buildAccountLoginUrl, readLoginEmail } from "./account-login-links";

test("nominee email links open the Quest login with the matching email and artist level", () => {
  const url = new URL(buildAccountLoginUrl("https://quest.example/thequest/", " Nominee+Music@Example.com "));
  assert.equal(url.pathname, "/thequest/login");
  assert.equal(url.searchParams.get("email"), "nominee+music@example.com");
  assert.equal(url.searchParams.get("level"), "2");
  assert.equal(readLoginEmail(url.searchParams), "nominee+music@example.com");
  assert.equal(url.searchParams.has("password"), false);
});

test("invitation and reset links preserve the invite and correct account level", () => {
  const url = new URL(buildAccountLoginUrl("https://quest.example", "host@example.com", {
    level: 3, inviteToken: "example/token+test&", reset: true,
  }));
  assert.equal(url.pathname, "/thequest/login");
  assert.equal(url.searchParams.get("invite"), "example/token+test&");
  assert.equal(url.searchParams.get("level"), "3");
  assert.equal(url.searchParams.get("mode"), "reset");
});

test("login email prefilling rejects missing and malformed values", () => {
  for (const email of ["", "not an email", "bad@example.com\ninjected", `${"x".repeat(250)}@example.com`]) {
    assert.equal(readLoginEmail(new URLSearchParams({ email })), "");
  }
});
