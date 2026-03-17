import { google, drive_v3 } from "googleapis";
import { Readable } from "stream";

let driveClient: drive_v3.Drive | null = null;

function getDriveClient(): drive_v3.Drive {
  if (driveClient) return driveClient;

  const credentialsJson = process.env.GOOGLE_DRIVE_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!credentialsJson) {
    throw new Error("GOOGLE_DRIVE_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT secret is not set");
  }

  let credentials: any;
  try {
    credentials = JSON.parse(credentialsJson);
  } catch {
    throw new Error("Drive credentials are not valid JSON");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

export async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const drive = getDriveClient();

  let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const res = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  const folderMetadata: drive_v3.Schema$File = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) {
    folderMetadata.parents = [parentId];
  }

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: "id",
  });

  return folder.data.id!;
}

export async function getHiFitCompFolder(): Promise<string> {
  return "17Fuu4-5mzEs7oGUtKorUJigvdk1lu-9H";
}

// ChronicTV(Beta) folder ID — hardcoded exactly like CBpublishing_TheQuest
// so the service account writes into the human-owned folder (not its own 0-quota drive)
const CHRONIC_TV_ROOT_FOLDER_ID = "PLACEHOLDER_CHRONICV_FOLDER_ID";
const CHRONIC_TV_QUEST_SHOW_NAME = "The Quest";

export async function getChronicTVRootFolder(): Promise<string> {
  return CHRONIC_TV_ROOT_FOLDER_ID;
}

// Returns ChronicTV(Beta) > The Quest — the show folder for all Quest events/competitors
async function getChronicTVQuestDriveFolder(): Promise<string> {
  return findOrCreateFolder(CHRONIC_TV_QUEST_SHOW_NAME, CHRONIC_TV_ROOT_FOLDER_ID);
}

// Creates a Google Doc (no storage quota cost) with plain-text content
async function upsertSummaryDoc(drive: drive_v3.Drive, parentFolderId: string, lines: string[]): Promise<void> {
  const content = lines.join("\n");
  const stream = new Readable();
  stream.push(Buffer.from(content, "utf-8"));
  stream.push(null);

  const existing = await drive.files.list({
    q: `name='summary' and '${parentFolderId}' in parents and trashed=false`,
    fields: "files(id)",
  });

  if (existing.data.files?.length) {
    await drive.files.update({
      fileId: existing.data.files[0].id!,
      media: { mimeType: "text/plain", body: stream },
    });
  } else {
    await drive.files.create({
      requestBody: {
        name: "summary",
        parents: [parentFolderId],
        mimeType: "application/vnd.google-apps.document",
      },
      media: { mimeType: "text/plain", body: stream },
      fields: "id",
    });
  }
}

export async function syncCompetitionToChronicTV(
  competitionName: string,
  details: { description: string | null; category: string; status: string; endDate: string | null }
): Promise<void> {
  const drive = getDriveClient();
  const safeName = competitionName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  // Path: ChronicTV(Beta) / The Quest / ChronicTV / [Event Name]
  const chronicTVQuestFolder = await getChronicTVQuestDriveFolder();
  const eventFolder = await findOrCreateFolder(safeName, chronicTVQuestFolder);

  await upsertSummaryDoc(drive, eventFolder, [
    `COMPETITION: ${competitionName}`,
    `Category: ${details.category}`,
    `Status: ${details.status}`,
    `End Date: ${details.endDate || "TBD"}`,
    ``,
    `Description:`,
    details.description || "No description provided.",
    ``,
    `---`,
    `Synced from: The Quest by CB Publishing`,
  ]);
}

export async function syncContestantToChronicTV(
  competitionName: string,
  talentName: string,
  bio: string | null
): Promise<void> {
  const drive = getDriveClient();
  const safeName = competitionName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  const safeTalent = talentName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  // Path: ChronicTV(Beta) / The Quest / ChronicTV / [Event Name] / [Talent Name]
  const chronicTVQuestFolder = await getChronicTVQuestDriveFolder();
  const eventFolder = await findOrCreateFolder(safeName, chronicTVQuestFolder);
  const contestantFolder = await findOrCreateFolder(safeTalent, eventFolder);

  await upsertSummaryDoc(drive, contestantFolder, [
    `CONTESTANT: ${talentName}`,
    `Competition: ${competitionName}`,
    ``,
    `Bio:`,
    bio || "No bio provided.",
    ``,
    `---`,
    `Synced from: The Quest by CB Publishing`,
  ]);
}

