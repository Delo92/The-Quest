import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { google } from "googleapis";
import { createHash, randomUUID } from "node:crypto";
import { firestoreEmailActivity, firestoreLivery } from "./firestore-collections";
import { getFirebaseAuth } from "./firebase-admin";
import { getMicrosoftEmailSettings } from "./microsoft-email-oauth";
import { buildAccountLoginUrl } from "../shared/account-login-links";
import { normalizeVoteSupportCopy } from "../shared/vote-support-copy";
import {
  buildAccountAccessMessage,
  renderAccountEmailAccess,
  renderAccountEmailAccessText,
  type AccountAccessOptions,
} from "./account-email-access";
import { logEmailDiagnostic } from "./email-diagnostics";
import { buildReferralCodeUsageNotice } from "./referral-code-notification";

async function accountResetUrl(
  siteUrl: string,
  email: string,
  level: number,
  inviteToken?: string,
  diagnosticId?: string,
  endpoint?: string,
): Promise<string> {
  const loginUrl = buildAccountLoginUrl(siteUrl, email, { level, inviteToken });
  try {
    return await getFirebaseAuth().generatePasswordResetLink(email, { url: loginUrl });
  } catch (error) {
    // An authorized-domain or provider failure must not leave recipients without recovery.
    const loggedDiagnosticId = await logEmailDiagnostic({
      stage: "password_reset_link",
      error,
      diagnosticId,
      endpoint,
    });
    console.warn(`[Email] Direct password-reset link unavailable; using the prefilled reset form (diagnosticId=${loggedDiagnosticId}).`);
    return buildAccountLoginUrl(siteUrl, email, { level, inviteToken, reset: true });
  }
}

const GMAIL_ADDRESS = "chronicstudios2021@gmail.com";
const DISPLAY_NAME = "The Quest";
const PLATFORM_LINE = "The Quest — CB Publishing's Talent Competition Platform";

async function getEmailTemplate(key: string, fallback: string): Promise<string> {
  try {
    const item = await firestoreLivery.getByKey(key);
    if (item && item.textContent) return item.textContent;
  } catch {}
  return fallback;
}

async function normalizeVoteSupportTemplate(templatePromise: Promise<string>): Promise<string> {
  return normalizeVoteSupportCopy(await templatePromise);
}

function applyPlaceholders(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.split(`{${key}}`).join(value);
  }
  return result.replace(/\n/g, "<br/>");
}

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedTransporterConfigKey: string | null = null;

type ActiveEmailConfig =
  | {
      provider: "gmail";
      senderAddress: string;
      clientId: string;
      clientSecret: string;
      refreshToken: string;
    }
  | {
      provider: "microsoft365";
      senderAddress: string;
      tenantId: string;
      clientId: string;
      refreshToken: string;
    };

async function getActiveEmailConfig(): Promise<ActiveEmailConfig | null> {
  const microsoft = await getMicrosoftEmailSettings();
  if (microsoft?.activeProvider === "microsoft365") {
    if (!microsoft.clientId || !microsoft.tenantId || !microsoft.refreshToken) {
      throw new Error("Microsoft 365 email is selected but its OAuth connection is incomplete. Reconnect the mailbox in Admin → Email Templates.");
    }
    return {
      provider: "microsoft365",
      senderAddress: microsoft.mailboxAddress,
      tenantId: microsoft.tenantId,
      clientId: microsoft.clientId,
      refreshToken: microsoft.refreshToken,
    };
  }

  const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;
  return {
    provider: "gmail",
    senderAddress: GMAIL_ADDRESS,
    clientId,
    clientSecret,
    refreshToken,
  };
}

