# HiFitComp Livery System — Complete Documentation

## Overview

The livery system lets admins replace any of the template's placeholder images/videos **and** editable text blocks from the admin dashboard, without touching code. Each livery item has a unique `imageKey` that maps to a specific visual slot on the site.

---

## Data Model

Each livery item is stored in Firestore (collection: `livery`) with these fields:

| Field | Type | Description |
|---|---|---|
| `imageKey` | `string` | Unique identifier (e.g. `hero_background`) — also the Firestore document ID |
| `label` | `string` | Human-readable name shown in the admin UI |
| `defaultUrl` | `string` | Path to the original template image (e.g. `/images/template/bg-1.jpg`) |
| `imageUrl` | `string \| null` | Custom replacement URL; `null` means use default |
| `mediaType` | `"image" \| "video"` | Whether the uploaded file is an image or video (videos are 15s max) |
| `itemType` | `"media" \| "text"` | `"media"` (default) for image/video slots, `"text"` for editable text blocks |
| `textContent` | `string \| null` | Custom text content; `null` means use `defaultText` (only for `itemType: "text"`) |
| `defaultText` | `string \| null` | Fallback text (only for `itemType: "text"`) |

### TypeScript Interface

```typescript
// server/firestore-collections.ts
export interface FirestoreLiveryItem {
  imageKey: string;
  label: string;
  imageUrl: string | null;
  defaultUrl: string;
  mediaType?: "image" | "video";
  textContent?: string | null;
  defaultText?: string | null;
  itemType?: "media" | "text";
}
```

---

## Seed Defaults

Defined in `server/seed.ts` as `LIVERY_DEFAULTS`. On app startup, `seedLivery()` ensures all defaults exist in Firestore and removes any that are no longer in the defaults array.

```typescript
const LIVERY_DEFAULTS = [
  { imageKey: "logo", label: "Site Logo", defaultUrl: "/images/template/logo.png" },
  { imageKey: "hero_background", label: "Hero Background (Landing)", defaultUrl: "/images/template/bg-1.jpg" },
  { imageKey: "feature_background", label: "Feature Section Background (Landing)", defaultUrl: "/images/template/bg-2.jpg" },
  { imageKey: "cta_background", label: "Call to Action Background (Landing)", defaultUrl: "/images/template/breadcumb.jpg" },
  { imageKey: "breadcrumb_bg", label: "Page Header Background (Login, Join, Host, Checkout, Purchases)", defaultUrl: "/images/template/breadcumb.jpg" },
  { imageKey: "competitions_header", label: "Competitions Page Header", defaultUrl: "/images/template/breadcumb2.jpg" },
  { imageKey: "competition_detail_header", label: "Competition Detail Header", defaultUrl: "/images/template/breadcumb3.jpg" },
  { imageKey: "category_music", label: "Category Card - Music (Landing)", defaultUrl: "/images/template/a1.jpg" },
  { imageKey: "category_modeling", label: "Category Card - Modeling (Landing)", defaultUrl: "/images/template/a2.jpg" },
  { imageKey: "category_bodybuilding", label: "Category Card - Bodybuilding (Landing)", defaultUrl: "/images/template/b1.jpg" },
  { imageKey: "category_dance", label: "Category Card - Dance (Landing)", defaultUrl: "/images/template/a4.jpg" },
  { imageKey: "competition_card_fallback", label: "Default Competition Card Image", defaultUrl: "/images/template/e1.jpg" },
  { imageKey: "talent_profile_fallback", label: "Default Talent Profile Image", defaultUrl: "/images/template/a1.jpg" },
  { imageKey: "hero_summary", label: "Hero Summary / Instructions", defaultUrl: "", itemType: "text", defaultText: "Welcome to HiFitComp — the ultimate talent competition platform. Browse competitions, vote for your favorites, join as a competitor, or host your own event. Get started today!" },
];
```

### Seed Function

```typescript
export async function seedLivery() {
  const existing = await firestoreLivery.getAll();
  const existingKeys = new Set(existing.map((l) => l.imageKey));
  const validKeys = new Set(LIVERY_DEFAULTS.map((l) => l.imageKey));

  // Add any missing defaults
  for (const item of LIVERY_DEFAULTS) {
    if (!existingKeys.has(item.imageKey)) {
      await firestoreLivery.upsert({ ...item, imageUrl: null });
    }
  }

  // Remove any items no longer in defaults
  for (const item of existing) {
    if (!validKeys.has(item.imageKey)) {
      await firestoreLivery.delete(item.imageKey);
    }
  }
}
```