export async function getCompetitionFolder(competitionName: string): Promise<string> {
  const rootId = await getHiFitCompFolder();
  const safeName = competitionName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  return findOrCreateFolder(safeName, rootId);
}

export async function getTalentFolderInCompetition(competitionName: string, talentName: string): Promise<string> {
  const competitionFolderId = await getCompetitionFolder(competitionName);
  const safeTalentName = talentName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
  return findOrCreateFolder(safeTalentName, competitionFolderId);
}

export async function getTalentMediaFolder(competitionName: string, talentName: string): Promise<string> {
  const talentFolderId = await getTalentFolderInCompetition(competitionName, talentName);
  return findOrCreateFolder("media1", talentFolderId);
}

export async function createCompetitionDriveFolder(competitionName: string): Promise<string> {
  return getCompetitionFolder(competitionName);
}

export async function createContestantDriveFolders(competitionName: string, talentName: string): Promise<string> {
  return getTalentMediaFolder(competitionName, talentName);
}

export async function uploadImageToDrive(
  competitionName: string,
  talentName: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<{ id: string; webViewLink: string; webContentLink: string; thumbnailLink: string }> {
  const drive = getDriveClient();
  const folderId = await getTalentMediaFolder(competitionName, talentName);

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id, webViewLink, webContentLink, thumbnailLink",
  });

  await drive.permissions.create({
    fileId: res.data.id!,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  return {
    id: res.data.id!,
    webViewLink: res.data.webViewLink || "",
    webContentLink: res.data.webContentLink || "",
    thumbnailLink: res.data.thumbnailLink || "",
  };
}

export async function uploadFileToDriveFolder(
  folderId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<{ id: string; name: string; webViewLink: string; size: string }> {
  const drive = getDriveClient();

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id, name, webViewLink, size",
  });

  return {
    id: res.data.id!,
    name: res.data.name || fileName,
    webViewLink: res.data.webViewLink || "",
    size: res.data.size || "0",
  };
}

export async function listFilesInFolder(folderId: string): Promise<Array<{
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink: string;
  webViewLink: string;
  webContentLink: string;
  size: string;
  createdTime: string;
}>> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id, name, mimeType, thumbnailLink, webViewLink, webContentLink, size, createdTime)",
    orderBy: "createdTime desc",
    pageSize: 100,
  });

  return (res.data.files || []).map(f => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType || "",
    thumbnailLink: f.thumbnailLink || "",
    webViewLink: f.webViewLink || "",
    webContentLink: f.webContentLink || "",
    size: f.size || "0",
    createdTime: f.createdTime || "",
  }));
}

export async function listImagesInFolder(folderId: string): Promise<Array<{
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink: string;
  thumbnailLink: string;
}>> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`,
    fields: "files(id, name, mimeType, webViewLink, webContentLink, thumbnailLink)",
    orderBy: "createdTime desc",
  });

  return (res.data.files || []).map(f => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
    webViewLink: f.webViewLink || "",
    webContentLink: f.webContentLink || "",
    thumbnailLink: f.thumbnailLink || "",
  }));
}

export async function listTalentImages(competitionName: string, talentName: string): Promise<Array<{
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink: string;
  thumbnailLink: string;
}>> {
  try {
    const folderId = await getTalentMediaFolder(competitionName, talentName);
    return listImagesInFolder(folderId);
  } catch {
    return [];
  }
}

export async function listAllTalentImages(talentName: string): Promise<Array<{
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink: string;
  thumbnailLink: string;
  competitionFolder: string;
}>> {
  try {
    const drive = getDriveClient();
    const rootId = await getHiFitCompFolder();
    const compFoldersRes = await drive.files.list({
      q: `'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
    });
    const allImages: Array<{
      id: string;
      name: string;
      mimeType: string;
      webViewLink: string;
      webContentLink: string;
      thumbnailLink: string;
      competitionFolder: string;
    }> = [];
    const safeTalentName = talentName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
    for (const compFolder of compFoldersRes.data.files || []) {
      const talentFoldersRes = await drive.files.list({
        q: `'${compFolder.id}' in parents and name='${safeTalentName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id, name)",
      });
      for (const talentFolder of talentFoldersRes.data.files || []) {
        const mediaFolderRes = await drive.files.list({
          q: `'${talentFolder.id}' in parents and name='media1' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id)",
        });
        for (const mediaFolder of mediaFolderRes.data.files || []) {
          const images = await listImagesInFolder(mediaFolder.id!);
          allImages.push(...images.map(img => ({ ...img, competitionFolder: compFolder.name! })));
        }
      }
    }
    return allImages;
  } catch {
    return [];
  }
}

