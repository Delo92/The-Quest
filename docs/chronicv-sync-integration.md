# ChronicTV Dual-Sync Integration Guide

How CB Publishing projects wire a Vimeo + Google Drive parallel catalog into ChronicTV so that competition/show data automatically mirrors into ChronicTV's broadcast infrastructure.

---

## Overview

Every time a contestant is approved or a video is uploaded in The Quest, two things happen automatically in the background (fire-and-forget, non-blocking):

1. **Vimeo** — Folders are created/confirmed under `ChronicTV > Originals > CB Publishing The Quest > [Event] > [Talent]`
2. **Google Drive** — Folders are created/confirmed under `ChronicTV(Beta)/The Quest/ChronicTV/[Event]/[Talent]/`

Summary files (Google Docs) inside the Drive folders must be added manually — service accounts cannot create files in a human-owned My Drive, only folders.

---

## Credentials Required

| Secret | What it is |
|---|---|
| `VIMEO_ACCESS_TOKEN` | Vimeo API bearer token with `public`, `private`, `edit`, `upload`, `video_files`, `folders` scopes |
| `FIREBASE_SERVICE_ACCOUNT` | Google Cloud service account JSON with Drive API access. Same JSON used for Firebase Admin. |

The service account must be shared as **Editor** on the `ChronicTV(Beta)` Google Drive folder.

The Google Drive API must be **enabled** in the Google Cloud project that owns the service account:
`https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=YOUR_PROJECT_ID`

---

## Folder Structures

### Vimeo
```
ChronicTV (root folder, owned by ChronicTV account)
└── Originals
    └── CB Publishing The Quest          ← project-specific series name
        └── [Competition / Event Name]
            └── [Talent / Contestant Name]
                └── (videos land here via addVideoToFolder)
```

### Google Drive
```
ChronicTV(Beta)  (folder ID: hardcoded)
└── The Quest/ChronicTV                  ← folder name follows ShowName/ChronicTV convention
    └── [Competition / Event Name]
        └── [Talent / Contestant Name]
            └── (manually add summary doc here)
```

The `ShowName/ChronicTV` naming pattern (e.g. `I AM 788/ChronicTV`, `Starr BLVD/ChronicTV`) is the established ChronicTV convention for all shows inside the `ChronicTV(Beta)` root folder.

---

## Key Implementation Constraint

**Service accounts can create folders in a human-owned Google Drive but cannot create files.**

Google's error: `"Service Accounts do not have storage quota. Leverage shared drives or use OAuth delegation."`

Workarounds if you need actual files:
- Convert the parent folder to a **Shared Drive (Team Drive)** and add the service account as a member
- Use **OAuth delegation** (requires Google Workspace admin)

For now: folder sync only. Drop summary docs manually.

---

## Code: `server/vimeo.ts`

