# ChronicTV - Content Backend Architecture

This document explains how ChronicTV discovers, syncs, stores, and serves video, image, and audio content using Vimeo and Google Drive as external sources, with PostgreSQL as the central content database.

---

## Architecture Overview

ChronicTV follows a **SQL-First Architecture**: all content metadata is stored in PostgreSQL and served directly from the database. External APIs (Vimeo, Google Drive) are only called during background sync operations or at the moment of video playback.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React)                           │
│  Requests content from backend API endpoints                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js + Express)                   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ API Routes   │  │ Startup      │  │ ContentSyncService     │ │
│  │ (routes.ts)  │  │ Bundle       │  │ (Background Sync)      │ │
│  │              │  │ Service      │  │                        │ │
│  │ Serves data  │  │              │  │ Runs every 2 hours     │ │
│  │ from DB      │  │ Bundles all  │  │ Syncs Vimeo + Google   │ │
│  │              │  │ data for     │  │ Drive → PostgreSQL     │ │
│  │ Only calls   │  │ fast initial │  │                        │ │
│  │ Vimeo for    │  │ load         │  │                        │ │
│  │ HLS streams  │  │              │  │                        │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬─────────────────┘ │
│         │                 │                  │                   │
│         ▼                 ▼                  ▼                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              PostgreSQL (Drizzle ORM)                        │ │
│  │  categories | videos | url_content | audio_albums | cache   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
┌──────────────────────┐  ┌──────────────────────────┐
│    Vimeo API         │  │    Google Drive API       │
│                      │  │                           │
│  - Video metadata    │  │  - Thumbnails             │
│  - HLS stream URLs   │  │  - Show descriptions      │
│  - Folder hierarchy  │  │  - Audio files (mp3/m4a)  │
│  - Durations         │  │  - URL spreadsheets       │
│  - Descriptions      │  │  - Live streaming URLs    │
│                      │  │  - Footer/legal docs      │
└──────────────────────┘  └──────────────────────────┘
```

---

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `VIMEO_ACCESS_TOKEN` | Bearer token for Vimeo API (read access to projects/videos) |
| `GOOGLE_DRIVE_CREDENTIALS` | Service account JSON for Google Drive/Sheets/Docs API |
| `DATABASE_URL` | PostgreSQL connection string |

### Google Drive API Scopes

The service account requires these scopes:
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/spreadsheets.readonly`
- `https://www.googleapis.com/auth/documents.readonly`

---

## 1. VIDEO CONTENT (Vimeo)

### 1.1 Content Discovery - Folder Hierarchy

Videos are organized in Vimeo using a nested folder (project) structure:

```
Vimeo Account
└── ChronicTV (root folder)
    ├── Channels/
    │   ├── Show Name A/
    │   │   ├── video1.mp4
    │   │   ├── video2.mp4
    │   │   └── Season 2/          ← subfolder = season
    │   │       ├── episode1.mp4
    │   │       └── episode2.mp4
    │   └── Show Name B/
    │       └── video1.mp4
    ├── Movies/
    │   └── Movie Name/
    │       └── movie.mp4
    └── Originals/
        └── Original Show/
            └── episode1.mp4
```

### 1.2 Sync Process - `fetchVimeoCategories()`

The sync discovers content by traversing the Vimeo hierarchy:

1. **Find root**: Calls `GET /me/projects` to locate the "ChronicTV" folder
2. **Find containers**: Scans ChronicTV for subfolders named "Channels", "Movies", "Originals"
3. **Find shows**: Within each container, lists all subfolders (each subfolder = one show)
4. **Find seasons**: Within each show folder, checks for further subfolders (each = a season)

**API calls used:**
```
GET https://api.vimeo.com/me/projects?page={n}&per_page=100
GET https://api.vimeo.com/me/projects/{projectId}/items?page={n}&per_page=100
```

**Headers:**
```
Authorization: bearer {VIMEO_ACCESS_TOKEN}
Accept: application/vnd.vimeo.*+json;version=3.4
```

### 1.3 Video Fetching - `fetchVimeoVideos()`

After discovering the hierarchy, videos are fetched per show/season folder:

```
GET https://api.vimeo.com/me/projects/{projectId}/videos?page={n}&per_page=100
    &fields=uri,name,description,duration,pictures,player_embed_url
```

