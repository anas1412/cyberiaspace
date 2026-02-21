# Google OAuth Verification & Migration Checklist

This document serves as your master TODO list for achieving Google Brand Verification for the `drive.file` scope on **cyberia.tn**.

---

## 🟢 Phase 1: Prerequisites (Completed)
- [x] **Verify Top Private Domain:** Ownership of `cyberia.tn` confirmed in Google Search Console.
- [x] **Authorized Domains List:** `cyberia.tn` added to the "Authorized Domains" section in Google Cloud Console.

---

## 🟡 Phase 2: Branding & Compliance (Action Required)
- [ ] **Match App Name:** Ensure the "App Name" in Google Console matches "Cyberia" exactly.
- [ ] **Support Email:** Ensure the support email is an active address (e.g., support@cyberia.tn).
- [ ] **Sign-in Branding:**
    - [ ] Button uses Google's multi-color "G" logo.
    - [ ] Button text is exactly "Sign in with Google".
    - [ ] Dark theme uses hex `#131314` with `#8E918F` border.
- [ ] **Legal Pages (Automated):**
    - [x] **Privacy Policy:** Hosted at `https://cyberia.tn/privacy`. Includes "Limited Use" clause.
    - [x] **Terms of Service:** Hosted at `https://cyberia.tn/terms`.
- [x] **Homepage Compliance:** Descriptive "About" content is visible before login to satisfy the "No Login Wall" rule.

---

## 🔴 Phase 3: The Verification Submission
- [ ] **Move to Production:** Change "Publishing Status" from Testing to **In Production**.
- [ ] **The Demo Video:** Create an unlisted YouTube video following this script:
    1. **Start:** Show `https://cyberia.tn`.
    2. **ID:** Click "Sign in with Google" and show the `client_id` in the URL bar.
    3. **Grant:** Accept permissions (including Drive).
    4. **Feature:** Upload a file and show it on the map.
    5. **Close:** State: "We use drive.file to enable user-owned large file storage."

---

## 🔵 Phase 4: Technical Migration (Lead Engineer Roadmap)
*Once verified, opencode will perform:*
- [ ] Convert `googleLogin` to `flow: 'auth-code'`.
- [ ] Merge Identity and Drive into a single login popup.
- [ ] Enable full background token rotation.
