This documentation is designed to provide an AI agent or developer with all the technical details necessary to integrate the **Konnect Network "Initiate Payment" API**.

# Konnect Network: Initiate Payment API Documentation

## 1. Overview
The `initiate-payment` endpoint is used to generate a unique payment link. When called, it returns a `payUrl` where the customer is redirected to complete their transaction and a `paymentRef` for tracking.

---

## 2. API Endpoints
| Environment | Base URL |
| :--- | :--- |
| **Sandbox** | `https://api.sandbox.konnect.network/api/v2` |
| **Production** | `https://api.konnect.network/api/v2` |

**Endpoint Path:** `POST /payments/init-payment`

---

## 3. Authentication
All requests must include your unique API key in the header.
- **Header Name:** `x-api-key`
- **Type:** `string`
- **Required:** Yes

---

## 4. Request Body Parameters

The request body must be a **JSON object**.

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `receiverWalletId` | `string` | **Yes** | Your Konnect Wallet ID (found in the dashboard). |
| `amount` | `number` | **Yes** | Amount in subunits: **Millimes** for TND, **Centimes** for EUR/USD (e.g., 10000 = 10.000 TND). |
| `token` | `string` | No | Currency: `TND`, `EUR`, or `USD`. (Default: `TND`). |
| `type` | `string` | No | `immediate` (full payment) or `partial` (allows partial payments). |
| `description` | `string` | No | Description displayed to the payer on the gateway. |
| `acceptedPaymentMethods`| `array` | No | Options: `["wallet", "bank_card", "e-DINAR"]`. Defaults to all. |
| `lifespan` | `number` | No | Link expiration time in **minutes**. |
| `orderId` | `string` | No | Your internal custom order identifier. |
| `webhook` | `string` | No | URL Konnect will call (GET) to notify you of payment status. |
| `firstName` | `string` | No | Payer's first name (pre-fills form). |
| `lastName` | `string` | No | Payer's last name (pre-fills form). |
| `email` | `string` | No | Payer's email address. |
| `phoneNumber` | `string` | No | Payer's phone number. |
| `checkoutForm` | `boolean`| No | If `true`, requires payer to fill a form before paying. |
| `addPaymentFeesToAmount`| `boolean`| No | If `true`, the transaction fees are charged to the customer. |
| `theme` | `string` | No | `light` or `dark`. (Default: `light`). |

> **Note on Deprecated Fields:** `silentWebhook`, `successUrl`, and `failUrl` are deprecated. It is recommended to use the `webhook` field for status synchronization.

---

## 5. Sample Request
```json
{
  "receiverWalletId": "5f7a209aeb3f76490ac4a3d1",
  "token": "TND",
  "amount": 15500,
  "type": "immediate",
  "description": "Order #12345 Payment",
  "acceptedPaymentMethods": ["bank_card", "e-DINAR"],
  "lifespan": 15,
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "orderId": "ORD-12345",
  "webhook": "https://your-site.com/api/konnect-callback",
  "theme": "light"
}
```

---

## 6. API Response

### Success Response (200 OK)
Returns the payment link and a unique reference.
```json
{
  "payUrl": "https://dev.konnect.network/admin/pay?payment_ref=60889219a388f75c94a943ec",
  "paymentRef": "60889219a388f75c94a943ec"
}
```

### Error Responses
- **401 Unauthorized:** Invalid or missing `x-api-key`.
- **400 Bad Request:** Missing required fields or invalid data types (e.g., negative amount).

---

## 7. AI Agent Implementation Logic
When an AI agent interacts with this API, it should follow these steps:

1.  **Validation:** Ensure `amount` is converted to the correct subunit (multiply by 1000 for TND).
2.  **Request Construction:** Build the JSON body using the user's order details.
3.  **Execution:** Send the POST request to the appropriate environment URL with the `x-api-key`.
4.  **Handling Output:** 
    - Provide the `payUrl` to the user so they can complete the payment.
    - Store the `paymentRef` in the local database to verify the transaction later via Webhook or the "Get Payment Details" endpoint.
5.  **Rate Limiting:** Do not exceed **100 requests per minute**.

---

## 8. Best Practices
*   **Storage:** Always store the `paymentRef`. This is the only way to query the status of the transaction later.
*   **Security:** Never expose the `x-api-key` in client-side code (frontend). Always call this API from a secure backend environment.
*   **Webhooks:** Implement a listener for the `webhook` URL to automatically update order statuses in your system without manual polling.

