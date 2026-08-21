const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
// Service role key required: RLS policies on these tables only allow SELECT,
// so INSERT/UPDATE via the anon key is silently blocked.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { params: { eventsPerSecond: 10 } } });

module.exports = supabase;