async function getTransporter(): Promise<nodemailer.Transporter> {
  const config = await getActiveEmailConfig();
  if (!config) {
    throw new Error("Email OAuth credentials are not configured. Connect Microsoft 365 in Admin → Email Templates.");
  }
  const configKey = createHash("sha256").update(JSON.stringify(config)).digest("hex");
  if (cachedTransporter && cachedTransporterConfigKey === configKey) return cachedTransporter;

  resetTransporter();

  if (config.provider === "microsoft365") {
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        type: "OAuth2",
        user: config.senderAddress,
        clientId: config.clientId,
        refreshToken: config.refreshToken,
        accessUrl: `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
        customParams: {
          scope: "offline_access https://outlook.office.com/SMTP.Send",
        },
      },
    } as SMTPTransport.Options);
  } else {
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: config.senderAddress,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        refreshToken: config.refreshToken,
      },
    });
  }

  cachedTransporterConfigKey = configKey;
  return cachedTransporter;
}

export function resetTransporter() {
  cachedTransporter = null;
  cachedTransporterConfigKey = null;
}

async function getEmailSenderAddress(): Promise<string> {
  const config = await getActiveEmailConfig();
  if (!config) {
    throw new Error("Email OAuth credentials are not configured. Connect Microsoft 365 in Admin → Email Templates.");
  }
  return config.senderAddress;
}

export async function verifyAccountAccessEmailDelivery(): Promise<void> {
  await (await getTransporter()).verify();
}

const brandStyles = `
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #fff; margin: 0; padding: 0; }
    .email-container { max-width: 600px; margin: 0 auto; background: #141414; border-radius: 0; overflow: hidden; }
    .header { background: #000; padding: 32px 24px; text-align: center; border-bottom: 3px solid #FF5A09; }
    .header h1 { margin: 0; font-size: 32px; font-weight: 900; color: #fff; letter-spacing: 8px; text-transform: uppercase; }
    .header .tagline { margin: 6px 0 0; font-size: 11px; color: #FF5A09; letter-spacing: 4px; text-transform: uppercase; }
    .accent-bar { height: 4px; background: linear-gradient(90deg, #FF5A09, #F59E0B, #FF5A09); }
    .content { padding: 36px 28px; }
    .content h2 { color: #FF5A09; margin-top: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 3px; }
    .content p { color: #bbb; line-height: 1.7; font-size: 15px; }
    .highlight-box { background: #1e1e1e; border-left: 4px solid #FF5A09; padding: 16px 20px; margin: 20px 0; border-radius: 0 4px 4px 0; }
    .highlight-box p { margin: 4px 0; color: #ccc; font-size: 14px; }
    .highlight-box .label { color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .highlight-box .value { color: #fff; font-size: 16px; font-weight: 700; }
    .credentials-box { background: #000; border: 1px solid #FF5A09; padding: 20px; margin: 20px 0; text-align: center; border-radius: 4px; }
    .credentials-box .cred-label { color: #FF5A09; font-size: 11px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; margin: 0 0 12px; }
    .credentials-box .cred-row { color: #ccc; font-size: 14px; margin: 6px 0; }
    .credentials-box .cred-value { color: #fff; font-weight: 700; }
    .btn-wrap { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; padding: 16px 40px; background: #FF5A09; color: #fff !important; text-decoration: none; font-weight: 900; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; }
    .btn:hover { background: #e04e08; }
    .fallback-link { font-size: 12px; color: #555; text-align: center; margin: 8px 0 0; }
    .fallback-link a { color: #FF5A09; word-break: break-all; }
    .footer { padding: 24px 28px; text-align: center; border-top: 1px solid #222; }
    .footer p { color: #444; font-size: 12px; margin: 4px 0; }
    table.receipt { width: 100%; border-collapse: collapse; margin: 20px 0; }
    table.receipt td { padding: 12px 0; color: #bbb; font-size: 14px; border-bottom: 1px solid #222; }
    table.receipt td.label { color: #666; }
    table.receipt td.value { text-align: right; color: #fff; font-weight: 600; }
    table.receipt tr.total td { border-top: 2px solid #FF5A09; border-bottom: none; color: #FF5A09; font-size: 17px; font-weight: 900; padding-top: 14px; }
    .stat-row { display: flex; justify-content: space-around; margin: 24px 0; }
    .stat-box { text-align: center; }
    .stat-box .num { font-size: 32px; font-weight: 900; color: #FF5A09; line-height: 1; }
    .stat-box .lbl { font-size: 11px; color: #666; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
    .divider { border: none; border-top: 1px solid #222; margin: 24px 0; }
    .badge { display: inline-block; background: #FF5A09; color: #fff; font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; padding: 4px 10px; }
  </style>
`;

function wrapInTemplate(bodyHtml: string, accentColor?: string): string {
  const accent = accentColor || "#FF5A09";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${brandStyles}
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>THE QUEST</h1>
      <p class="tagline">CB Publishing</p>
    </div>
    <div class="accent-bar" style="background: linear-gradient(90deg, ${accent}, #F59E0B, ${accent});"></div>
    <div class="content">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>${PLATFORM_LINE}</p>
      <p>&copy; ${new Date().getFullYear()} CB Publishing. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ─────────────────────────────────────────────────────────────────────────
   1. INVITE / WELCOME  (general invite + nomination "congrats" path)
───────────────────────────────────────────────────────────────────────── */
export async function sendInviteEmail(opts: {
  to: string;
  inviterName: string;
  inviteToken?: string;
  role: string;
  siteUrl: string;
  nomineeName?: string;
  nominatorName?: string;
  competitionName?: string;
  defaultPassword?: string;
  accountCreated?: boolean;
  invitationMessage?: string;
  mediaUrl?: string;
  isReminder?: boolean;
  needsLogin?: boolean;
  needsAccountSetup?: boolean;
  needsProfilePhoto?: boolean;
  needsVideo?: boolean;
  reminderStopUrl?: string;
  replyTo?: string;
  trackDelivery?: boolean;
}): Promise<boolean> {
  let activityId: string | null = null;
  if (opts.trackDelivery !== false && !opts.isReminder) {
    try {
      activityId = await firestoreEmailActivity.startWelcomeEmail({
        recipientEmail: opts.to,
        recipientName: opts.nomineeName || opts.to.split("@")[0],
        competitionName: opts.competitionName,
      });
    } catch {
      console.warn("[EmailActivity] Could not record the welcome email attempt.");
    }
  }

  try {
    const transporter = await getTransporter();
    const roleDisplay = opts.role.charAt(0).toUpperCase() + opts.role.slice(1);

    const vars: Record<string, string> = {
      inviterName: opts.inviterName,
      role: roleDisplay,
      nomineeName: opts.nomineeName || opts.to.split("@")[0],
      nominatorName: opts.nominatorName || opts.inviterName,
      competitionName: opts.competitionName || "The Quest",
      email: opts.to,
      defaultPassword: opts.defaultPassword || "",
    };
    const [subject, heading, body] = await Promise.all([
      getEmailTemplate("email_welcome_subject", "{inviterName} invited you to join The Quest!"),
      getEmailTemplate("email_welcome_heading", "You've Been Invited!"),
       getEmailTemplate("email_welcome_body", "{inviterName} has invited you to participate in {competitionName} on The Quest as a {role}.\n\nYour account is ready. Click the button below to log in and continue."),
    ]);

    let actionUrl: string;
    let actionLabel: string;
    const accountLevel = opts.role === "admin" ? 4 : opts.role === "host" ? 3 : opts.role === "viewer" ? 1 : 2;
    const prefilledLoginUrl = buildAccountLoginUrl(opts.siteUrl, opts.to, { level: accountLevel, inviteToken: opts.inviteToken });
     if (opts.isReminder && opts.inviteToken && opts.needsLogin) {
       actionUrl = prefilledLoginUrl;
       actionLabel = "Accept Invitation";
     } else if (opts.isReminder && !opts.inviteToken && opts.needsAccountSetup) {
       actionUrl = prefilledLoginUrl;
       actionLabel = "Get Started";
     } else if (opts.isReminder) {
       actionUrl = `${opts.siteUrl}/thequest/dashboard`;
       actionLabel = "Finish Your Profile";
     } else if (opts.inviteToken) {
       actionUrl = prefilledLoginUrl;
       actionLabel = "Log In to Continue";
    } else {
      actionUrl = prefilledLoginUrl;
      actionLabel = "Get Started";
    }

    const resetUrl = await accountResetUrl(opts.siteUrl, opts.to, accountLevel, opts.inviteToken);
    const credentialBlock = renderAccountEmailAccess({
      email: opts.to,
      accountCreated: opts.accountCreated,
      temporaryPassword: opts.defaultPassword,
      resetUrl,
    });
    const credentialText = renderAccountEmailAccessText({
      email: opts.to,
      accountCreated: opts.accountCreated,
      temporaryPassword: opts.defaultPassword,
      resetUrl,
    });

    const invitationMessageBlock = !opts.isReminder && opts.invitationMessage
      ? `<div class="credentials-box"><p class="cred-label">A message from ${escapeHtml(opts.inviterName)}</p><p style="white-space:pre-line">${escapeHtml(opts.invitationMessage)}</p></div>`
      : "";

    let mediaBlock = "";
    if (opts.mediaUrl) {
      const safeMediaUrl = escapeHtml(opts.mediaUrl);
      const isImage = /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(opts.mediaUrl);
      const isDirectVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(opts.mediaUrl);
      if (isImage) {
        mediaBlock = `<div style="margin:24px 0"><img src="${safeMediaUrl}" alt="${escapeHtml(opts.competitionName || "Event")}" style="display:block;width:100%;max-height:320px;object-fit:cover;border:1px solid #2a2a2a"></div>`;
      } else if (isDirectVideo) {
        mediaBlock = `<div style="margin:24px 0"><video controls poster="" style="display:block;width:100%;max-height:320px;background:#111"><source src="${safeMediaUrl}"></video><p class="fallback-link">If the video does not play in your email, <a href="${safeMediaUrl}">watch it here</a>.</p></div>`;
      } else {
        mediaBlock = `<div class="btn-wrap"><a href="${safeMediaUrl}" class="btn">View Event Media</a></div>`;
      }
    }

    const reminderTasks = [
      opts.inviteToken && opts.needsLogin ? "Sign in with the invited email to accept your invitation." : "",
      opts.needsAccountSetup ? "Sign in or create your artist account." : "",
      opts.needsProfilePhoto ? "Upload a profile photo." : "",
      opts.needsVideo ? "Add a video to your talent profile." : "",
    ].filter(Boolean);
    const reminderBlock = opts.isReminder
      ? `<div class="credentials-box">
          <p class="cred-label">What remains</p>
          <ul style="color:#ccc;line-height:1.8;margin:8px 0;padding-left:22px">${reminderTasks.map(task => `<li>${task}</li>`).join("")}</ul>
          <p style="color:#888;font-size:12px;margin:10px 0 0">${opts.inviteToken
            ? "Reminders stop after you accept the invitation and add both a profile photo and a video."
            : "Reminders stop after you add both a profile photo and a video."}</p>
        </div>`
      : "";
    const renderedHeading = opts.isReminder
      ? opts.inviteToken
        ? `Finish your ${escapeHtml(opts.competitionName || "The Quest")} invitation`
        : opts.competitionName
          ? `Complete your ${escapeHtml(opts.competitionName)} profile`
          : "Complete your artist profile"
      : applyPlaceholders(heading, vars);
    const renderedBody = opts.isReminder
      ? opts.inviteToken
        ? "You still have an invitation to participate. Complete the remaining steps below to finish setting up your artist profile."
        : opts.competitionName
          ? `Your artist profile for ${escapeHtml(opts.competitionName)} is missing information needed to participate. Complete the remaining steps below.`
          : "Your artist profile is missing information needed to participate. Complete the remaining steps below."
      : applyPlaceholders(body, vars);

    const html = wrapInTemplate(`
      <h2>${renderedHeading}</h2>
      <p>${renderedBody}</p>
      ${opts.competitionName ? `<div class="credentials-box"><p class="cred-label">${opts.isReminder ? "Competition" : "Event invitation"}</p><p class="cred-row"><span class="cred-value">${escapeHtml(opts.competitionName)}</span></p></div>` : ""}
      ${reminderBlock}
      ${invitationMessageBlock}
      ${opts.isReminder ? "" : mediaBlock}
      ${credentialBlock}
      <div class="btn-wrap">
        <a href="${escapeHtml(actionUrl)}" class="btn">${actionLabel}</a>
      </div>
      <p class="fallback-link">Or copy this link: <a href="${escapeHtml(actionUrl)}">${escapeHtml(actionUrl)}</a></p>
      ${opts.isReminder && opts.reminderStopUrl ? `<p class="fallback-link"><a href="${escapeHtml(opts.reminderStopUrl)}">Stop these reminders</a></p>` : ""}
    `);

    const sendResult = await transporter.sendMail({
      from: `"${DISPLAY_NAME}" <${await getEmailSenderAddress()}>`,
      to: opts.to,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      subject: (opts.isReminder
        ? opts.inviteToken
          ? `Reminder: finish your ${opts.competitionName || "The Quest"} invitation`
          : opts.competitionName
            ? `Reminder: complete your ${opts.competitionName} profile`
            : "Reminder: complete your artist profile"
        : applyPlaceholders(subject, vars)).replace(/[\r\n]/g, "").replace(/<br\/>/g, ""),
      text: [
        renderedHeading.replace(/<[^>]*>/g, ""),
        renderedBody.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""),
        opts.competitionName ? `Event invitation: ${opts.competitionName}` : "",
        !opts.isReminder && opts.invitationMessage
          ? `A message from ${opts.inviterName}:\n${opts.invitationMessage}`
          : "",
        credentialText,
        `${actionLabel}: ${actionUrl}`,
        opts.isReminder && opts.reminderStopUrl ? `Stop these reminders: ${opts.reminderStopUrl}` : "",
        PLATFORM_LINE,
      ].filter(Boolean).join("\n\n"),
      html,
    });

    const accepted = sendResult.accepted?.length > 0 && !sendResult.rejected?.length;
    if (activityId) {
      try {
        await firestoreEmailActivity.finishWelcomeEmail(activityId, {
          status: accepted ? "provider_accepted" : "failed",
          providerMessageId: sendResult.messageId || null,
          failureCode: accepted ? null : "recipient_not_accepted",
        });
      } catch {
        console.warn("[EmailActivity] Could not save the welcome email result.");
      }
    }

    console.log(accepted
      ? `Invite email accepted by mail provider for ${opts.to}`
      : `Invite email was not accepted by mail provider for ${opts.to}`);
    return accepted;
  } catch (err: any) {
    console.error("Failed to send invite email:", err.message);
    if (activityId) {
      try {
        const failureCode = typeof err?.code === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(err.code)
          ? err.code
          : "send_error";
        await firestoreEmailActivity.finishWelcomeEmail(activityId, {
          status: "failed",
          failureCode,
        });
      } catch {
        console.warn("[EmailActivity] Could not save the failed welcome email result.");
      }
    }
    resetTransporter();
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   2. NOMINATION CONGRATS  (sent to the nominee specifically)
───────────────────────────────────────────────────────────────────────── */
export async function sendNominationCongrats(opts: {
  to: string;
  nomineeName: string;
  nominatorName?: string;
  suggestedNonprofit?: string;
  competitionName: string;
  siteUrl: string;
  defaultPassword?: string;
  accountCreated?: boolean;
  accountLevel?: number;
  diagnosticId?: string;
  endpoint?: string;
  trackDelivery?: boolean;
}): Promise<boolean> {
  const diagnosticId = opts.diagnosticId || randomUUID();
  let activityId: string | null = null;
  if (opts.trackDelivery !== false) {
    try {
      activityId = await firestoreEmailActivity.startWelcomeEmail({
        recipientEmail: opts.to,
        recipientName: opts.nomineeName,
        competitionName: opts.competitionName,
      });
    } catch {
      console.warn("[EmailActivity] Could not record the nomination welcome email attempt.");
    }
  }

  try {
    const transporter = await getTransporter();
    const loginUrl = buildAccountLoginUrl(opts.siteUrl, opts.to, { level: opts.accountLevel || 2 });
    const compUrl = `${opts.siteUrl}/thequest/competitions`;
    const escapedCharacters: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => escapedCharacters[character] || character);
    const safeNomineeName = escapeHtml(opts.nomineeName);
    const safeCompetitionName = escapeHtml(opts.competitionName);
    const nominationIntro = opts.nominatorName?.trim()
      ? `<strong style="color:#FF5A09;">${escapeHtml(opts.nominatorName.trim())}</strong> has nominated you to compete in:`
      : "A community member has nominated you to compete in:";
    const suggestionBlock = opts.suggestedNonprofit?.trim()
      ? `<div class="highlight-box">
          <p class="label">Optional nonprofit suggestion</p>
          <p class="value">${escapeHtml(opts.suggestedNonprofit.trim())}</p>
          <p style="font-size:13px;color:#bbb;">This is only a suggestion. You choose your own nonprofit and contribution rate in your account.</p>
        </div>`
      : "";
    const nonprofitDisclosure = `<div class="highlight-box">
        <p class="label">Nonprofit contribution</p>
        <p class="value">Choose your own nonprofit and a contribution rate from 1% to 10% in your account before prize payout.</p>
        <p style="font-size:13px;color:#bbb;">If you do not choose a rate, the 10% default applies. The Quest matches the same dollar amount to your selected nonprofit.</p>
      </div>`;

    const credentialBlock = renderAccountEmailAccess({
      email: opts.to,
      accountCreated: opts.accountCreated,
      temporaryPassword: opts.defaultPassword,
      resetUrl: await accountResetUrl(
        opts.siteUrl,
        opts.to,
        opts.accountLevel || 2,
        undefined,
        diagnosticId,
        opts.endpoint,
      ),
    });

    const html = wrapInTemplate(`
      <div style="text-align:center; margin-bottom: 28px;">
        <span class="badge">Nomination Confirmed</span>
      </div>
      <h2 style="text-align:center;">Congratulations, ${safeNomineeName}!</h2>
      <p style="text-align:center; font-size:17px; color:#ccc;">
        ${nominationIntro}
      </p>
      <div class="highlight-box" style="text-align:center;">
        <p class="label">Competition</p>
        <p class="value">${safeCompetitionName}</p>
      </div>
      <p>You're officially in the running! The public will vote for their favorite — share your profile link with friends, family, and fans to drive votes your way.</p>
      ${suggestionBlock}
      ${nonprofitDisclosure}
      ${credentialBlock}
      <div class="btn-wrap">
        <a href="${escapeHtml(loginUrl)}" class="btn">Log In &amp; Update Your Profile</a>
      </div>
      <p class="fallback-link">View all competitions: <a href="${compUrl}">${compUrl}</a></p>
      <hr class="divider" />
      <p style="font-size:13px; color:#555;">Share this on social media and tell your fans to VOTE for you! Every vote counts toward your ranking.</p>
    `);

    const sendResult = await transporter.sendMail({
      from: `"${DISPLAY_NAME}" <${await getEmailSenderAddress()}>`,
      to: opts.to,
      subject: `🏆 You've Been Nominated — ${opts.competitionName} | The Quest`,
      html,
    });

    const accepted = sendResult.accepted?.length > 0 && !sendResult.rejected?.length;
    if (activityId) {
      try {
        await firestoreEmailActivity.finishWelcomeEmail(activityId, {
          status: accepted ? "provider_accepted" : "failed",
          providerMessageId: sendResult.messageId || null,
          failureCode: accepted ? null : "recipient_not_accepted",
        });
      } catch {
        console.warn("[EmailActivity] Could not save the nomination welcome email result.");
      }
    }

    console.log(accepted
      ? `Nomination welcome email accepted by mail provider for ${opts.to}`
      : `Nomination welcome email was not accepted by mail provider for ${opts.to}`);
    return accepted;
  } catch (error: any) {
    if (activityId) {
      try {
        const failureCode = typeof error?.code === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(error.code)
          ? error.code
          : "send_error";
        await firestoreEmailActivity.finishWelcomeEmail(activityId, {
          status: "failed",
          failureCode,
        });
      } catch {
        console.warn("[EmailActivity] Could not save the failed nomination welcome email result.");
      }
    }
    await logEmailDiagnostic({
      stage: "nominee_access_send",
      error,
      diagnosticId,
      endpoint: opts.endpoint,
    });
    console.error(`[Email] Failed to send nomination congrats email (diagnosticId=${diagnosticId}).`);
    resetTransporter();
    return false;
  }
}

export function buildAccountAccessEmailMessage(opts: AccountAccessOptions) {
  const message = buildAccountAccessMessage(opts);
  return { ...message, html: wrapInTemplate(message.html) };
}

export async function sendAccountAccessEmailWithReceipt(opts: AccountAccessOptions): Promise<{
  accepted: boolean;
  messageId?: string;
}> {
  try {
    const transporter = await getTransporter();
    const message = buildAccountAccessEmailMessage(opts);
    const result = await transporter.sendMail({
      from: `"${DISPLAY_NAME}" <${await getEmailSenderAddress()}>`,
      to: opts.to,
      ...message,
    });
    return {
      accepted: result.accepted?.length > 0 && !result.rejected?.length,
      messageId: result.messageId,
    };
  } catch {
    console.error("[AccountAccessEmail] Email delivery failed.");
    return { accepted: false };
  }
}

export async function sendAccountAccessEmail(opts: AccountAccessOptions): Promise<boolean> {
  return (await sendAccountAccessEmailWithReceipt(opts)).accepted;
}

/* ─────────────────────────────────────────────────────────────────────────
   3. NOMINATION RECEIPT  (sent to the nominator who paid)
───────────────────────────────────────────────────────────────────────── */
export async function sendNominationReceipt(opts: {
  to: string;
  nominatorName?: string;
  nomineeName: string;
  competitionName: string;
  amount: string;
  transactionId?: string;
  isFree?: boolean;
}): Promise<boolean> {
  try {
    const transporter = await getTransporter();

    const amountDisplay = opts.isFree ? "Free" : opts.amount;
    const escapedCharacters: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => escapedCharacters[character] || character);
    const nomineeName = escapeHtml(opts.nomineeName);
    const competitionName = escapeHtml(opts.competitionName);
    const greeting = opts.nominatorName?.trim()
      ? `Hi <strong style="color:#fff;">${escapeHtml(opts.nominatorName.trim())}</strong>, thank you for nominating someone to The Quest.`
      : "Thank you for submitting a nomination to The Quest.";
    const txLine = opts.transactionId
      ? `<p style="font-size:13px; color:#555; margin-top:16px;">Transaction ID: ${opts.transactionId}</p>`
      : "";
    const html = wrapInTemplate(`
      <div style="text-align:center; margin-bottom: 28px;">
        <span class="badge">Nomination Receipt</span>
      </div>
      <h2>Nomination Accepted &amp; Active</h2>
      <p>${greeting} The nomination has been accepted and is active on The Quest, and the nominee has been notified.</p>

      <div class="highlight-box">
        <p class="label">Nominee</p>
        <p class="value">${nomineeName}</p>
      </div>
      <div class="highlight-box">
        <p class="label">Competition</p>
        <p class="value">${competitionName}</p>
      </div>
      <table class="receipt">
        <tr>
          <td class="label">Nomination Fee</td>
          <td class="value">${amountDisplay}</td>
        </tr>
        <tr class="total">
          <td>Total Paid</td>
          <td style="text-align:right;">${amountDisplay}</td>
        </tr>
      </table>
      ${txLine}
      <p style="font-size:13px; color:#555;">Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
      <p>Share the competition link with friends and family and encourage them to vote for your nominee. Every vote matters!</p>
    `);

    await transporter.sendMail({
      from: `"${DISPLAY_NAME}" <${await getEmailSenderAddress()}>`,
      to: opts.to,
      subject: `Nomination Active — ${opts.nomineeName} | The Quest`,
      html,
    });

    console.log(`Nomination receipt email sent to ${opts.to}`);
    return true;
  } catch (err: any) {
    console.error("Failed to send nomination receipt email:", err.message);
    resetTransporter();
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   4. VOTE CONTRIBUTION CONFIRMATION  (sent after supporting paid voting)
───────────────────────────────────────────────────────────────────────── */
export async function sendPurchaseReceipt(opts: {
  to: string;
  buyerName: string;
  items: { description: string; amount: string }[];
  total: string;
  tax?: string;
  transactionId: string;
  competitionName?: string;
  contestantName?: string;
}): Promise<boolean> {
  try {
    const transporter = await getTransporter();

    const vars = { buyerName: opts.buyerName };
    const [subject, heading, body, footer] = await Promise.all([
      normalizeVoteSupportTemplate(getEmailTemplate("email_receipt_subject", "Your The Quest Vote Support Confirmation")),
      normalizeVoteSupportTemplate(getEmailTemplate("email_receipt_heading", "Vote Contribution Confirmation")),
      normalizeVoteSupportTemplate(getEmailTemplate("email_receipt_body", "Hi {buyerName}, thank you for supporting voting on The Quest!\n\nYour votes have been applied and are now live. This payment was processed by The Quest to add votes; it was not sent directly to a nonprofit. Below are your transaction details.")),
      normalizeVoteSupportTemplate(getEmailTemplate("email_receipt_footer", "If you have questions about this vote contribution, please contact us.")),
    ]);

    let itemsHtml = opts.items.map(item => `
      <tr>
        <td class="label">${item.description}</td>
        <td class="value">${item.amount}</td>
      </tr>
    `).join("");

    if (opts.tax) {
      itemsHtml += `
        <tr>
          <td class="label">Sales Tax</td>
          <td class="value">${opts.tax}</td>
        </tr>
      `;
    }

    itemsHtml += `
      <tr class="total">
        <td>Total Paid</td>
        <td style="text-align: right;">${opts.total}</td>
      </tr>
    `;

    const contextLine = opts.competitionName
      ? `<div class="highlight-box">
          <p class="label">Voting For</p>
          <p class="value">${opts.contestantName || "Your Contestant"}</p>
          <p class="label" style="margin-top:8px;">In Competition</p>
          <p class="value">${opts.competitionName}</p>
        </div>`
      : "";

    const html = wrapInTemplate(`
      <div style="text-align:center; margin-bottom: 28px;">
        <span class="badge">Vote Support Confirmed</span>
      </div>
      <h2>${applyPlaceholders(heading, vars)}</h2>
      <p>${applyPlaceholders(body, vars)}</p>
      ${contextLine}
      <table class="receipt">
        ${itemsHtml}
      </table>
      <p style="font-size:13px; color:#555;">Transaction ID: ${opts.transactionId}</p>
      <p style="font-size:13px; color:#555;">Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
      <hr class="divider" />
      <p>${applyPlaceholders(footer, vars)}</p>
    `);

    await transporter.sendMail({
      from: `"${DISPLAY_NAME}" <${await getEmailSenderAddress()}>`,
      to: opts.to,
      subject: applyPlaceholders(subject, vars).replace(/<br\/>/g, ""),
      html,
    });

    console.log(`Receipt email sent to ${opts.to}`);
    return true;
  } catch (err: any) {
    console.error("Failed to send receipt email:", err.message);
    resetTransporter();
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   5. VOTE THANK YOU  (sent to a logged-in voter after casting a free vote)
───────────────────────────────────────────────────────────────────────── */
export async function sendVoteThankYou(opts: {
  to: string;
  voterName: string;
  contestantName: string;
  competitionName: string;
  voteCount: number;
  siteUrl: string;
}): Promise<boolean> {
  try {
    const transporter = await getTransporter();
    const compUrl = `${opts.siteUrl}/thequest/competitions`;

    const html = wrapInTemplate(`
      <div style="text-align:center; margin-bottom: 28px;">
        <span class="badge">Vote Recorded</span>
      </div>
      <h2 style="text-align:center;">Thanks for Voting!</h2>
      <p style="text-align:center; font-size:17px; color:#ccc;">
        Your support for <strong style="color:#FF5A09;">${opts.contestantName}</strong> has been counted.
      </p>

      <div style="text-align:center; margin: 28px 0;">
        <div style="display:inline-block; background:#1e1e1e; border:2px solid #FF5A09; padding: 20px 40px;">
          <div style="font-size:48px; font-weight:900; color:#FF5A09; line-height:1;">${opts.voteCount}</div>
          <div style="font-size:11px; color:#666; letter-spacing:3px; text-transform:uppercase; margin-top:6px;">${opts.voteCount === 1 ? "Vote Cast" : "Votes Cast"}</div>
        </div>
      </div>

      <div class="highlight-box">
        <p class="label">Competition</p>
        <p class="value">${opts.competitionName}</p>
      </div>

      <p>Want to do more? Share the competition with friends and get more people to vote. You can also make another vote contribution to give your favorite an extra boost!</p>

      <div class="btn-wrap">
        <a href="${compUrl}" class="btn">See the Leaderboard</a>
      </div>
      <hr class="divider" />
      <p style="font-size:13px; color:#555;">Each competition sets its own daily free-vote allowance. Come back tomorrow when your free votes reset!</p>
    `);

    await transporter.sendMail({
      from: `"${DISPLAY_NAME}" <${await getEmailSenderAddress()}>`,
      to: opts.to,
      subject: `Your vote for ${opts.contestantName} is live! — The Quest`,
      html,
    });

    console.log(`Vote thank-you email sent to ${opts.to}`);
    return true;
  } catch (err: any) {
    console.error("Failed to send vote thank-you email:", err.message);
    resetTransporter();
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   6. APPLICATION APPROVED  (sent to the talent when their entry is approved)
───────────────────────────────────────────────────────────────────────── */
export async function sendApplicationApproved(opts: {
  to: string;
  talentName: string;
  competitionName: string;
  siteUrl: string;
}): Promise<boolean> {
  try {
    const transporter = await getTransporter();
    const dashUrl = `${opts.siteUrl}/thequest/talent-dashboard`;
    const compUrl = `${opts.siteUrl}/thequest/competitions`;

    const html = wrapInTemplate(`
      <div style="text-align:center; margin-bottom: 28px;">
        <span class="badge">Application Approved</span>
      </div>
      <h2 style="text-align:center;">You're In, ${opts.talentName}!</h2>
      <p style="text-align:center; font-size:17px; color:#ccc;">
        Your application for <strong style="color:#FF5A09;">${opts.competitionName}</strong> has been approved.
      </p>

      <p>The public can now vote for you. Here's what to do next:</p>

      <div class="highlight-box">
        <p style="margin:0; color:#ccc;">
          ✅ &nbsp;Complete your profile — add photos, bio, and social links<br/>
          ✅ &nbsp;Share your profile link with friends and fans<br/>
          ✅ &nbsp;Ask your supporters to vote every day (the event sets the daily free-vote allowance)<br/>
          ✅ &nbsp;Monitor your rank from your dashboard
        </p>
      </div>

      <div class="btn-wrap">
        <a href="${dashUrl}" class="btn">Go to My Dashboard</a>
      </div>
      <p class="fallback-link">View competition: <a href="${compUrl}">${compUrl}</a></p>
      <hr class="divider" />
      <p style="font-size:13px; color:#555;">The more votes you get, the higher you rank. Share early and often!</p>
    `);

    await transporter.sendMail({
      from: `"${DISPLAY_NAME}" <${await getEmailSenderAddress()}>`,
      to: opts.to,
      subject: `✅ You're approved for ${opts.competitionName} — The Quest`,
      html,
    });

    console.log(`Application approved email sent to ${opts.to}`);
    return true;
  } catch (err: any) {
    console.error("Failed to send application approved email:", err.message);
    resetTransporter();
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   7. PROMO / REFERRAL CODE USED  (sent to the code owner when their code is used)
───────────────────────────────────────────────────────────────────────── */
export async function sendCodeUsedNotification(opts: {
  to: string;
  code: string;
  usageCount: number;
}): Promise<boolean> {
  try {
    const transporter = await getTransporter();
    const notice = buildReferralCodeUsageNotice(opts.code, opts.usageCount);
    const html = wrapInTemplate(notice.bodyHtml);

    await transporter.sendMail({
      from: `"${DISPLAY_NAME}" <${await getEmailSenderAddress()}>`,
      to: opts.to,
      subject: notice.subject,
      html,
    });

    console.log("Referral code usage notification sent.");
    return true;
  } catch {
    console.error("Failed to send referral code usage notification.");
    resetTransporter();
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   UTILITY: Generic test, contact, and auth helpers
───────────────────────────────────────────────────────────────────────── */
export function getGmailAuthUrl(redirectUri: string): string {
  const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not set");

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://mail.google.com/"],
    prompt: "consent",
  });
}

export async function exchangeGmailCode(code: string, redirectUri: string): Promise<string> {
  const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not set");

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) throw new Error("No refresh token received. Make sure you revoke access and try again.");
  return tokens.refresh_token;
}

export async function sendTestEmail(to: string): Promise<boolean> {
  try {
    const transporter = await getTransporter();
    const html = wrapInTemplate(`
      <h2>Email System Test</h2>
      <p>This is a test email from <strong style="color:#FF5A09;">The Quest</strong> — CB Publishing's talent competition platform.</p>
      <p>If you're reading this, email delivery is working correctly.</p>
      <p style="color: #FF5A09; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">All Systems Go!</p>
    `);

    await transporter.sendMail({
      from: `"${DISPLAY_NAME}" <${await getEmailSenderAddress()}>`,
      to,
      subject: "The Quest — Email System Test",
      html,
    });

    console.log(`Test email sent to ${to}`);
    return true;
  } catch (err: any) {
    console.error("Failed to send test email:", err.message);
    resetTransporter();
    throw err;
  }
}

export async function sendContactEmail(opts: {
  name: string;
  email: string;
  phone?: string;
  message: string;
}): Promise<boolean> {
  try {
    const transporter = await getTransporter();
    const html = wrapInTemplate(`
      <h2>New Contact Form Submission</h2>
      <div class="highlight-box">
        <p class="label">From</p>
        <p class="value">${opts.name}</p>
        <p class="label" style="margin-top:8px;">Email</p>
        <p class="value">${opts.email}</p>
        ${opts.phone ? `<p class="label" style="margin-top:8px;">Phone</p><p class="value">${opts.phone}</p>` : ""}
      </div>
      <p><strong style="color:#ccc;">Message:</strong></p>
      <p style="background:#1a1a1a;padding:16px;border-left:4px solid #FF5A09;">${opts.message.replace(/\n/g, "<br/>")}</p>
    `);
    await transporter.sendMail({
      from: `"CB Publishing" <${await getEmailSenderAddress()}>`,
      to: await getEmailSenderAddress(),
      replyTo: opts.email,
      subject: `New Contact Message from ${opts.name}`,
      html,
    });
    return true;
  } catch (err) {
    console.error("sendContactEmail error:", err);
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   LAUNCHPAD PARTNER ENROLLMENT WELCOME
   Sent when an artist is enrolled via the CBUSA partner pipeline.
───────────────────────────────────────────────────────────────────────── */
export async function sendLaunchpadWelcomeEmail(opts: {
  to: string;
  firstName: string;
  artistName: string;
  email: string;
  tempPassword: string;
  competitionName: string;
  partnerStudio: string;
  nextSteps: string[];
  siteUrl: string;
}): Promise<boolean> {
  try {
    const transporter = await getTransporter();
    const loginUrl = `${opts.siteUrl}/login`;

    const nextStepsHtml = opts.nextSteps
      .map((step, i) => `<p style="margin:6px 0; color:#ccc; font-size:14px;"><span style="color:#FF5A09; font-weight:700;">${i + 1}.</span> ${step}</p>`)
      .join("");

    const html = wrapInTemplate(`
      <h2>Welcome to The Quest, ${opts.artistName}!</h2>
      <p style="color:#bbb; line-height:1.7;">
        You've been enrolled in <strong style="color:#fff;">${opts.competitionName}</strong> through
        <strong style="color:#fff;">${opts.partnerStudio}</strong>. Your account is ready — log in below to
        complete your profile and start collecting votes.
      </p>

      <div class="credentials-box">
        <p class="cred-label">Your Login Credentials</p>
        <p class="cred-row">Email: <span class="cred-value">${opts.email}</span></p>
        <p class="cred-row">Temporary Password: <span class="cred-value">${opts.tempPassword}</span></p>
        <p style="color:#555; font-size:12px; margin: 10px 0 0;">Change your password after your first login.</p>
      </div>

      <div class="highlight-box" style="margin-top:24px;">
        <p class="label" style="margin-bottom:10px;">Your Next Steps</p>
        ${nextStepsHtml}
      </div>

      <div class="btn-wrap" style="margin-top:28px;">
        <a href="${loginUrl}" class="btn">Log In &amp; Get Started</a>
      </div>
      <p class="fallback-link">Or copy this link: <a href="${loginUrl}">${loginUrl}</a></p>
    `);

    await transporter.sendMail({
      from: `"The Quest" <${await getEmailSenderAddress()}>`,
      to: opts.to,
      subject: `Welcome to The Quest — ${opts.competitionName} enrollment confirmed`,
      html,
    });

    console.log(`Launchpad welcome email sent to ${opts.to}`);
    return true;
  } catch (err: any) {
    console.error("Failed to send launchpad welcome email:", err.message);
    resetTransporter();
    return false;
  }
}

export async function isEmailConfigured(): Promise<boolean> {
  const microsoft = await getMicrosoftEmailSettings();
  if (microsoft?.activeProvider === "microsoft365") {
    return Boolean(microsoft.clientId && microsoft.tenantId && microsoft.refreshToken);
  }
  return isGmailEmailConfigured();
}

export function isGmailEmailConfigured(): boolean {
  const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  return !!(clientId && clientSecret && process.env.GMAIL_REFRESH_TOKEN);
}
