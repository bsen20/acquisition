# 23. Interview Questions and Answers

## Business Questions

### Q: What business problem does this project solve?

**Strong Answer**: It solves the recurring engineering challenge of building a secure authentication and user management system from scratch. Every web application needs user registration, login, session management, and access control. This project provides a production-ready reference implementation that saves teams 2-3 weeks of development time.

**Follow-up**: What specific user needs does it address?

- Secure account creation and login
- Role-based access to features
- Protection against common attacks (bots, rate limiting, injection)
- Easy deployment with Docker

**Deep Follow-up**: How would you measure the business value of this project?

- Development time saved vs building from scratch
- Security incidents prevented vs a naive implementation
- Deployment frequency enabled by CI/CD and Docker

---

## Architecture Questions

### Q: Describe the architecture pattern used.

**Strong Answer**: The project follows a Layered Architecture with MVC conventions. Layers are:

1. **Presentation** (Routes + Controllers) — Handle HTTP concerns
2. **Application** (Middleware + Validation) — Cross-cutting security/auth
3. **Domain** (Services + Models) — Business logic and database schema
4. **Infrastructure** (Config + Utils) — External services and helpers
5. **Data** (Drizzle ORM + Neon DB) — Persistent storage

**Follow-up**: Why not use Clean Architecture or Hexagonal Architecture?
For this scope (focused auth API), the added abstraction layers of Clean/Hexagonal architecture would introduce accidental complexity without proportional benefit. The current architecture provides clear separation of concerns while keeping the codebase simple and maintainable.

**Deep Follow-up**: What would need to change to make this Clean Architecture?
You would need to: define domain entities separate from ORM models, create repository interfaces, implement dependency injection, add use case/interactor classes, and ensure domain layer has zero external dependencies.

---

## Design Questions

### Q: How does authentication work?

**Strong Answer**: Authentication is JWT-based with httpOnly cookies. On signup or signin, the server validates credentials, hashes/compares passwords with bcrypt, signs a JWT containing user id, email, and role, and sets it as a cookie with `httpOnly: true`, `sameSite: 'strict'`, and `secure: true` in production. On subsequent protected requests, the auth middleware reads the cookie, verifies the JWT, and sets `req.user` for downstream use.

**Follow-up**: Why httpOnly cookies over localStorage?
httpOnly cookies are not accessible via JavaScript, making them immune to XSS attacks. localStorage is readable by any JavaScript on the page, so a single XSS vulnerability compromises all tokens.

**Deep Follow-up**: How would you handle token revocation?
Since JWTs are stateless, you'd need either: a token blacklist (Redis), short expiry + refresh tokens, or switch to session-based auth. The blacklist approach checks every request against a deny list; refresh tokens allow re-authentication without credentials while maintaining revocation capability.

---

## Database Questions

### Q: Why a single users table?

**Strong Answer**: The project is focused on authentication and user management. A single users table is appropriate because:

- The only domain entity is User
- Auth systems don't need complex relationships
- It keeps the schema simple and fast
- Scaling is handled by index on email and primary key

**Follow-up**: When would you add more tables?
When new features require additional entities: organizations/tenants (multi-tenant), roles/permissions (fine-grained ACL), sessions (token blacklist), audit logs, profiles.

**Deep Follow-up**: How would you handle database scaling at 10M users?
Strategies: (1) Add read replicas for query scaling, (2) Partition by date range for time-series data, (3) Shard by user ID for write scaling, (4) Use Neon's built-in connection pooling, (5) Add Redis caching for hot data.

---

## Infrastructure Questions

### Q: Explain the Docker strategy.

**Strong Answer**: Multi-stage Docker builds with three stages: `base` installs production dependencies only, creates a non-root user, and sets up health checks. `development` extends base with all dependencies and hot-reload. `production` extends base with production entrypoint. This keeps production images small (~150MB vs ~500MB for full dev), reduces attack surface, and ensures consistent environments.

**Follow-up**: Why multi-stage?
Smaller images (faster deploys, less storage), no dev tools in production (smaller attack surface), shared base layer (efficient caching), clear separation of dev/prod concerns.

**Deep Follow-up**: How would you deploy to Kubernetes?
Needed changes: (1) Create Kubernetes manifests (Deployment, Service, Ingress, ConfigMap, Secret), (2) Add liveness/readiness probes (already have health check), (3) Configure horizontal pod autoscaler, (4) Use kustomize or Helm for environment-specific configs, (5) Add persistent volume for logs.

---

## Security Questions

### Q: What security vulnerabilities exist in this project?

**Strong Answer**: Critical issues: (1) `.env` committed with real database credentials and API keys, (2) Hardcoded JWT secret fallback in code, (3) CORS allows all origins (no configuration). High issues: (4) No input sanitization beyond type checking, (5) No email verification, (6) Permissive rate limiting on auth endpoints (brute force protection is weak).

**Follow-up**: How would you fix these?

1. Remove `.env` from git, rotate all credentials, add `.env.example`
2. Remove JWT fallback; crash at startup if JWT_SECRET not set
3. Configure CORS with explicit allowed origins
4. Add Zod transforms for sanitization
5. Implement email verification flow
6. Add stricter rate limits for auth endpoints, account lockout

---

## Performance Questions

### Q: What are the performance bottlenecks?

