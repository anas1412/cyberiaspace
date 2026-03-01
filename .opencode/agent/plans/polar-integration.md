# Polar.sh Integration Plan for International Payments

## 1. Goal
Integrate **Polar.sh** as the primary payment gateway for international users (all countries except Tunisia). Tunisian users will continue to use **Flouci**.

## 2. Dependencies
- Install `@polar-sh/sdk`
- Add environment variables:
  - `POLAR_ACCESS_TOKEN`: Your Polar API key
  - `POLAR_SUCCESS_URL`: The redirect URL after successful checkout
  - `POLAR_PRODUCT_ID_PRO_MONTHLY`: Polar product ID for Pro (Monthly)
  - `POLAR_PRODUCT_ID_PRO_YEARLY`: Polar product ID for Pro (Yearly)

## 3. Backend Changes (`api/pay.ts`)
- **Add Action**: `polar_init`
  - Purpose: Create a Polar.sh checkout session.
  - Logic: Use the user's ID to tag the checkout and redirect to the Polar-provided URL.
- **Add Webhook Handler**: `polar_webhook`
  - Purpose: Listen for `order.created` or `subscription.created` events from Polar.
  - Logic: Update the `users` table in Supabase to set `plan: 'pro'` and `subscription_status: 'active'`.

## 4. Frontend Changes
- **Pricing Logic (`PricingModal.tsx`)**:
  - The modal already detects if the user is in Tunisia using `action=pricing`.
  - If `isLocalPricing` is false, it should call `action=polar_init` instead of `action=init` (Flouci).
- **Redirection**: Handle the redirection to the Polar checkout page and the return to the app.

## 5. Persistence Logic
The `users` table schema in Supabase should already support:
- `plan`: (e.g., 'free', 'pro')
- `subscription_status`: (e.g., 'active', 'none')
- `expiry_date`: For expiring subscriptions (if applicable).

## 6. Verification
- Verify the webhook secret to ensure requests come from Polar.
- Mock the Polar SDK for integration tests.
