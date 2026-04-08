# HowItWorksVisual - Implementation Plan

## Current Implementation Analysis

### What's Currently Done
- 4-step auto-advancing animation (3500ms per step)
- Step indicator dots at top
- Basic thought nodes spawning
- View toggle with 4 icons (simplified)

### Current Issues

| Aspect | Current | Should Be |
|--------|---------|-----------|
| **Step 1: Create Space** | Empty canvas with "+" in center | Space switcher at top-left + dropdown menu + create action |
| **Step 2: Add Thoughts** | Static positions, no "+" button visible | "+" button at bottom center → click spawns thoughts |
| **Step 3: Switch Views** | Shows view toggle with fixed icons | View switcher at top center → cycles through spatial→directory→kanban→calendar |
| **Step 4: Oracle AI** | Badge + beam animation | Chat panel on left side → typing "organize" → SVG lines connect thoughts |

### Current Positions (WRONG)
```
- Step indicator: top-6 left-1/2
- View toggle: top-14 left-4 (inside container)
- Oracle badge: top-14 right-4
- Canvas content: centered
```

### Required Positions (CORRECT)
```
- Space Switcher: top-8 left-8 (OUTSIDE canvas container)
- '+' Button: bottom-8 left-1/2 (OUTSIDE canvas container, centered)
- View Switcher: top-8 left-1/2 (OUTSIDE canvas container, centered)
- Oracle Chat: left-4 top-1/2 (OUTSIDE canvas container, left side)
```

---

## Real UI Patterns to Match

### 1. Space Switcher (SpaceSwitcher.tsx)
```tsx
// Container
<div className="flex flex-col items-center pointer-events-none z-[9999]">
  {/* Trigger Button */}
  <button className="h-full px-4 rounded-xl flex items-center gap-3 glass...">
    <div className="w-1.5 h-1.5 rounded-full bg-[status-color]" />
    <span className="text-[12px] font-semibold">Space Name</span>
    <ChevronDown className="w-3 h-3" />
  </button>
  
  {/* Dropdown Menu */}
  <motion.div className="absolute top-full mt-4 left-0 min-w-[300px] glass rounded-2xl...">
    {/* Space list */}
    {/* + Create Space button */}
  </motion.div>
</div>
```

### 2. '+' Button (Toolbar pattern)
```tsx
// Standard toolbar button pattern
<button className="h-full px-3 rounded-xl glass border border-[var(--glass-border)]...">
  <Plus className="w-4 h-4" />
</button>
```

### 3. View Switcher (ViewSwitcher.tsx)
```tsx
<div className="flex items-center h-[48px] p-1.5 glass rounded-2xl...">
  {VIEW_MODES.map((mode) => (
    <button className="px-2.5 h-full rounded-xl...">
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[8px] font-black uppercase tracking-widest">
        {mode.label}
      </span>
    </button>
  ))}
</div>

// 4 modes: spatial (Orbit), directory (FolderTree), kanban (Columns3), calendar (CalendarDays)
```

### 4. Oracle Chat (ChatOverlay + AgenticWorkspaceVisual)
```tsx
// Chat input
<div className="glass rounded-2xl px-6 py-4 border border-[var(--glass-border)]">
  <span className="text-[8px] font-black tracking-[0.4em] uppercase">ORACLE AI</span>
  <div className="flex items-center">
    <span className="text-[11px] font-mono">{'>'} @mention</span>
  </div>
</div>

// Stack linking (SVG lines from AgenticWorkspaceVisual)
<svg>
  <motion.line
    stroke="color-mix(in srgb, var(--accent-secondary) 45%, transparent)"
    strokeWidth="1"
    strokeDasharray="4 4"
    // Animate from center outward
  />
</svg>
```

### 5. View Transitions (DynamicViewsVisual patterns)

**Spatial View:** Free-floating thoughts with physics
**Directory View:** 
```tsx
<div className="glass rounded-2xl overflow-hidden">
  {/* Sidebar 160px + main panel */}
</div>
```

**Kanban View:**
```tsx
<div className="flex justify-around items-start">
  {['TODO', 'DOING', 'DONE'].map(label => (
    <span className="text-[10px] font-black tracking-[0.4em]">{label}</span>
  ))}
</div>
```

**Calendar View:**
```tsx
<svg>
  {/* 7 columns, 6 rows grid */}
  {[...Array(30)].map((_, i) => <text>{i + 1}</text>)}
</svg>
```

---

## Step-by-Step Animation Plan

### Step 1: Create your space (0-3.5s)
**Duration:** 3.5 seconds

| Time | Animation |
|------|----------|
| 0ms | Canvas empty, Space Switcher visible at top-left with dropdown |
| 500ms | Dropdown opens (fade + scale in) |
| 1000ms | "+ Create Space" button highlighted |
| 1500ms | Click animation, new space "Workspace" appears in list |
| 2000ms | Checkmark appears next to new space |
| 2500ms | Dropdown closes |
| 3000ms | Ready for next step |

