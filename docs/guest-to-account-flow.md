# Local-to-Account Data Flow Specification

## Core Principle: Simple Space-Level Migration

When a user logs in with local data, Cyberia performs an assessment to handle local work without complex merging.

---

## The Flow

### Phase 1: Import Cloud Data (Always First)
1. User logs in.
2. Fetch existing cloud spaces and thoughts.
3. Load them into local IndexedDB.
4. User's account state is now active locally.

### Phase 2: Assess Local Data
1. Find all local spaces (`userId: 'guest'`).
2. Identify "Real" local spaces (those containing at least 1 thought).
3. Count Cloud Spaces vs. Real Local Spaces.

### Phase 3: Decision Matrix

| Local State | Cloud Account State | Action |
| :--- | :--- | :--- |
| **Has spaces with thoughts** | **Empty (0 thoughts)** | **Auto-Migrate**: Seamlessly move local work to account. |
| **Empty / No thoughts** | **Has spaces** | **Skip**: Open cloud workspace (local data hidden). |
| **Has spaces with thoughts** | **Has spaces** | **Conflict**: Prompt user via Quota Resolution modal. |

---

## Quota Resolution (The Modal)

If both Local and Cloud have active data, we check if adding them together exceeds the plan limit.

### Case A: Within Quota (`Local + Cloud <= Limit`)
- **Prompt**: "Move Local Work?"
- **Options**:
  - **Move to Account**: Ownership of local work changes to the user ID. Sync starts.
  - **Keep Separate**: Modal closes. Local data stays local (`userId: 'guest'`) and isolated.

### Case B: Exceeds Quota (`Local + Cloud > Limit`)
- **Prompt**: "Space Limit Reached"
- **Options**:
  - **Upgrade to Pro**: Opens pricing to increase limits.
  - **Keep Separate**: Modal closes. Local data stays local and isolated.

---

## Core Rules

1. **Cloud Priority**: Account data is always loaded first.
2. **Never Force Deletion**: We never prompt to "Discard" during migration. Data is either migrated or kept safe locally.
3. **No Thought Merging**: We move entire spaces. We don't mix local thoughts into cloud spaces or vice versa.
4. **Simple Terms**: Use human-friendly language ("Move local work" instead of "Migrate records").
5. **Escape Hatch**: Every modal has a Close (X) button that acts as "Keep Separate" (non-destructive).
6. **Session Dismissal**: If a user clicks "Keep Separate", the prompt is silenced for the remainder of their session to prevent infinite loops.
