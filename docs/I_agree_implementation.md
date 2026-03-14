# "I Agree" Consent Checkbox — Full Implementation Plan

## Overview

Require users to accept **Terms of Service** and **Privacy Policy** before initiating checkout. Consent metadata (version, timestamp, IP, user agent) is persisted in the `payments` table for legal compliance and dispute protection.

**Affected Files:**
- `supabase/schema.sql` — Schema source of truth
- `api/pay.ts` — Backend payment handlers
- `src/components/PricingModal.tsx` — Frontend checkout UI

---

## Phase 1: Database Migration

### Goal
Add consent-tracking columns to the existing `payments` table.

### Columns to Add

| Column              | Type                        | Nullable | Purpose                                       |
|---------------------|-----------------------------|----------|-----------------------------------------------|
| `terms_version`     | `TEXT`                      | Yes      | Version of ToS accepted (e.g. `"v1"`)        |
| `privacy_version`   | `TEXT`                      | Yes      | Version of Privacy Policy accepted            |
| `terms_accepted_at` | `TIMESTAMP WITH TIME ZONE`  | Yes      | Exact timestamp user checked the box          |
| `consent_ip`        | `TEXT`                      | Yes      | IP address at consent time (dispute evidence) |
| `consent_user_agent`| `TEXT`                      | Yes      | Browser/device info at consent time           |

### SQL Migration

```sql
ALTER TABLE payments ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS privacy_version TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS consent_ip TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS consent_user_agent TEXT;
```

### Update Schema Source of Truth

In `supabase/schema.sql`, update the `payments` table definition to include the new columns so the schema file remains the single source of truth:

```sql
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_ref TEXT UNIQUE NOT NULL,
    amount INT NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    terms_version TEXT,
    privacy_version TEXT,
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    consent_ip TEXT,
    consent_user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Phase 2: Frontend — Consent Checkbox UI

### File: `src/components/PricingModal.tsx`

### Step 2.1 — Add State

Add a new state variable at the top of the component, alongside the existing state declarations (around line 24):

```tsx
const [acceptedTerms, setAcceptedTerms] = useState(false);
```

### Step 2.2 — Reset on Close/Reopen

Inside the existing `useEffect` that runs when `isOpen` changes (the one starting at line 30), add a reset so the checkbox is never pre-checked when re-opening:

```tsx
useEffect(() => {
  if (isOpen) {
    setAcceptedTerms(false);  // <-- Add this line
    // ... rest of existing pricing fetch logic
  }
}, [isOpen, user?.plan, user?.paymentProvider]);
```

### Step 2.3 — Add Checkbox UI

Insert the checkbox directly **above** the "Upgrade Now" button (currently at line 466). Place it between the `</AnimatePresence>` closing tag (line 464) and the `<button>` that triggers `handleUpgrade`:

```tsx
{/* Terms Consent Checkbox */}
<label className="flex items-start gap-3 mb-6 cursor-pointer group select-none">
  <div className="relative mt-0.5">
    <input
      type="checkbox"
      checked={acceptedTerms}
      onChange={(e) => setAcceptedTerms(e.target.checked)}
      className="sr-only peer"
    />
    <div className={cn(
      "w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center",
      acceptedTerms
        ? "bg-blue-600 border-blue-500"
        : "bg-white/5 border-white/20 group-hover:border-white/40"
    )}>
      {acceptedTerms && <Check className="w-3 h-3 text-white" />}
    </div>
  </div>
  <span className="text-xs text-slate-400 leading-relaxed">
    I agree to the{' '}
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open('/terms', '_blank');
      }}
      className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
    >
      Terms of Service
    </button>
    {' '}and{' '}
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open('/privacy', '_blank');
      }}
      className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
    >
      Privacy Policy
    </button>
  </span>
