# Theme Consolidation Plan

## Context

The Cyberia app has a solid theme infrastructure with CSS variables for dark/light modes, but implementation is incomplete. Core components use CSS variables correctly, but the Dashboard pages and some utility components still use hardcoded colors.

## Goal

Achieve 100% theme compliance across all components. Every visual element should dynamically adapt to dark/light mode via CSS variables.

---

## TODOs

### Phase 1: CSS Foundation (High Priority)

- [ ] **Add light theme scrollbar styles** in `index.css`
  - Override `.custom-scroll` and `.switcher-scrollbar` for `[data-theme='light']`
  - Use dark/thin scrollbar colors for readability on light backgrounds
  - Add Firefox scrollbar support (`scrollbar-color`)

- [ ] **Add global `::selection` and `focus-visible` styles** in `index.css`
  - `::selection { background: var(--accent); color: var(--accent-contrast); }`
  - `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`

- [ ] **Verify `--prio-medium` (yellow) has sufficient contrast** in light mode
  - Test if `#eab308` is visible on white backgrounds
  - Adjust if needed (darker yellow or amber)

### Phase 2: Dashboard Migration (High Priority)

- [ ] **Migrate `DashboardLayout.tsx`** to CSS variables
  - Replace `bg-white/5` → `bg-[var(--glass-bg)]`
  - Replace `text-white` → `text-[var(--text-primary)]`
  - Replace `border-white/*` → `border-[var(--glass-border)]`

- [ ] **Migrate `Dashboard.tsx`** to CSS variables
  - Stats cards, quick action buttons, error states
  - Status badge backgrounds (keep color, make opacity dynamic)

- [ ] **Migrate `DashboardUsers.tsx`** to CSS variables
  - User cards, role badges, action buttons
  - Form inputs, table rows

- [ ] **Migrate `DashboardFeedback.tsx`** to CSS variables
  - Feedback cards, type badges, status indicators
  - Filter tabs, action buttons

- [ ] **Migrate `DashboardSettings.tsx`** to CSS variables
  - Form inputs, password fields
  - Danger zone styling (red is semantic, OK to keep but use opacity variants)

- [ ] **Migrate `DashboardSidebar.tsx`** to CSS variables
  - Nav items, hover states, active indicators

### Phase 3: Utility Components (Medium Priority)

- [ ] **Migrate `EmptyState.tsx`** to CSS variables
  - Remove `text-slate-400`, `bg-slate-200/*`
  - Use `isLight` check but with CSS variables instead of hardcoded colors
  - Replace `text-white` → `text-[var(--text-primary)]`

- [ ] **Migrate `MobilePage.tsx`** to CSS variables
  - Replace `bg-black`, `text-white`, `bg-white/*`
  - Use theme-aware glass containers

- [ ] **Review `Lightbox.tsx`** for theme compliance
  - Check overlay, navigation buttons, close button

### Phase 4: Verification & Polish (Low Priority)

- [ ] **Add CSS variable cheat sheet** to `index.css` comments
  - Document all available variables
  - Show dark vs light values

- [ ] **Test all views in both themes**
  - Spatial canvas
  - Kanban view
  - Calendar view
  - Focus editor
  - All modals

- [ ] **Verify third-party components**
  - DateTimePicker
  - Dropdown menus
  - Any external library components

---

## Migration Pattern Reference

### Input Fields
```tsx
// ❌ Before
className="bg-white/5 border border-white/5 text-white placeholder:text-[var(--text-muted)]"

// ✅ After  
className="bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
```

### Buttons
```tsx
// ❌ Before
className="bg-white/5 hover:bg-white/10 text-white rounded-xl"

// ✅ After
className="bg-[var(--glass-bg)] hover:bg-[var(--bg-page)] text-[var(--text-primary)] rounded-xl"
```

### Cards/Containers
```tsx
// ❌ Before
className="bg-white/5 border border-white/5 rounded-2xl"

// ✅ After
className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl"
```

### Status Colors (OK to Keep)
```tsx
// Status badges can keep semantic colors but should use opacity variants
// ✅ Accepted (status is semantic, not theme-dependent)
className="bg-red-500/20 text-red-400 border-red-500/30"

// ⚠️ For backgrounds that need to adapt, consider:
className="bg-[var(--status-error-bg)] text-[var(--status-error-text)]"
```

### Text Colors
```tsx
// ❌ Before - hardcoded white/slate
className="text-white"
className="text-slate-400"

// ✅ After - CSS variables
className="text-[var(--text-primary)]"
className="text-[var(--text-muted)]"
```

---

## Not Applicable (Already Correct)

These components are already theme-compliant:
- ✅ `Modal.tsx` - Uses CSS variables throughout
- ✅ `ThoughtContainer.tsx` - Uses CSS variables
- ✅ `Atmosphere.tsx` - Dynamic blend modes
- ✅ `BackgroundEngine.tsx` - Theme-aware gradient
- ✅ `Starfield.tsx` - Theme-aware rendering
- ✅ Most toolbar components (StatusBar, Toolbar, SpaceSwitcher, etc.)
- ✅ Most editor components (FocusEditor, TextRenderer, etc.)

---

## Dependencies

None - all tasks are independent fixes within existing files.

## Verification

After each phase:
1. Run `npm run build` to ensure no type errors
2. Toggle theme in Settings
3. Visually inspect affected components in both themes
4. Check for any CSS variable usage errors in browser console
