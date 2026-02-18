# Cyberia: Custom Space Backgrounds Plan

This plan enables users to personalize their spaces with custom images or GIFs while maintaining the atmospheric theme animations (Rain, Stars, etc.).

## 1. Objectives
- **Personalization:** Allow each space to have a unique image/GIF background.
- **Atmospheric Layering:** The custom background sits *behind* theme animations.
- **Portability:** Custom backgrounds are included in snapshots for shared read-only spaces.
- **Performance:** Handle background images efficiently to avoid database bloat.

## 2. Data Schema Changes (`src/db.ts`)
Update the `Space` interface:
```typescript
interface Space {
  // ... existing fields
  customBg?: string | null; // Base64 or URL
}
```

## 3. Implementation Phases

### Phase 1: Storage & State
- **Store Logic (`useStore.ts`):** 
    - Add `setCustomBg(spaceId, data)` action.
    - Ensure `customBg` is included in the `publishSpace` snapshot.
    - Update `setActiveSpace` to clear or set the global `customBg` state when switching.
- **Storage Strategy:** 
    - Initial: Compressed Base64 in IndexedDB.
    - Future: Automatic upload to Google Drive `/Cyberia/Assets` (using the Drive Plan).

### Phase 2: Visual Layering (`App.tsx`)
Modify the background rendering stack:
1.  **Layer 0 (Bottom):** The `customBg` element (img or div with `background-image`).
    - CSS: `fixed inset-0 z-[-1] object-cover`.
2.  **Layer 1 (Middle):** Static theme gradient/color (Reduced opacity if `customBg` exists).
3.  **Layer 2 (Top):** Theme Animations (Stars, Rain, etc.).
    - CSS: `pointer-events-none`.

### Phase 3: UI Integration (`SystemTray.tsx`)
- Add a "Custom Background" section in the System Tray.
- **Actions:**
    - **Upload:** Trigger file picker (Images/GIFs).
    - **Remove:** Clear the `customBg` from the current space.
- **Validation:** 
    - Limit file size to 2MB (for local-first stability).
    - Show a compression warning for large GIFs.

## 4. Shared Space Logic
- When a space is published, the `customBg` string is included in the snapshot sent to Vercel KV.
- **Consistency:** Changing your local background **will not** affect existing shared links until the space is re-published. This preserves the "Snapshot" behavior.

## 5. CSS Optimization
- Add `.has-custom-bg` class to the `body` when a background is active.
- Use `mix-blend-mode` (e.g., `overlay` or `soft-light`) on some theme animations to make them pop against custom images.

## 6. Performance Mode Behavior
- If `performanceMode` is ON:
    - Custom backgrounds are still shown (static).
    - Animations are still hidden.
    - This allows users to have a custom "Wallpaper" even on low-power devices.
