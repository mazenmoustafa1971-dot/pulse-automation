# PULSE Setup Guide

Complete step-by-step setup for PULSE development environment.

---

## Week 1-2: Shopify App Creation ✅ COMPLETE

### Step 1: Create App ✅
```
✅ App Name: PULSE - WhatsApp Orders
✅ App Type: Public app
✅ Dashboard: https://partners.shopify.com
```

### Step 2: Configure Scopes ✅
```
✅ read_orders
✅ write_orders
✅ read_customers
✅ write_customers
✅ read_products
✅ read_inventory
✅ read_checkouts
```

### Step 3: Get Credentials ✅
```
✅ Client ID:     d8c61a847f375d8b6152386eb14e8f2a
✅ Client Secret: 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 (KEEP SECRET)
```

### Step 4: Configure URLs ✅
```
✅ App URL: http://localhost:3000
✅ Redirect URL: http://localhost:3000/auth/callback
✅ Webhooks: http://localhost:3000/webhooks/orders/create
```

---

## Week 3-4: Backend Setup (CURRENT)

### Step 1: Initialize Project

```bash
cd pulse-shopify-app
npm init -y
npm install express dotenv axios cors body-parser @supabase/supabase-js
```

### Step 2: Create .env File

```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env and add your real credentials:
# - SHOPIFY_API_KEY
# - SHOPIFY_API_SECRET
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
```

### Step 3: Setup Supabase

1. Go to https://app.supabase.com
2. Create new project (or use existing)
3. Go to Settings → API
4. Copy URL and anon key to `.env`
5. Run SQL to create tables (see next step)

### Step 4: Create Database Tables

Go to Supabase → SQL Editor and run:

```sql
-- Create customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_name TEXT UNIQUE NOT NULL,
  api_key TEXT NOT NULL,
  access_token TEXT NOT NULL,
  plan TEXT DEFAULT 'basic',
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  shopify_order_id TEXT,
  phone_number TEXT,
  whatsapp_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  order_id UUID REFERENCES orders(id),
  message_text TEXT,
  status TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create preorders table
CREATE TABLE preorders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  order_id UUID REFERENCES orders(id),
  product_id TEXT,
  size TEXT,
  color TEXT,
  queue_position INTEGER,
  status TEXT DEFAULT 'waiting',
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE preorders ENABLE ROW LEVEL SECURITY;
```

### Step 5: Test Local Server

```bash
npm start
```

Visit: `http://localhost:3000/health`

Expected response:
```json
{ "status": "OK" }
```

### Step 6: Test OAuth Flow

Visit: `http://localhost:3000/auth?shop=your-test-store.myshopify.com`

You should be redirected to Shopify login.

---

## Week 5-6: Frontend Setup

See DASHBOARD.md

---

## Week 7-8: Testing & Launch

See LAUNCH.md (coming)

---

## Troubleshooting

### "Cannot find module 'express'"
```bash
npm install
```

### Port 3000 already in use
```bash
# Change PORT in .env
PORT=3001
```

### Supabase connection error
- Check `.env` has correct URL and key
- Verify Supabase project is active
- Check network connectivity

### OAuth redirect fails
- Verify redirect URL is set correctly in Shopify dashboard
- Check SHOPIFY_API_KEY and SHOPIFY_API_SECRET

---

## Files Created This Week

```
pulse-shopify-app/
├── README.md              (project overview)
├── SETUP.md              (this file)
├── ARCHITECTURE.md       (system design)
├── .env                  (your credentials - DO NOT COMMIT)
├── .env.example          (template)
├── .gitignore           (ignore node_modules, .env)
├── package.json         (dependencies)
└── package-lock.json    (dependency versions)
```

---

## Next Steps

1. ✅ Initialize npm
2. ✅ Create .env file
3. ✅ Setup Supabase tables
4. → Build server.js (next)
5. → Connect to Supabase
6. → Test OAuth flow

---

## Important Reminders

⚠️ **DO NOT COMMIT .env FILE**
- Add to .gitignore (already done)
- Never share credentials
- Rotate if accidentally exposed

✅ **Test Locally First**
- Always test on http://localhost:3000 before deploying
- Use test Shopify store

---

## Dashboard Links

- Shopify Partner Dashboard: https://partners.shopify.com
- Supabase Dashboard: https://app.supabase.com
- Railway Dashboard: https://railway.app (for Week 8)
- n8n Dashboard: Your local n8n instance
