import { storage } from "./storage";
import { syncCompetitionToChronicTV, syncContestantToChronicTV } from "./google-drive";
import {
  getChronicTVEventVimeoFolder,
  getChronicTVContestantVimeoFolder,
  syncVideoToChronicTV,
  listTalentVideos,
} from "./vimeo";

function safeName(s: string) {
  return (s || "").replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim();
}

async function run() {
  console.log("\n=== ChronicTV Backfill ===\n");

  const competitions = await storage.getCompetitions();
  const nonDraft = competitions.filter(c => c.status !== "draft");

  console.log(`Found ${competitions.length} total competitions, ${nonDraft.length} non-draft.\n`);

  for (const comp of nonDraft) {
    console.log(`[COMPETITION] ${comp.title} (${comp.status})`);
    try {
      await syncCompetitionToChronicTV(comp.title, {
        description: comp.description,
        category: comp.category,
        status: comp.status,
        endDate: comp.endDate,
      });
      console.log(`  ✓ Drive: ChronicTV(Beta)/CB Publishing The Quest/ChronicTV/${safeName(comp.title)}/`);
    } catch (e: any) {
      console.error(`  ✗ Drive sync failed: ${e.message}`);
    }
    try {
      await getChronicTVEventVimeoFolder(comp.title);
      console.log(`  ✓ Vimeo: ChronicTV > Originals > CB Publishing The Quest > ${comp.title}`);
    } catch (e: any) {
      console.error(`  ✗ Vimeo folder failed: ${e.message}`);
    }
  }

  console.log("\n--- Contestants ---\n");

  const allContestants = await storage.getAllContestants();
  const approved = allContestants.filter(c => c.applicationStatus === "approved");

  console.log(`Found ${allContestants.length} total contestants, ${approved.length} approved.\n`);

  for (const contestant of approved) {
    const comp = await storage.getCompetition(contestant.competitionId);
    if (!comp) {
      console.log(`  [skip] contestant ${contestant.id} — competition not found`);
      continue;
    }
    const profile = await storage.getTalentProfile(contestant.talentProfileId);
    if (!profile) {
      console.log(`  [skip] contestant ${contestant.id} — profile not found`);
      continue;
    }

    // Quest folder uses stageName first (matches upload ticket logic)
    const questName = safeName((profile as any).stageName || (profile as any).displayName || `talent-${contestant.talentProfileId}`);
    // ChronicTV catalog uses displayName (real name for broadcast, matches contestant approval logic)
    const chronicTVName = safeName((profile as any).displayName || (profile as any).stageName || `talent-${contestant.talentProfileId}`);

    console.log(`[CONTESTANT] quest="${questName}" / chronicTV="${chronicTVName}" in "${comp.title}"`);

    try {
      await syncContestantToChronicTV(comp.title, chronicTVName, (profile as any).bio || null);
      console.log(`  ✓ Drive: ChronicTV folder for ${chronicTVName}`);
    } catch (e: any) {
      console.error(`  ✗ Drive sync failed: ${e.message}`);
    }

    try {
      await getChronicTVContestantVimeoFolder(comp.title, chronicTVName);
      console.log(`  ✓ Vimeo: ChronicTV contestant folder confirmed for ${chronicTVName}`);
    } catch (e: any) {
      console.error(`  ✗ Vimeo folder failed: ${e.message}`);
    }

    try {
      // List videos from the Quest platform folder (uses questName / stageName)
      const videos = await listTalentVideos(comp.title, questName);
      if (videos.length === 0) {
        console.log(`  — no videos found in Quest folder for "${questName}", skipping video sync`);
      }
      for (const video of videos) {
        try {
          // Sync into ChronicTV folder using chronicTVName (displayName)
          await syncVideoToChronicTV(video.uri, comp.title, questName, chronicTVName);
          console.log(`  ✓ Video synced to ChronicTV: ${video.name || video.uri}`);
        } catch (e: any) {
          console.error(`  ✗ Video sync failed for ${video.uri}: ${e.message}`);
        }
      }
    } catch (e: any) {
      console.error(`  ✗ Video list failed: ${e.message}`);
    }
  }

  console.log("\n=== Backfill complete ===\n");
}

run().catch(err => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
