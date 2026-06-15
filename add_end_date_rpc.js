require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const query = `ALTER TABLE ams_exam_schedules ADD COLUMN IF NOT EXISTS end_date date;`;
  const { data, error } = await supabase.rpc('execute_sql', { sql: query });
  console.log("RPC Error:", error);
  if (error && error.code === 'PGRST202') {
    console.log("execute_sql rpc is not available. Try get_schema_columns or just let the user run it.");
  }
}
run();