**Note:** The `/projects/{id}/videos` endpoint does not return descriptions reliably. A separate pre-fetch step calls:
```
GET https://api.vimeo.com/me/videos?page={n}&per_page=100&fields=uri,description
```
This builds a `videoDescriptionMap` that is merged with the per-project video data.

### 1.4 Data Mapping (Vimeo → PostgreSQL)

Each Vimeo video is mapped to a database record:

| Vimeo Field | Database Column | Notes |
|-------------|----------------|-------|
| `uri` (e.g., `/videos/12345`) | `id` | Extracted numeric ID |
| `name` | `title` | Video title |
| `description` | `description` | From pre-fetch map |
| `duration` | `duration` | Seconds |
| `pictures.sizes[3].link` | `thumbnail` | 4th size variant |
| `player_embed_url` | `videoUrl` | Embed player URL |
| Container folder name | `containerFolder` | "Channels", "Movies", or "Originals" |
| Show folder name | `categoryName` | The show this video belongs to |
| Season subfolder ID | `seasonFolderId` | Links video to a season |

### 1.5 Video Playback - HLS Streaming

Videos are NOT streamed through the ChronicTV server. The client requests a fresh HLS stream URL at playback time:

**Step 1: Get playback token**
```
POST /api/video/{id}/playback-token
Body: { deviceId: "device-identifier" }
Response: { token: "jwt-token", expiresIn: 300 }
```
- Token is a signed JWT, valid for 5 minutes
- Verifies the video exists in the database

**Step 2: Get HLS stream URL**
```
GET /api/video/{id}/stream
Headers: { Authorization: "Bearer {playback-token}" }
Response: { hlsUrl: "https://player.vimeo.com/.../master.m3u8", dashUrl: "...", progressiveUrl: "..." }
```
- Calls Vimeo API: `GET https://api.vimeo.com/videos/{id}?fields=files,play`
- Extracts HLS URL from `files[]` array (quality === 'hls') or `play.hls.link`
- Falls back to DASH or progressive MP4 if HLS unavailable
- HLS URLs have a TTL (time-to-live), which is why they're fetched fresh each time

**Stream priority:** HLS > DASH > Progressive MP4 (1080p/720p)

### 1.6 Sync Safety

- **Triple-read verified deletions**: Before removing a video from the database, the sync verifies it's actually gone from Vimeo (not just a temporary API failure)
- **Non-destructive upserts**: New/updated content is upserted; existing data is preserved if the API returns empty results
- **Data protection service**: Validates sync plans before execution to prevent accidental mass deletion

---

## 2. URL CONTENT (Google Spreadsheet → YouTube/External Videos)

In addition to Vimeo-hosted videos, ChronicTV supports external video content (primarily YouTube) managed via a Google Spreadsheet.

### 2.1 Spreadsheet Structure

A Google Spreadsheet named **"ChronicTV URL uploads"** contains:

| YouTube URL/Embed | Video Title | Description | Tab Name | Subfolder Name | Season Name |
|-------------------|-------------|-------------|----------|----------------|-------------|
| https://youtube.com/watch?v=xxx | Video Title | Description text | Movies | Show Name | Season 1 |

### 2.2 Discovery Process - `processUrlContent()`

1. Searches Google Drive for spreadsheets matching "ChronicTV URL uploads"
2. Reads all rows from the spreadsheet using Google Sheets API
3. For each row, extracts the YouTube video ID from the URL
4. Fetches thumbnail from YouTube's CDN: `https://img.youtube.com/vi/{videoId}/hqdefault.jpg`
5. Upserts each entry into the `url_content` database table
6. **GitHub-style sync**: Tracks which entries exist in the spreadsheet; entries removed from the spreadsheet are deleted from the database

### 2.3 URL Content Database Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Auto-incrementing ID |
| `embed_url` | TEXT | YouTube embed URL |
| `platform_video_id` | TEXT | Extracted YouTube video ID |
| `title` | TEXT | Video title |
| `description` | TEXT | Description |
| `thumbnail` | TEXT | YouTube thumbnail URL |
| `tab_name` | TEXT | Category assignment (Movies, Channels, Originals) |
| `subfolder_name` | TEXT | Show name |
| `season_name` | TEXT | Season assignment |

---

