# YuktiHire — Deploy to yuktihire.com

## Architecture
- **Frontend** → Vercel (yuktihire.com)
- **Backend API** → Railway (api.yuktihire.com)
- **Database** → Supabase (already configured)

---

## Step 1 — Get your Supabase JWT Secret

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Open project `yjkbvlyhapwxqjnhqncw`
3. **Project Settings → API**
4. Copy the **JWT Secret** (under "JWT Settings")
5. You'll need this in Step 3

---

## Step 2 — Push code to GitHub

```bash
cd C:\Users\mohan\OneDrive\Desktop\ResumeAI
git init
git add .
git commit -m "initial commit"
# Create a repo at github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/yuktihire.git
git push -u origin main
```

---

## Step 3 — Deploy Backend to Railway

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
2. Select your repo, set **Root Directory** to `apps/api`
3. Railway will auto-detect the `Dockerfile`
4. Click **Variables** and add these environment variables:

```
DATABASE_URL = <your Supabase DATABASE_URL from apps/api/.env>
ANTHROPIC_API_KEY = <your Anthropic API key from console.anthropic.com>
SUPABASE_URL = https://yjkbvlyhapwxqjnhqncw.supabase.co
SUPABASE_JWT_SECRET = <paste JWT secret from Step 1>
FRONTEND_URL = https://yuktihire.com
APP_ENV = production
SECRET_KEY = <generate a random 32-char string, e.g. run: python -c "import secrets; print(secrets.token_hex(32))">
REDIS_URL = (leave empty — Redis is optional)
```

5. Under **Settings → Networking**, click **Generate Domain** (you'll get a `*.railway.app` URL)
6. Then add **Custom Domain**: `api.yuktihire.com`

---

## Step 4 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project → Import Git Repository**
2. Select your repo, set **Root Directory** to `apps/web`
3. Framework preset: **Next.js** (auto-detected)
4. Under **Environment Variables**, add:

```
NEXT_PUBLIC_API_URL = https://api.yuktihire.com/api/v1
NEXT_PUBLIC_SUPABASE_URL = https://yjkbvlyhapwxqjnhqncw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_mW3tP9Y3snEI59WP03Yh6A_FaZ8khiB
NEXT_PUBLIC_APP_URL = https://yuktihire.com
```

5. Click **Deploy**

---

## Step 5 — Connect your domain yuktihire.com

### Frontend (yuktihire.com → Vercel)
1. In Vercel → Project Settings → **Domains**
2. Add `yuktihire.com` and `www.yuktihire.com`
3. Vercel will show you DNS records to add

### Backend (api.yuktihire.com → Railway)
1. In Railway → your service → **Settings → Networking → Custom Domain**
2. Add `api.yuktihire.com`
3. Railway will show you a CNAME target

### DNS Records (add at your domain registrar)
```
Type    Name    Value
A       @       76.76.21.21          (Vercel IP — use what Vercel shows)
CNAME   www     cname.vercel-dns.com
CNAME   api     <value from Railway>
```

---

## Step 6 — Configure Supabase Auth

1. Supabase Dashboard → **Authentication → URL Configuration**
2. Set **Site URL**: `https://yuktihire.com`
3. Add to **Redirect URLs**:
   - `https://yuktihire.com/auth/callback`
   - `http://localhost:3000/auth/callback` (keep for local dev)

---

## Step 7 — Verify deployment

1. Visit `https://yuktihire.com` → should show the app
2. Visit `https://api.yuktihire.com/health` → should return `{"status":"ok"}`
3. Sign up with a new account and test the full flow

---

## Optional — Stripe (for paid plans)

1. Create products in [Stripe Dashboard](https://dashboard.stripe.com)
2. Get your price IDs and add to Railway:
```
STRIPE_SECRET_KEY = sk_live_...
STRIPE_WEBHOOK_SECRET = whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID = price_...
```
3. Add webhook endpoint in Stripe: `https://api.yuktihire.com/api/v1/billing/webhook`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
