# TV Network Setup - Library Links Pattern

How to let creators upload content directly to Google Drive folders and Vimeo projects from your admin dashboard, using stored links per brand.

---

## How It Works (Overview)

1. **Admin assigns "Library Links" to a creator's brand** — each link points to a Google Drive folder or Vimeo project URL
2. **Creator logs into their dashboard** and sees their brand(s) with clickable library link buttons
3. **Creator clicks a link** → it expands to show existing files/videos in that folder AND an upload button
4. **Creator picks a file** → gets a confirm screen where they can rename it, see the final filename (with optional naming pattern appended), and upload
5. **File goes directly to the correct Google Drive folder or Vimeo project** via your backend acting as a proxy with service account credentials

---

## Architecture

```
┌─────────────────────┐
│   Creator Dashboard  │  (React frontend)
│   LibraryLinkManager │
│   component          │
└──────────┬──────────┘
           │  FormData upload
           ▼
┌─────────────────────┐
│   Express Backend    │  (Node.js + multer)
│   /api/admin/drive/* │
│   /api/admin/vimeo/* │
└──────────┬──────────┘
           │  Service Account / API Token
           ▼
┌─────────────────────┐
│  Google Drive API    │  OR  │  Vimeo API  │
│  (googleapis v3)     │      │  (REST/TUS) │
└─────────────────────┘
```

**Data flow for brand/URL storage:**

```
Admin creates brand → Firebase Firestore `brand_urls` collection
Creator loads dashboard → GET /api/creator/:id/brands-with-urls → reads from Firestore
```

---

## 1. Data Model — Brand URLs (Firestore)

Each library link is stored in a `brand_urls` Firestore collection:

```typescript
// Firestore document structure
interface BrandUrl {
  id: string;           // Firestore doc ID
  brandId: string;      // Which brand this link belongs to
  urlType: string;      // 'library_link' for unlimited entries
  urlValue: string;     // Full URL to Google Drive folder or Vimeo project
  label?: string;       // Custom display name (e.g., "Brand Trailer", "Images & Public Data")
  namingPattern?: string; // Optional suffix appended to filenames (e.g., " - BrandName")
  createdAt: Timestamp;
}
```

**Key design decision:** `urlType: 'library_link'` allows unlimited entries per brand. Other URL types are unique per brand (one per type).

### Firestore CRUD Functions

```typescript
// notification-service.ts

// GET all URLs for a brand
export async function getBrandUrlsFromFirebase(brandId: string): Promise<BrandUrl[]> {
  const firestore = admin.firestore();
  const snapshot = await firestore.collection('brand_urls')
    .where('brandId', '==', brandId)
    .get();
  
  const urls: BrandUrl[] = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    urls.push({
      id: doc.id,
      brandId: data.brandId,
      urlType: data.urlType,
      urlValue: data.urlValue,
      label: data.label,
      namingPattern: data.namingPattern,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
    });
  });
  return urls;
}

// CREATE a new library link
export async function addBrandUrlInFirebase(urlData: {
  brandId: string;
  urlType: string;
  urlValue: string;
  label?: string;
  namingPattern?: string;
}): Promise<BrandUrl | null> {
  const firestore = admin.firestore();
  
  // For 'library_link' type, always create new (unlimited per brand)
  // For legacy types, check for existing and update instead
  if (urlData.urlType !== 'library_link') {
    const existing = await firestore.collection('brand_urls')
      .where('brandId', '==', urlData.brandId)
      .where('urlType', '==', urlData.urlType)
      .get();
    
    if (!existing.empty) {
      // Update existing instead of creating duplicate
      const doc = existing.docs[0];
      await doc.ref.update({
        urlValue: urlData.urlValue,
        label: urlData.label,
        namingPattern: urlData.namingPattern,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { id: doc.id, ...urlData, createdAt: doc.data().createdAt };
    }
  }
  
  const docRef = await firestore.collection('brand_urls').add({
    brandId: urlData.brandId,
    urlType: urlData.urlType,
    urlValue: urlData.urlValue,
    label: urlData.label,
    namingPattern: urlData.namingPattern,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return { id: docRef.id, ...urlData, createdAt: new Date().toISOString() };
}

// DELETE by document ID
export async function deleteBrandUrlFromFirebase(urlId: string): Promise<boolean> {
  const firestore = admin.firestore();
  await firestore.collection('brand_urls').doc(urlId).delete();
  return true;
}

// UPDATE label only
export async function updateBrandUrlLabelInFirebase(urlId: string, label: string): Promise<boolean> {
  const firestore = admin.firestore();
  await firestore.collection('brand_urls').doc(urlId).update({
    label,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return true;
}
```

