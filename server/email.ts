import nodemailer from "nodemailer";
import { google } from "googleapis";
import { firestoreLivery } from "./firestore-collections";

const GMAIL_ADDRESS = "chronicstudios2021@gmail.com";
const DISPLAY_NAME = "HiFitComp";

async function getEmailTemplate(key: string, fallback: string): Promise<string> {
  try {
    const item = await firestoreLivery.getByKey(key);
    if (item && item.textContent) return item.textContent;
  } catch {}
  return fallback;
}

function applyPlaceholders(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.split(`{${key}}`).join(value);
  }
  return result.replace(/\n/g, "<br/>");
}

let cachedTransporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (cachedTransporter) return cachedTransporter;

  const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Gmail OAuth credentials not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN.");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, "https://developers.google.com/oauthplayground");
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const { token } = await oauth2Client.getAccessToken();
  if (!token) throw new Error("Failed to get Gmail access token");

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: GMAIL_ADDRESS,
      clientId,
      clientSecret,
      refreshToken,
      accessToken: token,
    },
  });

  return cachedTransporter;
}

function resetTransporter() {
  cachedTransporter = null;
}

const brandStyles = `
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #111; color: #fff; margin: 0; padding: 0; }
    .email-container { max-width: 600px; margin: 0 auto; background: #1a1a1a; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #FF5A09, #F59E0B); padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: bold; color: #fff; letter-spacing: 2px; text-transform: uppercase; }
    .content { padding: 32px 24px; }
    .content h2 { color: #FF5A09; margin-top: 0; }
    .content p { color: #ccc; line-height: 1.6; font-size: 15px; }
    .btn { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #FF5A09, #F59E0B); color: #fff !important; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; letter-spacing: 1px; text-transform: uppercase; margin: 16px 0; }
    .footer { padding: 20px 24px; text-align: center; border-top: 1px solid #333; }
    .footer p { color: #666; font-size: 12px; margin: 4px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #333; }
    .detail-label { color: #999; font-size: 14px; }
    .detail-value { color: #fff; font-size: 14px; font-weight: 600; }
    table.receipt { width: 100%; border-collapse: collapse; margin: 16px 0; }
    table.receipt td { padding: 10px 0; color: #ccc; font-size: 14px; border-bottom: 1px solid #333; }
    table.receipt td.label { color: #999; }
    table.receipt td.value { text-align: right; color: #fff; font-weight: 600; }
    table.receipt tr.total td { border-top: 2px solid #FF5A09; border-bottom: none; color: #FF5A09; font-size: 16px; font-weight: bold; }
  </style>
`;

