import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const FLOUCI_API_URL = 'https://developers.flouci.com/api/v2';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    switch (action) {
        case 'pricing':
            return handlePricing(req, res);
        case 'init':
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            return handleInit(req, res);
        case 'webhook':
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            return handleWebhook(req, res);
        case 'verify':
            if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
            return handleVerify(req, res);
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

        const publicKey = process.env.FLOUCI_PUBLIC_KEY;
        const privateKey = process.env.FLOUCI_PRIVATE_KEY;
        const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

        if (!publicKey || !privateKey) {
            console.error('Flouci configuration missing');
            return res.status(500).json({ error: 'Payment system misconfigured' });
        }

        const amountInMillimes = currency === 'TND' ? Math.round(amount * 1000) : Math.round(amount * 100);
        const orderId = `CYBERIA_${userId}_${Date.now()}`;

        const response = await fetch(`${FLOUCI_API_URL}/generate_payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${publicKey}:${privateKey}`
            },
            body: JSON.stringify({
                amount: amountInMillimes,
                success_link: `${appUrl}/pricing?success`,
                fail_link: `${appUrl}/pricing?fail`,
                webhook: `${appUrl}/api/pay?action=webhook`,
                developer_tracking_id: orderId,
                session_timeout_secs: 1200,
                accept_card: true
            })
        });

        const data = await response.json() as any;

        if (!data.result?.success) {
            console.error('Flouci error:', data);
            return res.status(400).json({ error: data.result?.message || 'Failed to initiate payment' });
        }

        const { payment_id, link } = data.result;

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

        return res.status(200).json({ payUrl: link, paymentId: payment_id });

    } catch (error) {
        console.error('Payment Init API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleWebhook(req: VercelRequest, res: VercelResponse) {
    const body = req.body;
    
    if (!body || !body.payment_id) {
        return res.status(400).json({ error: 'Missing webhook data' });
    }

    const { payment_id, status } = body;

    try {
        if (status === 'SUCCESS') {
            const { data: paymentRecord } = await supabase
                .from('payments')
                .select('*')
                .eq('payment_ref', payment_id)
                .maybeSingle();

            if (paymentRecord && paymentRecord.status !== 'completed') {
                const { user_id: userId, metadata } = paymentRecord;
                const billingCycle = metadata?.billingCycle || 'monthly';

                const now = new Date();
                const expiry = new Date();
                if (billingCycle === 'yearly') {
                    expiry.setFullYear(now.getFullYear() + 1);
                } else {
                    expiry.setMonth(now.getMonth() + 1);
                }

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

                await supabase
                    .from('payments')
                    .update({
                        status: 'completed',
                        updated_at: now.toISOString()
                    })
                    .eq('payment_ref', payment_id);
            }
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Webhook Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleVerify(req: VercelRequest, res: VercelResponse) {
    const paymentId = req.query.payment_id as string;

    if (!paymentId) {
        return res.status(400).json({ error: 'Payment ID is required' });
    }

    try {
        const publicKey = process.env.FLOUCI_PUBLIC_KEY;
        const privateKey = process.env.FLOUCI_PRIVATE_KEY;

        if (!publicKey || !privateKey) {
            return res.status(500).json({ error: 'Payment system misconfigured' });
        }

        const response = await fetch(`${FLOUCI_API_URL}/verify_payment/${paymentId}`, {
            headers: {
                'Authorization': `Bearer ${publicKey}:${privateKey}`
            }
        });

        const data = await response.json() as any;

        if (!data.success) {
            return res.status(400).json({ error: data.result?.message || 'Failed to verify payment' });
        }

        const { status } = data.result;

        if (status === 'SUCCESS') {
            const { data: paymentRecord } = await supabase
                .from('payments')
                .select('*')
                .eq('payment_ref', paymentId)
                .maybeSingle();

            if (paymentRecord && paymentRecord.status !== 'completed') {
                const { user_id: userId, metadata } = paymentRecord;
                const billingCycle = metadata?.billingCycle || 'monthly';

                const now = new Date();
                const expiry = new Date();
                if (billingCycle === 'yearly') {
                    expiry.setFullYear(now.getFullYear() + 1);
                } else {
                    expiry.setMonth(now.getMonth() + 1);
                }

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
                    console.log(`User ${userId} upgraded to Pro via verify until ${expiry.toISOString()}`);
                }

                await supabase
                    .from('payments')
                    .update({
                        status: 'completed',
                        updated_at: now.toISOString()
                    })
                    .eq('payment_ref', paymentId);

                return res.status(200).json({
                    success: true,
                    status,
                    message: 'Payment successful! You are now a Pro member.'
                });
            }

            if (paymentRecord?.status === 'completed') {
                return res.status(200).json({
                    success: true,
                    status,
                    message: 'Payment already processed.'
                });
            }
        }

        return res.status(200).json({
            success: true,
            status,
            message: status === 'PENDING' ? 'Payment is pending. Please complete payment.' : 'Payment failed.'
        });

    } catch (error) {
        console.error('Verify Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
