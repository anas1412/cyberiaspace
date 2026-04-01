# Plan: Integrate tui.image-editor for Paint Thought

## Context

The current Paint Focus Editor uses a custom canvas-based implementation for drawing. The user wants to integrate **tui.image-editor** (by TOAST UI) to provide a more full-featured image editing experience with built-in tools like crop, rotation, filters, text overlay, etc.

## Goal

Replace or enhance the current custom paint canvas with tui.image-editor to provide professional image editing capabilities within paint thoughts.

---

## TODOs

### Phase 1: Research & Setup

- [ ] **Research tui.image-editor integration options**
  - Check npm package: `tui-image-editor`
  - Review React wrapper options: `react-image-editor` or custom wrapper
  - Verify TypeScript support
  - Check bundle size impact

- [ ] **Install dependencies**
  - Install `tui-image-editor`
  - Install any required types (`@types/tui-image-editor` if available)
  - Check for peer dependencies (fabric.js, etc.)

### Phase 2: Component Architecture

- [ ] **Create ImageEditorWrapper component**
  - Wrap tui.image-editor in React component
  - Handle ref forwarding for imperative API
  - Manage initialization and cleanup lifecycle
  - Handle theme integration (dark/light mode styling)

- [ ] **Create PaintFocusEditorV2 component**
  - Replace or enhance existing canvas with tui.image-editor
  - Maintain existing toolbar actions (brush size, color, etc.)
  - Map existing paint tools to tui-image-editor features

### Phase 3: Theme Integration

- [ ] **Apply dark/light theme to editor**
  - Customize tui.image-editor CSS for theme colors
  - Override default white background with `var(--bg-page)`
  - Match toolbar styling with existing design system

- [ ] **Handle editor UI theming**
  - Buttons, icons, menus matching app theme
  - CSS variable overrides for editor chrome

### Phase 4: Data Flow

- [ ] **Connect editor to thought data**
  - Load existing image/blob into editor on mount
  - Export edited image on save
  - Handle blob ↔ dataURL conversion
  - Store edited image back to thought

- [ ] **Handle undo/redo**
  - Integrate with thought history slice
  - Proper state management for edits

### Phase 5: UI Polish

- [ ] **Match toolbar to existing design**
  - Replace tui default toolbar with custom toolbar
  - Keep only needed tools (crop, rotate, flip, text, draw)
  - Style buttons to match app design system

- [ ] **Responsive handling**
  - Editor sizing in focus mode
  - Mobile compatibility

### Phase 6: Testing & Polish

- [ ] **Test in both themes**
  - Dark mode appearance
  - Light mode appearance

- [ ] **Test core workflows**
  - Load existing paint thought
  - Edit and save
  - Create new paint thought
  - Undo/redo

---

## Key Decisions Needed

1. **Replace or enhance?** Should we replace the custom canvas entirely or add tui as an option?
2. **React wrapper?** Use existing React wrapper or custom wrapper?
3. **Bundle size?** tui-image-editor is ~500KB. Acceptable?
4. **Feature scope?** Which tui tools to expose?

---

## Dependencies

- `tui-image-editor`
- Possibly `@types/tui-image-editor`
- fabric.js (peer dependency)

## Risks

- Bundle size increase (~500KB)
- Theme customization complexity
- Breaking existing paint thought compatibility
