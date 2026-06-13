const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  // approval_status가 포함된 모든 레코드 검색
  const { data } = await supabase
    .from('ams_session_logs')
    .select('student_id, session_date, test_result')
    .ilike('test_result', '%approval_status%')
    .order('session_date', { ascending: false })
    .limit(10);
  
  console.log('approval_status 포함 레코드:', data?.length);
  data?.forEach(d => {
    console.log(`  날짜: ${d.session_date}, 학생: ${d.student_id}, result: ${d.test_result}`);
  });
}
run();
