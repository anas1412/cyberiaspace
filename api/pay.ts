import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import crypto from 'crypto';

import { hydrateProfile } from './profile-helper.js';

const KONNECT_API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.konnect.network/api/v2'
    : 'https://api.sandbox.konnect.network/api/v2';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    switch (action) {
        case 'pricing':
            return handlePricing(req, res);
        case 'init':
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            return handleInit(req, res);
        case 'webhook':
            if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
            return handleWebhook(req, res);
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}

async function handlePricing(req: VercelRequest, res: VercelResponse) {
    const forceCountry = req.query.country as string;
    const country = forceCountry || (req.headers['x-vercel-ip-country'] as string) || 'US';
    const isTunisia = country.toUpperCase() === 'TN';

    return res.status(200).json({
        country,
        currency: isTunisia ? 'DT' : 'USD',
        isLocalPricing: isTunisia
    });
}

async function handleInit(req: VercelRequest, res: VercelResponse) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const { amount, currency = 'TND', billingCycle = 'monthly' } = req.body;

    if (!amount) {
        return res.status(400).json({ error: 'Amount is required' });
    }

    try {
        const tokenInfo = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
        if (!tokenInfo.ok) {
            return res.status(401).json({ error: 'Invalid Google token' });
        }
        const info = await tokenInfo.json() as any;
        const userId = info.sub || info.user_id;

        if (!userId) {
            return res.status(401).json({ error: 'User identity not found' });
        }

        const apiKey = process.env.KONNECT_API_KEY;
        const walletId = process.env.KONNECT_RECEIVER_WALLET_ID;
        const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

        if (!apiKey || !walletId) {
            console.error('Konnect configuration missing');
            return res.status(500).json({ error: 'Payment system misconfigured' });
        }

        const subunitAmount = currency === 'TND' ? Math.round(amount * 1000) : Math.round(amount * 100);

        const response = await fetch(`${KONNECT_API_URL}/payments/init-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            body: JSON.stringify({
                receiverWalletId: walletId,
                token: currency,
                amount: subunitAmount,
                type: 'immediate',
                description: `Cyberia Pro - ${billingCycle} subscription`,
                orderId: `PRO_${userId}_${Date.now()}`,
                webhook: `${appUrl}/api/pay?action=webhook`,
                firstName: info.given_name || '',
                lastName: info.family_name || '',
                email: info.email || '',
                theme: 'dark'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json({ error: 'Failed to initiate payment', details: errorData });
        }

        const { payUrl, paymentRef } = await response.json() as any;

        // Best Practice: Store expected amount and currency to verify in webhook
        await kv.set(`pay_ref_${paymentRef}`, {
            userId,
            billingCycle,
            expectedAmount: subunitAmount,
            expectedToken: currency
        }, { ex: 3600 });

        return res.status(200).json({ payUrl });

    } catch (error) {
        console.error('Payment Init API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleWebhook(req: VercelRequest, res: VercelResponse) {
    const paymentRef = req.query.payment_ref as string;
    const signature = req.headers['x-konnect-signature'] as string;
    const apiKey = process.env.KONNECT_API_KEY;

    if (!paymentRef || !signature || !apiKey) {
        return res.status(400).json({ error: 'Missing webhook data' });
    }

    try {
        const expectedSignature = crypto
            .createHmac('sha256', apiKey)
            .update(paymentRef)
            .digest('hex');

        if (expectedSignature !== signature) {
            console.error('Webhook signature mismatch!');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const response = await fetch(`${KONNECT_API_URL}/payments/${paymentRef}`, {
            headers: { 'x-api-key': apiKey }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to verify payment with Konnect' });
        }

        const { payment } = await response.json() as any;

        if (payment.status === 'completed') {
            const mappingKey = `pay_ref_${paymentRef}`;
            const mapping = await kv.get<{
                userId: string;
                billingCycle: string;
                expectedAmount: number;
                expectedToken: string;
            }>(mappingKey);

            if (mapping) {
                // Best Practice: Verify amount and token
                if (payment.amount !== mapping.expectedAmount || payment.token !== mapping.expectedToken) {
                    console.error('Payment validation failed: Amount/Token mismatch');
                    return res.status(400).json({ error: 'Payment validation failed' });
                }

                const { userId, billingCycle } = mapping;
                const profileKey = `user:profile:${userId}`;
                const existingProfile = await kv.get<any>(profileKey) || {};

                const now = new Date();
                const expiry = new Date();
                if (billingCycle === 'yearly') {
                    expiry.setFullYear(now.getFullYear() + 1);
                } else {
                    expiry.setMonth(now.getMonth() + 1);
                }

                const updatedProfile = hydrateProfile({
                    ...existingProfile,
                    plan: 'pro',
                    subscriptionStatus: 'active',
                    expiryDate: expiry.toISOString(),
                    updatedAt: now.toISOString()
                });

                await kv.set(profileKey, updatedProfile);

                await kv.del(mappingKey);
                console.log(`User ${userId} upgraded to Pro until ${expiry.toISOString()}`);
            }
        }

        return res.status(200).send('OK');

    } catch (error) {
        console.error('Webhook Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
