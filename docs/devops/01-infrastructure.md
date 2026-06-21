# 11. Infrastructure Documentation

## Deployment Strategy

The project uses a **multi-environment Docker deployment** strategy:

| Environment | Database | Configuration | Purpose |
|-------------|----------|---------------|---------|
| **Development** | Neon Local (ephemeral proxy) | `.env.development` | Local development with hot-reload |
| **Production** | Neon Cloud (serverless) | `.env.production` | Production deployment |
| **CI/CD** | Ephemeral (GitHub Actions) | Inline env vars | Automated testing |

## Containers

### Dockerfile (Multi-Stage Build)

```mermaid
graph TB
    subgraph "Docker Build Stages"
        Base[Base Stage<br/>node:18-alpine]
        Dev[Development Stage]
        Prod[Production Stage]
    end
    
    subgraph "Base Stage"
        B1["FROM node:18-alpine"]
        B2["WORKDIR /app"]
        B3["COPY package*.json ./"]
        B4["RUN npm ci --only=production"]
        B5["COPY . ."]
        B6["Create nodejs user (UID 1001)"]
        B7["USER nodejs"]
        B8["EXPOSE 3000"]
        B9["HEALTHCHECK (30s interval)"]
    end
    
    subgraph "Development Stage (FROM base)"
        D1["USER root"]
        D2["RUN npm ci (all deps)"]
        D3["USER nodejs"]
        D4["CMD npm run dev"]
    end
    
    subgraph "Production Stage (FROM base)"
        P1["CMD npm start"]
    end
    
    Base --> B1 --> B2 --> B3 --> B4 --> B5 --> B6 --> B7 --> B8 --> B9
    Base --> Dev
    Base --> Prod
```

| Stage | Key Characteristics |
|-------|---------------------|
| **Base** | Production deps only (`npm ci --only=production`), non-root user, healthcheck |
| **Development** | Full dependencies (including dev), hot-reload via nodemon-like `--watch` |
| **Production** | Minimal image, production deps only, production entrypoint |

**Security Features in Dockerfile**:
- Non-root user (`nodejs`) for defense-in-depth
- Healthcheck for container orchestration
- `npm ci` for deterministic installs
- Cache clean after install

## Docker Compose: Development

```mermaid
graph TB
    subgraph "docker-compose.dev.yml"
        Direction TB
        
        subgraph "Service: neon-local"
            NL["Image: neondatabase/neon_local:latest"]
            NLP["Port: 5432:5432"]
            NLV["Volume: .neon_local/"]
            NLHC["Healthcheck: pg_isready"]
        end
        
        subgraph "Service: app (development)"
            DevApp["Build: Dockerfile (target: development)"]
            DevP["Port: ${PORT:-3000}:3000"]
            Vol1["Volume: .:/app"]
            Vol2["Volume: /app/node_modules"]
            Vol3["Volume: ./logs:/app/logs"]
            Dep["depends_on: neon-local (healthy)"]
            Restart["restart: unless-stopped"]
        end
        
        Net["Network: acquisitions-dev (bridge)"]
        
        DevApp --> NL
        NL --> Net
        DevApp --> Net
    end
```

**Development Features**:
- **Neon Local**: Ephemeral PostgreSQL proxy with database branching
- **Hot Reload**: Volume mounts enable live code changes
- **Node Modules Volume**: Prevents host/node_modules conflicts
- **Logs Volume**: Persists logs outside container
- **Health Check Dependency**: App waits for database readiness

## Docker Compose: Production

```mermaid
graph TB
    subgraph "docker-compose.prod.yml"
        subgraph "Service: app (production)"
            ProdApp["Build: Dockerfile (target: production)"]
            ProdP["Port: ${PORT:-3000}:3000"]
            ProdVol["Volume: ./logs:/app/logs"]
            ProdRestart["restart: unless-stopped"]
            
            subgraph "Resource Limits"
                CPU["cpus: 0.5"]
                Mem["memory: 512M"]
                ResCPU["reservations: 0.25 CPU"]
                ResMem["reservations: 256M"]
            end
            
            HC["Healthcheck: 30s interval, 10s timeout, 3 retries, 40s start period"]
        end
        
        ProdNet["Network: acquisitions-prod (bridge)"]
        ProdNeon["Neon Cloud DB (external)"]
        
        ProdApp --> ProdNet
        ProdApp --> ProdNeon
    end
```

**Production Features**:
- Resource limits (CPU/memory reservations + hard limits)
- Health check with longer start period (40s for cold starts)
- Direct connection to Neon Cloud (no local proxy)
- Logs persistence volume
- Restart policy: unless-stopped

## Infrastructure Diagram

```mermaid
graph TB
    subgraph "Local Development"
        DEV[Developer Machine]
        DockerDev[Docker Engine]
        NeoLocal[Neon Local :5432]
        AppDev[App Dev :3000]
        
        DEV --> DockerDev
        DockerDev --> AppDev
        DockerDev --> NeoLocal
        AppDev --> NeoLocal
    end
    
    subgraph "CI/CD (GitHub Actions)"
        GH[GitHub]
        LintJob[Lint & Format]
        TestJob[Tests]
        BuildJob[Docker Build & Push]
        
        GH -.-> LintJob
        LintJob --> TestJob
        TestJob --> BuildJob
    end
    
    subgraph "Container Registry"
        DH[Docker Hub]
        AM64["Image: linux/amd64"]
        ARM64["Image: linux/arm64"]
        Tags["Tags: branch, SHA, latest, timestamp"]
    end
    
    subgraph "Production"
        ProdServer[Production Server]
        DockerProd[Docker Engine]
        AppProd[App Prod :3000]
        NeoCloud[Neon Cloud PostgreSQL]
        
        ProdServer --> DockerProd
        DockerProd --> AppProd
        AppProd --> NeoCloud
    end
    
    BuildJob --> DH
    DH --> AM64
    DH --> ARM64
    DH --> Tags
    AM64 -.-> DockerProd
    ARM64 -.-> DockerProd
```

## Deployment Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub
    participant GHA as GitHub Actions
    participant DH as Docker Hub
    participant Prod as Production Server
    
    Dev->>GH: git push main
    
    GH->>GHA: Trigger workflows
    
    par Lint
        GHA->>GHA: Run ESLint
        GHA->>GHA: Run Prettier check
    and Test
        GHA->>GHA: npm ci
        GHA->>GHA: npm test
        GHA->>GHA: Upload coverage
    end
    
    Note over GHA: All checks must pass
    
    GHA->>GHA: Set up Docker Buildx
    GHA->>GHA: Log in to Docker Hub
    GHA->>GHA: Build multi-arch image (amd64 + arm64)
    GHA->>DH: Push image with tags
    
    Note over Prod: Manual / automated deploy
    
    Prod->>DH: docker pull <image>
    Prod->>Prod: docker compose down
    Prod->>Prod: docker compose up -d
    Prod->>Prod: Run migrations
    Prod->>Prod: Health check
```

## Source Files Evidence

| Component | File |
|-----------|------|
| Multi-stage Dockerfile | `Dockerfile` |
| Dev compose | `docker-compose.dev.yml` |
| Prod compose | `docker-compose.prod.yml` |
| Docker ignore | `.dockerignore` |
| Dev startup script | `scripts/dev.sh` |
| Prod startup script | `scripts/prod.sh` |
| CI/CD Docker build | `.github/workflows/docker-build-and-push.yml` |
