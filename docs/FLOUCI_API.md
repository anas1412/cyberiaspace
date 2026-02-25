> ## Documentation Index
> Fetch the complete documentation index at: https://docs.flouci.com/llms.txt
> Use this file to discover all available pages before exploring further.

# How to Build Requests

> How to build requests to the Flouci Payment API, including authentication with public and secret keys.

The Flouci Payment API is built on REST principles and requires all requests to be made over HTTPS (TLS 1.2 or higher). Any requests sent over plain HTTP will be rejected.

## Authentication

To authenticate your requests, you must include an `Authorization` header in every API call. The value of this header should be your `public_key` and `secret_key` joined by a colon, in the following format: `Bearer <PUBLIC_KEY>:<PRIVATE_KEY>`

<RequestExample>
  ```bash cURL theme={null}
  curl -X POST '@IP/api/v2/generate_payment' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <PUBLIC_KEY>:<PRIVATE_KEY>' \
  ```
</RequestExample>


> ## Documentation Index
> Fetch the complete documentation index at: https://docs.flouci.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Payment Steps

> Learn about the payment step in the Flouci payment process.

The Flouci web payment solution is based on a redirection mechanism. The user is redirected to a payment page, where they can pay with one of the payment methods activated by the merchant (Flouci wallet, bank card/e-dinar, other wallet, etc.).

Based on the transaction outcome, the user is redirected to the merchant's site using the `success_link` or `fail_link` variables. Additionally, an optional `webhook` field enables the Flouci system to notify the partner server-to-server when a transaction is complete, ensuring reliability in cases of network issues and providing a more comprehensive payment handling system.

<Steps>
  <Step title="Initiate Payment">
    <p>To start a payment, the merchant must generate a payment request using the Flouci API. This involves specifying the amount, currency, and other transaction details.</p>
  </Step>

  <Step title="Redirect to Payment Page">
    <p>Once the payment request is generated, redirect the user to the Flouci payment page. The user can choose their preferred payment method and complete the transaction.</p>
  </Step>

  <Step title="Handle Transaction Outcome">
    <p>After the transaction, the user is redirected back to the merchant's site using the `success_link` or `fail_link`. Additionally, configure a `webhook` to receive server-to-server notifications for transaction completions.</p>
  </Step>
</Steps>


> ## Documentation Index
> Fetch the complete documentation index at: https://docs.flouci.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Generate Payment

> Generate a new payment and get a redirection link for the user to complete the payment in.

This endpoint creates a new payment and returns a URL to redirect the user to for completing the payment.

<RequestExample>
  ```bash cURL theme={null}
  curl -X POST 'https://developers.flouci.com/api/v2/generate_payment' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <PUBLIC_KEY>:<PRIVATE_KEY>' \
    -d '{
      "amount": 1000,
      "success_link": "https://your-website.com/success",
      "fail_link": "https://your-website.com/fail",
      "webhook": "https://your-website.com/webhook",
      "developer_tracking_id": "<YOUR_TRACKING_ID>"
    }'
  ```
</RequestExample>

### Body

<ParamField body="amount" type="integer" required>
  The amount to be paid in millimes.
</ParamField>

<ParamField body="success_link" type="string" required>
  The URL to redirect the user to after a successful payment.
</ParamField>

<ParamField body="fail_link" type="string" required>
  The URL to redirect the user to after a failed payment.
</ParamField>

<ParamField body="webhook" type="string">
  The webhook URL you want to receive payment confirmation on.
</ParamField>

<ParamField body="developer_tracking_id" type="string">
  An ID for you to track the payment. This is a free field that Flouci doesn't check against.
</ParamField>

<ParamField body="session_timeout_secs" type="integer" default="1200">
  The session timeout in seconds.
</ParamField>

<ParamField body="accept_card" type="boolean" default="false">
  Whether to accept card payments.
</ParamField>

<ParamField body="image_url" type="URL">
  The URL of the image to display on the payment page. This field is optional, and the default image is the image of the merchant in the Flouci portal.
</ParamField>

