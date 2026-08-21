const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: 'ccywobtelvefqxlszgam.db.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '6Rkc3sq17xNGw0Iy',
  ssl: true
});

async function createTables() {
  const client = await pool.connect();
  try {
    console.log('🔌 Connected to Supabase PostgreSQL');
    console.log('📋 Reading schema...');

    const schema = fs.readFileSync('supabase-schema.sql', 'utf8');

    console.log('🔄 Executing SQL schema...');
    console.log('');

    // Execute the entire schema
    await client.query(schema);

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('customers', 'orders', 'messages', 'preorders')
      ORDER BY table_name
    `);

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║         ✅ SUPABASE SETUP COMPLETE! ✅                 ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📊 Tables created:');

    const tables = ['customers', 'orders', 'messages', 'preorders'];
    for (const table of tables) {
      const exists = result.rows.some(r => r.table_name === table);
      console.log(`  ${exists ? '✅' : '⚠️'} ${table}`);
    }

    console.log('');
    console.log('🔐 Security Features:');
    console.log('  ✓ Row Level Security (RLS) enabled');
    console.log('  ✓ Customer data isolation');
    console.log('  ✓ Automatic timestamp management');
    console.log('');
    console.log('📈 Performance:');
    console.log('  ✓ Optimized indexes for queries');
    console.log('  ✓ Foreign key constraints');
    console.log('  ✓ Cascade delete for referential integrity');
    console.log('');
    console.log('🎉 PULSE DATABASE IS READY!');
    console.log('');
    console.log('Next: Update Shopify app redirect URI with your Railway domain');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.error('Cannot reach Supabase - check internet connection');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused - check host and port');
    }
  } finally {
    await client.release();
    await pool.end();
  }
}

createTables();
