import { getMicrosoftGraphAccessToken, MicrosoftMailboxPermissionError } from "./microsoft-email-oauth";

const GRAPH_API = "https://graph.microsoft.com/v1.0";

type GraphAddress = {
  emailAddress?: {
    name?: string;
    address?: string;
  };
};

type GraphMessage = {
  id?: string;
  subject?: string;
  from?: GraphAddress;
  toRecipients?: GraphAddress[];
  receivedDateTime?: string;
  bodyPreview?: string;
  body?: { content?: string; contentType?: string };
  webLink?: string;
};

type MicrosoftMailboxDependencies = Partial<{
  getAccessToken: typeof getMicrosoftGraphAccessToken;
  fetch: typeof fetch;
}>;

function asContact(value?: GraphAddress) {
  return {
    name: value?.emailAddress?.name || "",
    emailAddress: value?.emailAddress?.address || "",
  };
}

function asMessageSummary(message: GraphMessage) {
  return {
    id: message.id || "",
    subject: message.subject || "(No subject)",
    from: asContact(message.from),
    receivedDateTime: message.receivedDateTime || "",
    bodyPreview: message.bodyPreview || "",
    webLink: message.webLink || null,
  };
}

async function graphRequest(
  path: string,
  init: RequestInit = {},
  dependencies: MicrosoftMailboxDependencies = {},
): Promise<any> {
  const token = await (dependencies.getAccessToken ?? getMicrosoftGraphAccessToken)();
  const fetcher = dependencies.fetch ?? fetch;
  const response = await fetcher(`${GRAPH_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: 'outlook.body-content-type="text"',
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as {
      error?: { code?: string };
    } | null;
    const code = body?.error?.code || "";
    if (response.status === 401 || response.status === 403 || code === "ErrorAccessDenied") {
      throw new MicrosoftMailboxPermissionError();
    }
    const error = new Error(`Microsoft Graph request failed (${response.status}).`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return response.status === 202 || response.status === 204 ? null : response.json();
}

export async function listMicrosoftInboxMessages(dependencies: MicrosoftMailboxDependencies = {}) {
  const query = new URLSearchParams({
    "$select": "id,subject,from,receivedDateTime,bodyPreview,webLink",
    "$orderby": "receivedDateTime desc",
    "$top": "50",
  });
  const result = await graphRequest(`/me/mailFolders/inbox/messages?${query.toString()}`, {}, dependencies) as {
    value?: GraphMessage[];
  };
  return {
    items: (Array.isArray(result.value) ? result.value : []).map(asMessageSummary),
  };
}

export async function getMicrosoftInboxMessage(
  messageId: string,
  dependencies: MicrosoftMailboxDependencies = {},
) {
  if (!messageId || messageId.length > 2048) {
    throw new Error("Invalid Microsoft message ID.");
  }
  const query = new URLSearchParams({
    "$select": "id,subject,from,toRecipients,receivedDateTime,body,webLink",
  });
  const message = await graphRequest(
    `/me/mailFolders/inbox/messages/${encodeURIComponent(messageId)}?${query.toString()}`,
    {},
    dependencies,
  ) as GraphMessage;
  return {
    id: message.id || messageId,
    subject: message.subject || "(No subject)",
    from: asContact(message.from),
    toRecipients: (Array.isArray(message.toRecipients) ? message.toRecipients : []).map(asContact),
    receivedDateTime: message.receivedDateTime || "",
    body: message.body?.content || "",
    webLink: message.webLink || null,
  };
}

export async function replyToMicrosoftInboxMessage(
  messageId: string,
  comment: string,
  dependencies: MicrosoftMailboxDependencies = {},
) {
  if (!messageId || messageId.length > 2048) {
    throw new Error("Invalid Microsoft message ID.");
  }
  const normalizedComment = comment.trim();
  if (!normalizedComment || normalizedComment.length > 20_000) {
    throw new Error("Enter a reply of no more than 20,000 characters.");
  }
  await graphRequest(`/me/mailFolders/inbox/messages/${encodeURIComponent(messageId)}/reply`, {
    method: "POST",
    body: JSON.stringify({ comment: normalizedComment }),
  }, dependencies);
  return { success: true as const };
}
