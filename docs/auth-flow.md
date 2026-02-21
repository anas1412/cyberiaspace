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
- **Phase 2:** Connect Drive (Optional button in Account Menu).
- **Phase 3:** Revoke (Permanent deletion of cloud keys).

## 4. Drive State Persistence
The `driveEnabled` setting is stored in the cloud profile. This ensures that if a user has authorized Drive on one device, it automatically attempts to resume the connection on other devices without new popups.
