# PULSE Railway Deployment - Complete

**✅ Project Created Successfully**

```
Project ID: 81f6efee-fd2a-4d0f-8ce3-e13ea6c10478
Name: PULSE - WhatsApp Orders
Created: 2026-08-21T02:42:52.635Z
Dashboard: https://railway.app/project/81f6efee-fd2a-4d0f-8ce3-e13ea6c10478
```

---

## Step 1: Add Environment Variables

Go to: **https://railway.app/project/81f6efee-fd2a-4d0f-8ce3-e13ea6c10478**

In **Project Settings → Variables**, add:

```
SHOPIFY_API_KEY=d8c61a847f375d8b6152386eb14e8f2a
SHOPIFY_API_SECRET=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
SHOPIFY_APP_URL=${{ RAILWAY_DOMAIN }}
SUPABASE_URL=https://ktivzjsneyxulwgvgrlz.supabase.co
SUPABASE_ANON_KEY=sb_publishable_gNgXIP3cTd-_7KbiybqhDQ_sSrb6XUW
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aXZ6anNuZXl4dWx3Z3Zncmx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzYxOTgwMywiZXhwIjoyMDk5MTk1ODAzfQ.s6yt8HD4Ph0DXa9hmfxB_yQF1x3sT2qRb2Y5StiWPVQ
PORT=3000
NODE_ENV=production
```

**Note:** `${{ RAILWAY_DOMAIN }}` is a Railway variable that auto-fills your domain URL

---

## Step 2: Deploy from Git

### Option A: Push via Git (Recommended)

```bash
cd "C:/Users/mazen moustafa/Desktop/pulse-shopify-app"

# Initialize git
git init
git add .
git commit -m "Initial PULSE commit"
git branch -M main

# Get your Railway git URL from the dashboard
# Go to: Project → Deployments → Connect Repository
# Copy the HTTPS git URL

# Add Railway as remote
git remote add railway https://git.railway.app/[YOUR_WORKSPACE]/[PROJECT_ID].git

# Deploy
git push railway main
```

### Option B: CLI Deploy (if Railway CLI is configured)

```bash
export RAILWAY_TOKEN="b69de1fa-16b2-4fd0-928d-acdf52513d9d"
cd "C:/Users/mazen moustafa/Desktop/pulse-shopify-app"
railway login  # Interactive login
railway link --project 81f6efee-fd2a-4d0f-8ce3-e13ea6c10478
railway up
```

### Option C: Connect GitHub (Easiest)

1. Go to **https://railway.app/project/81f6efee-fd2a-4d0f-8ce3-e13ea6c10478**
2. Click **Deployments** tab
3. Click **+ Add Service** → **Deploy from GitHub**
4. Connect your GitHub account
5. Select `pulse-shopify-app` repository
6. ✅ Railway auto-deploys on every push!

---

## Step 3: Monitor Deployment

1. Go to **Deployments** tab
2. Watch build progress
3. Once deployed, your URL will be: `https://pulse-[RANDOM].railway.app`

---

## Step 4: Configure Shopify OAuth

Update your Shopify app settings:

1. Go to **Shopify Dev** → Your PULSE app
2. Update **Redirect URIs:**
   ```
   https://pulse-[RANDOM].railway.app/auth/callback
   ```

3. Test: Visit `https://pulse-[RANDOM].railway.app/dashboard`

---

## Step 5: Create Supabase Tables

**IMPORTANT:** Run this once to set up your database

1. Go to **Supabase Dashboard** → Project `ktivzjsneyxulwgvgrlz`
2. **SQL Editor** → **+ New Query**
3. Copy all from [`supabase-schema.sql`](./supabase-schema.sql) in this folder
4. **Run** the migration
5. Verify tables created: `customers`, `orders`, `messages`, `preorders`

---

## Step 6: Test Everything

```bash
# Test health endpoint
curl https://pulse-[RANDOM].railway.app/health

# Expected response:
# {"status":"OK","app":"PULSE","version":"0.1.0","timestamp":"..."}

# Test dashboard
# Visit: https://pulse-[RANDOM].railway.app/dashboard

# Test stats API (after OAuth):
# curl "https://pulse-[RANDOM].railway.app/api/stats?shop=test.myshopify.com"
```

---

## Troubleshooting

### Build fails
- Check Railway **Logs** tab for error details
- Verify `Dockerfile` exists in project root
- Ensure `package.json` has all dependencies

### Server crashes on startup
- Check if all environment variables are set
- Verify `SUPABASE_URL` is accessible
- Check Railway logs for error messages

### OAuth redirect fails
- Confirm `SHOPIFY_APP_URL` equals your Railway domain
- Update Shopify app redirect URI
- Verify API key/secret are correct

### Database connection errors
- Test Supabase connectivity
- Verify credentials in environment variables
- Check that schema tables exist

---

## Files Ready to Deploy

```
pulse-shopify-app/
├── server.js                  ✅ Main app (295 lines)
├── supabase.js                ✅ DB client
├── Dockerfile                 ✅ Container config
├── railway.json               ✅ Railway config
├── package.json               ✅ Dependencies
├── .env                       ✅ Local secrets
├── .env.example               ✅ Template
├── .gitignore                 ✅ Protect secrets
├── supabase-schema.sql        ✅ Database schema
└── node_modules/              ✅ Dependencies installed
```

---

## What's Working

✅ Shopify OAuth 2.0 integration  
✅ Customer authentication & storage  
✅ Order webhook listener (placeholder)  
✅ Dashboard API endpoints  
✅ Health monitoring  
✅ Comprehensive logging  
✅ Supabase database integration  

---

## What's Next

After deployment:
1. Test OAuth with Shopify test store
2. Create n8n webhook integration
3. Build React dashboard UI
4. Add WhatsApp message sending
5. Beta test with real stores
6. Submit to Shopify App Store

---

## Quick Reference

| Resource | Link |
|----------|------|
| PULSE Project | https://railway.app/project/81f6efee-fd2a-4d0f-8ce3-e13ea6c10478 |
| Railway Dashboard | https://railway.app/dashboard |
| Supabase Project | https://supabase.co/dashboard (ktivzjsneyxulwgvgrlz) |
| Shopify Dev | https://shopify.dev/docs/admin-api |
| n8n Docs | https://docs.n8n.io/ |

---

## Deployment Status

✅ Project created on Railway  
✅ Dockerfile ready  
✅ Environment config ready  
✅ Supabase schema ready  

⏳ Next: Push code to Railway (Step 2 above)

---

**Your Railway Token:** `b69de1fa-16b2-4fd0-928d-acdf52513d9d`  
**Project ID:** `81f6efee-fd2a-4d0f-8ce3-e13ea6c10478`  
**Created:** 2026-08-21 02:42 UTC
