# ResumeAI API

FastAPI backend for ResumeAI SaaS — AI-powered resume tailoring.

## Quick Start

### 1. Clone and install
```bash
cd resumeai-api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your keys:
# - DATABASE_URL (Supabase Postgres)
# - SUPABASE_JWT_SECRET (from Supabase dashboard → Settings → API)
# - ANTHROPIC_API_KEY
# - STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET
# - REDIS_URL (optional, local Redis or Upstash)
```

### 3. Run development server
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs
Health check: http://localhost:8000/health

## Project Structure

```
resumeai-api/
├── main.py                          # Entry point, router mounting
├── requirements.txt
├── .env.example
└── app/
    ├── core/
    │   ├── config.py                # Settings (pydantic-settings)
    │   ├── database.py              # Async SQLAlchemy engine
    │   └── redis.py                 # Redis cache helpers
    ├── models/                      # SQLAlchemy ORM models
    │   ├── user.py
    │   ├── profile.py
    │   ├── resume.py
    │   ├── tailoring.py
    │   ├── billing.py
    │   └── jobs.py
    ├── middleware/
    │   └── auth.py                  # Supabase JWT verification
    ├── routers/                     # FastAPI route handlers
    │   ├── profiles.py
    │   ├── resumes.py
    │   ├── jobs.py
    │   ├── tailor.py                # Main tailoring endpoint
    │   ├── exports.py
    │   └── billing.py               # Stripe webhooks
    └── services/
        ├── tailoring/
        │   ├── engine.py            # Pipeline orchestrator
        │   ├── jd_parser.py         # Pass 1: JD analysis
        │   ├── gap_analyzer.py      # Pass 2: Gap detection
        │   ├── rewriter.py          # Pass 3: Bullet rewrites
        │   └── ats_scorer.py        # Rules-based ATS scoring
        ├── export/
        │   ├── pdf_gen.py           # WeasyPrint PDF
        │   └── docx_gen.py          # python-docx Word
        └── import_service/
            ├── resume_parser.py     # pdfplumber + AI parsing
            └── url_fetcher.py       # JD URL fetcher

## Key API Endpoints

| Method | Path                          | Description                    |
|--------|-------------------------------|-------------------------------|
| GET    | /health                       | Health check                  |
| GET    | /api/v1/profiles/me           | Get master profile            |
| PATCH  | /api/v1/profiles/me           | Update profile                |
| POST   | /api/v1/profiles/me/import    | Import from resume file       |
| GET    | /api/v1/resumes               | List resumes                  |
| POST   | /api/v1/resumes               | Create resume                 |
| POST   | /api/v1/tailor/analyze-jd     | Parse job description         |
| POST   | /api/v1/tailor                | Run tailoring pipeline        |
| GET    | /api/v1/tailor/{session_id}   | Get tailoring results         |
| POST   | /api/v1/exports               | Export PDF or DOCX            |
| GET    | /api/v1/applications          | List job applications         |
| POST   | /api/v1/billing/create-checkout | Start Stripe checkout       |
| POST   | /api/v1/billing/webhook       | Stripe webhook handler        |
| GET    | /api/v1/usage                 | Usage stats                   |

## Authentication

All endpoints (except /health, /billing/plans, /billing/webhook) require:
```
Authorization: Bearer <supabase_jwt_token>
```

Get the JWT from Supabase Auth after user signs in on the frontend.

## Stripe Webhook Setup

```bash
# Install Stripe CLI
stripe listen --forward-to http://localhost:8000/api/v1/billing/webhook

# Copy the webhook signing secret to STRIPE_WEBHOOK_SECRET in .env
```

## Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway add postgresql
railway add redis
railway up
```

Set environment variables in Railway dashboard.
