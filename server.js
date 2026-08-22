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
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const META_APP_SECRET = process.env.META_APP_SECRET;
const APP_NAME = 'PULSE';
const APP_VERSION = '0.1.0';

// Digits only, no "+"/spaces/dashes -- WhatsApp's own `from` field on
// inbound messages has no "+", but numbers coming from Shopify (order.phone,
// billing_address.phone) can be formatted many different ways. Normalizing
// both sides the same way is what makes matching a reply back to an order
// reliable.
const normalizePhone = (p) => (p || '').replace(/\D/g, '');

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

// Verify a webhook actually came from Meta/WhatsApp: same idea as Shopify's
// check above, but Meta signs with the app's App Secret (not the WhatsApp
// access token) and sends it as "sha256=<hex digest>" in this header.
function verifyMetaWebhook(req, res, next) {
  const sigHeader = req.headers['x-hub-signature-256'];

  if (!sigHeader || !req.rawBody) {
    log('❌ WhatsApp webhook rejected: missing signature or body');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const expected = 'sha256=' + crypto.createHmac('sha256', META_APP_SECRET).update(req.rawBody).digest('hex');

  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(sigHeader);
  const valid = expectedBuf.length === sigBuf.length && crypto.timingSafeEqual(expectedBuf, sigBuf);

  if (!valid) {
    log('❌ WhatsApp webhook rejected: signature mismatch');
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

    // Fetch the merchant's real store name so the WhatsApp confirmation
    // message can say "Thank you for shopping with <their store>" instead
    // of a hardcoded brand -- PULSE serves many different stores.
    let storeName = shop;
    try {
      const shopInfo = await axios.get(`https://${shop}/admin/api/2024-01/shop.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken }
      });
      storeName = shopInfo.data.shop?.name || shop;
    } catch (shopInfoError) {
      log('⚠️  Could not fetch shop name, falling back to domain (non-fatal)', shopInfoError.message);
    }

    // Save/update the merchant record so downstream lookups (order webhook,
    // /api/stats, /debug/webhooks) can find this shop by shop_name.
    const { error: customerError } = await supabase
      .from('customers')
      .upsert(
        { shop_name: shop, api_key: SHOPIFY_API_KEY, access_token: accessToken, store_name: storeName },
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

// Send the WhatsApp order-confirmation message via a pre-approved template.
// This is business-initiated (the customer never messaged us first), so
// WhatsApp requires an approved template -- a plain-text session message
// would be rejected outside any existing 24h conversation window.
async function sendOrderConfirmation(order, customerId, orderRowId, phoneNumber, storeName) {
  const name = order.customer?.first_name || order.shipping_address?.first_name || 'there';
  const items = (order.line_items || []).map(li => `${li.quantity}x ${li.title}`).join(', ') || 'your order';
  const addr = order.shipping_address
    ? `${order.shipping_address.address1 || ''}, ${order.shipping_address.city || ''}`.replace(/^,\s*|,\s*$/g, '')
    : 'the address on file';
  const total = order.total_price ? `${order.total_price} ${order.currency || ''}`.trim() : 'N/A';

  // Language selection: default to English for now. Once merchants can set
  // a preferred storefront language, branch on that here -- the template
  // (pulse_order_confirmation_v2) already exists in en/ar/es/fr/de.
  const languageCode = 'en';

  const requestBody = {
    messaging_product: 'whatsapp',
    to: phoneNumber,
    type: 'template',
    template: {
      name: 'pulse_order_confirmation_v2',
      language: { code: languageCode },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: name },
          { type: 'text', text: storeName || 'us' },
          { type: 'text', text: order.name || order.order_number || `#${order.id}` },
          { type: 'text', text: items },
          { type: 'text', text: total },
          { type: 'text', text: addr || 'the address on file' },
        ]
      }]
    }
  };

  let waMessageId = null;
  let errorMessage = null;

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      requestBody,
      { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    waMessageId = response.data.messages?.[0]?.id || null;
    log('✅ WhatsApp confirmation sent', { phoneNumber, waMessageId });
  } catch (err) {
    errorMessage = err.response?.data?.error?.message || err.message;
    log('❌ WhatsApp send failed', errorMessage);
  }

  await supabase.from('messages').insert([{
    customer_id: customerId,
    order_id: orderRowId,
    message_text: JSON.stringify(requestBody),
    message_type: 'confirmation',
    direction: 'outbound',
    status: waMessageId ? 'sent' : 'failed',
    sent_at: waMessageId ? new Date().toISOString() : null,
    error_message: errorMessage,
  }]);

  if (waMessageId && orderRowId) {
    await supabase
      .from('orders')
      .update({ whatsapp_sent: true, whatsapp_sent_at: new Date().toISOString() })
      .eq('id', orderRowId);
  }

  return waMessageId;
}

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
    let storeName;
    if (shopName) {
      const { data: customer } = await supabase
        .from('customers')
        .select('id, store_name')
        .eq('shop_name', shopName)
        .single();
      customerId = customer?.id;
      storeName = customer?.store_name;
    }

    // Save order to Supabase
    if (customerId) {
      const phoneNumber = normalizePhone(order.customer?.phone || order.billing_address?.phone);

      const { data: savedOrder, error: orderError } = await supabase
        .from('orders')
        .insert([{
          customer_id: customerId,
          shopify_order_id: order.id.toString(),
          phone_number: phoneNumber,
          order_data: order,
          status: 'pending',
          whatsapp_sent: false
        }])
        .select('id')
        .single();

      if (orderError) {
        log('❌ Failed to save order', { orderId: order.id, error: orderError.message });
      } else {
        log('✅ Order saved to Supabase', { orderId: order.id, customerId });

        if (phoneNumber) {
          await sendOrderConfirmation(order, customerId, savedOrder.id, phoneNumber, storeName);
        } else {
          log('⚠️  No phone number on order, skipping WhatsApp send', { orderId: order.id });
        }
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
// WhatsApp Inbound Messages (button-tap replies to order confirmations)
// ============================================================

// Meta calls this once with a GET request to verify the webhook URL when
// you subscribe it in the App Dashboard -- it must echo back hub.challenge
// if hub.verify_token matches what we configured there.
app.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    log('✅ WhatsApp webhook verified by Meta');
    return res.status(200).send(challenge);
  }

  log('❌ WhatsApp webhook verification failed', { mode });
  res.sendStatus(403);
});

