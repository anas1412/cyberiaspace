# Google OAuth Verification & Migration Checklist

This document serves as your master TODO list for achieving Google Brand Verification for the `drive.file` scope. Completing these steps will remove the "Unverified App" warning and enable a professional, one-time login experience.

---

## 🟢 Phase 1: Prerequisites (Completed)
- [x] **Verify Top Private Domain:** Ownership of `cyberia.tn` confirmed in Google Search Console.
- [x] **Authorized Domains List:** `cyberia.tn` added to the "Authorized Domains" section in Google Cloud Console.

---

## 🟡 Phase 2: Branding & Compliance (Action Required)
- [ ] **Match App Name:** Ensure the "App Name" in Google Console matches the logo/title on `cyberia.tn` exactly.
- [ ] **Support Email:** Ensure the support email is an active address you can check (Google will contact you here).
- [ ] **Privacy Policy:** Hosted at `https://cyberia.tn/privacy`.
    - [x] **Critical Clause:** Added section on "Google API Limited Use."
    - [x] **Data Disclosure:** Explicitly stated how `drive.file` is used.
- [ ] **Terms of Service:** Hosted at `https://cyberia.tn/terms`.
- [x] **Homepage Compliance:** Added descriptive "About Cyberia" section to the unauthenticated landing state to satisfy the "No Login-Only Pages" requirement.

---

## 🔴 Phase 3: The Verification Submission (Action Required)
- [ ] **Move to Production:** In the Google OAuth Consent screen, change the "Publishing Status" from **Testing** to **In Production**.
- [ ] **Submit for Review:** Use the "Submit for Verification" button.
- [ ] **Justification Description:** Use the provided professional template.
    - *Template:* "Cyberia is a spatial productivity workspace. We require the `drive.file` scope to allow users to store and retrieve their own large research assets (PDFs, Videos, Audio) directly within their private Google Drive, bypassing browser storage limits and ensuring data ownership."
- [ ] **Demonstration Video:** Create an unlisted YouTube video following this exact script:
    1. **The Origin:** Start on the `cyberia.tn` homepage.
    2. **The Identification:** Click "Sign In." **Crucial:** Zoom in or show the URL bar so the `client_id` is clearly visible in the browser address bar.
    3. **The Grant:** Complete the login and then click "Connect Google Drive." Show the permission popup.
    4. **The Usage:** Drag a PDF file into the workspace and show it appearing on the map.
    5. **The Explanation:** Narrate: "We use this scope only to save and load files that the user explicitly adds to their workspace."

---

## 🔵 Phase 4: Technical Migration (Lead Engineer Roadmap)
*Once Google grants "Verified" status, I (opencode) will perform the following:*

- [ ] **Unify Auth Flow:** Switch `googleLogin` in `AccountMenu.tsx` from `flow: 'implicit'` to `flow: 'auth-code'`.
- [ ] **One-Popup Experience:** Merge Identity and Drive scopes into a single initial login request.
- [ ] **Permanent Sessions:** Fully activate the Refresh Token (Master Key) logic for all users.
- [ ] **Code Cleanup:** Remove all "Safe Entry" fallbacks and redundant login hooks.

---

## 🛡️ Support & Timeline
- **Initial Review:** 3-7 business days.
- **Total Duration:** 2-4 weeks if revisions are needed.
- **Tip:** Respond to Google's "Trust & Safety" emails within 24 hours to keep the process moving.