</label>
```

**Notes:**
- The `Check` icon is already imported from `lucide-react` in the file.
- Links open in a new tab (`_blank`) so the user doesn't lose their checkout progress.
- The checkbox uses a custom styled `<div>` with a hidden `<input>` for accessibility (screen readers still see a real checkbox via `sr-only`).

### Step 2.4 — Disable Button Until Checked

Modify the "Upgrade Now" button's `disabled` prop (line 468) to also require terms acceptance:

**Before:**
```tsx
disabled={isLoading}
```

**After:**
```tsx
disabled={isLoading || !acceptedTerms}
```

The existing className ternary already handles the `disabled` attribute styling (gray when disabled, gradient when enabled), so no CSS changes are needed.

### Step 2.5 — Send Consent Data in API Request

Modify the `handleUpgrade` function's `fetch` body (line 190–194) to include consent fields:

**Before:**
```tsx
body: JSON.stringify({
  amount: location?.currency === 'DT' ? currentPrice.tnd : currentPrice.usd,
  currency: location?.currency === 'DT' ? 'TND' : 'USD',
  billingCycle
})
```

**After:**
```tsx
body: JSON.stringify({
  amount: location?.currency === 'DT' ? currentPrice.tnd : currentPrice.usd,
  currency: location?.currency === 'DT' ? 'TND' : 'USD',
  billingCycle,
  termsAccepted: true,
  termsVersion: 'v1',
  privacyVersion: 'v1'
})
```

**Why hardcode `'v1'`?** The version is a contract between you and the user. When you update your legal documents, you bump the version string in one place. The frontend always sends the *current* version at the time of checkout.

---

## Phase 3: Backend — Record Consent

### File: `api/pay.ts`

### Step 3.1 — Validate Consent on Both Handlers

Add a server-side guard at the top of **both** `handleInit` (Flouci) and `handlePolarInit` (Polar) to reject requests that don't include consent. This prevents bypassing the checkbox via direct API calls.

#### In `handleInit` (Flouci) — after line 120 (`const body = req.body || {};`)

**Before:**
```ts
const { amount, currency = 'TND', billingCycle = 'monthly' } = body;
```

**After:**
```ts
const { amount, currency = 'TND', billingCycle = 'monthly', termsAccepted, termsVersion, privacyVersion } = body;

if (!termsAccepted || !termsVersion || !privacyVersion) {
    return res.status(400).json({ error: 'You must accept the Terms of Service and Privacy Policy' });
}
```

#### In `handlePolarInit` (Polar) — after line 354 (`const body = req.body || {};`)

**Before:**
```ts
const { billingCycle = 'monthly' } = body;
```

**After:**
```ts
const { billingCycle = 'monthly', termsAccepted, termsVersion, privacyVersion } = body;

if (!termsAccepted || !termsVersion || !privacyVersion) {
    return res.status(400).json({ error: 'You must accept the Terms of Service and Privacy Policy' });
}
```

### Step 3.2 — Extract Security Metadata

In **both** handlers, extract IP and User Agent from the request headers. Add this right after the validation above:

```ts
const consentIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.headers['x-real-ip'] as string
    || 'unknown';
