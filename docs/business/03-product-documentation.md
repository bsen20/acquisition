# 3. Product Documentation

## Features

### Feature 1: User Registration (`POST /api/auth/sign-up`)

**Purpose**: Create a new user account with secure credential storage.

**User Impact**: Allows new users to join the system. Sets a JWT cookie upon successful registration, establishing an authenticated session immediately.

**Technical Implementation**:

- Zod schema validates: name (2-255 chars), email (valid format, lowercased), password (6-128 chars), role (enum: 'user' | 'admin', default 'user')
- Duplicate email check prevents account duplication
- Password hashed with bcrypt (10 salt rounds)
- User inserted via Drizzle ORM with `RETURNING` clause
- JWT signed with user id, email, role (expires: 1 day)
- Token stored in httpOnly, secure (production), sameSite strict cookie (15 min maxAge)
- Winston logs success/failure events

### Feature 2: User Sign-In (`POST /api/auth/sign-in`)

**Purpose**: Authenticate existing users and establish a session.

**User Impact**: Returns user data and sets a session cookie.

**Technical Implementation**:

- Zod validates email and password
- Email lookup via Drizzle ORM
- bcrypt.compare for password verification
- Ambiguous error messages ("Invalid credentials") prevent user enumeration
- JWT cookie set with same security properties as registration

### Feature 3: User Sign-Out (`POST /api/auth/sign-out`)

**Purpose**: Terminate the current session.

**User Impact**: Clears the auth cookie, logging the user out.

**Technical Implementation**: Clears the JWT cookie using `res.clearCookie`.

### Feature 4: List All Users (`GET /api/users`)

**Purpose**: Retrieve all registered users (admin feature).

**User Impact**: Admins can view the user roster.

**Technical Implementation**:

- Requires valid JWT cookie (authentication)
- Uses Drizzle `select` with explicit field projection (excludes password hash)
- Returns count alongside users array

### Feature 5: Get User by ID (`GET /api/users/:id`)

**Purpose**: Retrieve a single user's details.

**User Impact**: View specific user profile.

**Technical Implementation**:

- ID validated as numeric string via Zod, transformed to positive integer
- 404 if user not found

### Feature 6: Update User (`PUT /api/users/:id`)

**Purpose**: Update user profile fields.

**User Impact**: Users can update their own profile. Admins can update any profile.

**Technical Implementation**:

- Authorization logic:
  - Must be authenticated
  - Non-admin users can only update their own profile (403 otherwise)
  - Non-admin users cannot change roles (role field stripped)
  - Only admins can set roles
- Duplicate email check on email change

### Feature 7: Delete User (`DELETE /api/users/:id`)

**Purpose**: Remove a user from the system.

**User Impact**: Only admins can delete users. Self-deletion is blocked.

**Technical Implementation**:

- Requires `requireRole(['admin'])` middleware
- Self-deletion explicitly blocked (403)
- User existence verified before deletion

### Feature 8: Security Middleware (Global)

**Purpose**: Protect every API route from attacks and abuse.

**User Impact**: Legitimate users experience rate limits. Bots are blocked.

**Technical Implementation**:

- Runs on every request via `app.use(securityMiddleware)`
- Arcjet Shield: Blocks common web attacks (SQL injection, XSS, etc.)
- Bot Detection: Blocks automated requests, allows search engines and preview crawlers
- Role-based Rate Limiting:
  - Admin: 20 requests per minute
  - User: 10 requests per minute
  - Guest (unauthenticated): 5 requests per minute

### Feature 9: Health Check (`GET /health`)

**Purpose**: Monitor application liveness.

**User Impact**: Used by Docker health checks and monitoring systems.

**Technical Implementation**: Returns `{ status: "OK", timestamp, uptime }` with 200 status.

### Feature 10: Structured Logging

**Purpose**: Centralized application logging for debugging and monitoring.

**User Impact**: Developers can trace errors and monitor usage.

**Technical Implementation**:

