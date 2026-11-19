# Migration Risk Assessment & Mitigation Matrix

**Document Version:** 1.0.0  
**Target Environment:** Production OTT Platform  
**Audit Date:** November 2026  

---

## 1. Risk Categorization & Assessment

| Risk ID | Category | Description | Severity | Probability | Mitigation Strategy |
|---|---|---|---|---|---|
| **R-01** | **Financial** | Dual-write payment processing or webhook race condition causing duplicate subscriptions or failed Razorpay callbacks. | **CRITICAL** | Medium | Single-writer principle. Only one backend (NestJS or Rust) processes mutating payment webhooks. Shared Redis distributed lock (`lock:payment:order:<id>`) enforces idempotency across both runtimes. |
| **R-02** | **Client Contract** | JSON field case mismatch (`snake_case` vs `camelCase`) breaking Flutter Android/TV or Next.js state parsers. | **HIGH** | Medium | Rigorous Serde `#[serde(rename_all = "camelCase")]` directives on all DTOs. Automated contract test runner executing golden-file JSON parity checks between port 8080 (NestJS) and port 8081 (Rust). |
| **R-03** | **Client Contract** | Missing `result` key alongside `data` in response wrapper breaking legacy mobile client models. | **HIGH** | Low | `ApiResponse<T>` struct in Rust explicitly serializes both `data: T` and `result: T` identically to NestJS `api-response.interceptor.ts`. |
| **R-04** | **Security** | Password hash verification divergence locking out users whose passwords were encrypted via Node.js `bcryptjs`. | **HIGH** | Low | Multi-algorithm password verification pipeline: checks hash prefix (`$2a$`, `$2y$`, `$argon2id$`) and dispatches to appropriate cryptographic engine with zero user disruption. |
| **R-05** | **Security** | Token revocation desync: user logs out on one backend, but token remains valid on the other. | **HIGH** | Low | Both NestJS and Rust query the exact same Redis blacklist key format (`jwt:blacklist:<sig>`). Blacklisting on either node immediately revokes access globally. |
| **R-06** | **Database** | Database locking or deadlock anomalies caused by different query plans or unindexed joins between SeaORM and TypeORM. | **MEDIUM** | Medium | SeaORM queries mirror existing TypeORM index structures. Rust connection pool is strictly bounded (`max_connections = 25`) to prevent exhausting PostgreSQL `max_connections`. |
| **R-07** | **Streaming** | Bunny.net token authentication mismatch generating invalid HLS signed URLs, resulting in 403 Forbidden playback errors. | **HIGH** | Low | SHA256 token generation logic tested against Bunny Stream API specifications with exact matching timestamps and URL encoding. |
| **R-08** | **Infrastructure**| Kafka consumer group partition rebalance thrashing if both NestJS and Rust join the same consumer group simultaneously. | **MEDIUM** | High | Rust workers will utilize a separate consumer group (`maxx-ott-group-rust-shadow`) during staging/shadow runs, switching to production group only when write ownership is formally handed over. |

---

## 2. Abort & Immediate Rollback Protocol

If any of the following triggers occur during shadow or traffic-shifting stages, automated routing immediately fails over 100% of traffic back to the NestJS backend:

1. **HTTP 5xx Error Rate Trigger**: 5xx responses from the Rust backend exceed 0.05% of requests over a 2-minute rolling window.
2. **P99 Latency Regression**: Rust P99 latency exceeds 250ms (or exceeds NestJS Fastify baseline).
3. **Payment Signature Verification Mismatch**: Any single webhook signature verification error caused by cryptographic discrepancy.
4. **Database Connection Saturation**: Total active database connections exceed 75% of the PostgreSQL server threshold.

---

## 3. Data Integrity & Single-Writer Rule

```
Rule of Thumb:
- Read operations may be distributed across both runtimes.
- Write operations (especially financial ledgers, subscription provisioning, and user registration)
  MUST HAVE STRICTLY ONE AUTHORITATIVE WRITER at any given point in time.
```

