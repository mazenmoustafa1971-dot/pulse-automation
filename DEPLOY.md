# PULSE - Deploy to Railway in 5 Minutes

**Everything is ready!** Just follow these steps:

## Step 1: Create Project on Railway Dashboard

1. Open **https://railway.app/dashboard**
2. Click **+ New Project**
3. Select **Deploy from Git** (or **Empty Project** if deploying manually)
4. Name: `PULSE - WhatsApp Orders`
5. ✅ Project created!

## Step 2: Add Environment Variables

In Railway Dashboard → Project Settings → Variables → Add:

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

**Note:** `${{ RAILWAY_DOMAIN }}` is Railway's dynamic variable that auto-fills your domain

## Step 3: Deploy Code

### Option A: Push via Git (Recommended)

```bash
cd C:/Users/mazen\ moustafa/Desktop/pulse-shopify-app

# Initialize git (if not already)
git init
git add .
git commit -m "Initial PULSE commit"
git branch -M main

# Add remote (from Railway dashboard)
git remote add railway [RAILWAY_GIT_URL]

# Deploy
git push railway main
```

### Option B: Deploy via CLI

```bash
cd C:/Users/mazen\ moustafa/Desktop/pulse-shopify-app
export RAILWAY_TOKEN=b69de1fa-16b2-4fd0-928d-acdf52513d9d
npx railway@latest deploy
```

### Option C: Manual Push via Railway Dashboard

1. Open Railway project
2. Click **Deployments** tab
3. Click **Deploy from Git**
4. Connect your GitHub account
5. Select `pulse-shopify-app` repo
6. Done! Auto-deploys on every push

## Step 4: Set Custom Domain (Optional)

1. Railway Dashboard → PULSE project → **Networking**
2. Your domain will be: `pulse-[RANDOM].railway.app`
3. **Update Shopify OAuth:**
   - Go to your Shopify dev app settings
   - Redirect URI: `https://pulse-[RANDOM].railway.app/auth/callback`

## Step 5: Test Deployment

Once deployed (wait 2-3 min for build):

```bash
# Test health endpoint
curl https://pulse-[RANDOM].railway.app/health

# Expected response:
# {"status":"OK","app":"PULSE","version":"0.1.0","timestamp":"2026-08-21T..."}

# Test dashboard
https://pulse-[RANDOM].railway.app/dashboard
```

## Step 6: Create Supabase Tables

1. Go **Supabase Dashboard** → Project `ktivzjsneyxulwgvgrlz`
2. **SQL Editor** → **+ New Query**
3. Copy all from `supabase-schema.sql` in this folder
4. Run the migration
5. ✅ Tables created: `customers`, `orders`, `messages`, `preorders`

## Files Structure (Ready to Deploy)

```
pulse-shopify-app/
├── server.js                 ✅ Express server (295 lines)
├── supabase.js              ✅ DB client
├── supabase-schema.sql      ✅ Schema (run in Supabase)
├── package.json             ✅ Dependencies
├── Dockerfile               ✅ Docker config
├── railway.json             ✅ Railway config
├── .env                     ✅ Local credentials
├── .env.example             ✅ Template for others
├── .gitignore              ✅ Protect secrets
├── README.md               ✅ Overview
├── SETUP.md                ✅ Setup guide
├── ARCHITECTURE.md         ✅ Technical details
└── node_modules/            ✅ Dependencies
```

## What's Working Now

✅ Shopify OAuth 2.0 flow  
✅ Customer authentication  
✅ API endpoints (stats, health)  
✅ Dashboard page  
✅ Supabase integration  
✅ Comprehensive logging  

## What's Next (After Deploy)

1. Test OAuth with Shopify test store
2. Create n8n webhook integration
3. Build React dashboard UI
4. Add WhatsApp message sending
5. Beta test with real stores
6. Launch to Shopify App Store

## Troubleshooting

**Build fails with "Cannot find module"**
- Railway will auto-run `npm install`
- Check `package.json` has all dependencies listed
- Run locally first: `npm install && npm start`

**Server crashes on start**
- Check Railway logs: Project → **Logs** tab
- Verify all env vars are set
- Ensure `SUPABASE_URL` is accessible

**OAuth not working**
- Confirm `SHOPIFY_APP_URL` matches your Railway domain
- Update Shopify app redirect URI
- Check Shopify API key/secret in .env

## Your Railway Account

- **Dashboard:** https://railway.app/dashboard
- **API Token:** `b69de1fa-16b2-4fd0-928d-acdf52513d9d`
- **Workspace:** "My Projects"
- **Existing Projects:** ARKAN n8n

## Cost

- **Railway $20/month** (Node.js + storage)
- **Supabase free** (shared plan)
- **Total: $20/month**

---

**Ready to deploy? Start with Step 1 now!** 🚀

Questions? Check `RAILWAY_SETUP.md` or `ARCHITECTURE.md` for more details.