This documentation provides technical specifications for implementing and handling **Konnect Network Webhooks**. This is the second step in the payment flow, allowing your system to receive real-time updates when a payment status changes.

# Konnect Network: Webhook Integration Documentation

## 1. Overview
Webhooks are asynchronous notifications sent by Konnect to your server. When a customer completes (or fails) a payment, Konnect sends an automated request to the `webhook` URL you provided during the [Initiate Payment](./initiate-payment.md) phase.

---

## 2. Webhook Mechanism
- **Method:** `GET`
- **Trigger:** Any change in payment status (Success, Failure, Expired).
- **URL:** The URL defined in the `webhook` field of your `init-payment` request.

---

## 3. Request Structure
When a payment is processed, Konnect will call your URL with a query parameter:

**Example Webhook Call:**
`GET https://your-site.com/api/konnect-callback?payment_ref=60889219a388f75c94a943ec`

### Headers
Konnect sends a security signature to ensure the request is authentic.
- **Header Name:** `x-konnect-signature`
- **Value:** An HMAC-SHA256 hash.

---

## 4. Security & Signature Verification
To prevent "Man-in-the-Middle" attacks or fake notifications, your AI agent or backend **must** verify the signature before updating any internal order status.

### Verification Logic:
1.  Capture the `payment_ref` from the URL query parameters.
2.  Capture the `x-konnect-signature` from the request headers.
3.  Generate an HMAC-SHA256 hash using:
    - **Key:** Your Konnect `API_KEY`.
    - **Message:** The `payment_ref` received.
4.  Compare your generated hash with the `x-konnect-signature`.

### Pseudocode Example:
```javascript
const crypto = require('crypto');

const paymentRef = request.query.payment_ref;
const receivedSignature = request.headers['x-konnect-signature'];
const apiKey = process.env.KONNECT_API_KEY;

// Generate local signature
const localSignature = crypto
  .createHmac('sha256', apiKey)
  .update(paymentRef)
  .digest('hex');

if (localSignature === receivedSignature) {
    // Signature is valid: Proceed to update order status
} else {
    // Invalid signature: Reject request
}
```

---

## 5. Recommended Processing Flow
Since the Webhook only sends the `payment_ref`, it does not tell you if the payment was successful or failed within the URL itself.

**The AI Agent/Backend should follow these steps upon receiving a Webhook:**
1.  **Verify Signature:** (As described in Section 4).
2.  **Fetch Payment Details:** Use the `paymentRef` to call the Konnect **Get Payment Details** endpoint:
    - `GET /payments/:id`
3.  **Check Status:** Inspect the `status` field in the response:
    - `completed`: Mark order as Paid.
    - `failed`: Mark order as Failed.
    - `pending`: Keep order as Pending.
4.  **Respond to Konnect:** Your server should return a `200 OK` status code to acknowledge receipt.

---

## 6. Response Requirements
To tell Konnect that you have successfully received the notification, your server must respond within **5 seconds**.

- **Success Response:** `200 OK`
- **Failure Response:** If your server returns `4xx` or `5xx`, or times out, Konnect may attempt to retry the notification (depending on system configuration).

---

## 7. AI Agent Implementation Checklist
| Task | Description |
| :--- | :--- |
| **Endpoint Creation** | Create a public `GET` route on your server. |
| **Extract Ref** | Read the `payment_ref` from the query string. |
| **Security Check** | Verify the `x-konnect-signature` header against your API Key. |
| **Status Update** | Trigger a background job to fetch payment details and update the DB. |
| **Response** | Immediately return a `200 OK` to Konnect. |

---

## 8. Troubleshooting
- **Signature Mismatch:** Ensure you are using the correct `API_KEY` (Sandbox vs. Production) and that you are hashing the `payment_ref` string exactly as received.
- **Webhook Not Received:** 
    - Verify your server is accessible from the public internet (not localhost).
    - Check if a firewall or WAF (like Cloudflare) is blocking incoming requests from Konnect's IP.
    - Double-check that the `webhook` URL sent in the `init-payment` request was correctly formatted.

    This documentation provides the technical specifications for the **Get Payment Details** endpoint. This is the final and most critical step for an AI agent to verify the actual status of a transaction after a webhook is received or when a manual check is required.

