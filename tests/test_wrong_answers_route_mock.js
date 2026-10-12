/**
 * 🧪 AMS 오답 완료(PATCH) / 삭제(DELETE) 격리 단위 테스트
 * - 실제 배포 대상 빌드 아티팩트(.next/server/app/api/app/v1/wrong-answers/[id]/route.js)의
 *   PATCH 및 DELETE 핸들러를 직접 import/require하여 실행
 * - 원격 연결 없이 Mock globalThis.fetch를 이용해 외부 의존성(Supabase REST API)만 모킹
 * - 검증 항목 (7개):
 *   1. 유효하지 않은/변조된 서명 토큰 401 차단
 *   2. 만료된 토큰 401 차단
 *   3. A학원 토큰으로 B학원 submission_id (sub-b-1) 완료 시도 -> 404 차단 (A/B 학원 격리)
 *   4. A학원 토큰으로 B학원 submission_id (sub-b-1) 삭제 시도 -> 404 차단 (A/B 학원 격리)
 *   5. A학원 토큰으로 A학원 데이터 (sub-a-1) 정상 완료 (200) -> status='completed' 확인
 *   6. A학원 토큰으로 A학원 데이터 (sub-a-1) 정상 삭제 (200) -> DB 삭제 확인
 *   7. 0건 영향(이미 삭제된 건 등) 삭제 시도 시 404 Not Found 반환
 */

const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const { AsyncLocalStorage } = require('node:async_hooks');

// Node.js 환경에서 Next.js 비동기 컨텍스트 바인딩
globalThis.AsyncLocalStorage = AsyncLocalStorage;

const SECRET = 'test-secret-key-32-chars-length!!';
process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://kxyeyptxsdvtodwrljwm.supabase.co';

// 토큰 생성 헬퍼
function createMockToken(payload, customSecret = SECRET) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', customSecret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

// 인메모리 가상 DB 상태
let mockDb = {
  academy_devices: [
    { id: 'dev-a', status: 'active' },
    { id: 'dev-b', status: 'active' },
    { id: 'dev-revoked', status: 'revoked' },
  ],
  academy_modules: [
    { academy_id: 'ams-aca-a', module_code: 'hokmanote', status: 'active' },
    { academy_id: 'ams-aca-b', module_code: 'hokmanote', status: 'active' },
  ],
  academies: [
    { id: 'wa-aca-a-uuid', slug: 'academy-a' },
    { id: 'wa-aca-b-uuid', slug: 'academy-b' },
  ],
  wrong_answer_submissions: [
    { id: 'sub-a-1', academy_id: 'wa-aca-a-uuid', status: 'pending', completed_at: null },
    { id: 'sub-b-1', academy_id: 'wa-aca-b-uuid', status: 'pending', completed_at: null },
  ]
};

