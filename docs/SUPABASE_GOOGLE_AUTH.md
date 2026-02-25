# Login with Google

Supabase Auth supports Sign in with Google for the web, native applications (Android, macOS and iOS), and Chrome extensions.

You can use Sign in with Google in two ways:
1. **By writing application code:** For the web, native applications, or Chrome extensions.
2. **By using Google's pre-built solutions:** Such as personalized sign-in buttons, One Tap, or automatic sign-in.

---

## Prerequisites

Before getting started, you need to:

1. **Prepare a Google Cloud project:** Go to the [Google Cloud Platform](https://console.cloud.google.com/) and create a new project.
2. **Configure the Google Auth Platform:** Register your application and set up:
   - **Audience:** Define which users are allowed to sign in.
   - **Data Access (Scopes):** Define what data your application can access (e.g., profile info).
   - **Branding and Verification:** Add a logo and name to the consent screen. Note: Brand verification may take a few business days.

### Setup Required Scopes
Supabase Auth requires specific scopes to access user profile data. Configure these in the **Data Access (Scopes)** screen:
- `openid` (add manually)
- `.../auth/userinfo.email` (added by default)
- `.../auth/userinfo.profile` (added by default)

*Note: Adding sensitive or restricted scopes may require a lengthy verification process.*

### Setup Consent Screen Branding
It is strongly recommended to use a **custom domain** and verify your brand to increase user trust and prevent phishing.
- **Brand Verification:** Configure your logo and name in the Branding section.
- **Custom Domain:** Use `auth.example.com` instead of the default `<project-id>.supabase.co`.

---

## Project Setup

To support Sign In with Google, you must obtain a **Client ID** and **Client Secret** from the [Google Auth Platform console](https://console.cloud.google.com/apis/credentials).

1. **Create OAuth Client ID:** Choose **Web application** as the application type.
2. **Authorized JavaScript origins:** Add your application's URL (e.g., `https://example.com`). Add `http://localhost:<port>` for local development.
3. **Authorized redirect URIs:** Add your Supabase project's callback URL.
   - Get this from the Google provider page on your Supabase Dashboard.
   - For local development, use: `http://127.0.0.1:54321/auth/v1/callback`.
4. **Configure Supabase Dashboard:** Add the generated Client ID and Client Secret to the Google provider page in your Supabase project settings.

### Local Development
To use Google provider locally, update your `supabase/config.toml`:

```toml
[auth.external.google]
enabled = true
client_id = "<client-id>"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"
skip_nonce_check = false
```

And add the secret to your environment:
```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET="<client-secret>"
```

### Using the Management API
You can configure Google Auth programmatically using the PATCH endpoint:
`PATCH /v1/projects/{ref}/config/auth`

```json
{
  "external_google_enabled": true,
  "external_google_client_id": "your-google-client-id",
  "external_google_secret": "your-google-client-secret"
}
```

---

## Signing Users In

### Application Code (OAuth Flow)
Call the `signInWithOAuth` method to trigger the login flow.

#### Basic Redirect (Implicit Flow)
```javascript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
})
```

#### PKCE Flow (Server-Side Auth)
If you are using Server-Side Rendering (SSR), provide a `redirectTo` URL pointing to a callback route.

**Client Side:**
```javascript
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `http://example.com/auth/callback`,
  },
})
```

**Server Side (Next.js Example):**
Create a file at `app/auth/callback/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  let next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
```

### Saving Google Tokens
If your app needs to access Google APIs on behalf of the user, you must request an offline refresh token.

```javascript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
})
```
Extract the `provider_token` and `provider_refresh_token` from the session data.

---

## Google Pre-built Solutions

You can use Google's personalized buttons or "One Tap" login.

### 1. Load Google Client Library
Include the script in your application:
```html
<script src="https://accounts.google.com/gsi/client" async></script>
```

### 2. HTML Configuration
Configure the button and set `data-use_fedcm_for_prompt="true"` for compatibility with Chrome's third-party-cookie phase-out.

```html
<div
  id="g_id_onload"
  data-client_id="<client ID>"
  data-context="signin"
  data-ux_mode="popup"
  data-callback="handleSignInWithGoogle"
  data-auto_select="true"
  data-use_fedcm_for_prompt="true"
></div>

<div class="g_id_signin" data-type="standard" data-shape="pill"></div>
```

### 3. Handle the Response
Pass the ID token from Google to Supabase:
```javascript
async function handleSignInWithGoogle(response) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: response.credential,
  })
}
```

---

## One-Tap with Next.js

For a seamless "One Tap" experience in Next.js, use the following implementation:

```tsx
'use client'

import Script from 'next/script'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

const OneTapComponent = () => {
  const supabase = createClient()
  const router = useRouter()

  const generateNonce = async () => {
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    const encoder = new TextEncoder()
    const encodedNonce = encoder.encode(nonce)
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedNonce)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    return [nonce, hashedNonce]
  }

  const initializeGoogleOneTap = async () => {
    const [nonce, hashedNonce] = await generateNonce()
    
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      router.push('/')
      return
    }

    /* global google */
    google.accounts.id.initialize({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      callback: async (response: any) => {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.credential,
          nonce,
        })
        if (!error) router.push('/')
      },
      nonce: hashedNonce,
      use_fedcm_for_prompt: true,
    })
    google.accounts.id.prompt()
  }

  return <Script onReady={initializeGoogleOneTap} src="https://accounts.google.com/gsi/client" />
}

export default OneTapComponent
```