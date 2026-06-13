const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('ams_session_logs')
    .select('student_id, session_date, test_result')
    .eq('session_date', today)
    .not('test_result', 'is', null);
  
  console.log('오늘 날짜:', today);
  console.log('test_result가 있는 세션:', data?.length);
  data?.forEach(d => {
    console.log(`  학생: ${d.student_id}, test_result: ${d.test_result}`);
  });
}
run();
