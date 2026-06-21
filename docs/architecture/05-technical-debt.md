# 18. Technical Debt Report

## Executive Summary

The repository is well-structured for a starter/reference project but has several areas of technical debt that should be addressed before production deployment.

## Debt Inventory

### Critical (Must Fix Before Production)

| #   | Issue                                   | File                 | Risk | Remediation                                                  |
| --- | --------------------------------------- | -------------------- | ---- | ------------------------------------------------------------ |
| C1  | **Credentials committed to Git**        | `.env`               | HIGH | Expose `.env` in git, rotate all secrets, use `.env.example` |
| C2  | **Hardcoded JWT secret fallback**       | `src/utils/jwt.js:4` | HIGH | Remove fallback; crash if `JWT_SECRET` not set               |
| C3  | **No database test mocking**            | `tests/app.test.js`  | HIGH | All tests would fail without a running Neon database         |
| C4  | **CORS permissive in all environments** | `src/app.js:8`       | HIGH | `cors()` without options allows any origin                   |

### High

| #   | Issue                                           | File                                | Risk   | Remediation                                        |
| --- | ----------------------------------------------- | ----------------------------------- | ------ | -------------------------------------------------- |
| H1  | **No pagination on user list**                  | `src/services/users.service.js:7-9` | MEDIUM | Add `LIMIT`/`OFFSET` or cursor pagination          |
| H2  | **Minimal test coverage**                       | `tests/`                            | HIGH   | Only 3 tests, 0% coverage of core logic            |
| H3  | **No error handler middleware**                 | `src/app.js`                        | MEDIUM | Unhandled errors fall through to Express default   |
| H4  | **`updated_at` not auto-updated**               | `src/models/user.model.js`          | LOW    | Must be manually set on update                     |
| H5  | **Password not excluded in all select queries** | `src/services/users.service.js`     | MEDIUM | Some queries manually project fields, easy to miss |

### Medium

| #   | Issue                                              | File                                       | Risk   | Remediation                                                 |
| --- | -------------------------------------------------- | ------------------------------------------ | ------ | ----------------------------------------------------------- |
| M1  | **No input sanitization**                          | All controllers                            | MEDIUM | Names/emails accepted as-is                                 |
| M2  | **Rate limiting bypass via role header injection** | `src/middleware/security.middleware.js:6`  | MEDIUM | Role derived from `req.user?.role` — but guest role default |
| M3  | **Ambiguous error messages on auth failure**       | `src/controllers/auth.controller.js:57`    | LOW    | Intentional (security) but lacks detail for debugging       |
| M4  | **No request ID tracking**                         | All files                                  | LOW    | Cannot correlate logs for a single request                  |
| M5  | **Console.error in production code**               | `src/middleware/security.middleware.js:27` | LOW    | Should use `logger.error` instead                           |
| M6  | **Typo in error response (`errro`)**               | `src/middleware/security.middleware.js:28` | LOW    | Typo in JSON key `"errro"` instead of `"error"`             |

### Low

| #   | Issue                                   | File                                     | Risk | Remediation                                      |
| --- | --------------------------------------- | ---------------------------------------- | ---- | ------------------------------------------------ |
| L1  | **Docker health check typo?**           | `Dockerfile`                             | LOW  | Health check requires `'CMD'` but uses `CMD`     |
| L2  | **Unused import: `@arcjet/inspect`**    | `package.json`                           | LOW  | Listed in dependencies but not imported anywhere |
| L3  | **Self-deletion check logic**           | `src/controllers/users.controller.js:74` | LOW  | Intentional guard, but may be surprising         |
| L4  | **No `.env.example` file**              | Root                                     | LOW  | No template for required env vars                |
| L5  | **docs/ directory exists but is empty** | `docs/`                                  | LOW  | No documentation prior to this generation        |

## Code Smells

| Smell                              | Location                                       | Description                                            |
| ---------------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| **Magic strings**                  | `src/middleware/security.middleware.js:6`      | `'guest'`, `'admin'`, `'user'` role strings duplicated |
| **Deep try-catch nesting**         | `src/controllers/users.controller.js`          | Each method wraps entire body in try-catch             |
| **Error type checking by message** | `src/controllers/users.controller.js:48,61,80` | Checking `e.message` string instead of error class     |
| **Config inline in utility**       | `src/utils/jwt.js:4-5`                         | JWT secret and expiry in utility file, not config      |
| **Duplicate email check logic**    | `src/services/users.service.js:30-33`          | Duplicated in createUser and updateUser                |

## Duplicate Code

| Pattern                | Location 1                        | Location 2                         | Recommendation                          |
| ---------------------- | --------------------------------- | ---------------------------------- | --------------------------------------- |
| Zod userIdSchema usage | `users.controller.js:19`          | `users.controller.js:36`           | Create middleware for ID validation     |
| User field projection  | `src/services/users.service.js:8` | `src/services/users.service.js:15` | Extract to shared projection definition |
| Error message checking | `auth.controller.js:28`           | `users.controller.js:48`           | Use custom Error classes instead        |

## Dead Code

| Item                         | Location           | Reason                          | Action                       |
| ---------------------------- | ------------------ | ------------------------------- | ---------------------------- |
| `@arcjet/inspect` dependency | `package.json`     | Not imported in any source file | Remove                       |
| `/api` route                 | `src/app.js:35-37` | No documented purpose           | Keep as API status indicator |

## Risk Rating Methodology

| Severity     | Definition                                    | Response                |
| ------------ | --------------------------------------------- | ----------------------- |
| **Critical** | Security vulnerability or production-blocking | Fix immediately         |
| **High**     | Significant quality or reliability risk       | Fix before next release |
| **Medium**   | Moderate risk, potential future issue         | Plan for next sprint    |
| **Low**      | Minor improvement or nice-to-have             | Add to backlog          |

## Remediation Plan

### Phase 1: Security (1-2 days)

1. Remove `.env` from git tracking, rotate all credentials
2. Add `.env.example` with placeholder values
3. Remove hardcoded JWT fallback
4. Configure CORS with explicit allowed origins
5. Fix `"errro"` typo in `security.middleware.js`

### Phase 2: Testing (3-5 days)

1. Add auth integration tests (signup, signin, signout)
2. Add user CRUD integration tests
3. Add auth middleware tests
4. Mock database for reliable test execution
5. Add test database setup/teardown

### Phase 3: Observability (1-2 days)

1. Add request ID tracking
2. Add structured logging context
3. Add Prometheus metrics endpoint
4. Replace `console.error` with `logger.error`

### Phase 4: Production Readiness (2-3 days)

1. Add pagination to user list endpoint
2. Add connection pooling
3. Add custom Error classes
4. Extract magic strings to constants
5. Add health check enhancements (DB connectivity check)

## Source Files Evidence

| Issue                 | File                                    | Line                             |
| --------------------- | --------------------------------------- | -------------------------------- |
| Credentials in .env   | `.env`                                  | 5 (DATABASE_URL), 8 (ARCJET_KEY) |
| JWT fallback          | `src/utils/jwt.js`                      | 4                                |
| CORS permissive       | `src/app.js`                            | 8                                |
| No pagination         | `src/services/users.service.js`         | 7-9                              |
| Typo "errro"          | `src/middleware/security.middleware.js` | 28                               |
| console.error in prod | `src/middleware/security.middleware.js` | 27                               |
| Unused dependency     | `package.json`                          | `"@arcjet/inspect"`              |