**Strong Answer**: (1) bcrypt password hashing (10 rounds) adds ~300ms per signup/signin — this is intentional security but blocks the event loop. (2) No pagination on user list endpoint — O(n) performance. (3) Single database connection — no pooling. (4) Winston file logging — synchronous I/O on every log. (5) No caching layer — every request hits the database.

**Follow-up**: How would you address the bcrypt bottleneck?
Options: (1) Use worker threads for bcrypt operations (offload CPU work), (2) Reduce salt rounds (10 is already a configurable tradeoff), (3) Move bcrypt to a separate service. Worker threads are the best approach — they allow non-blocking password verification while maintaining security.

---

## DevOps Questions

### Q: Describe the CI/CD pipeline.

**Strong Answer**: Three GitHub Actions workflows: (1) Lint & Format — runs ESLint and Prettier on push/PR to main/staging, (2) Tests — runs Jest with coverage on push/PR, (3) Docker Build & Push — on push to main or manual dispatch, builds multi-architecture images (amd64 + arm64) and pushes to Docker Hub with tags: branch, SHA, latest, and timestamp.

**Follow-up**: What's missing from the pipeline?
Production concerns: (1) No deployment step (just builds images), (2) No integration tests against real database, (3) No security scanning (trivy, snyk), (4) No dependency audit, (5) No automated rollback, (6) No canary/blue-green deployment.

---

## Scaling Questions

### Q: How does this system scale?

**Strong Answer**: The stateless JWT architecture and containerization make horizontal scaling straightforward — add more Docker containers behind a load balancer. The database is the bottleneck: single Neon PostgreSQL instance. Scaling strategies: (1) Read replicas for query-heavy workloads, (2) Connection pooling for concurrent connections, (3) Add Redis cache for hot data, (4) For extreme scale, shard the users table.

**Follow-up**: What breaks first at scale?
(1) User list endpoint returns all users (no pagination), (2) Single Node.js process hits CPU/memory limits, (3) Database becomes connection-constrained, (4) Logging overwhelms disk I/O.

---

## Code Questions

### Q: Walk me through the sign-in flow.

**Strong Answer**:

1. `POST /api/auth/sign-in` hits Express route
2. Security middleware runs: Arcjet checks bot, shield, rate limit
3. Route matches `auth.routes.js` POST handler
4. `auth.controller.js` `signIn` function:
5. Zod validates `{email, password}` against `signInSchema`
6. `auth.service.js` `authenticateUser({email, password})`:
   - Drizzle queries users by email
   - bcrypt.compare verifies password
   - Returns user (without password)
7. Controller signs JWT: `{id, email, role}`, 1-day expiry
8. Controller sets httpOnly cookie with token
9. Returns 200 JSON with user data

**Key code**:

```javascript
// src/controllers/auth.controller.js:42-63
const user = await authenticateUser({ email, password });
const token = jwttoken.sign({
  id: user.id,
  email: user.email,
  role: user.role,
});
cookies.set(res, 'token', token);
res.status(200).json({ message: 'User signed in successfully', user });
```

---

## Testing Questions

### Q: Assess the test coverage.

**Strong Answer**: Currently inadequate. Only 3 integration tests exist covering `GET /health`, `GET /api`, and 404 handling. Zero tests for: authentication flows (signup, signin, signout), user CRUD operations, middleware (auth, security), validation (edge cases), error paths, or database interactions. The test setup is good (supertest + Jest), but execution is minimal.

**Follow-up**: What's your priority testing plan?
P1: Auth integration tests (signup success, duplicate email, signin success, wrong password, signout). P2: User CRUD with auth. P3: Auth middleware (no token, invalid token, role check). P4: Validation edge cases. P5: Security middleware behavior.

---

## Production Incident Questions

### Q: The app is returning 500 errors for all requests. Walk through your debugging process.

**Strong Answer**:

1. **Check health**: `GET /health` — if it passes, the issue is in application logic; if it fails, the server is down.
2. **Check logs**: `tail -100 logs/combined.log` and `logs/error.lg` for error patterns.
3. **Check container**: `docker ps` (is it running?), `docker logs acquisitions-app-prod` (any crash?).
4. **Check resource usage**: `docker stats` (OOM? CPU spike?).
5. **Check database**: Is Neon reachable? Try `psql "$DATABASE_URL" -c "SELECT 1"`.
6. **Check recent deployments**: `git log --oneline -5` — any recent changes?
7. **Check environment variables**: Any config changes? JWT_SECRET changed? DATABASE_URL rotated?

If database is down: restart or failover. If code regression: rollback deployment. If OOM: increase resources or fix memory leak.

---

## Interview Traps to Avoid

| Trap                               | Why It's a Trap                           | Better Answer                                     |
| ---------------------------------- | ----------------------------------------- | ------------------------------------------------- |
| "It's perfect"                     | No system is perfect                      | Acknowledge tradeoffs and technical debt          |
| "JWT is more secure than sessions" | Both have different threat models         | Compare XSS vs CSRF tradeoffs accurately          |
| "We should use TypeScript"         | Only if it provides value for the project | Discuss pros/cons in context of the project scope |
| "Rate limiting is too aggressive"  | It's configurable                         | Explain the per-role design philosophy            |
| "The .env issue isn't a big deal"  | It's a critical security vulnerability    | Call it out as the #1 thing to fix                |
