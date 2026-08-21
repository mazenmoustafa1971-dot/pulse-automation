# PULSE Architecture

Complete system architecture and data flow for PULSE WhatsApp Order Automation.

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│              SHOPIFY APP STORE                          │
│       (Customer installs PULSE app)                     │
└────────────────────┬────────────────────────────────────┘
                     │ OAuth Authorization
                     ▼
┌─────────────────────────────────────────────────────────┐
│            RAILWAY (Node.js Server)                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │  OAuth Handler                                   │   │
│  │  - Redirect to Shopify login                     │   │
│  │  - Exchange code for access token                │   │
│  │  - Save customer to database                     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Webhook Receiver                                │   │
│  │  - Listen for: orders/create                     │   │
│  │  - Trigger n8n workflows                         │   │
│  │  - Log to database                               │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Dashboard API                                   │   │
│  │  - GET /api/stats (orders, messages)             │   │
│  │  - POST /api/settings (config)                   │   │
│  │  - GET /api/logs (message history)               │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Port: 3000 (Local), Railway URL (Production)           │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────────┐      ┌──────────────────┐
│ SUPABASE         │      │ n8n (Automation) │
│ (PostgreSQL)     │      │                  │
│                  │      │ Workflows:       │
│ Tables:          │      │ - Order confirm  │
│ • customers      │      │ - Pre-order mgmt │
│ • orders         │      │ - Cart recovery  │
│ • messages       │      │ - Restock offer  │
│ • preorders      │      │ - Returns tracking
│                  │      │                  │
│ Row-level        │      │ External APIs:   │
│ Security (RLS)   │      │ • WhatsApp Cloud │
│                  │      │ • Resend Email   │
└──────────────────┘      └──────────────────┘
```

---

## Data Flow

### Flow 1: Customer Installs App

```
1. Customer goes to Shopify App Store
   ↓
2. Finds "PULSE - WhatsApp Orders"
   ↓
3. Clicks "Add app"
   ↓
4. Shopify redirects to: /auth?shop=their-store.myshopify.com
   ↓
5. Our server (Railway) redirects to Shopify login
   ↓
6. Customer authorizes app (sees requested scopes)
   ↓
7. Shopify redirects back to: /auth/callback?code=xxx&shop=xxx
   ↓
8. Our server exchanges code for access token
   ↓
9. Access token saved in Supabase (customers table)
   ↓
10. Customer redirected to dashboard
    ↓
11. ✅ App is now active for their store
```

### Flow 2: New Order Placed

```
1. Customer places order on Shopify store
   ↓
2. Shopify webhook: POST /webhooks/orders/create
   ↓
3. Our server receives webhook
   ↓
4. Log order to Supabase (orders table)
   ↓
5. Trigger n8n webhook
   ↓
6. n8n workflow starts:
   ├─ Get customer's WhatsApp number
   ├─ Check if order in stock
   ├─ If IN STOCK:
   │  ├─ Send WhatsApp confirmation
   │  ├─ Wait for customer reply
   │  └─ Update order status
   │
   └─ If OUT OF STOCK:
      ├─ Add to pre-order queue
      ├─ Send pre-order message
      └─ Wait for restock
   ↓
7. ✅ Order processed
```

### Flow 3: Customer Confirms Order

```
1. Customer receives WhatsApp message
   ↓
2. Taps "Ship It" / "Cancel" / "Edit" button
   ↓
3. WhatsApp sends reply to n8n
   ↓
4. n8n processes reply:
   ├─ Ship It: → Dispatch to Bosta
   ├─ Cancel: → Mark cancelled
   └─ Edit: → Escalate to human
   ↓
5. Update order status in Supabase
   ↓
6. Send confirmation to customer
   ↓
7. ✅ Order fulfilled
```

### Flow 4: Pre-order & Restock

```
1. Item out of stock
   ↓
2. Customer added to pre-order queue (Supabase: preorders table)
   ↓
3. Item comes back in stock
   ↓
4. Shopify inventory webhook
   ↓
5. n8n receives: "Inventory changed"
   ↓
6. Query pre-order queue for this product
   ↓
7. Get first customer in queue
   ↓
8. Send WhatsApp: "Your item is back! Ship it?"
   ↓
9. Customer replies:
   ├─ YES: → Dispatch to Bosta, remove from queue
   └─ NO: → Offer to next customer in queue
   ↓