---

## 2. Backend API Routes

### Multer Setup (File Upload Middleware)

```typescript
// routes.ts - top of file
import multer from "multer";

// Memory storage for streaming to external APIs (Google Drive / Vimeo)
const driveUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
});
```

### Brand URL Management Routes

```typescript
// GET all URLs for a brand
app.get("/api/admin/brand/:brandId/urls", async (req, res) => {
  const { brandId } = req.params;
  const urls = await getBrandUrlsFromFirebase(brandId);
  res.json(urls);
});

// CREATE a new library link for a brand
app.post("/api/admin/brand/:brandId/urls", async (req, res) => {
  const { brandId } = req.params;
  const { urlType, urlValue, label, namingPattern } = req.body;
  
  // If urlValue is empty, treat as delete
  if (!urlValue || urlValue.trim() === '') {
    await deleteBrandUrlByType(brandId, urlType);
    res.json({ success: true });
    return;
  }
  
  const result = await addBrandUrlInFirebase({ brandId, urlType, urlValue, label, namingPattern });
  res.json(result);
});

// DELETE a specific URL by ID
app.delete("/api/admin/brand-url/:urlId", async (req, res) => {
  const { urlId } = req.params;
  const success = await deleteBrandUrlFromFirebase(urlId);
  res.json({ success });
});

// UPDATE label on a URL
app.patch("/api/admin/brand-url/:urlId/label", async (req, res) => {
  const { urlId } = req.params;
  const { label } = req.body;
  const success = await updateBrandUrlLabelInFirebase(urlId, label);
  res.json({ success });
});

// GET creator's brands WITH their URLs (for creator dashboard)
app.get("/api/creator/:creatorId/brands-with-urls", async (req, res) => {
  const { creatorId } = req.params;
  const brands = await getCreatorBrandsFromFirebase(creatorId);
  
  const brandsWithUrls = await Promise.all(
    brands.map(async (brand) => {
      const urls = await getBrandUrlsFromFirebase(brand.id);
      return { ...brand, urls };
    })
  );
  
  res.json(brandsWithUrls);
});
```

### Google Drive Upload Route

```typescript
app.post("/api/admin/drive/upload", driveUpload.single('file'), async (req, res) => {
  const { folderUrl } = req.body;
  const file = req.file;

  if (!file) { res.status(400).json({ message: "No file provided" }); return; }
  if (!folderUrl) { res.status(400).json({ message: "No folder URL provided" }); return; }

  // Extract folder ID from URL like:
  // https://drive.google.com/drive/folders/1ABC123xyz
  const folderIdMatch = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (!folderIdMatch) { res.status(400).json({ message: "Invalid Google Drive folder URL" }); return; }
  const folderId = folderIdMatch[1];

  // Initialize Google Drive API with service account
  const { google } = require('googleapis');
  const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  // Stream file buffer to Google Drive
  const { Readable } = require('stream');
  const bufferStream = new Readable();
  bufferStream.push(file.buffer);
  bufferStream.push(null);

  const customFileName = req.body.customFileName || file.originalname;

  const response = await drive.files.create({
    requestBody: {
      name: customFileName,
      parents: [folderId],
    },
    media: {
      mimeType: file.mimetype,
      body: bufferStream,
    },
    fields: 'id, name, webViewLink, size',
  });

  res.json({
    message: "File uploaded successfully",
    file: {
      id: response.data.id,
      name: response.data.name,
      link: response.data.webViewLink,
      size: response.data.size,
    }
  });
});
```

**Important:** The Google Drive folder must have the service account email added as an Editor. The service account email is in your credentials JSON (`client_email` field).

### Google Drive List Files Route

```typescript
app.get("/api/admin/drive/folder-files", async (req, res) => {
  const folderUrl = req.query.folderUrl as string;
  const folderIdMatch = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  const folderId = folderIdMatch[1];

  // Initialize drive API (same as upload)
  const drive = /* ... initialized Google Drive client ... */;

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, thumbnailLink, webViewLink, webContentLink, size, createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 100,
  });

  res.json({ files: response.data.files || [] });
});
```