- Winston logger with JSON format
- Transports: `logs/error.lg` (error level only), `logs/combined.log` (all levels)
- Console transport in non-production environments with colorization
- Morgan HTTP request logs piped through Winston
- Service name metadata: 'acquisitions-api'

## Modules

| Module          | Files              | Responsibility                          |
| --------------- | ------------------ | --------------------------------------- |
| **Config**      | `src/config/`      | Database, logger, Arcjet initialization |
| **Controllers** | `src/controllers/` | Request handling, response formatting   |
| **Middleware**  | `src/middleware/`  | Auth verification, security checks      |
| **Models**      | `src/models/`      | Drizzle ORM schema definition           |
| **Routes**      | `src/routes/`      | HTTP route definitions                  |
| **Services**    | `src/services/`    | Business logic, database operations     |
| **Utils**       | `src/utils/`       | JWT, cookies, formatting helpers        |
| **Validations** | `src/validations/` | Zod schema definitions                  |

## Capabilities

- Full authentication lifecycle (register, login, logout)
- Role-based access control (admin/user)
- Secure cookie-based session management
- Input validation and sanitization
- Rate limiting per user role
- Bot traffic detection and blocking
- Structured logging with file persistence
- Containerized development and production environments
- Database migration management via Drizzle Kit
- CI/CD with automated testing, linting, and Docker builds
- Health monitoring endpoint

## Limitations

| Limitation                  | Impact                                     | Mitigation                          |
| --------------------------- | ------------------------------------------ | ----------------------------------- |
| **No email verification**   | Users can register with any email          | Add email verification flow         |
| **No password reset**       | Users cannot recover accounts              | Add forgot/reset password endpoints |
| **No refresh tokens**       | JWT expires in 1 day, no refresh mechanism | Implement refresh token rotation    |
| **No pagination**           | `GET /api/users` returns all users at once | Add cursor or offset pagination     |
| **No search/filter**        | No way to filter users by name/role/date   | Add query parameter support         |
| **No session invalidation** | No way to revoke tokens server-side        | Implement token blacklist           |
| **Single table**            | Only `users` table exists                  | Add more domain tables              |
| **No frontend**             | API-only, no UI                            | Build client application            |
| **Minimal test coverage**   | Only 3 basic health tests                  | Expand test coverage                |
| **Credentials in .env**     | `.env` is committed with real secrets      | Move to environment-specific files  |

## Future Extensibility Opportunities

1. **Multi-tenant support** — Add organization/workspace tables
2. **OAuth providers** — Google, GitHub, etc. login
3. **2FA/MFA** — Time-based one-time passwords
4. **API keys** — For programmatic access instead of cookies
5. **Webhook system** — Notify external services on user events
6. **Audit logging** — Track all admin actions
7. **Rate limit tiers** — Configurable per plan/tenant
8. **GraphQL API** — Alternative to REST
9. **Serverless deployment** — Deploy to AWS Lambda / Cloudflare Workers
10. **Kubernetes manifests** — Add K8s deployment files

## Source Files Evidence

| Feature         | Primary File                                                                     |
| --------------- | -------------------------------------------------------------------------------- |
| Registration    | `src/controllers/auth.controller.js:11-40`, `src/services/auth.service.js:26-42` |
| Sign-In         | `src/controllers/auth.controller.js:42-64`, `src/services/auth.service.js:44-60` |
| Sign-Out        | `src/controllers/auth.controller.js:66-75`                                       |
| List Users      | `src/controllers/users.controller.js:6-14`                                       |
| Get User        | `src/controllers/users.controller.js:16-30`                                      |
| Update User     | `src/controllers/users.controller.js:32-64`                                      |
| Delete User     | `src/controllers/users.controller.js:66-86`                                      |
| Security        | `src/middleware/security.middleware.js`                                          |
| Auth Middleware | `src/middleware/auth.middleware.js`                                              |
| Health Check    | `src/app.js:27-33`                                                               |
