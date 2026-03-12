import { readFileSync } from "fs";
import { resolve } from "path";

const PROJECT_ID = "thequest-2dc77";
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountJson) {
  console.error("FIREBASE_SERVICE_ACCOUNT not set");
  process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountJson);

async function getAccessToken(): Promise<string> {
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token!;
}

const indexes = JSON.parse(
  readFileSync(resolve("firestore.indexes.json"), "utf-8")
).indexes;

async function deployIndexes() {
  const token = await getAccessToken();

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const index of indexes) {
    const collection = index.collectionGroup;
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/${collection}/indexes`;

    const body = {
      queryScope: index.queryScope,
      fields: index.fields.map((f: any) => ({
        fieldPath: f.fieldPath,
        ...(f.order ? { order: f.order } : {}),
        ...(f.arrayConfig ? { arrayConfig: f.arrayConfig } : {}),
      })),
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json() as any;

    if (res.ok) {
      console.log(`✓ Creating index on ${collection}: ${index.fields.map((f: any) => f.fieldPath).join(" + ")}`);
      created++;
    } else if (data?.error?.status === "ALREADY_EXISTS") {
      console.log(`- Already exists: ${collection}: ${index.fields.map((f: any) => f.fieldPath).join(" + ")}`);
      skipped++;
    } else {
      console.error(`✗ Failed ${collection}: ${JSON.stringify(data?.error?.message)}`);
      failed++;
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} already existed, ${failed} failed`);
}

deployIndexes().catch(console.error);