const consentUserAgent = req.headers['user-agent'] || 'unknown';
const termsAcceptedAt = new Date().toISOString();
```

**Why `.split(',')[0]`?** The `x-forwarded-for` header can contain a chain of proxy IPs (e.g. `"203.0.113.50, 70.41.3.18"`). The first value is the original client IP.

### Step 3.3 — Flouci: Update the Payment Insert (`handleInit`)

In `handleInit`, update the existing `supabase.from('payments').insert(...)` call (line 183–195) to include consent fields:

**Before:**
```ts
await supabase.from('payments').insert({
    payment_ref: payment_id,
    user_id: userId,
    amount: amountInMillimes,
    currency: currency,
    status: 'pending',
    metadata: {
        billingCycle,
        orderId,
        amount: amount,
        currency
    }
});
```

**After:**
```ts
await supabase.from('payments').insert({
    payment_ref: payment_id,
    user_id: userId,
    amount: amountInMillimes,
    currency: currency,
    status: 'pending',
    terms_version: termsVersion,
    privacy_version: privacyVersion,
    terms_accepted_at: termsAcceptedAt,
    consent_ip: consentIp,
    consent_user_agent: consentUserAgent,
    metadata: {
        billingCycle,
        orderId,
        amount: amount,
        currency
    }
});
```

This is straightforward because `handleInit` already creates a pending payment record before redirecting.

### Step 3.4 — Polar: Pass Consent via Checkout Metadata (`handlePolarInit`)

The Polar flow is different: `handlePolarInit` does **not** create a payment record upfront. It redirects the user to Polar's hosted checkout, and the payment record is only created later when the `handlePolarWebhook` fires (line 566–581).

**Strategy:** Embed the consent data into Polar's checkout `metadata` object. When the webhook fires, extract it and persist it.

Update the `polar.checkouts.create()` call (line 392–396):

**Before:**
```ts
const checkout = await polar.checkouts.create({
    products: [productId],
    successUrl: successUrl,
    metadata: { userId }
});
```

**After:**
```ts
const checkout = await polar.checkouts.create({
    products: [productId],
    successUrl: successUrl,
    metadata: {
        userId,
        termsVersion,
        privacyVersion,
        termsAcceptedAt,
        consentIp,
        consentUserAgent
    }
});
```

### Step 3.5 — Polar Webhook: Extract and Persist Consent (`handlePolarWebhook`)

Inside the `processWebhook` function in `handlePolarWebhook`, the code already creates a payment record at line 566–581. Update that insert to pull consent fields from the webhook metadata.

The metadata is already accessible via `data.metadata` (the same object we passed in Step 3.4). Update the insert block:

**Before:**
```ts
if (!existingPayment) {
    console.log(`[Polar Webhook] [${eventType}] Inserting new payment record for ${paymentRef}`);
    await supabase.from('payments').insert({
        payment_ref: paymentRef,
        user_id: userId,
        amount: data.amount || 0,
        currency: data.currency || 'USD',
        status: 'completed',
        metadata: {
            productId,
            billingCycle,
            provider: 'polar',
            eventType: eventType
        }
    });
}
```

**After:**
```ts
if (!existingPayment) {
    console.log(`[Polar Webhook] [${eventType}] Inserting new payment record for ${paymentRef}`);

    const consentMeta = data.metadata || {};

    await supabase.from('payments').insert({
        payment_ref: paymentRef,
        user_id: userId,
        amount: data.amount || 0,
        currency: data.currency || 'USD',
        status: 'completed',
        terms_version: consentMeta.termsVersion || null,
        privacy_version: consentMeta.privacyVersion || null,
        terms_accepted_at: consentMeta.termsAcceptedAt || null,
        consent_ip: consentMeta.consentIp || null,
        consent_user_agent: consentMeta.consentUserAgent || null,
        metadata: {
            productId,
            billingCycle,
            provider: 'polar',
            eventType: eventType
        }
    });
}
```

---

## Phase 4: Terms Versioning Strategy

### Current Versions
```
TERMS_VERSION   = "v1"
PRIVACY_VERSION = "v1"
```

### Where to Define

Hardcode `'v1'` directly in the `handleUpgrade` body in `PricingModal.tsx` (frontend) and validate against them in `api/pay.ts` (backend). Both places use `'v1'`.

When legal documents change in the future:
1. Update the legal page content at `/terms` and/or `/privacy`.
2. Bump the version string to `'v2'` in the frontend payload.
3. All new payments from that point forward will record `'v2'`.
4. Historical payment records retain their original version, creating a full audit trail.

### Optional Future Enhancement: Re-consent on Renewal

If you want to force existing users to re-accept updated terms before their next manual renewal (Flouci), you could:
1. Store the latest accepted version on the `users` table (e.g. `accepted_terms_version TEXT`).
2. On the frontend, compare the user's stored version against the current version.
3. If mismatched, show the consent checkbox again even for returning Pro users.

This is **not required for the initial implementation** — it's an enhancement for later.

---

## Phase 5: Verification Checklist

After implementation, verify each item:

- [ ] **Checkbox renders unchecked** — Every time the modal opens, the checkbox starts unchecked.
- [ ] **Button is disabled** — The "Upgrade Now" button is grayed out and unclickable when the checkbox is unchecked.
- [ ] **Button enables on check** — Checking the box immediately enables the button.
- [ ] **Links open in new tab** — "Terms of Service" and "Privacy Policy" links open in `_blank` without disrupting checkout.
- [ ] **Flouci flow records consent** — After a Flouci payment, query the database and confirm all 5 consent fields are populated.
- [ ] **Polar flow records consent** — After a Polar payment (triggered by webhook), run the same query and confirm consent fields are populated.
- [ ] **Backend rejects missing consent** — Send a POST to `/api/pay?action=init` without `termsAccepted` and confirm a `400` error is returned.
- [ ] **Schema file updated** — `supabase/schema.sql` matches the live database.

**Verification Query:**
```sql
SELECT payment_ref, terms_version, privacy_version, terms_accepted_at, consent_ip, consent_user_agent
FROM payments
ORDER BY created_at DESC
LIMIT 1;
```

---

## Summary of Changes by File

| File | Change |
|------|--------|
| **Supabase DB** | Run `ALTER TABLE` migration to add 5 consent columns |
| **`supabase/schema.sql`** | Update `payments` table definition to include new columns |
| **`src/components/PricingModal.tsx`** | Add `acceptedTerms` state, checkbox UI above button, disable button until checked, send consent fields in API body |
| **`api/pay.ts` > `handleInit`** | Validate consent fields, extract IP/UA, include in payment insert |
| **`api/pay.ts` > `handlePolarInit`** | Validate consent fields, extract IP/UA, pass via Polar checkout metadata |
| **`api/pay.ts` > `handlePolarWebhook`** | Extract consent fields from webhook metadata, include in payment insert |

---

## Implementation Order

1. **Phase 1** — Run the database migration first (no app impact, additive only).
2. **Phase 2** — Deploy frontend changes (checkbox + payload). The backend will ignore the extra fields until Phase 3 is deployed, so this is safe to deploy independently.
3. **Phase 3** — Deploy backend changes (validation + persistence). Once live, consent is fully enforced end-to-end.
4. **Phase 4** — Document the versioning convention for future legal updates.
5. **Phase 5** — Run through the verification checklist.
