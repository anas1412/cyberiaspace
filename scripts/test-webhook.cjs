const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 1. Manually Load .env.local (Safe Fallback)
const envPath = path.resolve(__dirname, '../.env.local');
let apiKey = process.env.KONNECT_API_KEY;

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/KONNECT_API_KEY=["']?([^"'\n\r]+)["']?/);
    if (match) apiKey = match[1];
}

const WEBHOOK_URL = 'http://localhost:3000/api/pay/webhook';

async function testWebhook(paymentRef) {
    if (!apiKey) {
        console.error('❌ Error: KONNECT_API_KEY not found in process.env or .env.local');
        process.exit(1);
    }

    console.log(`🚀 Testing Webhook for Ref: ${paymentRef}`);

    // 2. Generate Signature
    const signature = crypto
        .createHmac('sha256', apiKey)
        .update(paymentRef)
        .digest('hex');

    console.log(`🔑 Generated Signature: ${signature}`);

    // 3. Fire Request using native fetch
    try {
        const url = new URL(WEBHOOK_URL);
        url.searchParams.append('payment_ref', paymentRef);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'x-konnect-signature': signature
            }
        });

        const text = await response.text();
        console.log(`📡 Status: ${response.status}`);
        console.log(`📦 Body: ${text}`);

        if (response.status === 200) {
            console.log('✅ Webhook logic verification successful!');
        } else {
            console.log('❌ Webhook logic verification failed.');
        }
    } catch (error) {
        console.error('❌ Request error:', error.message);
    }
}

// Get payment ref from command line or use a dummy
const ref = process.argv[2] || 'test_ref_' + Date.now();
testWebhook(ref);
