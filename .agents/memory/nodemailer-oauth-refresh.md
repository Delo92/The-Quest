---
name: Nodemailer OAuth refresh
description: Safe OAuth2 token lifecycle for cached Nodemailer Gmail SMTP transports.
---

When configuring a cached Nodemailer OAuth2 transporter, do not pass a manually fetched `accessToken` without its real expiry. Nodemailer treats an access token with no expiry as valid indefinitely. Prefer configuring the refresh token and letting Nodemailer fetch and refresh access tokens, or pass the actual expiry.

**Why:** The Quest runs as a long-lived server. Reusing an expired access token can create intermittent email authentication or connection failures that disappear after the transporter is reset.

**How to apply:** For Gmail SMTP, configure `clientId`, `clientSecret`, and `refreshToken` without an unbounded static access token. Never log token values.
