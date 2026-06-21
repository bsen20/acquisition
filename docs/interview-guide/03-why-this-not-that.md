# 24. Why This? Why Not That?

## Why Express instead of Fastify?

| Factor | Express 5 | Fastify |
|--------|-----------|---------|
| **Why chosen** | Largest ecosystem, most middleware, standard teaching framework |
| **Performance** | ~30K req/s | ~50K req/s (faster) |
| **Middleware ecosystem** | Massive (Helmet, CORS, Morgan, etc.) | Growing but smaller |
| **Plugin model** | Simple middleware chain | Decorator + hook system |
| **TypeScript support** | Community types | Built-in TypeScript |
| **Serialization** | Manual | Fast JSON serialization (built-in) |
| **Community size** | Largest Node.js framework | Growing, popular in performance-sensitive apps |

**Tradeoff accepted**: Performance for ecosystem maturity and team familiarity.

**Interview talking point**: For an auth API handling ~1000 req/s, the performance difference between Express and Fastify is negligible. The ecosystem advantage of Express (especially Express 5's improved error handling) outweighs the raw throughput difference. If the API needed to handle 100K+ req/s, we'd consider Fastify.

---

## Why PostgreSQL (Neon) instead of MongoDB?

| Factor | PostgreSQL (Neon) | MongoDB |
|--------|-------------------|---------|
| **Why chosen** | Relational data, ACID compliance, strong typing |
| **Schema** | Rigid schema (varchar, serial, timestamp) | Flexible schema (documents) |
| **ACID** | Full ACID compliance | Eventual consistency (default) |
| **Query** | SQL (structured, powerful joins) | MongoDB Query Language (JSON-like) |
| **Scaling** | Vertical + read replicas, sharding complex | Horizontal sharding built-in |
| **Auth data** | User data is highly relational (flat) | Works well as documents |
| **Serverless** | Neon provides serverless PostgreSQL | MongoDB Atlas (serverless) |

**Tradeoff accepted**: Schema rigidity for data integrity and ACID compliance. User data is inherently relational (one user, one email, one role) — a relational database is the natural fit.

**Interview talking point**: User authentication data is fundamentally relational and structured. There's no benefit to a document store for this domain. Using PostgreSQL from the start avoids the pain of adding migrations later when relationships emerge (e.g., adding organizations, permissions, audit logs).

---

## Why REST instead of GraphQL?

| Factor | REST | GraphQL |
|--------|------|---------|
| **Why chosen** | Simplicity, caching, maturity |
| **Data fetching** | Fixed endpoint responses | Client-specified queries |
| **Over-fetching** | May return more data than needed | Precisely what client requests |
| **Caching** | HTTP caching (native) | Requires Apollo Client cache |
| **Tooling** | curl, Postman, any HTTP client | Apollo, GraphiQL |
| **Learning curve** | Low | Moderate |
| **Versioning** | URL/header versioning | Schema evolution |
| **N+1 problem** | Not applicable (relational DB queries) | Requires DataLoader |

**Tradeoff accepted**: Over-fetching for simplicity and universal tooling support. The API has only two resource types (auth, users) — there's no N+1 problem, and clients get exactly the data they need.

**Interview talking point**: GraphQL adds significant complexity (schema definition, resolvers, DataLoader, client caching) that is not justified for a system with 10 endpoints and 1 entity type. REST + JSON is simpler, more cacheable, and more universally compatible.

---

## Why JWT instead of Sessions?

| Factor | JWT | Sessions |
|--------|-----|----------|
| **Why chosen** | Stateless, no server-side storage, easy horizontal scaling |
| **Storage** | Client-side (cookie) | Server-side (Redis, DB, memory) |
| **Revocation** | Not possible (until expiry) | Immediate (delete session) |
| **Scaling** | Add more servers, no session affinity | Need shared session store (Redis) |
| **Size** | Small (grows with claims) | Minimal (just session ID) |
| **Mobile support** | Works natively | Requires cookie/session header |
| **Complexity** | Low-medium | Medium (need session store) |

**Tradeoff accepted**: Token revocation ability for stateless scalability. JWT cannot be revoked server-side, but this is acceptable for 1-day tokens. If revocation were critical, we'd add a token blacklist or use refresh tokens.

**Interview talking point**: The JWT vs Sessions question reveals understanding of state management tradeoffs. For a cloud-native, containerized application that auto-scales, session affinity is a deployment nightmare. JWT eliminates this concern entirely. The 1-day expiry is a reasonable compromise between user experience (don't re-login too often) and security (limited window if token is stolen).

---

## Why httpOnly Cookies instead of Bearer Token (Authorization Header)?

| Factor | httpOnly Cookie | Bearer Token |
|--------|----------------|--------------|
| **Why chosen** | XSS protection, automatic sending |
| **XSS risk** | Token not accessible to JavaScript | Token in localStorage/JS memory is XSS-accessible |
| **CSRF risk** | Need SameSite=Strict (mitigated) | Immune (header-based) |
| **Mobile apps** | Difficult to use | Natural fit |
| **Browser API** | Automatically sent | Must be manually added to headers |
| **Storage** | Cookie jar (browser managed) | localStorage / memory |

**Tradeoff accepted**: CSRF protection complexity for XSS protection. With SameSite=Strict, CSRF is effectively mitigated. The tradeoff is mobile app compatibility — mobile apps would need a different auth approach.

**Interview talking point**: The primary threat to web applications is XSS, not CSRF. httpOnly cookies eliminate the most common token theft vector. SameSite cookies are now supported in all major browsers, making CSRF a solved problem. For a web-first API (JavaScript Mastery audience), this is the correct choice.

---

## Why Docker?

| Factor | With Docker | Without Docker |
|--------|-------------|----------------|
| **Why chosen** | Consistent environments, reproducible builds |
| **Environment consistency** | Identical dev/prod/CI | "Works on my machine" |
| **Onboarding** | `docker compose up` | Manual Node + PostgreSQL setup |
| **Isolation** | Container boundaries | Process-level isolation |
| **CI/CD** | Same image tested and deployed | Different environments |

**Docker is the standard for modern backend deployment.**

**Interview talking point**: Docker eliminates the most common source of bugs: environment differences. The multi-stage build pattern ensures production images are minimal, secure, and deterministic. For a reference architecture, Docker is non-negotiable.

---

## Why Kubernetes-ready (but not using Kubernetes)?

| Factor | Current (Docker Compose) | Kubernetes |
|--------|-------------------------|------------|
| **Why current** | Appropriate for current scale and complexity |
| **Orchestration** | Single host | Multi-host cluster |
| **Scaling** | Manual (docker compose scale) | Auto-scaling (HPA) |
| **Self-healing** | Restart policy only | Liveness/Readiness + rescheduling |
| **Networking** | Bridge network | Service mesh, ingress, DNS |
| **Complexity** | Low | High |
| **Cost** | Low | Infrastructure + expertise |

**Tradeoff accepted**: Limited orchestration for simplicity. Docker Compose is appropriate for projects that run on a single server. Kubernetes is over-engineering for this scale.

**Interview talking point**: Kubernetes is an infrastructure decision, not an application decision. Premature K8s adoption adds significant operational complexity. Docker Compose handles the current deployment needs, and the containerized architecture makes K8s migration straightforward when needed.

---

## Why not Serverless (Lambda)?

| Factor | Current (Express on VM) | Serverless (Lambda) |
|--------|------------------------|---------------------|
| **Why rejected** | Stateful middleware (Arcjet), Express 5 not Lambda-native |
| **Cold starts** | Always warm | 1-5s cold start |
| **State** | Long-running process | Stateless (per-invocation) |
| **Database connections** | Persistent pool | Must reconnect each invocation |
| **Cost** | Fixed server cost | Pay-per-invocation |
| **Debugging** | Attach debugger | CloudWatch logs |

**Interview talking point**: Serverless is excellent for event-driven, stateless workloads. An Express API with long-running middleware, persistent database connections, and file-based logging is a poor fit. The cold start penalty (~3 seconds for bcrypt/HJWT initialization) would make every request slow.

---

## Why not Event-Driven Architecture?

| Factor | Current (Request-Response) | Event-Driven |
|--------|---------------------------|--------------|
| **Why rejected** | Auth is synchronous by nature |
| **Flow** | Request → Response | Emit → Queue → Process |
| **Latency** | Real-time | Eventual consistency |
| **Complexity** | Low | High (queues, consumers, retries) |
| **Use case fit** | Auth must be synchronous | Background processing |

**Interview talking point**: User authentication is inherently synchronous — the user needs an immediate response. Event-driven architecture adds unnecessary complexity (message queues, event handlers, retry logic, at-least-once processing) without benefit. If we needed to send welcome emails after registration, that would be a good candidate for events.

---

## Why not CQRS?

| Factor | Current (CRUD) | CQRS |
|--------|----------------|------|
| **Why rejected** | Only one entity type, simple operations |
| **Read model** | Same as write model | Separate optimized read store |
| **Command model** | Same as write model | Separate write store |
| **Complexity** | Low | High (event sourcing, projections) |
| **Use case fit** | Simple CRUD on one table | Complex domains with different read/write patterns |

**Interview talking point**: CQRS is beneficial when read and write workloads have significantly different patterns (e.g., write-intensive with complex reads, or vice versa). A user auth system with a single table and simple queries does not need this pattern. Using CQRS here would be over-engineering.

---

## Why Winston over Pino?

| Factor | Winston | Pino |
|--------|---------|------|
| **Why chosen** | Maturity, features, learning resource familiarity |
| **Performance** | ~200K ops/sec | ~500K ops/sec |
| **Transports** | Built-in file, console, HTTP | Need pino/file, pino-pretty |
| **Streaming** | Built-in | Need pino-multi-stream |
| **Configuration** | Simple | More configuration needed |
| **Ecosystem** | Larger, more tutorials | Growing |

**Tradeoff accepted**: Lower throughput for simpler configuration and familiarity. At this project's scale, log throughput is not a bottleneck.

**Interview talking point**: Winston's performance is sufficient for this project's traffic. If the system needed to log millions of events per minute, we'd switch to Pino. The Winston → Pino migration is straightforward (both use JSON output).