## 3. IMAGES & THUMBNAILS (Google Drive)

### 3.1 Show Thumbnails

Each show can have a thumbnail image stored in Google Drive with a specific naming convention.

**File naming requirement (strict, no fuzzy matching):**
```
{ShowName}/thumbnail
```
Example: A file literally named `Ok Air Fest/thumbnail` of type `image/*`

**Discovery process - `getShowThumbnailFromDrive()`:**
1. Searches Google Drive: `name = '{showName}/thumbnail' AND mimeType contains 'image/'`
2. If found, constructs a direct URL: `https://lh3.googleusercontent.com/d/{fileId}`
3. This URL serves the image directly from Google's CDN without authentication

**Serving to clients:**
- Endpoint: `GET /api/show-thumbnail/{showName}`
- Caches the image buffer in PostgreSQL for 4 hours
- Falls back to a branded SVG placeholder if no thumbnail exists

### 3.2 Video Thumbnails

Video thumbnails come from two sources:
- **Vimeo videos**: Extracted from `pictures.sizes[3].link` during sync
- **URL content (YouTube)**: Constructed as `https://img.youtube.com/vi/{videoId}/hqdefault.jpg`

Both are stored as URL strings in the database and served directly to the client.

### 3.3 Audio Album Covers

Album cover images are fetched from Google Drive during audio sync:
- Searches the album folder for image files (jpg, png, webp)
- If found, uses `https://lh3.googleusercontent.com/d/{fileId}` as the cover URL
- Stored in `audio_albums.cover_url`

---

## 4. AUDIO CONTENT (Google Drive)

### 4.1 Folder Structure

Audio content lives in Google Drive alongside show folders:

```
Google Drive
├── Show Name/
│   ├── audio/                    ← Priority 1: sibling "audio" folder
│   │   ├── Album Name 1/
│   │   │   ├── track1.mp3
│   │   │   ├── track2.mp3
│   │   │   └── cover.jpg
│   │   ├── Album Name 2/
│   │   │   └── track1.m4a
│   │   └── YouTube Music.gsheet  ← Optional: YouTube Music spreadsheet
│   └── videos/
│       └── ...
```

**Discovery priority:**
1. **Sibling audio folder**: `{ShowName}/audio/` containing album subfolders
2. **Child audio folder**: A subfolder named "audio" within the show folder
3. **General subfolders**: Any subfolder containing audio files (mp3, m4a, etc.)

### 4.2 Audio Sync Process - `processAudioContent()`

1. Gets all categories (shows) from the database
2. For each show, searches Google Drive for matching folders
3. Follows the priority order above to find audio content
4. For each album folder found:
   - Creates an `audio_albums` record with the folder name as album name
   - Scans for image files to use as album cover
   - Lists all audio files (mp3, m4a, wav, ogg, flac, aac, wma)
   - Creates an `audio_tracks` record for each file
   - Track audio URL format: `https://drive.google.com/uc?export=download&id={fileId}`

### 4.3 YouTube Music Integration

If an audio folder contains a Google Spreadsheet, it's parsed for YouTube Music playlist links:

| Album Name | YouTube URL |
|------------|-------------|
| Album Title | https://music.youtube.com/playlist?list=PLxxxxx |

- Extracts playlist ID from URL
- Creates albums with `album_type = 'youtube_music'`
- Thumbnail: `https://img.youtube.com/vi/{firstVideoId}/hqdefault.jpg`

### 4.4 Audio Database Schema

**audio_albums:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Auto-incrementing ID |
| `name` | TEXT | Album name (from folder name) |
| `cover_url` | TEXT | Google Drive image URL |
| `category_id` | TEXT | Links to parent show |
| `google_drive_folder_id` | TEXT | Source folder ID |
| `track_count` | INTEGER | Number of tracks |
| `total_duration_seconds` | INTEGER | Total album duration |
| `album_type` | TEXT | 'album' or 'youtube_music' |
| `is_active` | BOOLEAN | Active flag |

**audio_tracks:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Auto-incrementing ID |
| `album_id` | INTEGER | FK to audio_albums |
| `title` | TEXT | Track name (from filename) |
| `track_number` | INTEGER | Order within album |
| `duration_seconds` | INTEGER | Track length |
| `google_drive_file_id` | TEXT | Source file ID |
| `stream_url` | TEXT | Direct download URL |
| `file_size_bytes` | INTEGER | File size |
| `file_format` | TEXT | mp3, m4a, etc. |

