from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "ECM System API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "ecm-super-secret-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Database
    DATABASE_URL: str = "postgresql://ecm_user:ecm_password@localhost:5432/ecm_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_BOM_LOCK_TTL: int = 300  # 5 minutes

    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    KAFKA_ECR_TOPIC: str = "ecr-events"
    KAFKA_ECN_TOPIC: str = "ecn-events"
    KAFKA_AUDIT_TOPIC: str = "audit-events"
    KAFKA_NOTIFICATION_TOPIC: str = "notifications"

    # CORS
    ALLOWED_ORIGINS: list = ["http://localhost:3000", "http://localhost:5173", "http://localhost:8080", "*"]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
