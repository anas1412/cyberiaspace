import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buffer } from 'node:stream/consumers';
import { createClient } from '@supabase/supabase-js';
import { Polar } from "@polar-sh/sdk";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const FLOUCI_API_URL = 'https://developers.flouci.com/api/v2';


export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    let rawBodyStr = '';
    if (req.method === 'POST') {
        const rawBody = await buffer(req);
        rawBodyStr = rawBody.toString();
        
        if (action !== 'polar_webhook') {
            const contentType = req.headers['content-type'] || '';
            if (contentType.includes('application/json') && rawBodyStr.trim()) {
                try {
                    req.body = JSON.parse(rawBodyStr);
                } catch (err) {
                    console.error('Failed to parse JSON body:', err, 'Body snippet:', rawBodyStr.substring(0, 100));
                    return res.status(400).json({ error: 'Invalid JSON body' });
                }
            } else {
                // If not JSON or empty, initialize as empty object or handle accordingly
                req.body = {};
            }
        }
    }

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
        case 'polar_init':
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            return handlePolarInit(req, res);
        case 'polar_webhook':
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            return handlePolarWebhook(req, res, rawBodyStr);
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}


async function handlePricing(req: VercelRequest, res: VercelResponse) {
    const forceCountry = req.query.country as string;
    const country = forceCountry || (req.headers['x-vercel-ip-country'] as string) || 'US';
    let isLocalPricing = country.toUpperCase() === 'TN';

    if (process.env.ENABLE_LOCAL_PRICING === 'false') {
        isLocalPricing = false;
    }

    const polarMonthly = process.env.POLAR_PRODUCT_ID_PRO_MONTHLY;
    const polarYearly = process.env.POLAR_PRODUCT_ID_PRO_YEARLY;

    if (!polarMonthly || !polarYearly) {
        console.warn('[Pricing] Polar product IDs are not fully configured in environment variables');
    }

    return res.status(200).json({
        country,
        currency: isLocalPricing ? 'DT' : 'USD',
        isLocalPricing: isLocalPricing,
        polar: {
            monthlyProductId: polarMonthly || null,
            yearlyProductId: polarYearly || null,
        }
    });
}


async function handleInit(req: VercelRequest, res: VercelResponse) {
    console.log('[Flouci Init] Request received');
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const body = req.body || {};
    const { amount, currency = 'TND', billingCycle = 'monthly' } = body;

    if (!amount) {
        return res.status(400).json({ error: 'Amount is required' });
    }

    try {
        console.log('[Flouci Init] Verifying Google token...');
        const tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
        if (!tokenInfoRes.ok) {
            const errText = await tokenInfoRes.text();
            console.error('[Flouci Init] Google token verification failed:', errText);
            return res.status(401).json({ error: 'Invalid Google token' });
        }
        const info = await tokenInfoRes.json() as any;
        const userId = info.sub || info.user_id;

        if (!userId) {
            return res.status(401).json({ error: 'User identity not found in token' });
        }

        console.log('[Flouci Init] User ID:', userId, 'Amount:', amount, 'Currency:', currency);

        const publicKey = process.env.FLOUCI_PUBLIC_KEY;
        const privateKey = process.env.FLOUCI_PRIVATE_KEY;
        const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

        if (!publicKey || !privateKey) {
            console.error('[Flouci Init] Configuration missing (PUBLIC/PRIVATE KEY)');
            return res.status(500).json({ error: 'Payment system misconfigured' });
        }

        const amountInMillimes = currency === 'TND' ? Math.round(amount * 1000) : Math.round(amount * 100);
        const orderId = `CYBERIA_${userId}_${Date.now()}`;

        console.log('[Flouci Init] Generating payment for order:', orderId);
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
            console.error('[Flouci Init] API error:', data);
            return res.status(400).json({ error: data.result?.message || 'Failed to initiate payment' });
        }

        const { payment_id, link } = data.result;
        console.log('[Flouci Init] Payment generated:', payment_id);

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

    } catch (error: any) {
        console.error('[Flouci Init] Critical Error:', error.message, error.stack);
        return res.status(500).json({ error: 'Internal server error during payment initialization' });
    }
}

