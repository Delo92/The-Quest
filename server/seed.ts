import { storage } from "./storage";
import {
  getFirebaseAuth,
  createFirebaseUser,
  setUserLevel,
  getFirestoreUser,
  createFirestoreUser,
  getFirebaseAdmin,
} from "./firebase-admin";
import {
  firestoreCategories,
  firestoreVotePackages,
  firestoreSettings,
  firestoreLivery,
  firestoreJoinSettings,
} from "./firestore-collections";

export async function seedDatabase() {
  const comps = await storage.getCompetitions();
  if (comps.length > 0) return;

  const systemUid = "seed-system-user";
  let systemUser = await getFirestoreUser(systemUid);
  if (!systemUser) {
    systemUser = await createFirestoreUser({
      uid: systemUid,
      email: "system@thequest.com",
      displayName: "System",
      level: 1,
    });
  }

  const compData = [
    {
      title: "Star Search 2026 - Music Edition",
      description: "The ultimate singing and music performance competition. Show the world your vocal talent and stage presence. Open to all genres including R&B, pop, hip-hop, rock, and more.",
      category: "Music",
      coverImage: "/images/template/bg-1.jpg",
      status: "active",
      voteCost: 0,
      maxVotesPerDay: 10,
      startDate: "2026-02-01T00:00:00.000Z",
      endDate: "2026-04-30T00:00:00.000Z",
      createdAt: new Date().toISOString(),
      createdBy: null,
    },
    {
      title: "Iron Physique Championship",
      description: "The premier bodybuilding competition showcasing the best physiques. Categories include Classic Physique, Men's Open, and Women's Fitness.",
      category: "Bodybuilding",
      coverImage: "/images/template/breadcumb3.jpg",
      status: "active",
      voteCost: 0,
      maxVotesPerDay: 5,
      startDate: "2026-02-15T00:00:00.000Z",
      endDate: "2026-05-15T00:00:00.000Z",
      createdAt: new Date().toISOString(),
      createdBy: null,
    },
    {
      title: "Top Model Search",
      description: "Are you the next top model? Show off your runway walk, photogenic qualities, and unique style in this nationwide modeling competition.",
      category: "Modeling",
      coverImage: "/images/template/breadcumb.jpg",
      status: "active",
      voteCost: 0,
      maxVotesPerDay: 10,
      startDate: "2026-03-01T00:00:00.000Z",
      endDate: "2026-06-01T00:00:00.000Z",
      createdAt: new Date().toISOString(),
      createdBy: null,
    },
    {
      title: "Dance Battle Royale",
      description: "Bring your best moves to the biggest dance competition of the year. All styles welcome: hip-hop, contemporary, breakdancing, and more.",
      category: "Dance",
      coverImage: "/images/template/breadcumb2.jpg",
      status: "voting",
      voteCost: 0,
      maxVotesPerDay: 15,
      startDate: "2026-01-15T00:00:00.000Z",
      endDate: "2026-03-30T00:00:00.000Z",
      createdAt: new Date().toISOString(),
      createdBy: null,
    },
  ];

  const compsCreated = [];
  for (const c of compData) {
    const comp = await storage.createCompetition(c);
    compsCreated.push(comp);
  }

  console.log("Database seeded successfully with competitions (all in Firestore)");
}

