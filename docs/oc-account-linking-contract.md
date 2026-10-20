# Quest ↔ Original Concepts account linking

This is the API contract Quest's per-user OC account flow expects. It is separate from the existing shared Quest↔OC service token and from OC's normal portal session. OC owns its social-platform credentials and performs the actual publishing.

## What users can do in Quest

1. A signed-in host or talent user reviews Quest's publishing-access explanation and explicitly consents.
2. Quest redirects the user to OC's OAuth consent screen using authorization-code flow with PKCE.
3. OC grants access to read the user's brand kits and their publishable social targets, and to publish only through those targets.
4. The user returns to `/thequest/dashboard`. Quest selects the correct host or talent account dashboard from the signed-in user's role.
5. The user selects one brand kit. Quest displays its identity, colors, logo, media, and the social accounts OC says are publishable.
6. Each post is composed and reviewed in Quest. Nothing is published until the user explicitly submits it.
7. The user can disconnect the OC account from Quest. Disconnecting does not delete OC data or posts already made.

## Quest configuration

Configure these values in the Quest environment:

| Variable | Purpose |
| --- | --- |
| `OC_API_BASE_URL` | OC origin, defaulting to `https://oraginalconcepts.com` |
| `OC_QUEST_OAUTH_CLIENT_ID` | OAuth client ID OC registers for Quest |
| `OC_QUEST_OAUTH_CLIENT_SECRET` | OAuth client secret, stored as a Replit secret |
| `ENCRYPTION_KEY` | Existing Quest encryption key used to encrypt OC access and refresh tokens at rest |
| `SITE_URL` | Quest's public origin, used to derive the registered callback URL |

Register this exact redirect URI for each Quest environment:

`{SITE_URL}/api/oc/account/callback`

Quest requests these OAuth scopes:

`brand-kits:read social-accounts:read social-posts:publish`

The browser receives only the authorization URL. Quest's server stores the one-time OAuth state and encrypted PKCE verifier, exchanges codes, refreshes and revokes tokens, and makes all OC resource requests. Never return OC access or refresh tokens to the browser.

## OAuth endpoints OC must provide

### `GET /oauth/authorize`

Accept the standard authorization-code parameters:

| Parameter | Required | Expected behavior |
| --- | --- | --- |
| `client_id` | Yes | Recognize Quest's registered client |
| `redirect_uri` | Yes | Match a registered URI exactly |
| `response_type` | Yes | Accept `code` |
| `scope` | Yes | Require the requested scopes or show a clear denial |
| `state` | Yes | Return unchanged to Quest |
| `code_challenge` | Yes | Validate an S256 PKCE challenge |
| `code_challenge_method` | Yes | Accept `S256` |

Show the OC user the requested brand-kit and publishing access. On approval, redirect to Quest's registered callback with a short-lived, single-use `code` and the original `state`. On denial, redirect with `error` and the original `state`.

### `POST /oauth/token`

Use `application/x-www-form-urlencoded`. Accept client authentication using HTTP Basic with the registered client ID and secret; Quest also sends `client_id` in the form.

For `grant_type=authorization_code`, accept `code`, `redirect_uri`, and `code_verifier`. For `grant_type=refresh_token`, accept `refresh_token`. Return JSON in this shape:

```json
{
  "access_token": "opaque bearer token",
  "refresh_token": "opaque refresh token",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "brand-kits:read social-accounts:read social-posts:publish"
}
```

`expires_in` must be a positive number. Include all three requested scopes in `scope`. Refresh-token rotation is supported: when returning a new refresh token, invalidate the old one. Return a clear OAuth error for invalid, expired, or revoked grants.

### `POST /oauth/revoke`

Accept `token` and `token_type_hint` as form fields and authenticate the Quest client. Return any 2xx status once the token has been revoked; Quest removes its local encrypted record even if OC cannot confirm revocation.

## Resource API OC must provide

Every resource route below requires `Authorization: Bearer <user access token>`. Enforce the authenticated OC user and requested scope on every call. A kit, target, or media ID from another user's account must not be accessible by guessing its ID.

### `GET /api/quest/v1/me`

Return either `{ "account": { "id": "oc-user-id", "displayName": "Name" } }` or the account object directly.

### `GET /api/quest/v1/brand-kits`

