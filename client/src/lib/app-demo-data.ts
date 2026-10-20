import { buildDemoEarnings, demoArtistNonprofitDeclaration, demoHostNonprofitDeclaration } from "./app-demo-finances";

const demoImages = {
  host: "",
  jordan: "https://storage.googleapis.com/thequest-2dc77.firebasestorage.app/talent-images%2FCB%20Publishing%20-%20Music%20Quest%2FMost%20Hated%20Twinz%2F1778105736665-4itkhi.jpeg",
  milo: "https://storage.googleapis.com/thequest-2dc77.firebasestorage.app/nominations%2F1778617774608-thqev1.jpg",
  sienna: "/images/template/b3.jpg",
  kai: "/images/template/a7.jpg",
  cover: "https://storage.googleapis.com/thequest-2dc77.firebasestorage.app/covers%2F6-1773851175481.jpg",
  gallery: "https://storage.googleapis.com/thequest-2dc77.firebasestorage.app/talent-images%2FCB%20Publishing%20-%20Music%20Quest%2FMost%20Hated%20Twinz%2F1778105776119-9na6f6.jpeg",
  galleryPortrait: "https://storage.googleapis.com/thequest-2dc77.firebasestorage.app/talent-images%2FCB%20Publishing%20-%20Music%20Quest%2FMost%20Hated%20Twinz%2F1778105869259-0hnuzp.jpeg",
  raplahomaCover: "https://storage.googleapis.com/thequest-2dc77.firebasestorage.app/covers%2F7-1788735731674.jpg",
};

const demoHost = {
  userId: "demo-host-01",
  displayName: "Ouuuuwwwweeeej",
  stageName: null,
  email: "",
  profileImageUrl: demoImages.host,
};

const demoTalentProfile = {
  id: 501,
  userId: "demo-artist-01",
  displayName: "Most Hated Twinz",
  stageName: null,
  email: "",
  showEmail: false,
  bio: "We are Most Hated Twinz — twin artists, creators, entrepreneurs, and visionaries focused on turning pain, hustle, and creativity into a movement. From music and content creation to custom jewelry and branding, we bring raw talent and real energy into everything we touch. Inspired by the grind and built from experience, our sound blends storytelling, emotion, aggression, and authenticity while creating a lane that stands out from the crowd.\n\nBut we’re bigger than just music. Our mission is to bring artists, creators, vendors, and entrepreneurs together to build a stronger network and open more opportunities for independent talent. Through events, collaborations, performances, and creative platforms, we’re creating spaces where people can connect, grow their fanbase, sharpen their craft, and support each other’s success.\n\nWe believe talent deserves exposure, hard work deserves recognition, and the next generation of creators deserves a platform. Whether it’s through music, live events, content, or business ventures, Most Hated Twinz is about building a community where creativity, ambition, and loyalty come first.",
  category: "Music",
  location: "Oklahoma City",
  profileColor: "#FF5A09",
  profileBgImage: null,
  imageUrls: [demoImages.jordan, demoImages.gallery, demoImages.galleryPortrait],
  socialLinks: {
    instagram: "https://www.instagram.com/most_hatedtwinz",
    youtube: "https://youtube.com/@mosthatedtwinz",
    tiktok: "https://www.tiktok.com/@mosthatedtwinz",
    facebook: "https://www.facebook.com/share/1bYTcgLDZw/",
  },
  payoutInfo: {},
  nonprofitDeclaration: demoArtistNonprofitDeclaration,
};

