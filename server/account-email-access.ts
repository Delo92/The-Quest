import { buildAccountLoginUrl } from "../shared/account-login-links";

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

export interface AccountAccessOptions {
  to: string;
  name: string;
  level: number;
  siteUrl: string;
  temporaryPassword?: string;
  resend?: boolean;
}

export function buildAccountAccessMessage(opts: AccountAccessOptions) {
  const loginUrl = buildAccountLoginUrl(opts.siteUrl, opts.to, { level: opts.level });
  const accountType = opts.level >= 3 ? "Host / Admin" : opts.level === 1 ? "Viewer" : "Artist / Competitor";
  const introduction = opts.resend
    ? "Here are the login details from your recent Quest account reset. This is a resend; your password has not been reset again."
    : "Here are your account access details for The Quest.";
  const password = opts.temporaryPassword
    ? `Temporary password: ${opts.temporaryPassword}`
    : "Password: use your current password.";
  const instructions = opts.temporaryPassword
    ? "If you have already changed this temporary password, use the password you chose instead. To choose a new password, select Forgot your password on the login page."
    : "If you do not know your password, select Forgot your password on the login page.";
  const greeting = `Hi ${opts.name || "there"},`;
  return {
    subject: "Your Quest account access instructions",
    text: [
      greeting, "", introduction, "",
      `Email: ${opts.to}`, password, `Account type: ${accountType}`, "",
      `Sign in: ${loginUrl}`, "", instructions, "",
      "The Quest", "CB Publishing",
    ].join("\n"),
    html: [
      "<h2>Your Quest Account Access</h2>",
      `<p>${escape(greeting)}</p>`,
      `<p>${escape(introduction)}</p>`,
      '<div class="credentials-box">',
      '<p class="cred-label">Your Login Credentials</p>',
      `<p class="cred-row">Email: <span class="cred-value">${escape(opts.to)}</span></p>`,
      `<p class="cred-row">${escape(password)}</p>`,
      `<p class="cred-row">Account type: <span class="cred-value">${escape(accountType)}</span></p>`,
      "</div>",
      `<div class="btn-wrap"><a href="${escape(loginUrl)}" class="btn">Log In to Your Account</a></div>`,
      `<p>${escape(instructions)}</p>`,
    ].join("\n"),
  };
}
