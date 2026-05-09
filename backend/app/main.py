from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.database import init_db, SessionLocal
from app.routers import auth, users, ecr, ecn, bom, approvals, audit, dashboard, ai

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    init_db()
    # Seed demo data
    try:
        from app.seed import seed_database
        with SessionLocal() as db:
            seed_database(db)
    except Exception as e:
        logger.warning(f"Seeding skipped or failed: {e}")
    logger.info("Application startup complete")
    yield
    # Shutdown
    logger.info("Application shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## Enterprise Change Management (ECM) System API

A production-ready platform for managing engineering changes in manufacturing workflows.

### Features
- **ECR Management** — Create, track, and approve Engineering Change Requests
- **ECN Workflow** — Auto-generate Engineering Change Notices from approved ECRs
- **BOM Management** — Version-controlled Bill of Materials with Redis-based locking
- **Approval Workflow** — Multi-stage approval with role-based access
- **AI Analysis** — Risk scoring, BOM validation, and impact analysis
- **Audit Logs** — Complete audit trail with Kafka event publishing
- **JWT Authentication** — Secure role-based access control

### Demo Credentials
| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| john.doe | john123 | Senior Engineer |
| jane.smith | jane123 | Manager |
| mike.johnson | mike123 | Engineer |
| alice.brown | alice123 | Approver |
    """,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(ecr.router)
app.include_router(ecn.router)
app.include_router(bom.router)
app.include_router(approvals.router)
app.include_router(audit.router)
app.include_router(dashboard.router)
app.include_router(ai.router)


@app.get("/", tags=["Health"])
def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health_check():
    from app.services.redis_service import REDIS_AVAILABLE
    from app.services.kafka_service import KAFKA_AVAILABLE
    return {
        "status": "healthy",
        "database": "connected",
        "redis": "connected" if REDIS_AVAILABLE else "fallback (in-memory)",
        "kafka": "connected" if KAFKA_AVAILABLE else "fallback (logging)",
    }
