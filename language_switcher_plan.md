# 🌍 Language Switcher Integration Plan (English ↔ French)

This document outlines the audit findings and the step-by-step plan to integrate internationalization (i18n) into the Cyberia web application, enabling users to switch between English and French.

## 🔍 Current State Audit
- **Hardcoded Strings:** User-facing text is currently hardcoded in English across components (e.g., `StatusBar.tsx`, `Modals.tsx`, `AccountMenu.tsx`).
- **No i18n Infrastructure:** The project lacks an i18n library (e.g., `i18next`).
- **No Language State:** The Zustand `uiSlice` does not track or persist language preferences.
- **UI Constraints:** The app uses a strict glassmorphism design with fixed-height components (`h-[44px]`). French text is often 20-30% longer than English, which may require layout adjustments.

---

## 🛠️ Phase 1: Infrastructure Setup
1. **Install Dependencies:**
   ```bash
   npm install i18next react-i18next i18next-browser-languagedetector
   ```
2. **Locale Files:** Create `src/locales/en.json` and `src/locales/fr.json` to store translation keys.
3. **Configuration:** Create `src/i18n.ts` to initialize the library with:
   - Language detection (browser preference + localStorage).
   - Fallback to English.
   - Integration with React.
4. **Initialization:** Import `src/i18n.ts` in `src/main.tsx`.

## 💾 Phase 2: State & Persistence
1. **Zustand Update:** Add `language` state and `setLanguage` action to `src/store/slices/uiSlice.ts`.
2. **Persistence:** 
   - Save selection to `localStorage` (key: `cyberia-lang`).
   - Sync with `i18next.changeLanguage()`.
3. **Auth Sync:** If the user is authenticated, save the language preference to their profile in Supabase.

## ✍️ Phase 3: String Extraction & Translation
1. **Priority 1 (Toolbars & Navigation):**
   - `StatusBar.tsx`: Capacity, Undo, Redo, Physics labels.
   - `ViewSwitcher.tsx`: Spatial, Kanban, Calendar, Directory labels.
   - `AccountMenu.tsx`: Profile, Settings, Logout.
2. **Priority 2 (Modals & Settings):**
   - `Modals.tsx`: Settings tabs, labels, descriptions, and help content.
   - `Modal.tsx`: Shared modal buttons (Confirm, Cancel).
3. **Priority 3 (Editors & Content):**
   - `ThoughtNode.tsx`: Context menus and status labels.
   - `FocusEditor`: Placeholder text and tooltips.
4. **French Translation:** Populate `fr.json` with accurate, user-friendly French equivalents.

## 🎨 Phase 4: UI Integration & Layout Audit
1. **Language Switcher UI:**
   - Add a toggle or dropdown in the **Settings Modal** (General tab).
   - Use flags or text labels (EN/FR).
2. **Layout Verification:**
   - Audit `StatusBar.tsx` and `ViewSwitcher.tsx` for text overflow.
   - Use `truncate` or adjust `min-width` where necessary to accommodate longer French strings.
   - Ensure tooltips remain centered and readable.

## ✅ Phase 5: Validation & Testing
1. **Persistence:** Verify that the language persists after page refresh and logout/login.
2. **Missing Keys:** Use `i18next` debug mode to ensure no raw keys are visible.
3. **Responsive Check:** Ensure the language switcher and translated text work correctly on smaller viewports.

---

## 📅 Timeline Estimate
- **Phase 1 & 2:** 1 hour
- **Phase 3 (Extraction):** 3-4 hours
- **Phase 4 (UI & Audit):** 1-2 hours
- **Phase 5 (Validation):** 1 hour