const LIVERY_DEFAULTS = [
  { imageKey: "logo", label: "Site Logo", defaultUrl: "/images/template/logo.png" },
  { imageKey: "site_favicon", label: "Site Favicon (Browser Tab Icon)", defaultUrl: "/images/template/favicon.jpeg" },
  { imageKey: "hero_background", label: "Hero Background (Landing)", defaultUrl: "/images/template/bg-1.jpg" },
  { imageKey: "feature_background", label: "Feature Section Background (Landing)", defaultUrl: "/images/template/bg-2.jpg" },
  { imageKey: "cta_background", label: "Call to Action Background (Landing)", defaultUrl: "/images/template/breadcumb.jpg" },
  { imageKey: "breadcrumb_bg", label: "Page Header Background (Login, Join, Host, Checkout, Purchases)", defaultUrl: "/images/template/breadcumb.jpg" },
  { imageKey: "competitions_header", label: "Competitions Page Header", defaultUrl: "/images/template/breadcumb2.jpg" },
  { imageKey: "competition_detail_header", label: "Competition Detail Header", defaultUrl: "/images/template/breadcumb3.jpg" },
  { imageKey: "competition_card_fallback", label: "Default Competition Card Image", defaultUrl: "/images/template/e1.jpg" },
  { imageKey: "talent_profile_fallback", label: "Default Talent Profile Image", defaultUrl: "/images/template/a1.jpg" },
  { imageKey: "hero_title_top", label: "Hero Title - Top Line (e.g. 'The Ultimate')", defaultUrl: "", itemType: "text" as const, defaultText: "The Ultimate" },
  { imageKey: "hero_title_main", label: "Hero Title - Main Heading (e.g. 'Talent Platform')", defaultUrl: "", itemType: "text" as const, defaultText: "Talent Platform" },
  { imageKey: "hiw_section_title", label: "How It Works - Section Title", defaultUrl: "", itemType: "text" as const, defaultText: "How It Works" },
  { imageKey: "hiw_step1_title", label: "How It Works - Step 1 Title", defaultUrl: "", itemType: "text" as const, defaultText: "Create Your Profile" },
  { imageKey: "hiw_step1_desc", label: "Step 1: Create Your Profile", defaultUrl: "", itemType: "text" as const, defaultText: "Sign up, set up your talent profile with photos, videos, and bio. Make it stand out." },
  { imageKey: "hiw_step2_title", label: "How It Works - Step 2 Title", defaultUrl: "", itemType: "text" as const, defaultText: "Apply to Compete" },
  { imageKey: "hiw_step2_desc", label: "Step 2: Apply to Compete", defaultUrl: "", itemType: "text" as const, defaultText: "Browse active competitions and apply to the ones that match your talent and goals." },
  { imageKey: "hiw_step3_title", label: "How It Works - Step 3 Title", defaultUrl: "", itemType: "text" as const, defaultText: "Win Public Votes" },
  { imageKey: "hiw_step3_desc", label: "Step 3: Win Public Votes", defaultUrl: "", itemType: "text" as const, defaultText: "Once approved, share your profile. The contestant with the most votes wins the crown." },
  { imageKey: "why_subtitle", label: "Why The Quest - Subtitle", defaultUrl: "", itemType: "text" as const, defaultText: "See what's new" },
  { imageKey: "why_heading", label: "Why The Quest - Section Heading", defaultUrl: "", itemType: "text" as const, defaultText: "Why The Quest" },
  { imageKey: "why_card1_title", label: "Why The Quest - Card 1 Title", defaultUrl: "", itemType: "text" as const, defaultText: "Any Competition" },
  { imageKey: "why_card1_desc", label: "Why The Quest - Card 1 Description", defaultUrl: "", itemType: "text" as const, defaultText: "Music, modeling, bodybuilding, dance, art -- create or join competitions in any talent category imaginable." },
  { imageKey: "why_card2_title", label: "Why The Quest - Card 2 Title", defaultUrl: "", itemType: "text" as const, defaultText: "Public Voting" },
  { imageKey: "why_card2_desc", label: "Why The Quest - Card 2 Description", defaultUrl: "", itemType: "text" as const, defaultText: "Fair, transparent voting. The public decides who wins with configurable vote limits and pricing per competition." },
  { imageKey: "why_card3_title", label: "Why The Quest - Card 3 Title", defaultUrl: "", itemType: "text" as const, defaultText: "Rich Profiles" },
  { imageKey: "why_card3_desc", label: "Why The Quest - Card 3 Description", defaultUrl: "", itemType: "text" as const, defaultText: "Upload photos, videos, share your bio and social links. Build a stunning profile that shows the world your talent." },
  { imageKey: "how_voting_works", label: "How Voting Works", defaultUrl: "", itemType: "text" as const, defaultText: "Every visitor gets a set amount of FREE votes daily — but fans can purchase additional votes to show extra love.\n\n**How it works:**\n1. Browse active competitions and find your favorite contestants.\n2. Click the Vote button on any contestant's profile.\n3. Use your free daily votes or purchase extra vote packs.\n4. Votes are tallied in real-time and displayed on the leaderboard.\n5. The contestant with the most votes at the end wins!\n\n**Vote Limits:**\n- Free votes reset daily based on each competition's settings.\n- Purchased votes never expire and can be used anytime during the competition.\n- In-person votes from QR codes count separately.\n\n**Fair Play:**\nWe track votes by IP address and account to prevent abuse. Any suspicious activity may result in vote removal." },
  { imageKey: "how_nominations_work", label: "How Nominations Work", defaultUrl: "", itemType: "text" as const, defaultText: "Know someone who deserves the spotlight? Nominate them!\n\n**How it works:**\n1. Click the Nominate button on the home page or navbar.\n2. Fill out the nomination form with the nominee's details.\n3. Optionally upload a photo of the nominee.\n4. Submit your nomination for review.\n\n**What happens next:**\n- Our team reviews every nomination.\n- Approved nominees are added to the appropriate competition.\n- The nominee will be notified and can claim their profile.\n\n**Who can be nominated:**\n- Anyone aged 16+ (under 18 requires parental permission).\n- Individuals, duos, bands, and groups.\n- Must be a U.S. resident.\n\n**Tips for a great nomination:**\n- Include a clear, high-quality photo.\n- Provide accurate contact information.\n- Explain why they deserve to compete!" },
  { imageKey: "hero_summary", label: "Hero Summary / Instructions", defaultUrl: "", itemType: "text" as const, defaultText: "Welcome to HiFitComp — the ultimate talent competition platform. Browse competitions, vote for your favorites, join as a competitor, or host your own event. Get started today!" },
  { imageKey: "about_rules_text", label: "About Page - Rules & Guidelines (Summary)", defaultUrl: "", itemType: "text" as const, defaultText: "Welcome to HiFitComp! Our platform connects talent with audiences through fair, transparent competitions.\n\n**Rules & Guidelines:**\n\n1. All participants must be 18 years or older.\n2. Each competitor may only enter a competition once.\n3. Voting is limited per IP address daily to ensure fairness.\n4. Content must be original and appropriate for all audiences.\n5. Hosts are responsible for managing their events and enforcing rules.\n6. Vote purchases are non-refundable once processed.\n7. HiFitComp reserves the right to remove content that violates community standards." },
  { imageKey: "about_details_text", label: "About Page - Full Details (Fine Print)", defaultUrl: "", itemType: "text" as const, defaultText: "**Terms of Use:**\n\nBy using HiFitComp, you agree to the following terms and conditions:\n\n**Eligibility:**\n- Participants must be at least 18 years of age.\n- Each person may only create one account.\n- Providing false information may result in account termination.\n\n**Voting Policy:**\n- Free votes are limited per day per IP address.\n- Purchased votes are non-refundable.\n- Any attempt to manipulate voting through bots, scripts, or other automated means will result in disqualification.\n- HiFitComp reserves the right to void suspicious votes.\n\n**Content Guidelines:**\n- All submitted content must be original or properly licensed.\n- Content must not contain nudity, violence, hate speech, or illegal activity.\n- HiFitComp reserves the right to remove content at its sole discretion.\n\n**Competition Rules:**\n- Hosts set the rules for their individual competitions within HiFitComp guidelines.\n- Competition results are final once the voting period ends.\n- Ties will be resolved at the host's discretion.\n\n**Liability:**\n- HiFitComp is not responsible for technical issues that may affect voting.\n- We are not liable for disputes between hosts, participants, or voters.\n- All fees and charges are subject to change with notice.\n\n**Privacy:**\n- We collect and store personal information as outlined in our privacy practices.\n- We do not sell personal information to third parties.\n- Users may request deletion of their data by contacting support." },
  { imageKey: "social_facebook", label: "Social - Facebook URL", defaultUrl: "", itemType: "text" as const, defaultText: "" },
  { imageKey: "social_instagram", label: "Social - Instagram URL", defaultUrl: "", itemType: "text" as const, defaultText: "" },
  { imageKey: "social_twitter", label: "Social - X / Twitter URL", defaultUrl: "", itemType: "text" as const, defaultText: "" },
  { imageKey: "social_youtube", label: "Social - YouTube URL", defaultUrl: "", itemType: "text" as const, defaultText: "" },
  { imageKey: "social_tiktok", label: "Social - TikTok URL", defaultUrl: "", itemType: "text" as const, defaultText: "" },
  { imageKey: "contact_email", label: "Contact Email", defaultUrl: "", itemType: "text" as const, defaultText: "admin@thequest.com" },
  { imageKey: "contact_phone", label: "Contact Phone", defaultUrl: "", itemType: "text" as const, defaultText: "" },
  { imageKey: "contact_address", label: "Contact Address", defaultUrl: "", itemType: "text" as const, defaultText: "" },
  { imageKey: "faq_1_q", label: "FAQ 1 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "Do nominees need to live in Hawaii to participate?" },
  { imageKey: "faq_1_a", label: "FAQ 1 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "No. The HI FIT Competition is a national platform, and nominees may be located anywhere within the United States. Individuals, brands, and businesses from any state are welcome to be nominated and compete." },
  { imageKey: "faq_2_q", label: "FAQ 2 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "Can only Hawaii residents vote in the competition?" },
  { imageKey: "faq_2_a", label: "FAQ 2 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "No. Voting is open nationally, and supporters may participate from anywhere. Nominees are encouraged to rally votes from friends, fans, customers, and communities across the country." },
  { imageKey: "faq_3_q", label: "FAQ 3 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "How many free votes can I cast?" },
  { imageKey: "faq_3_a", label: "FAQ 3 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "Each participant may cast one free vote per category per day. This allows supporters to consistently show encouragement throughout the competition." },
  { imageKey: "faq_4_q", label: "FAQ 4 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "Can additional votes be purchased?" },
  { imageKey: "faq_4_a", label: "FAQ 4 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "Yes. Vote packages are available for those who wish to show extra support. There is no limit to the number of votes that may be purchased." },
  { imageKey: "faq_5_q", label: "FAQ 5 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "Is there a limit on how often I can vote?" },
  { imageKey: "faq_5_a", label: "FAQ 5 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "Free votes reset daily, and participants may return each day to support their favorites. Purchased votes may be submitted at any time." },
  { imageKey: "faq_6_q", label: "FAQ 6 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "When does voting end?" },
  { imageKey: "faq_6_a", label: "FAQ 6 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "Voting remains open until the week prior to the HI FIT Expo. The official closing date will be announced in advance, and categories will then be locked." },
  { imageKey: "faq_7_q", label: "FAQ 7 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "What happens after voting closes?" },
  { imageKey: "faq_7_a", label: "FAQ 7 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "The top three highest-voted nominees in each category will be notified of their finalist status. Winners are announced live during the HI FIT Expo Award Show." },
  { imageKey: "faq_8_q", label: "FAQ 8 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "Do finalists need to attend the HI FIT Expo?" },
  { imageKey: "faq_8_a", label: "FAQ 8 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "While attendance is not mandatory, finalists are strongly encouraged to attend the Award Show for recognition and celebration. Certain prizes and media opportunities may require presence at the event." },
  { imageKey: "faq_9_q", label: "FAQ 9 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "What is the nomination fee?" },
  { imageKey: "faq_9_a", label: "FAQ 9 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "The nomination fee is $5 per submission. This fee helps support platform operations, promotional visibility, and competition administration." },
  { imageKey: "faq_10_q", label: "FAQ 10 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "Who can submit a nomination?" },
  { imageKey: "faq_10_a", label: "FAQ 10 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "Anyone may nominate a deserving individual, brand, or business. Nominators simply complete the nomination form and provide basic information about the nominee." },
  { imageKey: "faq_11_q", label: "FAQ 11 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "Can someone be nominated more than once?" },
  { imageKey: "faq_11_a", label: "FAQ 11 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "Each nominee may only be entered once per category to ensure fairness. Duplicate submissions may be reviewed or removed." },
  { imageKey: "faq_12_q", label: "FAQ 12 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "How will nominees be notified?" },
  { imageKey: "faq_12_a", label: "FAQ 12 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "Nominees receive an automatic email notification once their nomination is completed. This email includes instructions for completing their competition profile." },
  { imageKey: "faq_13_q", label: "FAQ 13 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "What can nominees upload to their profile?" },
  { imageKey: "faq_13_a", label: "FAQ 13 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "Nominees may upload 1–10 photos and up to 4 videos to represent themselves, their achievements, or their brand." },
  { imageKey: "faq_14_q", label: "FAQ 14 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "Can nominees promote their participation?" },
  { imageKey: "faq_14_a", label: "FAQ 14 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "Absolutely. Nominees are encouraged to share their competition page and official marketing flyer across social media and networks to gain support." },
  { imageKey: "faq_15_q", label: "FAQ 15 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "How does the non-profit sponsorship work?" },
  { imageKey: "faq_15_a", label: "FAQ 15 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "Each nominee selects a non-profit organization they wish to sponsor. Winning nominees help generate contributions and awareness for their chosen cause." },
  { imageKey: "faq_16_q", label: "FAQ 16 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "Is voting secure and monitored?" },
  { imageKey: "faq_16_a", label: "FAQ 16 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "Yes. The competition platform tracks voting activity to ensure fairness and integrity. Any suspicious or abusive activity may be reviewed." },
  { imageKey: "faq_17_q", label: "FAQ 17 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "Are nomination or voting fees refundable?" },
  { imageKey: "faq_17_a", label: "FAQ 17 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "All fees are final. Due to the nature of digital competition systems and promotional visibility, payments are non-refundable." },
  { imageKey: "faq_18_q", label: "FAQ 18 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "How are winners determined?" },
  { imageKey: "faq_18_a", label: "FAQ 18 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "Winners are determined by total votes accumulated within each category during the official voting period." },
  { imageKey: "faq_19_q", label: "FAQ 19 - Question", defaultUrl: "", itemType: "text" as const, defaultText: "How can I increase my nominee's chances of winning?" },
  { imageKey: "faq_19_a", label: "FAQ 19 - Answer", defaultUrl: "", itemType: "text" as const, defaultText: "Consistent daily voting, social sharing, community engagement, and supporter participation all play a major role in competition success." },
  { imageKey: "email_welcome_subject", label: "Welcome Email - Subject Line", defaultUrl: "", itemType: "text" as const, defaultText: "{inviterName} invited you to join HiFitComp!" },
  { imageKey: "email_welcome_heading", label: "Welcome Email - Heading", defaultUrl: "", itemType: "text" as const, defaultText: "You've Been Invited!" },
  { imageKey: "email_welcome_body", label: "Welcome Email - Body", defaultUrl: "", itemType: "text" as const, defaultText: "{inviterName} has invited you to join HiFitComp as a {role}.\n\nHiFitComp is Hawaii's premier live talent competition platform where artists, models, bodybuilders, and performers compete for public votes.\n\nClick the button below to accept your invitation and get started!" },
  { imageKey: "email_receipt_subject", label: "Purchase Receipt Email - Subject Line", defaultUrl: "", itemType: "text" as const, defaultText: "Your HiFitComp Purchase Receipt" },
  { imageKey: "email_receipt_heading", label: "Purchase Receipt Email - Heading", defaultUrl: "", itemType: "text" as const, defaultText: "Purchase Receipt" },
  { imageKey: "email_receipt_body", label: "Purchase Receipt Email - Body", defaultUrl: "", itemType: "text" as const, defaultText: "Hi {buyerName}, thank you for your purchase!\n\nYour support helps power the competition and makes a real difference. Below are your transaction details." },
  { imageKey: "email_receipt_footer", label: "Purchase Receipt Email - Footer Note", defaultUrl: "", itemType: "text" as const, defaultText: "If you have questions about this purchase, please contact us." },
  { imageKey: "home_banner_bg", label: "Home Page - Hero Background Image", defaultUrl: "/images/template/bg-1.jpg" },
  { imageKey: "home_feature_1", label: "Home Page - Feature Image 1", defaultUrl: "/images/template/breadcumb.jpg" },
  { imageKey: "home_feature_2", label: "Home Page - Feature Image 2", defaultUrl: "/images/template/breadcumb2.jpg" },
  { imageKey: "home_feature_3", label: "Home Page - Feature Image 3", defaultUrl: "/images/template/breadcumb3.jpg" },
  { imageKey: "home_feature_4", label: "Home Page - Feature Image 4", defaultUrl: "/images/template/bg-1.jpg" },
  { imageKey: "home_feature_5", label: "Home Page - Feature Image 5", defaultUrl: "/images/template/bg-2.jpg" },
  { imageKey: "home_about_img", label: "Home Page - About Section Image", defaultUrl: "/images/template/bg-2.jpg" },
  { imageKey: "home_service_bg", label: "Home Page - Services Section Background", defaultUrl: "/images/template/breadcumb.jpg" },
  { imageKey: "home_member_bg", label: "Home Page - Join Section Background", defaultUrl: "/images/template/bg-1.jpg" },
  { imageKey: "home_hero_title", label: "Home Page - Hero Title", defaultUrl: "", itemType: "text" as const, defaultText: "CB Publishing" },
  { imageKey: "home_hero_subtitle", label: "Home Page - Hero Subtitle", defaultUrl: "", itemType: "text" as const, defaultText: "Entertainment. Competition. Community." },
  { imageKey: "home_quote_left", label: "Home Page - Quote (Left Side)", defaultUrl: "", itemType: "text" as const, defaultText: "Music gives soul to the universe, wings to the mind, flight to the imagination." },
  { imageKey: "home_quote_body", label: "Home Page - Quote Body (Right Side)", defaultUrl: "", itemType: "text" as const, defaultText: "CB Publishing is a creative entertainment company focused on building platforms that connect artists, performers, and audiences. From competition platforms to music promotion, we're building the future of entertainment." },
  { imageKey: "home_feature_1_title", label: "Home Page - Feature 1 Title", defaultUrl: "", itemType: "text" as const, defaultText: "The Quest Finals" },
  { imageKey: "home_feature_1_subtitle", label: "Home Page - Feature 1 Subtitle", defaultUrl: "", itemType: "text" as const, defaultText: "Live competition event" },
  { imageKey: "home_feature_2_title", label: "Home Page - Feature 2 Title", defaultUrl: "", itemType: "text" as const, defaultText: "Music Showcase" },
  { imageKey: "home_feature_2_subtitle", label: "Home Page - Feature 2 Subtitle", defaultUrl: "", itemType: "text" as const, defaultText: "Artists on stage" },
  { imageKey: "home_feature_3_title", label: "Home Page - Feature 3 Title", defaultUrl: "", itemType: "text" as const, defaultText: "Talent Awards" },
  { imageKey: "home_feature_3_subtitle", label: "Home Page - Feature 3 Subtitle", defaultUrl: "", itemType: "text" as const, defaultText: "Celebrating excellence" },
  { imageKey: "home_feature_4_title", label: "Home Page - Feature 4 Title", defaultUrl: "", itemType: "text" as const, defaultText: "Be Unique" },
  { imageKey: "home_feature_4_subtitle", label: "Home Page - Feature 4 Subtitle", defaultUrl: "", itemType: "text" as const, defaultText: "Express your talent" },
  { imageKey: "home_feature_5_title", label: "Home Page - Feature 5 Title", defaultUrl: "", itemType: "text" as const, defaultText: "Rise to the Top" },
  { imageKey: "home_feature_5_subtitle", label: "Home Page - Feature 5 Subtitle", defaultUrl: "", itemType: "text" as const, defaultText: "Compete and win" },
  { imageKey: "home_about_title", label: "Home Page - About Title", defaultUrl: "", itemType: "text" as const, defaultText: "About CB Publishing" },
  { imageKey: "home_about_body", label: "Home Page - About Body Text", defaultUrl: "", itemType: "text" as const, defaultText: "CB Publishing is an independent entertainment and digital media company. We specialize in creating competition platforms, music promotion, and event management tools that empower artists and audiences alike.\n\nOur properties include The Quest — an online talent competition and voting platform — and more exciting projects in development." },
];

export async function seedLivery() {
  const existing = await firestoreLivery.getAll();
  const existingKeys = new Set(existing.map((l) => l.imageKey));

  const validKeys = new Set(LIVERY_DEFAULTS.map((l) => l.imageKey));

  for (const item of LIVERY_DEFAULTS) {
    if (!existingKeys.has(item.imageKey)) {
      await firestoreLivery.upsert({ ...item, imageUrl: null });
    } else {
      const existingItem = existing.find((e) => e.imageKey === item.imageKey);
      if (existingItem && existingItem.label !== item.label) {
        await firestoreLivery.upsert({ ...existingItem, label: item.label });
      }
    }
  }

  for (const item of existing) {
    if (!validKeys.has(item.imageKey)) {
      await firestoreLivery.delete(item.imageKey);
    }
  }
  console.log(`Livery seeded: ${LIVERY_DEFAULTS.length} slots configured (Firestore)`);
}

const DEFAULT_CATEGORIES = [
  { name: "Music", description: "Singing, rapping, DJing, and all musical performances", imageUrl: "/images/template/a1.jpg", order: 1, isActive: true },
  { name: "Modeling", description: "Fashion, runway, commercial, and fitness modeling", imageUrl: "/images/template/a2.jpg", order: 2, isActive: true },
  { name: "Bodybuilding", description: "Classic physique, men's open, women's fitness, and athletic physique", imageUrl: "/images/template/b1.jpg", order: 3, isActive: true },
  { name: "Dance", description: "Hip-hop, contemporary, breakdancing, ballroom, and all dance styles", imageUrl: "/images/template/a4.jpg", order: 4, isActive: true },
  { name: "Comedy", description: "Stand-up, sketch, improv, and comedic performances", imageUrl: "/images/template/e1.jpg", order: 5, isActive: true },
  { name: "Acting", description: "Dramatic, comedic, and theatrical acting performances", imageUrl: "/images/template/e2.jpg", order: 6, isActive: true },
];

export async function seedCategories() {
  const existing = await firestoreCategories.getAll();
  if (existing.length > 0) return;

  for (const cat of DEFAULT_CATEGORIES) {
    await firestoreCategories.create(cat);
  }
  console.log(`Categories seeded: ${DEFAULT_CATEGORIES.length} categories (Firestore)`);
}

const DEFAULT_VOTE_PACKAGES = [
  { name: "Starter Pack", description: "500 votes to support your favorite", voteCount: 500, bonusVotes: 0, price: 1000, isActive: true, order: 1 },
  { name: "Fan Pack", description: "1,000 votes + 300 bonus votes", voteCount: 1000, bonusVotes: 300, price: 1500, isActive: true, order: 2 },
  { name: "Super Fan Pack", description: "2,000 votes + 600 bonus votes", voteCount: 2000, bonusVotes: 600, price: 3000, isActive: true, order: 3 },
];

export async function seedVotePackages() {
  const existing = await firestoreVotePackages.getAll();
  if (existing.length > 0) return;

  for (const pkg of DEFAULT_VOTE_PACKAGES) {
    await firestoreVotePackages.create(pkg);
  }
  console.log(`Vote packages seeded: ${DEFAULT_VOTE_PACKAGES.length} packages (Firestore)`);
}

export async function seedSettings() {
  const existing = await firestoreSettings.get();
  if (existing) return;

  await firestoreSettings.update({
    siteName: "The Quest",
    siteDescription: "Competition & Voting Platform",
    contactEmail: "admin@thequest.com",
    defaultVoteCost: 0,
    defaultMaxVotesPerDay: 10,
  });
  console.log("Settings seeded (Firestore)");
}

export async function seedJoinTitle() {
  const current = await firestoreJoinSettings.get();
  if (current && current.pageTitle === "JOIN A COMPETITION") {
    await firestoreJoinSettings.update({ pageTitle: "NOMINATE NOW" });
    console.log("Join page title updated to NOMINATE NOW");
  }
}

const TEST_ACCOUNTS = [
  {
    email: "viewer@test.com",
    password: "TestPass123",
    displayName: "Test Viewer",
    level: 1,
    role: "viewer" as const,
  },
  {
    email: "talent@test.com",
    password: "TestPass123",
    displayName: "Test Talent",
    stageName: "The Star",
    level: 2,
    role: "talent" as const,
    socialLinks: {
      instagram: "https://instagram.com/testtalent",
      twitter: "https://twitter.com/testtalent",
      tiktok: "https://tiktok.com/@testtalent",
    },
  },
  {
    email: "host@test.com",
    password: "TestPass123",
    displayName: "Test Host",
    level: 3,
    role: "host" as const,
  },
  {
    email: "admin@test.com",
    password: "TestPass123",
    displayName: "Test Admin",
    level: 4,
    role: "admin" as const,
  },
];

export async function seedTestAccounts() {
  try {
    getFirebaseAdmin();
  } catch {
    console.log("Firebase not configured, skipping test account seeding");
    return;
  }

  const auth = getFirebaseAuth();

  for (const account of TEST_ACCOUNTS) {
    try {
      let firebaseUser;
      try {
        firebaseUser = await auth.getUserByEmail(account.email);
        console.log(`Test account ${account.email} already exists (uid: ${firebaseUser.uid})`);
      } catch (err: any) {
        if (err.code === "auth/user-not-found") {
          firebaseUser = await createFirebaseUser(account.email, account.password, account.displayName);
          console.log(`Created test account: ${account.email} (uid: ${firebaseUser.uid})`);
        } else {
          throw err;
        }
      }

      await setUserLevel(firebaseUser.uid, account.level);

      let firestoreUser = await getFirestoreUser(firebaseUser.uid);
      if (!firestoreUser) {
        const firestoreData: any = {
          uid: firebaseUser.uid,
          email: account.email,
          displayName: account.displayName,
          level: account.level,
        };
        if ("stageName" in account) firestoreData.stageName = account.stageName;
        if ("socialLinks" in account) firestoreData.socialLinks = account.socialLinks;
        await createFirestoreUser(firestoreData);
      }

      if (account.level >= 2) {
        const existingProfile = await storage.getTalentProfileByUserId(firebaseUser.uid);
        if (!existingProfile) {
          await storage.createTalentProfile({
            userId: firebaseUser.uid,
            displayName: account.displayName,
            stageName: "stageName" in account ? account.stageName || null : null,
            bio: account.level === 3 ? "Platform administrator" : "Test talent profile",
            category: account.level === 2 ? "Music" : null,
            location: null,
            imageUrls: [],
            videoUrls: [],
            socialLinks: "socialLinks" in account ? JSON.stringify(account.socialLinks) : null,
            role: account.role,
          });
        }
      }

      console.log(`Test account ${account.email} seeded at level ${account.level} (${account.role})`);
    } catch (error: any) {
      console.error(`Failed to seed test account ${account.email}:`, error.message);
    }
  }
}
