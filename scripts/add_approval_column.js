const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  // 1. approval_status 컬럼 추가 (text, 기본값 'none')
  const { error: alterError } = await supabase.rpc('exec_sql', { 
    sql: "ALTER TABLE ams_session_logs ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'none';" 
  });
  
  if (alterError) {
    console.log('RPC 방식 실패, REST API로 시도합니다:', alterError.message);
    // REST API로 직접 시도
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ sql: "ALTER TABLE ams_session_logs ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'none';" })
    });
    console.log('REST 결과:', res.status, await res.text());
  } else {
    console.log('컬럼 추가 성공!');
  }

  // 2. 기존 데이터 마이그레이션: test_result에 approval_status가 있는 레코드 업데이트
  const { data: existing } = await supabase
    .from('ams_session_logs')
    .select('id, test_result')
    .ilike('test_result', '%approval_status%');
  
  console.log('마이그레이션 대상:', existing?.length || 0, '건');
  
  if (existing) {
    for (const row of existing) {
      try {
        const parsed = JSON.parse(row.test_result);
        if (parsed.approval_status) {
          const { error } = await supabase
            .from('ams_session_logs')
            .update({ approval_status: parsed.approval_status })
            .eq('id', row.id);
          console.log(`  ${row.id}: ${parsed.approval_status}`, error ? `에러: ${error.message}` : '성공');
        }
      } catch(e) {}
    }
  }
}
run();
