// Existing owner-approved admin reset convention. Keep server-side only.
export const ADMIN_TEMPORARY_ACCOUNT_PASSWORD = "#1Quest";

export function getTemporaryAccountPassword(): string {
  return ADMIN_TEMPORARY_ACCOUNT_PASSWORD;
}

export function nomineeAccountLevel(currentLevel?: number): number {
  return currentLevel === 3 || currentLevel === 4 ? currentLevel : 2;
}

function escape(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export function renderAccountEmailAccess(opts: {
  email: string;
  accountCreated?: boolean;
  temporaryPassword?: string;
  resetUrl: string;
}): string {
  const hasTemporaryPassword = opts.accountCreated && !!opts.temporaryPassword;
  return `<div class="credentials-box">
    <p class="cred-label">${hasTemporaryPassword ? "Your Login Credentials" : "Access Your Account"}</p>
    <p class="cred-row">Email: <span class="cred-value">${escape(opts.email)}</span></p>
    ${hasTemporaryPassword
      ? `<p class="cred-row">Temporary Password: <span class="cred-value">${escape(opts.temporaryPassword!)}</span></p>
         <p>Use the login button below and enter this temporary password. Change your password after signing in.</p>`
      : `<p>Your account already exists. Use your current password with the login button below. If you don't know it, choose your own password using the secure link below.</p>`}
    <p><a href="${escape(opts.resetUrl)}" style="color:#FF5A09;">Set or reset my password</a></p>
    <p style="font-size:12px;color:#bbb;">Password reset links expire. If needed, request a fresh link from Forgot password on the login page.</p>
  </div>`;
}
