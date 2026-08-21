# PULSE - WhatsApp Order Automation for Shopify

**Status:** In Development (Week 1-2 Complete)

## Quick Start

```bash
npm install
npm start
```

Visit: `http://localhost:3000/health`

---

## Project Overview

**What is PULSE?**
- Shopify app that automates order confirmations via WhatsApp
- Manages pre-order queues (FIFO allocation)
- Recovers abandoned carts
- Tracks inventory and restock offers

**Pricing:**
- BASIC: $9/month (Order confirmations + pre-orders)
- PRO: $29/month (+ Cart recovery + restock)
- MAX: $79/month (+ Broadcasts + A/B testing)

**Tech Stack:**
- Backend: Node.js + Express
- Frontend: React + Shopify Polaris
- Database: Supabase (PostgreSQL)
- Automation: n8n
- Hosting: Railway ($20/month)

---

## Setup Progress

### ✅ Phase 1: Shopify App Setup (COMPLETE)
- [x] Create Shopify dev app
- [x] Add API scopes (7 scopes added)
- [x] Get Client ID & Secret
- [ ] Create test store
- [ ] Install app on test store

### 🔄 Phase 2: Backend Setup (CURRENT - Week 3-4)
- [ ] Setup Node.js server
- [ ] Connect to Supabase
- [ ] Build OAuth flow
- [ ] Test OAuth with test store

### Phase 3: Dashboard (Week 5-6)
- [ ] Build React dashboard
- [ ] Add billing integration
- [ ] Create settings page

### Phase 4: Testing & Launch (Week 7-8)
- [ ] Beta testing
- [ ] Shopify App Store submission
- [ ] Launch

---

## Important Credentials

**⚠️ KEEP .env FILE SECRET - DO NOT COMMIT TO GIT**

See `.env` file (example at `.env.example`)

---

## Shopify App Details

- **App Name:** PULSE - WhatsApp Orders
- **App Type:** Public app
- **Admin API Version:** 2026-07
- **Scopes (7 total):**
  - read_orders
  - write_orders
  - read_customers
  - write_customers
  - read_products
  - read_inventory
  - read_checkouts

---

## Database Schema

**Tables:**
1. `customers` - Store owners who installed app
2. `orders` - Orders from each customer's store
3. `messages` - WhatsApp messages sent/logs
4. `preorders` - Pre-order queue management

See `supabase-schema.sql` for full schema (coming Week 3)

---

## Webhook Endpoints

- `POST /auth` - Start OAuth flow
- `GET /auth/callback` - OAuth callback  
- `POST /webhooks/orders/create` - New order webhook
- `GET /health` - Health check

---

## Environment Variables

Required (in `.env`):
```
SHOPIFY_API_KEY
SHOPIFY_API_SECRET
SHOPIFY_APP_URL
SUPABASE_URL
SUPABASE_ANON_KEY
PORT (default 3000)
NODE_ENV
```

See `.env.example` for template

---

## Testing

**Local Development:**
```bash
npm start
```

**Test OAuth:**
```
http://localhost:3000/auth?shop=your-test-store.myshopify.com
```

---

## Deployment

**Railway:**
1. Push to GitHub
2. Connect Railway to repo
3. Set env vars in Railway dashboard
4. Deploy

See `DEPLOYMENT.md` for detailed steps

---

## Project Resources

- **Shopify API:** https://shopify.dev
- **Supabase Docs:** https://supabase.com/docs
- **Railway Docs:** https://railway.app/docs
- **n8n Docs:** https://docs.n8n.io

---

## Team & Timeline

- **Builder:** arkan.closerver@gmail.com
- **Created:** August 21, 2026
- **Timeline:** 8 weeks to launch
- **Target:** First 10 customers by Week 8

---

## Quick Links

- [Setup Guide](SETUP.md)
- [Architecture](ARCHITECTURE.md)
- [Shopify App Dashboard](https://partners.shopify.com)
- [Supabase Dashboard](https://app.supabase.com)
- [Railway Dashboard](https://railway.app)
