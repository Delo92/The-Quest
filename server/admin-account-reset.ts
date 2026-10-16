import { getTemporaryAccountPassword } from "./account-email-access";

interface ResetAccount {
  email: string;
  displayName: string;
  level: number;
}

interface ResetDependencies {
  getUser(uid: string): Promise<ResetAccount | null>;
  setPassword(uid: string, password: string): Promise<unknown>;
  revokeSessions(uid: string): Promise<unknown>;
  recordReset(uid: string, audit: { adminPasswordResetAt: string; adminPasswordResetBy: string }): Promise<unknown>;
  sendEmail(options: { to: string; name: string; level: number; temporaryPassword: string; siteUrl: string }): Promise<boolean>;
}

// Called only after the HTTP route's Firebase/admin authorization checks.
export async function resetAdminAccount(
  options: { uid: string; adminUid: string; sendEmail: boolean; siteUrl: string },
  dependencies: ResetDependencies,
) {
  const account = await dependencies.getUser(options.uid);
  if (!account) throw Object.assign(new Error("User not found"), { status: 404 });
  const temporaryPassword = getTemporaryAccountPassword();
  await dependencies.setPassword(options.uid, temporaryPassword);
  await dependencies.revokeSessions(options.uid);
  const resetAt = new Date().toISOString();
  await dependencies.recordReset(options.uid, {
    adminPasswordResetAt: resetAt,
    adminPasswordResetBy: options.adminUid,
  });
  let emailSent: boolean | null = null;
  if (options.sendEmail) {
    try {
      emailSent = await dependencies.sendEmail({
        to: account.email, name: account.displayName, level: account.level,
        temporaryPassword, siteUrl: options.siteUrl,
      });
    } catch {
      // The reset has already happened: report the delivery failure without hiding that fact.
      emailSent = false;
    }
  }
  return { email: account.email || null, temporaryPassword, resetAt, emailSent };
}
