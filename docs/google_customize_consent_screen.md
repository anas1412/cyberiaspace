Here is the full technical documentation from the Google Developers page regarding OpenID Connect and the **Consent Page Experience**, formatted as a high-fidelity Markdown file for LLM use.

---

# Google OpenID Connect: Protocol & Consent Experience

## Overview
Google's OAuth 2.0 APIs support both authentication and authorization, conforming to the **OpenID Connect (OIDC)** specification. This document describes the implementation for authentication, which is OpenID Certified.

## 1. Setting Up OAuth 2.0
Before an application can use Google's authentication system, you must configure a project in the [Google Cloud Console](https://console.cloud.google.com/).

### Obtain Credentials
*   **Client ID & Client Secret:** Unique identifiers for your application.
*   **Redirect URIs:** The endpoints where Google sends responses. These must exactly match the URI used in the authentication request.

### Customize the User Consent Screen
The consent screen is the primary interface users see during the authentication process. It describes the information the user is releasing and the terms that apply.

#### Key Components of the Consent Screen:
1.  **Branding Information:**
    *   Product Name
    *   Logo
    *   Homepage URL
    *   Privacy Policy & Terms of Service links.
2.  **Requested Scopes:** 
    *   The screen lists the specific data your app is requesting (e.g., "See your primary Google Account email address").
    *   Standard OIDC scopes include `openid`, `email`, and `profile`.
3.  **User Choice:**
    *   Users can choose to grant or deny access.
    *   In some cases, users can selectively grant specific scopes (e.g., Google Drive access but not Calendar).

#### Configuration Steps:
1.  Navigate to the **APIs & Services > OAuth consent screen** page in Google Cloud Console.
2.  Select **User Type** (Internal or External).
3.  Provide app metadata (Branding).
4.  Add **Scopes** that your application requires.

---

## 2. The Authentication Flow (Server Flow)
Authenticating a user involves obtaining an ID token and validating it.

### Step 1: Create an Anti-Forgery State Token
To prevent CSRF attacks, create a unique session token (state) that you verify upon the user's return.

```python
# Example State Generation (Python)
state = hashlib.sha256(os.urandom(1024)).hexdigest()
session['state'] = state
```

### Step 2: Send an Authentication Request to Google
The app sends an HTTPS GET request to the authorization endpoint: `https://accounts.google.com/o/oauth2/v2/auth`.

**Common Parameters:**
| Parameter | Required | Description |
| :--- | :--- | :--- |
| `client_id` | Yes | Obtained from Cloud Console. |
| `response_type` | Yes | Set to `code` for server flow. |
| `scope` | Yes | Must include `openid`. Usually `openid email profile`. |
| `redirect_uri` | Yes | Must match the registered URI. |
| `state` | Recommended | The anti-forgery token. |
| `nonce` | Yes | Random value to prevent replay attacks. |
| `login_hint` | Optional | User's email to suppress account chooser. |
| `prompt` | Optional | Values: `none`, `consent`, `select_account`. |

**Sample Request URI:**
```text
https://accounts.google.com/o/oauth2/v2/auth?
 response_type=code&
 client_id=YOUR_CLIENT_ID.apps.googleusercontent.com&
 scope=openid%20email&
 redirect_uri=https://your-app.com/callback&
 state=security_token_xyz&
 nonce=n-0S6_W774H1
```

### Step 3: Confirm State Token
Upon redirect, ensure the `state` parameter in the response matches the one generated in Step 1.

### Step 4: Exchange Code for Tokens
Your server makes an HTTPS POST request to `https://oauth2.googleapis.com/token`.

**Payload:**
*   `code`: The authorization code from the response.
*   `client_id`, `client_secret`: Your app's credentials.
*   `redirect_uri`: Same as Step 2.
*   `grant_type`: `authorization_code`.

---

## 3. The ID Token
The ID Token is a JSON Web Token (JWT) containing identity claims.

### ID Token Claims
| Claim | Provided | Description |
| :--- | :--- | :--- |
| `iss` | Always | Issuer (e.g., `https://accounts.google.com`). |
| `sub` | Always | **Unique identifier** for the user (never reused). |
| `aud` | Always | Client ID for which the token was issued. |
| `exp` | Always | Expiration time (Unix epoch). |
| `email` | Optional | User's email (requires `email` scope). |
| `email_verified`| Optional | Boolean indicating if the email is verified. |
| `hd` | Optional | Hosted domain (for Google Workspace users). |

> **Warning:** Use the `sub` field as the unique identifier for user records, not the `email` field, as emails can change.

---

## 4. Advanced Topics & Best Practices

### Prompting Re-consent
By default, Google only shows the consent screen the first time a user authorizes your app. To force the screen to appear again, use:
*   `prompt=consent` in the authentication request.

### Refresh Tokens
To obtain a refresh token for offline access, include `access_type=offline` in the request. This allows your app to refresh access tokens without the user being present.

### Incremental Authorization
If your app needs additional scopes later, you can request them. By setting `include_granted_scopes=true`, the new consent screen will ask only for the new permissions while maintaining the old ones.

### Token Validation
For production, validate the ID token locally:
1.  Verify the signature using Google's public keys (found at `jwks_uri` in the Discovery Document).
2.  Verify the `iss` is `https://accounts.google.com`.
3.  Verify the `aud` matches your `client_id`.
4.  Verify the `exp` has not passed.

---

## 5. Discovery Document
Google provides a configuration file at a "well-known" URI to automate endpoint discovery:
`https://accounts.google.com/.well-known/openid-configuration`

This JSON includes:
*   `authorization_endpoint`
*   `token_endpoint`
*   `userinfo_endpoint`
*   `jwks_uri` (Public keys for token validation)

---
**Note for LLM:** This documentation focuses on the *Server Flow*. For client-side or JavaScript-only applications, Google recommends using the **Google Identity Services** library which handles the *Implicit Flow* more securely.