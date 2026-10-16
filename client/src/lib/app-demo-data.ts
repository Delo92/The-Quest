const demoImages = {
  host: "/images/template/a7.jpg",
  jordan: "/images/template/a2.jpg",
  milo: "/images/template/a11.jpg",
  sienna: "/images/template/b3.jpg",
  kai: "/images/template/a7.jpg",
  cover: "/images/template/e1.jpg",
  gallery: "/images/template/e4.jpg",
  galleryPortrait: "/images/template/a10.jpg",
};

const demoHost = {
  userId: "demo-host-01",
  displayName: "Morgan Ellis",
  stageName: "Morgan Ellis",
  email: "morgan.ellis@example.com",
  profileImageUrl: demoImages.host,
};

const demoTalentProfile = {
  id: 501,
  userId: "demo-artist-01",
  displayName: "Jordan Vale",
  stageName: "Jordan Vale",
  email: "jordan.vale@example.com",
  showEmail: false,
  bio: "Indie soul vocalist blending warm acoustic arrangements with modern R&B. Based in Austin, Texas.",
  category: "Music",
  location: "Austin, TX",
  profileColor: "#FF5A09",
  profileBgImage: null,
  imageUrls: [demoImages.jordan],
  socialLinks: {
    instagram: "https://instagram.com/",
    youtube: "https://youtube.com/",
  },
  payoutInfo: { method: "ach", accountType: "checking", legalName: "Jordan Vale" },
  nonprofitDeclaration: {},
};

const demoCompetition = {
  id: 8101,
  title: "Acoustic Spotlight: Summer Sessions",
  description: "A community-powered showcase for independent voices. Discover the artists, follow the standings, and see how the season is unfolding.",
  category: "Music",
  coverImage: demoImages.cover,
  coverVideo: null,
  status: "voting",
  voteCost: 50,
  maxVotesPerDay: 100,
  maxImagesPerContestant: 8,
  maxVideosPerContestant: 3,
  chronicBrandsPromotionEnabled: false,
  startDate: "2026-10-02T12:00:00.000Z",
  endDate: "2026-10-31T23:59:59.000Z",
  votingStartDate: "2026-10-05T12:00:00.000Z",
  votingEndDate: "2026-10-31T23:59:59.000Z",
  createdAt: "2026-08-28T15:00:00.000Z",
  createdBy: demoHost.userId,
  hostedBy: demoHost.displayName,
  hostedByProfileSlug: "morgan-ellis",
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
        displayName: "Jordan Vale",
        stageName: "Jordan Vale",
        bio: "Indie soul vocalist blending warm acoustic arrangements with modern R&B.",
        imageUrls: [demoImages.jordan],
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
        displayName: "Milo Hayes",
        stageName: "Milo Hayes",
        bio: "Singer-songwriter bringing thoughtful storytelling to the stage.",
        category: "Music",
        location: "Nashville, TN",
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
        displayName: "Sienna Brooks",
        stageName: "Sienna Brooks",
        bio: "A rising folk-pop artist with a bright, unmistakable sound.",
        category: "Music",
        location: "Denver, CO",
        imageUrls: [demoImages.sienna],
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
        displayName: "Kai Bennett",
        stageName: "Kai Bennett",
        bio: "Acoustic performer focused on intimate arrangements and original songs.",
        category: "Music",
        location: "Chicago, IL",
        imageUrls: [demoImages.kai],
      },
    },
  ],
};

const demoSecondCompetition = {
  ...demoCompetition,
  id: 8102,
  title: "Spotlight: Emerging Voices",
  status: "active",
  startDate: "2026-10-14T12:00:00.000Z",
  endDate: "2026-10-28T23:59:59.000Z",
  votingStartDate: "2026-10-17T12:00:00.000Z",
  votingEndDate: "2026-10-28T23:59:59.000Z",
  totalVotes: 973,
  createdAt: "2026-07-03T15:00:00.000Z",
  contestants: demoCompetition.contestants.slice(0, 3).map((contestant) => ({
    ...contestant,
    competitionId: 8102,
  })),
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
  {
    id: 502,
    competitionId: 8102,
    talentProfileId: 501,
    applicationStatus: "pending",
    appliedAt: "2026-10-11T14:30:00.000Z",
    competitionTitle: demoSecondCompetition.title,
    competitionCategory: demoSecondCompetition.category,
    competitionStatus: demoSecondCompetition.status,
    voteCount: 0,
    chronicBrandsPromotionEnabled: false,
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
    id: 505,
    competitionId: 8101,
    talentProfileId: 505,
    applicationStatus: "pending",
    appliedAt: "2026-10-12T10:20:00.000Z",
    competitionTitle: demoCompetition.title,
    talentProfile: {
      id: 505,
      displayName: "Rae Collins",
      stageName: "Rae Collins",
      bio: "A new voice with a stripped-back pop sound.",
      category: "Music",
      imageUrls: [],
    },
  },
];