---

## Firestore CRUD Operations

Located in `server/firestore-collections.ts`:

```typescript
export const firestoreLivery = {
  async getAll(): Promise<FirestoreLiveryItem[]> {
    const snapshot = await db().collection("livery").get();
    const items = snapshot.docs.map(doc => doc.data() as FirestoreLiveryItem);
    return items.sort((a, b) => a.label.localeCompare(b.label));
  },

  async getByKey(imageKey: string): Promise<FirestoreLiveryItem | null> {
    const doc = await db().collection("livery").doc(imageKey).get();
    if (!doc.exists) return null;
    return doc.data() as FirestoreLiveryItem;
  },

  async upsert(item: FirestoreLiveryItem): Promise<FirestoreLiveryItem> {
    await db().collection("livery").doc(item.imageKey).set(item);
    return item;
  },

  async updateImage(imageKey: string, imageUrl: string | null, mediaType?: "image" | "video"): Promise<FirestoreLiveryItem | null> {
    const ref = db().collection("livery").doc(imageKey);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const updateData: any = { imageUrl };
    if (mediaType !== undefined) updateData.mediaType = mediaType;
    if (imageUrl === null) updateData.mediaType = "image";
    await ref.update(updateData);
    const updated = await ref.get();
    return updated.data() as FirestoreLiveryItem;
  },

  async updateText(imageKey: string, textContent: string | null): Promise<FirestoreLiveryItem | null> {
    const ref = db().collection("livery").doc(imageKey);
    const doc = await ref.get();
    if (!doc.exists) return null;
    await ref.update({ textContent });
    const updated = await ref.get();
    return updated.data() as FirestoreLiveryItem;
  },

  async delete(imageKey: string): Promise<void> {
    await db().collection("livery").doc(imageKey).delete();
  },
};
```

---

## Storage Interface

Located in `server/storage.ts` — wraps Firestore calls:

```typescript
export interface IStorage {
  // ... other methods ...
  getAllLivery(): Promise<FirestoreLiveryItem[]>;
  getLiveryByKey(imageKey: string): Promise<FirestoreLiveryItem | null>;
  upsertLivery(item: FirestoreLiveryItem): Promise<FirestoreLiveryItem>;
  updateLiveryImage(imageKey: string, imageUrl: string | null, mediaType?: "image" | "video"): Promise<FirestoreLiveryItem | null>;
  updateLiveryText(imageKey: string, textContent: string | null): Promise<FirestoreLiveryItem | null>;
}
```

---

## API Routes

Located in `server/routes.ts`:

### GET /api/livery
Returns all livery items. Public endpoint (no auth required).

### PUT /api/admin/livery/:imageKey
Upload a replacement image or video. Admin-only (Firebase JWT + admin role check).
- Content-Type: `multipart/form-data`
- Field name: `image`
- Accepts: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.mp4`, `.webm`, `.mov`
- Max file size: 50MB
- Videos must be 15 seconds or shorter
- Files saved to: `client/public/uploads/livery/`
- Response: Updated livery item JSON

### PUT /api/admin/livery/:imageKey/text
Update text content for a text-type livery item. Admin-only.
- Content-Type: `application/json`
- Body: `{ "textContent": "your text here" }`
- Response: Updated livery item JSON

### DELETE /api/admin/livery/:imageKey
Reset a livery item to its default. Admin-only.
- Sets `imageUrl` to `null` (reverts to `defaultUrl`)
- For text items, admin sends empty string via the text PUT route instead

### File Upload Configuration (Multer)

```typescript
const uploadsDir = path.resolve(process.cwd(), "client/public/uploads/livery");

const liveryUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedImages = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    const allowedVideos = /\.(mp4|webm|mov)$/i;
    if (allowedImages.test(path.extname(file.originalname)) || allowedVideos.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed"));
    }
  },
});
```

### Video Duration Check

```typescript
function isVideoFile(filename: string): boolean {
  return /\.(mp4|webm|mov)$/i.test(filename);
}

async function getVideoDuration(filePath: string): Promise<number> {
  const { execSync } = require("child_process");
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: "utf-8", timeout: 10000 }
    );
    return parseFloat(output.trim());
  } catch {
    return -1;
  }
}
```

---

## Frontend Hook: useLivery()

Located in `client/src/hooks/use-livery.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";