Return only kits accessible to the authorized OC user:

```json
{
  "brandKits": [
    {
      "id": "kit-id",
      "name": "Kit name",
      "businessName": "Brand name",
      "brandSlug": "brand",
      "logoUrl": "https://cdn.example.com/logo.png",
      "primaryColor": "#CC6600"
    }
  ]
}
```

Only `id` and `name` are required on list items.

### `GET /api/quest/v1/brand-kits/:id`

Return `{ "brandKit": ... }` or the brand-kit object directly:

```json
{
  "id": "kit-id",
  "name": "Kit name",
  "identity": {
    "businessName": "Brand name",
    "brandSlug": "brand",
    "tagline": "Optional tagline",
    "description": "Optional brand description",
    "logoUrl": "https://cdn.example.com/logo.png",
    "websiteUrl": "https://example.com",
    "primaryColor": "#CC6600",
    "secondaryColor": "#333333",
    "accentColor": "#F5A623"
  },
  "media": [
    {
      "id": "asset-id",
      "name": "Campaign image",
      "kind": "image",
      "mimeType": "image/jpeg",
      "previewUrl": "https://cdn.example.com/campaign.jpg",
      "canPublish": true
    }
  ],
  "socialAccounts": [
    {
      "id": "social-target-id",
      "platform": "instagram",
      "displayName": "@brand",
      "canPublish": true
    }
  ]
}
```

`identity` is required; all its properties are optional. `media` and `socialAccounts` are required arrays and may be empty. Use stable OC IDs for kits, media assets, and social targets. URLs displayed by Quest must use HTTPS. Set `canPublish` only when that asset or target can currently be used to publish through OC. Keep unsupported platforms visible only if they cannot be selected for publishing (`canPublish: false`).

### `POST /api/quest/v1/brand-kits/:id/posts`

Accept a user-reviewed post through the selected kit:

```json
{
  "targetIds": ["social-target-id"],
  "caption": "The post text the user reviewed",
  "mediaAssetId": "optional-asset-id",
  "idempotencyKey": "a UUID"
}
```

Quest also sends the same UUID in the `Idempotency-Key` header. Validate the kit, every target, optional media asset, access token, and `social-posts:publish` scope on the server. Never accept raw platform tokens or arbitrary destination IDs from Quest.

Publishing must be idempotent. Repeating the same key and same payload must return the original result without creating duplicate posts; reusing a key with a different payload should return `409`. Return a per-target result:

```json
{
  "success": true,
  "results": [
    {
      "targetId": "social-target-id",
      "platform": "instagram",
      "success": true,
      "postUrl": "https://www.instagram.com/p/example/"
    }
  ]
}
```

`success` is true only when all requested targets publish successfully. For partial or complete failure, include one result per requested target, with `success: false` and a concise `error` for failures. OC remains responsible for platform-specific requirements, publishing status, and the social-platform credentials.

## Security and ownership requirements

These requirements apply to per-user OAuth, kit access, and publishing. The
separate server-to-server promotional entitlement check is documented in
[oc-event-benefit-contract.md](oc-event-benefit-contract.md); it does not grant
publishing authorization.

- Do not use OC's regular portal JWT for this feature; it represents broader portal access.
- Do not use `QUEST_OC_API_TOKEN`; it remains the separate shared server-to-server integration credential.
- OC keeps all connected Facebook, Instagram, and other social-platform credentials.
- Bind the grant to the OC user who approved it. Enforce the user's kit and social-target ownership on every request.
- The user's consent authorizes Quest to submit posts through OC, not to publish automatically. Each publication requires an explicit Quest action.
- Revoke the user's OC grant on disconnect when possible. Do not revoke other Quest users or the shared integration.
- Quest stores OAuth state and encrypted OC tokens in server-side Firestore records. No local Firestore security-rules file is present in this repository; ensure deployed Firebase rules do not expose or permit client writes to `ocUserConnections` or `ocUserOAuthStates`.

## Existing OC behavior this does not replace

OC's current portal publish route, `POST /api/portal/social/publish`, requires the normal portal session and supports its existing Facebook/Instagram flow. That endpoint is not a substitute for the per-user OAuth grant and resource API above. Keep current portal behavior and the shared Quest↔OC integration unchanged.
