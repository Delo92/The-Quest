# Chronic Brands USA — Promo Code Tracking Integration Guide

This document explains how to connect your site or app to the Chronic Brands USA centralized promo code tracking system. When a customer uses a promo code on your platform, your backend sends one HTTP request to this system and it handles everything — logging the redemption with full transaction detail, incrementing usage counts, and making it visible to the admin team in real time.

**These records are used for payout calculations. Accuracy is critical. Send every field you have access to.**

---

## What You Need

- The **webhook URL** (provided by Chronic Brands USA admin)
- The **API key** (provided by Chronic Brands USA admin — keep this secret, never expose it in frontend/browser code)

---

## How It Works

When a customer successfully redeems a promo code on your site (at checkout, on a discount page, etc.), your backend sends a `POST` request to the webhook endpoint. The Chronic Brands system validates the code, records the full redemption, and responds immediately.

**This call must always be made from your server/backend — never from the browser. The API key must stay private.**

---

## The Request

**Method:** `POST`

**URL:**
```
https://chronicbrandsusa.com/api/webhooks/promo-redemption
```

**Headers:**
```
Content-Type: application/json
x-api-key: YOUR_API_KEY_HERE
```

**Body (JSON):**

| Field | Required | Description |
|---|---|---|
| `code` | **Yes** | The promo code the customer entered (e.g. `BRAND20`) |
| `brandName` | **Yes** | The name of your brand or site (e.g. `OlyLife Oklahoma`) |
| `platform` | **Yes** | Where it was redeemed — hardcode this to your platform name (e.g. `OlyLife Website`, `OlyLife App`, `In Person`) |
| `orderNumber` | Recommended | Your internal order or transaction ID (e.g. `ORD-1042`) — critical for dispute resolution |
| `orderValue` | Recommended | The total order value in dollars as a string (e.g. `"89.99"`) |
| `discountAmount` | Recommended | The dollar value of the discount applied (e.g. `"17.99"`) |
| `customerName` | Recommended | The customer's full name |
| `customerEmail` | Recommended | The customer's email address |
| `customerPhone` | Optional | The customer's phone number |
| `notes` | Optional | Any extra context (e.g. `First-time customer`, `Applied at checkout`) |

> **Note on Recommended fields:** These are not technically required — the request will succeed without them — but they are essential for accurate payout records. Send every field you have access to. At minimum always send `orderNumber`, `orderValue`, and `discountAmount`.

---

## Response

**Success (`200 OK`):**
```json
{
  "valid": true,
  "redemption": {
    "id": 12,
    "code": "BRAND20",
    "brandName": "OlyLife Oklahoma",
    "platform": "OlyLife Website",
    "orderNumber": "ORD-1042",
    "orderValue": "89.99",
    "discountAmount": "17.99",
    "customerName": "Jane Smith",
    "customerEmail": "jane@example.com",
    "customerPhone": null,
    "source": "webhook",
    "redeemedAt": "2026-03-22T01:00:00.000Z"
  }
}
```

**Missing required field (`400`):**
```json
{ "message": "brandName is required" }
```

**Code is disabled (`409`):**
```json
{ "valid": false, "message": "Code is disabled" }
```

**Code has hit its usage limit (`409`):**
```json
{ "valid": false, "message": "Code has reached its usage limit" }
```

**Invalid API key (`401`):**
```json
{ "message": "Invalid API key" }
```

---

## Code Examples

### Node.js / Express
```javascript
async function trackPromoRedemption({ code, orderNumber, orderValue, discountAmount, customer }) {
  const response = await fetch('https://chronicbrandsusa.com/api/webhooks/promo-redemption', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.CHRONIC_BRANDS_API_KEY,
    },
    body: JSON.stringify({
      code:           code,
      brandName:      'OlyLife Oklahoma',      // Always hardcode your brand name
      platform:       'OlyLife Website',       // Always hardcode your platform
      orderNumber:    orderNumber,
      orderValue:     String(orderValue),
      discountAmount: String(discountAmount),
      customerName:   customer.name,
      customerEmail:  customer.email,
      customerPhone:  customer.phone || null,
      notes:          `Order completed at ${new Date().toISOString()}`,
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.valid) {
    // Code is invalid, disabled, or limit reached
    throw new Error(result.message || 'Promo code could not be applied');
  }

  return result; // Redemption successfully logged
}
```

### PHP
```php
function trackPromoRedemption($code, $orderNumber, $orderValue, $discountAmount, $customer) {
    $payload = json_encode([
        'code'           => $code,
        'brandName'      => 'OlyLife Oklahoma',   // Always hardcode your brand name
        'platform'       => 'OlyLife Website',    // Always hardcode your platform
        'orderNumber'    => $orderNumber,
        'orderValue'     => (string)$orderValue,
        'discountAmount' => (string)$discountAmount,
        'customerName'   => $customer['name'],
        'customerEmail'  => $customer['email'],
        'customerPhone'  => $customer['phone'] ?? null,
    ]);

    $ch = curl_init('https://chronicbrandsusa.com/api/webhooks/promo-redemption');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'x-api-key: ' . getenv('CHRONIC_BRANDS_API_KEY'),
    ]);

    $response = json_decode(curl_exec($ch), true);
    $status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status !== 200 || !$response['valid']) {
        throw new Exception($response['message'] ?? 'Promo code could not be applied');
    }

    return $response;
}
```

### Python
```python
import requests
import os

def track_promo_redemption(code, order_number, order_value, discount_amount, customer):
    response = requests.post(
        'https://chronicbrandsusa.com/api/webhooks/promo-redemption',
        headers={
            'Content-Type': 'application/json',
            'x-api-key': os.environ['CHRONIC_BRANDS_API_KEY'],
        },
        json={
            'code':           code,
            'brandName':      'OlyLife Oklahoma',   # Always hardcode your brand name
            'platform':       'OlyLife Website',    # Always hardcode your platform
            'orderNumber':    order_number,
            'orderValue':     str(order_value),
            'discountAmount': str(discount_amount),
            'customerName':   customer.get('name'),
            'customerEmail':  customer.get('email'),
            'customerPhone':  customer.get('phone'),
        }
    )

    result = response.json()

    if response.status_code != 200 or not result.get('valid'):
        raise Exception(result.get('message', 'Promo code could not be applied'))

    return result
```

---

## Recommended Integration Point

Call this **after** the customer's order is confirmed and payment is processed — not before. This ensures records are only created for completed transactions.

**Typical checkout flow:**
1. Customer enters promo code → your site applies the discount
2. Customer completes payment → order is confirmed
3. **Your backend calls the webhook with the full order details**
4. The redemption appears in the Chronic Brands admin dashboard immediately

---

## Error Handling

Always handle the case where the webhook call fails (network error, server error, etc.). We recommend:

1. **Log the failure** on your end with all order details so it can be reported manually
2. **Do not block the customer's order** — if the webhook fails, the customer already received their discount, so complete the order and report the redemption manually to the admin team

---

## Storing the API Key

Store the API key as an **environment variable** on your server. Never hardcode it in source code or expose it to the browser.

- Node.js: `process.env.CHRONIC_BRANDS_API_KEY`
- PHP: `getenv('CHRONIC_BRANDS_API_KEY')`
- Python: `os.environ['CHRONIC_BRANDS_API_KEY']`

Contact the Chronic Brands USA admin team to obtain your key.

---

## Questions or Missing Redemptions?

Contact the Chronic Brands USA admin team. All webhook redemptions appear in real time in the admin dashboard under **Promo Codes → Tracking**. Manual redemptions can also be logged there directly if needed.
