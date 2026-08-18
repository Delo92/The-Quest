import { readFileSync, existsSync } from "fs";

// Use the freshly-exchanged token from the temp file if available
const freshToken = existsSync("/tmp/gmail_refresh_token.txt")
  ? readFileSync("/tmp/gmail_refresh_token.txt", "utf8").trim()
  : null;
if (freshToken) {
  process.env.GMAIL_REFRESH_TOKEN = freshToken;
  console.log("  ℹ️  Using fresh token from /tmp/gmail_refresh_token.txt\n");
}

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Bootstrap firebase-admin so firestoreLivery works in email.ts
if (!getApps().length) {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa) {
    const parsed = typeof sa === "string" ? JSON.parse(sa) : sa;
    initializeApp({ credential: cert(parsed) });
  }
}

// Directly import the email functions
import {
  sendInviteEmail,
  sendNominationCongrats,
  sendNominationReceipt,
  sendPurchaseReceipt,
  sendVoteThankYou,
  sendApplicationApproved,
} from "../server/email";

const TO = "nbadelo@gmail.com";
const SITE = "https://cbpublishing.live";
const COMP = "CB Publishing Music 2026";
const TX = "TEST-" + Date.now();

async function main() {
  console.log(`\n📨  Sending all 6 email types to ${TO}\n`);

  const jobs: Array<{ label: string; fn: () => Promise<boolean> }> = [
    {
      label: "1/6  Welcome / Invite",
      fn: () =>
        sendInviteEmail({
          to: TO,
          inviterName: "The Quest Admin",
          role: "talent",
          siteUrl: SITE,
          nomineeName: "Sample Talent",
          nominatorName: "The Quest Admin",
          competitionName: COMP,
          defaultPassword: "CBP2026!",
          accountCreated: true,
        }),
    },
    {
      label: "2/6  Nomination Congrats (to nominee)",
      fn: () =>
        sendNominationCongrats({
          to: TO,
          nomineeName: "Sample Talent",
          nominatorName: "Jordan Smith",
          competitionName: COMP,
          siteUrl: SITE,
          defaultPassword: "CBP2026!",
          accountCreated: true,
        }),
    },
    {
      label: "3/6  Nomination Receipt (for nominator)",
      fn: () =>
        sendNominationReceipt({
          to: TO,
          nominatorName: "Jordan Smith",
          nomineeName: "Sample Talent",
          competitionName: COMP,
          amount: "$25.00",
          transactionId: TX,
          isFree: false,
        }),
    },
    {
      label: "4/6  Vote Pack Purchase Receipt",
      fn: () =>
        sendPurchaseReceipt({
          to: TO,
          buyerName: "Sample Buyer",
          items: [{ description: "Mega Pack — 50 Votes", amount: "$29.99" }],
          tax: "$2.40",
          total: "$32.39",
          transactionId: TX + "-V",
          competitionName: COMP,
          contestantName: "Sample Talent",
        }),
    },
    {
      label: "5/6  Vote Thank-You",
      fn: () =>
        sendVoteThankYou({
          to: TO,
          voterName: "Sample Voter",
          contestantName: "Sample Talent",
          competitionName: COMP,
          voteCount: 1,
          siteUrl: SITE,
        }),
    },
    {
      label: "6/6  Application Approved",
      fn: () =>
        sendApplicationApproved({
          to: TO,
          talentName: "Sample Talent",
          competitionName: COMP,
          siteUrl: SITE,
        }),
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const job of jobs) {
    process.stdout.write(`  ${job.label}... `);
    try {
      const ok = await job.fn();
      if (ok) {
        console.log("✅ sent");
        passed++;
      } else {
        console.log("⚠️  returned false");
        failed++;
      }
    } catch (err: any) {
      console.log(`❌ ERROR: ${err.message}`);
      failed++;
    }
    // Small delay to avoid Gmail rate-limiting
    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`  ✅ ${passed} sent   ❌ ${failed} failed`);
  console.log(`  Inbox: ${TO}`);
  console.log(`─────────────────────────────────────\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
