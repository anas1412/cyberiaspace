import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buffer } from 'node:stream/consumers';
import { createClient } from '@supabase/supabase-js';
import { Polar } from "@polar-sh/sdk";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { OAuth2Client } from 'google-auth-library';

const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
// Use service_role key for backend operations to bypass RLS.
// If you haven't already, set SUPABASE_SERVICE_ROLE_KEY in your environment.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;


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
    console.log('[Pay Handler] Incoming request:', req.method, 'Action:', action);

    let rawBodyStr = '';
    if (req.method === 'POST') {
        const contentType = req.headers['content-type'] || '';
        console.log('[Pay Handler] Content-Type:', contentType);

        // If body is already parsed (sometimes happens in local dev or specific runtimes)
        if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
            console.log('[Pay Handler] Body already present in request object');
            if (action === 'polar_webhook') {
                // Warning: Re-stringifying might break signature verification if ordering/spacing differs.
                // However, we should try to capture it if the stream is already gone.
                rawBodyStr = JSON.stringify(req.body);
            }
        } else {
            try {
                const rawBody = await buffer(req);
                rawBodyStr = rawBody.toString();
                console.log('[Pay Handler] Read raw body. Length:', rawBodyStr.length);
                
                if (contentType.includes('application/json') && rawBodyStr.trim()) {
                    try {
                        req.body = JSON.parse(rawBodyStr);
                        console.log('[Pay Handler] Parsed body keys:', Object.keys(req.body));
                    } catch (err) {
                        console.error('[Pay Handler] JSON parse error:', err);
                        return res.status(400).json({ error: 'Invalid JSON body' });
                    }
                }
            } catch (err) {
                console.error('[Pay Handler] Failed to read request buffer:', err);
                // Don't fail immediately, try to proceed if body might be in req.body anyway
            }
        }

        // Final safety check for JSON actions
        if (!req.body) req.body = {};
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
        case 'polar_portal':
            if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
            return handlePolarPortal(req, res);
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}


async function getUserIdFromToken(authHeader: string | undefined) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    
    try {
        // Try verifying as ID Token first (more secure if frontend starts sending it)
        if (CLIENT_ID) {
            try {
                const client = new OAuth2Client(CLIENT_ID);
                const ticket = await client.verifyIdToken({
                    idToken: token,
                    audience: CLIENT_ID,
                });
                const payload = ticket.getPayload();
                if (payload?.sub) return payload.sub;
            } catch (e) {
                // Not a valid ID token, fallback to access token check
            }
        }

        // Fallback to Access Token verification via tokeninfo
        const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
        if (!res.ok) {
            console.error('[Token Verification] Google tokeninfo returned error:', res.status, await res.text());
            return null;
        }
        const data = await res.json() as any;
        return data.sub || data.user_id;
    } catch (e) {
        console.error('[Token Verification] Critical error:', e);
        return null;
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
    const userId = await getUserIdFromToken(req.headers.authorization);
    if (!userId) {
        return res.status(401).json({ error: 'Invalid or expired Google token' });
    }

    const body = req.body || {};
    const { amount, currency = 'TND', billingCycle = 'monthly', termsAccepted, termsVersion, privacyVersion } = body;
    console.log('[Flouci Init] Consent check:', { termsAccepted, termsVersion, privacyVersion });

    if (!termsAccepted || !termsVersion || !privacyVersion) {
        console.error('[Flouci Init] Missing consent fields:', { termsAccepted, termsVersion, privacyVersion });
        return res.status(400).json({ 
            error: 'You must accept the Terms of Service and Privacy Policy (Flouci)',
            debug: { 
                termsAccepted: !!termsAccepted, 
                termsVersion: !!termsVersion, 
                privacyVersion: !!privacyVersion,
                receivedBody: body 
            }
        });
    }

    if (!amount) {
        return res.status(400).json({ error: 'Amount is required' });
    }

    const consentIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || req.headers['x-real-ip'] as string
        || 'unknown';
    const consentUserAgent = req.headers['user-agent'] || 'unknown';
    const termsAcceptedAt = new Date().toISOString();

    try {
        console.log('[Flouci Init] Token verified for User:', userId, 'Amount:', amount, 'Currency:', currency);

        const publicKey = process.env.FLOUCI_PUBLIC_KEY;
        const privateKey = process.env.FLOUCI_PRIVATE_KEY;
        const host = req.headers.host || '';
        const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
        const appUrl = `${protocol}://${host}`;

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
                amount: amountInMillimes.toString(), // Doc says string in some places, integer in others. String is safer.
                success_link: `${appUrl}/home/pricing?success=true`,
                fail_link: `${appUrl}/home/pricing?fail=true`,
                webhook: `${appUrl}/api/pay?action=webhook`,
                developer_tracking_id: orderId,
                client_id: userId, // Track by userId in Flouci dashboard
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
            amount: amount, // Store major unit (8 or 19) for human readability
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
                await updateUserPlan(paymentRecord.user_id, billingCycle, payment_id, 'flouci');
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
                await updateUserPlan(paymentRecord.user_id, billingCycle, paymentId, 'flouci');

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
    const { billingCycle = 'monthly', termsAccepted, termsVersion, privacyVersion } = body;
    console.log('[Polar Init] Consent check:', { termsAccepted, termsVersion, privacyVersion });

    if (!termsAccepted || !termsVersion || !privacyVersion) {
        console.error('[Polar Init] Missing consent fields:', { termsAccepted, termsVersion, privacyVersion });
        return res.status(400).json({ 
            error: 'You must accept the Terms of Service and Privacy Policy (Polar)',
            debug: { 
                termsAccepted: !!termsAccepted, 
                termsVersion: !!termsVersion, 
                privacyVersion: !!privacyVersion,
                receivedBody: body 
            }
        });
    }

    const consentIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || req.headers['x-real-ip'] as string
        || 'unknown';
    const consentUserAgent = req.headers['user-agent'] || 'unknown';
    const termsAcceptedAt = new Date().toISOString();

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
        
        const host = req.headers.host || '';
        const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
        const successUrl = `${protocol}://${host}/pricing?success=true`;

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

        console.log('[Polar Init] Checkout created:', checkout.url);
        return res.status(200).json({ payUrl: checkout.url });

    } catch (error: any) {
        console.error('[Polar Init] Critical Error:', error.message, error.stack);
        return res.status(500).json({ error: 'Internal server error during payment initialization' });
    }
}