### 4.5 Audio Playback - Server Proxy

Audio files are streamed through the backend as a proxy to handle CORS restrictions from Google Drive:

```
GET /api/audio-stream/{trackId}
```

1. Looks up the track in the database to get the Google Drive URL
2. Fetches the audio file from Google Drive server-side
3. Supports HTTP Range requests for seeking (returns 206 Partial Content)
4. Sets appropriate headers: Content-Type, Accept-Ranges, Cache-Control
5. Pipes the response body directly to the client

---

## 5. SHOW DESCRIPTIONS & LIVE STREAMING URLs (Google Drive)

### 5.1 Summary Documents

Each show can have a Google Docs document with description and live streaming information.

**File naming requirement (strict, no fuzzy matching):**
```
{ShowName}/summary
```

### 5.2 Document Format

The document is exported as plain text and parsed for two sections:

```
This is the show description text. It can be multiple paragraphs.

LIVE URLS:
YouTube: https://youtube.com/@channelname/live
Twitch: https://twitch.tv/channelname
Instagram: https://instagram.com/channelname/live
Facebook: https://facebook.com/pagename/live
TikTok: https://tiktok.com/@channelname/live
```

### 5.3 Parsing Logic

- Everything before "LIVE URLS:" is the show description
- Each line after "LIVE URLS:" is parsed as `Platform: URL`
- Platform-specific URLs are stored in separate database columns on the show record
- These URLs are displayed as branded buttons on the show page, opening the external platform

---

## 6. BACKGROUND SYNC SCHEDULE

The `ContentSyncService` runs on a 2-hour cycle:

```
Schedule: Every 2 hours at :01 (00:01, 02:01, 04:01, etc.)
```

**Sync order:**
1. Fetch Vimeo inventory (categories, channels, videos) in parallel
2. Generate sync plan (compare Vimeo data vs database)
3. Execute sync plan (upsert new/updated, delete verified removals)
4. Process URL content from Google Spreadsheets
5. Process audio content from Google Drive
6. Sync thumbnails from Google Drive
7. Sync show descriptions and live URLs
8. Send new content notifications

**Safety features:**
- Sync lock prevents concurrent runs
- Triple-read deletion verification
- Data protection validation before bulk operations
- Empty API response protection (keeps existing data)
- Rate limiting on all external API calls

---

## 7. API ENDPOINTS SUMMARY

### Content Delivery (Database-only, no external API calls)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/startup-bundle` | GET | All initial data bundled for fast load |
| `/api/categories` | GET | All show categories |
| `/api/videos` | GET | All videos |
| `/api/show-thumbnail/{name}` | GET | Proxied/cached show thumbnail |
| `/api/audio-albums` | GET | All audio albums (optional `?categoryId=`) |
| `/api/audio-albums/{id}` | GET | Single album with tracks |

### Playback (Requires external API call)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/video/{id}/playback-token` | POST | Generate 5-min playback JWT |
| `/api/video/{id}/stream` | GET | Fetch fresh HLS URL from Vimeo |
| `/api/audio-stream/{trackId}` | GET | Proxy audio from Google Drive |

### Sync Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sync/trigger` | POST | Manually trigger full sync |
| `/api/sync/status` | GET | Current sync status |

---

## 8. KEY DESIGN PRINCIPLES

1. **SQL-First**: The database is the single source of truth for all content. Clients never call Vimeo or Google Drive directly.

2. **No Fuzzy Matching**: All file lookups in Google Drive use exact name matches. No pattern matching or intelligent filtering.

3. **Non-Destructive Sync**: Upsert pattern ensures data is never lost due to temporary API failures.

4. **Rate Limiting**: All external API calls are rate-limited using `p-limit` to prevent throttling.

5. **Playback Security**: Video streaming requires a short-lived JWT token, preventing unauthorized access to HLS URLs.

6. **Proxy Architecture**: Audio files and thumbnails are proxied through the backend to handle CORS and provide caching.

7. **Atomic Cache Replacement**: During sync, new data replaces old data atomically to prevent partial/inconsistent states.

---

*Last updated: February 2026*
