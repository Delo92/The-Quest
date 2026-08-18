import admin from "firebase-admin";

let firebaseApp: admin.app.App | null = null;

export function getFirebaseAdmin(): admin.app.App {
  if (firebaseApp) return firebaseApp;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT secret is not set");
  }

  let serviceAccount: admin.ServiceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "thequest-2dc77",
    storageBucket: "thequest-2dc77.firebasestorage.app",
  });

  return firebaseApp;
}

export function getFirestore(): admin.firestore.Firestore {
  return getFirebaseAdmin().firestore();
}

export function getFirebaseAuth(): admin.auth.Auth {
  return getFirebaseAdmin().auth();
}

export async function verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  return getFirebaseAuth().verifyIdToken(idToken);
}

export async function getFirebaseUser(uid: string): Promise<admin.auth.UserRecord> {
  return getFirebaseAuth().getUser(uid);
}

export async function createFirebaseUser(email: string, password: string, displayName?: string): Promise<admin.auth.UserRecord> {
  return getFirebaseAuth().createUser({
    email,
    password,
    displayName: displayName || email.split("@")[0],
  });
}

export async function setUserLevel(uid: string, level: number): Promise<void> {
  await getFirebaseAuth().setCustomUserClaims(uid, { level });
}

export async function deleteFirebaseUser(uid: string): Promise<void> {
  await getFirebaseAuth().deleteUser(uid);
}

export interface FirestoreUser {
  uid: string;
  email: string;
  displayName: string;
  stageName?: string;
  level: number;
  profileImageUrl?: string;
  socialLinks?: Record<string, string>;
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export async function getFirestoreUser(uid: string): Promise<FirestoreUser | null> {
  const doc = await getFirestore().collection("users").doc(uid).get();
  if (!doc.exists) return null;
  return doc.data() as FirestoreUser;
}

export async function createFirestoreUser(data: {
  uid: string;
  email: string;
  displayName: string;
  level: number;
  profileImageUrl?: string;
  stageName?: string;
  socialLinks?: Record<string, string>;
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}): Promise<FirestoreUser> {
  const now = admin.firestore.Timestamp.now();
  const raw = { ...data, createdAt: now, updatedAt: now };
  // Firestore rejects undefined values — strip them out
  const userData = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined)
  ) as FirestoreUser;
  await getFirestore().collection("users").doc(data.uid).set(userData);
  return userData;
}

export async function updateFirestoreUser(uid: string, data: Partial<Omit<FirestoreUser, "uid" | "createdAt">>): Promise<FirestoreUser | null> {
  const ref = getFirestore().collection("users").doc(uid);
  const doc = await ref.get();
  if (!doc.exists) return null;

  await ref.update({
    ...data,
    updatedAt: admin.firestore.Timestamp.now(),
  });

  const updated = await ref.get();
  return updated.data() as FirestoreUser;
}

export async function getAllFirestoreUsers(): Promise<FirestoreUser[]> {
  const snapshot = await getFirestore().collection("users").get();
  return snapshot.docs.map(doc => doc.data() as FirestoreUser);
}

export function getFirebaseStorage() {
  return getFirebaseAdmin().storage();
}

export async function uploadToFirebaseStorage(
  filePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const bucket = getFirebaseStorage().bucket();
  const file = bucket.file(filePath);
  await file.save(buffer, {
    metadata: { contentType: mimeType },
    public: true,
  });
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(filePath)}`;
  return publicUrl;
}

export async function deleteFromFirebaseStorage(filePath: string): Promise<void> {
  const bucket = getFirebaseStorage().bucket();
  const file = bucket.file(filePath);
  try {
    await file.delete();
  } catch (err: any) {
    console.error("Firebase Storage delete error:", err.message);
  }
}

export async function listFirebaseStorageFiles(prefix: string): Promise<Array<{ name: string; url: string }>> {
  const bucket = getFirebaseStorage().bucket();
  const [files] = await bucket.getFiles({ prefix });
  return files.map(f => ({
    name: f.name,
    url: `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(f.name)}`,
  }));
}