async function handlePolarPortal(req: VercelRequest, res: VercelResponse) {
    console.log('[Polar Portal] Request received');
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
        console.log('[Polar Portal] Verifying Google token...');
        const tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
        if (!tokenInfoRes.ok) {
            const errText = await tokenInfoRes.text();
            console.error('[Polar Portal] Google token verification failed:', errText);
            return res.status(401).json({ error: 'Invalid Google token' });
        }
        const info = await tokenInfoRes.json() as any;
        const userId = info.sub || info.user_id;

        if (!userId) {
            return res.status(401).json({ error: 'User identity not found in token' });
        }

        // Retrieve user from Supabase to get polar_customer_id
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('polar_customer_id')
            .eq('id', userId)
            .maybeSingle();

        if (userError || !user) {
            console.error('[Polar Portal] User not found in database:', userId);
            return res.status(404).json({ error: 'User not found in database' });
        }

        if (!user.polar_customer_id) {
            console.warn('[Polar Portal] No Polar customer ID for user:', userId);
            return res.status(400).json({ error: 'No Polar customer ID found. Please upgrade your plan first.' });
        }

        const polar = getPolarClient(res);
        if (!polar) return;

        console.log('[Polar Portal] Creating customer session for:', user.polar_customer_id);
        const session = await polar.customerSessions.create({
            customerId: user.polar_customer_id
        });

        console.log('[Polar Portal] Session created:', session.customerPortalUrl);
        return res.status(200).json({ customerPortalUrl: session.customerPortalUrl });

    } catch (error: any) {
        console.error('[Polar Portal] Critical Error:', error.message, error.stack);
        return res.status(500).json({ error: 'Internal server error' });
    }
}


