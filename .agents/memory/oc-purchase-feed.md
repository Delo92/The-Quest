---
name: Original Concepts purchase feed
description: Signed additive purchase mirroring from The Quest to Original Concepts
---

The Quest mirrors completed customer purchases and supported Authorize.Net state changes to Original Concepts with HMAC-signed requests, stable purchase/event IDs, and a Firestore outbox. It must not send payroll transfers or payout credentials through this feed.

**Why:** Original Concepts is a read-only reporting destination for source-platform purchases; The Quest remains responsible for payment processing, refunds, and payout systems.

**How to apply:** Keep the source system and purchase IDs stable, retry the same event ID, treat duplicate responses as success, and verify the receiver with an unsigned request returning HTTP 401 before enabling production traffic.