import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";

const CONTACT = "info@cbpublishing.live";

const sections: Array<{ title: string; body: string[] }> = [
  {
    title: "What we collect",
    body: [
      "Account details: your name, email address, and login. Passwords are handled by Google Firebase Authentication and are never visible to us.",
      "Profile content you choose to add: stage name, photos, videos, bio, social links, and your competition entries.",
      "Purchases and votes: the competition, contestant, amount, and the email you entered at checkout. Card numbers go directly to our payment processors (Stripe, PayPal, Authorize.net) and are not stored by The Quest.",
      "Payout and tax information for hosts and talent who are paid through The Quest, such as a W-9. This is stored encrypted and is visible only to authorized administrators.",
      "Optional phone number and text-message consent, if you provide them.",
      "Basic usage and device information, such as pages viewed and error reports, to keep the service secure and working.",
    ],
  },
  {
    title: "How we use it",
    body: [
      "To run competitions, count votes, process purchases and payouts, show profiles, and send account and purchase emails.",
      "To prevent fraud and abuse, and to meet tax and legal obligations.",
      "To send marketing messages only where you agreed to receive them. You can opt out at any time.",
      "We do not sell your personal information and we do not track you across other companies' apps or websites.",
    ],
  },
  {
    title: "Who we share it with",
    body: [
      "Service providers that operate The Quest on our behalf: Google (Firebase, Analytics), Vimeo (video hosting), Stripe, PayPal and Authorize.net (payments), and email providers. They may use your data only to provide their service.",
      "Public profile content, such as your stage name, photos, and videos, is visible to visitors of the competition you entered.",
      "Authorities, when the law requires it.",
    ],
  },
  {
    title: "Your choices and deleting your account",
    body: [
      "You can edit your profile in your dashboard at any time.",
      "You can delete your account yourself at cbpublishing.live/thequest/delete-account, or from account settings. Deleting removes your login, profile, and competition entries. Records we must keep for payments, taxes, or fraud prevention may be retained as required by law.",
      `Host and admin accounts are deleted on request. Email ${CONTACT}.`,
    ],
  },
  {
    title: "Children",
    body: ["The Quest is not intended for children under 13, and we do not knowingly collect their information."],
  },
  {
    title: "Contact",
    body: [`Questions about this policy or your data: ${CONTACT}.`],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-[100dvh] bg-[#111113] text-white">
      <SiteNavbar />
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-32">
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-white/50">The Quest by CB Publishing</p>
        {sections.map((section) => (
          <section key={section.title} className="mt-8">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <ul className="mt-3 space-y-3 text-sm leading-relaxed text-white/70">
              {section.body.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}