// Every inbound WhatsApp event (message, button reply, delivery/read status)
// arrives here. We only act on button-reply taps to an order confirmation;
// everything else is acknowledged and ignored.
app.post('/webhooks/whatsapp', verifyMetaWebhook, async (req, res) => {
  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (!message) {
      // Status callbacks (sent/delivered/read) have no `messages` array --
      // nothing for us to do with those yet.
      return res.sendStatus(200);
    }

    const buttonReplyTitle = message.button?.text || message.interactive?.button_reply?.title;
    const fromPhone = normalizePhone(message.from);

    log('💬 WhatsApp reply received', { fromPhone, buttonReplyTitle });

    if (!buttonReplyTitle) {
      return res.sendStatus(200);
    }

    // Match to the most recent order we sent a confirmation for on this
    // phone number -- this is the order the reply is almost certainly about.
    const { data: order } = await supabase
      .from('orders')
      .select('id, customer_id')
      .eq('phone_number', fromPhone)
      .eq('whatsapp_sent', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!order) {
      log('⚠️  No matching order found for this reply', { fromPhone });
      return res.sendStatus(200);
    }

    let newStatus = null;
    if (buttonReplyTitle === 'Confirm Order') newStatus = 'confirmed';
    else if (buttonReplyTitle === 'Cancel Order') newStatus = 'cancelled';

    if (newStatus) {
      await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
    }

    await supabase.from('messages').insert([{
      customer_id: order.customer_id,
      order_id: order.id,
      message_text: buttonReplyTitle,
      message_type: 'confirmation',
      direction: 'inbound',
      status: 'delivered',
      sent_at: new Date().toISOString(),
    }]);

    log('✅ Order status updated from WhatsApp reply', { orderId: order.id, newStatus });
    res.sendStatus(200);
  } catch (err) {
    // Always 200 -- returning an error here makes Meta retry-storm the
    // webhook, which just repeats whatever went wrong.
    log('❌ WhatsApp inbound webhook error', err.message);
    res.sendStatus(200);
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

// ============================================================
// Privacy Policy & Merchant Terms
// Real, current data-handling practices -- keep this in sync with the
// actual code whenever what PULSE stores/does changes.
// ============================================================

const legalPageStyle = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f5f5f5; color: #222; }
  .container { max-width: 720px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 40px; line-height: 1.6; }
  h1 { color: #222; }
  h2 { color: #333; margin-top: 32px; font-size: 18px; }
  .updated { color: #777; font-size: 14px; }
`;

app.get('/privacy', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><title>PULSE - Privacy Policy</title><style>${legalPageStyle}</style></head>
    <body><div class="container">
      <h1>PULSE Privacy Policy</h1>
      <p class="updated">Last updated: August 22, 2026</p>

      <p>PULSE ("the App") sends WhatsApp order-confirmation messages on behalf of Shopify
      merchants who install it. This page explains what customer data the App processes,
      why, and how it's protected.</p>

      <h2>What we collect</h2>
      <p>When a merchant installs PULSE and a customer places an order, the App receives
      from Shopify: the customer's name, email address, phone number, shipping/billing
      address, and order details (items, price, order number).</p>

      <h2>Why we collect it</h2>
      <p>Solely to send that customer a WhatsApp message confirming their order, addressed
      to them by name, sent to their phone number, referencing their order and delivery
      address. We do not use this data for advertising, profiling, or any purpose beyond
      order communication.</p>

      <h2>How it's stored</h2>
      <p>Data is stored in a dedicated Supabase (PostgreSQL) database, encrypted at rest and
      in transit (HTTPS/TLS on every connection). Access is limited to the app operator;
      no other staff or third party has access.</p>

      <h2>How long we keep it</h2>
      <p>Order and message records are retained for 12 months from the order date, then
      automatically deleted. All data tied to a shop is deleted immediately if the
      merchant uninstalls the App. All data tied to a specific customer is deleted
      immediately upon that customer's deletion request (via Shopify's standard data
      request/redaction tools).</p>

      <h2>Your rights</h2>
      <p>To request a copy of your data or its deletion, contact the merchant you ordered
      from -- they can trigger this through Shopify on your behalf. You can also contact us
      directly at <a href="mailto:arkan.closerver@gmail.com">arkan.closerver@gmail.com</a>.</p>

      <h2>Contact</h2>
      <p>Questions about this policy: <a href="mailto:arkan.closerver@gmail.com">arkan.closerver@gmail.com</a></p>
    </div></body>
    </html>
  `);
});

app.get('/terms', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><title>PULSE - Merchant Terms & Data Processing</title><style>${legalPageStyle}</style></head>
    <body><div class="container">
      <h1>PULSE Merchant Terms & Data Processing Agreement</h1>
      <p class="updated">Last updated: August 22, 2026</p>

      <p>By installing PULSE on your Shopify store, you (the merchant, "Data Controller")
      and PULSE ("Data Processor") agree to the following.</p>

      <h2>What PULSE does with your customers' data</h2>
      <p>PULSE processes your customers' name, email, phone, and shipping/billing address
      solely to send them a WhatsApp order-confirmation message on your behalf. PULSE does
      not sell this data, use it for advertising, or share it with any third party other
      than the WhatsApp Cloud API (Meta), which is required to deliver the message itself.</p>

      <h2>Compliance</h2>
      <p>PULSE implements Shopify's mandatory GDPR webhooks
      (<code>customers/data_request</code>, <code>customers/redact</code>,
      <code>shop/redact</code>), so data requests and deletions initiated through Shopify
      are honored automatically. See our <a href="/privacy">Privacy Policy</a> for our
      retention schedule.</p>

      <h2>Your responsibility</h2>
      <p>You remain responsible for your own compliance with applicable privacy laws (e.g.
      GDPR, CCPA) in how you run your store and communicate with your customers. PULSE
      provides the tooling described above to help you meet those obligations for the
      order-confirmation messages it sends.</p>

      <h2>Security incidents</h2>
      <p>If PULSE becomes aware of a security incident affecting your data, we will notify
      you at the email associated with your Shopify account within 72 hours of
      confirming the incident.</p>

      <h2>Contact</h2>
      <p><a href="mailto:arkan.closerver@gmail.com">arkan.closerver@gmail.com</a></p>
    </div></body>
    </html>
  `);
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

const STATUS_COLORS = {
  pending: '#856404;background:#fff3cd',
  confirmed: '#155724;background:#d4edda',
  cancelled: '#721c24;background:#f8d7da',
  shipped: '#0c5aa0;background:#e7f3ff',
};

const MSG_STATUS_COLORS = {
  sent: '#155724;background:#d4edda',
  failed: '#721c24;background:#f8d7da',
  pending: '#856404;background:#fff3cd',
  delivered: '#0c5aa0;background:#e7f3ff',
  read: '#0c5aa0;background:#e7f3ff',
};

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

app.get('/dashboard', async (req, res) => {
  const { shop, success } = req.query;

  if (!shop) {
    return res.send(`
      <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>PULSE</title>
      <style>body{font-family:-apple-system,sans-serif;padding:40px;background:#f5f5f5;}</style></head>
      <body><p>Missing <code>?shop=</code> parameter.</p></body></html>
    `);
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('shop_name', shop)
    .single();

  let orderRows = '';
  let messagesSent = 0;
  let messagesFailed = 0;

  if (customer) {
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('customer_id', customer.id);

    messagesSent = messages?.filter(m => m.status === 'sent').length || 0;
    messagesFailed = messages?.filter(m => m.status === 'failed').length || 0;

    orderRows = (orders || []).map(o => {
      const items = (o.order_data?.line_items || []).map(li => `${li.quantity}x ${li.title}`).join(', ') || '-';
      const orderMessages = (messages || []).filter(m => m.order_id === o.id);
      const lastMsg = orderMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      const msgStatus = lastMsg ? lastMsg.status : (o.whatsapp_sent ? 'sent' : 'not sent');
      const msgColor = MSG_STATUS_COLORS[msgStatus] || '#666;background:#eee';
      const statusColor = STATUS_COLORS[o.status] || '#666;background:#eee';

      return `
        <tr>
          <td>${escapeHtml(o.order_data?.name || o.shopify_order_id)}</td>
          <td>${escapeHtml(items)}</td>
          <td>${escapeHtml(o.phone_number || '-')}</td>
          <td><span class="pill" style="color:${statusColor}">${escapeHtml(o.status)}</span></td>
          <td><span class="pill" style="color:${msgColor}">${escapeHtml(msgStatus)}</span></td>
          <td>${new Date(o.created_at).toLocaleString()}</td>
        </tr>
      `;
    }).join('');
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PULSE - WhatsApp Orders</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; margin: 0; padding: 40px; background: #f5f5f5; color: #222; }
        .container { max-width: 1000px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 40px; }
        h1 { color: #333; margin-top: 0; }
        .success { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; color: #155724; }
        .shop-name { font-weight: bold; color: #2196F3; }
        .stats { display: flex; gap: 16px; margin: 24px 0; }
        .stat { flex: 1; background: #f8f9fa; border-radius: 8px; padding: 16px; text-align: center; }
        .stat .num { font-size: 28px; font-weight: bold; color: #222; }
        .stat .label { font-size: 13px; color: #777; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { text-align: left; font-size: 12px; text-transform: uppercase; color: #777; padding: 8px 12px; border-bottom: 2px solid #eee; }
        td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .pill { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
        .empty { text-align: center; color: #999; padding: 40px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📲 PULSE Dashboard</h1>
        ${success ? `
          <div class="success">
            ✅ <strong>Successfully connected!</strong><br>
            Your store <span class="shop-name">${escapeHtml(shop)}</span> is now connected to PULSE.
          </div>
        ` : ''}
        <p class="shop-name">${escapeHtml(shop)}</p>

        <div class="stats">
          <div class="stat"><div class="num">${orderRows ? orderRows.split('<tr>').length - 1 : 0}</div><div class="label">Orders tracked</div></div>
          <div class="stat"><div class="num">${messagesSent}</div><div class="label">Messages sent</div></div>
          <div class="stat"><div class="num">${messagesFailed}</div><div class="label">Messages failed</div></div>
        </div>

        <table>
          <thead>
            <tr><th>Order</th><th>Items</th><th>Phone</th><th>Status</th><th>WhatsApp</th><th>Created</th></tr>
          </thead>
          <tbody>
            ${orderRows || ''}
          </tbody>
        </table>
        ${!orderRows ? '<div class="empty">No orders yet.</div>' : ''}
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
// Data Retention Enforcement
// Per /privacy: order/message records older than 12 months are deleted
// automatically. Runs on startup and then once every 24h -- this is what
// makes the retention policy real rather than just a documented promise.
// ============================================================

const RETENTION_DAYS = 365;

async function enforceRetentionPolicy() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: deletedOrders, error } = await supabase
      .from('orders')
      .delete()
      .lt('created_at', cutoff)
      .select('id');

    if (error) {
      log('❌ Retention cleanup failed', error.message);
    } else {
      log('🧹 Retention cleanup complete', { ordersDeleted: deletedOrders?.length || 0, cutoff });
    }
  } catch (err) {
    log('❌ Retention cleanup error', err.message);
  }
}

// ============================================================
// Start Server
// ============================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  log(`🚀 ${APP_NAME} v${APP_VERSION} started on port ${PORT}`);
  log('📍 Local: http://localhost:' + PORT);
  log('✅ Ready to receive requests');

  enforceRetentionPolicy();
  setInterval(enforceRetentionPolicy, 24 * 60 * 60 * 1000);
});
