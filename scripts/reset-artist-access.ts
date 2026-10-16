/**
 * Owner-authorized maintenance. Dry run by default.
 * --apply --batch-id=<unique-id> performs/resumes the specified batch.
 * Stores only reset/email audit metadata in Firestore, never credentials.
 */
import { getFirebaseAuth, getFirestore, getFirestoreUser, updateFirestoreUser } from "../server/firebase-admin";
import { resetAdminAccount } from "../server/admin-account-reset";
import { getTemporaryAccountPassword } from "../server/account-email-access";
import { artistResetEligibility } from "../server/artist-reset-scope";
import { buildAccountLoginUrl } from "../shared/account-login-links";
import { isEmailConfigured, sendAccountAccessEmail, verifyAccountAccessEmailDelivery } from "../server/email";

let stage = "inventory";

async function main() {
  const apply = process.argv.includes("--apply");
  const batchId = process.argv.find((arg) => arg.startsWith("--batch-id="))?.slice("--batch-id=".length);
  if (apply && (!batchId || !/^[a-z0-9-]{8,100}$/.test(batchId))) throw new Error("A valid explicit batch ID is required.");
  const db = getFirestore();
  const auth = getFirebaseAuth();
  const [userDocs, profileDocs, competitionDocs] = await Promise.all([
    db.collection("users").get(), db.collection("talentProfiles").get(), db.collection("competitions").get(),
  ]);
  const users = new Map(userDocs.docs.map((doc) => [doc.id, doc.data()]));
  const roles = new Map<string, string[]>();
  for (const doc of profileDocs.docs) {
    const profile = doc.data();
    if (typeof profile.userId !== "string") continue;
    roles.set(profile.userId, [...(roles.get(profile.userId) || []), String(profile.role || "")]);
  }
  const owners = new Set(competitionDocs.docs.map((doc) => doc.data().createdBy).filter(Boolean));
  const accounts = new Map<string, Awaited<ReturnType<typeof auth.getUser>>>();
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const account of page.users) accounts.set(account.uid, account);
    pageToken = page.pageToken;
  } while (pageToken);
  const counts: Record<string, number> = {};
  const targets: string[] = [];
  const protectedAccounts = new Map<string, string | undefined>();
  for (const uid of new Set([...users.keys(), ...roles.keys(), ...accounts.keys()])) {
    const user = users.get(uid);
    const account = accounts.get(uid);
    const status = artistResetEligibility({
      userLevel: user?.level, authLevel: account?.customClaims?.level,
      roles: [...(roles.get(uid) || []), String(user?.role || ""), String(account?.customClaims?.role || "")],
      ownsCompetition: owners.has(uid), authExists: !!account,
      disabled: account?.disabled, email: account?.email,
    });
    counts[status] = (counts[status] || 0) + 1;
    if (status === "eligible") targets.push(uid);
    if (status === "host-admin" && account) protectedAccounts.set(uid, account.tokensValidAfterTime);
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", counts }));
  if (!apply) return;
  if (!isEmailConfigured()) throw new Error("Email is not configured; no passwords were changed.");
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) throw new Error("Canonical site URL is not configured; no passwords were changed.");
  const origin = new URL(buildAccountLoginUrl(siteUrl, "preflight@example.com"));
  if (origin.protocol !== "https:" || /(^localhost$|\.replit\.dev$)/i.test(origin.hostname)) throw new Error("A production HTTPS site URL is required.");
  stage = "live-login-page";
  const loginPage = await fetch(new URL("/thequest/login", origin), { signal: AbortSignal.timeout(20_000) });
  if (!loginPage.ok || !(await loginPage.text()).toLowerCase().includes("quest")) throw new Error("Live login page verification failed; no passwords were changed.");
  stage = "email-service-authentication";
  await verifyAccountAccessEmailDelivery();
  console.log("Live login page and email service authentication verified.");
  const batch = db.collection("adminAccountResetBatches").doc(batchId!);
  stage = "account-reset-and-email";
  const previousBatch = await batch.get();
  const previousData = previousBatch.data();
  const batchTargets: string[] = previousData?.targetUids || targets;
  if (!previousBatch.exists) {
    await batch.create({
      scope: "artists-competitors-only", actor: "owner-authorized-maintenance",
      createdAt: new Date().toISOString(), targetUids: targets, selectionCounts: counts,
      status: "running",
    });
  }
  let resetCount = 0, sentCount = 0, failures = 0, skipped = 0;
  for (const uid of batchTargets) {
    const item = batch.collection("accounts").doc(uid);
    const prior = (await item.get()).data();
    if (prior?.emailStatus === "accepted") {
      resetCount++; sentCount++;
      continue;
    }
    try {
      const [account, user, latestProfiles, ownership] = await Promise.all([
        auth.getUser(uid), getFirestoreUser(uid),
        db.collection("talentProfiles").where("userId", "==", uid).get(),
        db.collection("competitions").where("createdBy", "==", uid).limit(1).get(),
      ]);
      const currentStatus = artistResetEligibility({
        userLevel: user?.level, authLevel: account.customClaims?.level,
        roles: [...latestProfiles.docs.map((doc) => String(doc.data().role || "")), String(account.customClaims?.role || ""), String((user as any)?.role || "")],
        ownsCompetition: !ownership.empty, authExists: true, disabled: account.disabled, email: account.email,
      });
      if (currentStatus !== "eligible" || !user || !account.email) {
        skipped++;
        await item.set({ status: "skipped", reason: currentStatus, updatedAt: new Date().toISOString() }, { merge: true });
        continue;
      }
      let emailSent = false;
      if (prior?.resetAt) {
        // Retrying failed email delivery must not change the password a second time.
        emailSent = await sendAccountAccessEmail({
          to: account.email, name: user.displayName, level: 2,
          temporaryPassword: getTemporaryAccountPassword(), siteUrl,
        });
      } else {
        const result = await resetAdminAccount({
          uid, adminUid: "owner-authorized-maintenance", sendEmail: true, siteUrl,
        }, {
          getUser: async () => ({ ...user, email: account.email!, level: 2 }),
          setPassword: (targetUid, password) => auth.updateUser(targetUid, { password }),
          revokeSessions: (targetUid) => auth.revokeRefreshTokens(targetUid),
          recordReset: async (targetUid, audit) => {
            await updateFirestoreUser(targetUid, audit);
            await item.set({ resetAt: audit.adminPasswordResetAt, status: "reset-complete", emailStatus: "pending" }, { merge: true });
          },
          sendEmail: sendAccountAccessEmail,
        });
        emailSent = result.emailSent === true;
      }
      resetCount++;
      if (emailSent) sentCount++; else failures++;
      await item.set({
        status: emailSent ? "complete" : "email-failed",
        emailStatus: emailSent ? "accepted" : "failed",
        lastEmailAttemptAt: new Date().toISOString(),
      }, { merge: true });
      console.log(JSON.stringify({ processed: resetCount + skipped, total: batchTargets.length, resetCount, sentCount, failures, skipped }));
    } catch {
      failures++;
      await item.set({ status: "failed", updatedAt: new Date().toISOString() }, { merge: true });
      console.error("One artist account operation failed; details are recorded without credentials.");
    }
  }
  let protectedUnchanged = true;
  for (const [uid, before] of protectedAccounts) {
    if ((await auth.getUser(uid)).tokensValidAfterTime !== before) protectedUnchanged = false;
  }
  const result = { targetCount: batchTargets.length, resetCount, sentCount, failures, skipped, protectedAccountsUnchanged: protectedUnchanged };
  await batch.set({ ...result, status: failures || skipped ? "needs-attention" : "complete", finishedAt: new Date().toISOString() }, { merge: true });
  console.log(JSON.stringify({ final: result }));
}

main().then(() => process.exit(0)).catch((error) => {
  const rawCode = String(error?.code || error?.response?.data?.error || "unclassified");
  const code = /^[a-z0-9_/-]{1,80}$/i.test(rawCode) ? rawCode : "unclassified";
  console.error(JSON.stringify({ error: "Batch stopped; no automatic retry was started.", stage, code }));
  process.exit(1);
});
