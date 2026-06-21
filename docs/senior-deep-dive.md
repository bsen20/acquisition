# 21. Senior Engineer Deep Dive

## Hidden Complexities

### 1. JWT Cookie Security — The Complete Picture

The JWT cookie implementation involves several non-obvious security considerations:

**Cookie Attributes**:

```javascript
// src/utils/cookies.js
httpOnly: true,           // Prevents XSS theft
secure: true,             // TLS-only in production
sameSite: 'strict',       // Prevents CSRF
maxAge: 15 * 60 * 1000,   // 15 minutes
```

**Tradeoff**: `sameSite: 'strict'` means the cookie is NOT sent on initial cross-site navigation. If a user clicks a link from another site to your app, they arrive unauthenticated. This is acceptable for API consumption but could degrade UX for browser-based applications.

**Missing**: No `__Host-` prefix for cookie, no `domain` attribute restriction.

**JWT Payload Structure**:

```javascript
// src/controllers/auth.controller.js:18
const token = jwttoken.sign({
  id: user.id,
  email: user.email,
  role: user.role,
});
```

The JWT contains `id`, `email`, and `role`. Notably, it does NOT contain:

- `iat` (issued at) — automatically added by jsonwebtoken
- `sub` (subject) — should be the user ID
- `jti` (JWT ID) — for token revocation
- `aud` (audience) — for audience restriction
- `iss` (issuer) — for issuer verification

### 2. Arcjet Middleware — Performance and Architecture Considerations

The Arcjet middleware is applied **globally** via `app.use(securityMiddleware)`. This means:

- EVERY request goes through an external API call to Arcjet
- The rate limit check happens before authentication
- Role-based rate limiting requires `req.user` — but for guests, it defaults to 'guest'

```javascript
// src/middleware/security.middleware.js:6
const role = req.user?.role || 'guest';
```

**Issue**: In Express middleware order, the security middleware runs BEFORE auth middleware. So `req.user` is never set at this point. All unauthenticated traffic is treated as 'guest'. Authenticated traffic still passes through this middleware first (before auth check), meaning rate limits are based on cookies that haven't been verified yet.

**Corrected understanding**: The Arcjet rate limit applies to the IP level primarily. Role-based differentiation only works if the cookie was set from a previous request. This is a subtle race condition in the architecture.

### 3. Error Message-Based Flow Control

The codebase uses string matching on `e.message` for flow control:

```javascript
// src/controllers/auth.controller.js:28-30
if (e.message === 'User with this email already exists') {
  return res.status(409).json({ error: 'Email already exist' });
}
```

This is brittle because:

- If the error message changes in the service, controllers break
- TypeScript cannot catch string mismatches
- No error hierarchy or error codes

**Better approach**: Custom Error classes or error codes.

```javascript
class DuplicateEmailError extends Error {
  constructor() {
    super('Email already exists');
    this.code = 'DUPLICATE_EMAIL';
    this.status = 409;
  }
}
```

### 4. Import Maps and Testing Implications

The `#` import aliases require Node.js ESM support. This creates a subtlety with Jest:

```bash
npm test: NODE_OPTIONS=--experimental-vm-modules jest
```

The `--experimental-vm-modules` flag is required for Jest to resolve the `#` imports. Without it, tests fail with "Cannot find module '#config/logger.js'". This is a common gotcha during onboarding.

### 5. Neon Local Architecture

The development setup uses Neon Local (an ephemeral PostgreSQL proxy). This is NOT a full PostgreSQL instance — it's a proxy that emulates Neon's branching and serverless features locally.

```yaml
# docker-compose.dev.yml
neon-local:
  image: neondatabase/neon_local:latest
```

**Implication**: Local behavior may differ from Neon Cloud in production. Schema features unique to Neon (like `neon_*` functions) may not work in local but won't be noticed until deployment.

## Non-Obvious Design Choices

### 1. Why No Password Reset?

The project intentionally omits password reset functionality. This is either:

- An architectural decision to keep the scope focused on core auth
- A feature left for future implementation

Given the educational context, it's likely the latter. In production, password reset is critical.

### 2. Why Admin Role During Registration?

The signup schema allows setting `role: 'admin'`:

```javascript
// src/validations/auth.validation.js:7
role: z.enum(['user', 'admin']).default('user'),
```

This means anyone can register as an admin by sending `role: 'admin'`. In a real system, admin registration would be restricted.

**Interview talking point**: This is acceptable for a demo/educational project but would need a separate admin provisioning flow in production (invite-only, approval workflow, or first-admin-seed).

### 3. Why No Refresh Tokens?

JWT tokens expire in 1 day with no refresh mechanism. This means:

- Users must re-authenticate every day
- No way to extend sessions without re-login
- No way to revoke access mid-session

**Tradeoff**: Simplicity over UX. A refresh token flow would require additional endpoints, storage (for refresh tokens), and security considerations (rotation, theft detection).

## Architectural Tradeoffs

| Tradeoff                        | Decision              | Cost                              | Benefit                                       |
| ------------------------------- | --------------------- | --------------------------------- | --------------------------------------------- |
| Single process vs microservices | Single Express server | Limited scalability               | Simple deployment, no orchestration needed    |
| Stateless JWT vs sessions       | JWT                   | No revocation, 1-day expiry       | No server-side state, easy horizontal scaling |
| File logging vs centralized     | Winston to files      | No log aggregation, disk pressure | Simple setup, no external dependency          |
| Global Arcjet vs per-route      | Global (app.use)      | Every request hits Arcjet         | Simple configuration, consistent protection   |
| No TypeScript                   | JavaScript            | No static types, runtime errors   | Faster development, lower barrier to entry    |

## Production Concerns

### 1. Database Connection Management

The current Neon connection:

```javascript
const sql = neon(process.env.DATABASE_URL);
```

Creates a single connection client. In production, this should use Neon's pooled connection string (`-pooler` suffix) and consider connection pooling for high concurrency.

### 2. Logging Volume

Winston writes every log to `logs/combined.log` without rotation. In production:

- Log files could grow unbounded (disk pressure)
- No log retention policy
- No log shipping (ELK, Loki, etc.)

### 3. Graceful Shutdown

The server does not handle `SIGTERM`/`SIGINT` for graceful shutdown. When Docker sends `SIGTERM`:

- In-flight requests are abruptly terminated
- Database connections are not closed cleanly
- Log buffers may not flush

### 4. Security Hardening for Production

- Add rate limiting specifically for auth endpoints (stricter than general)
- Implement account lockout after N failed attempts
- Add CAPTCHA/reCAPTCHA for registration
- Add email verification flow
- Add password strength requirements beyond minimum length
- Configure HTTPS termination (reverse proxy: Nginx, Caddy, or cloud LB)

## Source Files Evidence

| Topic                     | File                                    | Line(s)                                           |
| ------------------------- | --------------------------------------- | ------------------------------------------------- |
| Cookie config             | `src/utils/cookies.js`                  | 3-7                                               |
| JWT sign                  | `src/utils/jwt.js`                      | 8-11                                              |
| Security middleware order | `src/app.js`                            | 15 (security) vs 13 (cookie parser before routes) |
| Rate limit role default   | `src/middleware/security.middleware.js` | 6                                                 |
| Error string matching     | `src/controllers/auth.controller.js`    | 28, 57                                            |
| Admin role in signup      | `src/validations/auth.validation.js`    | 7                                                 |
| Graceful shutdown missing | `src/server.js`                         | No signal handlers                                |
| Neon connection           | `src/config/database.js`                | 11                                                |
