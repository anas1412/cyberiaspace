# Onboarding & Development Rules

This document outlines the mandatory standards for contributing to the Cyberia codebase.

## 1. Technical Mandates
- **Local-First:** All UI interactions must work instantly via IndexedDB before cloud sync occurs.
- **DVH Awareness:** Always use `100dvh` for height calculations.
- **Scaling Rule:** Mouse coordinates must be normalized using `getGlobalScale()`.
- **Z-Index Discipline:** Follow the levels defined in `design-system.md` to avoid layout overlapping.

## 2. Terminology Rules (NON-NEGOTIABLE)
Do not use generic "Mind Map" or "Neural" terms.
- **Thought**: A workspace object.
- **Stack**: A cluster of objects.
- **Oracle**: The AI layer.
- **Space**: An isolated workspace.
- **Label**: A pure title object.

## 3. Deployment & Verification
Before pushing changes:
1. **Linting:** Run `npm run lint`.
2. **Build:** Run `npm run build` to verify CSS and lazy-loading stability.
3. **Google Scopes:** Do not add scopes to the main login flow without updating the `google_verification_guide.md`.

## 4. Environment Variables
Ensure the following are set in your development `.env` or Vercel Dashboard:
- `VITE_GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET` (Backend only)
- `GROQ_API_KEY`
- `KV_REST_API_URL` / `KV_REST_API_TOKEN`
