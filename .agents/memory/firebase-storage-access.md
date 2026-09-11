---
name: Firebase Storage access
description: The Quest's uploaded media depends on Firebase Storage access being available.
---

Firebase Storage media URLs can fail across the app when the owning Google Cloud project reports a disabled billing account. This affects existing images and videos even when their Firestore records and object URLs still exist. In this project, anonymous `storage.googleapis.com` object URLs can also return 403; newly uploaded media must use Firebase download-token URLs.

**Why:** A failed storage read is an infrastructure/access problem, not evidence that the uploaded media was deleted or that the UI's image/video components need to be replaced.

**How to apply:** Check the Firebase/Google Cloud Storage access error first. Keep Vimeo routing and media rendering changes separate from storage access recovery, and do not ask users to re-upload files until storage reads are working again. Upload helpers should attach `firebaseStorageDownloadTokens` and return `firebasestorage.googleapis.com` download URLs rather than relying on bucket-public ACLs.