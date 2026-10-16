import test from "node:test";
import assert from "node:assert/strict";
import { getTemporaryAccountPassword, nomineeAccountLevel, renderAccountEmailAccess } from "./account-email-access";

test("new-account emails include the temporary credential without placing it in links", () => {
  const html = renderAccountEmailAccess({
    email: "nominee@example.com", accountCreated: true,
    temporaryPassword: "Sample<&Only", resetUrl: "https://quest.example/thequest/login?mode=reset&email=nominee%40example.com",
  });
  assert.match(html, /Temporary Password/);
  assert.match(html, /Sample&lt;&amp;Only/);
  assert.match(html, /nominee@example.com/);
  assert.match(html, /Set or reset my password/);
  assert.doesNotMatch(html, /href="[^"]*Sample/);
});

test("existing-account emails never claim the default is the user's current password", () => {
  const html = renderAccountEmailAccess({
    email: "existing@example.com", accountCreated: false,
    temporaryPassword: "MustNotBeShared", resetUrl: "https://quest.example/reset",
  });
  assert.match(html, /account already exists/);
  assert.match(html, /Use your current password/);
  assert.match(html, /Set or reset my password/);
  assert.doesNotMatch(html, /MustNotBeShared|Temporary Password/);
});

test("new-account and admin-reset workflows use the same existing temporary-password convention", () => {
  const temporaryPassword = getTemporaryAccountPassword();
  assert.ok(temporaryPassword.length >= 6);
  const html = renderAccountEmailAccess({
    email: "user@example.com", accountCreated: true, temporaryPassword,
    resetUrl: "https://quest.example/reset",
  });
  assert.ok(html.includes(temporaryPassword));
});

test("nominees have artist access while existing host and admin roles are preserved", () => {
  assert.equal(nomineeAccountLevel(undefined), 2);
  assert.equal(nomineeAccountLevel(1), 2);
  assert.equal(nomineeAccountLevel(2), 2);
  assert.equal(nomineeAccountLevel(3), 3);
  assert.equal(nomineeAccountLevel(4), 4);
});
