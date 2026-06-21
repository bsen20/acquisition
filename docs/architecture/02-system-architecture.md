# 5. System Architecture Documentation

## High Level Architecture

```mermaid
graph TB
    subgraph "External"
        Client[Client Applications]
        GitHub[GitHub Actions CI/CD]
        DockerHub[Docker Hub Registry]
    end
    
    subgraph "Application Container"
        API[Express API Server]
        Arcjet[Arcjet Security Layer]
        
        subgraph "Routes"
            AuthRoutes[Auth Routes<br/>/api/auth]
            UserRoutes[User Routes<br/>/api/users]
            HealthRoute[Health<br/>/health]
        end
        
        subgraph "Middleware Stack"
            Helmet[Helmet Security Headers]
            CORS[CORS]
            CookieParser[Cookie Parser]
            Morgan[Morgan HTTP Logger]
            Security[Arcjet Security Middleware]
            Auth[JWT Auth Middleware]
        end
        
        subgraph "Business Logic"
            AuthService[Auth Service]
            UserService[User Service]
            Validators[Zod Validators]
        end
        
        subgraph "Data Access"
            Drizzle[Drizzle ORM]
        end
    end
    
    subgraph "Data Layer"
        NeonDB[(Neon Serverless PostgreSQL)]
    end
    
    subgraph "Observability"
        WinstonLogger[Winston Logger]
        Files[Log Files]
    end
    
    Client --> API
    API --> Helmet
    Helmet --> CORS
    CORS --> CookieParser
    CookieParser --> Morgan
    Morgan --> Security
    Security --> AuthRoutes
    Security --> UserRoutes
    
    AuthRoutes --> AuthService
    UserRoutes --> Auth
    Auth --> UserService
    
    AuthService --> Validators
    UserService --> Validators
    
    AuthService --> Drizzle
    UserService --> Drizzle
    Drizzle --> NeonDB
    
    WinstonLogger --> Files
    
    GitHub --> DockerHub
    DockerHub -.-> Client
```

**Diagram Explanation**: The system follows a layered architecture. Client requests enter through the Express server, pass through the middleware stack (Helmet → CORS → CookieParser → Morgan → Arcjet Security), then routes to appropriate controllers. Controllers use services for business logic, which use Drizzle ORM for database access. Arcjet provides external security integration. Winston logs to files independently.

## Component Diagram

```mermaid
graph TB
    subgraph "Express Application (app.js)"
        direction TB
        MW[Middleware Pipeline]
        RT[Router]
        
        subgraph "Middleware"
            H[helmet]
            C[cors]
            J[express.json]
            U[express.urlencoded]
            CP[cookie-parser]
            M[morgan → winston]
            SM[security.middleware]
        end
        
        subgraph "Routes"
            AR[auth.routes]
            UR[users.routes]
            HR[health / root]
        end
        
        MW --> RT
        RT --> HR
        RT --> AR
        RT --> UR
    end
    
    subgraph "Auth Module"
        AC[auth.controller]
        AS[auth.service]
        AV[auth.validation]
        JWT[jwt.utils]
        CK[cookies.utils]
    end
    
    subgraph "User Module"
        UC[users.controller]
        US[users.service]
        UV[users.validation]
        UM[user.model]
    end
    
    subgraph "Infrastructure"
        DB[database.config]
        LG[logger.config]
        AJ[arcjet.config]
    end
    
    AR --> AC
    UR --> UC
    
    AC --> AV
    AC --> AS
    AC --> JWT
    AC --> CK
    
    UC --> UV
    UC --> US
    
    AS --> DB
    AS --> LG
    US --> DB
    US --> LG
    
    US --> UM
    AS --> UM
    
    SM --> AJ
    SM --> LG
```

**Diagram Explanation**: The application consists of two main feature modules (Auth and User), shared middleware, and infrastructure components. Each module follows the Controller → Service → Model pattern. The Auth module additionally uses JWT and Cookie utilities.

## Module Interaction Diagram

```mermaid
sequenceDiagram
    participant Client
    participant Router as Express Router
    participant Security as Security Middleware
    participant AuthMW as Auth Middleware
    participant Controller
    participant Service
    participant ORM as Drizzle ORM
    participant DB as Neon DB
    
    Client->>Router: HTTP Request
    Router->>Security: Arcjet protect()
    Security-->>Router: Pass / Deny
    
    alt Public Route (auth)
        Router->>Controller: Auth Controller
    else Protected Route (users)
        Router->>AuthMW: authenticateToken()
        AuthMW-->>Router: req.user set
        Router->>AuthMW: requireRole() [if needed]
        Router->>Controller: Users Controller
    end
    
    Controller->>Controller: Zod validation
    alt Validation Fails
        Controller-->>Client: 400 Error
    end
    
    Controller->>Service: Business logic
    Service->>ORM: Query
    ORM->>DB: SQL
    DB-->>ORM: Result
    ORM-->>Service: Data
    Service-->>Controller: Result
    Controller-->>Client: JSON Response
```

## Dependency Diagram

