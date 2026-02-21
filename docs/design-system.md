# Design System & UI Standards

Cyberia uses a "Cinematic Spatial" aesthetic designed for focus and flow.

## 1. Aesthetic Principles
- **Atmospheric Depth:** Backgrounds use nebula glows and star layers.
- **Glassmorphism:** UI layers use `backdrop-filter: blur(24px)` and high-contrast borders.
- **Kinetic Physics:** Thoughts have inertia, repulsion, and attraction.

## 2. Responsive Math
To maintain cursor alignment across devices, Cyberia uses a global scaling system:
- **Base Scale:** `0.85` for laptops, `0.7` for tablets, `0.6` for phones.
- **`100dvh`**: Every viewport calculation uses Dynamic Viewport Height to account for mobile browser bars.
- **Normalization:** Every mouse/touch coordinate is divided by the result of `getGlobalScale()` before being used in physics math.

## 3. Component Patterns

### The "Focus Shell"
All full-screen editors (Text, Tasks, File, Table) must use the `FocusEditorShell.tsx`.
- **Top:** Title, Status Badge, Close Button.
- **Bottom:** Footer Status (e.g. "Synced to Drive") and Actions (e.g. "Download").
- **Middle:** Scrollable content area with standard `custom-scroll` styles.

## 4. Themes
Themes are applied at the **Space level**.
- **Cyberia:** Deep Indigo/Navy.
- **Sea:** Teal/Cyan.
- **Forest:** Emerald/Black.
- **Rain:** Stone/Grey.

## 5. TERMINOLOGY MANDATE (CRITICAL)
NEVER use the following terms in the UI or code:
- ❌ "Neural" / "Neural Link"
- ❌ "Synapse"
- ❌ "Mind Map"

ALWAYS use Cyberia-native terms:
- ✅ "Data Stream"
- ✅ "Spatial Mapping"
- ✅ "Workspace"
- ✅ "Cloud Sync"
- ✅ "Oracle"