const demoFinancialOverview = {
  earnings: {
    grossCents: 124800,
    nextPayoutCents: 28600,
    pendingCents: 41200,
    paidCents: 83600,
  },
  competitions: [
    {
      competitionId: 8101,
      competitionTitle: demoCompetition.title,
      competitionCategory: demoCompetition.category,
      hostShareCents: 49600,
      contestantShareCents: 74400,
      paidVoting: { revenueCents: 124800, voteCount: 2496 },
      contestants: [
        { contestantId: 501, displayName: "Jordan Vale", grossCents: 74400, netCents: 59520, voteCount: 1488 },
      ],
    },
  ],
  pendingPayouts: [{ netCents: 28600, status: "pending" }],
  summary: {
    totalVoteCount: 2489,
    paidVotingVoteCount: 2496,
    paidVotingRevenueCents: 124800,
  },
  profileEarnings: [
    { profileId: 501, displayName: "Jordan Vale", profileType: "contestant", grossCents: 74400 },
  ],
};

const demoHostStats = {
  totalCompetitions: 2,
  totalContestants: 9,
  totalVotes: 2815,
  pendingApplications: 2,
};

const demoReport = {
  competition: demoCompetition,
  leaderboard: [
    { rank: 1, contestantId: 501, displayName: "Jordan Vale", voteCount: 684, votePercentage: 37.1 },
    { rank: 2, contestantId: 502, displayName: "Milo Hayes", voteCount: 571, votePercentage: 31.0 },
    { rank: 3, contestantId: 503, displayName: "Sienna Brooks", voteCount: 388, votePercentage: 21.1 },
  ],
  totalVotes: 1842,
  totalRevenue: 92100,
  totalContestants: 5,
  totalPurchases: 46,
};

const demoCategories = [
  { id: "music", name: "Music", description: "Music and live performance" },
  { id: "dance", name: "Dance", description: "Dance and movement" },
  { id: "comedy", name: "Comedy", description: "Comedy and performance" },
];

