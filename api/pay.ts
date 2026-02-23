import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

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

        // Store payment reference in Supabase
        await supabase.from('payments').insert({
            payment_ref: paymentRef,
            user_id: userId,
            amount: subunitAmount,
            currency: currency,
            status: 'pending',
            metadata: {
                billingCycle,
                expectedToken: currency
            }
        });

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
            // Get payment record from Supabase
            const { data: paymentRecord } = await supabase
                .from('payments')
                .select('*')
                .eq('payment_ref', paymentRef)
                .maybeSingle();

            if (paymentRecord) {
                const { user_id: userId, metadata } = paymentRecord;
                const billingCycle = metadata?.billingCycle || 'monthly';

                // Verify amount and token
                if (payment.amount !== paymentRecord.amount || payment.token !== paymentRecord.currency) {
                    console.error('Payment validation failed: Amount/Token mismatch');
                    return res.status(400).json({ error: 'Payment validation failed' });
                }

                // Calculate expiry date
                const now = new Date();
                const expiry = new Date();
                if (billingCycle === 'yearly') {
                    expiry.setFullYear(now.getFullYear() + 1);
                } else {
                    expiry.setMonth(now.getMonth() + 1);
                }

                // Update user to pro
                const { error: updateError } = await supabase
                    .from('users')
                    .update({
                        plan: 'pro',
                        subscription_status: 'active',
                        expiry_date: expiry.toISOString(),
                        updated_at: now.toISOString()
                    })
                    .eq('id', userId);

                if (updateError) {
                    console.error('Failed to update user:', updateError);
                } else {
                    console.log(`User ${userId} upgraded to Pro until ${expiry.toISOString()}`);
                }

                // Update payment status
                await supabase
                    .from('payments')
                    .update({
                        status: 'completed',
                        updated_at: now.toISOString()
                    })
                    .eq('payment_ref', paymentRef);
            }
        }

        return res.status(200).send('OK');

    } catch (error) {
        console.error('Webhook Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
