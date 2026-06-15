require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const query = `ALTER TABLE ams_exam_schedules ADD COLUMN IF NOT EXISTS end_date date;`;
  console.log("Checking if column exists by selecting...");
  const { data, error } = await supabase.from('ams_exam_schedules').select('end_date').limit(1);
  if (error && error.code === 'PGRST204') {
    console.log("Column end_date does not exist. Please run migration in Supabase Dashboard.");
    // Wait, since I don't have direct SQL access through supabase-js unless RPC is defined,
    // let me try to just print the SQL needed so the user can run it?
    // Actually, I can use the supabase cli to db push or just fetch if there's a way.
  } else {
    console.log("Select result:", data, error);
  }
}
run();