**Visual Elements:**
- Space Switcher at `top-8 left-8` (absolute, outside canvas)
- Dropdown with space list
- "+ Create Space" with dashed border

### Step 2: Add your thoughts (3.5-7s)
**Duration:** 3.5 seconds

| Time | Animation |
|------|----------|
| 0ms | '+' button appears at bottom center |
| 500ms | Click '+' button |
| 800ms | First thought spawns (spring scale 0→1, scale 0.9) |
| 1200ms | Second thought spawns (doc type) |
| 1600ms | Third thought spawns (image type) |
| 2000ms | Thoughts settle into positions |
| 3000ms | Ready for next step |

**Visual Elements:**
- '+' Button at `bottom-8 left-1/2` (absolute, outside canvas)
- Thoughts: IDEAS (text), NOTES (doc), IMAGE (image)
- Positions: scattered like real canvas

### Step 3: Switch views anytime (7-10.5s)
**Duration:** 3.5 seconds (auto-advances)

| Time | Animation |
|------|----------|
| 0ms | View Switcher appears at top center |
| 200ms | Click Spatial → thoughts scatter with physics |
| 700ms | Click Directory → sidebar layout fades in |
| 1200ms | Click Kanban → TODO/DOING/DONE columns appear |
| 1700ms | Click Calendar → grid layout fades in |
| 2200ms | Thoughts reposition to calendar grid |
| 2700ms | Ready for next step |

**Visual Elements:**
- View Switcher at `top-8 left-1/2` (absolute, outside canvas)
- Icons: Orbit, FolderTree, Columns3, CalendarDays
- Transitions between views match DynamicViewsVisual

### Step 4: Oracle AI organizes (10.5-14s)
**Duration:** 3.5 seconds

| Time | Animation |
|------|----------|
| 0ms | Chat panel slides in from left |
| 400ms | Prompt: "organize my thoughts" types out |
| 1000ms | Beam effect from chat to thoughts |
| 1400ms | SVG lines animate connecting thoughts |
| 1800ms | Thoughts cluster into stack formation |
| 2200ms | Lines settle (dasharray animation) |
| 2700ms | Loop restarts |

**Visual Elements:**
- Chat at `left-4 top-1/2` (absolute, outside canvas)
- SVG lines: `strokeDasharray="4 4"`, `strokeWidth="1"`
- Stack formation matching AgenticWorkspaceVisual

---

## Component Structure

```
HowItWorksVisual
├── Step Indicator (dots)
├── Step Counter (1/4)
├── Canvas Container (glass rounded-2xl)
│   ├── Directory overlay (for directory view)
│   ├── Kanban overlay (TODO/DOING/DONE)
│   ├── Calendar overlay (grid lines + numbers)
│   └── Thoughts (positioned absolutely)
├── Space Switcher (top-left, absolute)
├── '+' Button (bottom-center, absolute)
├── View Switcher (top-center, absolute)
├── Oracle Chat (left-side, absolute)
└── Step Description (bottom)
```

---

## Implementation Tasks

### Task 1: Restructure Layout Positions
- [ ] Move Space Switcher to `top-8 left-8`
- [ ] Move '+' Button to `bottom-8 left-1/2 -translate-x-1/2`
- [ ] Move View Switcher to `top-8 left-1/2 -translate-x-1/2`
- [ ] Move Oracle Chat to `left-4 top-1/2 -translate-y-1/2`

### Task 2: Implement Space Switcher Pattern
- [ ] Add Space Switcher component with dropdown
- [ ] Add "+ Create Space" button with dashed border
- [ ] Add click animation → new space appears

### Task 3: Implement '+' Button Animation
- [ ] Add floating '+' button
- [ ] On click → spawn thoughts with spring animation
- [ ] Different types: text, doc, image

### Task 4: Implement View Switching (Step 3)
- [ ] Add View Switcher with 4 icons
- [ ] On each click → transition to different view layout
- [ ] Auto-cycle: spatial → directory → kanban → calendar

### Task 5: Implement Oracle Chat (Step 4)
- [ ] Add chat panel with typing animation
- [ ] Add beam effect to thoughts
- [ ] Add SVG lines connecting thoughts (stack formation)
- [ ] Match AgenticWorkspaceVisual line styles

### Task 6: Add View Overlays
- [ ] Directory: sidebar + main panel layout
- [ ] Kanban: 3 columns (TODO/DOING/DONE)
- [ ] Calendar: 7x6 grid with day numbers

### Task 7: Polish Animations
- [ ] Timing: 3.5s per step
- [ ] Smooth transitions between steps
- [ ] Match framer-motion patterns from other visuals

---

## Files to Modify
- `src/components/demo/HowItWorksVisual.tsx` (complete rewrite)

## Dependencies (already imported)
- framer-motion
- lucide-react (Plus, Orbit, FolderTree, Columns3, CalendarDays, ChevronDown, Sparkles, Layers)
- DemoThought

## No New Dependencies Needed