10. ✅ Restock allocated (FIFO)
```

---

## Component Details

### 1. Node.js Server (Railway)

**Responsibilities:**
- OAuth flow
- Webhook receiver
- Database connector
- n8n orchestrator

**Key Endpoints:**
```
GET  /auth                           → Start OAuth
GET  /auth/callback                  → OAuth callback
POST /webhooks/orders/create         → New order webhook
GET  /health                         → Health check
POST /api/settings                   → Save settings
GET  /api/stats                      → Get stats
```

**Libraries:**
- Express: HTTP server
- Axios: HTTP requests
- Supabase: Database client
- Dotenv: Environment variables

---

### 2. Supabase (PostgreSQL)

**Responsibilities:**
- Store customer data (encrypted API keys)
- Log orders & messages
- Manage pre-order queue
- Row-level security (each customer sees only their data)

**Tables:**

**customers**
```
├─ id (UUID, primary key)
├─ shop_name (TEXT, unique)
├─ api_key (TEXT, encrypted)
├─ access_token (TEXT, encrypted)
├─ plan (TEXT: basic/pro/max)
└─ created_at (TIMESTAMP)
```

**orders**
```
├─ id (UUID, primary key)
├─ customer_id (UUID, foreign key)
├─ shopify_order_id (TEXT)
├─ phone_number (TEXT)
├─ whatsapp_sent (BOOLEAN)
├─ status (TEXT: pending/confirmed/shipped/cancelled)
└─ created_at (TIMESTAMP)
```

**messages**
```
├─ id (UUID, primary key)
├─ customer_id (UUID, foreign key)
├─ order_id (UUID, foreign key)
├─ message_text (TEXT)
├─ status (TEXT: pending/sent/failed)
├─ sent_at (TIMESTAMP)
└─ created_at (TIMESTAMP)
```

**preorders**
```
├─ id (UUID, primary key)
├─ customer_id (UUID, foreign key)
├─ order_id (UUID, foreign key)
├─ product_id (TEXT)
├─ size (TEXT)
├─ color (TEXT)
├─ queue_position (INTEGER)
├─ status (TEXT: waiting/offered/confirmed/cancelled)
└─ created_at (TIMESTAMP)
```

---

### 3. n8n (Automation)

**Responsibilities:**
- Listen to Shopify webhooks
- Execute workflows
- Send WhatsApp messages
- Manage pre-order queue
- Retry failed messages

**12 Workflows:**

**Live (11):**
1. Shopify Order Intake
2. Order Confirmation (Normal)
3. Order Confirmation (Pre-order)
4. Button Reply Handler (Normal)
5. Button Reply Handler (Pre-order)
6. Restock Allocation (FIFO)
7. Restock Confirmation Handler
8. Restock Expiration Checker
9. No-Response Auto Tagging
10. Estebdal Return/Exchange Notification
11. Send Review Request

**Paused (1):**
12. Instagram AI Reply Dispatcher

---

### 4. External APIs

**Shopify:**
- OAuth 2.0
- Admin API
- Webhooks (orders, inventory)

**WhatsApp Cloud API (Meta):**
- Send messages
- Receive replies
- Message templates
- Customer pays for messages

**n8n:**
- Your self-hosted or cloud instance
- Receives webhooks from Shopify
- Sends to WhatsApp

**Supabase:**
- PostgreSQL database
- Row-level security
- Real-time subscriptions

---

## Security Model

### API Key Management
```
Shopify API Key
  ↓ (encrypted in transit via OAuth)
  ↓ (stored in Supabase, encrypted at rest)
  ↓
Access Token stored per customer
  ↓
Used only by Node.js server to call Shopify API
  ↓
Never exposed to frontend
```

### Data Isolation (RLS)
```
Row-Level Security in Supabase:
  ├─ Each customer_id row is private
  ├─ Customers can only query their own data
  ├─ API enforces via service_role_key (server-side only)
  └─ Frontend uses anon key (read-only)
```

### Webhook Verification
```
Shopify sends webhook with HMAC signature
  ↓
Our server verifies signature matches our API secret
  ↓
Only valid webhooks are processed
```

---

## Deployment (Week 8+)

### Railway Deployment
```
1. GitHub repo pushed
2. Railway auto-detects Node.js project
3. Builds: npm install
4. Runs: npm start
5. Sets env vars in Railway dashboard
6. Assigns URL: https://pulse-xxxx.railway.app
```

### Update Shopify URLs
```
After deployed to Railway:
  ├─ App URL: https://pulse-xxxx.railway.app
  ├─ Redirect URL: https://pulse-xxxx.railway.app/auth/callback
  └─ Webhook URL: https://pulse-xxxx.railway.app/webhooks/orders/create
```

---

## Monitoring & Debugging

### Logs
- Railway: Real-time logs in dashboard
- Supabase: Query logs in dashboard
- n8n: Workflow execution logs

### Alerts
- Order webhook fails: Check Railway logs
- WhatsApp message fails: Check n8n logs
- Database query fails: Check Supabase logs

---

## Scaling Strategy

**Current (MVP):**
- 1 Node.js server ($20/mo Railway)
- 1 Supabase database (FREE tier)
- Can handle: ~50-100 customers

**Stage 2 (10-50 customers):**
- Same server ($20 Railway)
- Upgrade Supabase ($100/mo)
- Can handle: ~500 customers

**Stage 3 (100+ customers):**
- Upgrade Node.js ($50 Railway)
- Upgrade Supabase ($100 Railway)
- Add caching layer
- Can handle: 5,000+ customers

---

## Architecture Decisions

**Why Node.js + Express?**
- Fast, lightweight
- Perfect for webhook handling
- Easy to deploy on Railway
- Good TypeScript support later

**Why Supabase over alternatives?**
- PostgreSQL (robust)
- Row-level security (perfect for multi-tenant)
- Real-time subscriptions
- Free tier for testing
- Open source

**Why n8n for automation?**
- Visual workflow builder
- Pre-built Shopify + WhatsApp nodes
- Easy to modify without code
- Can scale to custom code when needed
- You already have it running

**Why Railway for hosting?**
- Simple git-to-deploy
- Great for Node.js
- $20/mo is very cheap
- Good for startups

---

## Version History

- **v0.1:** Initial setup (this document)
- **v0.2:** OAuth + Supabase (Week 3-4)
- **v0.3:** Dashboard (Week 5-6)
- **v0.4:** Testing & Launch (Week 7-8)
- **v1.0:** Production release