```mermaid
graph LR
    subgraph "Dependencies (runtime)"
        express["express ^5.1.0"]
        arcjet["@arcjet/node ^1.0.0-beta.11"]
        neon["@neondatabase/serverless ^1.0.1"]
        drizzle["drizzle-orm ^0.44.5"]
        bcrypt["bcrypt ^6.0.0"]
        jsonwebtoken["jsonwebtoken ^9.0.2"]
        zod["zod ^4.1.5"]
        winston["winston ^3.17.0"]
        helmet["helmet ^8.1.0"]
        morgan["morgan ^1.10.1"]
        cookie["cookie-parser ^1.4.7"]
        cors["cors ^2.8.5"]
        dotenv["dotenv ^17.2.2"]
    end
    
    subgraph "Dev Dependencies"
        eslint["eslint ^9.35.0"]
        prettier["prettier ^3.6.2"]
        jest["jest ^30.1.3"]
        supertest["supertest ^7.1.4"]
        drizzle_kit["drizzle-kit ^0.31.4"]
    end
    
    app[Application] --> express
    app --> arcjet
    app --> neon
    app --> drizzle
    app --> bcrypt
    app --> jsonwebtoken
    app --> zod
    app --> winston
    app --> helmet
    app --> morgan
    app --> cookie
    app --> cors
    app --> dotenv
    
    dev[Developer Tools] --> eslint
    dev --> prettier
    dev --> jest
    dev --> supertest
    dev --> drizzle_kit
```

**Diagram Explanation**: The runtime dependency graph shows Express 5 as the core framework, with security dependencies (Arcjet, Helmet), database dependencies (Neon, Drizzle, bcrypt), and utility dependencies (JWT, Zod, Winston). Dev dependencies are isolated for development tooling only.

## Request Lifecycle Diagram

```mermaid
flowchart TB
    A[HTTP Request] --> B{Is it OPTIONS?}
    B -->|Yes| C[CORS preflight handled]
    B -->|No| D[Helmet security headers]
    D --> E[Parse JSON body]
    E --> F[Parse URL-encoded body]
    F --> G[Parse cookies]
    G --> H[Log via Morgan → Winston]
    H --> I[Arcjet Security Check]
    
    I --> J{Bot?}
    J -->|Yes| K[403 Blocked]
    J -->|No| L{Shield?}
    L -->|Yes| M[403 Blocked]
    L -->|No| N{Rate Limited?}
    N -->|Yes| O[403 Blocked]
    N -->|No| P{Route Matches?}
    
    P -->|/api/auth/*| Q[Auth Controller]
    P -->|/api/users/*| R{Auth Middleware}
    P -->|/health| S[Health Response]
    P -->|/| T[Root Response]
    P -->|No Match| U[404 Not Found]
    
    R -->|Valid Token| V[Users Controller]
    R -->|No Token| W[401 Unauthorized]
    R -->|Expired| X[401 Unauthorized]
    
    Q --> Y[JSON Response]
    V --> Y
    S --> Y
    T --> Y
    K --> Y
    M --> Y
    O --> Y
    U --> Y
    W --> Y
    X --> Y
```

## Deployment Architecture Diagram

```mermaid
graph TB
    subgraph "Development Environment"
        DevCompose["docker-compose.dev.yml"]
        NeonLocal["Neon Local Proxy :5432"]
        DevApp["App Container (dev target)<br/>Hot Reload :3000"]
        
        DevCompose --> NeonLocal
        DevCompose --> DevApp
        DevApp --> NeonLocal
    end
    
    subgraph "Production Environment"
        ProdCompose["docker-compose.prod.yml"]
        ProdApp["App Container (prod target)<br/>:3000"]
        NeonCloud["Neon Cloud DB"]
        
        ProdCompose --> ProdApp
        ProdApp --> NeonCloud
    end
    
    subgraph "CI/CD (GitHub Actions)"
        Lint["Lint & Format Workflow"]
        Test["Test Workflow"]
        DockerBuild["Docker Build & Push"]
        
        Lint --> Test
        Test --> DockerBuild
        DockerBuild --> DockerHub["Docker Hub Registry"]
    end
    
    DockerHub -.-> DevApp
    DockerHub -.-> ProdApp
```

## Infrastructure Diagram

```mermaid
graph TB
    subgraph "Host Machine (Dev)"
        Docker[Docker Engine]
        Docker --> Dev
        Docker --> Prod
        
        subgraph "Dev Stack"
            DApp[App Container<br/>Node 18 Alpine<br/>:3000]
            DNeon[Neon Local<br/>PostgreSQL<br/>:5432]
            DVolume[Volume: .:/app<br/>Volume: /app/node_modules<br/>Volume: ./logs:/app/logs]
        end
        
        subgraph "Prod Stack"
            PApp[App Container<br/>Node 18 Alpine<br/>:3000<br/>CPU: 0.5 limit<br/>Memory: 512M limit]
            PVolume[Volume: ./logs:/app/logs]
        end
    end
    
    subgraph "External Services"
        GH[GitHub Actions]
        DH[Docker Hub]
        NC[Neon Cloud<br/>(Serverless PostgreSQL)]
        AJ[Arcjet Cloud<br/>(Security)]
    end
    
    Dev --> GH
    GH --> DH
    DH --> PApp
    PApp --> NC
    PApp --> AJ
    DApp --> AJ
    DNeon --> DApp
    PApp --> PVolume
    DApp --> DVolume
```

**Diagram Explanation**: Development uses Docker Compose with Neon Local (ephemeral PostgreSQL proxy) and hot-reload volume mounts. Production uses Docker Compose with resource limits, connects to Neon Cloud directly. GitHub Actions build multi-architecture Docker images published to Docker Hub. Arcjet provides cloud-based security services.

## Source Files Evidence

| Diagram | Supporting Files |
|---------|------------------|
| High Level Architecture | `src/app.js`, `src/server.js` |
| Component Diagram | All files in `src/` |
| Module Interaction | `src/controllers/*`, `src/services/*` |
| Dependency Diagram | `package.json` |
| Deployment Architecture | `Dockerfile`, `docker-compose.dev.yml`, `docker-compose.prod.yml` |
| Infrastructure | `Dockerfile`, `.dockerignore`, `scripts/dev.sh`, `scripts/prod.sh` |