function wrapInTemplate(bodyHtml: string): string {
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
      <h1>HiFitComp</h1>
    </div>
    <div class="content">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>HiFitComp - Hawaii's Live Talent Competition Platform</p>
      <p>&copy; ${new Date().getFullYear()} HiFitComp. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

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
}): Promise<boolean> {
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
      getEmailTemplate("email_welcome_body", "{inviterName} has invited you to join The Quest as a {role}.\n\nThe Quest is CB Publishing's premier talent competition platform where artists, models, bodybuilders, and performers compete for public votes.\n\nClick the button below to accept your invitation and get started!"),
    ]);

    let actionUrl: string;
    let actionLabel: string;
    if (opts.accountCreated) {
      actionUrl = `${opts.siteUrl}/login`;
      actionLabel = "Log In Now";
    } else if (opts.inviteToken) {
      actionUrl = `${opts.siteUrl}/register?invite=${opts.inviteToken}`;
      actionLabel = "Accept Invitation";
    } else {
      actionUrl = `${opts.siteUrl}/login`;
      actionLabel = "Get Started";
    }

    let credentialBlock = "";
    if (opts.accountCreated && opts.defaultPassword) {
      credentialBlock = `
        <div style="background: #1a1a1a; border: 1px solid #FF5A09; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
          <p style="color: #FF5A09; font-weight: bold; margin: 0 0 8px;">Your Login Credentials</p>
          <p style="color: #ccc; margin: 4px 0;">Email: <strong style="color: #fff;">${opts.to}</strong></p>
          <p style="color: #ccc; margin: 4px 0;">Temporary Password: <strong style="color: #fff;">${opts.defaultPassword}</strong></p>
          <p style="color: #888; font-size: 12px; margin: 8px 0 0;">We recommend changing your password after your first login.</p>
        </div>`;
    }

    const html = wrapInTemplate(`
      <h2>${applyPlaceholders(heading, vars)}</h2>
      <p>${applyPlaceholders(body, vars)}</p>
      ${credentialBlock}
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px auto;">
        <tr>
          <td style="border-radius: 6px; background: linear-gradient(135deg, #FF5A09, #F59E0B);">
            <a href="${actionUrl}" target="_blank" style="display: inline-block; padding: 16px 40px; color: #ffffff; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 18px; font-weight: bold; text-decoration: none; text-transform: uppercase; letter-spacing: 2px; border-radius: 6px; mso-padding-alt: 0; background: linear-gradient(135deg, #FF5A09, #F59E0B);">
              &#9654;&nbsp; ${actionLabel}
            </a>
          </td>
        </tr>
      </table>
      <p style="font-size: 13px; color: #888;">Or copy and paste this link into your browser:<br/>
        <span style="color: #FF5A09; word-break: break-all;">${actionUrl}</span>
      </p>
    `);

    await transporter.sendMail({
      from: `"${DISPLAY_NAME}" <${GMAIL_ADDRESS}>`,
      to: opts.to,
      subject: applyPlaceholders(subject, vars).replace(/<br\/>/g, ""),
      html,
    });

    console.log(`Invite email sent to ${opts.to}`);
    return true;
  } catch (err: any) {
    console.error("Failed to send invite email:", err.message);
    resetTransporter();
    return false;
  }
}

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
      getEmailTemplate("email_receipt_subject", "Your HiFitComp Purchase Receipt"),
      getEmailTemplate("email_receipt_heading", "Purchase Receipt"),
      getEmailTemplate("email_receipt_body", "Hi {buyerName}, thank you for your purchase!\n\nYour support helps power the competition and makes a real difference. Below are your transaction details."),
      getEmailTemplate("email_receipt_footer", "If you have questions about this purchase, please contact us."),
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
        <td>Total</td>
        <td style="text-align: right;">${opts.total}</td>
      </tr>
    `;

    const contextLine = opts.competitionName
      ? `<p>Competition: <strong>${opts.competitionName}</strong>${opts.contestantName ? ` | Contestant: <strong>${opts.contestantName}</strong>` : ""}</p>`
      : "";

    const html = wrapInTemplate(`
      <h2>${applyPlaceholders(heading, vars)}</h2>
      <p>${applyPlaceholders(body, vars)}</p>
      ${contextLine}
      <table class="receipt">
        ${itemsHtml}
      </table>
      <p style="font-size: 13px; color: #888;">Transaction ID: ${opts.transactionId}</p>
      <p style="font-size: 13px; color: #888;">Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
      <p>${applyPlaceholders(footer, vars)}</p>
    `);

    await transporter.sendMail({
      from: `"${DISPLAY_NAME}" <${GMAIL_ADDRESS}>`,
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
      <h2>Test Email Successful!</h2>
      <p>This is a test email from <strong>HiFitComp</strong>.</p>
      <p>If you're reading this, your email system is working correctly.</p>
      <p style="color: #FF5A09; font-weight: bold;">All systems go!</p>
    `);

    await transporter.sendMail({
      from: `"${DISPLAY_NAME}" <${GMAIL_ADDRESS}>`,
      to,
      subject: "HiFitComp - Test Email",
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
      <p><strong>From:</strong> ${opts.name}</p>
      <p><strong>Email:</strong> ${opts.email}</p>
      ${opts.phone ? `<p><strong>Phone:</strong> ${opts.phone}</p>` : ""}
      <p><strong>Message:</strong></p>
      <p style="background:#111;padding:16px;border-left:4px solid #FF5A09;border-radius:4px;">${opts.message.replace(/\n/g, "<br/>")}</p>
    `);
    await transporter.sendMail({
      from: `"CB Publishing" <${GMAIL_ADDRESS}>`,
      to: GMAIL_ADDRESS,
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

export function isEmailConfigured(): boolean {
  const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  return !!(clientId && clientSecret && process.env.GMAIL_REFRESH_TOKEN);
}