async function handlePolarWebhook(req: VercelRequest, res: VercelResponse, rawBody: string) {
    console.log('[Polar Webhook] Triggered');
    const polar = getPolarClient(res);
    if (!polar) return;

    const signature = req.headers['webhook-signature'] as string;
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET || '';

    if (!signature) {
        console.warn('[Polar Webhook] Missing signature header');
        return res.status(401).json({ error: 'Missing signature' });
    }

    if (!webhookSecret) {
        console.error('[Polar Webhook] Missing POLAR_WEBHOOK_SECRET env var');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event: any;
    try {
        event = validateEvent(rawBody, req.headers as Record<string, string>, webhookSecret);
    } catch (error: any) {
        if (error instanceof WebhookVerificationError) {
            console.warn('[Polar Webhook] Signature verification failed');
            return res.status(401).json({ error: 'Invalid signature' });
        }
        
        // Handle other validation errors (like unknown event types / SDKValidationError) gracefully
        let eventType = 'unknown';
        try {
            const parsed = JSON.parse(rawBody);
            eventType = parsed.type || 'unknown';
        } catch {
            // Ignore parsing error
        }
        
        console.warn(`[Polar Webhook] Validation error for event type "${eventType}":`, error.message || error);
        // Return 200 OK so Polar stops retrying unknown/invalid events that aren't signature issues
        return res.status(200).json({ received: true, ignored: true, reason: error.message });
    }

    const processWebhook = async (event: any) => {
        const eventType = event.type as string;
        console.log('[Polar Webhook] Processing event:', eventType, 'for User ID extraction...');


        const data = event.data as any;
        let userId = data.metadata?.userId;
        let foundSource = 'metadata.userId';

        if (!userId && data.metadata?.user_id) {
            userId = data.metadata.user_id;
            foundSource = 'metadata.user_id';
        }
        if (!userId && data.customFieldData?.userId) {
            userId = data.customFieldData.userId;
            foundSource = 'customFieldData.userId';
        }
        if (!userId && data.activeSubscriptions?.[0]?.metadata?.userId) {
            userId = data.activeSubscriptions[0].metadata.userId;
            foundSource = 'activeSubscriptions[0].metadata.userId';
        }
        if (!userId && data.customer?.metadata?.userId) {
            userId = data.customer.metadata.userId;
            foundSource = 'customer.metadata.userId';
        }

        if (userId) {
            console.log(`[Polar Webhook] Found userId: ${userId} via ${foundSource}`);
        }

        if (!userId) {
            console.error(`[Polar Webhook] [${eventType}] No userId found in Polar webhook metadata. Full data object:`, JSON.stringify(data, null, 2));
            return;
        }

        if (eventType === 'order.created' || eventType === 'order.paid' || eventType === 'subscription.created') {
            const productId = data.productId;
            const isYearly = productId === process.env.POLAR_PRODUCT_ID_PRO_YEARLY;
            const billingCycle = isYearly ? 'yearly' : 'monthly';
            console.log(`[Polar Webhook] [${eventType}] User: ${userId}, ProductId: ${productId}, BillingCycle: ${billingCycle}`);

            const additionalData: any = {
                polar_customer_id: data.customerId
            };
            
            if (eventType === 'subscription.created') {
                additionalData.polar_subscription_id = data.id;
            } else if (data.subscriptionId) {
                additionalData.polar_subscription_id = data.subscriptionId;
            }

            // Insert payment record if it doesn't exist
            const paymentRef = data.id || data.orderId;
            const { data: existingPayment } = await supabase
                .from('payments')
                .select('id')
                .eq('payment_ref', paymentRef)
                .maybeSingle();

            if (!existingPayment) {
                console.log(`[Polar Webhook] [${eventType}] Inserting new payment record for ${paymentRef}`);

                const consentMeta = data.metadata || {};

                await supabase.from('payments').insert({
                    payment_ref: paymentRef,
                    user_id: userId,
                    amount: Math.round((data.amount || 0) / 100), // Convert Polar cents to major unit (e.g. 800 -> 8)
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

            await updateUserPlan(userId, billingCycle, paymentRef, 'polar', additionalData, data.status || 'active');
        } else if (['subscription.updated', 'subscription.deleted', 'subscription.revoked'].includes(eventType)) {
            const status = data.status;
            const cancelAtPeriodEnd = data.cancelAtPeriodEnd;
            console.log(`[Polar Webhook] [${eventType}] User: ${userId}, Status: ${status}, CancelAtPeriodEnd: ${cancelAtPeriodEnd}`);

            // Downgrade rules:
            // 1. If cancelAtPeriodEnd is true, keep Pro but mark as canceled.
            // 2. If subscription.deleted or subscription.revoked, we always downgrade.
            // 3. If subscription.updated, ONLY downgrade if status is explicitly canceled, revoked, or incomplete_expired.
            // IMPORTANT: If status is 'incomplete', we do NOT downgrade (often sent before first payment).
            const isExplicitDowngradeStatus = ['canceled', 'revoked', 'incomplete_expired'].includes(status);
            const isDeletionEvent = eventType === 'subscription.deleted' || eventType === 'subscription.revoked';

            if (cancelAtPeriodEnd) {
                console.log(`[Polar Webhook] Marking user ${userId} as Canceled but keeping Pro (Status: ${status})`);
                await supabase
                    .from('users')
                    .update({
                        subscription_status: 'canceled',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userId);
            } else if (isDeletionEvent || isExplicitDowngradeStatus) {
                console.log(`[Polar Webhook] Downgrading user ${userId} to Free (Status: ${status}, Event: ${eventType})`);
                await supabase
                    .from('users')
                    .update({
                        plan: 'free',
                        subscription_status: 'canceled',
                        polar_subscription_id: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userId);
            } else if (['active', 'trialing'].includes(status)) {
                console.log(`[Polar Webhook] [${eventType}] Ensuring user ${userId} is Pro (Status: ${status})`);
                await supabase
                    .from('users')
                    .update({
                        plan: 'pro',
                        subscription_status: 'active',
                        payment_provider: 'polar',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userId);
            }
        } else if (eventType === 'order.refunded') {
            console.log(`[Polar Webhook] [${eventType}] Downgrading user ${userId} to Free due to refund`);
            await supabase
                .from('users')
                .update({
                    plan: 'free',
                    subscription_status: 'canceled',
                    polar_subscription_id: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);
        }
    };

    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Webhook processing timeout')), 8000)
    );

    try {
        await Promise.race([processWebhook(event), timeout]);
        return res.status(200).json({ received: true });
    } catch (error: any) {
        if (error.message === 'Webhook processing timeout') {
            console.error('[Polar Webhook] Processing timed out (8s)');
            return res.status(504).json({ error: 'Processing timeout' });
        }
        console.error('[Polar Webhook] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}



async function updateUserPlan(
    userId: string,
    billingCycle: 'monthly' | 'yearly',
    paymentRef?: string,
    provider?: string,
    additionalData: any = {},
    status: string = 'active'
) {
    const now = new Date();
    let baseDate = now;

    // FOR MANUAL PAYMENTS (FLOUCI): Check if we should stack the time
    if (provider === 'flouci') {
        try {
            const { data: currentUser } = await supabase
                .from('users')
                .select('plan, expiry_date')
                .eq('id', userId)
                .maybeSingle();

            if (currentUser?.plan === 'pro' && currentUser.expiry_date) {
                const currentExpiry = new Date(currentUser.expiry_date);
                // Only stack if the existing expiry is in the future
                if (currentExpiry > now) {
                    baseDate = currentExpiry;
                    console.log(`[updateUserPlan] Flouci: Stacking on existing expiry: ${baseDate.toISOString()}`);
                }
            }
        } catch (err) {
            console.error('[updateUserPlan] Error fetching current user for stacking:', err);
            // Fallback to 'now' as baseDate if query fails
        }
    }

    const expiry = new Date(baseDate);
    if (billingCycle === 'yearly') {
        expiry.setFullYear(baseDate.getFullYear() + 1);
    } else {
        expiry.setMonth(baseDate.getMonth() + 1);
    }

    console.log(`[updateUserPlan] Upgrading user ${userId} (${billingCycle}) via ${provider}. Base Date: ${baseDate.toISOString()}, New Expiry: ${expiry.toISOString()}`);
    console.log(`[updateUserPlan] Target userId: ${userId}`);

    const updatePayload: any = {
        plan: 'pro',
        subscription_status: status,
        expiry_date: expiry.toISOString(),
        payment_provider: provider,
        updated_at: now.toISOString(),
        ...additionalData
    };

    console.log('[updateUserPlan] Payload:', JSON.stringify(updatePayload));

    const { data: updateData, error: updateError, status: updateStatus } = await supabase

        .from('users')
        .update(updatePayload)
        .eq('id', userId)
        .select();

    if (updateError) {
        console.error(`[updateUserPlan] Failed to update user ${userId}. Status: ${updateStatus}, Error:`, JSON.stringify(updateError, null, 2));
        throw updateError;
    }

    if (!updateData || updateData.length === 0) {
        console.warn(`[updateUserPlan] 0 rows updated for userId ${userId}. User record might not exist in Supabase.`);
    } else {
        console.log(`[updateUserPlan] Successfully updated user ${userId} to Pro.`);
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
            console.error(`[updateUserPlan] Error updating payment record ${paymentRef}:`, JSON.stringify(paymentError, null, 2));
        }
    }

    return { success: true, expiry };
}

