# PULSE Deployment to Railway

**Status:** Ready to deploy  
**Your Railway API Token:** `b69de1fa-16b2-4fd0-928d-acdf52513d9d`

## Step 1: Create PULSE Project on Railway

### Option A: Manual (via Dashboard - Recommended)

1. Go to **https://railway.app/dashboard**
2. Click **+ New Project**
3. Choose **Deploy from GitHub**
4. Or click **+ New** > **Empty Project** if you want to push manually
5. Name it: `PULSE - WhatsApp Orders`
6. Create the project

### Option B: Using Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login (will open browser)
railway login

# Or use your token directly
export RAILWAY_TOKEN="b69de1fa-16b2-4fd0-928d-acdf52513d9d"

# Create project
railway init
# Select: Create new project
# Name: PULSE - WhatsApp Orders
```

---

## Step 2: Add PostgreSQL Database

1. In Railway dashboard, go to your new **PULSE** project
2. Click **+ Add Plugin**
3. Select **PostgreSQL**
4. Configure:
   - Postgres Version: Latest (15+)
   - Username: `postgres`
   - Database: `pulse`
   - Generate password (Railway auto-generates)

**This creates a separate database for PULSE** (NOT reusing ARKAN's Supabase)

---

## Step 3: Create Node.js Service

1. In Railway dashboard, click **+ Add Plugin** or **+ New**
2. Select **Empty Service**
3. Name it: `pulse-server`
4. In the service settings:

### Set Environment Variables

Add these to the PULSE project (Project Settings → Variables):

```
# Shopify App Credentials
SHOPIFY_API_KEY=d8c61a847f375d8b6152386eb14e8f2a
SHOPIFY_API_SECRET=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
SHOPIFY_APP_URL=https://pulse-[RANDOM].railway.app

# Supabase Database (from ARKAN)
SUPABASE_URL=https://ktivzjsneyxulwgvgrlz.supabase.co
SUPABASE_ANON_KEY=sb_publishable_gNgXIP3cTd-_7KbiybqhDQ_sSrb6XUW
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aXZ6anNuZXl4dWx3Z3Zncmx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzYxOTgwMywiZXhwIjoyMDk5MTk1ODAzfQ.s6yt8HD4Ph0DXa9hmfxB_yQF1x3sT2qRb2Y5StiWPVQ

# Server
PORT=3000
NODE_ENV=production
```

### Connect PostgreSQL Service

If using Railway's PostgreSQL:
- Go to your Postgres service
- Copy the connection string from **Variables** tab
- Add to PULSE server as `DATABASE_URL`
- Update server code to use this for order/message storage

OR (Keep using Supabase):
- Skip Railway's Postgres plugin
- Use Supabase only (already in .env)

---

## Step 4: Deploy from Git

### Option 1: Push via Git

```bash
cd C:/Users/mazen moustafa/Desktop/pulse-shopify-app

# Add Railway remote (Railway will show this in dashboard)
railway link [PROJECT_ID]

# Deploy
railway up
```

### Option 2: GitHub Integration

1. Push code to GitHub:
```bash
git init
git add .
git commit -m "Initial PULSE commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pulse-shopify-app.git
git push -u origin main
```

2. In Railway dashboard:
   - Click **Deployments** tab
   - Select **GitHub** as source
   - Connect your GitHub account
   - Choose `pulse-shopify-app` repo
   - Let Railway auto-deploy on every push

---

## Step 5: Set Custom Domain

1. Railway dashboard → **PULSE** project → **pulse-server** service
2. Click **Networking**
3. Under "Domains" → **+ Add Custom Domain**
4. Options:
   - Use Railway's free subdomain: `pulse-xxx.railway.app` (automatic)
   - Or add custom domain: `pulse.arkan-clo.com` (requires DNS setup)

**For Shopify OAuth, you MUST update SHOPIFY_APP_URL** to your Railway domain:
```
SHOPIFY_APP_URL=https://pulse-[YOUR-RANDOM-ID].railway.app
```

---

## Step 6: Test the Deployment

Once deployed, test these endpoints:

```bash
# Health check (should return JSON)
curl https://pulse-[ID].railway.app/health

# OAuth start (will redirect to Shopify)
curl "https://pulse-[ID].railway.app/auth?shop=test.myshopify.com"

# Dashboard
https://pulse-[ID].railway.app/dashboard?shop=test.myshopify.com
```

---

## Step 7: Initialize Supabase Tables

Run the SQL schema on your Supabase project:

1. Go to **Supabase Dashboard** → `ktivzjsneyxulwgvgrlz`
2. **SQL Editor** → **+ New Query**
3. Copy entire content of `supabase-schema.sql`
4. Run the migration
5. Confirm tables created: `customers`, `orders`, `messages`, `preorders`

---

## Cost Breakdown (Monthly)

| Service | Plan | Cost |
|---------|------|------|
| **Railway Node.js** | $20/month | $20 |
| **Railway PostgreSQL** | $15/month (optional) | $15* |
| **Supabase** | Free | $0 |
| **Total** | | **$20-35/mo** |

*If using Railway's Postgres instead of Supabase

---

## Troubleshooting

### Server won't start
- Check logs: Railway dashboard → **Logs** tab
- Verify environment variables are set
- Check `.env` file exists with Shopify credentials

### OAuth redirects failing
- Confirm `SHOPIFY_APP_URL` matches your Railway domain
- Check Shopify app settings → Redirect URIs
- Should be: `https://[YOUR_DOMAIN]/auth/callback`

### Database connection errors
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
- Check Supabase project is active
- Run health check: `/health` should work even if DB is down

### Webhook not receiving orders
- Confirm Railway domain is reachable (not firewall blocked)
- Check webhook URL in Supabase settings
- Verify order insert actually triggers (check Supabase logs)

---

## Next Steps After Deploy

1. ✅ Test Shopify OAuth flow with test store
2. ⭕ Wire up n8n webhook integration
3. ⭕ Create React dashboard UI
4. ⭕ Add WhatsApp message sending
5. ⭕ Beta test with 5-10 real stores
6. ⭕ Launch to Shopify App Store

---

## Key Links

- **Railway Dashboard:** https://railway.app/dashboard
- **Your ARKAN n8n:** https://n8n-production-6b219.up.railway.app
- **Supabase:** https://supabase.co/dashboard
- **Shopify Dev:** https://shopify.dev/docs/admin-api/rest/reference
- **n8n Docs:** https://docs.n8n.io/

---

**Your API Key is saved in memory. Do not commit it to Git!**
**Always use environment variables for secrets.**
