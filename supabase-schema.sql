-- PULSE - WhatsApp Order Automation for Shopify
-- Database Schema for Supabase PostgreSQL
-- Created: August 21, 2026

-- ============================================================
-- Customers Table
-- Stores Shopify store information and API access
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_name TEXT UNIQUE NOT NULL,
  api_key TEXT NOT NULL,
  access_token TEXT NOT NULL,
  plan TEXT DEFAULT 'basic' CHECK (plan IN ('basic', 'pro', 'max')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Customers can only see their own data
CREATE POLICY "customers_own_data" ON customers
  FOR SELECT USING (
    auth.uid()::text = shop_name OR current_user = 'postgres'
  );

-- Index for shop_name lookups
CREATE INDEX idx_customers_shop_name ON customers(shop_name);

-- ============================================================
-- Orders Table
-- Stores orders from Shopify
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  shopify_order_id TEXT NOT NULL,
  phone_number TEXT,
  order_data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'cancelled')),
  whatsapp_sent BOOLEAN DEFAULT FALSE,
  whatsapp_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Customers can only see their own orders
CREATE POLICY "orders_customer_isolation" ON orders
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customers WHERE shop_name = current_user)
    OR current_user = 'postgres'
  );

-- Indexes for common queries
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_shopify_order_id ON orders(shopify_order_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- ============================================================
-- Messages Table
-- Logs all WhatsApp messages sent and received
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  message_text TEXT,
  message_type TEXT CHECK (message_type IN ('confirmation', 'preorder', 'restock', 'cart_recovery', 'return', 'other')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'read')),
  direction TEXT CHECK (direction IN ('outbound', 'inbound')),
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Customers can only see their own messages
CREATE POLICY "messages_customer_isolation" ON messages
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customers WHERE shop_name = current_user)
    OR current_user = 'postgres'
  );

-- Indexes for common queries
CREATE INDEX idx_messages_customer_id ON messages(customer_id);
CREATE INDEX idx_messages_order_id ON messages(order_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- ============================================================
-- Preorders Table
-- Manages pre-order queue (FIFO allocation)
-- ============================================================

CREATE TABLE IF NOT EXISTS preorders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  size TEXT,
  color TEXT,
  queue_position INTEGER NOT NULL,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'confirmed', 'fulfilled', 'declined', 'cancelled')),
  offered_at TIMESTAMP,
  response_at TIMESTAMP,
  fulfilled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE preorders ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Customers can only see their own pre-orders
CREATE POLICY "preorders_customer_isolation" ON preorders
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customers WHERE shop_name = current_user)
    OR current_user = 'postgres'
  );

-- Indexes for common queries
CREATE INDEX idx_preorders_customer_id ON preorders(customer_id);
CREATE INDEX idx_preorders_product_id ON preorders(product_id);
CREATE INDEX idx_preorders_status ON preorders(status);
CREATE INDEX idx_preorders_queue_position ON preorders(queue_position);

-- ============================================================
-- Function: Update updated_at timestamp
-- Automatically updates the updated_at column on any row change
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Attach trigger to all tables with updated_at
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preorders_updated_at BEFORE UPDATE ON preorders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Summary
-- ============================================================
-- Tables created:
-- 1. customers - Store owner info and API access
-- 2. orders - Shopify orders
-- 3. messages - WhatsApp message logs
-- 4. preorders - Pre-order queue management
--
-- Security:
-- - Row-level security enabled on all tables
-- - Customer data isolation via shop_name
-- - Encrypted API keys (handled at app level)
--
-- Indexes:
-- - Optimized for common queries
-- - shop_name, customer_id, status lookups
-- - Time-based sorting (created_at DESC)
--
-- Timestamps:
-- - Auto-updated via trigger on every change
-- - Helps with auditing and debugging
-- ============================================================
