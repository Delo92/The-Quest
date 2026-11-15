import assert from "node:assert/strict";
import test from "node:test";
import {
  forwardMicrosoftInboxMessage,
  getMicrosoftInboxMessage,
  listMicrosoftInboxMessages,
  readMicrosoftInboxDelta,
  replyToMicrosoftInboxMessage,
} from "./microsoft-mailbox";
import { findMatchingUserIdentity, type ForwardableMessage, type UserIdentity } from "./microsoft-email-forwarding";

const accessToken = async () => "graph-access-token";

test("inbox listing requests only the latest 50 messages without changing read state", async () => {
  let requestedUrl = "";
  let requestHeaders: HeadersInit | undefined;
  const result = await listMicrosoftInboxMessages({
    getAccessToken: accessToken,
    fetch: (async (input, init) => {
      requestedUrl = String(input);
      requestHeaders = init?.headers;
      return new Response(JSON.stringify({
        value: [{
          id: "message-1",
          subject: "A question",
          from: { emailAddress: { name: "Alex", address: "alex@example.com" } },
          receivedDateTime: "2026-10-21T12:00:00Z",
          bodyPreview: "Could you help?",
          webLink: "https://outlook.office.com/mail/id/message-1",
        }],
      }), { status: 200 });
    }) as typeof fetch,
  });

  const url = new URL(requestedUrl);
  assert.equal(url.searchParams.get("$top"), "50");
  assert.match(url.searchParams.get("$select") || "", /bodyPreview/);
  assert.equal(url.searchParams.get("$orderby"), "receivedDateTime desc");
  assert.equal(new Headers(requestHeaders).get("authorization"), "Bearer graph-access-token");
  assert.equal(new Headers(requestHeaders).get("prefer"), 'outlook.body-content-type="text"');
  assert.deepEqual(result.items[0], {
    id: "message-1",
    subject: "A question",
    from: { name: "Alex", emailAddress: "alex@example.com" },
    receivedDateTime: "2026-10-21T12:00:00Z",
    bodyPreview: "Could you help?",
    webLink: "https://outlook.office.com/mail/id/message-1",
  });
});

test("message detail and reply use the selected message ID and plain text comment", async () => {
  const requests: Array<{ url: string; method: string; body: string | null }> = [];
  const fetch = (async (input, init) => {
    requests.push({
      url: String(input),
      method: init?.method || "GET",
      body: typeof init?.body === "string" ? init.body : null,
    });
    if (init?.method === "POST") return new Response(null, { status: 202 });
    return new Response(JSON.stringify({
      id: "message/with/slash",
      subject: "Follow up",
      from: { emailAddress: { name: "Alex", address: "alex@example.com" } },
      toRecipients: [{ emailAddress: { name: "Mailbox", address: "info@cbpublishing.live" } }],
      receivedDateTime: "2026-10-21T12:00:00Z",
      body: { contentType: "text", content: "Original message" },
      webLink: null,
    }), { status: 200 });
  }) as typeof globalThis.fetch;
  const dependencies = { getAccessToken: accessToken, fetch };

  const message = await getMicrosoftInboxMessage("message/with/slash", dependencies);
  assert.equal(message.body, "Original message");
  assert.equal(message.from.emailAddress, "alex@example.com");
  await replyToMicrosoftInboxMessage("message/with/slash", "  Thanks for reaching out.  ", dependencies);

  assert.match(requests[0].url, /mailFolders\/inbox\/messages\/message%2Fwith%2Fslash/);
  assert.equal(requests[0].method, "GET");
  assert.match(requests[1].url, /mailFolders\/inbox\/messages\/message%2Fwith%2Fslash\/reply/);
  assert.equal(requests[1].method, "POST");
  assert.deepEqual(JSON.parse(requests[1].body || "{}"), { comment: "Thanks for reaching out." });
});

test("blank replies are rejected before calling Microsoft", async () => {
  let requested = false;
  await assert.rejects(
    replyToMicrosoftInboxMessage("message-1", "  ", {
      getAccessToken: accessToken,
      fetch: (async () => {
        requested = true;
        return new Response(null, { status: 202 });
      }) as typeof fetch,
    }),
    /Enter a reply/,
  );
  assert.equal(requested, false);
});

test("inbox delta follows Microsoft paging and keeps the final cursor", async () => {
  const requests: string[] = [];
  const result = await readMicrosoftInboxDelta(undefined, {
    getAccessToken: accessToken,
    fetch: (async (input) => {
      const url = String(input);
      requests.push(url);
      if (url.includes("/delta?")) {
        return new Response(JSON.stringify({
          value: [{ id: "message-1" }],
          "@odata.nextLink": "https://graph.microsoft.com/v1.0/next-page",
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        value: [{ id: "message-2" }, { id: "deleted", "@removed": { reason: "deleted" } }],
        "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta-token",
      }), { status: 200 });
    }) as typeof fetch,
  });

  assert.equal(requests.length, 2);
  assert.deepEqual(result.messages.map((message) => message.id), ["message-1", "message-2"]);
  assert.equal(result.deltaLink, "https://graph.microsoft.com/v1.0/delta-token");
});

test("forward uses the connected mailbox and sends to the requested recipients", async () => {
  let request: { url: string; method: string; body: string | null } | null = null;
  await forwardMicrosoftInboxMessage("message/with/slash", ["nbadelo@gmail.com", "jobs@hivestaffing.com"], {
    getAccessToken: accessToken,
    fetch: (async (input, init) => {
      request = {
        url: String(input),
        method: init?.method || "GET",
        body: typeof init?.body === "string" ? init.body : null,
      };
      return new Response(null, { status: 202 });
    }) as typeof fetch,
  });

  assert.ok(request);
  assert.match(request.url, /\/me\/messages\/message%2Fwith%2Fslash\/forward$/);
  assert.equal(request.method, "POST");
  assert.deepEqual(JSON.parse(request.body || "{}"), {
    toRecipients: [
      { emailAddress: { address: "nbadelo@gmail.com" } },
      { emailAddress: { address: "jobs@hivestaffing.com" } },
    ],
  });
});

test("forward rejects invalid destinations before contacting Microsoft", async () => {
  let requested = false;
  await assert.rejects(
    forwardMicrosoftInboxMessage("message-1", ["not-an-email"], {
      getAccessToken: accessToken,
      fetch: (async () => {
        requested = true;
        return new Response(null, { status: 202 });
      }) as typeof fetch,
    }),
    /valid forwarding address/,
  );
  assert.equal(requested, false);
});

test("email triage matches known email, name, phone, and explicit profile ID", () => {
  const identity: UserIdentity = {
    names: ["Alex Rivera"],
    emails: ["alex@example.com"],
    phones: ["(555) 123-4567"],
    profileIds: [41],
    contestantIds: [12],
  };
  const makeMessage = (body: string, sender = "someone@example.net"): ForwardableMessage => ({
    id: "message-1",
    subject: "Question",
    body,
    sender,
  });

  assert.ok(findMatchingUserIdentity(makeMessage("Can Alex Rivera help?"), [identity]));
  assert.ok(findMatchingUserIdentity(makeMessage("Please call (555) 123-4567"), [identity]));
  assert.ok(findMatchingUserIdentity(makeMessage("What is profile ID 41?"), [identity]));
  assert.ok(findMatchingUserIdentity(makeMessage("Following up", "alex@example.com"), [identity]));
  assert.equal(findMatchingUserIdentity(makeMessage("Can you help me?"), [identity]), null);
});
