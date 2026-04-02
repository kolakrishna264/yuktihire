# ResumeAI Web — Next.js Frontend

Premium SaaS frontend for ResumeAI.

## Quick Start

```bash
cd resumeai-web
npm install
cp .env.example .env.local
# Fill in your Supabase and API URLs
npm run dev
```

Open http://localhost:3000

## Project Structure

```
app/
├── page.tsx              # Root redirect
├── layout.tsx            # Root layout (fonts, providers)
├── providers.tsx         # React Query provider
├── auth/
│   ├── login/page.tsx    # Login with email + Google
│   ├── signup/page.tsx   # Signup
│   └── callback/         # Supabase OAuth callback
├── dashboard/
│   ├── layout.tsx        # Protected layout (Sidebar + TopNav)
│   ├── page.tsx          # Dashboard home
│   ├── profile/          # Master career profile
│   ├── resumes/          # Resume list + editor
│   ├── tailor/           # AI tailoring workspace ← CORE FEATURE
│   ├── jobs/             # Job tracker kanban
│   └── settings/billing/ # Billing + usage
└── marketing/
    ├── page.tsx           # Landing page
    └── pricing/page.tsx   # Pricing page

components/
├── ui/           # Button, Card, Input, Badge, Progress, Skeleton, Avatar
├── layout/       # Sidebar, TopNav
├── dashboard/    # DashboardShell
├── tailor/       # TailorWorkspace, JDInputPanel, SuggestionsList, AtsScorePanel
├── shared/       # AtsScoreRing, KeywordGrid, UpgradeModal, EmptyState
└── jobs/         # Kanban board

lib/
├── api/          # Typed API clients for all backend endpoints
├── hooks/        # React Query hooks for all data
├── supabase/     # Client + server Supabase helpers
└── utils/        # cn(), formatDate(), scoreColor()
```

## Key Design Decisions

- **Server components** for auth checks and initial data (dashboard layout)
- **Client components** for interactive pages (tailor workspace, profile editor)
- **React Query** for all data fetching with optimistic updates
- **Supabase SSR** for server-side auth with cookie management
- **Polling** for tailoring session status (every 2s while PENDING/RUNNING)

## Environment Variables

```
NEXT_PUBLIC_API_URL          FastAPI backend URL
NEXT_PUBLIC_SUPABASE_URL     Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY Supabase anon key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY Stripe key (for future direct integration)
NEXT_PUBLIC_APP_URL          Frontend URL (for OAuth redirects)
```

## Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

Set environment variables in Vercel dashboard → Settings → Environment Variables.