interface LiveryItem {
  imageKey: string;
  label: string;
  imageUrl: string | null;
  defaultUrl: string;
  mediaType?: "image" | "video";
  textContent?: string | null;
  defaultText?: string | null;
  itemType?: "media" | "text";
}

export function useLivery() {
  const { data: items, isLoading } = useQuery<LiveryItem[]>({
    queryKey: ["/api/livery"],
    staleTime: 5 * 60 * 1000,
  });

  // Returns the image URL (custom or default)
  const getImage = (imageKey: string, fallback?: string): string => {
    if (!items) return fallback || "";
    const item = items.find((i) => i.imageKey === imageKey);
    if (!item) return fallback || "";
    return item.imageUrl || item.defaultUrl;
  };

  // Returns just the media type
  const getMediaType = (imageKey: string): "image" | "video" => {
    if (!items) return "image";
    const item = items.find((i) => i.imageKey === imageKey);
    return item?.mediaType || "image";
  };

  // Returns both URL and type (for conditional <video>/<img> rendering)
  const getMedia = (imageKey: string, fallback?: string): { url: string; type: "image" | "video" } => {
    if (!items) return { url: fallback || "", type: "image" };
    const item = items.find((i) => i.imageKey === imageKey);
    if (!item) return { url: fallback || "", type: "image" };
    return {
      url: item.imageUrl || item.defaultUrl,
      type: item?.mediaType || "image",
    };
  };

  // Returns text content (custom or default)
  const getText = (imageKey: string, fallback?: string): string => {
    if (!items) return fallback || "";
    const item = items.find((i) => i.imageKey === imageKey);
    if (!item) return fallback || "";
    return item.textContent || item.defaultText || fallback || "";
  };

  return { items, isLoading, getImage, getMediaType, getMedia, getText };
}
```

---

## Frontend Usage Patterns

### Pattern 1: Image-only slot (e.g. logo)

```jsx
const { getImage } = useLivery();

<img src={getImage("logo", "/images/template/logo.png")} alt="Logo" />
```

### Pattern 2: Image or video slot (e.g. hero background)

```jsx
const { getImage, getMedia } = useLivery();

{getMedia("hero_background", "/images/template/bg-1.jpg").type === "video" ? (
  <video
    src={getMedia("hero_background", "/images/template/bg-1.jpg").url}
    className="w-full h-full object-cover"
    autoPlay muted loop playsInline
  />
) : (
  <img
    src={getImage("hero_background", "/images/template/bg-1.jpg")}
    alt=""
    className="w-full h-full object-cover"
  />
)}
```

### Pattern 3: Text content slot (e.g. hero summary)

```jsx
const { getText } = useLivery();

