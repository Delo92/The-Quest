import { google } from "googleapis";

type IndexField = {
  fieldPath: string;
  order?: "ASCENDING" | "DESCENDING";
};

type DesiredIndex = {
  collectionGroup: string;
  fields: IndexField[];
  label: string;
};

type FirestoreIndex = {
  name?: string;
  state?: string;
  queryScope?: string;
  fields?: IndexField[];
};

const PROJECT_ID = "thequest-2dc77";
const DATABASE_ID = "(default)";
const API_ROOT = "https://firestore.googleapis.com/v1";

/*
 * Keep this manifest aligned with compound Firestore queries in:
 * - server/firestore-collections.ts
 *
 * Single-field equality queries are covered by Firestore's automatic indexes.
 * These definitions are limited to stage schedules, stage vote tracking,
 * leaderboard sorting, and the current admin vote reporting paths.
 */
const DESIRED_INDEXES: DesiredIndex[] = [
  {
    collectionGroup: "competitions",
    fields: [
      { fieldPath: "category", order: "ASCENDING" },
      { fieldPath: "status", order: "ASCENDING" },
    ],
    label: "competitions by category and status",
  },
  {
    collectionGroup: "contestants",
    fields: [
      { fieldPath: "competitionId", order: "ASCENDING" },
      { fieldPath: "talentProfileId", order: "ASCENDING" },
    ],
    label: "contestant by competition and talent profile",
  },
  {
    collectionGroup: "votes",
    fields: [
      { fieldPath: "contestantId", order: "ASCENDING" },
      { fieldPath: "competitionId", order: "ASCENDING" },
    ],
    label: "votes by contestant and competition",
  },
  {
    collectionGroup: "votes",
    fields: [
      { fieldPath: "competitionId", order: "ASCENDING" },
      { fieldPath: "voterIp", order: "ASCENDING" },
      { fieldPath: "votedAt", order: "ASCENDING" },
    ],
    label: "daily vote limits by competition, IP, and time",
  },
  {
    collectionGroup: "votes",
    fields: [
      { fieldPath: "competitionId", order: "ASCENDING" },
      { fieldPath: "stageId", order: "ASCENDING" },
      { fieldPath: "voterIp", order: "ASCENDING" },
      { fieldPath: "votedAt", order: "ASCENDING" },
    ],
    label: "stage daily vote limits by competition, stage, IP, and time",
  },
  {
    collectionGroup: "votes",
    fields: [
      { fieldPath: "competitionId", order: "ASCENDING" },
      { fieldPath: "stageId", order: "ASCENDING" },
      { fieldPath: "contestantId", order: "ASCENDING" },
      { fieldPath: "votedAt", order: "DESCENDING" },
    ],
    label: "stage vote history by contestant and time",
  },
  {
    collectionGroup: "voteCounts",
    fields: [
      { fieldPath: "competitionId", order: "ASCENDING" },
      { fieldPath: "stageId", order: "ASCENDING" },
      { fieldPath: "count", order: "DESCENDING" },
    ],
    label: "stage leaderboard by total votes",
  },
  {
    collectionGroup: "voteCounts",
    fields: [
      { fieldPath: "competitionId", order: "ASCENDING" },
      { fieldPath: "stageId", order: "ASCENDING" },
      { fieldPath: "freeCount", order: "DESCENDING" },
    ],
    label: "stage leaderboard by free votes",
  },
  {
    collectionGroup: "voteCounts",
    fields: [
      { fieldPath: "competitionId", order: "ASCENDING" },
      { fieldPath: "stageId", order: "ASCENDING" },
      { fieldPath: "paidCount", order: "DESCENDING" },
    ],
    label: "stage leaderboard by paid votes",
  },
];

function indexKey(index: Pick<FirestoreIndex, "queryScope" | "fields">): string {
  return [
    index.queryScope || "COLLECTION",
    ...(index.fields || [])
      .filter((field) => field.fieldPath !== "__name__")
      .map((field) => `${field.fieldPath}:${field.order || "ASCENDING"}`),
  ].join("|");
}

function indexCollectionPath(collectionGroup: string): string {
  return `${API_ROOT}/projects/${PROJECT_ID}/databases/${DATABASE_ID}/collectionGroups/${encodeURIComponent(collectionGroup)}/indexes`;
}

async function getAccessToken(): Promise<string> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not configured");
  const credentials = JSON.parse(raw);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const result = await auth.getAccessToken();
  const token = typeof result === "string" ? result : result.token;
  if (!token) throw new Error("Could not obtain a Firebase access token");
  return token;
}

