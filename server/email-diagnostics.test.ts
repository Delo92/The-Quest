import assert from "node:assert/strict";
import test from "node:test";
import { getSafeEmailErrorDetails } from "./email-diagnostics";

test("email diagnostics retain SMTP fields while redacting recipient and credential data", () => {
  const error = Object.assign(
    new Error("Connection closed for artist@example.com?token=private-value"),
    {
      code: "ECONNECTION",
      command: "CONN",
      responseCode: 421,
    },
  );

  const details = getSafeEmailErrorDetails(error);

  assert.equal(details.code, "ECONNECTION");
  assert.equal(details.command, "CONN");
  assert.equal(details.responseCode, 421);
  assert.doesNotMatch(details.message, /artist@example\.com|private-value/);
  assert.match(details.message, /\[EMAIL\]/);
  assert.match(details.message, /\[REDACTED\]/);
  assert.doesNotMatch(details.stackTrace || "", /artist@example\.com|private-value/);
  assert.match(details.stackTrace || "", /\[EMAIL\]/);
});

test("email diagnostics support non-Error rejection values without inventing a stack", () => {
  const details = getSafeEmailErrorDetails("SMTP unavailable");

  assert.equal(details.message, "SMTP unavailable");
  assert.equal(details.stackTrace, undefined);
  assert.equal(details.name, "Error");
});
