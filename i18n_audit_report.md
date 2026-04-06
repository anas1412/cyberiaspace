# 🔍 i18n Audit Report: Cyberia Web App

This report tracks all files containing hardcoded user-facing strings that need to be replaced with translation keys for the English ↔ French integration.

## 📊 Summary
- **Total Files Identified:** ~60+
- **Priority Levels:** High (Core UI & Navigation), Medium (Content/Pages), Low (Admin/Utils)
- **✅ Completed:** Homepage translation

---

## 🟢 Completed Files
| File Path | Status |
|-----------|--------|
| `src/components/Homepage.tsx` | ✅ Translated (EN + FR) |
| `src/components/PricingPage.tsx` | ✅ Translated (EN + FR) |
| `src/i18n.ts` | ✅ Created |
| `src/locales/en.json` | ✅ Created (Homepage + Pricing translations) |
| `src/locales/fr.json` | ✅ Created (Homepage + Pricing translations) |
| `src/main.tsx` | ✅ Updated (i18n import) |
| `src/store/types.ts` | ✅ Updated (language state) |
| `src/store/slices/uiSlice.ts` | ✅ Updated (language state & setLanguage action) |

## 🔴 High Priority (Core UI & Navigation)
| File Path | Description of Strings | Status |
|-----------|-------------------------|--------|
| `src/components/toolbar/StatusBar.tsx` | Capacity, Undo, Redo, Physics, tooltips | ⏳ Pending |
| `src/components/toolbar/ViewSwitcher.tsx` | Spatial, Kanban, Calendar, Directory | ⏳ Pending |
| `src/components/toolbar/AccountMenu.tsx` | Profile, Settings, Logout | ⏳ Pending |
| `src/components/toolbar/Modals.tsx` | Settings, Help, tabs, labels, descriptions | ⏳ Pending |
| `src/components/toolbar/SpaceSwitcher.tsx` | Space management labels | ⏳ Pending |
| `src/components/toolbar/ActionFAB.tsx` | "Create" labels | ⏳ Pending |
| `src/components/toolbar/AIToggleButton.tsx` | AI mode labels | ⏳ Pending |
| `src/components/Modal.tsx` | Shared modal buttons (Confirm, Cancel) | ⏳ Pending |
| `src/components/LoadingOverlay.tsx` | Loading messages | ⏳ Pending |
| `src/components/EmptyState.tsx` | Empty state messages | ⏳ Pending |
| `src/components/Navigation.tsx` | Main navigation links | ⏳ Pending |

## 🟡 Medium Priority (Editors & Content)
| File Path | Description of Strings | Status |
|-----------|-------------------------|--------|
| `src/components/editors/TextFocusEditor.tsx` | Placeholders, tooltips | ⏳ Pending |
| `src/components/editors/TasksFocusEditor.tsx` | Task-specific labels | ⏳ Pending |
| `src/components/editors/TableFocusEditor.tsx` | Table-specific labels | ⏳ Pending |
| `src/components/ThoughtNode.tsx` | Context menus, status labels | ⏳ Pending |
| `src/components/NodeMenu.tsx` | Context menu items | ⏳ Pending |
| `src/components/MultiSelectionMenu.tsx` | Bulk action labels | ⏳ Pending |
| `src/components/Inspector.tsx` | Thought details and metadata labels | ⏳ Pending |
| `src/components/auth/LoginPage.tsx` | Login labels, social auth buttons | ⏳ Pending |
| `src/components/FeedbackPage.tsx` | Feedback form labels | ⏳ Pending |

## 🟢 Low Priority (Infrastructure & Admin)
| File Path | Description of Strings | Status |
|-----------|-------------------------|--------|
| `src/constants.ts` | Plan names, feature lists, static text | ⏳ Pending |
| `src/db.ts` | Initial workspace names | ⏳ Pending |
| `src/pages/dashboard/*` | Dashboard-specific pages | ⏳ Pending |
| `src/utils/access.ts` | Access guard messages | ⏳ Pending |
| `src/utils/errorParser.ts` | Error messages | ⏳ Pending |

---

## 🛠️ Infrastructure Tasks
- [x] Install `i18next`, `react-i18next`, `i18next-browser-languagedetector`
- [x] Create `src/i18n.ts` configuration
- [x] Create `src/locales/en.json`
- [x] Create `src/locales/fr.json`
- [x] Initialize i18n in `src/main.tsx`
- [x] Add language state to `uiSlice.ts`