export async function getFileStream(fileId: string): Promise<Readable> {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );
  return res.data as unknown as Readable;
}

export async function deleteFile(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
}

export function getDriveImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

export function getDriveThumbnailUrl(fileId: string, size: number = 400): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

export async function getDriveStorageUsage(): Promise<{
  usedGB: number;
  totalGB: number;
  usedPercent: number;
  totalFiles: number;
  theQuestSizeMB: number;
  folders: Array<{ name: string; fileCount: number; sizeBytes: number; sizeMB: number }>;
  error?: string;
}> {
  const drive = getDriveClient();
  let usedGB = 0;
  let totalGB = 0;
  let totalFiles = 0;
  let theQuestSizeBytes = 0;
  const folders: Array<{ name: string; fileCount: number; sizeBytes: number; sizeMB: number }> = [];

  try {
    const about = await drive.about.get({ fields: "storageQuota" });
    const quota = about.data.storageQuota;
    if (quota) {
      usedGB = Math.round((parseInt(quota.usage || "0") / (1024 * 1024 * 1024)) * 100) / 100;
      const limitBytes = parseInt(quota.limit || "0");
      totalGB = limitBytes > 0
        ? Math.round((limitBytes / (1024 * 1024 * 1024)) * 100) / 100
        : 0;
    }
  } catch (err: any) {
    console.error("Error getting Drive about info:", err.message);
  }

  try {
    const rootId = await getHiFitCompFolder();
    const compFoldersRes = await drive.files.list({
      q: `'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
    });

    for (const compFolder of compFoldersRes.data.files || []) {
      let folderSize = 0;
      let folderFiles = 0;

      const allFilesInComp = await drive.files.list({
        q: `'${compFolder.id}' in parents and trashed=false`,
        fields: "files(id, mimeType, size)",
        pageSize: 1000,
      });

      for (const item of allFilesInComp.data.files || []) {
        if (item.mimeType === "application/vnd.google-apps.folder") {
          const subFiles = await drive.files.list({
            q: `'${item.id}' in parents and trashed=false`,
            fields: "files(id, mimeType, size)",
            pageSize: 1000,
          });
          for (const subItem of subFiles.data.files || []) {
            if (subItem.mimeType === "application/vnd.google-apps.folder") {
              const deepFiles = await drive.files.list({
                q: `'${subItem.id}' in parents and trashed=false`,
                fields: "files(size)",
                pageSize: 1000,
              });
              for (const df of deepFiles.data.files || []) {
                const sz = parseInt(df.size || "0");
                folderSize += sz;
                folderFiles++;
              }
            } else {
              const sz = parseInt(subItem.size || "0");
              folderSize += sz;
              folderFiles++;
            }
          }
        } else {
          const sz = parseInt(item.size || "0");
          folderSize += sz;
          folderFiles++;
        }
      }

      totalFiles += folderFiles;
      theQuestSizeBytes += folderSize;
      folders.push({
        name: compFolder.name!,
        fileCount: folderFiles,
        sizeBytes: folderSize,
        sizeMB: Math.round((folderSize / (1024 * 1024)) * 100) / 100,
      });
    }
  } catch (err: any) {
    console.error("Error calculating Drive folder sizes:", err.message);
  }

  return {
    usedGB,
    totalGB,
    usedPercent: totalGB > 0 ? Math.round((usedGB / totalGB) * 10000) / 100 : 0,
    totalFiles,
    theQuestSizeMB: Math.round((theQuestSizeBytes / (1024 * 1024)) * 100) / 100,
    folders,
  };
}
