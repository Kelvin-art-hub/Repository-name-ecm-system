from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.database import init_db, SessionLocal
from app.routers import auth, users, ecr, ecn, bom, approvals, audit, dashboard, ai, governance

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")

    # 1. Create all DB tables
    try:
        init_db()
        logger.info("Database tables ready")
    except Exception as e:
        logger.error(f"DB init failed: {e}")
        raise

    # 2. Seed demo users / ECRs / BOM (skips if already seeded)
    try:
        from app.seed import seed_database
        with SessionLocal() as db:
            seed_database(db)
    except Exception as e:
        logger.warning(f"Main seed skipped: {e}")

    # 3. Seed governance policies and workflow templates (idempotent)
    try:
        from app.services.policy_engine import policy_engine
        with SessionLocal() as db:
            policy_engine.seed_default_policies(db)
        logger.info("Governance policies seeded")
    except Exception as e:
        logger.warning(f"Governance seed skipped: {e}")

    logger.info("Application startup complete")
    yield
    logger.info("Application shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## Enterprise Change Management (ECM) System API

### Demo Credentials
| Username | Password | Role |
|----------|----------|------|
| kelvin | 123 | Admin |
| john.doe | john123 | Senior Engineer |
| jane.smith | jane123 | Manager |
| mike.johnson | mike123 | Engineer |
| alice.brown | alice123 | Approver |
| bob.wilson | bob123 | Viewer |
    """,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

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
app.include_router(governance.router)


@app.get("/", tags=["Health"])
def root():
    return {"name": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running", "docs": "/docs"}


@app.get("/health", tags=["Health"])
def health_check():
    from app.services.redis_service import REDIS_AVAILABLE
    from app.services.kafka_service import KAFKA_AVAILABLE
    return {
        "status": "healthy",
        "database": "connected",
        "redis": "connected" if REDIS_AVAILABLE else "in-memory fallback",
        "kafka": "connected" if KAFKA_AVAILABLE else "logging fallback",
    }
