# Media Mapping System (Livery)

A system for making every image, video, and text block in an HTML template swappable through an admin dashboard, without touching code. The template ships with default static assets; admins replace them at runtime via file upload or URL, and the frontend resolves the correct asset automatically.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD (Livery Tab)                               │
│  Upload image/video or edit text for any slot               │
│     │                                                       │
│     ▼                                                       │
│  PUT /api/admin/livery/:imageKey         (media upload)     │
│  PUT /api/admin/livery/:imageKey/text    (text update)      │
│  DELETE /api/admin/livery/:imageKey      (reset to default) │
│     │                                                       │
│     ▼                                                       │
│  Firebase Storage (uploaded files)                          │
│  Firestore "livery" collection (metadata)                   │
│     │                                                       │
│     ▼                                                       │
│  GET /api/livery  (public, returns all slots)               │
│     │                                                       │
│     ▼                                                       │
│  useLivery() hook  →  getImage() / getMedia() / getText()  │
│     │                                                       │
│     ▼                                                       │
│  Frontend components render custom or fallback content      │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Data Model — Livery Item

Each swappable slot is a document in Firestore, keyed by `imageKey`.

```typescript
interface LiveryItem {
  imageKey: string;        // Unique ID, also the Firestore document ID
  label: string;           // Human-readable name shown in admin UI
  imageUrl: string | null; // Custom uploaded URL (null = use default)
  defaultUrl: string;      // Original template asset path (e.g. "/images/template/bg-1.jpg")
  mediaType?: "image" | "video";  // Type of the custom upload
  textContent?: string | null;    // Custom text (for text-type slots)
  defaultText?: string | null;    // Original default text
  itemType?: "media" | "text";    // Slot type — determines admin UI
}
```

### Key Concepts

- **`imageKey`** is the stable identifier used everywhere. It never changes.
- **`defaultUrl`** points to the static template file in `/public/images/template/`.
- **`imageUrl`** is set when an admin uploads a replacement. When `null`, the frontend falls back to `defaultUrl`.
- **`itemType`** controls whether the admin sees a file upload widget ("media") or a text editor ("text").
- **`mediaType`** tracks whether the uploaded file is an image or video, so the frontend can render `<img>` or `<video>`.

---

## 2. Seed File — Defining All Slots

All slots are defined in a single array. On server startup, a seed function ensures every slot exists in Firestore without overwriting admin customizations.

```typescript
// server/seed.ts
const LIVERY_DEFAULTS = [
  // ── Media Slots ──
  { imageKey: "logo", label: "Site Logo", defaultUrl: "/images/template/logo.png" },
  { imageKey: "hero_background", label: "Hero Background", defaultUrl: "/images/template/bg-1.jpg" },
  { imageKey: "feature_background", label: "Feature Section Background", defaultUrl: "/images/template/bg-2.jpg" },
  { imageKey: "breadcrumb_bg", label: "Page Header Background", defaultUrl: "/images/template/breadcumb.jpg" },
  { imageKey: "competition_card_fallback", label: "Default Competition Card", defaultUrl: "/images/template/e1.jpg" },
  // ... more media slots

  // ── Text Slots ──
  { imageKey: "hero_title_top", label: "Hero Title - Top Line", defaultUrl: "", itemType: "text", defaultText: "The Ultimate" },
  { imageKey: "hero_title_main", label: "Hero Title - Main Heading", defaultUrl: "", itemType: "text", defaultText: "Talent Platform" },
  { imageKey: "hero_summary", label: "Hero Summary Text", defaultUrl: "", itemType: "text", defaultText: "Welcome to..." },
  // ... more text slots
];
```

### Seed Logic

```typescript
async function seedLivery() {
  const existing = await firestoreLivery.getAll();
  const existingKeys = new Set(existing.map(l => l.imageKey));
  const validKeys = new Set(LIVERY_DEFAULTS.map(l => l.imageKey));

  for (const item of LIVERY_DEFAULTS) {
    if (!existingKeys.has(item.imageKey)) {
      // New slot — create it with imageUrl: null (uses default)
      await firestoreLivery.upsert({ ...item, imageUrl: null });
    } else {
      // Existing slot — update label if changed, preserve custom content
      const existingItem = existing.find(e => e.imageKey === item.imageKey);
      if (existingItem && existingItem.label !== item.label) {
        await firestoreLivery.upsert({ ...existingItem, label: item.label });
      }
    }
  }

  // Clean up slots that are no longer in the defaults
  for (const item of existing) {
    if (!validKeys.has(item.imageKey)) {
      await firestoreLivery.delete(item.imageKey);
    }
  }
}
```

