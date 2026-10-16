import test from "node:test";
import assert from "node:assert/strict";
import { buildAccountAccessMessage, getTemporaryAccountPassword, nomineeAccountLevel, renderAccountEmailAccess } from "./account-email-access";
import nodemailer from "nodemailer";

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

test("account access emails preserve the visual credential layout alongside equivalent plain text", () => {
  const message = buildAccountAccessMessage({
    to: "artist@example.com", name: "Sample <Artist>", level: 2,
    siteUrl: "quest.example", temporaryPassword: "Example<&Only", resend: true,
  });
  assert.match(message.text, /Hi Sample <Artist>,/);
  assert.match(message.html, /Sample &lt;Artist&gt;/);
  assert.match(message.text, /Temporary password: Example<&Only/);
  assert.match(message.html, /Temporary password: Example&lt;&amp;Only/);
  for (const body of [message.text, message.html]) {
    assert.match(body, /your password has not been reset again/);
    assert.match(body, /Artist \/ Competitor/);
    assert.match(body, /already changed this temporary password/);
    assert.match(body, /Forgot your password/);
    assert.doesNotMatch(body, /tracking/i);
  }
  assert.match(message.html, /class="credentials-box"/);
  assert.match(message.html, /class="btn"/);
  assert.doesNotMatch(message.text, /<[^>]+class=/);
  const links = [...message.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll("&amp;", "&"));
  assert.equal(links.length, 1);
  const login = new URL(links[0]);
  assert.equal(login.pathname, "/thequest/login");
  assert.equal(login.searchParams.get("email"), "artist@example.com");
  assert.equal(login.searchParams.has("password"), false);
});

test("existing-password access messages never invent a credential or claim another reset", () => {
  const message = buildAccountAccessMessage({
    to: "host@example.com", name: "Sample Host", level: 3, siteUrl: "https://quest.example",
  });
  assert.match(message.text, /Host \/ Admin/);
  assert.match(message.text, /use your current password/);
  assert.doesNotMatch(message.text, /Temporary password:|has been reset|reset again/);
});

test("the outgoing account email is multipart with text and HTML alternatives", async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const { buildAccountAccessEmailMessage } = await import("./email");
  const message = buildAccountAccessEmailMessage({
    to: "artist@example.com", name: "Sample Artist", level: 2,
    siteUrl: "https://quest.example", temporaryPassword: "SampleOnly123",
  });
  const result = await transport.sendMail({ from: "sender@example.com", to: "artist@example.com", ...message });
  const mime = result.message.toString();
  assert.match(mime, /Content-Type: multipart\/alternative/i);
  assert.match(mime, /Content-Type: text\/plain/i);
  assert.match(mime, /Content-Type: text\/html/i);
  assert.ok(mime.indexOf("Content-Type: text/plain") < mime.indexOf("Content-Type: text/html"));
  assert.match(message.html, /<h1>THE QUEST<\/h1>/);
  assert.match(message.html, /class="tagline">CB Publishing/);
  assert.match(message.html, /class="credentials-box"/);
  assert.match(message.html, /class="btn"/);
  assert.match(message.html, /<style>/);
  assert.match(message.html, /max-width: 600px/);
  assert.doesNotMatch(message.text, /<style>|class="header"/);
  transport.close();
});
