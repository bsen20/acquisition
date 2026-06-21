# 17. Architecture Decision Records (ADR)

## ADR-001: Use Express 5 instead of Fastify or NestJS

**Decision**: Use Express 5 as the HTTP framework.

**Context**: Choosing a web framework for the REST API backend.

**Benefits**:
- Largest ecosystem and community in Node.js
- Massive middleware library (Helmet, CORS, Morgan, etc.)
- Simple, unopinionated API
- Version 5 includes improved error handling
- Team familiarity (JavaScript Mastery community)

**Drawbacks**:
- Less performant than Fastify (though sufficient for this scale)
- Less structured than NestJS (no built-in DI, modules, guards)
- Callback-based error handling can be verbose

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|-------------|
| **Fastify** | Faster but smaller ecosystem, different plugin model |
| **NestJS** | Too opinionated for a simple API, steeper learning curve |
| **Hono** | Newer, smaller ecosystem |

**Evidence**: `package.json` — `"express": "^5.1.0"`, `src/app.js` — `import express from 'express'`

---

## ADR-002: Use Neon Serverless PostgreSQL over traditional PostgreSQL

**Decision**: Use Neon Serverless PostgreSQL as the database.

**Context**: Choosing a database provider with serverless capabilities.

**Benefits**:
- Database branching for development/testing
- Serverless scaling (pay-per-use, auto-scaling)
- Full PostgreSQL compatibility
- Connection pooling via pooler URL
- Ephemeral database branches in CI/CD

**Drawbacks**:
- Cold starts (1-5 seconds on first query)
- Network latency compared to local database
- Vendor lock-in (Neon-specific features)
- Free tier limitations

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|-------------|
| **Supabase** | More features but heavier vendor lock-in |
| **AWS RDS** | Not serverless, requires more management |
| **PlanetScale** | MySQL-based (not PostgreSQL) |
| **SQLite** | Not suitable for production multi-user |

**Evidence**: `src/config/database.js`, `docker-compose.dev.yml` (Neon Local proxy), `DOCKER_SETUP.md`

---

## ADR-003: Use Drizzle ORM over Prisma or TypeORM

**Decision**: Use Drizzle ORM for database access.

**Context**: Choosing an ORM for PostgreSQL interaction.

**Benefits**:
- Lightweight, no code generation
- SQL-like API (thin abstraction over SQL)
- Fast Drizzle Kit for migrations
- Type-safe queries
- Serverless-friendly (works with @neondatabase/serverless)

**Drawbacks**:
- Smaller community than Prisma
- Less mature (fewer tutorials, examples)
- Manual migration management (no schema push like Prisma)

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|-------------|
| **Prisma** | Heavy code generation, larger bundle, slower startup |
| **TypeORM** | More complex API, historical stability issues |
| **Knex** | Lower-level query builder, more boilerplate |
| **Raw SQL** | No ORM benefits, more error-prone |

**Evidence**: `package.json` — `"drizzle-orm": "^0.44.5"`, `src/config/database.js`, `src/models/user.model.js`

---

## ADR-004: Use Arcjet instead of express-rate-limit + custom bot detection

**Decision**: Use Arcjet for security (rate limiting, bot detection, shield).

**Context**: Need to protect the API from abuse, bots, and common attacks.

**Benefits**:
- Single integration for multiple security features
- Cloud-managed rule updates
- Role-aware rate limiting
- Bot detection with allow-listing
- Shield protection against common web attacks

**Drawbacks**:
- External API dependency (adds latency)
- Beta software (v1.0.0-beta.11)
- Cost at scale (free tier may not suffice)
- Not self-hosted (data sent to Arcjet cloud)

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|-------------|
| **express-rate-limit** | Rate limiting only, no bot detection |
| **Cloudflare** | Need DNS proxy, different architecture |
| **Custom middleware** | More development effort, less sophisticated |
| **AWS WAF** | Platform-specific, complex setup |

**Evidence**: `src/config/arcjet.js`, `src/middleware/security.middleware.js`, `package.json`

---

## ADR-005: Use JWT over session-based authentication

**Decision**: Use JWT (JSON Web Tokens) for authentication.

**Context**: Need a stateless authentication mechanism.

**Benefits**:
- No server-side session storage (stateless)
- Compact token format (URL-safe)
- Can include user claims (id, email, role)
- Widely supported across platforms
- Works well with API clients (not just browsers)

