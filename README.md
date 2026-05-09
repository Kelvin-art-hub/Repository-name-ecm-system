# ECM System — Enterprise Change Management Platform

A production-ready, full-stack Engineering Change Management system for manufacturing and engineering workflows.

## Architecture

```
bom2/
├── backend/                    # FastAPI Python backend
│   ├── app/
│   │   ├── main.py             # FastAPI app entry point
│   │   ├── config.py           # Settings (env-based)
│   │   ├── database.py         # SQLAlchemy + fallback
│   │   ├── seed.py             # Demo data seeder
│   │   ├── models/             # SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── ecr.py
│   │   │   ├── ecn.py
│   │   │   ├── bom.py
│   │   │   ├── approval.py
│   │   │   └── audit.py
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── routers/            # FastAPI route handlers
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── ecr.py
│   │   │   ├── ecn.py
│   │   │   ├── bom.py
│   │   │   ├── approvals.py
│   │   │   ├── audit.py
│   │   │   ├── dashboard.py
│   │   │   └── ai.py
│   │   └── services/           # Business logic services
│   │       ├── auth.py         # JWT authentication
│   │       ├── ai_service.py   # AI risk analysis
│   │       ├── redis_service.py # BOM locking
│   │       ├── kafka_service.py # Event publishing
│   │       └── audit_service.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
├── frontend/                   # React + TypeScript frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── contexts/AuthContext.tsx
│   │   ├── lib/
│   │   │   ├── api.ts          # Axios API client
│   │   │   └── utils.ts        # Helpers
│   │   ├── components/Layout.tsx
│   │   └── pages/
│   │       ├── LoginPage.tsx
│   │       ├── Dashboard.tsx
│   │       ├── ECRPage.tsx
│   │       ├── ECNPage.tsx
│   │       ├── BOMPage.tsx
│   │       ├── ApprovalsPage.tsx
│   │       ├── AuditPage.tsx
│   │       ├── AIPage.tsx
│   │       └── UsersPage.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
└── docker-compose.yml
```

## Quick Start (Local Development)

### Backend

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend auto-detects available services:
- **PostgreSQL** → falls back to SQLite if unavailable
- **Redis** → falls back to in-memory store if unavailable
- **Kafka** → falls back to logging if unavailable

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

### Docker (Full Stack)

```bash
docker-compose up -d
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Swagger Docs: http://localhost:8000/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- Kafka: localhost:9092

## Demo Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| john.doe | john123 | Senior Engineer |
| jane.smith | jane123 | Manager |
| mike.johnson | mike123 | Engineer |
| alice.brown | alice123 | Approver |
| bob.wilson | bob123 | Viewer |

## Features

### Authentication
- JWT-based authentication with configurable expiry
- Role-based access control (Admin, Engineer, Manager, Approver, Viewer)
- Secure password hashing (bcrypt with sha256 fallback)

### ECR Management
- Create, edit, submit, approve/reject Engineering Change Requests
- Multi-stage approval workflow (Engineering Review → Manager Approval → Final Release)
- Status tracking with full lifecycle management

### ECN Workflow
- Auto-generate ECNs from approved ECRs
- Track ECN lifecycle through release stages
- Revision level management

### BOM Management
- Hierarchical BOM tree with unlimited nesting
- Version control with snapshot history
- Redis-based locking to prevent concurrent edits
- AI-powered consistency validation

### AI Analysis
- Risk scoring (1–10) based on change type, priority, and description
- Affected parts identification
- BOM consistency validation with missing component suggestions
- Quantity change impact analysis
- System-level insights

### Audit Logs
- Complete audit trail for all user actions
- Filterable by action, entity type, and user
- Action distribution analytics

### Kafka Events
- ECR created/approved/rejected events
- ECN generated/released events
- Audit log events
- Notification events for approval requests

## API Documentation

Swagger UI: http://localhost:8000/docs  
ReDoc: http://localhost:8000/redoc

## Environment Variables

See `backend/.env` for all configuration options.
