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
      console.log(`  ✓ Drive: ChronicTV(Beta)/${safeName(comp.title)}/ChronicTV/summary`);
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

    const talentName = safeName((profile as any).displayName || (profile as any).stageName || `talent-${contestant.talentProfileId}`);
    console.log(`[CONTESTANT] ${talentName} in "${comp.title}"`);

    try {
      await syncContestantToChronicTV(comp.title, talentName, (profile as any).bio || null);
      console.log(`  ✓ Drive: summary written`);
    } catch (e: any) {
      console.error(`  ✗ Drive sync failed: ${e.message}`);
    }

    try {
      await getChronicTVContestantVimeoFolder(comp.title, talentName);
      console.log(`  ✓ Vimeo: contestant folder created/confirmed`);
    } catch (e: any) {
      console.error(`  ✗ Vimeo folder failed: ${e.message}`);
    }

    try {
      const videos = await listTalentVideos(comp.title, talentName);
      if (videos.length === 0) {
        console.log(`  — no videos found in main folder, skipping video sync`);
      }
      for (const video of videos) {
        try {
          await syncVideoToChronicTV(video.uri, comp.title, talentName);
          console.log(`  ✓ Video synced: ${video.name || video.uri}`);
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
