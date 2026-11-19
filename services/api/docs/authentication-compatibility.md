# Authentication Compatibility & Security Specification

**Document Version:** 1.0.0  
**Target Environment:** Production OTT Platform  
**Target Architecture:** Rust (Axum + jsonwebtoken + argon2 + bcrypt)  
**Audit Date:** November 2026  

---

## 1. Authentication Interoperability Contract

To prevent logging out active users, breaking Flutter apps, or invalidating stored tokens, the Rust backend implements 100% wire-compatible authentication protocols.

---

## 2. JWT Access Token Claims Schema

Tokens issued by both NestJS and Rust adhere strictly to the following schema:

```json
{
  "sub": "220",
  "email": "user@example.com",
  "phone": "+919988776655",
  "fullName": "Cinema Viewer",
  "roles": ["ROLE_USER", "USER"],
  "permissions": ["CONTENT_VIEW", "CONTENT_STREAM"],
  "deviceId": "d4a8e2b1-5c8e-4a92-a1f9-91f8c1482a01",
  "iat": 1731456000,
  "exp": 1731542400,
  "iss": "maxxpixels.com"
}
```

### Claim Processing Rules
1. **`sub`**: User primary key identifier (string-formatted numeric integer matching `users.id`).
2. **`roles`**: Array of roles. Client code may check for either `ROLE_ADMIN` or `ADMIN`. The token generator emits both normalized variants for complete backward compatibility.
3. **`exp`**: Access token TTL is 24 hours (86,400 seconds).

---

## 3. Password Verification & Upgrading Engine

```
                          [User submits password]
                                     │
                                     ▼
                    Fetch `password_hash` from `users`
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
       Prefix starts with `$2a$` / `$2y$`     Prefix starts with `$argon2`
                     │                               │
                     ▼                               ▼
        Verify with `bcrypt::verify`     Verify with `argon2::verify`
                     │                               │
                     ├──────────────┬────────────────┘
                     ▼              ▼
                 [Invalid]      [Valid]
                     │              │
                     ▼              ▼
           401 Unauthorized   Login Success!
                                    │
                                    ▼
                         Is hash format legacy bcrypt?
                         ├── NO  ──> Proceed to token generation
                         └── YES ──> Compute `argon2id` hash asynchronously
                                     Update `users.password_hash` in DB
```

---

## 4. Redis Token Revocation & Session Blacklisting

- **Blacklist Key**: `jwt:blacklist:<tokenSignature>`
  - Where `tokenSignature` is the 3rd component of the JWT string (`token.split('.')[2]`).
  - TTL: Remaining token lifetime (up to 86,400 seconds).
- **Logout Action**: Calling `POST /api/v1/auth/logout` extracts the signature and writes the blacklist key to Redis.
- **Revocation Check**: The Axum authentication middleware verifies token existence in Redis before parsing claims.

---

## 5. Refresh Token Lifecycle & Rotation

1. When logging in, an access token (24h) and refresh token (30 days) are generated.
2. The refresh token UUID hash is persisted to the `refresh_tokens` table:
   ```sql
   INSERT INTO refresh_tokens (user_id, token_hash, device_id, expires_at, revoked, created_at)
   VALUES ($1, $2, $3, NOW() + INTERVAL '30 days', false, NOW());
   ```
3. When `/api/v1/auth/refresh` is called:
   - Validates that the token exists in `refresh_tokens` and `revoked = false` and `expires_at > NOW()`.
   - Rotates the token: marks the old token as `revoked = true` and generates a brand-new token pair.

---

## 6. Phone OTP Verification (MSG91)

- **Generation Endpoint**: `POST /api/v1/auth/otp/send`
- **Storage**: Redis key `otp:<phone_number>`
  - Payload: `{ "otp": "654321", "attempts": 0 }`
  - TTL: 300 seconds (5 minutes).
- **Verification**: `POST /api/v1/auth/otp/verify`
  - Allows 5 attempts before invalidating the key.
  - Automatically provisions new viewer account if first-time sign-in.
  - Bypasses OTP during automated test suites if `ALLOW_FIXED_TEST_OTP=true` and input matches `123456`.