const demoCompetition = {
  id: 8101,
  title: "CB Publishing - Music Quest",
  description: "Show off your music prowess",
  category: "Music",
  coverImage: demoImages.cover,
  coverVideo: null,
  status: "active",
  voteCost: 1,
  maxVotesPerDay: 1,
  maxImagesPerContestant: null,
  maxVideosPerContestant: null,
  chronicBrandsPromotionEnabled: false,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  votingStartDate: null,
  votingEndDate: null,
  hostedBy: null,
  hostedByProfileSlug: null,
  themeColor: "#FF5A09",
  totalVotes: 1842,
  contestants: [
    {
      id: 501,
      competitionId: 8101,
      talentProfileId: 501,
      applicationStatus: "approved",
      voteCount: 684,
      tournamentPoints: 684,
      stageResults: {},
      talentProfile: {
        ...demoTalentProfile,
        id: 501,
        displayName: "Most Hated Twinz",
        stageName: null,
        bio: demoTalentProfile.bio,
        location: "Oklahoma City",
        imageUrls: demoTalentProfile.imageUrls,
      },
    },
    {
      id: 502,
      competitionId: 8101,
      talentProfileId: 502,
      applicationStatus: "approved",
      voteCount: 571,
      tournamentPoints: 571,
      stageResults: {},
      talentProfile: {
        id: 502,
        displayName: "Lil Nuggey",
        stageName: null,
        bio: "I have a passion for making and performing music, I'm greatful for this opportunity!",
        category: "Music",
        location: null,
        imageUrls: [demoImages.milo],
      },
    },
    {
      id: 503,
      competitionId: 8101,
      talentProfileId: 503,
      applicationStatus: "approved",
      voteCount: 388,
      tournamentPoints: 388,
      stageResults: {},
      talentProfile: {
        id: 503,
        displayName: "Streets Love Boomin",
        stageName: null,
        category: "Music",
        imageUrls: [],
      },
    },
    {
      id: 504,
      competitionId: 8101,
      talentProfileId: 504,
      applicationStatus: "approved",
      voteCount: 199,
      tournamentPoints: 199,
      stageResults: {},
      talentProfile: {
        id: 504,
        displayName: "$howtime",
        stageName: null,
        category: "Music",
        imageUrls: [],
      },
    },
  ],
};

const demoSecondCompetition = {
  id: 8102,
  title: "Raplahoma",
  description: "Raplohoma, put together by one of Oklahoma's biggest up-and-coming music promoters, E.J. Neal, serves as a dynamic platform dedicated to spotlighting regional hip-hop and urban culture. This channel is a living testament to the vast wealth of untapped talent that the state has to offer, bridging the gap between local artists and a broader audience. By providing in-depth coverage, artist features, and industry insights, Raplohoma lays out a clear blueprint for emerging musicians on how to cultivate their brand, navigate the music scene, and effectively get themselves put on the map.",
  category: "Music",
  coverImage: demoImages.raplahomaCover,
  coverVideo: null,
  status: "active",
  voteCost: 1,
  maxVotesPerDay: 1,
  maxImagesPerContestant: null,
  maxVideosPerContestant: null,
  chronicBrandsPromotionEnabled: false,
  startDate: "2026-09-21",
  endDate: "2026-11-12",
  votingStartDate: null,
  votingEndDate: null,
  hostedBy: "Ouuuuwwwweeeej",
  hostedByProfileSlug: "ouuuuwwwweeeej-20",
  themeColor: "#FF5A09",
  totalVotes: 973,
  contestants: [
    {
      id: 601,
      competitionId: 8102,
      talentProfileId: 601,
      applicationStatus: "approved",
      voteCount: 973,
      tournamentPoints: 973,
      stageResults: {},
      talentProfile: {
        id: 601,
        displayName: "JUNEOUTSXDE",
        stageName: null,
        bio: null,
        category: "Music",
        location: "OK",
        imageUrls: [],
      },
    },
  ],
};

const demoCompetitions = [demoCompetition, demoSecondCompetition];

const demoContestEntries = [
  {
    id: 501,
    competitionId: 8101,
    talentProfileId: 501,
    applicationStatus: "approved",
    appliedAt: "2026-09-02T14:30:00.000Z",
    competitionTitle: demoCompetition.title,
    competitionCategory: demoCompetition.category,
    competitionStatus: demoCompetition.status,
    voteCount: 684,
    chronicBrandsPromotionEnabled: false,
    chronicBrandsPromotionUrl: null,
    talentProfile: demoTalentProfile,
  },
];

