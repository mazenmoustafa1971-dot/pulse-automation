const fs = require('fs');
const axios = require('axios');

const SUPABASE_URL = 'https://ktivzjsneyxulwgvgrlz.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aXZ6anNuZXl4dWx3Z3Zncmx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzYxOTgwMywiZXhwIjoyMDk5MTk1ODAzfQ.s6yt8HD4Ph0DXa9hmfxB_yQF1x3sT2qRb2Y5StiWPVQ';

async function setupDatabase() {
  try {
    console.log('📋 Reading schema file...');
    const schema = fs.readFileSync('supabase-schema.sql', 'utf8');

    console.log('🔄 Executing schema via Supabase API...');

    // Split by statements and execute
    const statements = schema.split(';').filter(s => s.trim().length > 0);

    for (const statement of statements) {
      if (!statement.trim().startsWith('--')) {
        await axios.post(
          `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
          { sql: statement + ';' },
          {
            headers: {
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
              'apikey': SERVICE_ROLE_KEY,
            },
          }
        );
      }
    }

    console.log('✅ Database schema created successfully!');
    console.log('✅ Tables: customers, orders, messages, preorders ready!');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);

    // Fallback: provide manual SQL command
    console.log('\n📝 If API fails, manually run in Supabase SQL Editor:');
    console.log('1. Go to: https://supabase.co/dashboard/project/ktivzjsneyxulwgvgrlz');
    console.log('2. SQL Editor → + New Query');
    console.log('3. Copy contents of supabase-schema.sql');
    console.log('4. Click Run');
  }
}

setupDatabase();