// 1. globalThis.fetch를 인터셉트하여 Supabase REST API 호출을 인메모리 mockDb와 매핑
globalThis.fetch = async (url, options = {}) => {
  const urlObj = new URL(String(url));
  const pathname = urlObj.pathname;
  const method = (options.method || 'GET').toUpperCase();
  const searchParams = urlObj.searchParams;

  const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  // 1-1. academy_devices 조회
  if (pathname.includes('/rest/v1/academy_devices')) {
    const devId = searchParams.get('id')?.replace(/^eq\./, '');
    const found = mockDb.academy_devices.find(d => d.id === devId);
    return jsonResponse(found ? [{ id: found.id, status: found.status }] : []);
  }

  // 1-2. academy_modules 조회
  if (pathname.includes('/rest/v1/academy_modules')) {
    const acaId = searchParams.get('academy_id')?.replace(/^eq\./, '');
    const modCode = searchParams.get('module_code')?.replace(/^eq\./, '');
    const found = mockDb.academy_modules.find(m => m.academy_id === acaId && m.module_code === modCode);
    return jsonResponse(found ? [{ status: found.status }] : []);
  }

  // 1-3. academies 조회
  if (pathname.includes('/rest/v1/academies')) {
    const slug = searchParams.get('slug')?.replace(/^eq\./, '');
    const found = mockDb.academies.find(a => a.slug === slug);
    return jsonResponse(found ? [{ id: found.id }] : []);
  }

  // 1-4. wrong_answer_submissions PATCH (수정)
  if (pathname.includes('/rest/v1/wrong_answer_submissions') && method === 'PATCH') {
    const subId = searchParams.get('id')?.replace(/^eq\./, '');
    const acaId = searchParams.get('academy_id')?.replace(/^eq\./, '');
    const body = options.body ? JSON.parse(options.body) : {};

    const target = mockDb.wrong_answer_submissions.find(s => s.id === subId && s.academy_id === acaId);
    if (!target) {
      return jsonResponse([]);
    }
    Object.assign(target, body);
    return jsonResponse([{ id: target.id }]);
  }

  // 1-5. wrong_answer_submissions DELETE (삭제)
  if (pathname.includes('/rest/v1/wrong_answer_submissions') && method === 'DELETE') {
    const subId = searchParams.get('id')?.replace(/^eq\./, '');
    const acaId = searchParams.get('academy_id')?.replace(/^eq\./, '');

    const targetIndex = mockDb.wrong_answer_submissions.findIndex(s => s.id === subId && s.academy_id === acaId);
    if (targetIndex === -1) {
      return jsonResponse([]);
    }
    const [deleted] = mockDb.wrong_answer_submissions.splice(targetIndex, 1);
    return jsonResponse([{ id: deleted.id }]);
  }

  return new Response('Not Found', { status: 404 });
};

// 2. 실제 라우트 모듈 로드
const rootDir = path.resolve(__dirname, '..');
const routeModule = require(path.join(rootDir, '.next/server/app/api/app/v1/wrong-answers/[id]/route.js'));
const { PATCH, DELETE } = routeModule.routeModule.userland;

assert.strictEqual(typeof PATCH, 'function', '실제 PATCH 핸들러가 함수여야 합니다.');
assert.strictEqual(typeof DELETE, 'function', '실제 DELETE 핸들러가 함수여야 합니다.');

// 요청 래퍼 헬퍼
function makeRequest(token, submissionId, method) {
  const headersMap = new Map();
  if (token) {
    headersMap.set('authorization', `Bearer ${token}`);
  }
  return {
    method,
    url: `http://localhost:3000/api/app/v1/wrong-answers/${submissionId}`,
    headers: {
      get: (h) => headersMap.get(h.toLowerCase()) || null
    }
  };
}

