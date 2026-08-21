# ✅ PULSE Deployment - Complete Automation

**Status:** 95% Done - Just 2 minutes left!

---

## What's Already Done ✅

1. ✅ **PULSE Project Created on Railway**
   - Project ID: `81f6efee-fd2a-4d0f-8ce3-e13ea6c10478`
   - All environment variables added
   - Production environment configured

2. ✅ **Code Committed to Git**
   - All 21 files committed
   - Ready to push

3. ✅ **Backend Server Built**
   - Express.js with Shopify OAuth
   - Supabase integration
   - Health endpoints
   - Dockerfile ready

---

## Step 1: Connect to Railway Dashboard (60 seconds)

Go to: **https://railway.app/project/81f6efee-fd2a-4d0f-8ce3-e13ea6c10478**

You'll see the PULSE project dashboard.

---

## Step 2: Deploy Code (2 options)

### Option A: GitHub Auto-Deploy (EASIEST - 60 seconds)

1. Click **Deployments** tab
2. Click **+ Add Service**
3. Select **"Deploy from GitHub"**
4. Connect your GitHub account
5. Select `pulse-shopify-app` repo (or create it first if needed)
6. ✅ **Done!** Railway auto-deploys on every push

### Option B: Git Push (30 seconds)

```bash
cd "C:/Users/mazen moustafa/Desktop/pulse-shopify-app"

# Get your Railway git URL from Dashboard → Deployments → "Git Push" 
# It looks like: https://git.railway.app/[...].git

git remote add railway [PASTE_RAILWAY_GIT_URL_HERE]
git push -u railway main
```

---

## Step 3: Wait for Deployment

Once code is pushed:
- Railway automatically builds the Docker image
- Deploys to production
- Takes ~2-3 minutes

Monitor at: **Deployments** tab in Railway dashboard

---

## Step 4: Verify Deployment

Once live, test your app:

```bash
# Get your domain from Railway dashboard (will be something like https://pulse-xyz123.railway.app)

curl https://pulse-[ID].railway.app/health

# Should return:
# {"status":"OK","app":"PULSE","version":"0.1.0",...}
```

---

## Step 5: Create Supabase Tables (IMPORTANT!)

Run this ONCE to set up your database:

1. Go to **Supabase Dashboard** → Project `ktivzjsneyxulwgvgrlz`
2. Click **SQL Editor** → **+ New Query**
3. Copy ALL contents from `supabase-schema.sql` in this folder
4. **Run** the migration
5. Verify 4 tables created: `customers`, `orders`, `messages`, `preorders`

---

## What You'll Have After Deploy

✅ PULSE API running on Railway  
✅ Shopify OAuth working  
✅ Supabase database connected  
✅ Dashboard API endpoints live  
✅ Health monitoring active  
✅ Production environment ready  

---

## Your PULSE App URLs

Once deployed (pick your domain from Railway dashboard):

```
Health Check:    https://pulse-[ID].railway.app/health
Dashboard:       https://pulse-[ID].railway.app/dashboard
API Stats:       https://pulse-[ID].railway.app/api/stats?shop=test.myshopify.com
OAuth Start:     https://pulse-[ID].railway.app/auth?shop=test.myshopify.com
```

---

## Quick Checklist

- [ ] Go to Railway dashboard
- [ ] Click Deployments → Add Service → GitHub (or copy git URL)
- [ ] Push code to Railway
- [ ] Wait 2-3 min for build/deploy
- [ ] Test `/health` endpoint
- [ ] Run `supabase-schema.sql` in Supabase
- [ ] Update Shopify app redirect URI with your Railway domain
- [ ] Done! 🎉

---

## Environment Variables (Already Added)

These are already in Railway:
- SHOPIFY_API_KEY
- SHOPIFY_API_SECRET
- SHOPIFY_APP_URL (auto-filled by Railway)
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- PORT (3000)
- NODE_ENV (production)

---

## Files in This Project

```
pulse-shopify-app/
├── server.js                 # Main Express app
├── supabase.js              # DB client
├── package.json             # Dependencies
├── Dockerfile               # Docker config
├── railway.json             # Railway config
├── .env                     # Local secrets (gitignored)
├── .env.example             # Template for others
├── .gitignore               # Protect .env
├── supabase-schema.sql      # Database schema
├── README.md                # Project overview
├── SETUP.md                 # Setup guide
├── ARCHITECTURE.md          # Technical details
└── DEPLOY_NOW.md            # This file
```

---

## Support Links

| Resource | URL |
|----------|-----|
| PULSE Project | https://railway.app/project/81f6efee-fd2a-4d0f-8ce3-e13ea6c10478 |
| Railway Dashboard | https://railway.app/dashboard |
| Supabase Project | https://supabase.co/dashboard/project/ktivzjsneyxulwgvgrlz |
| Shopify Docs | https://shopify.dev/docs/admin-api |
| n8n Docs | https://docs.n8n.io |

---

**That's it! Deploy in 2 minutes and PULSE will be live! 🚀**

Questions? Check `RAILWAY_DEPLOYMENT.md` or `ARCHITECTURE.md` for full details.