**Key behavior:** Seeding is additive. It never overwrites `imageUrl` or `textContent` that an admin has already set. It only creates missing slots and removes obsolete ones.

---

## 3. Storage Layer — Firestore CRUD

```typescript
// server/firestore-collections.ts
const firestoreLivery = {
  async getAll(): Promise<LiveryItem[]> {
    const snapshot = await db().collection("livery").get();
    return snapshot.docs.map(doc => doc.data() as LiveryItem);
  },

  async getByKey(imageKey: string): Promise<LiveryItem | null> {
    const doc = await db().collection("livery").doc(imageKey).get();
    if (!doc.exists) return null;
    return doc.data() as LiveryItem;
  },

  async upsert(item: LiveryItem): Promise<LiveryItem> {
    await db().collection("livery").doc(item.imageKey).set(item);
    return item;
  },

  async updateImage(imageKey: string, imageUrl: string | null, mediaType?: "image" | "video"): Promise<LiveryItem | null> {
    const ref = db().collection("livery").doc(imageKey);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const update: any = { imageUrl };
    if (mediaType) update.mediaType = mediaType;
    await ref.update(update);
    return { ...doc.data(), ...update } as LiveryItem;
  },

  async updateText(imageKey: string, textContent: string | null): Promise<LiveryItem | null> {
    const ref = db().collection("livery").doc(imageKey);
    const doc = await ref.get();
    if (!doc.exists) return null;
    await ref.update({ textContent });
    return { ...doc.data(), textContent } as LiveryItem;
  },

  async delete(imageKey: string): Promise<void> {
    await db().collection("livery").doc(imageKey).delete();
  },
};
```

---

## 4. API Routes

### Public — Fetch All Slots
```
GET /api/livery
→ Returns: LiveryItem[]
```
No authentication required. The frontend loads this on every page.

### Admin — Upload Media
```
PUT /api/admin/livery/:imageKey
Content-Type: multipart/form-data
Body: { image: File } OR { imageUrl: string, mediaType?: "video" }
Auth: Firebase JWT + admin role
```
Flow:
1. Receives uploaded file (or external URL).
2. Detects if video by file extension.
3. Uploads to Firebase Storage at path `livery/{imageKey}{ext}`.
4. Saves the public URL to Firestore.

### Admin — Update Text
```
PUT /api/admin/livery/:imageKey/text
Content-Type: application/json
Body: { textContent: string }
Auth: Firebase JWT + admin role
```

### Admin — Reset to Default
```
DELETE /api/admin/livery/:imageKey
Auth: Firebase JWT + admin role
```
Sets `imageUrl` back to `null`, causing the frontend to show `defaultUrl` again.

### Admin — Permanently Delete Slot
```
DELETE /api/admin/livery/:imageKey/permanent
Auth: Firebase JWT + admin role
```
Removes the slot entirely from Firestore.

---

## 5. Frontend Hook — `useLivery()`

This is the single interface every page/component uses to resolve media and text.

```typescript
// client/src/hooks/use-livery.ts
function useLivery() {
  const { data: items, isLoading } = useQuery<LiveryItem[]>({
    queryKey: ["/api/livery"],
    staleTime: 5 * 60 * 1000,  // Cache for 5 minutes
  });

  // Returns image URL — custom if set, otherwise default
  const getImage = (imageKey: string, fallback?: string): string => {
    const item = items?.find(i => i.imageKey === imageKey);
    if (!item) return fallback || "";
    return item.imageUrl || item.defaultUrl;
  };

  // Returns { url, type } so the component knows whether to render <img> or <video>
  const getMedia = (imageKey: string, fallback?: string): { url: string; type: "image" | "video" } => {
    const item = items?.find(i => i.imageKey === imageKey);
    if (!item) return { url: fallback || "", type: "image" };
    return {
      url: item.imageUrl || item.defaultUrl,
      type: item.mediaType || "image",
    };
  };

  // Returns text content — custom if set, otherwise default
  const getText = (imageKey: string, fallback?: string): string => {
    const item = items?.find(i => i.imageKey === imageKey);
    if (!item) return fallback || "";
    if (item.textContent !== null && item.textContent !== undefined) return item.textContent;
    return item.defaultText || fallback || "";
  };

  return { items, isLoading, getImage, getMedia, getText };
}
```

---

## 6. Frontend Usage Patterns