<ResponseExample>
  ```json Success theme={null}
  {
    "result": {
      "success": True,
      "payment_id": "FoPKKHqfQIKfBqhEj8M47A",
      "link": "https://flouci.com/pay/FoPKKHqfQIKfBqhEj8M47A",
      "developer_tracking_id": "<DEVELOPER_TRACKING_ID>
    },
    "name": "developers",
    "code": 0,
    "version": "v2"
  }
  ```

  ```json Error theme={null}
  {
    "result": {
      "status": 400,
      "message": "Bad Request"
    }
  }
  ```
</ResponseExample>

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.flouci.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Verify Payment

> Verify the status of a payment.

This endpoint allows you to check the status of a payment using the `payment_id` returned by the Generate Payment endpoint.
In this endpoint, it is crucial to ensure that the "success" field is true before attempting to parse the API's content. Once confirmed, the payload will reveal the precise status of the transaction at the time of the API call. The transaction status can be one of the following:

* **SUCCESS**: This indicates that the transaction has been confirmed and the payment was successful.
* **PENDING**: The session is still active, and a payment can still be confirmed.
* **EXPIRED**: The session has expired, and no payment is expected.
* **FAILURE**: The payment has failed, and details regarding the failure, including the reason, are accessible via the API.

To confirm a payment, it is essential to verify that the "success" field is true and the status is "SUCCESS". It is advisable to invoke this function upon receiving a success or failure webhook to confirm the transaction's status. However, it is important to avoid making multiple successive calls (pings) to prevent rate limiting and potential IP bans.

<RequestExample>
  ```bash cURL theme={null}
  curl -X GET 'https://developers.flouci.com/api/v2/verify_payment/{payment_id}' \
    -H 'authorization: Bearer <APP_PUBLIC>:<APP_SECRET>' \
  ```
</RequestExample>

### Path Parameters

<ParamField path="payment_id" type="string" required>
  The ID of the payment to verify.
</ParamField>

<ResponseExample>
  ```json Success theme={null}
  {
      "success": true,
      "result": {
          "type": "wallet",
          "amount": 1250,
          "status": "SUCCESS",
          "details": {
              "order_number": "Pb3pNSdyRRWOBdXHDTEdBw",
              "name": "FOULEN BEN FOULEN",
              "approval_code": "182848",
              "phone_number": "",
              "email": "",
              "destination": []
          },
          "developer_tracking_id": "your_internal_tracking_id"
      },
      "status_code": 200,
      "name": "developers",
      "code": 0,
      "version": "2.0.0"
  }
  ```

  ```json Error theme={null}
  {
    "result": {
      "status": 404,
      "message": "Payment not found"
    }
  }
  ```
</ResponseExample>

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.flouci.com/llms.txt
> Use this file to discover all available pages before exploring further.

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.flouci.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Test Environment

> Learn how to use the test environment.

With each developer account, you will automatically have a test application called **TEST APP**. You can use the `PUBLIC_KEY` and `PRIVATE_KEY` of the test app during the integration of the payment on your site.

### Wallet Payments

Currently, there are no dedicated tests for wallet payments in the test environment. However, wallet payments will work automatically when you switch to production. For examples of wallet payment payloads and responses, please refer to the [Verify Payment](../api-reference/verify-transaction) endpoint documentation.

### Card Payments

| Card Type  |      Test Case     |         Card Number | Expiration Date | CVV |
| :--------- | :----------------: | ------------------: | :-------------: | --: |
| Visa       | Successful Payment | 4509 2111 1111 1119 |      12/26      | 748 |
| MasterCard | Successful Payment | 5440 2127 1111 1110 |      12/26      | 665 |
| MasterCard |   Failed Payment   | 5471 2511 1111 1116 |      11/23      | 858 |

### Transaction Verification

In the test environment, `verify_payment` keeps the transaction status information for 20 minutes. You can check the status of the transaction with the `payment_id` during this period to finalize the integration on your website.

In the test environment, the information is not visible in any dashboard, and is accessible via API only. Once you move to production keys, all transactions can be monitored in real-time via our web interface [https://app.flouci.com](https://app.flouci.com).