**Drawbacks**:
- Cannot revoke tokens server-side (until expiry)
- Token size grows with claims
- Secret management is critical
- No built-in refresh mechanism

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|-------------|
| **Session cookies + Redis** | Requires Redis infrastructure, stateful |
| **PASETO** | Less widely adopted, smaller ecosystem |
| **OAuth2 + OIDC** | Overkill for a simple auth API |
| **API keys** | Less secure for user-facing auth |

**Evidence**: `src/utils/jwt.js`, `src/middleware/auth.middleware.js`, `src/utils/cookies.js`

---

## ADR-006: Use httpOnly cookies over Authorization header

**Decision**: Store JWT in httpOnly cookies instead of Authorization Bearer header.

**Context**: Choosing where to store the JWT token on the client.

**Benefits**:
- httpOnly prevents XSS token theft
- SameSite=Strict prevents CSRF
- Cookie is automatically sent by browser
- No client-side JavaScript token management needed

**Drawbacks**:
- Only works for browser clients (mobile apps need header-based auth)
- Limited to same-origin or specific cross-origin config
- Cookie size limits

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|-------------|
| **Authorization: Bearer header** | Requires client JS to store and send token, XSS-vulnerable |
| **localStorage** | XSS-vulnerable, no CSRF protection |
| **sessionStorage** | XSS-vulnerable, lost on tab close |

**Evidence**: `src/utils/cookies.js`, `src/middleware/auth.middleware.js:7`

---

## ADR-007: Use Docker multi-stage builds for smaller production images

**Decision**: Implement multi-stage Docker builds with separate dev/prod targets.

**Context**: Need optimized Docker images for different environments.

**Benefits**:
- Production image excludes dev dependencies
- Smaller attack surface (no dev tools in prod)
- Smaller image size (faster pulls, lower storage)
- Shared base layer reduces build time

**Drawbacks**:
- Complex Dockerfile
- Longer initial build time
- Requires understanding of Docker stages

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|-------------|
| **Single-stage build** | Larger images, dev tools in production |
| **.dockerignore pruning** | Less precise than stage separation |
| **Distroless images** | Harder to debug, no shell |

**Evidence**: `Dockerfile` — Three stages: `base`, `development`, `production`

---

## ADR-008: Use ES Modules with import maps over CommonJS

**Decision**: Use ES Modules with Node.js subpath imports.

**Context**: Choosing module system for the project.

**Benefits**:
- Clean import paths via `#` aliases
- No relative path hell
- Static analysis for tree-shaking
- Standard JavaScript module system
- Top-level await support

**Drawbacks**:
- Some packages still use CommonJS (interop required)
- Requires `"type": "module"` in package.json
- Import maps are Node.js-specific

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|-------------|
| **CommonJS (require)** | Legacy, no static analysis |
| **Webpack aliases** | Build step required |
| **TypeScript path mapping** | TypeScript-only, no runtime effect |

**Evidence**: `package.json` — `"type": "module"`, `"imports"` section, all `import` statements use `#` aliases

---

## ADR-009: Use Zod over Joi for validation

**Decision**: Use Zod for input validation.

**Context**: Choosing a validation library.

**Benefits**:
- TypeScript-compatible schema definitions
- Composable schemas (`.extend()`, `.merge()`)
- Built-in parsing and transformation
- Clear error messages
- Active development (v4)

**Drawbacks**:
- Zod v4 API differs from v3 (potential migration effort)
- Smaller ecosystem than Joi

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|-------------|
| **Joi** | Larger but more verbose, no TypeScript inference |
| **Yup** | Smaller API, less composable |
| **AJV** | JSON Schema-based, more complex for simple validation |

**Evidence**: `src/validations/auth.validation.js`, `src/validations/users.validation.js`, `package.json`

---

## ADR-010: Use GitHub Actions over other CI/CD platforms

**Decision**: Use GitHub Actions for CI/CD.

**Context**: Choosing a CI/CD platform.

**Benefits**:
- Integrated with GitHub repository
- Free for public repositories
- Large marketplace of actions
- Matrix builds, multi-arch support
- Secrets management

**Drawbacks**:
- Tied to GitHub (migration requires workflow rewrite)
- Windows/macOS runners slower than Linux
- Limited customization vs Jenkins

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|-------------|
| **GitLab CI** | Would require GitLab hosting |
| **Jenkins** | Self-hosted maintenance overhead |
| **CircleCI** | Paid tier needed for equivalent features |

**Evidence**: `.github/workflows/` — Three workflow files
