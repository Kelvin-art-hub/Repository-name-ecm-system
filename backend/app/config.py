from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    APP_NAME: str = "ECM System API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "ecm-super-secret-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    DATABASE_URL: str = "sqlite:///./ecm_system.db"
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_BOM_LOCK_TTL: int = 300
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    KAFKA_ECR_TOPIC: str = "ecr-events"
    KAFKA_ECN_TOPIC: str = "ecn-events"
    KAFKA_AUDIT_TOPIC: str = "audit-events"
    KAFKA_NOTIFICATION_TOPIC: str = "notifications"
    CORS_ORIGINS: str = "*"

    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
