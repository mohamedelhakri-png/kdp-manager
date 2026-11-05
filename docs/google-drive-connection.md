# Google Drive connection plan

Confirmed private source folder: **Bees**, ID `1KmoF4y_IJefqth3TXSb0WKwE1yfftwsx` (https://drive.google.com/drive/folders/1KmoF4y_IJefqth3TXSb0WKwE1yfftwsx). Manual inventory: 23 DOCX files; 16 book candidates, 7 Fiche teaching files. Do not import Fiche automatically or merge similarly named book versions without review.

## Owner setup
1. Create/select a Google Cloud project, configure OAuth consent, add the owner as test user if in testing mode.
2. Create a Web application OAuth client. The proposed HTTPS callback is `https://lightcyan-crocodile-248294.hostingersite.com/auth/google/callback`; **do not authorize until the callback is implemented and deployed**.
3. For an existing private folder, request `https://www.googleapis.com/auth/drive.readonly`. The narrower `drive.file` scope does not allow arbitrary enumeration of existing private files without user selection. Google verification may apply.
4. Set server-only Hostinger environment values `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_DRIVE_FOLDER_ID`. Never put credentials in GitHub, HTML, or chat.
5. Implement server-side OAuth authorization-code flow with PKCE and state tied to the authenticated admin session. Encrypt refresh tokens at rest; support disconnect/revoke; never expose tokens to browser storage.
6. List Drive files with pagination and `'<folder ID>' in parents and trashed = false`; fetch only metadata first. Preview DOCX candidates and require explicit confirmation before mapping to database books; exclude Fiche and prevent duplicate Drive IDs.
7. Test unauthorized access, invalid callback state, secret redaction, pagination, and duplicate handling before requesting authorization.

**Current state:** ChatGPT's Drive connector was used to inspect the folder. The KDP Manager website does not yet have OAuth, live Drive access, or automatic synchronization. This checklist does not enable access.
