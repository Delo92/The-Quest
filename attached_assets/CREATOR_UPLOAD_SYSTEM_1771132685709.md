# Creator Upload System — Complete Working Implementation

This document contains the full working code for letting creators upload images, videos, and files from a dashboard. Creators click a colored button for each content folder, see existing files inside, and can upload new ones with custom naming.

---

## How It Works

1. **Admin sets up "Library Links"** for each creator's brand — each link points to a cloud folder
2. **Creator logs into their dashboard** and sees their brand(s) with colored buttons for each content folder
3. **Creator clicks a button** → it expands showing existing files in that folder + an upload button
4. **Creator picks a file** → gets a confirm screen where they can rename it before uploading
5. **File uploads through your backend** (credentials stay server-side, never exposed to the browser)

```
Creator Dashboard (React)
    │
    │  FormData POST
    ▼
Express Backend (multer middleware)
    │
    │  Service Account / API Token
    ▼
Cloud Storage (Google Drive / Vimeo)
```

---

## Part 1: Backend Setup

### 1A. Install Dependencies

```bash
npm install express multer googleapis firebase-admin
```

### 1B. Multer Configuration (File Upload Middleware)

At the top of your routes file, set up multer to hold uploaded files in memory so you can stream them to cloud storage:

```typescript
import multer from "multer";

const driveUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
});
```

### 1C. Google Drive Upload Route

This receives a file from the creator's browser and uploads it to a specific Google Drive folder.

```typescript
app.post("/api/admin/drive/upload", driveUpload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { folderUrl } = req.body;
    const file = req.file;

    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }
    if (!folderUrl) {
      res.status(400).json({ message: "No folder URL provided" });
      return;
    }

    // Extract folder ID from URL like:
    // https://drive.google.com/drive/folders/1ABC123xyz
    const folderIdMatch = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (!folderIdMatch) {
      res.status(400).json({ message: "Invalid Google Drive folder URL" });
      return;
    }
    const folderId = folderIdMatch[1];

    // Initialize Google Drive API with service account credentials
    const { google } = await import('googleapis');
    const credentialsJson = process.env.GOOGLE_DRIVE_CREDENTIALS;
    const serviceAccountCredentials = JSON.parse(credentialsJson!);
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountCredentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });

    // Convert buffer to readable stream for upload
    const { Readable } = await import('stream');
    const bufferStream = new Readable();
    bufferStream.push(file.buffer);
    bufferStream.push(null);

    // Use custom filename if provided, otherwise use original
    const customFileName = req.body.customFileName;
    const finalFilename = customFileName || file.originalname;

    const response = await drive.files.create({
      requestBody: {
        name: finalFilename,
        parents: [folderId],
      },
      media: {
        mimeType: file.mimetype,
        body: bufferStream,
      },
      fields: 'id, name, webViewLink, size',
    });

    console.log(`File uploaded to Google Drive: ${response.data.name} (${response.data.id})`);
    res.json({
      message: "File uploaded successfully",
      file: {
        id: response.data.id,
        name: response.data.name,
        link: response.data.webViewLink,
        size: response.data.size,
      }
    });
  } catch (error: any) {
    console.error("Google Drive upload error:", error);
    if (error.code === 403) {
      res.status(403).json({ message: "Permission denied. The service account may not have Editor access to this folder." });
    } else {
      res.status(500).json({ message: error.message || "Failed to upload file to Google Drive" });
    }
  }
});
```

### 1D. Google Drive — List Files in a Folder

```typescript
app.get("/api/admin/drive/folder-files", async (req: Request, res: Response): Promise<void> => {
  try {
    const folderUrl = req.query.folderUrl as string;
    if (!folderUrl) {
      res.status(400).json({ message: "folderUrl query parameter required" });
      return;
    }

    const folderIdMatch = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (!folderIdMatch) {
      res.status(400).json({ message: "Invalid Google Drive folder URL" });
      return;
    }
    const folderId = folderIdMatch[1];

    // Initialize Google Drive API (same as upload route)
    const { google } = await import('googleapis');
    const credentialsJson = process.env.GOOGLE_DRIVE_CREDENTIALS;
    const serviceAccountCredentials = JSON.parse(credentialsJson!);
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountCredentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, thumbnailLink, webViewLink, webContentLink, size, createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 100,
    });

    res.json({ files: response.data.files || [] });
  } catch (error: any) {
    console.error("List Drive folder files error:", error);
    res.status(500).json({ message: error.message || "Failed to list files" });
  }
});
```