const demoContestants = [
  ...demoCompetition.contestants.map((contestant) => ({
    ...contestant,
    appliedAt: "2026-09-02T14:30:00.000Z",
    competitionTitle: demoCompetition.title,
    talentProfile: contestant.talentProfile,
  })),
  {
    ...demoSecondCompetition.contestants[0],
    appliedAt: "2026-09-21T00:00:00.000Z",
    competitionTitle: demoSecondCompetition.title,
    talentProfile: demoSecondCompetition.contestants[0].talentProfile,
  },
];

const demoFinancialOverview = {
  earnings: {
    ...buildDemoEarnings(124000, 37200, 37200),
  },
  competitions: [
    {
      competitionId: 8101,
      competitionTitle: demoCompetition.title,
      title: demoCompetition.title,
      competitionCategory: demoCompetition.category,
      hostShareCents: 49600,
      hostNonprofitCents: 0,
      estimatedHostNonprofitCents: 4960,
      contestantShareCents: 74400,
      charityShareCents: 0,
      estimatedContestantNonprofitCents: 7440,
      estimatedCharityShareCents: 12400,
      status: "completed",
      paidVoting: { revenueCents: 124800, voteCount: 2496, purchasedVoteCount: 2496, purchaseCount: 46 },
      contestants: [
        {
          contestantId: 501,
          talentProfileId: 501,
          displayName: "Most Hated Twinz",
          name: "Most Hated Twinz",
          grossCents: 74400,
          earningsCents: 74400,
          netCents: 66960,
          pendingCents: 22320,
          paidCents: 22320,
          voteCount: 1488,
          paidVoteCount: 1488,
          paidVoteRevenueCents: 74400,
          freeVoteCount: 0,
          status: "completed",
          voteSharePercentage: 100,
          nonprofitCents: 0,
          nonprofitPercentage: 10,
          nonprofitRateSource: "default",
          estimatedNonprofitCents: 7440,
        },
      ],
    },
  ],
  pendingPayouts: [
    { profileType: "host", netCents: 14880, status: "approved" },
    { profileType: "host", netCents: 14880, status: "pending_approval" },
    { profileType: "contestant", netCents: 22320, status: "approved" },
    { profileType: "contestant", netCents: 22320, status: "pending_approval" },
  ],
  summary: {
    totalVoteCount: 2489,
    paidVotingVoteCount: 2496,
    paidVotingRevenueCents: 124800,
  },
  profileEarnings: [
    {
      userId: "demo-artist-01",
      profileId: 501,
      displayName: "Most Hated Twinz",
      profileType: "contestant",
      ...buildDemoEarnings(74400, 22320, 22320),
    },
    {
      userId: "demo-host-01",
      profileId: 9001,
      displayName: "Ouuuuwwwweeeej",
      profileType: "host",
      ...buildDemoEarnings(49600, 14880, 14880),
    },
  ],
};

const demoHostStats = {
  totalCompetitions: demoCompetitions.length,
  totalContestants: new Set(demoContestants.map((contestant) => contestant.talentProfileId)).size,
  totalVotes: demoCompetitions.reduce((total, competition) => total + competition.totalVotes, 0),
  pendingApplications: demoContestants.filter((contestant) => contestant.applicationStatus === "pending").length,
};

const DEMO_FREE_VOTE_MULTIPLIER = 60;