### Pattern A: Background Image (with video support)
```tsx
const { getImage, getMedia } = useLivery();

// If admin uploaded a video, play it; otherwise show image
{getMedia("hero_background", "/images/template/bg-1.jpg").type === "video" ? (
  <video
    src={getMedia("hero_background", "/images/template/bg-1.jpg").url}
    autoPlay muted loop playsInline
    className="absolute inset-0 w-full h-full object-cover"
  />
) : (
  <div
    className="absolute inset-0 bg-cover bg-center"
    style={{ backgroundImage: `url('${getImage("hero_background", "/images/template/bg-1.jpg")}')` }}
  />
)}
```

### Pattern B: Simple Image
```tsx
<img src={getImage("logo", "/images/template/logo.png")} alt="Logo" />
```

### Pattern C: Editable Text
```tsx
const { getText } = useLivery();

<h1>{getText("hero_title_main", "Talent Platform")}</h1>
<p>{getText("hero_summary", "Welcome to our platform...")}</p>
```

### Pattern D: Conditional Rendering (only show if text exists)
```tsx
{getText("hero_summary") && (
  <p>{getText("hero_summary")}</p>
)}
```

---

## 7. Admin Dashboard UI

The admin sees two sections in the Livery tab:

### Media Items
- Shows thumbnail preview (current image or default)
- "Upload" button to replace with a new file
- "Reset" button to revert to the template default
- Supports image files (jpg, png, gif, webp) and video files (mp4, mov, webm)

### Text Items
- Shows current text in an editable textarea
- "Save" button to persist changes
- "Reset" button to revert to default text
- Supports markdown in some fields

---

## 8. File Upload Flow

```
Admin uploads file
    │
    ▼
Multer receives file in memory (server/routes.ts)
    │
    ▼
Detect media type by extension (isVideoFile check)
    │
    ▼
Upload to Firebase Storage at: livery/{imageKey}{.ext}
    │  Returns public URL
    ▼
Save URL + mediaType to Firestore "livery" collection
    │
    ▼
Frontend re-fetches /api/livery (cache invalidation)
    │
    ▼
useLivery() returns new URL → component re-renders
```

---

## 9. Resolution Priority

When a component calls `getImage("hero_background", "/images/template/bg-1.jpg")`:

```
1. Look for item with imageKey === "hero_background"
2. If item.imageUrl is set → return it (admin's custom upload)
3. If item.imageUrl is null → return item.defaultUrl (template original)
4. If no item found → return fallback argument ("/images/template/bg-1.jpg")
```

---

## 10. Adding a New Swappable Slot

To make any new template element swappable:

### Step 1: Add to seed defaults
```typescript
// server/seed.ts — add to LIVERY_DEFAULTS array
{ imageKey: "new_section_bg", label: "New Section Background", defaultUrl: "/images/template/new-bg.jpg" }
// or for text:
{ imageKey: "new_heading", label: "New Section Heading", defaultUrl: "", itemType: "text", defaultText: "Default Heading" }
```

### Step 2: Use in frontend
```tsx
const { getImage, getText } = useLivery();

// Media
<img src={getImage("new_section_bg", "/images/template/new-bg.jpg")} />

// Text
<h2>{getText("new_heading", "Default Heading")}</h2>
```

### Step 3: Restart server
The seed function runs on startup and creates the new slot. It immediately appears in the admin Livery tab.

That's it. No database migrations, no frontend changes beyond the component markup.

---

## 11. Complete Slot Registry

### Media Slots
| imageKey | Label | Default Path |
|----------|-------|-------------|
| `logo` | Site Logo | `/images/template/logo.png` |
| `site_favicon` | Site Favicon | `/images/template/favicon.jpeg` |
| `hero_background` | Hero Background (Landing) | `/images/template/bg-1.jpg` |
| `feature_background` | Feature Section Background | `/images/template/bg-2.jpg` |
| `cta_background` | Call to Action Background | `/images/template/breadcumb.jpg` |
| `breadcrumb_bg` | Page Header Background | `/images/template/breadcumb.jpg` |
| `competitions_header` | Competitions Page Header | `/images/template/breadcumb2.jpg` |
| `competition_detail_header` | Competition Detail Header | `/images/template/breadcumb3.jpg` |
| `competition_card_fallback` | Default Competition Card Image | `/images/template/e1.jpg` |
| `talent_profile_fallback` | Default Talent Profile Image | `/images/template/a1.jpg` |

