import { google } from "googleapis";
import { Readable } from "stream";

const FOLDER_ID = "1bAg39ECtEDQPl_P7xbeMaeA8ILoPY2ki";

function getDriveClient() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

async function run() {
  const drive = getDriveClient();

  console.log("Step 1: Read ChronicTV(Beta) contents...");
  try {
    const res = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed=false`,
      fields: "files(id, name)",
    });
    console.log("  ✓ Children:", res.data.files?.map(f => f.name));
  } catch (e: any) {
    console.error("  ✗", e.message); return;
  }

  console.log("Step 2: Create subfolder inside ChronicTV(Beta)...");
  let testFolderId: string | undefined;
  try {
    const res = await drive.files.create({
      requestBody: { name: "_dbg_test", mimeType: "application/vnd.google-apps.folder", parents: [FOLDER_ID] },
      fields: "id, name",
    });
    testFolderId = res.data.id!;
    console.log("  ✓ Folder:", testFolderId);
  } catch (e: any) {
    console.error("  ✗ Folder create failed:", e.message); return;
  }

  console.log("Step 3: Create Google Doc inside subfolder...");
  try {
    const s = new Readable(); s.push("hello"); s.push(null);
    await drive.files.create({
      requestBody: { name: "summary", parents: [testFolderId!], mimeType: "application/vnd.google-apps.document" },
      media: { mimeType: "text/plain", body: s },
      fields: "id",
    });
    console.log("  ✓ Google Doc created");
  } catch (e: any) {
    console.error("  ✗ Google Doc failed:", e.message);
    console.log("Step 3b: Try plain .txt file...");
    try {
      const s2 = new Readable(); s2.push("hello"); s2.push(null);
      await drive.files.create({
        requestBody: { name: "summary.txt", parents: [testFolderId!] },
        media: { mimeType: "text/plain", body: s2 },
        fields: "id",
      });
      console.log("  ✓ txt file created");
    } catch (e2: any) {
      console.error("  ✗ txt also failed:", e2.message);
    }
  }

  if (testFolderId) {
    await drive.files.delete({ fileId: testFolderId }).catch(() => {});
    console.log("Cleanup done");
  }
}
run().catch(console.error);
