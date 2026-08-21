#!/bin/bash

# Supabase Credentials
SUPABASE_HOST="ktivzjsneyxulwgvgrlz.db.supabase.co"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres"
SUPABASE_PASSWORD="PGJVp2tixC0b12Jw"
SUPABASE_PORT="5432"

echo "🔌 Connecting to Supabase and creating tables..."
echo ""

# Execute schema file
psql \
  -h "$SUPABASE_HOST" \
  -U "$SUPABASE_USER" \
  -d "$SUPABASE_DB" \
  -p "$SUPABASE_PORT" \
  -f supabase-schema.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║         ✅ SUPABASE TABLES CREATED! ✅                 ║"
  echo "╚════════════════════════════════════════════════════════╝"
  echo ""
  echo "📊 Your database is ready:"
  echo "  ✓ customers table"
  echo "  ✓ orders table"
  echo "  ✓ messages table"
  echo "  ✓ preorders table"
  echo ""
  echo "🔐 Row Level Security enabled"
  echo "✨ PULSE can now receive Shopify orders!"
else
  echo "❌ Error creating tables"
  exit 1
fi
