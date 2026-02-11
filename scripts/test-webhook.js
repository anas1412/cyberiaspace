const crypto = require('crypto');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const API_KEY = process.env.KONNECT_API_KEY;
const WEBHOOK_URL = 'http://localhost:3000/api/pay/webhook'; // Adjust port if needed

async function testWebhook(paymentRef) {
    if (!API_KEY) {
        console.error('Error: KONNECT_API_KEY not found in .env.local');
        return;
    }

    console.log(`Testing Webhook for Ref: ${paymentRef}`);

    // 1. Generate Signature
    const signature = crypto
        .createHmac('sha256', API_KEY)
        .update(paymentRef)
        .digest('hex');

    console.log(`Generated Signature: ${signature}`);

    // 2. Fire Request
    try {
        const response = await axios.get(WEBHOOK_URL, {
            params: { payment_ref: paymentRef },
            headers: { 'x-konnect-signature': signature }
        });

        console.log(`Response Status: ${response.status}`);
        console.log(`Response Data: ${response.data}`);

        if (response.status === 200) {
            console.log('✅ Webhook logic verification successful!');
        } else {
            console.log('❌ Webhook logic verification failed.');
        }
    } catch (error) {
        console.error('❌ Request error:', error.message);
        if (error.response) {
            console.error('Response details:', error.response.data);
        }
    }
}

// Get payment ref from command line or use a dummy
const ref = process.argv[2] || 'test_ref_123';
testWebhook(ref);
