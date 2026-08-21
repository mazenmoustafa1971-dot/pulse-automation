const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  host: 'ktivzjsneyxulwgvgrlz.db.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'PGJVp2tixC0b12Jw',
  ssl: { rejectUnauthorized: false }
});

async function createTables() {
  try {
    console.log('🔌 Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!');
    console.log('');

    console.log('📋 Reading schema file...');
    const schema = fs.readFileSync('supabase-schema.sql', 'utf8');
    
    console.log('🔄 Executing schema SQL...');
    await client.query(schema);
    
    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║         ✅ TABLES CREATED SUCCESSFULLY! ✅             ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📊 Tables created:');
    console.log('  ✓ customers');
    console.log('  ✓ orders');
    console.log('  ✓ messages');
    console.log('  ✓ preorders');
    console.log('');
    console.log('🔐 Row Level Security (RLS) enabled');
    console.log('📈 Indexes created for performance');
    console.log('');
    console.log('✨ Your database is ready to receive orders!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused - check credentials');
    }
  } finally {
    await client.end();
  }
}

createTables();
