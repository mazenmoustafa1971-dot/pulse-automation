const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const supabase = require('./supabase');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
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

    // Save to Supabase
    log('💾 Saving customer to Supabase', { shop });

    const { data, error } = await supabase
      .from('customers')
      .upsert(
        [
          {
            shop_name: shop,
            api_key: SHOPIFY_API_KEY,
            access_token: accessToken,
            plan: 'basic',
          }
        ],
        { onConflict: 'shop_name' }
      );

    if (error) {
      log('❌ Supabase error', error);
      return res.status(500).json({ error: 'Failed to save customer', details: error.message });
    }

    log('✅ Customer saved', { shop, plan: 'basic' });

    // Register webhook for orders
    try {
      log('🔗 Registering order webhook', { shop });

      const webhookResponse = await axios.post(
        `https://${shop}/admin/api/2024-01/graphql.json`,
        {
          query: `
            mutation CreateWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
              webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
                webhookSubscription {
                  id
                  topic
                  endpoint {
                    __typename
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: {
            topic: 'ORDERS_CREATE',
            webhookSubscription: {
              callbackUrl: `${SHOPIFY_APP_URL}/webhooks/orders/create`,
              format: 'JSON'
            }
          }
        },
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      const errors = webhookResponse.data.data?.webhookSubscriptionCreate?.userErrors;
      if (errors && errors.length > 0) {
        log('⚠️  Webhook registration warning', errors);
      } else {
        log('✅ Webhook registered successfully', { shop });
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
app.post('/webhooks/orders/create', async (req, res) => {
  try {
    const order = req.body;
    const shopHeader = req.headers['x-shopify-shop-api-access-token'];

    // Get shop name from the webhook - Shopify sends it in the header or we parse it from order
    let shopName = shopHeader;
    if (!shopName || shopName.length > 100) {
      // Fallback: extract from referer or try to find from database
      shopName = req.headers.referer?.match(/https:\/\/([^.]+\.[^.]+\.myshopify\.com)/)?.[1];
    }

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
// Health Check
// ============================================================

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