### Text Slots
| imageKey | Label | Default Text (excerpt) |
|----------|-------|----------------------|
| `hero_title_top` | Hero Title - Top Line | "The Ultimate" |
| `hero_title_main` | Hero Title - Main Heading | "Talent Platform" |
| `hero_summary` | Hero Summary / Instructions | "Welcome to HiFitComp..." |
| `why_subtitle` | Why Section - Subtitle | "See what's new" |
| `why_heading` | Why Section - Heading | "Why HiFitComp" |
| `why_card1_title` | Why Card 1 Title | "Any Competition" |
| `why_card1_desc` | Why Card 1 Description | "Music, modeling..." |
| `why_card2_title` | Why Card 2 Title | "Public Voting" |
| `why_card2_desc` | Why Card 2 Description | "Fair, transparent voting..." |
| `why_card3_title` | Why Card 3 Title | "Rich Profiles" |
| `why_card3_desc` | Why Card 3 Description | "Upload photos, videos..." |
| `hiw_section_title` | How It Works - Title | "How It Works" |
| `hiw_step1_title` | Step 1 Title | "Create Your Profile" |
| `hiw_step1_desc` | Step 1 Description | "Sign up, set up..." |
| `hiw_step2_title` | Step 2 Title | "Apply to Compete" |
| `hiw_step2_desc` | Step 2 Description | "Browse active competitions..." |
| `hiw_step3_title` | Step 3 Title | "Win Public Votes" |
| `hiw_step3_desc` | Step 3 Description | "Once approved, share..." |
| `how_voting_works` | How Voting Works (modal) | Full markdown content |
| `how_nominations_work` | How Nominations Work (modal) | Full markdown content |
| `about_rules_text` | About Page - Rules | Full markdown content |
| `about_details_text` | About Page - Fine Print | Full markdown content |
| `social_facebook` | Facebook URL | "" |
| `social_instagram` | Instagram URL | "" |
| `social_twitter` | X / Twitter URL | "" |
| `social_youtube` | YouTube URL | "" |
| `social_tiktok` | TikTok URL | "" |
| `contact_email` | Contact Email | "admin@hifitcomp.com" |
| `contact_phone` | Contact Phone | "" |
| `contact_address` | Contact Address | "" |
| `faq_1_q` through `faq_19_q` | FAQ Questions | Various |
| `faq_1_a` through `faq_19_a` | FAQ Answers | Various |
| `email_welcome_subject` | Welcome Email Subject | "{inviterName} invited you..." |
| `email_welcome_heading` | Welcome Email Heading | "You've Been Invited!" |
| `email_welcome_body` | Welcome Email Body | Full template with {variables} |
| `email_receipt_subject` | Receipt Email Subject | "Your Purchase Receipt" |
| `email_receipt_heading` | Receipt Email Heading | "Purchase Receipt" |
| `email_receipt_body` | Receipt Email Body | Full template with {variables} |
| `email_receipt_footer` | Receipt Email Footer | "If you have questions..." |

---

## 12. Pages Using the Livery System

| Page / Component | Slots Used |
|-----------------|------------|
| Landing Page | `hero_background`, `hero_title_top`, `hero_title_main`, `hero_summary`, `feature_background`, `why_*`, `hiw_*`, `cta_background`, `how_voting_works`, `how_nominations_work` |
| Site Navbar | `logo` |
| Site Footer | `social_*`, `contact_*` |
| Competitions Page | `competitions_header`, `competition_card_fallback` |
| Competition Detail | `competition_detail_header` |
| Login / Join / Host / Checkout | `breadcrumb_bg` |
| About Page | `about_rules_text`, `about_details_text` |
| FAQ Page | `faq_1_q` through `faq_19_a` |
| App.tsx (head) | `site_favicon` |
| Email System | `email_welcome_*`, `email_receipt_*` |

---

## 13. Porting to a New Project

To add this system to a different template project:

1. **Copy these files:**
   - `client/src/hooks/use-livery.ts` (frontend hook)
   - Firestore livery CRUD functions from `server/firestore-collections.ts`
   - Seed function and `LIVERY_DEFAULTS` array from `server/seed.ts`
   - Livery API routes from `server/routes.ts`
   - Admin livery tab UI from `client/src/pages/admin-dashboard.tsx`

2. **Update `LIVERY_DEFAULTS`** with your new template's image paths and text content.

3. **Replace hardcoded template references** in your frontend with `getImage()`, `getMedia()`, or `getText()` calls.

4. **Place template originals** in your `/public/images/template/` directory.

5. **Call `seedLivery()`** on server startup to populate Firestore.

6. **Set up Firebase Storage** for file uploads (or swap with any storage provider — just change the upload function in the route handler).

The system is template-agnostic. The only project-specific parts are the `LIVERY_DEFAULTS` array and the frontend component markup that references the keys.