### 1E. Google Drive — Delete a File

```typescript
app.delete("/api/admin/drive/file/:fileId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params;

    // Initialize Google Drive API (same pattern)
    const { google } = await import('googleapis');
    const credentialsJson = process.env.GOOGLE_DRIVE_CREDENTIALS;
    const serviceAccountCredentials = JSON.parse(credentialsJson!);
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountCredentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });

    await drive.files.delete({ fileId });
    console.log(`Deleted Drive file: ${fileId}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete Drive file error:", error);
    res.status(500).json({ message: error.message || "Failed to delete file" });
  }
});
```

### 1F. Vimeo — Helper to Get User ID

```typescript
async function getVimeoUserId(token: string): Promise<string> {
  const resp = await fetch('https://api.vimeo.com/me', {
    headers: {
      'Authorization': `bearer ${token}`,
      'Accept': 'application/vnd.vimeo.*+json;version=3.4'
    }
  });
  if (!resp.ok) throw new Error('Failed to get Vimeo user info');
  const data = await resp.json();
  return data.uri.split('/').pop();
}
```

### 1G. Vimeo — Upload Video (TUS Protocol)

```typescript
app.post("/api/admin/vimeo/upload", driveUpload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { folderUrl, fileName } = req.body;
    const file = req.file;

    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }
    if (!folderUrl) {
      res.status(400).json({ message: "folderUrl is required" });
      return;
    }

    // Extract project ID from Vimeo URL like:
    // https://vimeo.com/manage/folder/12345678
    // https://vimeo.com/manage/projects/12345678
    const folderMatch = folderUrl.match(/\/folder\/(\d+)/);
    const projectMatch = folderUrl.match(/\/projects\/(\d+)/);
    const folderId = folderMatch?.[1] || projectMatch?.[1];

    if (!folderId) {
      res.status(400).json({ message: "Could not extract folder/project ID from Vimeo URL" });
      return;
    }

    const token = process.env.VIMEO_ACCESS_TOKEN;
    if (!token) {
      res.status(500).json({ message: "Vimeo access token not configured" });
      return;
    }

    const videoName = fileName || file.originalname;

    // Step 1: Create video entry on Vimeo using TUS upload approach
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

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      console.error("Vimeo create video error:", errText);
      res.status(createResponse.status).json({ message: "Failed to create Vimeo video entry" });
      return;
    }

    const createData = await createResponse.json();
    const uploadLink = createData.upload?.upload_link;
    const videoUri = createData.uri;

    if (!uploadLink) {
      res.status(500).json({ message: "No upload link returned from Vimeo" });
      return;
    }

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

    if (!uploadResponse.ok && uploadResponse.status !== 204) {
      const errText = await uploadResponse.text();
      console.error("Vimeo tus upload error:", errText);
      res.status(500).json({ message: "Failed to upload video to Vimeo" });
      return;
    }

    // Step 3: Move video into the correct project folder
    const moveResponse = await fetch(`https://api.vimeo.com/me/projects/${folderId}/videos/${videoUri.split('/').pop()}`, {
      method: 'PUT',
      headers: {
        'Authorization': `bearer ${token}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });

    if (!moveResponse.ok && moveResponse.status !== 204) {
      console.warn("Video uploaded but could not be moved to folder:", await moveResponse.text());
    }

    const videoId = videoUri.split('/').pop();
    console.log(`Vimeo video uploaded: ${videoName} (ID: ${videoId}) to folder ${folderId}`);
    res.json({ success: true, videoId, videoUri, name: videoName });
  } catch (error: any) {
    console.error("Vimeo upload error:", error);
    res.status(500).json({ message: error.message || "Failed to upload to Vimeo" });
  }
});
```

### 1H. Vimeo — List Videos in a Project Folder

```typescript
app.get("/api/admin/vimeo/folder-videos", async (req: Request, res: Response): Promise<void> => {
  try {
    const folderUrl = req.query.folderUrl as string;
    if (!folderUrl) {
      res.status(400).json({ message: "folderUrl query parameter required" });
      return;
    }

    const folderMatch = folderUrl.match(/\/folder\/(\d+)/);
    const projectMatch = folderUrl.match(/\/projects\/(\d+)/);
    const folderId = folderMatch?.[1] || projectMatch?.[1];

    if (!folderId) {
      res.status(400).json({ message: "Could not extract folder/project ID from Vimeo URL" });
      return;
    }

    const token = process.env.VIMEO_ACCESS_TOKEN;
    if (!token) {
      res.status(500).json({ message: "Vimeo access token not configured" });
      return;
    }

    const vimeoResponse = await fetch(
      `https://api.vimeo.com/me/projects/${folderId}/items?per_page=50&fields=type,video.uri,video.name,video.description,video.duration,video.pictures,video.player_embed_url`,
      {
        headers: {
          'Authorization': `bearer ${token}`,
          'Accept': 'application/vnd.vimeo.*+json;version=3.4'
        }
      }
    );

    if (!vimeoResponse.ok) {
      const errText = await vimeoResponse.text();
      console.error("Vimeo API error:", errText);
      res.status(vimeoResponse.status).json({ message: "Vimeo API error" });
      return;
    }

    const data = await vimeoResponse.json();
    const videos = (data.data || [])
      .filter((item: any) => item.type === 'video' && item.video)
      .map((item: any) => {
        const v = item.video;
        const videoId = v.uri?.split('/').pop();
        const thumbnail = v.pictures?.sizes?.find((s: any) => s.width >= 295)?.link || v.pictures?.sizes?.[0]?.link;
        return {
          id: videoId,
          name: v.name,
          duration: v.duration,
          thumbnail,
          embedUrl: `https://player.vimeo.com/video/${videoId}?autopause=0`,
        };
      });

    res.json({ videos });
  } catch (error: any) {
    console.error("List Vimeo folder videos error:", error);
    res.status(500).json({ message: error.message || "Failed to list Vimeo videos" });
  }
});
```

### 1I. Vimeo — Rename a Video

```typescript
app.patch("/api/admin/vimeo/video/:videoId/rename", async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    const token = process.env.VIMEO_ACCESS_TOKEN;
    if (!token) {
      res.status(500).json({ message: "Vimeo access token not configured" });
      return;
    }

    const vimeoResp = await fetch(`https://api.vimeo.com/videos/${videoId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      },
      body: JSON.stringify({ name: name.trim() })
    });

    if (!vimeoResp.ok) {
      const errText = await vimeoResp.text();
      console.error("Vimeo rename error:", errText);
      res.status(vimeoResp.status).json({ message: "Failed to rename video" });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Vimeo rename error:", error);
    res.status(500).json({ message: error.message || "Failed to rename video" });
  }
});
```

---

## Part 2: Frontend Component — LibraryLinkManager

This is the complete React component that creators interact with. Each library link is a colored button that expands to show files and an upload area.

### 2A. TypeScript Interfaces

```tsx
interface DriveFile {
  id: string
  name: string
  mimeType?: string
  thumbnailLink?: string
  webViewLink?: string
  webContentLink?: string
  size?: string
  createdTime?: string
}
```

### 2B. Full Component Code

```tsx
import { useState } from 'react'
import {
  Upload, FolderOpen, Video, FileText, ExternalLink,
  Loader2, Check, X, ChevronUp, ChevronDown,
  Pencil, Trash2, CheckCircle, AlertCircle
} from 'lucide-react'

function LibraryLinkManager({ folderUrl, label, namingPattern, color, testId, urlId }: {
  folderUrl: string
  label: string
  namingPattern?: string
  color: string        // 'purple' | 'blue' | 'green' | 'amber'
  testId: string
  urlId?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [files, setFiles] = useState<DriveFile[]>([])
  const [vimeoVideos, setVimeoVideos] = useState<any[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [customFileName, setCustomFileName] = useState('')
  const [renamingVideoId, setRenamingVideoId] = useState<string | null>(null)
  const [renameVideoValue, setRenameVideoValue] = useState('')
  const [savingVideoName, setSavingVideoName] = useState(false)

  const isGoogleDrive = folderUrl.includes('drive.google.com')
  const isVimeo = folderUrl.includes('vimeo.com')

  // ─── Load existing files from cloud ───
  const loadFiles = async () => {
    if (!isGoogleDrive) return
    setLoadingFiles(true)
    try {
      const resp = await fetch(`/api/admin/drive/folder-files?folderUrl=${encodeURIComponent(folderUrl)}`)
      const data = await resp.json()
      if (resp.ok) setFiles(data.files || [])
    } catch {}
    setLoadingFiles(false)
  }

  const loadVimeoVideos = async () => {
    if (!isVimeo) return
    setLoadingFiles(true)
    try {
      const resp = await fetch(`/api/admin/vimeo/folder-videos?folderUrl=${encodeURIComponent(folderUrl)}`)
      const data = await resp.json()
      if (resp.ok) setVimeoVideos(data.videos || [])
    } catch {}
    setLoadingFiles(false)
  }

  // ─── Toggle expand/collapse (loads files on first open) ───
  const handleToggle = () => {
    if (!expanded) {
      if (isGoogleDrive) loadFiles()
      if (isVimeo) loadVimeoVideos()
    }
    setExpanded(!expanded)
  }

  // ─── Delete a Google Drive file ───
  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Delete this file?')) return
    setDeletingFileId(fileId)
    try {
      const resp = await fetch(`/api/admin/drive/file/${fileId}`, { method: 'DELETE' })
      if (resp.ok) {
        setFiles(prev => prev.filter(f => f.id !== fileId))
        setResult({ type: 'success', text: 'File deleted' })
      }
    } catch {}
    setDeletingFileId(null)
  }

  // ─── Filename logic ───
  // Naming pattern appends to the END of the creator's custom name
  // Vimeo: no file extension (strip .mp4)
  // Google Drive: keep file extension (pattern goes before extension)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setCustomFileName(file.name.replace(/\.[^/.]+$/, ''))  // default to original name without extension
    setResult(null)
    if (e.target) e.target.value = ''  // reset input so same file can be re-selected
  }

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
    // Google Drive: keep extension, naming pattern goes before extension
    const ext = getExtension(file)
    return namingPattern ? `${baseName}${namingPattern}${ext}` : `${baseName}${ext}`
  }

  // ─── Confirm and upload ───
  const handleConfirmUpload = async () => {
    if (!pendingFile) return

    setUploading(true)
    const finalName = getFinalFilename(pendingFile)
    setProgress(`Uploading as "${finalName}"...`)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', pendingFile)
      formData.append('folderUrl', folderUrl)

      if (isVimeo) {
        formData.append('fileName', finalName)
        const response = await fetch('/api/admin/vimeo/upload', {
          method: 'POST',
          body: formData,
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Upload failed')
        setResult({ type: 'success', text: `Uploaded "${finalName}" to your channel` })
        loadVimeoVideos()  // refresh the list
      } else {
        formData.append('customFileName', finalName)
        if (namingPattern) formData.append('namingPattern', namingPattern)
        const response = await fetch('/api/admin/drive/upload', {
          method: 'POST',
          body: formData,
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Upload failed')
        setResult({ type: 'success', text: `Saved as "${finalName}"` })
        if (isGoogleDrive) loadFiles()  // refresh the list
      }

      setProgress('')
      setPendingFile(null)
    } catch (err: any) {
      setResult({ type: 'error', text: err.message || 'Upload failed' })
      setProgress('')
    } finally {
      setUploading(false)
    }
  }

  // ─── Rename a Vimeo video ───
  const handleRenameVideo = async (videoId: string) => {
    if (!renameVideoValue.trim() || savingVideoName) return
    setSavingVideoName(true)
    try {
      const resp = await fetch(`/api/admin/vimeo/video/${videoId}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameVideoValue.trim() })
      })
      if (resp.ok) {
        setVimeoVideos(prev => prev.map(v => v.id === videoId ? { ...v, name: renameVideoValue.trim() } : v))
        setResult({ type: 'success', text: 'Video renamed' })
      }
    } catch {}
    setSavingVideoName(false)
    setRenamingVideoId(null)
  }

  // ─── Color classes for the button header ───
  const colorClasses: Record<string, string> = {
    purple: 'bg-purple-600 hover:bg-purple-700',
    blue: 'bg-blue-600 hover:bg-blue-700',
    green: 'bg-green-600 hover:bg-green-700',
    amber: 'bg-amber-600 hover:bg-amber-700',
  }

  // ─── RENDER ───
  return (
    <div className="border border-zinc-700 rounded-lg overflow-hidden">
      {/* Colored header button */}
      <div className={`w-full flex items-center justify-between gap-2 px-4 py-3 ${colorClasses[color] || colorClasses.green} text-white font-medium transition-colors`}>
        <button
          onClick={handleToggle}
          className="flex items-center gap-2 flex-1 text-left"
          data-testid={testId}
        >
          {isVimeo ? <Video className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
          {label}
        </button>
        <button onClick={handleToggle}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded content area */}
      {expanded && (
        <div className="bg-zinc-900 p-4 space-y-4">

          {/* ═══ GOOGLE DRIVE SECTION ═══ */}
          {isGoogleDrive && (
            <>
              {/* Naming pattern notice */}
              {namingPattern && (
                <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3">
                  <p className="text-xs text-amber-300 font-medium mb-1">Naming Rule</p>
                  <p className="text-xs text-amber-200/80">
                    Files uploaded here will automatically have <span className="font-bold text-white">"{namingPattern}"</span> added to the end of whatever you name them.
                    For example, if you name your file <span className="text-white">"My Image"</span>, it will be saved as <span className="font-bold text-green-400">"My Image{namingPattern}"</span>.
                  </p>
                </div>
              )}

              {/* Upload button OR confirm screen */}
              {!pendingFile ? (
                <label className={`inline-flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                  <input type="file" className="hidden" onChange={handleFileSelect} disabled={uploading} accept="image/*,video/*,.pdf,.doc,.docx,.txt" />
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? 'Uploading...' : 'Select File'}
                </label>
              ) : (
                <div className="bg-zinc-800 border border-zinc-600 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-zinc-300 font-medium">Confirm Upload</p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 text-xs">
                      <span className="text-zinc-500 shrink-0 pt-0.5">Selected file:</span>
                      <span className="text-white break-all">{pendingFile.name}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-zinc-500">Edit name:</span>
                      <input
                        type="text"
                        value={customFileName}
                        onChange={(e) => setCustomFileName(e.target.value)}
                        className="w-full bg-zinc-900 text-white text-sm px-3 py-2 rounded border border-zinc-600 focus:border-green-500 focus:outline-none"
                        placeholder="Enter file name..."
                      />
                    </div>
                    <div className="flex items-start gap-2 text-xs">
                      <span className="text-zinc-500 shrink-0 pt-0.5">Will be saved as:</span>
                      <span className="text-green-400 font-bold break-all">{getFinalFilename(pendingFile)}</span>
                    </div>
                  </div>
                  {namingPattern && (
                    <p className="text-xs text-amber-300">Please verify the final name matches the expected naming pattern before confirming.</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleConfirmUpload}
                      disabled={uploading || !customFileName.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                      {uploading ? 'Uploading...' : 'Confirm & Upload'}
                    </button>
                    <button
                      onClick={() => { setPendingFile(null); setResult(null) }}
                      disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg disabled:opacity-50"
                    >
                      <X className="h-4 w-4" /> Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Success / error messages */}
              {progress && <p className="text-xs text-zinc-400">{progress}</p>}
              {result && (
                result.type === 'success' ? (
                  <div className="bg-green-900/40 border border-green-500/50 rounded-lg p-4 flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-green-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-green-300 font-semibold text-sm">{result.text}</p>
                      <p className="text-green-400/70 text-xs mt-1">Your file has been uploaded successfully and will appear on your site within the next sync cycle.</p>
                    </div>
                    <button onClick={() => setResult(null)} className="text-green-400/60 hover:text-green-300 shrink-0"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="bg-red-900/40 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-300 font-semibold text-sm">{result.text}</p>
                      <p className="text-red-400/70 text-xs mt-1">Please try again or contact support if the issue persists.</p>
                    </div>
                    <button onClick={() => setResult(null)} className="text-red-400/60 hover:text-red-300 shrink-0"><X className="h-4 w-4" /></button>
                  </div>
                )
              )}

              {/* File grid - shows existing files in the folder */}
              {loadingFiles ? (
                <div className="flex items-center gap-2 text-zinc-400 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading files...</div>
              ) : files.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {files.map(file => (
                    <div key={file.id} className="bg-zinc-800 rounded-lg p-3 relative group">
                      {file.mimeType?.startsWith('image/') && file.thumbnailLink ? (
                        <img src={file.thumbnailLink} alt={file.name} className="w-full h-24 object-cover rounded mb-2" />
                      ) : file.mimeType?.startsWith('video/') ? (
                        <div className="w-full h-24 bg-zinc-700 rounded mb-2 flex items-center justify-center">
                          <Video className="h-8 w-8 text-zinc-400" />
                        </div>
                      ) : (
                        <div className="w-full h-24 bg-zinc-700 rounded mb-2 flex items-center justify-center">
                          <FileText className="h-8 w-8 text-zinc-400" />
                        </div>
                      )}
                      <p className="text-xs text-zinc-300 truncate">{file.name}</p>
                      {/* Hover actions: open link + delete */}
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {file.webViewLink && (
                          <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="p-1 bg-zinc-700 rounded hover:bg-zinc-600">
                            <ExternalLink className="h-3 w-3 text-white" />
                          </a>
                        )}
                        <button onClick={() => handleDeleteFile(file.id)} disabled={deletingFileId === file.id} className="p-1 bg-red-600/80 rounded hover:bg-red-600">
                          {deletingFileId === file.id ? <Loader2 className="h-3 w-3 animate-spin text-white" /> : <Trash2 className="h-3 w-3 text-white" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No files in this folder yet</p>
              )}
            </>
          )}

          {/* ═══ VIMEO SECTION ═══ */}
          {isVimeo && (
            <div className="space-y-3">
              {/* Naming pattern notice */}
              {namingPattern && (
                <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3">
                  <p className="text-xs text-amber-300 font-medium mb-1">Naming Rule</p>
                  <p className="text-xs text-amber-200/80">
                    Videos uploaded here will automatically have <span className="font-bold text-white">"{namingPattern}"</span> added to the end of whatever you name them.
                    For example, if your video is <span className="text-white">"My Video"</span>, it will be saved as <span className="font-bold text-green-400">"My Video{namingPattern}"</span>.
                  </p>
                </div>
              )}

              {/* Upload button OR confirm screen */}
              {!pendingFile ? (
                <label className={`inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                  <input type="file" className="hidden" onChange={handleFileSelect} disabled={uploading} accept="video/*" />
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? 'Uploading...' : 'Upload Video'}
                </label>
              ) : (
                <div className="bg-zinc-800 border border-zinc-600 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-zinc-300 font-medium">Confirm Upload</p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 text-xs">
                      <span className="text-zinc-500 shrink-0 pt-0.5">Selected file:</span>
                      <span className="text-white break-all">{pendingFile.name}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-zinc-500">Edit name:</span>
                      <input
                        type="text"
                        value={customFileName}
                        onChange={(e) => setCustomFileName(e.target.value)}
                        className="w-full bg-zinc-900 text-white text-sm px-3 py-2 rounded border border-zinc-600 focus:border-green-500 focus:outline-none"
                        placeholder="Enter video name..."
                      />
                    </div>
                    <div className="flex items-start gap-2 text-xs">
                      <span className="text-zinc-500 shrink-0 pt-0.5">Will be saved as:</span>
                      <span className="text-green-400 font-bold break-all">{getFinalFilename(pendingFile)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-500">Size:</span>
                      <span className="text-zinc-300">{(pendingFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleConfirmUpload}
                      disabled={uploading || !customFileName.trim()}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {uploading ? 'Uploading...' : 'Confirm Upload'}
                    </button>
                    <button
                      onClick={() => { setPendingFile(null); setResult(null) }}
                      disabled={uploading}
                      className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Success / error messages */}
              {progress && <p className="text-xs text-zinc-400">{progress}</p>}
              {result && (
                result.type === 'success' ? (
                  <div className="bg-green-900/40 border border-green-500/50 rounded-lg p-4 flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-green-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-green-300 font-semibold text-sm">{result.text}</p>
                      <p className="text-green-400/70 text-xs mt-1">Your video has been uploaded and will appear on your channel within the next sync cycle.</p>
                    </div>
                    <button onClick={() => setResult(null)} className="text-green-400/60 hover:text-green-300 shrink-0"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="bg-red-900/40 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-300 font-semibold text-sm">{result.text}</p>
                      <p className="text-red-400/70 text-xs mt-1">Please try again or contact support if the issue persists.</p>
                    </div>
                    <button onClick={() => setResult(null)} className="text-red-400/60 hover:text-red-300 shrink-0"><X className="h-4 w-4" /></button>
                  </div>
                )
              )}

              {/* Video grid - shows existing videos in the folder */}
              {loadingFiles ? (
                <div className="flex items-center gap-2 text-zinc-400 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading videos...</div>
              ) : vimeoVideos.length > 0 ? (
                <>
                  {/* Video preview player */}
                  {previewVideoId && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-zinc-300 font-medium">Preview</p>
                        <button onClick={() => setPreviewVideoId(null)} className="text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
                      </div>
                      <iframe
                        src={`https://player.vimeo.com/video/${previewVideoId}?autopause=0`}
                        className="w-full aspect-video rounded-lg"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {vimeoVideos.map(video => (
                      <div
                        key={video.id}
                        className={`bg-zinc-800 rounded-lg p-2 text-left hover:ring-2 hover:ring-green-500/50 transition-all relative group ${previewVideoId === video.id ? 'ring-2 ring-green-500' : ''}`}
                      >
                        <div onClick={() => setPreviewVideoId(video.id === previewVideoId ? null : video.id)} className="cursor-pointer">
                          {video.thumbnail ? (
                            <img src={video.thumbnail} alt={video.name} className="w-full h-20 object-cover rounded mb-2" />
                          ) : (
                            <div className="w-full h-20 bg-zinc-700 rounded mb-2 flex items-center justify-center">
                              <Video className="h-6 w-6 text-zinc-400" />
                            </div>
                          )}
                        </div>
                        {/* Inline rename */}
                        {renamingVideoId === video.id ? (
                          <div className="flex items-center gap-1 mt-1">
                            <input
                              type="text"
                              value={renameVideoValue}
                              onChange={(e) => setRenameVideoValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameVideo(video.id); if (e.key === 'Escape') setRenamingVideoId(null) }}
                              className="bg-zinc-900 text-white text-xs px-1.5 py-1 rounded border border-zinc-600 w-full"
                              autoFocus
                            />
                            <button onClick={() => handleRenameVideo(video.id)} disabled={savingVideoName} className="p-0.5 bg-green-700 rounded hover:bg-green-600 shrink-0">
                              {savingVideoName ? <Loader2 className="h-3 w-3 animate-spin text-white" /> : <Check className="h-3 w-3 text-white" />}
                            </button>
                            <button onClick={() => setRenamingVideoId(null)} className="p-0.5 bg-zinc-700 rounded hover:bg-zinc-600 shrink-0">
                              <X className="h-3 w-3 text-white" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <p className="text-xs text-zinc-300 truncate flex-1">{video.name}</p>
                            <button
                              onClick={(e) => { e.stopPropagation(); setRenamingVideoId(video.id); setRenameVideoValue(video.name) }}
                              className="p-0.5 rounded hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              title="Rename video"
                            >
                              <Pencil className="h-3 w-3 text-zinc-400" />
                            </button>
                          </div>
                        )}
                        {video.duration > 0 && (
                          <p className="text-xs text-zinc-500">{Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-500">No videos found in this folder</p>
              )}

              {/* Link to open folder externally */}
              <a href={folderUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-green-400 hover:text-green-300">
                <ExternalLink className="h-4 w-4" /> Open Folder
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

---

## Part 3: Using the Component

Render one `LibraryLinkManager` per library link on the creator's brand:

```tsx
{brand.urls.map((link, idx) => (
  <LibraryLinkManager
    key={link.id || idx}
    folderUrl={link.urlValue}
    label={link.label || 'Content Folder'}
    namingPattern={link.namingPattern}
    color={link.urlValue.includes('vimeo.com') ? 'blue' : 'purple'}
    testId={`button-library-${brand.id}-${idx}`}
    urlId={String(link.id)}
  />
))}
```

**Props explained:**

| Prop | What it does |
|------|-------------|
| `folderUrl` | Full URL to Google Drive folder or Vimeo project. The component auto-detects which service it is. |
| `label` | Display name on the button (e.g., "Brand Trailer", "Images & Public Data") |
| `namingPattern` | Optional suffix appended to filenames (e.g., " - MyBrand") |
| `color` | Button color: `'purple'`, `'blue'`, `'green'`, or `'amber'` |
| `testId` | Unique test ID for the button element |
| `urlId` | Database ID of this library link (used for label editing) |

---

## Part 4: Environment Variables

| Variable | What it is |
|----------|-----------|
| `GOOGLE_DRIVE_CREDENTIALS` | Entire Google Cloud service account JSON (with Drive API enabled) |
| `VIMEO_ACCESS_TOKEN` | Vimeo API access token with upload/edit/delete scopes |

### Google Drive Setup
1. Go to Google Cloud Console → create a project
2. Enable the **Google Drive API**
3. Create a **Service Account** → download JSON key
4. Store the entire JSON string as `GOOGLE_DRIVE_CREDENTIALS` env var
5. **Critical:** Share each Google Drive folder with the service account email (the `client_email` from the JSON) as **Editor**

### Vimeo Setup
1. Go to https://developer.vimeo.com → create an app
2. Generate an access token with scopes: `upload`, `edit`, `delete`, `interact`, `stats`
3. Store as `VIMEO_ACCESS_TOKEN` env var

---

## Part 5: Key Design Decisions

**Why upload through your backend?**
- API keys/tokens never reach the browser
- You control naming, file size, and validation server-side
- Same upload flow works for both Google Drive and Vimeo

**Naming pattern logic:**
- Pattern appends to the END of whatever name the creator types
- Vimeo: extension is stripped (no `.mp4` in the video title)
- Google Drive: extension is kept (pattern goes before the `.mp4`)
- Example with pattern `" - MyBrand"`:
  - Creator types "Episode 1"
  - Vimeo result: `Episode 1 - MyBrand`
  - Google Drive result: `Episode 1 - MyBrand.mp4`

**File size limit:**
- 500MB via multer `memoryStorage` — for larger files you'd need chunked/streaming uploads

**Google Drive folder sharing (most common issue):**
- The service account email must be added as an **Editor** on every Google Drive folder
- Without this, uploads fail with 403 Permission Denied
- Service account email looks like: `your-service@your-project.iam.gserviceaccount.com`
