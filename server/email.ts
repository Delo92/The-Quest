import nodemailer from "nodemailer";
import { google } from "googleapis";
import { firestoreLivery } from "./firestore-collections";

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

export function resetTransporter() {
  cachedTransporter = null;
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
        <div class="credentials-box">
          <p class="cred-label">Your Login Credentials</p>
          <p class="cred-row">Email: <span class="cred-value">${opts.to}</span></p>
          <p class="cred-row">Temporary Password: <span class="cred-value">${opts.defaultPassword}</span></p>
          <p style="color:#555; font-size:12px; margin: 10px 0 0;">Change your password after your first login.</p>
        </div>`;
    }

    const html = wrapInTemplate(`
      <h2>${applyPlaceholders(heading, vars)}</h2>
      <p>${applyPlaceholders(body, vars)}</p>
      ${credentialBlock}
      <div class="btn-wrap">
        <a href="${actionUrl}" class="btn">${actionLabel}</a>
      </div>
      <p class="fallback-link">Or copy this link: <a href="${actionUrl}">${actionUrl}</a></p>
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

/* ─────────────────────────────────────────────────────────────────────────
   2. NOMINATION CONGRATS  (sent to the nominee specifically)
───────────────────────────────────────────────────────────────────────── */
export async function sendNominationCongrats(opts: {
  to: string;
  nomineeName: string;
  nominatorName: string;
  competitionName: string;
  siteUrl: string;
  defaultPassword?: string;
  accountCreated?: boolean;
}): Promise<boolean> {
  try {
    const transporter = await getTransporter();
    const loginUrl = `${opts.siteUrl}/login`;
    const compUrl = `${opts.siteUrl}/thequest/competitions`;

    let credentialBlock = "";
    if (opts.accountCreated && opts.defaultPassword) {
      credentialBlock = `
        <div class="credentials-box">
          <p class="cred-label">Your Account Has Been Created</p>
          <p class="cred-row">Email: <span class="cred-value">${opts.to}</span></p>
          <p class="cred-row">Temporary Password: <span class="cred-value">${opts.defaultPassword}</span></p>
          <p style="color:#555; font-size:12px; margin: 10px 0 0;">Log in and update your profile to build your fan base!</p>
        </div>`;
    }

    const html = wrapInTemplate(`
      <div style="text-align:center; margin-bottom: 28px;">
        <span class="badge">Nomination Confirmed</span>
      </div>
      <h2 style="text-align:center;">Congratulations, ${opts.nomineeName}!</h2>
      <p style="text-align:center; font-size:17px; color:#ccc;">
        <strong style="color:#FF5A09;">${opts.nominatorName}</strong> has nominated you to compete in:
      </p>
      <div class="highlight-box" style="text-align:center;">
        <p class="label">Competition</p>
        <p class="value">${opts.competitionName}</p>
      </div>
      <p>You're officially in the running! The public will vote for their favorite — share your profile link with friends, family, and fans to drive votes your way.</p>
      ${credentialBlock}
      <div class="btn-wrap">
        <a href="${loginUrl}" class="btn">Log In &amp; Update Your Profile</a>
      </div>
      <p class="fallback-link">View all competitions: <a href="${compUrl}">${compUrl}</a></p>
      <hr class="divider" />
      <p style="font-size:13px; color:#555;">Share this on social media and tell your fans to VOTE for you! Every vote counts toward your ranking.</p>
    `);

    await transporter.sendMail({
      from: `"${DISPLAY_NAME}" <${GMAIL_ADDRESS}>`,
      to: opts.to,
      subject: `🏆 You've Been Nominated — ${opts.competitionName} | The Quest`,
      html,
    });

    console.log(`Nomination congrats email sent to ${opts.to}`);
    return true;
  } catch (err: any) {
    console.error("Failed to send nomination congrats email:", err.message);
    resetTransporter();
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   3. NOMINATION RECEIPT  (sent to the nominator who paid)
───────────────────────────────────────────────────────────────────────── */
export async function sendNominationReceipt(opts: {
  to: string;
  nominatorName: string;
  nomineeName: string;
  competitionName: string;
  amount: string;
  transactionId?: string;
  isFree?: boolean;
}): Promise<boolean> {
  try {
    const transporter = await getTransporter();

    const amountDisplay = opts.isFree ? "Free" : opts.amount;
    const txLine = opts.transactionId
      ? `<p style="font-size:13px; color:#555; margin-top:16px;">Transaction ID: ${opts.transactionId}</p>`
      : "";

    const html = wrapInTemplate(`
      <div style="text-align:center; margin-bottom: 28px;">
        <span class="badge">Nomination Receipt</span>
      </div>
      <h2>Nomination Submitted!</h2>
      <p>Hi <strong style="color:#fff;">${opts.nominatorName}</strong>, thank you for nominating someone to The Quest. Your submission has been received and the nominee has been notified.</p>

      <div class="highlight-box">
        <p class="label">Nominee</p>
        <p class="value">${opts.nomineeName}</p>
      </div>
      <div class="highlight-box">
        <p class="label">Competition</p>
        <p class="value">${opts.competitionName}</p>
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
      from: `"${DISPLAY_NAME}" <${GMAIL_ADDRESS}>`,
      to: opts.to,
      subject: `Your Nomination Receipt — ${opts.nomineeName} | The Quest`,
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
   4. VOTE PURCHASE RECEIPT  (sent to the buyer after buying vote packs)
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
      getEmailTemplate("email_receipt_subject", "Your The Quest Purchase Receipt"),
      getEmailTemplate("email_receipt_heading", "Vote Pack Receipt"),
      getEmailTemplate("email_receipt_body", "Hi {buyerName}, thank you for your purchase!\n\nYour votes have been applied and are now live. Below are your transaction details."),
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
        <span class="badge">Purchase Confirmed</span>
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

      <p>Want to do more? Share the competition with friends and get more people to vote. You can also purchase additional votes to give your favorite an extra boost!</p>

      <div class="btn-wrap">
        <a href="${compUrl}" class="btn">See the Leaderboard</a>
      </div>
      <hr class="divider" />
      <p style="font-size:13px; color:#555;">You receive 1 free vote per competition per day. Come back tomorrow to vote again!</p>
    `);

    await transporter.sendMail({
      from: `"${DISPLAY_NAME}" <${GMAIL_ADDRESS}>`,
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
          ✅ &nbsp;Ask your supporters to vote every day (1 free vote/day)<br/>
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
      from: `"${DISPLAY_NAME}" <${GMAIL_ADDRESS}>`,
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
      from: `"${DISPLAY_NAME}" <${GMAIL_ADDRESS}>`,
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
