# Google OAuth Verification & Migration Guide

This guide details the steps required to verify Cyberia with Google and the subsequent technical roadmap to migrate from the temporary "Safe Entry" (Implicit Flow) to a unified, permanent session architecture.

---

## Part 1: How to Verify Your App

Google requires verification because we use the `https://www.googleapis.com/auth/drive.file` scope, which is classified as **Sensitive**.

### 1. Prerequisites
Before submitting for review, ensure you have:
*   **Privacy Policy:** A hosted URL (e.g., `cyberia.app/privacy`) that explicitly states how you use Google Drive data (i.e., "We only store files you explicitly drop into the workspace").
*   **Domain Verification:** Your domain (`cyberia.app`) must be verified in the [Google Search Console](https://search.google.com/search-console).
*   **Branding:** Ensure your app name, logo, and support email are consistent across the console and the site.

### 2. Submission Steps
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Navigate to **APIs & Services > OAuth consent screen**.
3.  Click **"Edit App"**.
4.  Ensure all **Scopes** are added: `openid`, `email`, `profile`, and `.../auth/drive.file`.
5.  Upload your Privacy Policy link and Terms of Service link.
6.  Click **"Submit for Verification"**.
7.  **Response:** Google will email you within 3-7 days. They may ask for a YouTube video showing the "OAuth Grant" process (you should record yourself dragging a file and accepting the Drive popup).

---

## Part 2: Technical Roadmap (For opencode)

Once the app is verified, we can remove the "Safe Entry" workarounds and move to a professional, unified architecture.

### 1. Unify the Auth Flow
*   **Action:** Convert the main `googleLogin` in `AccountMenu.tsx` from `flow: 'implicit'` back to `flow: 'auth-code'`.
*   **Benefit:** Users get a long-lived session immediately upon signing in. No more "1-hour expiry" for the basic account.

### 2. Automatic Drive Initialization
*   **Action:** Include the `drive.file` scope in the initial login request.
*   **Logic:** Since the app is verified, users won't see the "Unsafe" warning. They can grant both Identity and Drive permissions in one single, clean popup.

### 3. Background Profile Refresh Enhancement
*   **Action:** Update `useAuthStore.initAuth` to perform a silent token rotation check every time the app opens.
*   **Logic:** Use the stored `refresh_token` in Vercel KV to fetch a fresh `access_token` without any UI flicker.

### 4. Code Cleanup
*   **Action:** Delete the redundant `driveLogin` hook in `AccountMenu.tsx`.
*   **Action:** Remove all "Safe Entry" comments and fallback implicit logic in `api/google-auth.ts`.

---

## Summary of Post-Verification State
| Feature | Pre-Verification (Current) | Post-Verification |
| :--- | :--- | :--- |
| **Login Type** | Implicit (Short-lived) | Auth Code (Permanent) |
| **Warnings** | Shows "Unverified" for Drive | No Warnings |
| **Popups** | Multiple (Login then Drive) | One (All-in-one) |
| **Security** | Token in Browser | Token in Secure KV |