/** Splits each contestant's votes into free/paid and apportions paid sales so every demo total agrees with its rows. */
function withVoteSplit(
  rows: { rank: number; contestantId: number; displayName: string; voteCount: number; votePercentage: number }[],
  voteRevenue: number,
  purchases: number,
  nominationRevenue: number,
) {
  const split = rows.map((row) => {
    const paid = Math.round(row.voteCount * 0.35);
    return { ...row, freeVotes: row.voteCount - paid, paidVotes: paid };
  });
  const paidTotal = split.reduce((sum, row) => sum + row.paidVotes, 0);
  let assigned = 0;
  const leaderboard = split.map((row, i) => {
    const paidRevenue = i === split.length - 1
      ? voteRevenue - assigned
      : Math.round((row.paidVotes / Math.max(paidTotal, 1)) * voteRevenue);
    assigned += paidRevenue;
    return { ...row, paidRevenue };
  });
  return {
    leaderboard,
    freeVotes: leaderboard.reduce((sum, row) => sum + row.freeVotes, 0),
    paidVotes: paidTotal,
    freeVoteMultiplier: DEMO_FREE_VOTE_MULTIPLIER,
    voteRevenue,
    nominationRevenue,
    totalRevenue: voteRevenue + nominationRevenue,
    totalPurchases: purchases,
  };
}

const demoReportBase = {
  competition: demoSecondCompetition,
  leaderboard: [
    { rank: 1, contestantId: 601, displayName: "JUNEOUTSXDE", voteCount: 973, votePercentage: 100 },
  ],
  totalVotes: 973,
  totalContestants: 1,
};
const demoReport = {
  ...demoReportBase,
  ...withVoteSplit(demoReportBase.leaderboard, 92100, 46, 0),
};

const demoPrimaryReportBase = {
  competition: demoCompetition,
  leaderboard: [
    { rank: 1, contestantId: 501, displayName: "Most Hated Twinz", voteCount: 684, votePercentage: 37.1 },
    { rank: 2, contestantId: 502, displayName: "Lil Nuggey", voteCount: 571, votePercentage: 31.0 },
    { rank: 3, contestantId: 503, displayName: "Streets Love Boomin", voteCount: 388, votePercentage: 21.1 },
    { rank: 4, contestantId: 504, displayName: "$howtime", voteCount: 199, votePercentage: 10.8 },
  ],
  totalVotes: 1842,
  totalContestants: 4,
};
const demoPrimaryReport = {
  ...demoPrimaryReportBase,
  ...withVoteSplit(demoPrimaryReportBase.leaderboard, 92100, 46, 5000),
};

const demoCategories = [
  { id: "music", name: "Music", description: "Music and live performance" },
  { id: "dance", name: "Dance", description: "Dance and movement" },
  { id: "comedy", name: "Comedy", description: "Comedy and performance" },
];

const demoHostUsers = [
  { ...demoHost, competitionsCount: demoCompetitions.length, totalContestants: new Set(demoContestants.map((contestant) => contestant.talentProfileId)).size, status: "active" },
  {
    userId: "demo-host-02",
    displayName: "Taylor Reed",
    stageName: "Taylor Reed",
    email: "taylor.reed@example.com",
    profileImageUrl: "",
    competitionsCount: 1,
    totalContestants: 6,
    status: "active",
  },
];

const demoTalentUsers = [
  {
    id: 501,
    userId: "demo-artist-01",
    displayName: "Most Hated Twinz",
    stageName: null,
    email: "",
    level: 2,
    role: "talent",
    category: "Music",
    location: "Oklahoma City",
    imageUrls: demoTalentProfile.imageUrls,
    contestantCount: 1,
  },
  {
    id: 502,
    userId: "demo-artist-02",
    displayName: "Lil Nuggey",
    stageName: null,
    email: "",
    level: 2,
    role: "talent",
    category: "Music",
    location: null,
    imageUrls: [demoImages.milo],
    contestantCount: 1,
  },
];

const demoPurchases = [
  {
    id: 9101,
    competitionId: 8101,
    contestantId: 501,
    voteCount: 50,
    amount: 2500,
    transactionId: "DEMO-ORDER-9101",
    purchasedAt: "2026-10-08T19:42:00.000Z",
    competitionTitle: demoCompetition.title,
    competitionCategory: demoCompetition.category,
  },
  {
    id: 9102,
    competitionId: 8101,
    contestantId: 502,
    voteCount: 64,
    amount: 3200,
    transactionId: "DEMO-ORDER-9102",
    purchasedAt: "2026-10-10T16:18:00.000Z",
    competitionTitle: demoCompetition.title,
    competitionCategory: demoCompetition.category,
  },
  {
    id: 9103,
    competitionId: 8102,
    contestantId: 601,
    voteCount: 50,
    amount: 2500,
    transactionId: "DEMO-ORDER-9103",
    purchasedAt: "2026-10-12T21:05:00.000Z",
    competitionTitle: demoSecondCompetition.title,
    competitionCategory: demoSecondCompetition.category,
  },
];