```typescript
const VIMEO_BASE = "https://api.vimeo.com";

function getVimeoHeaders(): Record<string, string> {
  const token = process.env.VIMEO_ACCESS_TOKEN;
  if (!token) throw new Error("VIMEO_ACCESS_TOKEN secret is not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.vimeo.*+json;version=3.4",
  };
}

async function vimeoRequest(path: string, options: RequestInit = {}): Promise<any> {
  const url = path.startsWith("http") ? path : `${VIMEO_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...getVimeoHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vimeo API error ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Find existing folder by name under parent, or create it
async function findOrCreateFolder(name: string, parentUri?: string): Promise<VimeoFolder> {
  const listPath = parentUri
    ? `${parentUri}/items?type=folder&per_page=100`
    : `/me/projects?per_page=100`;

  try {
    const data = await vimeoRequest(listPath);
    const items = data.data || [];
    for (const item of items) {
      const folder = parentUri ? (item.folder || item) : item;
      if (folder.name === name) return folder;
    }
  } catch (err: any) {
    console.warn(`Could not list folders at ${listPath}:`, err.message);
  }

  const body: any = { name };
  if (parentUri) body.parent_folder_uri = parentUri;
  return vimeoRequest("/me/projects", { method: "POST", body: JSON.stringify(body) });
}

// Adds an existing Vimeo video into a folder
async function addVideoToFolder(videoUri: string, folderUri: string): Promise<void> {
  const videoId = videoUri.split("/").pop();
  await vimeoRequest(`${folderUri}/videos/${videoId}`, { method: "PUT" });
}

// ChronicTV folder hierarchy builders
const CHRONIC_TV_QUEST_SERIES_NAME = "CB Publishing The Quest"; // change per project

export async function getChronicTVVimeoFolder(): Promise<VimeoFolder> {
  return findOrCreateFolder("ChronicTV");
}

export async function getChronicTVOriginalsFolder(): Promise<VimeoFolder> {
  const chronicTV = await getChronicTVVimeoFolder();
  return findOrCreateFolder("Originals", chronicTV.uri);
}

export async function getChronicTVQuestSeriesFolder(): Promise<VimeoFolder> {
  const originals = await getChronicTVOriginalsFolder();
  return findOrCreateFolder(CHRONIC_TV_QUEST_SERIES_NAME, originals.uri);
}

export async function getChronicTVEventVimeoFolder(competitionName: string): Promise<VimeoFolder> {
  const questSeries = await getChronicTVQuestSeriesFolder();
  const safeName = competitionName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  return findOrCreateFolder(safeName, questSeries.uri);
}

export async function getChronicTVContestantVimeoFolder(
  competitionName: string,
  talentName: string
): Promise<VimeoFolder> {
  const eventFolder = await getChronicTVEventVimeoFolder(competitionName);
  const safeTalent = talentName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  return findOrCreateFolder(safeTalent, eventFolder.uri);
}

export async function syncVideoToChronicTV(
  videoUri: string,
  competitionName: string,
  talentName: string
): Promise<void> {
  const contestantFolder = await getChronicTVContestantVimeoFolder(competitionName, talentName);
  await addVideoToFolder(videoUri, contestantFolder.uri);
}
```

---

## Code: `server/google-drive.ts`

```typescript
import { google, drive_v3 } from "googleapis";

let driveClient: drive_v3.Drive | null = null;

function getDriveClient(): drive_v3.Drive {
  if (driveClient) return driveClient;
  const credentialsJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!credentialsJson) throw new Error("FIREBASE_SERVICE_ACCOUNT secret is not set");
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentialsJson),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

// Find existing folder by name under parent, or create it
export async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const drive = getDriveClient();
  let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) query += ` and '${parentId}' in parents`;

  const res = await drive.files.list({ q: query, fields: "files(id, name)", spaces: "drive" });
  if (res.data.files && res.data.files.length > 0) return res.data.files[0].id!;

  const meta: drive_v3.Schema$File = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentId) meta.parents = [parentId];
  const folder = await drive.files.create({ requestBody: meta, fields: "id" });
  return folder.data.id!;
}

// ── ChronicTV Drive sync ──────────────────────────────────────────────────────
// Root folder ID: get from Google Drive URL when inside ChronicTV(Beta)
// e.g. https://drive.google.com/drive/folders/1bAg39ECtEDQPl_P7xbeMaeA8ILoPY2ki
const CHRONIC_TV_ROOT_FOLDER_ID = "1bAg39ECtEDQPl_P7xbeMaeA8ILoPY2ki"; // ChronicTV(Beta)

// Show name follows the ChronicTV naming convention: "ShowName/ChronicTV"
const CHRONIC_TV_QUEST_SHOW_NAME = "CB Publishing The Quest/ChronicTV";

async function getChronicTVQuestDriveFolder(): Promise<string> {
  return findOrCreateFolder(CHRONIC_TV_QUEST_SHOW_NAME, CHRONIC_TV_ROOT_FOLDER_ID);
}

// Creates: ChronicTV(Beta) / The Quest/ChronicTV / [Event Name] /
export async function syncCompetitionToChronicTV(competitionName: string): Promise<void> {
  const safeName = competitionName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  const showFolder = await getChronicTVQuestDriveFolder();
  await findOrCreateFolder(safeName, showFolder);
}

