---
name: Express route params
description: Express 5 route parameter typing in the Quest server
---

Authentication middleware used by routes with named path parameters should type requests with `ParamsFlatDictionary`, because this project’s Express 5 definitions otherwise widen `req.params` values to `string | string[]` and cascade errors into route handlers.

**Why:** Middleware parameter inference was widening otherwise valid route parameters across the server, producing dozens of false-positive incompatibilities for numeric IDs, slugs, and file IDs.

**How to apply:** Keep auth middleware request types aligned with route handlers. For explicitly typed handlers, use `Request<ParamsFlatDictionary>` when path parameters are expected to be single strings.