const demoVideoSamplesByContestantId: Record<number, {
  id: number;
  name: string;
  duration: number;
  thumbnail: string;
  width: number;
  height: number;
}> = {
  501: {
    id: 1224526005,
    name: "MHT Summertime Mic Drop",
    duration: 172,
    thumbnail: "https://i.vimeocdn.com/video/2198013145-9504260bd72a446cb4706e9f8d3f1ccf63699fab509816c32503e6a979891b2c-d_640x360",
    width: 2160,
    height: 3840,
  },
  502: {
    id: 1225122333,
    name: "Lil Nuggey",
    duration: 258,
    thumbnail: "https://i.vimeocdn.com/video/2198759053-8eb9a2e585cc112e43d4d454a0495b3053f3f346942f10e2a96245a5a1ccf395-d_640x360",
    width: 1920,
    height: 1080,
  },
  503: {
    id: 1224528276,
    name: "Streets Love boomin sangerous",
    duration: 124,
    thumbnail: "https://i.vimeocdn.com/video/2198016328-eaa3f77aa1fc69b1c95c22e3c4a077d80951a9f87942edcadc5c5442a4b55ecd-d_640x360",
    width: 2160,
    height: 3840,
  },
  504: {
    id: 1224528911,
    name: "$howtime",
    duration: 155,
    thumbnail: "https://i.vimeocdn.com/video/2198017124-dc1bea3dce788429798ab2b51f159ba6321c7744be1832921ee1dd14e850bafb-d_640x360",
    width: 2160,
    height: 3840,
  },
  601: {
    id: 1227800900,
    name: "JuneOutside - WYA",
    duration: 133,
    thumbnail: "https://i.vimeocdn.com/video/2202109450-f650f0b9a23fdc5c3c95952ba4136b50ab195bade1c5f26aceb60a9b1b3dbd2c-d_640x360",
    width: 1920,
    height: 1080,
  },
};

