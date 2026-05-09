from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# Use SQLite as fallback for development if PostgreSQL is not available
DATABASE_URL = settings.DATABASE_URL

try:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        echo=settings.DEBUG,
    )
except Exception:
    # Fallback to SQLite for development
    DATABASE_URL = "sqlite:///./ecm_system.db"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=settings.DEBUG,
    )
    logger.warning("PostgreSQL not available, using SQLite fallback")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.models import user, ecr, ecn, bom, approval, audit  # noqa
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")
