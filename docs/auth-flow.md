# Authentication Flow

Cyberia uses a tiered authentication model to balance user friction with data security.

## 1. Flow Types

| Mode | Flow | Purpose |
| :--- | :--- | :--- |
| **Safe Entry** | **Implicit** | Initial login. Grants basic info (Identity) without verification warnings. |
| **Full Sync** | **Auth Code** | Google Drive link. Requests offline access and permanent sync. |

## 2. Permanent Session Architecture
To eliminate recurring popups and 1-hour session expiries:
1. **Frontend:** Requests a one-time "Authorization Code" from Google.
2. **Backend:** Exchanges the code for an `access_token` and a `refresh_token`.
3. **KV Storage:** The `refresh_token` (Master Key) is saved in the user's Vercel KV profile.
4. **Silent Refresh:** Every time the app initializes, the backend uses the master key to fetch a new temporary token silently.

## 3. Incremental Consent
Users are never forced to grant Drive permissions during the initial sign-in.
- **Phase 1:** Sign In (Email/Name only).
- **Phase 2:** Connect Drive (Optional button in System Tray).
- **Phase 3:** Revoke (Permanent deletion of cloud keys).

## 4. Drive State Persistence
The `driveEnabled` setting is stored in the cloud profile. This ensures that if a user has authorized Drive on one device, it automatically attempts to resume the connection on other devices without new popups.

## 5. Local-to-Account Migration Flow

When a user logs in (Local → Authenticated), Cyberia performs a "Space-Level Handshake" to handle local guest data.

### Logic Matrix

| Local State | Cloud Account State | Action |
| :--- | :--- | :--- |
| **Has spaces with thoughts** | **Empty (0 thoughts)** | **Auto-Migrate**: Move all local spaces to account. |
| **Empty / No thoughts** | **Has spaces** | **No Migration**: Load cloud data as-is. |
| **Has spaces with thoughts** | **Has spaces** | **Quota Conflict**: Trigger Quota Resolution modal. |

### Quota Resolution

If both the local device and cloud account have data, the system checks if the total space count exceeds the user's plan limit.

#### Case A: Within Quota (`Local + Cloud <= Limit`)
- **Prompt**: "Move Local Work?"
- **Description**: "You have X local space(s) and Y account space(s). Would you like to move your local work into your account?"
- **Options**:
  - **Move to Account**: Changes ownership of local spaces to the user.
  - **Keep Separate**: Closes modal and leaves local data un-migrated (local only).

#### Case B: Exceeds Quota (`Local + Cloud > Limit`)
- **Prompt**: "Space Limit Reached"
- **Description**: "Moving local work would exceed your plan limit of Z spaces. Upgrade to Pro or keep them local for now."
- **Options**:
  - **Upgrade to Pro**: Opens pricing modal.
  - **Keep Separate**: Closes modal and leaves local data local.

### Core Principles
1. **Never Discard**: We never ask the user to delete their work during migration. They can either migrate it or keep it local.
2. **Simple Terms**: Use friendly language like "Move local work" instead of "Migrate metadata".
3. **Cloud Priority**: Cloud data is always imported first so the user sees their permanent account state immediately.
4. **Non-Destructive Defaults**: Closing the modal or clicking "Keep Separate" always preserves the local guest data safely.
5. **Loop Prevention**: Dismissing the prompt sets a session flag to prevent the modal from reappearing on every refresh.