// Creates: ChronicTV(Beta) / The Quest/ChronicTV / [Event Name] / [Talent Name] /
export async function syncContestantToChronicTV(
  competitionName: string,
  talentName: string
): Promise<void> {
  const safeName = competitionName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  const safeTalent = talentName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  const showFolder = await getChronicTVQuestDriveFolder();
  const eventFolder = await findOrCreateFolder(safeName, showFolder);
  await findOrCreateFolder(safeTalent, eventFolder);
}
```

---

## Code: `server/routes.ts` — Trigger Points

All calls are **fire-and-forget** (`Promise.all([...]).catch(...)`) so a ChronicTV sync failure never blocks the user-facing response.

### 1. New competition goes live (host/admin creates it)
```typescript
Promise.all([
  syncCompetitionToChronicTV(comp.title),
  getChronicTVEventVimeoFolder(comp.title),
]).catch((err) => console.error("ChronicTV competition sync error (non-blocking):", err.message));
```

### 2. Contestant approved (any path: self-join auto-approve, host approve, admin approve, admin-assign, nomination auto-approve)
```typescript
Promise.all([
  syncContestantToChronicTV(comp.title, talentName),
  getChronicTVContestantVimeoFolder(comp.title, talentName),
]).catch((err) => console.error("ChronicTV contestant sync error (non-blocking):", err.message));
```

### 3. Video upload ticket created (contestant uploads a video)
```typescript
// After ticket is created and videoUri is known:
syncVideoToChronicTV(ticket.videoUri, comp.title, talentName)
  .catch((err) => console.error("ChronicTV video sync error (non-blocking):", err.message));
```

---

## Backfill Script: `server/chronicv-backfill.ts`

Run once after wiring to sync all existing data. Safe to re-run — `findOrCreateFolder` is idempotent.

```typescript
import { storage } from "./storage";
import { syncCompetitionToChronicTV, syncContestantToChronicTV } from "./google-drive";
import { getChronicTVEventVimeoFolder, getChronicTVContestantVimeoFolder, syncVideoToChronicTV, listTalentVideos } from "./vimeo";

function safeName(s: string) {
  return (s || "").replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
}

async function run() {
  const competitions = await storage.getCompetitions();
  const nonDraft = competitions.filter(c => c.status !== "draft");

  for (const comp of nonDraft) {
    try {
      await syncCompetitionToChronicTV(comp.title);
      console.log(`✓ Drive: The Quest/ChronicTV/${safeName(comp.title)}/`);
    } catch (e: any) { console.error(`✗ Drive: ${e.message}`); }

    try {
      await getChronicTVEventVimeoFolder(comp.title);
      console.log(`✓ Vimeo: CB Publishing The Quest > ${comp.title}`);
    } catch (e: any) { console.error(`✗ Vimeo: ${e.message}`); }
  }

  const approved = (await storage.getAllContestants()).filter(c => c.applicationStatus === "approved");

  for (const contestant of approved) {
    const comp = await storage.getCompetition(contestant.competitionId);
    const profile = await storage.getTalentProfile(contestant.talentProfileId);
    if (!comp || !profile) continue;

    const talentName = safeName((profile as any).displayName || (profile as any).stageName);

    try {
      await syncContestantToChronicTV(comp.title, talentName);
      console.log(`✓ Drive: ${talentName} in ${comp.title}`);
    } catch (e: any) { console.error(`✗ Drive: ${e.message}`); }

    try {
      await getChronicTVContestantVimeoFolder(comp.title, talentName);
      console.log(`✓ Vimeo: contestant folder`);
    } catch (e: any) { console.error(`✗ Vimeo: ${e.message}`); }
  }
}

run().catch(console.error);
```

Run it with:
```bash
npx tsx server/chronicv-backfill.ts
```

---

## Adapting for a Different Show

Only three values need to change per project:

| Location | Variable | Example value |
|---|---|---|
| `vimeo.ts` | `CHRONIC_TV_QUEST_SERIES_NAME` | `"CB Publishing The Quest"` |
| `google-drive.ts` | `CHRONIC_TV_ROOT_FOLDER_ID` | ID from the ChronicTV(Beta) Drive URL |
| `google-drive.ts` | `CHRONIC_TV_QUEST_SHOW_NAME` | `"ShowName/ChronicTV"` (must match the folder name inside ChronicTV(Beta)) |

Everything else — `findOrCreateFolder`, `addVideoToFolder`, trigger pattern, backfill script — is identical across projects.
