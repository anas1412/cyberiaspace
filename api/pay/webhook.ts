import { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import crypto from 'crypto';

const KONNECT_API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.konnect.network/api/v2'
    : 'https://api.sandbox.konnect.network/api/v2';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const paymentRef = req.query.payment_ref as string;
    const signature = req.headers['x-konnect-signature'] as string;
    const apiKey = process.env.KONNECT_API_KEY;

    if (!paymentRef || !signature || !apiKey) {
        return res.status(400).json({ error: 'Missing webhook data' });
    }

    try {
        // 1. Verify Signature
        const expectedSignature = crypto
            .createHmac('sha256', apiKey)
            .update(paymentRef)
            .digest('hex');

        if (expectedSignature !== signature) {
            console.error('Webhook signature mismatch!');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // 2. Fetch Payment Details from Konnect (Source of Truth)
        const response = await fetch(`${KONNECT_API_URL}/payments/${paymentRef}`, {
            headers: { 'x-api-key': apiKey }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to verify payment with Konnect' });
        }

        const { payment } = await response.json();

        if (payment.status === 'completed') {
            // 3. Retrieve User Identity from KV mapping
            const mappingKey = `pay_ref_${paymentRef}`;
            const mapping = await kv.get<{ userId: string; billingCycle: string }>(mappingKey);

            if (mapping) {
                const { userId, billingCycle } = mapping;
                const metaKey = `cyberia_user_meta_${userId}`;

                // 4. Calculate Expiry
                const now = new Date();
                const expiry = new Date();
                if (billingCycle === 'yearly') {
                    expiry.setFullYear(now.getFullYear() + 1);
                } else {
                    expiry.setMonth(now.getMonth() + 1);
                }

                // 5. Update User Status in KV
                await kv.set(metaKey, {
                    plan: 'pro',
                    expiryDate: expiry.toISOString(),
                    updatedAt: now.toISOString()
                });

                // 6. Cleanup Mapping
                await kv.del(mappingKey);

                console.log(`User ${userId} upgraded to Pro until ${expiry.toISOString()}`);
            }
        }

        // Always return 200 to Konnect to stop retries
        return res.status(200).send('OK');

    } catch (error) {
        console.error('Webhook Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