# Konnect Network: Get Payment Details API Documentation

## 1. Overview
The `get-payment-details` endpoint allows you to retrieve the full state of a transaction. While the Webhook notifies you that *something* happened, this endpoint acts as the **"Source of Truth"** to confirm the amount, currency, and final status (success or failure).

---

## 2. API Endpoints
| Environment | Base URL |
| :--- | :--- |
| **Sandbox** | `https://api.sandbox.konnect.network/api/v2` |
| **Production** | `https://api.konnect.network/api/v2` |

**Endpoint Path:** `GET /payments/:id`  
*(Replace `:id` with the `paymentRef` received during initiation).*

---

## 3. Authentication
The request must include your API key in the header.
- **Header Name:** `x-api-key`
- **Type:** `string`
- **Required:** Yes

---

## 4. Path Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | **Yes** | The unique `paymentRef` returned by the `init-payment` request. |

---

## 5. Sample Request
**URL:** `GET https://api.sandbox.konnect.network/api/v2/payments/60889219a388f75c94a943ec`

**Headers:**
```http
x-api-key: YOUR_API_KEY_HERE
```

---

## 6. API Response Body
The response returns a detailed object containing the payment's lifecycle information.

### Response Fields Definition
| Field | Type | Description |
| :--- | :--- | :--- |
| `payment.status` | `string` | Current state: `pending`, `completed`, or `failed`. |
| `payment.amount` | `number` | Total amount in subunits (e.g., 15500 for 15.500 TND). |
| `payment.token` | `string` | Currency used (TND, EUR, USD). |
| `payment.orderId` | `string` | The custom identifier you provided during initiation. |
| `payment.method` | `string` | Payment method used (e.g., `bank_card`, `e-DINAR`). |
| `payment.transactions`| `array` | List of payment attempts related to this reference. |
| `payment.receiverWalletId`| `string` | The ID of the wallet that received the funds. |

### Success Response Example (200 OK)
```json
{
  "payment": {
    "status": "completed",
    "amount": 15500,
    "token": "TND",
    "description": "Order #12345 Payment",
    "method": "bank_card",
    "orderId": "ORD-12345",
    "paymentRef": "60889219a388f75c94a943ec",
    "createdAt": "2023-10-01T10:00:00.000Z",
    "transactions": [
      {
        "status": "success",
        "type": "bank_card",
        "amount": 15500
      }
    ]
  }
}
```

---

## 7. Understanding Payment Statuses
An AI agent must branch its logic based on the `payment.status` field:

1.  **`completed`**: The funds have been successfully authorized/captured. The agent should trigger the fulfillment process (e.g., send digital goods, mark invoice as paid).
2.  **`pending`**: The customer has not finished the process or the transaction is awaiting bank authorization. The agent should wait and check again later (or wait for the Webhook).
3.  **`failed`**: The transaction was rejected by the bank or cancelled by the user. The agent should notify the user and potentially offer a retry link.

---

## 8. AI Agent Implementation Logic

### The "Verification" Flow:
1.  **Trigger:** Receives a Webhook containing a `paymentRef`.
2.  **Security:** Verifies the Webhook signature (using the logic in the Webhook documentation).
3.  **Fetch:** Calls `GET /payments/{paymentRef}` using the stored `x-api-key`.
4.  **Verification Check:**
    - Is the `status === 'completed'`?
    - Does the `amount` match the expected amount in the database?
    - Does the `token` (currency) match?
5.  **Final Action:** Update the internal database and notify the user.

### Error Handling:
- **404 Not Found:** The `paymentRef` provided does not exist. The agent should log this as a potential fraud attempt or a misconfiguration.
- **401 Unauthorized:** The API key is expired or invalid. The agent should alert the system administrator immediately.

---

## 9. Best Practices
*   **Do not rely solely on Webhooks:** Sometimes webhooks fail due to network issues. Use this endpoint to "poll" the status if you haven't received a webhook within a reasonable timeframe (e.g., 30 minutes after link creation).
*   **Validation:** Always verify that the `amount` returned by this endpoint matches the `amount` you requested in the initiation phase to prevent "Parameter Tampering" attacks.
*   **Caching:** Do not cache the response of this endpoint if the status is `pending`, as it is subject to change. However, once the status is `completed` or `failed`, it is immutable.