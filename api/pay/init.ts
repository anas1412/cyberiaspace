import { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const KONNECT_API_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.sandbox.konnect.network/api/v2'
    // ? 'https://api.konnect.network/api/v2'
    : 'https://api.sandbox.konnect.network/api/v2';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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
        // 1. Verify User via Google Token
        const tokenInfo = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
        if (!tokenInfo.ok) {
            return res.status(401).json({ error: 'Invalid Google token' });
        }
        const info = await tokenInfo.json();
        const userId = info.sub || info.user_id;

        if (!userId) {
            return res.status(401).json({ error: 'User identity not found' });
        }

        // 2. Call Konnect API to init payment
        const apiKey = process.env.KONNECT_API_KEY;
        const walletId = process.env.KONNECT_RECEIVER_WALLET_ID;
        const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

        if (!apiKey || !walletId) {
            console.error('Konnect configuration missing');
            return res.status(500).json({ error: 'Payment system misconfigured' });
        }

        // Amount conversion: TND -> millimes (x1000)
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
                webhook: `${appUrl}/api/pay/webhook`,
                firstName: info.given_name || '',
                lastName: info.family_name || '',
                email: info.email || '',
                theme: 'dark'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Konnect Init Error:', errorData);
            return res.status(response.status).json({ error: 'Failed to initiate payment', details: errorData });
        }

        const { payUrl, paymentRef } = await response.json();

        // 3. Store paymentRef -> userId mapping temporarily in KV
        // Set expiry to 1 hour (payment link lifecycle)
        await kv.set(`pay_ref_${paymentRef}`, { userId, billingCycle }, { ex: 3600 });

        return res.status(200).json({ payUrl });

    } catch (error) {
        console.error('Payment Init API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
