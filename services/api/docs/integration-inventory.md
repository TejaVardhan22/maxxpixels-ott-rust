# External Integration Inventory & Protocols

**Document Version:** 1.0.0  
**Target Environment:** Production OTT Platform  
**Target Architecture:** Rust (reqwest + rdkafka + redis)  
**Audit Date:** November 2026  

---

## 1. Razorpay Payment Gateway

| Property | Production Configuration |
|---|---|
| **API Base URL** | `https://api.razorpay.com/v1` |
| **Auth Mechanism** | HTTP Basic Auth (`RAZORPAY_KEY_ID : RAZORPAY_KEY_SECRET`) |
| **Webhook Header** | `X-Razorpay-Signature` |
| **Signature Algorithm** | HMAC-SHA256 (`request_raw_body`, `RAZORPAY_WEBHOOK_SECRET`) |

### Integration Touchpoints
1. `POST /v1/orders`: Initiates payment session with currency `INR`, receipt ID, and auto-capture flag.
2. Webhook Event Ingestion: Listens for `payment.captured`, `order.paid`, and `refund.processed`.
3. Refunds API: `POST /v1/payments/{payment_id}/refund` for subscription cancellations.

---

## 2. Bunny.net Stream (Video Encoding, Transcoding & Delivery)

| Property | Production Configuration |
|---|---|
| **Stream Library ID** | `676868` (`BUNNY_STREAM_LIBRARY_ID`) |
| **API Base URL** | `https://video.bunnycdn.com/library/676868` |
| **Stream API Key** | `BUNNY_STREAM_API_KEY` |
| **CDN Hostname** | `vz-bb76d46f-94f.b-cdn.net` (`BUNNY_STREAM_CDN_HOSTNAME`) |
| **Token Auth Security Key** | `BUNNY_STREAM_TOKEN_AUTH_KEY` |

### Playback Token Algorithm
To prevent hotlinking and piracy, all HLS playback URLs are dynamically signed:
$$\text{token} = \text{SHA256}(\text{TokenAuthKey} + \text{videoGuid} + \text{expiresTimestamp})$$
Generated stream URL structure:
`https://vz-bb76d46f-94f.b-cdn.net/{videoGuid}/playlist.m3u8?token={token}&expires={expiresTimestamp}`

---

## 3. Bunny.net Edge Storage Zone (Images & Static Assets)

| Property | Production Configuration |
|---|---|
| **Storage Zone Name** | `maxxpixels-images` (`BUNNY_STORAGE_ZONE_NAME`) |
| **Storage Endpoint** | `https://storage.bunnycdn.com/maxxpixels-images/` |
| **Storage Region** | `de` (`BUNNY_STORAGE_REGION`) |
| **Public Pull Zone CDN** | `https://maxxpixels-images.b-cdn.net` (`BUNNY_PULL_ZONE_DOMAIN`) |

### Folder Organization
- `/posters/`: 3:4 portrait thumbnail images.
- `/banners/`: 16:9 landscape backdrop hero images.
- `/avatars/`: User and actor profile avatars.
- `/producers/`: KYC documents (PAN, Aadhar, GST receipts).

---

## 4. MSG91 SMS & OTP Provider

| Property | Production Configuration |
|---|---|
| **Auth Key** | `MSG91_AUTH_KEY` |
| **Template ID** | `MSG91_TEMPLATE_ID` (`6a981ea2...`) |
| **API URL** | `https://api.msg91.com/api/v5/otp` |

Dispatches 6-digit one-time passwords for instant login and registration across India (+91) with zero SMS delay.

---

## 5. Google Ad Manager & InMobi (Video Ads / VAST)

| Property | Production Configuration |
|---|---|
| **GAM Network Code** | `21775744923` |
| **Ad Server Tag** | `https://pubads.g.doubleclick.net/gampad/ads` |
| **Protocol Support** | VAST 4.2 / VMAP 1.0 (Pre-roll, Mid-roll, Post-roll) |
| **Open Bidding** | InMobi SDK adapter enabled |
| **Google AdMob (Mobile App)** | App ID `ca-app-pub-2191993313473081~5839116549` |

---

## 6. Apache Kafka Event Streaming

| Topic Name | Purpose | Partition Key | Serialization |
|---|---|---|---|
| `ott.telemetry.heartbeat` | Live concurrent playback heartbeats | `userId` | JSON |
| `ott.content.views` | Aggregated view count increments | `contentId` | JSON |
| `ott.notifications.dispatch` | Push/SMS asynchronous dispatch queues | `notificationId`| JSON |
| `ott.payments.razorpay` | Payment capture & webhook notifications| `orderId` | JSON |
| `ott.watch.history` | Batch watch progress sync | `userId` | JSON |
| `ott.subscriptions.events` | Plan renewal & expiration alerts | `subscriptionId`| JSON |

