# Promo / Referral Code Landing Page Feature

## What It Does

When a visitor hits a URL like `yourdomain.com/KDAVIS` and that slug doesn't match any known page or brand on your site, this feature checks the **Chronic Brands USA code registry** to see if it's a registered referral or promo code. If it is, the visitor sees a clean landing page instead of a generic "Not Found" error.

The landing page:
- Displays the code prominently in large monospace text
- Shows a one-click copy button
- Explains this is a CBUSA referral/promo code valid for purchases and services
- Credits the referring partner (ownerName + sourcePlatform)
- Provides a clear CTA to explore services

---

## Backend: Public Code Lookup Endpoint

Add this route to your server **before** any authenticated code-registry routes. No API key required — it only exposes safe public fields.

```typescript
// Public: look up a single code (no auth — returns safe public fields only)
app.get("/api/code-registry/lookup/:code", async (req, res) => {
  try {
    const normalized = (req.params.code || '').toUpperCase().trim();
    if (!normalized) { res.status(400).json({ found: false }); return; }

    const [entry] = await db.select({
      code: codeRegistry.code,
      ownerName: codeRegistry.ownerName,
      sourcePlatform: codeRegistry.sourcePlatform,
      status: codeRegistry.status,
    }).from(codeRegistry).where(eq(codeRegistry.code, normalized));

    if (!entry) { res.json({ found: false }); return; }

    res.json({
      found: true,
      code: entry.code,
      ownerName: entry.ownerName,
      sourcePlatform: entry.sourcePlatform,
      status: entry.status,
    });
  } catch (e) {
    res.status(500).json({ found: false });
  }
});
```

**Fields returned (public-safe only):**
| Field | Description |
|---|---|
| `found` | `true` if code exists in registry |
| `code` | The normalized code (uppercase) |
| `ownerName` | Display name of the code owner |
| `sourcePlatform` | Which platform registered the code (e.g. "OlyLife OK") |
| `status` | `active` or `inactive` |

**Never expose:** `ownerEmail`, `ownerPhone`, or internal IDs.

---

## Frontend: Catch Unmatched Slugs on Your 404 / Not-Found Path

On whatever page handles unknown URL slugs (e.g. a `/:slug` catch-all route), add this logic **after** your normal page/brand lookup confirms no match:

### 1. Add imports

```tsx
import { Copy, CheckCheck, Tag, ShoppingBag, ArrowLeft } from 'lucide-react'
```

### 2. Add state and query

```tsx
const [copied, setCopied] = useState(false)

const slugUpper = slug.toUpperCase().trim()

// Only fires after your normal lookup confirms no match
const { data: codeData } = useQuery({
  queryKey: ['/api/code-registry/lookup', slugUpper],
  queryFn: () => fetch(`/api/code-registry/lookup/${slugUpper}`).then(r => r.json()),
  enabled: normalLookupHasFinished,  // set this to true once your page/brand query is done
  staleTime: 60000,
})
```

### 3. Render the landing page when a code is found

Place this **before** your default "Not Found" return:

```tsx
if (noMatchFound && codeData?.found) {
  const handleCopy = () => {
    navigator.clipboard.writeText(codeData.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
      <div className="max-w-lg w-full">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/30 mb-4">
            <Tag size={28} className="text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">You've Got a Code!</h1>
          <p className="text-white/50 text-sm">
            {codeData.ownerName ? `Referred by ${codeData.ownerName}` : 'Referral & promo code'}
            {codeData.sourcePlatform ? ` · via ${codeData.sourcePlatform}` : ''}
          </p>
        </div>

        {/* Code display */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 text-center">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Your Code</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-black text-white tracking-widest font-mono">
              {codeData.code}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg px-3 py-2 text-sm font-semibold transition-all"
            >
              {copied ? <><CheckCheck size={15} /> Copied!</> : <><Copy size={15} /> Copy</>}
            </button>
          </div>
          <p className="text-white/30 text-xs mt-4">
            Save this code — you'll need it at checkout or signup
          </p>
        </div>

        {/* Explanation */}
        <div className="bg-white/3 border border-white/8 rounded-xl p-5 mb-6 space-y-3">
          <p className="text-white/70 text-sm leading-relaxed">
            This code is registered with{' '}
            <strong className="text-white">Chronic Brands USA</strong> for
            purchases and services. Use it at checkout to apply any discounts
            or to credit your referral source.
          </p>
          <p className="text-white/50 text-sm">
            Explore our services below, then enter{' '}
            <strong className="text-green-400">{codeData.code}</strong> when
            you're ready to buy.
          </p>
        </div>

        {/* CTAs — update hrefs to match your site's routes */}
        <div className="flex flex-col gap-3">
          <a
            href="/services"   {/* ← change to your services/shop page */}
            className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-4 rounded-xl text-base transition-all"
          >
            <ShoppingBag size={18} />
            Explore Our Services
          </a>
          <a
            href="/"
            className="flex items-center justify-center gap-2 text-white/40 hover:text-white/70 font-medium px-6 py-3 rounded-xl text-sm transition-all border border-white/8 hover:border-white/20"
          >
            <ArrowLeft size={15} />
            Back to Home
          </a>
        </div>

      </div>
    </div>
  )
}
```

---

## How the Code Registry Works

Codes are registered centrally at CBUSA via:

```
POST /api/code-registry/register
Headers: x-api-key: <PROMO_API_KEY>
Body: { code, ownerName, ownerEmail, ownerPhone, sourcePlatform, status }
```

Or bulk-synced via:

```
POST /api/code-registry/sync
Headers: x-api-key: <PROMO_API_KEY>
Body: { sourcePlatform, codes: [...] }
```

Once registered at CBUSA, any partner site using this feature will automatically recognize the code and show the landing page when a visitor hits that URL.

---

## Key Rules

- The `enabled` flag on the query is important — only fire the code lookup **after** your normal page/brand lookup has finished, so you don't flash the code landing page during normal load.
- The `status` field is returned but not currently gating the UI — if you want to hide inactive codes, add: `if (codeData?.found && codeData.status === 'active')`.
- Never proxy or cache `ownerEmail` or `ownerPhone` on the frontend.
- The landing page CTA link (`/services` or `/business`) should point to whatever page on your site lists your offerings.
