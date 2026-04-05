<!-- Context: core/standards/ui-components | Priority: high | Version: 1.0 | Updated: 2026-04-03 -->
# UI Component Standards

**Purpose**: Enforce visual consistency across the application.
**Enforcement**: Tier 2 - Lint rules check most patterns, manual review for edge cases.

---

## 1. CSS Variables (MANDATORY)

**Never use hardcoded colors.**

```tsx
// ❌ WRONG
<div className="text-white bg-black/20 border-white/5" />

// ✅ CORRECT
<div className="text-[var(--text-primary)] bg-[var(--glass-bg)] border-[var(--glass-border)]" />
```

### Theme Variables Reference

| Variable | Dark | Light | Usage |
|----------|------|-------|-------|
| `--bg-page` | `#05060a` | `#f8fafc` | Page background |
| `--bg-main` | `#18181b` | `#ffffff` | Cards/main areas (neutral gray) |
| `--node-bg` | `#18181bf5` | `#fffffffa` | Thought nodes (neutral dark, NOT blue) |
| `--text-primary` | `#f8fafc` | `#1e293b` | Primary text |
| `--text-secondary` | `rgba(248,250,252,0.85)` | `rgba(30,41,59,0.85)` | Secondary text |
| `--text-muted` | `rgba(248,250,252,0.55)` | `rgba(30,41,59,0.65)` | Muted/placeholder |
| `--glass-bg` | `rgba(10,10,15,0.75)` | `rgba(255,255,255,0.85)` | Glass containers |
| `--glass-border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` | Glass borders |
| `--accent` | `#6366f1` | `#6366f1` | Primary accent |

### Allowed Exceptions

- Status indicators: `text-green-500`, `text-amber-500`, `text-red-500`
- Capacity dots: Green (<80%), Amber (80-99%), Red (100%+)

---

## 2. Typography Scale

| Size | Usage | Tailwind |
|------|-------|----------|
| 9px | Labels, tags, badges | `text-[9px]` |
| 10px | Keyboard shortcuts | `text-[10px]` |
| 11px | Secondary metadata | `text-[11px]` |
| 12px | Body small, timestamps | `text-xs` |
| 13px | Default body text | `text-[13px]` |
| 14px | Body medium | `text-sm` |
| 16px | Focus editor | `text-base` |
| 20px | Section headings | `text-xl` |
| 24px+ | Major headings | `text-2xl`+ |

---

## 3. Glass Container Pattern

**Standard overlay/panel structure:**

```tsx
<div className="glass px-3 h-[44px] rounded-2xl flex items-center gap-1 
                border border-[var(--glass-border)] shadow-lg shadow-[var(--glass-border)]">
  {/* Content */}
</div>
```

### Glass Utility Classes

```css
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
```

---

## 4. Overlay Backdrop Pattern

**All modals and overlays must use:**

```tsx
// Standard overlay backdrop
<div className="fixed inset-0 bg-[var(--bg-page)]/60 backdrop-blur-md z-[N]">
```

**Never use:** `bg-black/80`, `bg-white/50`, or hardcoded colors.

---

## 5. Toolbar Components

**All toolbar components must be 44px height:**

```tsx
// Standard toolbar container
<div className="glass h-[44px] rounded-2xl flex items-center gap-1 ...">
```

### Button Pattern

```tsx
<button className="px-3 h-full rounded-xl text-[var(--text-muted)] 
                   hover:text-[var(--text-primary)] hover:bg-[var(--bg-page)]">
```

### Input Pattern

```tsx
<input className="bg-[var(--glass-bg)] border border-[var(--glass-border)]
                  text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" />
```

---

## 6. Theme Transitions

**All elements transition on theme change:**

```css
*, *::before, *::after {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-duration: 0.2s;
  transition-timing-function: ease;
}
```

---

## 7. Dropdown & Menu Patterns

**Custom dropdowns must use `bg-[var(--glass-bg)]` - NEVER `bg-[var(--bg-main)]`:**
- Button: `bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl`
- Hover: `hover:border-[var(--accent)]/50`
- Menu dropdown: `bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.3)]`
- Active item: `bg-[var(--accent)]/10 text-[var(--accent)]`
- Hover item: `hover:bg-[var(--glass-bg)]`

**⚠️ WARNING:** Do NOT use `bg-[var(--bg-main)]` for dropdowns - it has a blue tint in dark mode (`#0f172a`). Always use `bg-[var(--glass-bg)]` for consistent glass-morphism effect.

```tsx
// Button
<button className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl px-3 py-2 text-[11px] hover:border-[var(--accent)]/50">

// Dropdown menu
<div className="absolute top-full mt-1 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
  <button className="w-full px-3 py-2 text-left hover:bg-[var(--glass-bg)]">
    Option
  </button>
</div>
```

---

## 📂 Codebase References

- `src/index.css` - CSS variables and theme system
- `tailwind.config.js` - Theme configuration
- `src/components/NodeMenu.tsx` - Menu component patterns
- `src/components/Inspector.tsx` - Panel component patterns
- `src/components/MultiSelectionMenu.tsx` - Selection UI patterns

---

## Related Files

- Code Quality: `.opencode/context/core/standards/code-quality.md`
- State Mutations: `.opencode/context/core/processes/state-mutations.md`
