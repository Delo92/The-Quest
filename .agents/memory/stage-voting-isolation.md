---
name: Stage voting isolation
description: Stage-aware votes and purchases must remain separate from legacy competition-wide totals.
---

Stage votes use separate vote and count records keyed by competition, stage, and contestant. Competition-wide count records retain their legacy key and remain the source for existing cumulative leaderboards; stage reports query the stage key explicitly.

**Why:** Adding stage votes to the existing aggregate documents would double-count them in public leaderboards and break historical competition totals.

**How to apply:** Any future stage vote, purchase, leaderboard, or analytics change must carry stageId through persistence and must verify whether a report is stage-specific or cumulative before changing its query.