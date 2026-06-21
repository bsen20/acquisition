# 8. Code Flow Analysis

## Application Startup Sequence

```mermaid
sequenceDiagram
    participant Shell as Shell (npm start/dev)
    participant Index as src/index.js
    participant Server as src/server.js
    participant App as src/app.js
    participant Config as Config Modules
    participant Routes as Route Modules
    participant Middleware as Middleware Modules
    
    Shell->>Index: node src/index.js
    
    Index->>Index: import 'dotenv/config'
    Index->>Index: import './server.js'
    
    Server->>App: import app from './app.js'
    
    App->>Config: import logger
    App->>Config: import securityMiddleware
    
    App->>App: Initialize Express app
    App->>App: app.use(helmet())
    App->>App: app.use(cors())
    App->>App: app.use(express.json())
    App->>App: app.use(express.urlencoded({extended:true}))
    App->>App: app.use(cookieParser())
    App->>App: app.use(morgan('combined', ...))
    App->>App: app.use(securityMiddleware)
    
    App->>Routes: import authRoutes
    App->>Routes: import usersRoutes
    
    App->>App: app.get('/', ...)
    App->>App: app.get('/health', ...)
    App->>App: app.get('/api', ...)
    App->>App: app.use('/api/auth', authRoutes)
    App->>App: app.use('/api/users', usersRoutes)
    App->>App: app.use(404 handler)
    
    App-->>Server: export app
    Server->>Server: app.listen(PORT)
    Server-->>Shell: Server started on PORT
```

**Startup Steps**:
1. `npm start` or `npm run dev` executes `src/index.js`
2. `dotenv/config` loads environment variables from `.env`
3. `server.js` imports `app.js` (this triggers all module imports and Express configuration)
4. All middleware is registered in order
5. Routes are imported and mounted
6. Fallback 404 handler is registered
7. Express app is exported back to `server.js`
8. `app.listen(PORT)` starts the HTTP server

## Request Lifecycle (Full Flow)

```mermaid
sequenceDiagram
    participant Client
    participant Express as Express Engine
    participant Helmet as Helmet
    participant CORS as CORS
    participant Parser as Body Parser
    participant CP as Cookie Parser
    participant Morgan as Morgan/Winston
    participant Arcjet as Arcjet Security
    participant Auth as Auth Middleware
    participant Controller
    participant Zod as Zod Validation
    participant Service
    participant Drizzle as Drizzle ORM
    participant DB as Neon PostgreSQL
    
    Client->>Express: HTTP Request
    
    Express->>Helmet: Set security headers
    Helmet-->>Express: Headers added
    
    Express->>CORS: Check origin
    CORS-->>Express: Allow/Deny
    
    Express->>Parser: Parse JSON body
    Parser-->>Express: req.body
    
    Express->>CP: Parse cookies
    CP-->>Express: req.cookies
    
    Express->>Morgan: Log request
    Morgan->>Winston: Write log
    Winston-->>Morgan: Logged
    
    Express->>Arcjet: protect(req)
    
    Arcjet->>Arcjet: Check bot
    Arcjet->>Arcjet: Check shield rules
    Arcjet->>Arcjet: Check rate limits
    
    alt Blocked by Arcjet
        Arcjet-->>Express: 403 Forbidden
        Express-->>Client: Error Response
    else Passed
        Arcjet-->>Express: Allow
    end
    
    Express->>Express: Route matching
    
    alt Auth Route
        Express->>Controller: auth.controller
        
        Controller->>Zod: Validate body
        alt Invalid
            Controller-->>Express: 400
            Express-->>Client: Validation Error
        end
        
        Controller->>Service: auth.service
        
        Service->>Service: hash/compare password
        Service->>Drizzle: Query users table
        Drizzle->>DB: SQL Query
        DB-->>Drizzle: Results
        Drizzle-->>Service: Data
        
        alt Duplicate / Not found
            Service-->>Controller: Error
            Controller-->>Express: 409/401
        end
        
        Service-->>Controller: User data
        
        Controller->>Controller: Generate JWT
        Controller->>Controller: Set cookie
        Controller-->>Express: 200/201
        Express-->>Client: JSON + Cookie
        
    else Protected Route
        Express->>Auth: authenticateToken
        
        Auth->>Auth: Read cookie
        alt No cookie
            Auth-->>Express: 401
            Express-->>Client: Unauthorized
        end
        
        Auth->>Auth: Verify JWT
        alt Invalid/Expired
            Auth-->>Express: 401
            Express-->>Client: Invalid token
        end
        
        Auth->>Auth: req.user = decoded
        
        alt Admin Route (/DELETE)
            Express->>Auth: requireRole(['admin'])
            alt Not admin
                Auth-->>Express: 403
                Express-->>Client: Forbidden
            end
        end
        
        Express->>Controller: users.controller
        
        Controller->>Zod: Validate params/body
        alt Invalid
            Controller-->>Express: 400
        end
        
        Controller->>Service: users.service
        Service->>Drizzle: Query
        Drizzle->>DB: SQL
        DB-->>Drizzle: Results
        Drizzle-->>Service: Data
        Service-->>Controller: Result
        
        Controller->>Controller: Check authorization
        alt Unauthorized action
            Controller-->>Express: 403
        end
        
        Controller-->>Express: 200 JSON
        Express-->>Client: Response
        
    else Health/Root
        Express-->>Client: OK Response
    end
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Cookie as Cookie Utils
    participant JWT as JWT Utils
    participant AuthMW as Auth Middleware
    
    Note over User, AuthMW: === REGISTRATION ===
    User->>API: POST /api/auth/sign-up {name, email, password}
    API->>Service: createUser()
    Service->>Service: hash password (bcrypt)
    Service->>DB: INSERT user
    DB-->>Service: user
    Service-->>API: user (no password)
    API->>JWT: sign({id, email, role})
    JWT-->>API: token
    API->>Cookie: set(res, 'token', token)
    API-->>User: 201 + JSON + httpOnly Cookie
    
    Note over User, AuthMW: === SIGN-IN ===
    User->>API: POST /api/auth/sign-in {email, password}
    API->>Service: authenticateUser()
    Service->>DB: SELECT by email
    DB-->>Service: user (with hash)
    Service->>Service: compare password (bcrypt)
    Service-->>API: user (no password)
    API->>JWT: sign({id, email, role})
    API->>Cookie: set(res, 'token', token)
    API-->>User: 200 + JSON + httpOnly Cookie
    
    Note over User, AuthMW: === PROTECTED REQUEST ===
    User->>API: GET /api/users (Cookie: token=...)
    API->>AuthMW: authenticateToken()
    AuthMW->>Cookie: Read req.cookies.token
    AuthMW->>JWT: verify(token)
    JWT-->>AuthMW: {id, email, role}
    AuthMW->>AuthMW: req.user = decoded
    AuthMW-->>API: next()
    API->>API: Process route
    
    Note over User, AuthMW: === SIGN-OUT ===
    User->>API: POST /api/auth/sign-out
    API->>Cookie: clear(res, 'token')
    API-->>User: 200 + Cookie cleared
```