const DEMO_VIDEO_IDS = new Set(
  Object.values(demoVideoSamplesByContestantId).map(({ id }) => id),
);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function resolveDemoApi(url: URL, analyticsRole: "host" | "talent"): unknown {
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/api/competitions") return demoCompetitions;
  if (path === "/api/categories") return demoCategories;
  if (path === "/api/livery") return [];
  if (path === "/api/talent-profiles/me") return analyticsRole === "host"
    ? { ...demoTalentProfile, id: 9001, userId: demoHost.userId, displayName: demoHost.displayName, nonprofitDeclaration: demoHostNonprofitDeclaration }
    : demoTalentProfile;
  if (path === "/api/contestants/me") return demoContestEntries;
  if (path === "/api/host/competitions") return demoCompetitions;
  if (path === "/api/host/contestants") return demoContestants;
  if (path === "/api/admin/contestants") return demoContestants;
  if (path === "/api/admin/hosts") return demoHostUsers;
  if (path === "/api/admin/users") return demoTalentUsers;
  if (path === "/api/drive/images") {
    return [
      { id: "demo-photo-01", name: "Most Hated Twinz — profile photo", imageUrl: demoImages.gallery, fallbackUrl: demoImages.cover, mimeType: "image/jpeg" },
      { id: "demo-photo-02", name: "Most Hated Twinz — profile photo", imageUrl: demoImages.galleryPortrait, fallbackUrl: demoImages.jordan, mimeType: "image/jpeg" },
    ];
  }
  if (path === "/api/payroll/my-overview") {
    if (analyticsRole === "host") {
      return {
        role: "host",
        competitions: demoFinancialOverview.competitions,
        earnings: demoFinancialOverview.profileEarnings.find((earning) => earning.profileType === "host") || null,
        pendingPayouts: demoFinancialOverview.pendingPayouts.filter((payout) => payout.profileType === "host"),
      };
    }
    const competitions = demoFinancialOverview.competitions
      .map((competition) => ({
        ...competition,
        contestants: competition.contestants.filter((contestant) => contestant.talentProfileId === 501),
      }))
      .filter((competition) => competition.contestants.length > 0);
    return {
      role: "contestant",
      competitions,
      earnings: demoFinancialOverview.profileEarnings.find((earning) => earning.profileType === "contestant") || null,
      pendingPayouts: demoFinancialOverview.pendingPayouts.filter((payout) => payout.profileType === "contestant"),
    };
  }
  if (path === "/api/admin/financial-overview") return demoFinancialOverview;
  if (path === "/api/host/stats") return {
    ...demoHostStats,
    totalTalentProfiles: 24,
    freeVotes: demoReport.freeVotes + demoPrimaryReport.freeVotes,
    paidVotes: demoReport.paidVotes + demoPrimaryReport.paidVotes,
  };
  if (path === "/api/admin/stats") {
    return {
      totalCompetitions: 2,
      totalContestants: 5,
      totalVotes: 2815,
      pendingApplications: 2,
      totalTalentProfiles: 24,
    };
  }
  if (path === "/api/referral/my-code") return { code: "DEMO-MHTWINZ", visits: 28, signups: 6 };
  if (path === "/api/platform-settings") return { maxVotesPerDay: 100, defaultVoteCost: 50, freeVotesPerDay: 3 };
  if (path === "/api/admin/payment-settings") {
    return {
      provider: "authorize",
      paypalEnvironment: "sandbox",
      envSecretStatus: { authorizeNetApiLoginId: true },
      ocIntegration: { configured: true, reachable: true, authorized: true },
    };
  }
  if (path === "/api/admin/storage") {
    return {
      drive: { usedGB: 2.4, totalGB: 15, usedPercent: 16, folders: [{ name: "Demo competition media", fileCount: 28 }] },
      vimeo: {
        totalVideos: 5,
        usedGB: 8.6,
        totalGB: 1000,
        usedPercent: 1,
        folders: [
          { name: demoCompetition.title, videoCount: 4 },
          { name: demoSecondCompetition.title, videoCount: 1 },
        ],
      },
    };
  }
  if (path === "/api/admin/join/settings" || path === "/api/host/settings") {
    return {
      isActive: true,
      pageTitle: "Join The Quest",
      pageDescription: "Apply to host a community competition.",
      nominationFee: 0,
      nominationPromoCodes: [],
    };
  }
  if (path === "/api/admin/join/submissions") return [];
  if (path === "/api/admin/host/submissions") return [];
  if (path === "/api/admin/gmail-status") return { configured: true, connected: true };
  if (path === "/api/analytics/my-dashboard") {
    const entries = demoCompetition.contestants.slice(0, 3).map((contestant, index) => ({
      contestantId: contestant.id,
      talentProfileId: contestant.talentProfileId,
      displayName: contestant.talentProfile.displayName,
      pagePath: `/music/cb-publishing-music-quest/${contestant.talentProfile.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      websiteVisitors: [247, 193, 128][index],
      uniquePlays: [896, 624, 412][index],
    }));
    const raplahomaEntries = [{
      contestantId: 601,
      talentProfileId: 601,
      displayName: "JUNEOUTSXDE",
      pagePath: "/music/raplahoma/juneoutsxde",
      websiteVisitors: 116,
      uniquePlays: 372,
    }];
    const competitions = [
      {
        competitionId: demoCompetition.id,
        title: demoCompetition.title,
        category: demoCompetition.category,
        pagePath: "/music/cb-publishing-music-quest",
        websiteVisitors: 428,
        uniquePlays: 1932,
        entries,
      },
      {
        competitionId: demoSecondCompetition.id,
        title: demoSecondCompetition.title,
        category: demoSecondCompetition.category,
        pagePath: "/music/raplahoma",
        websiteVisitors: 316,
        uniquePlays: 1184,
        entries: raplahomaEntries,
      },
    ];
    const visibleCompetitions = analyticsRole === "talent"
      ? competitions.map((competition) => ({
          ...competition,
          entries: competition.entries.filter((entry) => entry.talentProfileId === 501),
        })).filter((competition) => competition.entries.length > 0)
      : competitions.filter((competition) => competition.competitionId === demoSecondCompetition.id);
    const visibleEntries = visibleCompetitions.reduce((total, competition) => total + competition.entries.length, 0);

    return {
      role: analyticsRole,
      visitorPeriod: "Last 30 days",
      playPeriod: "Lifetime",
      summary: {
        websiteVisitors: analyticsRole === "talent" ? 563 : 744,
        uniquePlays: analyticsRole === "talent" ? 1708 : 3116,
        competitionCount: visibleCompetitions.length,
        entryCount: visibleEntries,
      },
      competitions: visibleCompetitions,
    };
  }
  if (path === "/api/tax/my-years") return [2024, 2025, 2026];
  if (path.startsWith("/api/tax/my-profile/")) {
    return { current: null, versions: [], currentVersionId: null };
  }
  if (path === "/api/tax/my-deadlines") return [];

  if (path.startsWith("/api/resolve/") && path.endsWith("/bundle")) {
    const entry = demoCompetition.contestants[0];
    const sample = demoVideoSamplesByContestantId[entry.id];
    return {
      competition: demoCompetition,
      contestant: {
        ...entry,
        videoThumbnail: sample.thumbnail,
        videos: [{
          uri: `/videos/${sample.id}`,
          name: sample.name,
          link: `https://vimeo.com/${sample.id}`,
          embedUrl: `https://player.vimeo.com/video/${sample.id}`,
          duration: sample.duration,
          thumbnail: sample.thumbnail,
          width: sample.width,
          height: sample.height,
        }],
        talentProfile: {
          ...entry.talentProfile,
          socialLinks: JSON.stringify({
            instagram: "https://www.instagram.com/",
            youtube: "https://www.youtube.com/",
            tiktok: "https://www.tiktok.com/",
          }),
        },
      },
      totalVotes: demoCompetition.totalVotes,
      contestants: demoCompetition.contestants,
    };
  }
  if (path.includes("/api/resolve/competition/") && path.endsWith("/videos")) {
    const selectedCompetition = path.includes("/raplahoma")
      ? demoSecondCompetition
      : demoCompetition;
    return selectedCompetition.contestants.map(({ id }) => {
      const sample = demoVideoSamplesByContestantId[id];
      if (!sample) return { contestantId: id, videos: [] };
      return {
        contestantId: id,
        videos: [{
          uri: `/videos/${sample.id}`,
          name: sample.name,
          embedUrl: `https://player.vimeo.com/video/${sample.id}`,
          duration: sample.duration,
          thumbnail: sample.thumbnail,
          width: sample.width,
          height: sample.height,
        }],
      };
    });
  }
  if (path.includes("/api/resolve/competition/") && path.endsWith("/tracking")) {
    const selectedCompetition = path.includes("/raplahoma")
      ? demoSecondCompetition
      : demoCompetition;
    const onlineVotes = Math.round(selectedCompetition.totalVotes * 0.77);
    const inPersonVotes = selectedCompetition.totalVotes - onlineVotes;
    return {
      competitionId: selectedCompetition.id,
      totalVotes: selectedCompetition.totalVotes,
      totalPoints: selectedCompetition.totalVotes,
      onlineVotes,
      inPersonVotes,
      updatedAt: "2026-10-13T12:00:00.000Z",
      contestants: selectedCompetition.contestants.map((contestant, index) => ({
        contestantId: contestant.id,
        displayName: contestant.talentProfile.displayName,
        voteCount: contestant.voteCount,
        rank: index + 1,
        votePercentage: Number(((contestant.voteCount / selectedCompetition.totalVotes) * 100).toFixed(1)),
        onlineVotes: Math.round(contestant.voteCount * 0.77),
        inPersonVotes: Math.round(contestant.voteCount * 0.23),
      })),
    };
  }
  if (path.startsWith("/api/resolve/competition/")) {
    return path.includes("/raplahoma") ? demoSecondCompetition : demoCompetition;
  }

  if (path.includes("/api/vimeo/videos")) {
    const sample = demoVideoSamplesByContestantId[501];
    return [
      {
        uri: `/videos/${sample.id}`,
        name: `Most Hated Twinz — ${sample.name}`,
        embedUrl: `https://player.vimeo.com/video/${sample.id}`,
        duration: sample.duration,
        thumbnail: sample.thumbnail,
        width: sample.width,
        height: sample.height,
        status: "ready",
      },
    ];
  }
  if (path.includes("/report")) {
    return path.includes("/8102/") || path.includes("/raplahoma")
      ? demoReport
      : demoPrimaryReport;
  }
  if (path.includes("/vote-breakdown")) {
    const isRaplahoma = path.includes("/8102/") || path.includes("/raplahoma");
    return isRaplahoma
      ? { online: 749, inPerson: 224, total: 973, onlineVoteWeight: 100 }
      : { online: 1426, inPerson: 416, total: 1842, onlineVoteWeight: 100 };
  }
  if (path.includes("/api/admin/users/") && path.endsWith("/videos")) {
    const pathSegments = path.split("/");
    const profileId = Number(pathSegments[pathSegments.length - 2]);
    const sample = demoVideoSamplesByContestantId[profileId];
    return {
      vimeoVideos: sample
        ? [{
            uri: `/videos/${sample.id}`,
            name: sample.name,
            embedUrl: `https://player.vimeo.com/video/${sample.id}`,
            duration: sample.duration,
            thumbnail: sample.thumbnail,
            width: sample.width,
            height: sample.height,
          }]
        : [],
    };
  }
  if (path.includes("/api/admin/users/") && path.endsWith("/access-status")) {
    return { canLogin: true, isDisabled: false, status: "active" };
  }
  if (path.includes("/api/admin/users/") && path.endsWith("/detail")) return demoTalentUsers[0];
  if (path.includes("/api/admin/hosts/") && path.endsWith("/competitions")) {
    const pathSegments = path.split("/");
    const hostId = pathSegments[pathSegments.length - 2];
    return hostId === demoHost.userId ? demoCompetitions : [];
  }
  if (path.includes("/api/competitions/") && path.includes("/stages/")) {
    return { competitionId: demoCompetition.id, stage: null, totalVotes: 1842, leaderboard: [] };
  }

  if (
    path.includes("/api/admin/")
    || path.includes("/api/host/")
    || path.includes("/api/competitions/")
    || path.includes("/api/vimeo/")
  ) return [];

  return {};
}

export function installDemoApiGuard(analyticsRole: "host" | "talent" = "talent"): () => void {
  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(rawUrl, window.location.origin);
    if (!url.pathname.startsWith("/api/")) return originalFetch.call(window, input, init);

    const requestMethod = init?.method || (input instanceof Request ? input.method : "GET");
    const method = requestMethod.toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return jsonResponse({ message: "This public demo is read-only." }, 403);
    }

    if (method === "HEAD") {
      return new Response(null, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } });
    }
    const playRequest = url.pathname.match(/^\/api\/vimeo\/(\d+)\/play$/);
    if (method === "GET" && playRequest && DEMO_VIDEO_IDS.has(Number(playRequest[1]))) {
      return originalFetch.call(window, input, init);
    }
    return jsonResponse(resolveDemoApi(url, analyticsRole));
  };

  return () => {
    window.fetch = originalFetch;
  };
}
