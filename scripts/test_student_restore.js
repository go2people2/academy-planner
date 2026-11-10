/**
 * 💡 학생 복귀(Restore) 로직 및 RPC 실패 방어 검증 스크립트
 * 
 * 실제 구현 파일(lib/concurrency/studentRestore.ts)의 소스 코드를 직접 읽어와
 * 런타임에서 실행하여, 코드 변경 사항과 계약이 일치하는지 정밀 검증합니다.
 * 
 * 실행:
 *   node scripts/test_student_restore.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. lib/concurrency/studentRestore.ts 원본 파일 로드 및 타입 제거
const tsFilePath = path.join(__dirname, '../lib/concurrency/studentRestore.ts');
const tsCode = fs.readFileSync(tsFilePath, 'utf8');

// TypeScript 인터페이스 및 타입 애노테이션 제거하여 JS 함수 추출
const jsCode = tsCode
  .replace(/import\s+[\s\S]*?from\s+['"].*?['"];?/g, '')
  .replace(/export\s+interface\s+[\s\S]*?\n\}/g, '')
  .replace(/export\s+async\s+function/, 'async function')
  .replace(/:\s*SupabaseClient/g, '')
  .replace(/:\s*Promise<.*?>/g, '')
  .replace(/:\s*string\s*\|\s*null\s*\|\s*undefined/g, '')
  .replace(/:\s*string/g, '');

const evalContext = {};
const runner = new Function('exports', `${jsCode}; exports.restoreStudent = restoreStudent;`);
runner(evalContext);
const { restoreStudent } = evalContext;

async function runTests() {
  console.log('=== [1] 실제 lib/concurrency/studentRestore.ts 구현 검증 ===');

  // -------------------------------------------------------------
  // Test 1: ams_restore_student RPC 부재 시 (함수 미존재 오류)
  // 기대 결과: 상태 변경 없이 503 RESTORE_NOT_READY 반환
  // -------------------------------------------------------------
  let studentUpdated = false;
  const mockSupabaseMissingRpc = {
    rpc: async (fnName, params) => {
      assert.strictEqual(fnName, 'ams_restore_student');
      return {
        data: null,
        error: {
          code: '42883',
          message: 'function public.ams_restore_student(uuid, uuid, uuid) does not exist',
        },
      };
    },
    from: () => ({
      update: () => {
        studentUpdated = true;
        return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) };
      },
    }),
  };

  const res1 = await restoreStudent('acad-001', 'stud-001', null, mockSupabaseMissingRpc);
  console.log('Test 1 (RPC 부재 시):', res1);
  assert.strictEqual(res1.success, false);
  assert.strictEqual(res1.error_code, 'RESTORE_NOT_READY', '에러 코드가 RESTORE_NOT_READY 여야 합니다.');
  assert.strictEqual(studentUpdated, false, 'RPC가 없을 때는 클라이언트에서 학생 상태를 절대 변경하지 않아야 합니다.');
  console.log('✅ PASS: RPC 부재 시 클라이언트 fallback 없이 즉시 RESTORE_NOT_READY 반환 (무변경 보장)');

  // -------------------------------------------------------------
  // Test 2: ams_restore_student 정상 실행 시 (복구 성공)
  // -------------------------------------------------------------
  const mockSupabaseSuccess = {
    rpc: async (fnName, params) => {
      return {
        data: {
          success: true,
          status: 'restored',
          student_id: 'stud-001',
          teacher_id: 'teacher-active-01',
          teacher_assignment_status: 'RESTORED_PREVIOUS',
          message: '이전 담당 교사로 자동 배정되었습니다.',
        },
        error: null,
      };
    },
  };

  const res2 = await restoreStudent('acad-001', 'stud-001', null, mockSupabaseSuccess);
  console.log('Test 2 (정상 복원):', res2);
  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.status, 'restored');
  assert.strictEqual(res2.teacher_id, 'teacher-active-01');
  assert.strictEqual(res2.teacher_assignment_status, 'RESTORED_PREVIOUS');
  console.log('✅ PASS: RPC 정상 복원 시 규격 일치 확인');

  // -------------------------------------------------------------
  // Test 3: 이미 재원 중인 대상의 반복 복원 요청 (멱등성 보장)
  // -------------------------------------------------------------
  const mockSupabaseAlreadyActive = {
    rpc: async (fnName, params) => {
      return {
        data: {
          success: true,
          status: 'already_active',
          student_id: 'stud-001',
          teacher_id: 'teacher-existing-01',
          teacher_assignment_status: 'MAINTAINED_EXISTING',
          message: '이미 재원 중인 학생입니다. 기존 담당 교사를 유지합니다.',
        },
        error: null,
      };
    },
  };

  const res3 = await restoreStudent('acad-001', 'stud-001', null, mockSupabaseAlreadyActive);
  console.log('Test 3 (이미 재원생 멱등 요청):', res3);
  assert.strictEqual(res3.success, true);
  assert.strictEqual(res3.status, 'already_active');
  assert.strictEqual(res3.teacher_assignment_status, 'MAINTAINED_EXISTING');
  console.log('✅ PASS: 이미 재원생인 경우 200 already_active 반환 및 기존 교사 유지 확인');

  // -------------------------------------------------------------
  // Test 4: 이전 교사 퇴사로 미배정 복원 시 안내 사유 포함 확인
  // -------------------------------------------------------------
  const mockSupabaseUnassigned = {
    rpc: async (fnName, params) => {
      return {
        data: {
          success: true,
          status: 'restored',
          student_id: 'stud-001',
          teacher_id: null,
          teacher_assignment_status: 'UNASSIGNED_PREVIOUS_TEACHER_INACTIVE',
          message: '이전 담당 교사가 퇴사(또는 비활성)하여 미배정 상태로 복귀되었습니다.',
        },
        error: null,
      };
    },
  };

  const res4 = await restoreStudent('acad-001', 'stud-001', null, mockSupabaseUnassigned);
  console.log('Test 4 (이전 교사 퇴사로 미배정 복원):', res4);
  assert.strictEqual(res4.success, true);
  assert.strictEqual(res4.teacher_id, null);
  assert.strictEqual(res4.teacher_assignment_status, 'UNASSIGNED_PREVIOUS_TEACHER_INACTIVE');
  assert.ok(res4.message.includes('퇴사'), '사유 안내 메시지가 포함되어야 합니다.');
  console.log('✅ PASS: 이전 교사 퇴사 시 미배정(null) 복원 및 사유 안내 확인');

  console.log('\n=============================================');
  console.log('🎉 모든 실제 구현 함수 테스트가 100% 통과했습니다.');
  console.log('=============================================');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
