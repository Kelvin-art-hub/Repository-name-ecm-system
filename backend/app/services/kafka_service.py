import json
import logging
from typing import Optional
from datetime import datetime
from app.config import settings

logger = logging.getLogger(__name__)

# Try to import kafka, fall back to logging mock
try:
    from kafka import KafkaProducer
    _producer = KafkaProducer(
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(","),
        value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
        key_serializer=lambda k: k.encode("utf-8") if k else None,
        request_timeout_ms=5000,
        api_version_auto_timeout_ms=5000,
    )
    KAFKA_AVAILABLE = True
    logger.info("Kafka producer connected successfully")
except Exception as e:
    KAFKA_AVAILABLE = False
    _producer = None
    logger.warning(f"Kafka not available, using log fallback: {e}")


class KafkaService:
    """Kafka event publisher with graceful fallback."""

    def publish(self, topic: str, event: dict, key: Optional[str] = None) -> bool:
        event["published_at"] = datetime.utcnow().isoformat()
        try:
            if KAFKA_AVAILABLE and _producer:
                future = _producer.send(topic, value=event, key=key)
                _producer.flush(timeout=5)
                logger.info(f"Kafka event published to {topic}: {event.get('event_type', 'unknown')}")
                return True
            else:
                logger.info(f"[KAFKA-MOCK] Topic={topic} Key={key} Event={json.dumps(event, default=str)}")
                return True
        except Exception as e:
            logger.error(f"Kafka publish error on topic {topic}: {e}")
            return False

    # ECR Events
    def publish_ecr_created(self, ecr_data: dict) -> bool:
        return self.publish(
            settings.KAFKA_ECR_TOPIC,
            {"event_type": "ECR_CREATED", "data": ecr_data},
            key=ecr_data.get("ecr_number"),
        )

    def publish_ecr_approved(self, ecr_data: dict) -> bool:
        return self.publish(
            settings.KAFKA_ECR_TOPIC,
            {"event_type": "ECR_APPROVED", "data": ecr_data},
            key=ecr_data.get("ecr_number"),
        )

    def publish_ecr_rejected(self, ecr_data: dict) -> bool:
        return self.publish(
            settings.KAFKA_ECR_TOPIC,
            {"event_type": "ECR_REJECTED", "data": ecr_data},
            key=ecr_data.get("ecr_number"),
        )

    def publish_ecr_status_changed(self, ecr_data: dict, old_status: str, new_status: str) -> bool:
        return self.publish(
            settings.KAFKA_ECR_TOPIC,
            {"event_type": "ECR_STATUS_CHANGED", "old_status": old_status, "new_status": new_status, "data": ecr_data},
            key=ecr_data.get("ecr_number"),
        )

    # ECN Events
    def publish_ecn_generated(self, ecn_data: dict) -> bool:
        return self.publish(
            settings.KAFKA_ECN_TOPIC,
            {"event_type": "ECN_GENERATED", "data": ecn_data},
            key=ecn_data.get("ecn_number"),
        )

    def publish_ecn_released(self, ecn_data: dict) -> bool:
        return self.publish(
            settings.KAFKA_ECN_TOPIC,
            {"event_type": "ECN_RELEASED", "data": ecn_data},
            key=ecn_data.get("ecn_number"),
        )

    # Audit Events
    def publish_audit_event(self, audit_data: dict) -> bool:
        return self.publish(
            settings.KAFKA_AUDIT_TOPIC,
            {"event_type": "AUDIT_LOG", "data": audit_data},
        )

    # Notification Events
    def publish_notification(self, notification: dict) -> bool:
        return self.publish(
            settings.KAFKA_NOTIFICATION_TOPIC,
            {"event_type": "NOTIFICATION", "data": notification},
        )

    def publish_approval_required(self, ecr_data: dict, approver: str, stage: str) -> bool:
        return self.publish_notification({
            "type": "APPROVAL_REQUIRED",
            "recipient": approver,
            "subject": f"Approval Required: {ecr_data.get('ecr_number')}",
            "message": f"ECR {ecr_data.get('ecr_number')} - {ecr_data.get('title')} requires your approval at stage: {stage}",
            "ecr_data": ecr_data,
        })


kafka_service = KafkaService()
