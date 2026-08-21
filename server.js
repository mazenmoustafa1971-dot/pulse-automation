const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const supabase = require('./supabase');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
// Capture the exact raw request body so webhook HMAC signatures can be
// verified against the untouched bytes Shopify signed (re-serialized JSON
// can differ in key order/whitespace and would fail verification).
app.use(bodyParser.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(bodyParser.urlencoded({ extended: true }));

// Constants
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL;
const APP_NAME = 'PULSE';
const APP_VERSION = '0.1.0';

// Logging
const log = (message, data = '') => {
  console.log(`[${new Date().toISOString()}] ${message}`, data);
};

// Verify a webhook request actually came from Shopify by recomputing the
// HMAC over the raw body with the app's client secret and comparing it,
// in constant time, to the signature Shopify sent.
function verifyShopifyWebhook(req, res, next) {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];

  if (!hmacHeader || !req.rawBody) {
    log('❌ Webhook rejected: missing HMAC header or body');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const digest = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(req.rawBody)
    .digest('base64');

  const digestBuf = Buffer.from(digest);
  const headerBuf = Buffer.from(hmacHeader);

  const valid = digestBuf.length === headerBuf.length && crypto.timingSafeEqual(digestBuf, headerBuf);

  if (!valid) {
    log('❌ Webhook rejected: HMAC mismatch');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

// ============================================================
// OAuth Flow
// ============================================================

// Step 1: Redirect to Shopify OAuth
app.get('/auth', (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    log('❌ OAuth error: Missing shop parameter');
    return res.status(400).json({ error: 'Shop parameter required' });
  }

  // Validate shop format
  if (!shop.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/)) {
    log('❌ OAuth error: Invalid shop format', shop);
    return res.status(400).json({ error: 'Invalid shop format' });
  }

  const scopes = 'write_orders,read_orders,read_customers,write_customers,read_products,read_inventory,read_checkouts';
  const redirectUri = `${SHOPIFY_APP_URL}/auth/callback`;
  const state = Math.random().toString(36).substring(7); // Simple state token

  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;

  log('✅ OAuth started', { shop, state });
  res.redirect(authUrl);
});

// Step 2: Handle OAuth callback
app.get('/auth/callback', async (req, res) => {
  const { shop, code, state } = req.query;

  if (!shop || !code) {
    log('❌ OAuth callback error: Missing shop or code');
    return res.status(400).json({ error: 'Missing shop or code' });
  }

  try {
    log('🔄 Exchanging code for access token', { shop });

    // Exchange code for access token
    const response = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      {
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code: code,
      }
    );

    const accessToken = response.data.access_token;

    if (!accessToken) {
      log('❌ No access token received', response.data);
      return res.status(500).json({ error: 'Failed to get access token' });
    }

    log('✅ Access token received', { shop });

    // Save/update the merchant record so downstream lookups (order webhook,
    // /api/stats, /debug/webhooks) can find this shop by shop_name.
    const { error: customerError } = await supabase
      .from('customers')
      .upsert(
        { shop_name: shop, api_key: SHOPIFY_API_KEY, access_token: accessToken },
        { onConflict: 'shop_name' }
      );

    if (customerError) {
      log('❌ Failed to save customer', { shop, error: customerError.message });
      return res.status(500).json({ error: 'Failed to save merchant', details: customerError.message });
    }

    log('✅ Customer saved to Supabase', { shop });
    log('✅ OAuth complete - webhook registration next', { shop });

    // Register webhook for orders (REST API)
    try {
      log('🔗 Registering order webhook', { shop });

      const webhookResponse = await axios.post(
        `https://${shop}/admin/api/2024-01/webhooks.json`,
        {
          webhook: {
            topic: 'orders/create',
            address: `${SHOPIFY_APP_URL}/webhooks/orders/create`,
            format: 'json'
          }
        },
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      if (webhookResponse.data.webhook) {
        log('✅ Webhook registered successfully', { shop, webhookId: webhookResponse.data.webhook.id });
      } else {
        log('⚠️  Webhook response', webhookResponse.data);
      }
    } catch (webhookError) {
      log('⚠️  Webhook registration error (non-fatal)', webhookError.message);
    }

    // Redirect to dashboard
    res.redirect(`/dashboard?shop=${shop}&success=true`);
  } catch (error) {
    log('❌ OAuth callback error', error.message);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
});

// ============================================================
// Webhook Handlers
// ============================================================

// Webhook: New order created
app.post('/webhooks/orders/create', verifyShopifyWebhook, async (req, res) => {
  try {
    const order = req.body;
    // Shopify sends the originating shop's domain in this header on every
    // webhook delivery (Express lowercases header names).
    const shopName = req.headers['x-shopify-shop-domain'];

    log('📦 New order webhook received', {
      orderId: order.id,
      customerEmail: order.email,
      customerPhone: order.customer?.phone || order.billing_address?.phone
    });

    // Get customer record to link order
    let customerId;
    if (shopName) {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('shop_name', shopName)
        .single();
      customerId = customer?.id;
    }

    // Save order to Supabase
    if (customerId) {
      const { data: savedOrder, error: orderError } = await supabase
        .from('orders')
        .insert([{
          customer_id: customerId,
          shopify_order_id: order.id.toString(),
          phone_number: order.customer?.phone || order.billing_address?.phone,
          order_data: order,
          status: 'pending',
          whatsapp_sent: false
        }]);

      if (orderError) {
        log('❌ Failed to save order', { orderId: order.id, error: orderError.message });
      } else {
        log('✅ Order saved to Supabase', { orderId: order.id, customerId });
      }
    } else {
      log('⚠️  Could not find customer for order', { orderId: order.id });
    }

    res.status(200).json({ success: true, orderId: order.id });
  } catch (error) {
    log('❌ Webhook error', error.message);
    res.status(500).json({ error: 'Webhook failed' });
  }
});

// ============================================================
// Mandatory GDPR Compliance Webhooks
// Every Shopify app that can access customer data must implement these
// three -- Shopify won't approve a Protected Customer Data request until
// they exist and respond correctly.
// ============================================================

// A customer asked the merchant for a copy of their data.
// Shopify requires the merchant be able to provide it within 30 days --
// PULSE doesn't have an automated export yet, so this logs what's on file
// (linked by phone number, the only customer identifier PULSE stores)
// for manual fulfillment.
app.post('/webhooks/customers/data_request', verifyShopifyWebhook, async (req, res) => {
  const { shop_domain, customer } = req.body;
  log('📋 GDPR data request received', { shop: shop_domain, customerId: customer?.id });

  try {
    const { data: cust } = await supabase
      .from('customers')
      .select('id')
      .eq('shop_name', shop_domain)
      .single();

    if (cust && customer?.phone) {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, shopify_order_id, created_at')
        .eq('customer_id', cust.id)
        .eq('phone_number', customer.phone);
      log('📋 PULSE data on file for this customer', { orderRows: orders?.length || 0 });
    }
  } catch (err) {
    log('⚠️  Data request lookup error (non-fatal)', err.message);
  }

  res.status(200).json({ success: true });
});

// A customer asked the merchant to delete their data.
app.post('/webhooks/customers/redact', verifyShopifyWebhook, async (req, res) => {
  const { shop_domain, customer } = req.body;
  log('🗑️  GDPR customer redact received', { shop: shop_domain, customerId: customer?.id });

  try {
    const { data: cust } = await supabase
      .from('customers')
      .select('id')
      .eq('shop_name', shop_domain)
      .single();

    if (cust && customer?.phone) {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('customer_id', cust.id)
        .eq('phone_number', customer.phone);

      if (error) log('❌ Failed to redact customer orders', error.message);
      else log('✅ Customer orders redacted', { shop: shop_domain });
    }
  } catch (err) {
    log('❌ Customer redact error', err.message);
  }

  res.status(200).json({ success: true });
});

// The shop uninstalled the app; sent ~48h later. Delete everything tied to
// this shop. ON DELETE CASCADE on orders/messages/preorders means removing
// the customer row takes all of it with it.
app.post('/webhooks/shop/redact', verifyShopifyWebhook, async (req, res) => {
  const { shop_domain } = req.body;
  log('🗑️  GDPR shop redact received', { shop: shop_domain });

  try {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('shop_name', shop_domain);

    if (error) log('❌ Failed to redact shop', error.message);
    else log('✅ Shop data redacted', { shop: shop_domain });
  } catch (err) {
    log('❌ Shop redact error', err.message);
  }

  res.status(200).json({ success: true });
});

// ============================================================
// Dashboard API
// ============================================================

// Get dashboard stats
app.get('/api/stats', async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter required' });
    }

    log('📊 Getting stats for', shop);

    // Get customer info
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_name', shop)
      .single();

    if (customerError) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get order stats
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customer.id);

    if (ordersError) {
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }

    // Get message stats
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('customer_id', customer.id);

    if (messagesError) {
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    const stats = {
      shop: shop,
      plan: customer.plan,
      ordersProcessed: orders?.length || 0,
      messagesSent: messages?.filter(m => m.status === 'sent').length || 0,
      messagesFailed: messages?.filter(m => m.status === 'failed').length || 0,
      createdAt: customer.created_at,
    };

    res.json(stats);
  } catch (error) {
    log('❌ Stats API error', error.message);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ============================================================
// Debug & Health Check
// ============================================================

// Debug: Check webhook registration for a shop
app.get('/debug/webhooks', async (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).json({ error: 'Shop parameter required' });
  }

  try {
    const { data: customer } = await supabase
      .from('customers')
      .select('access_token')
      .eq('shop_name', shop)
      .single();

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const webhooksResponse = await axios.post(
      `https://${shop}/admin/api/2024-01/graphql.json`,
      {
        query: `
          query {
            webhookSubscriptions(first: 10) {
              edges {
                node {
                  id
                  topic
                  endpoint {
                    __typename
                  }
                }
              }
            }
          }
        `
      },
      {
        headers: {
          'X-Shopify-Access-Token': customer.access_token,
          'Content-Type': 'application/json'
        }
      }
    );

    const webhooks = webhooksResponse.data.data?.webhookSubscriptions?.edges || [];
    res.json({
      shop,
      webhookCount: webhooks.length,
      webhooks: webhooks.map(w => ({
        topic: w.node.topic,
        id: w.node.id
      }))
    });
  } catch (error) {
    log('❌ Debug webhook check error', error.message);
    res.status(500).json({ error: 'Failed to check webhooks', details: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    app: APP_NAME,
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// Dashboard Page (Simple HTML)
// ============================================================

app.get('/dashboard', (req, res) => {
  const { shop, success } = req.query;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PULSE - WhatsApp Orders</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; margin: 0; padding: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 40px; }
        h1 { color: #333; margin-top: 0; }
        .success { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; color: #155724; }
        .info { background: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 4px; color: #0c5aa0; }
        .shop-name { font-weight: bold; color: #2196F3; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎉 Welcome to PULSE</h1>
        ${success ? `
          <div class="success">
            ✅ <strong>Successfully connected!</strong><br>
            Your store <span class="shop-name">${shop}</span> is now connected to PULSE.
          </div>
        ` : ''}
        <div class="info">
          <strong>Next Steps:</strong><br>
          1. Set up your WhatsApp integration<br>
          2. Configure your order templates<br>
          3. Test your first automated order
        </div>
        <p>Dashboard coming soon! For now, check the API:</p>
        <code>GET /api/stats?shop=${shop || 'your-store.myshopify.com'}</code>
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

// ============================================================
// 404 Handler
// ============================================================

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ============================================================
// Error Handler
// ============================================================

app.use((err, req, res, next) => {
  log('❌ Unhandled error', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================
// Start Server
// ============================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  log(`🚀 ${APP_NAME} v${APP_VERSION} started on port ${PORT}`);
  log('📍 Local: http://localhost:' + PORT);
  log('✅ Ready to receive requests');
});