const demoHostUsers = [
  { ...demoHost, competitionsCount: 2, totalContestants: 9, status: "active" },
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
    displayName: "Jordan Vale",
    stageName: "Jordan Vale",
    email: "jordan.vale@example.com",
    level: 2,
    role: "talent",
    category: "Music",
    location: "Austin, TX",
    imageUrls: demoTalentProfile.imageUrls,
    contestantCount: 1,
  },
  {
    id: 502,
    userId: "demo-artist-02",
    displayName: "Milo Hayes",
    stageName: "Milo Hayes",
    email: "milo.hayes@example.com",
    level: 2,
    role: "talent",
    category: "Music",
    location: "Nashville, TN",
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
    contestantId: 503,
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
}> = {
  501: {
    id: 59395818,
    name: "Walking on Cars acoustic session",
    duration: 257,
    thumbnail: "https://i.vimeocdn.com/video/417376680-a8bab84b5b367e2f67eb1e308c5b4e17a0b31f64f464d9d8073a4b0842b2085a-d_295x166?region=us",
  },
  502: {
    id: 143261961,
    name: "Coffee Shop Acoustic Session — Get Low Cover",
    duration: 167,
    thumbnail: "https://i.vimeocdn.com/video/540792884-6807187bc71145882d65ff50909cf23e73cc6f43802a30fcc04c0cc10dcea1f6-d_640?region=us",
  },
  503: {
    id: 305190021,
    name: "Blac Rabbit — All Good Acoustic Session",
    duration: 253,
    thumbnail: "https://i.vimeocdn.com/video/744627664-cb678a7475a95a05126bb1ac3d932fe7e34854f8e4c07e3cc0f44d0efc2d2c77-d_640?region=us",
  },
  504: {
    id: 5565152,
    name: 'Modern Guilt Acoustic "Orphans"',
    duration: 220,
    thumbnail: "https://i.vimeocdn.com/video/18690669-e2ff59d87eedf419116387907e16340a1e98e920ab3d24d26a3afa30cc12a98b-d_295x166?region=us",
  },
};

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
  if (path === "/api/talent-profiles/me") return demoTalentProfile;
  if (path === "/api/contestants/me") return demoContestEntries;
  if (path === "/api/host/competitions") return demoCompetitions;
  if (path === "/api/host/contestants" || path === "/api/admin/contestants") return demoContestants;
  if (path === "/api/admin/hosts") return demoHostUsers;
  if (path === "/api/admin/users") return demoTalentUsers;
  if (path === "/api/drive/images") {
    return [
      { id: "demo-photo-01", name: "Jordan Vale — acoustic set", imageUrl: demoImages.gallery, fallbackUrl: demoImages.cover, mimeType: "image/jpeg" },
      { id: "demo-photo-02", name: "Jordan Vale — portrait", imageUrl: demoImages.galleryPortrait, fallbackUrl: demoImages.jordan, mimeType: "image/jpeg" },
    ];
  }
  if (path === "/api/payroll/my-overview" || path === "/api/admin/financial-overview") return demoFinancialOverview;
  if (path === "/api/host/stats" || path === "/api/admin/stats") {
    return { ...demoHostStats, totalTalentProfiles: 24 };
  }
  if (path === "/api/referral/my-code") return { code: "DEMO-JORDAN", visits: 28, signups: 6 };
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
      vimeo: { totalVideos: 12, usedGB: 8.6, totalGB: 1000, usedPercent: 1, folders: [{ name: "Acoustic Spotlight", videoCount: 12 }] },
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
      pagePath: `/music/acoustic-spotlight-summer-sessions/${contestant.talentProfile.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      websiteVisitors: [247, 193, 128][index],
      uniquePlays: [896, 624, 412][index],
    }));
    const competitions = [
      {
        competitionId: demoCompetition.id,
        title: demoCompetition.title,
        category: demoCompetition.category,
        pagePath: "/music/acoustic-spotlight-summer-sessions",
        websiteVisitors: 428,
        uniquePlays: 1932,
        entries,
      },
      {
        competitionId: demoSecondCompetition.id,
        title: demoSecondCompetition.title,
        category: demoSecondCompetition.category,
        pagePath: "/music/spotlight-emerging-voices",
        websiteVisitors: 316,
        uniquePlays: 1184,
        entries: entries.slice(0, 2).map((entry) => ({
          ...entry,
          pagePath: "/music/spotlight-emerging-voices",
        })),
      },
    ];
    const visibleCompetitions = analyticsRole === "talent"
      ? competitions.map((competition) => ({
          ...competition,
          entries: competition.entries.filter((entry) => entry.talentProfileId === 501),
        }))
      : competitions;
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

  if (path.includes("/api/resolve/competition/") && path.endsWith("/videos")) {
    const selectedCompetition = path.includes("spotlight-emerging-voices")
      ? demoSecondCompetition
      : demoCompetition;
    return selectedCompetition.contestants.map(({ id }) => {
      const sample = demoVideoSamplesByContestantId[id];
      if (!sample) return { contestantId: id, videos: [] };
      return {
        contestantId: id,
        videos: [{
          uri: `https://vimeo.com/${sample.id}`,
          name: sample.name,
          embedUrl: `https://player.vimeo.com/video/${sample.id}`,
          duration: sample.duration,
          thumbnail: sample.thumbnail,
        }],
      };
    });
  }
  if (path.includes("/api/resolve/competition/") && path.endsWith("/tracking")) {
    return {
      competitionId: demoCompetition.id,
      totalVotes: demoCompetition.totalVotes,
      totalPoints: demoCompetition.totalVotes,
      onlineVotes: 1426,
      inPersonVotes: 416,
      updatedAt: "2026-10-13T12:00:00.000Z",
      contestants: demoCompetition.contestants.map((contestant, index) => ({
        contestantId: contestant.id,
        displayName: contestant.talentProfile.displayName,
        voteCount: contestant.voteCount,
        rank: index + 1,
        votePercentage: Number(((contestant.voteCount / demoCompetition.totalVotes) * 100).toFixed(1)),
        onlineVotes: Math.round(contestant.voteCount * 0.77),
        inPersonVotes: Math.round(contestant.voteCount * 0.23),
      })),
    };
  }
  if (path.startsWith("/api/resolve/competition/")) return demoCompetition;

  if (path.includes("/api/vimeo/videos")) {
    const sample = demoVideoSamplesByContestantId[501];
    return [
      {
        uri: `https://vimeo.com/${sample.id}`,
        name: `Jordan Vale — sample: ${sample.name}`,
        embedUrl: `https://player.vimeo.com/video/${sample.id}`,
        duration: sample.duration,
        thumbnail: sample.thumbnail,
        status: "ready",
      },
    ];
  }
  if (path.includes("/report")) return demoReport;
  if (path.includes("/vote-breakdown")) return { online: 1426, inPerson: 416, total: 1842, onlineVoteWeight: 100 };
  if (path.includes("/api/admin/users/") && path.endsWith("/videos")) return [];
  if (path.includes("/api/admin/users/") && path.endsWith("/access-status")) {
    return { canLogin: true, isDisabled: false, status: "active" };
  }
  if (path.includes("/api/admin/users/") && path.endsWith("/detail")) return demoTalentUsers[0];
  if (path.includes("/api/admin/hosts/") && path.endsWith("/competitions")) return demoCompetitions;
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
    return jsonResponse(resolveDemoApi(url, analyticsRole));
  };

  return () => {
    window.fetch = originalFetch;
  };
}