{getText("hero_summary") && (
  <p className="mt-8 max-w-3xl mx-auto text-white/70 text-base md:text-lg">
    {getText("hero_summary")}
  </p>
)}
```

---

## Exact Mapping: imageKey → Page Location

### Landing Page (`client/src/pages/landing.tsx`)

| imageKey | Section | Element | CSS Classes |
|---|---|---|---|
| `hero_background` | Hero (full-screen) | Background image/video behind text | `w-full h-full object-cover scale-110` with `bg-black/35` overlay |
| `hero_summary` | Hero (below buttons) | Text paragraph | `mt-8 max-w-3xl mx-auto text-white/70 text-base md:text-lg` |
| `category_music` | Category Grid | Music card background | `w-full h-full object-cover` in `aspect-[4/5]` container |
| `category_modeling` | Category Grid | Modeling card background | Same as above |
| `category_bodybuilding` | Category Grid | Bodybuilding card background | Same as above |
| `category_dance` | Category Grid | Dance card background | Same as above |
| `feature_background` | "Why Compete?" parallax | Background image/video | `absolute inset-0` with `bg-black/60` overlay, `bg-fixed` on container |
| `cta_background` | "Ready to Compete?" CTA | Background image/video | `absolute inset-0 object-cover` with `bg-black/70` overlay |

### Competitions Page (`client/src/pages/competitions.tsx`)

| imageKey | Section | Element |
|---|---|---|
| `competitions_header` | Breadcrumb header | Background image/video |
| `competition_card_fallback` | Competition cards | Fallback image when competition has no custom image |

### Competition Detail Page (`client/src/pages/competition-detail.tsx`)

| imageKey | Section | Element |
|---|---|---|
| `competition_detail_header` | Breadcrumb header | Background image/video |

### Login, Join, Host, Checkout, My Purchases Pages

| imageKey | Section | Element |
|---|---|---|
| `breadcrumb_bg` | Breadcrumb header | Shared background image/video for all these pages |

### Navbar & Footer (all pages)

| imageKey | Section | Element |
|---|---|---|
| `logo` | Navbar + Footer | Site logo image |

### Talent Profile Page

| imageKey | Section | Element |
|---|---|---|
| `talent_profile_fallback` | Profile header | Fallback image when talent has no profile photo |

---

## Admin Dashboard Livery Tab

Located in `client/src/pages/admin-dashboard.tsx`, under the "Livery" tab.

### Media Items (images/videos)

Rendered in a 3-column grid. Each card shows:
- **Thumbnail preview** — image or auto-playing muted video
- **Badges** — "Video" (blue) if video, "Custom" (orange) if replaced
- **Label** and **imageKey** (monospace)
- **Upload button** — triggers hidden file input (accepts `image/*,video/mp4,video/webm,video/quicktime`)
- **Reset button** — only shown when custom; calls `DELETE /api/admin/livery/:imageKey`

### Text Items (editable text blocks)

Rendered below the media grid. Each block shows:
- **Label** and **imageKey** (monospace)
- **"Custom" badge** — when text has been edited from default
- **Textarea** — pre-filled with current text (custom or default), 4 rows
- **Save Text button** — sends `PUT /api/admin/livery/:imageKey/text`
- **Reset to Default button** — only shown when custom; sends empty string to clear

### Admin Mutations

```typescript
// Upload image/video
const uploadLiveryMutation = useMutation({
  mutationFn: async ({ imageKey, file }: { imageKey: string; file: File }) => {
    const formData = new FormData();
    formData.append("image", file);
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`/api/admin/livery/${imageKey}`, {
      method: "PUT",
      body: formData,
      headers,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Upload failed");
    }
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/livery"] });
  },
});

// Reset image/video to default
const resetLiveryMutation = useMutation({
  mutationFn: async (imageKey: string) => {
    await apiRequest("DELETE", `/api/admin/livery/${imageKey}`);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/livery"] });
  },
});

// Update text content
const updateLiveryTextMutation = useMutation({
  mutationFn: async ({ imageKey, textContent }: { imageKey: string; textContent: string }) => {
    await apiRequest("PUT", `/api/admin/livery/${imageKey}/text`, { textContent });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/livery"] });
  },
});
```

---

## Template Image Files

All default images live in `client/public/images/template/`:

| File | Used By |
|---|---|
| `logo.png` | Site logo |
| `bg-1.jpg` | Hero background |
| `bg-2.jpg` | Feature/parallax section background |
| `breadcumb.jpg` | Page header breadcrumb + CTA background |
| `breadcumb2.jpg` | Competitions page header |
| `breadcumb3.jpg` | Competition detail header |
| `a1.jpg` | Category card: Music + talent profile fallback |
| `a2.jpg` | Category card: Modeling |
| `a4.jpg` | Category card: Dance |
| `b1.jpg` | Category card: Bodybuilding |
| `e1.jpg` | Competition card fallback |

Custom uploads are saved to: `client/public/uploads/livery/`

---

## How to Reuse in Another Project

1. **Copy the defaults array** from `server/seed.ts` — adjust `imageKey`, `label`, `defaultUrl` entries to match your template's image files
2. **Copy the `FirestoreLiveryItem` interface** and `firestoreLivery` Firestore functions from `server/firestore-collections.ts`
3. **Copy the storage interface methods** from `server/storage.ts`
4. **Copy the API routes** from `server/routes.ts` (GET, PUT, PUT text, DELETE) along with the multer and video duration helpers
5. **Copy the `useLivery()` hook** from `client/src/hooks/use-livery.ts`
6. **In each page/component**, call `getImage()`, `getMedia()`, or `getText()` with the appropriate `imageKey`
7. **Copy the admin dashboard livery tab UI** from `client/src/pages/admin-dashboard.tsx`
8. **Place your template's default images** in `client/public/images/template/`
9. **Create the uploads directory**: `client/public/uploads/livery/`
