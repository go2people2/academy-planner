/**
 * 💡 [SECURITY] SUPABASE_SERVICE_ROLE_KEY를 사용하므로 반드시 서버/로컬 환경에서만 실행하십시오.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// .env.local 또는 .env 파일로드
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Supabase URL 또는 SERVICE_ROLE_KEY가 환경 변수에 없습니다.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * 💡 페이지네이션을 사용하여 모든 Auth 유저를 끝까지 순회 조회합니다.
 */
async function listAllAuthUsers() {
  let allUsers: any[] = [];
  let page = 1;
  const perPage = 1000;
  
  while (true) {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage
    });
    
    if (error) throw error;
    if (users.length === 0) break;
    
    allUsers = [...allUsers, ...users];
    if (users.length < perPage) break;
    page++;
  }
  return allUsers;
}

async function migrate() {
  console.log('🚀 [START] Supabase Auth 마이그레이션 실행 중...');

  try {
    // 1. 필요한 컬럼만 조회
    const [authUsers, { data: teachers, error: fErr }] = await Promise.all([
      listAllAuthUsers(),
      supabaseAdmin.from('ams_teachers').select('id, login_id, password, name, role, academy_id, user_id')
    ]);

    if (fErr) throw new Error(`교사 데이터 조회 실패: ${fErr.message}`);
    if (!teachers) return;

    for (const t of teachers) {
      // 💡 이미 연결된 계정은 건너뛰기
      if (t.user_id) {
        console.log(`[PASS] ${t.name}: 이미 연결됨 (User ID: ${t.user_id})`);
        continue;
      }

      const loginId = t.login_id.trim().toLowerCase();
      const targetEmail = `${loginId}@hokma-academy.com`;
      console.log(`[분석 중] ${t.name} (${targetEmail})`);

      // 2. 이메일 중복 체크 (소문자 기준)
      let authUser = authUsers.find(u => u.email?.toLowerCase() === targetEmail);
      let userId = authUser?.id;

      const appMetadata = { 
        role: t.role || 'teacher', 
        academy_id: t.academy_id,
        teacher_id: t.id 
      };

      if (!authUser) {
        console.log(`[생성] 새 계정 생성 시도...`);
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: targetEmail,
          password: t.password, // 평문 비밀번호 이전
          email_confirm: true,
          app_metadata: appMetadata
        });

        if (createErr) {
          console.error(`[오류] ${t.name} 계정 생성 실패:`, createErr.message);
          continue;
        }
        userId = newUser.user.id;
        // 같은 실행 중 중복 생성 방지를 위해 메모리 배열에 추가
        authUsers.push(newUser.user);
      } else {
        console.log(`[매칭] 기존 Auth 계정 발견 (ID: ${userId}). 메타데이터 동기화 시도...`);
        const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(userId!, {
          app_metadata: appMetadata
        });
        if (uErr) {
          console.warn(`[주의] ${t.name} 메타데이터 갱신 실패 (무시하고 진행):`, uErr.message);
        }
      }

      // 3. ams_teachers 테이블과 user_id 최종 연결 (이중 연결 방지 보호)
      const { error: linkErr } = await supabaseAdmin
        .from('ams_teachers')
        .update({ user_id: userId })
        .eq('id', t.id)
        .is('user_id', null);

      if (linkErr) {
        console.error(`[연결 실패] ${t.name}:`, linkErr.message);
      } else {
        console.log(`[성공] ${t.name} (ID: ${t.id}) 계정 연결 완료`);
      }
    }

    console.log('✅ [DONE] 모든 마이그레이션이 성공적으로 종료되었습니다.');
  } catch (err) {
    console.error('❌ [FATAL] 마이그레이션 도중 치명적 오류 발생:', err);
  }
}

migrate();