async function requestJson<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${body.error?.message || text}`);
  }
  return body as T;
}

async function listIndexes(token: string, collectionGroup: string): Promise<FirestoreIndex[]> {
  const indexes: FirestoreIndex[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams();
    if (pageToken) params.set("pageToken", pageToken);
    const page = await requestJson<{ indexes?: FirestoreIndex[]; nextPageToken?: string }>(
      token,
      `${indexCollectionPath(collectionGroup)}?${params.toString()}`,
    );
    indexes.push(...(page.indexes || []));
    pageToken = page.nextPageToken || "";
  } while (pageToken);
  const collectionGroupMarker = `/collectionGroups/${collectionGroup}/indexes/`;
  return indexes.filter((index) => index.name?.includes(collectionGroupMarker));
}

async function waitForOperation(token: string, operationName: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const operation = await requestJson<{ done?: boolean; error?: { message?: string } }>(
      token,
      `${API_ROOT}/${operationName}`,
    );
    if (operation.error) throw new Error(operation.error.message || `Index operation failed: ${operationName}`);
    if (operation.done) return;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`Timed out waiting for Firestore operation ${operationName}`);
}

async function main() {
  const token = await getAccessToken();
  const collectionGroups = [...new Set(DESIRED_INDEXES.map((index) => index.collectionGroup))];
  const liveByGroup = new Map<string, FirestoreIndex[]>();

  for (const collectionGroup of collectionGroups) {
    const indexes = await listIndexes(token, collectionGroup);
    liveByGroup.set(collectionGroup, indexes);
    console.log(`${collectionGroup}: ${indexes.length} composite indexes currently listed`);
  }

  const operations: Promise<void>[] = [];
  const pendingKeys = new Set<string>();
  for (const desired of DESIRED_INDEXES) {
    const key = indexKey({ queryScope: "COLLECTION", fields: desired.fields });
    const existing = (liveByGroup.get(desired.collectionGroup) || [])
      .find((index) => indexKey(index) === key);

    if (existing?.state === "READY") {
      console.log(`READY  ${desired.collectionGroup}: ${desired.label}`);
      continue;
    }
    if (existing && existing.state !== "ERROR" && existing.state !== "NEEDS_REPAIR") {
      console.log(`${existing.state || "PENDING"} ${desired.collectionGroup}: ${desired.label}`);
      pendingKeys.add(`${desired.collectionGroup}|${key}`);
      continue;
    }

    const created = await requestJson<{ name: string }>(
      token,
      indexCollectionPath(desired.collectionGroup),
      {
        method: "POST",
        body: JSON.stringify({
          queryScope: "COLLECTION",
          fields: desired.fields,
        }),
      },
    );
    console.log(`CREATE ${desired.collectionGroup}: ${desired.label}`);
    operations.push(waitForOperation(token, created.name));
  }

  if (operations.length > 0) {
    await Promise.all(operations);
    console.log(`Completed ${operations.length} Firestore index operation(s).`);
  }

  const keysToWaitFor = new Set(pendingKeys);
  for (const desired of DESIRED_INDEXES) {
    keysToWaitFor.add(`${desired.collectionGroup}|${indexKey({ queryScope: "COLLECTION", fields: desired.fields })}`);
  }

  for (let attempt = 0; attempt < 60; attempt++) {
    for (const collectionGroup of collectionGroups) {
      const indexes = await listIndexes(token, collectionGroup);
      liveByGroup.set(collectionGroup, indexes);
    }
    const stillPending = [...keysToWaitFor].filter((key) => {
      const separator = key.indexOf("|");
      const collectionGroup = key.slice(0, separator);
      const desiredKey = key.slice(separator + 1);
      return !(liveByGroup.get(collectionGroup) || [])
        .some((index) => indexKey(index) === desiredKey && index.state === "READY");
    });
    if (stillPending.length === 0) break;
    if (attempt === 59) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const notReady = DESIRED_INDEXES.filter((desired) => {
    const key = indexKey({ queryScope: "COLLECTION", fields: desired.fields });
    return !(liveByGroup.get(desired.collectionGroup) || [])
      .some((index) => indexKey(index) === key && index.state === "READY");
  });

  if (notReady.length > 0) {
    throw new Error(`Indexes not READY: ${notReady.map((index) => `${index.collectionGroup}/${index.label}`).join(", ")}`);
  }

  console.log(`Verified ${DESIRED_INDEXES.length} requested Firestore composite indexes are READY.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});