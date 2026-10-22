import assert from "node:assert/strict";
import test from "node:test";
import {
  getMicrosoftInboxMessage,
  listMicrosoftInboxMessages,
  replyToMicrosoftInboxMessage,
} from "./microsoft-mailbox";

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