## Authorization Flow

```mermaid
flowchart TB
    A[Request to protected route] --> B[authenticateToken middleware]
    B --> C{Cookie: token exists?}
    C -->|No| D[401 No access token]
    C -->|Yes| E[Verify JWT]
    E -->|Invalid| F[401 Invalid/expired]
    E -->|Valid| G[Set req.user]
    G --> H{Route has requireRole?}
    H -->|No| I[Continue to controller]
    H -->|Yes| J[requireRole middleware]
    J --> K{req.user.role in allowedRoles?}
    K -->|No| L[403 Insufficient permissions]
    K -->|Yes| I
    
    I --> M[Controller processes request]
    M --> N{Fetch user by ID?}
    N --> O[Zod validates :id is number]
    M --> P{Update user?}
    P --> Q[Check: req.user.id === params.id OR admin?]
    Q -->|Neither| R[403 Can only update own info]
    Q -->|Pass| S[Check: role change without admin?]
    S -->|Non-admin tries role change| T[403 Only admin can change roles]
    S -->|Pass| U[Proceed with update]
    M --> V{Delete user?}
    V --> W[requireRole already enforced admin]
    W --> X[Check: req.user.id === params.id?]
    X -->|Self-delete attempt| Y[403 Cannot delete own account]
    X -->|Different user| Z[Proceed with delete]
```

## Error Handling Flow

```mermaid
flowchart TB
    A[Error occurs] --> B{Error type?}
    
    B -->|Zod Validation Error| C[Controller catches]
    C --> D[Return 400 + formatted errors]
    
    B -->|Business Logic Error| E[Controller catches]
    E --> F[Check error.message]
    F -->|'User with this email...'| G[Return 409]
    F -->|'User not found'| H[Return 404]
    F -->|'Invalid password'| I[Return 401]
    F -->|'Email already exists'| J[Return 409]
    F -->|Other| K[Call next(error)]
    
    B -->|JWT Error| L[Auth middleware catches]
    L -->|'Failed to authenticate'| M[Return 401]
    L -->|Other| N[Return 500]
    
    B -->|Unexpected Error| K
    
    K --> O[Express default error handler]
    O --> P[500 Internal Server Error]
    
    %% Winston logging at every step
    A -.-> Q[Winston: logger.error()]
```

## Logging Flow

```mermaid
flowchart LR
    subgraph "Log Sources"
        A[Application Code]
        B[Morgan HTTP Logger]
    end
    
    subgraph "Winston Logger"
        C[Logger Instance]
        D[Format: JSON + Timestamp + Errors Stack + Service Name]
    end
    
    subgraph "Transports"
        E[File: logs/combined.log<br/>All levels]
        F[File: logs/error.lg<br/>Error level only]
        G[Console<br/>(Non-production only)<br/>Colorized + Simple format]
    end
    
    A --> C
    B --> C
    C --> D
    D --> E
    D --> F
    D --> G
```

**Log Levels Used** (from source analysis of `logs/combined.log` and `logs/error.lg`):
- `logger.info()` — User registrations, sign-ins, sign-outs, successful operations
- `logger.error()` — Failed operations, exceptions, auth failures
- `logger.warn()` — Rate limit exceeded, bot blocked, authorization denied

## Background Jobs Flow

**Not enough evidence found in repository.** The project does not implement any background jobs, task queues, or scheduled operations. All processing is synchronous within the request lifecycle.

## Event Processing Flow

**Not enough evidence found in repository.** The project does not implement any event-driven patterns. There are no:
- Event emitters
- Message queues
- Webhook deliveries
- Event listeners/handlers

## Source Files Evidence

| Flow | Key Files |
|------|-----------|
| Startup | `src/index.js:1-2`, `src/server.js:1-6`, `src/app.js:1-52` |
| Request Lifecycle | `src/app.js` (middleware order), `src/middleware/security.middleware.js` |
| Authentication | `src/middleware/auth.middleware.js`, `src/utils/jwt.js:1-18`, `src/utils/cookies.js` |
| Authorization | `src/middleware/auth.middleware.js:17-28`, `src/controllers/users.controller.js:32-64` |
| Error Handling | `src/controllers/auth.controller.js`, `src/controllers/users.controller.js` (all try-catch blocks) |
| Logging | `src/config/logger.js`, `src/app.js:21-24` (morgan integration) |
