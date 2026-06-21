# 22. Interview Preparation Guide

## 30 Second Explanation

> "Acquisitions is a production-ready REST API for user authentication built with Node.js, Express, and Neon PostgreSQL. It handles registration, login, JWT-based sessions with httpOnly cookies, role-based access control, and includes security features like rate limiting and bot detection via Arcjet — all containerized with Docker for easy deployment."

## 2 Minute Explanation

> "Acquisitions addresses the common need for a secure, reusable authentication and user management backend. Built with Express 5 and Node.js, it provides a complete auth lifecycle: registration with bcrypt password hashing, login with JWT token issuance stored in httpOnly cookies for XSS protection, and logout that clears the session.
>
> The database is Neon serverless PostgreSQL accessed through Drizzle ORM, giving us type-safe queries and easy migrations. For security, we use a defense-in-depth approach: Helmet for HTTP headers, CORS for origin control, and Arcjet for rate limiting, bot detection, and shield protection against common attacks — all configurable per user role.
>
> The whole system is containerized with Docker multi-stage builds, separating development (with hot-reload) from production (minimal image). CI/CD via GitHub Actions runs linting, tests, and builds multi-architecture Docker images for amd64 and arm64 on every push to main."

## 5 Minute Explanation

> "Acquisitions is a Node.js REST API that solves the foundational problem of user authentication and management. Let me walk through the architecture systematically.
>
> **Architecture**: It follows a layered MVC-inspired pattern: Routes map URLs to Controllers, which handle HTTP concerns. Controllers delegate to Services for business logic, and Services use Drizzle ORM to interact with the database. Middleware sits between the HTTP request and the route handlers for cross-cutting concerns like authentication and security.
>
> **Authentication Flow**: When a user signs up or signs in, we validate input with Zod schemas, hash passwords with bcrypt (10 rounds), store the user in Neon PostgreSQL, sign a JWT containing user id, email, and role, and set it as an httpOnly, SameSite=Strict, secure-in-production cookie. Subsequent requests read and verify this cookie before allowing access to protected routes.
>
> **Authorization**: We have two roles: 'user' and 'admin'. The auth middleware verifies JWT and sets `req.user`. The `requireRole` middleware checks allowed roles. In the controller, we enforce additional rules: users can only update their own profiles, can't change roles without admin privileges, and admins can delete users but not themselves.
>
> **Security**: Arcjet provides three protections: Shield (blocks SQL injection, XSS, etc.), bot detection (allows search engines, blocks scrapers), and sliding window rate limits (20/min admin, 10/min user, 5/min guest). Helmet sets security headers.
>
> **Docker & DevOps**: We use multi-stage Docker builds. The 'base' stage installs only production dependencies. 'development' adds dev dependencies and enables hot-reload via Node's `--watch` flag. 'production' is the minimal production image. Docker Compose orchestrates the app with Neon Local for development or Neon Cloud for production. GitHub Actions runs linting, tests, and builds multi-architecture images on push to main.
>
> **Key Tradeoffs**: We chose JWT over sessions for statelessness but lose the ability to revoke tokens. We chose Express over Fastify for ecosystem maturity. We chose Drizzle over Prisma for lighter weight. We chose Neon for serverless PostgreSQL with database branching. The tradeoffs are appropriate for the educational and reference nature of the project."

## 10 Minute Deep Dive

> **Business Context**: This project is part of the JavaScript Mastery educational ecosystem. It serves as a reference architecture demonstrating production-grade Node.js backend patterns. Teams can use it as a starter kit, saving 2-3 weeks of authentication setup.
>
> **Detailed Architecture**:
>
> _Startup Sequence_: `src/index.js` loads environment variables via dotenv, then imports `src/server.js`, which imports `src/app.js`. During import, all modules are initialized: Express app is created, middleware is registered in order (helmet, cors, JSON parser, URL-encoded parser, cookie-parser, morgan logging, Arcjet security), routes are mounted (auth at `/api/auth`, users at `/api/users`), and fallback 404 handler is added.
>
> _Request Lifecycle_: Every request goes through ~8 layers before reaching business logic. Let me trace a sign-in request: The request enters Express, passes through Helmet (headers), CORS (origin check), body parsers, cookie parser, Morgan (logging), then the Arcjet security middleware (bot detection, shield, rate limiting). After passing security, the route matches `/api/auth/sign-in`, which calls the auth controller. The controller validates input with Zod, calls the auth service, which queries the database by email, compares password with bcrypt, returns user data. The controller then signs a JWT, sets it as a cookie, and returns the JSON response. All of this is logged via Winston.
>
> _Security Architecture_: Defense in depth with 8 layers:
>
> 1. Helmet security headers
> 2. CORS origin policy
> 3. Arcjet Shield (attack detection)
> 4. Arcjet Bot Detection
> 5. Arcjet Rate Limiting (role-aware)
> 6. Zod Input Validation
> 7. JWT Authentication (httpOnly cookie)
> 8. Role-Based Authorization
>
> _Database Design_: Single `users` table with serial primary key, unique email constraint, bcrypt password hash, string role field, and automatic timestamps. This is intentionally simple for the auth-focused scope. Future expansion would add more domain tables.
>
> _Infrastructure_: Docker multi-stage builds using Node 18 Alpine base. Development environment includes Neon Local (ephemeral PostgreSQL proxy) with hot-reload via volume mounts. Production environment has resource limits (512MB memory, 0.5 CPU), health checks, and connects to Neon Cloud. CI/CD runs on GitHub Actions with three workflows: lint/format, tests, and Docker build/push (multi-architecture: amd64 + arm64).
>
> **Design Decisions Deep Dive**:
>
> _Why Express not Fastify?_: Express has the largest middleware ecosystem, more tutorials, and is the standard teaching framework for Node.js. The performance difference (~2x) is negligible at this scale.
>
> _Why JWT over Sessions?_: Stateless authentication means no Redis/server-side storage, easy horizontal scaling by adding more containers. The cost is no token revocation — if a JWT is compromised, it's valid until expiry.
>
> _Why httpOnly Cookies over Bearer Token?_: httpOnly prevents XSS token theft. SameSite=Strict prevents CSRF. The tradeoff is that only browser clients work natively — mobile apps would need a different auth header approach.
>
> _Why Neon?_: Serverless PostgreSQL with database branching enables ephemeral databases for development and testing. The pooling URL handles connection management. The tradeoff is cold start latency and vendor lock-in.
>
> _Why Drizzle over Prisma?_: Drizzle is lighter (no code generation), has a SQL-like API (thin abstraction), and integrates well with Neon serverless. Prisma's heavier abstraction and code generation add unnecessary overhead for this scope.
>
> **Production Concerns**:
>
> 1. `.env` is committed with real credentials — this is the most critical security issue. Must be removed and credentials rotated.
> 2. JWT secret has a hardcoded fallback — must be removed.
> 3. No pagination on user list — will break at scale.
> 4. Minimal test coverage — only 3 basic tests.
> 5. No graceful shutdown handling.
> 6. Logging to files without rotation — disk pressure in production.
> 7. CORS is permissive (allows all origins).
> 8. No connection pooling for Neon.
>
> **Interview Talking Points**:
>
> - Authentication architecture and JWT security
> - Defense-in-depth security strategy
> - Docker multi-stage build optimization
> - Role-based access control design
> - Serverless database integration
> - CI/CD pipeline design
> - Key tradeoffs and why decisions were made