async function runTests() {
  console.log('🧪 [실제 route.ts PATCH/DELETE 핸들러 실행 검증 시작]...');

  const tokenA = createMockToken({
    device_id: 'dev-a',
    academy_id: 'ams-aca-a',
    slug: 'academy-a',
    exp: Math.floor(Date.now() / 1000) + 3600
  });

  const tokenB = createMockToken({
    device_id: 'dev-b',
    academy_id: 'ams-aca-b',
    slug: 'academy-b',
    exp: Math.floor(Date.now() / 1000) + 3600
  });

  const invalidToken = createMockToken({
    device_id: 'dev-a',
    academy_id: 'ams-aca-a',
    slug: 'academy-a',
    exp: Math.floor(Date.now() / 1000) + 3600
  }, 'wrong-secret');

  const expiredToken = createMockToken({
    device_id: 'dev-a',
    academy_id: 'ams-aca-a',
    slug: 'academy-a',
    exp: Math.floor(Date.now() / 1000) - 3600
  });

  // Test 1: 위조/서명 불일치 토큰 401 차단
  const req1 = makeRequest(invalidToken, 'sub-a-1', 'PATCH');
  const res1 = await PATCH(req1, { params: Promise.resolve({ id: 'sub-a-1' }) });
  assert.strictEqual(res1.status, 401, 'Test 1 실패: 서명 불일치 토큰은 401이어야 함');
  console.log('✅ Test 1 통과: 위조/서명 불일치 토큰 401 차단');

  // Test 2: 만료된 토큰 401 차단
  const req2 = makeRequest(expiredToken, 'sub-a-1', 'PATCH');
  const res2 = await PATCH(req2, { params: Promise.resolve({ id: 'sub-a-1' }) });
  assert.strictEqual(res2.status, 401, 'Test 2 실패: 만료된 토큰은 401이어야 함');
  console.log('✅ Test 2 통과: 만료 토큰 401 차단');

  // Test 3: A학원 토큰으로 B학원 submission_id (sub-b-1) 완료 시도 -> 차단 (404)
  const req3 = makeRequest(tokenA, 'sub-b-1', 'PATCH');
  const res3 = await PATCH(req3, { params: Promise.resolve({ id: 'sub-b-1' }) });
  assert.strictEqual(res3.status, 404, 'Test 3 실패: 타 학원 데이터 완료 시도는 404여야 함');
  assert.strictEqual(mockDb.wrong_answer_submissions.find(s => s.id === 'sub-b-1').status, 'pending');
  console.log('✅ Test 3 통과: A학원 토큰으로 B학원 데이터 완료 시도 차단 (A/B 학원 격리)');

  // Test 4: A학원 토큰으로 B학원 submission_id (sub-b-1) 삭제 시도 -> 차단 (404)
  const req4 = makeRequest(tokenA, 'sub-b-1', 'DELETE');
  const res4 = await DELETE(req4, { params: Promise.resolve({ id: 'sub-b-1' }) });
  assert.strictEqual(res4.status, 404, 'Test 4 실패: 타 학원 데이터 삭제 시도는 404여야 함');
  assert.ok(mockDb.wrong_answer_submissions.some(s => s.id === 'sub-b-1'));
  console.log('✅ Test 4 통과: A학원 토큰으로 B학원 데이터 삭제 시도 차단 (A/B 학원 격리)');

  // Test 5: A학원 토큰으로 A학원 데이터 (sub-a-1) 정상 완료 (200)
  const req5 = makeRequest(tokenA, 'sub-a-1', 'PATCH');
  const res5 = await PATCH(req5, { params: Promise.resolve({ id: 'sub-a-1' }) });
  assert.strictEqual(res5.status, 200, 'Test 5 실패: 정상 완료 시 200이어야 함');
  const body5 = await res5.json();
  assert.strictEqual(body5.success, true);
  assert.strictEqual(mockDb.wrong_answer_submissions.find(s => s.id === 'sub-a-1').status, 'completed');
  console.log('✅ Test 5 통과: 정상 완료(PATCH) 처리 및 status="completed" 변경 확인');

  // Test 6: A학원 토큰으로 A학원 데이터 (sub-a-1) 정상 삭제 (200)
  const req6 = makeRequest(tokenA, 'sub-a-1', 'DELETE');
  const res6 = await DELETE(req6, { params: Promise.resolve({ id: 'sub-a-1' }) });
  assert.strictEqual(res6.status, 200, 'Test 6 실패: 정상 삭제 시 200이어야 함');
  const body6 = await res6.json();
  assert.strictEqual(body6.success, true);
  assert.ok(!mockDb.wrong_answer_submissions.some(s => s.id === 'sub-a-1'));
  console.log('✅ Test 6 통과: 정상 삭제(DELETE) 처리 및 레코드 제거 확인');

  // Test 7: 이미 삭제된 데이터 재삭제 시도 -> 영향받은 행 0건으로 404 반환
  const req7 = makeRequest(tokenA, 'sub-a-1', 'DELETE');
  const res7 = await DELETE(req7, { params: Promise.resolve({ id: 'sub-a-1' }) });
  assert.strictEqual(res7.status, 404, 'Test 7 실패: 0건 삭제 시 404여야 함');
  console.log('✅ Test 7 통과: 0건 영향 시 404 Not Found 정상 반환 확인');

  console.log('🎉 [실제 route.ts PATCH/DELETE 핸들러] 7개 격리 테스트 전원 통과 완료!');
}

runTests().catch(err => {
  console.error('❌ 테스트 실패:', err);
  process.exit(1);
});