async function handleWebhook(req: VercelRequest, res: VercelResponse) {
    const body = req.body;
    
    if (!body || !body.payment_id) {
        return res.status(400).json({ error: 'Missing webhook data' });
    }

    const { payment_id } = body;

    try {
        const publicKey = process.env.FLOUCI_PUBLIC_KEY;
        const privateKey = process.env.FLOUCI_PRIVATE_KEY;

        if (!publicKey || !privateKey) {
            console.error('[Flouci Webhook] Config missing');
            return res.status(500).json({ error: 'Payment system misconfigured' });
        }

        // Server-to-server verification call
        const response = await fetch(`${FLOUCI_API_URL}/verify_payment/${payment_id}`, {
            headers: {
                'Authorization': `Bearer ${publicKey}:${privateKey}`
            }
        });

        const data = await response.json() as any;
        if (data.success && data.result?.status === 'SUCCESS') {
            const { data: paymentRecord } = await supabase
                .from('payments')
                .select('*')
                .eq('payment_ref', payment_id)
                .maybeSingle();

            if (paymentRecord && paymentRecord.status !== 'completed') {
                const billingCycle = paymentRecord.metadata?.billingCycle || 'monthly';
                await updateUserPlan(paymentRecord.user_id, billingCycle, payment_id, 'flouci_webhook');
            }
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Flouci Webhook Error:', error);
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
                const billingCycle = paymentRecord.metadata?.billingCycle || 'monthly';
                await updateUserPlan(paymentRecord.user_id, billingCycle, paymentId, 'flouci_verify');

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


function getPolarClient(res: VercelResponse) {
    const accessToken = process.env.POLAR_ACCESS_TOKEN;
    if (!accessToken) {
        console.error('[Polar] Missing POLAR_ACCESS_TOKEN');
        res.status(500).json({ error: 'Polar access token not configured' });
        return null;
    }

    const prefix = accessToken.substring(0, 10);
    console.log(`[Polar] Token prefix: ${prefix}...`);
    
    const server = (process.env.POLAR_SERVER as 'sandbox' | 'production') || 'sandbox';
    console.log(`[Polar] Mode: ${server}`);

    return new Polar({
        accessToken,
        server,
    });
}

async function handlePolarInit(req: VercelRequest, res: VercelResponse) {
    console.log('[Polar Init] Request received');
    const polar = getPolarClient(res);
    if (!polar) return; // Response sent in helper

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const body = req.body || {};
    const { billingCycle = 'monthly' } = body;

    try {
        console.log('[Polar Init] Verifying Google token...');
        const tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
        if (!tokenInfoRes.ok) {
            const errText = await tokenInfoRes.text();
            console.error('[Polar Init] Google token verification failed:', errText);
            return res.status(401).json({ error: 'Invalid Google token' });
        }
        const info = await tokenInfoRes.json() as any;
        const userId = info.sub || info.user_id;

        if (!userId) {
            return res.status(401).json({ error: 'User identity not found in token' });
        }

        console.log('[Polar Init] User ID:', userId, 'Billing Cycle:', billingCycle);

        const productId = billingCycle === 'yearly'
            ? process.env.POLAR_PRODUCT_ID_PRO_YEARLY
            : process.env.POLAR_PRODUCT_ID_PRO_MONTHLY;

        if (!productId) {
            console.error('[Polar Init] Missing Product ID for cycle:', billingCycle);
            return res.status(500).json({ error: `Polar product ID not configured for ${billingCycle}` });
        }

        console.log(`[Polar Init] Using product ID: ${productId}`);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(productId)) {
            console.warn(`[Polar Init] Product ID ${productId} does not match expected UUID format (8-4-4-4-12)`);
        }

        console.log('[Polar Init] Creating checkout for product:', productId);
        
        const successUrl = process.env.POLAR_SUCCESS_URL || `https://${req.headers.host}/pricing?success=true`;

        const checkout = await polar.checkouts.create({
            products: [productId],
            successUrl: successUrl,
            metadata: { userId }
        });

        console.log('[Polar Init] Checkout created:', checkout.url);
        return res.status(200).json({ payUrl: checkout.url });

    } catch (error: any) {
        console.error('[Polar Init] Critical Error:', error.message, error.stack);
        return res.status(500).json({ error: 'Internal server error during payment initialization' });
    }
}

async function handlePolarWebhook(req: VercelRequest, res: VercelResponse, rawBody: string) {
    const polar = getPolarClient(res);
    if (!polar) return;

    const signature = req.headers['webhook-signature'] as string;
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET || '';

    if (!signature) {
        return res.status(401).json({ error: 'Missing signature' });
    }

    try {
        const event = validateEvent(rawBody, req.headers as Record<string, string>, webhookSecret);

        if (event.type === 'order.created' || event.type === 'subscription.created') {
            const data = event.data as any;
            const userId = data.metadata?.userId;

            if (!userId) {
                console.error('No userId in Polar webhook metadata');
                return res.status(200).json({ received: true });
            }

            const productId = data.productId;
            const isYearly = productId === process.env.POLAR_PRODUCT_ID_PRO_YEARLY;
            const billingCycle = isYearly ? 'yearly' : 'monthly';

            const additionalData: any = {
                polar_customer_id: data.customerId
            };
            if (event.type === 'subscription.created') {
                additionalData.polar_subscription_id = data.id;
            }

            await updateUserPlan(userId, billingCycle, undefined, 'polar_webhook', additionalData);
        }

        return res.status(200).json({ received: true });

    } catch (error) {
        if (error instanceof WebhookVerificationError) {
            return res.status(401).json({ error: 'Invalid signature' });
        }
        console.error('Polar Webhook Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function updateUserPlan(
    userId: string,
    billingCycle: 'monthly' | 'yearly',
    paymentRef?: string,
    provider?: string,
    additionalData: any = {}
) {
    const now = new Date();
    const expiry = new Date();
    if (billingCycle === 'yearly') {
        expiry.setFullYear(now.getFullYear() + 1);
    } else {
        expiry.setMonth(now.getMonth() + 1);
    }

    console.log(`[updateUserPlan] Upgrading user ${userId} (${billingCycle}) via ${provider}. Expiry: ${expiry.toISOString()}`);

    const { error: userError } = await supabase
        .from('users')
        .update({
            plan: 'pro',
            subscription_status: 'active',
            expiry_date: expiry.toISOString(),
            updated_at: now.toISOString(),
            ...additionalData
        })
        .eq('id', userId);

    if (userError) {
        console.error(`[updateUserPlan] Error updating user ${userId}:`, userError);
        throw userError;
    }

    if (paymentRef) {
        const { error: paymentError } = await supabase
            .from('payments')
            .update({
                status: 'completed',
                updated_at: now.toISOString()
            })
            .eq('payment_ref', paymentRef);

        if (paymentError) {
            console.error(`[updateUserPlan] Error updating payment record ${paymentRef}:`, paymentError);
        }
    }

    return { success: true, expiry };
}