### Vimeo Upload Route (TUS Protocol)

```typescript
// Helper: get Vimeo user ID from access token
async function getVimeoUserId(token: string): Promise<string> {
  const resp = await fetch('https://api.vimeo.com/me', {
    headers: {
      'Authorization': `bearer ${token}`,
      'Accept': 'application/vnd.vimeo.*+json;version=3.4'
    }
  });
  const data = await resp.json();
  return data.uri.split('/').pop();
}

app.post("/api/admin/vimeo/upload", driveUpload.single('file'), async (req, res) => {
  const { folderUrl, fileName } = req.body;
  const file = req.file;

  // Extract project/folder ID from Vimeo URL like:
  // https://vimeo.com/manage/folder/12345678
  // https://vimeo.com/manage/projects/12345678
  const folderMatch = folderUrl.match(/\/folder\/(\d+)/);
  const projectMatch = folderUrl.match(/\/projects\/(\d+)/);
  const folderId = folderMatch?.[1] || projectMatch?.[1];

  const token = process.env.VIMEO_ACCESS_TOKEN;
  const videoName = fileName || file.originalname;

  // Step 1: Create video entry on Vimeo (TUS approach)
  const createResponse = await fetch('https://api.vimeo.com/me/videos', {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.vimeo.*+json;version=3.4'
    },
    body: JSON.stringify({
      upload: {
        approach: 'tus',
        size: file.size
      },
      name: videoName,
      folder_uri: `/users/${await getVimeoUserId(token)}/projects/${folderId}`
    })
  });

  const createData = await createResponse.json();
  const uploadLink = createData.upload?.upload_link;
  const videoUri = createData.uri;

  // Step 2: Upload the actual file bytes via TUS protocol
  const uploadResponse = await fetch(uploadLink, {
    method: 'PATCH',
    headers: {
      'Tus-Resumable': '1.0.0',
      'Upload-Offset': '0',
      'Content-Type': 'application/offset+octet-stream'
    },
    body: file.buffer
  });

  // Step 3: Move video into the correct project folder
  await fetch(`https://api.vimeo.com/me/projects/${folderId}/videos/${videoUri.split('/').pop()}`, {
    method: 'PUT',
    headers: {
      'Authorization': `bearer ${token}`,
      'Accept': 'application/vnd.vimeo.*+json;version=3.4'
    }
  });

  const videoId = videoUri.split('/').pop();
  res.json({ success: true, videoId, videoUri, name: videoName });
});
```

### Vimeo List Videos Route

```typescript
app.get("/api/admin/vimeo/folder-videos", async (req, res) => {
  const folderUrl = req.query.folderUrl as string;
  const folderMatch = folderUrl.match(/\/folder\/(\d+)/);
  const projectMatch = folderUrl.match(/\/projects\/(\d+)/);
  const folderId = folderMatch?.[1] || projectMatch?.[1];

  const token = process.env.VIMEO_ACCESS_TOKEN;

  const vimeoResponse = await fetch(
    `https://api.vimeo.com/me/projects/${folderId}/items?per_page=50&fields=type,video.uri,video.name,video.description,video.duration,video.pictures,video.player_embed_url`,
    {
      headers: {
        'Authorization': `bearer ${token}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    }
  );

  const data = await vimeoResponse.json();
  const videos = (data.data || [])
    .filter((item: any) => item.type === 'video' && item.video)
    .map((item: any) => {
      const v = item.video;
      const videoId = v.uri?.split('/').pop();
      const thumbnail = v.pictures?.sizes?.find((s: any) => s.width >= 295)?.link;
      return { id: videoId, name: v.name, duration: v.duration, thumbnail };
    });

  res.json({ videos });
});
```

### Vimeo Rename Video Route

```typescript
app.patch("/api/admin/vimeo/video/:videoId/rename", async (req, res) => {
  const { videoId } = req.params;
  const { name } = req.body;
  const token = process.env.VIMEO_ACCESS_TOKEN;

  await fetch(`https://api.vimeo.com/videos/${videoId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.vimeo.*+json;version=3.4'
    },
    body: JSON.stringify({ name: name.trim() })
  });

  res.json({ success: true });
});
```

---

## 3. Frontend Component — LibraryLinkManager

This is the component creators interact with. Each library link renders as a colored button that expands to show files and an upload area.

```tsx
// LibraryLinkManager component
function LibraryLinkManager({ folderUrl, label, namingPattern, color, urlId }: {
  folderUrl: string;
  label: string;
  namingPattern?: string;
  color: string;       // 'purple' | 'blue' | 'green' | 'amber'
  urlId?: string;
}) {
  const [uploading, setUploading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [files, setFiles] = useState([])          // Google Drive files
  const [vimeoVideos, setVimeoVideos] = useState([]) // Vimeo videos
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [customFileName, setCustomFileName] = useState('')
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const isGoogleDrive = folderUrl.includes('drive.google.com')
  const isVimeo = folderUrl.includes('vimeo.com')

  // --- Load existing content when expanded ---
  const loadFiles = async () => {
    const resp = await fetch(`/api/admin/drive/folder-files?folderUrl=${encodeURIComponent(folderUrl)}`)
    const data = await resp.json()
    if (resp.ok) setFiles(data.files || [])
  }

  const loadVimeoVideos = async () => {
    const resp = await fetch(`/api/admin/vimeo/folder-videos?folderUrl=${encodeURIComponent(folderUrl)}`)
    const data = await resp.json()
    if (resp.ok) setVimeoVideos(data.videos || [])
  }

  const handleToggle = () => {
    if (!expanded) {
      if (isGoogleDrive) loadFiles()
      if (isVimeo) loadVimeoVideos()
    }
    setExpanded(!expanded)
  }

  // --- File naming logic ---
  // Naming pattern appends to END of custom filename (not original filename)
  // Vimeo: excludes file extension (.mp4)
  // Google Drive: keeps file extension
  const getExtension = (file: File) => {
    const parts = file.name.split('.')
    return parts.length > 1 ? `.${parts.pop()}` : ''
  }

  const getFinalFilename = (file: File) => {
    const baseName = customFileName || file.name.replace(/\.[^/.]+$/, '')
    if (isVimeo) {
      // Vimeo: no extension, append naming pattern
      return namingPattern ? `${baseName}${namingPattern}` : baseName
    }
    // Google Drive: keep extension, append naming pattern before extension
    const ext = getExtension(file)
    return namingPattern ? `${baseName}${namingPattern}${ext}` : `${baseName}${ext}`
  }

  // --- Handle file selection (shows confirm screen) ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setCustomFileName(file.name.replace(/\.[^/.]+$/, ''))  // default to original name without ext
    setResult(null)
  }

  // --- Confirm and upload ---
  const handleConfirmUpload = async () => {
    if (!pendingFile) return
    setUploading(true)
    const finalName = getFinalFilename(pendingFile)

    const formData = new FormData()
    formData.append('file', pendingFile)
    formData.append('folderUrl', folderUrl)

    if (isVimeo) {
      formData.append('fileName', finalName)
      const response = await fetch('/api/admin/vimeo/upload', { method: 'POST', body: formData })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setResult({ type: 'success', text: `Uploaded "${finalName}" to Vimeo` })
      loadVimeoVideos()  // refresh list
    } else {
      formData.append('customFileName', finalName)
      const response = await fetch('/api/admin/drive/upload', { method: 'POST', body: formData })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setResult({ type: 'success', text: `Saved as "${finalName}"` })
      loadFiles()  // refresh list
    }

    setPendingFile(null)
    setUploading(false)
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Colored header button */}
      <button onClick={handleToggle} className={`w-full px-4 py-3 ${colorClass} text-white font-medium`}>
        {isVimeo ? '🎥' : '📁'} {label}
        {expanded ? '▲' : '▼'}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Naming pattern notice */}
          {namingPattern && (
            <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3">
              Files will have "{namingPattern}" added to the end of whatever you name them.
            </div>
          )}

          {/* File picker OR confirm screen */}
          {!pendingFile ? (
            <label className="cursor-pointer px-3 py-2 bg-green-600 text-white rounded-lg">
              <input type="file" className="hidden" onChange={handleFileSelect}
                accept={isVimeo ? "video/*" : "image/*,video/*,.pdf,.doc,.docx,.txt"} />
              {isVimeo ? 'Upload Video' : 'Select File'}
            </label>
          ) : (
            <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
              <p>Selected: {pendingFile.name}</p>
              <input value={customFileName} onChange={(e) => setCustomFileName(e.target.value)}
                placeholder="Enter file name..." />
              <p>Will be saved as: <strong>{getFinalFilename(pendingFile)}</strong></p>
              <button onClick={handleConfirmUpload} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Confirm & Upload'}
              </button>
              <button onClick={() => setPendingFile(null)}>Cancel</button>
            </div>
          )}

          {/* Success/error message */}
          {result && (
            <div className={result.type === 'success' ? 'bg-green-900/40' : 'bg-red-900/40'}>
              {result.text}
            </div>
          )}

          {/* File/video list grid */}
          {isGoogleDrive && files.map(file => (
            <div key={file.id}>
              {file.thumbnailLink && <img src={file.thumbnailLink} />}
              <p>{file.name}</p>
            </div>
          ))}

          {isVimeo && vimeoVideos.map(video => (
            <div key={video.id}>
              {video.thumbnail && <img src={video.thumbnail} />}
              <p>{video.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### How the Creator Dashboard Renders Library Links

```tsx
// Inside the creator dashboard component
const { data: creatorBrandsWithUrls = [] } = useQuery({
  queryKey: ['/api/creator', adminUser?.id, 'brands-with-urls'],
  enabled: !!adminUser?.id && adminUser?.userLevel === 2,
  queryFn: async () => {
    const response = await fetch(`/api/creator/${adminUser?.id}/brands-with-urls`)
    if (!response.ok) return []
    return response.json()
  }
})

// Render
{creatorBrandsWithUrls.map((brand) => (
  <div key={brand.id}>
    <p className="text-lg font-semibold text-green-400">{brand.brandName}</p>
    {brand.urls.map((link, idx) => (
      <LibraryLinkManager
        key={link.id || idx}
        folderUrl={link.urlValue}
        label={link.label || link.urlType}
        namingPattern={link.namingPattern}
        color={link.urlValue.includes('vimeo.com') ? 'blue' : 'purple'}
        urlId={link.id}
      />
    ))}
  </div>
))}
```

---

## 4. Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `GOOGLE_DRIVE_CREDENTIALS` | Google Cloud service account JSON (with Drive API enabled) |
| `VIMEO_ACCESS_TOKEN` | Vimeo API access token (needs upload, edit, delete, stats permissions) |

### Google Drive Setup
1. Create a Google Cloud project
2. Enable the Google Drive API
3. Create a Service Account and download the JSON key
4. Store the entire JSON as `GOOGLE_DRIVE_CREDENTIALS` env var
5. Share each Google Drive folder with the service account email (as Editor)

### Vimeo Setup
1. Create a Vimeo app at https://developer.vimeo.com
2. Generate an access token with scopes: `upload`, `edit`, `delete`, `interact`, `stats`
3. Store as `VIMEO_ACCESS_TOKEN` env var

---

## 5. NPM Dependencies

```json
{
  "dependencies": {
    "express": "^4.x",
    "multer": "^1.x",
    "googleapis": "^100+",
    "firebase-admin": "^12.x"
  }
}
```

---

## 6. Key Design Decisions

### Why proxy uploads through your backend?
- **Security**: API credentials never reach the browser
- **Control**: You can enforce naming patterns, file size limits, and validate before upload
- **Consistency**: Same upload flow for both Google Drive and Vimeo

### Why `library_link` URL type?
- Allows **unlimited** links per brand (vs legacy types that are one-per-brand)
- Each link can have its own label and naming pattern
- Admin can add as many Google Drive folders or Vimeo projects as needed

### Naming Pattern Logic
- Pattern appends to the **end** of the creator's custom filename
- Vimeo uploads **exclude** file extension (`.mp4` is stripped)
- Google Drive **keeps** extension (pattern goes before extension)
- Example: Creator names file "Episode 1", pattern is " - MyBrand"
  - Vimeo: `Episode 1 - MyBrand`
  - Google Drive: `Episode 1 - MyBrand.mp4`

### File Size Limit
- Set to 500MB via multer config (`memoryStorage`)
- For larger files, consider switching to streaming/chunked upload or direct-to-cloud signed URLs

---

## 7. Google Drive Folder Sharing (Critical Step)

Your service account email (from the credentials JSON, `client_email` field) must be added as an **Editor** on every Google Drive folder you want creators to upload to.

1. Open the Google Drive folder in your browser
2. Click "Share"
3. Add the service account email (looks like `your-service@your-project.iam.gserviceaccount.com`)
4. Set permission to **Editor**
5. Uncheck "Notify people" and click Share

Without this step, uploads will fail with a 403 permission error.
