const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('ams_academies').select('*').eq('id', 'aa57bded-2adb-459f-a51b-79d8e033008a').single();
  console.log('default_homework_presets:', data.default_homework_presets);
}
run();
