# 보안 위험 분석 및 앱 완성 후 최종 점검 체크리스트
**문서 생성일**: 2026-10-21  
**문서 위치**: `docs/SECURITY_AUDIT_CHECKLIST.md`  
**목적**: AMS 및 지혜의 노트 v3 앱 완성 후, 운영 배포 전 반드시 확인해야 할 보안 취약점과 최종 점검 항목을 관리합니다.

---

## 📌 배경 및 원칙
현재 운영 중인 v2(호크마노트) 및 개발 중인 지혜의 노트 v3 모바일 앱의 서비스 중단을 방지하기 위해, RLS(행 단위 보안) 전면 차단은 즉각 적용하지 않고 격리 상태로 관리하고 있습니다.  
앱 전체 구현이 완료된 후, 아래 항목을 순차적으로 점검하고 운영에 반영합니다.

---

## 🚨 잠재적 보안 위험 분석 (Risk Analysis)

### 1. 비로그인(anon) 및 브라우저 클라이언트의 직접 명부 조회 (SELECT 노출)
- **현상**: Supabase `anon` 키로 `ams_teachers`, `ams_students`, `ams_session_logs` 테이블을 직접 `SELECT` 가능한 상태입니다.
- **위험**: 비인가자 또는 퇴사 교사가 브라우저 개발자 도구 콘솔/네트워크 탭에서 학생 및 교사 전체 명부(전화번호, 관리 메모 등)를 조회할 수 있습니다.
- **최종 점검 방안**:
  - [ ] 지혜의 노트 v3 및 모바일 앱의 실제 데이터 조회 경로(서버 API 경유 여부) 확인
  - [ ] `ams_teachers`, `ams_students`, `ams_session_logs` 테이블의 RLS 활성화 (`ENABLE ROW LEVEL SECURITY`)
  - [ ] `anon` 역할의 직접 SELECT 권한 차단 또는 공개 필수 컬럼 뷰(View)로 제한

---

### 2. 퇴사 교사 / 퇴원 학생의 브라우저 직접 수정 (UPDATE/DELETE 변조)
- **현상**: 기존에 발급받은 유효 세션(JWT)을 가진 교사 또는 학생이 브라우저 콘솔에서 Supabase 직접 쿼리를 실행할 수 있습니다.
- **위험**:
  - 퇴사 교사가 `UPDATE ams_teachers SET is_deleted = false, role = 'admin'`을 실행하여 본인 계정을 복구하거나 관리자로 승격 시도
  - 퇴원 학생이 `UPDATE ams_students SET is_deleted = false`를 실행하여 퇴원 상태를 임의 해제 시도
  - 클라이언트에서 직접 행 `DELETE` 시도
- **대응 방어 장치 (준비 완료)**:
  - `docs/migrations/20261021_direct_access_protection_triggers.sql`
    - `trg_ams_protect_teacher_security_fields`: 퇴사 교사 수정 차단 및 `is_deleted`, `role`, `academy_id` 등 변조 시 즉시 예외 발생
    - `trg_ams_protect_student_security_fields`: `is_deleted`, `last_teacher_id` 변조 시 즉시 예외 발생
    - `REVOKE DELETE`: `anon`, `authenticated`로부터 직접 DELETE 권한 회수
- **최종 점검 방안**:
  - [ ] 앱 완성 후 위 마이그레이션 SQL 운영 DB 적용 여부 검토 및 실행
  - [ ] 격리 DB 통과 항목(퇴사자 복구 차단, 학생 복구 차단) 운영 환경 재확인

---

### 3. 학생 마스터 패스키 로그인 시 전체 필드 노출 (Data Overfetching)
- **현상**: `components/auth/LoginForm.tsx`에서 마스터 패스키(기본값: '2324') 입력 시 `ams_students.select('*')`로 학원 학생 전체의 행과 모든 컬럼을 브라우저 메모리로 내려받습니다.
- **위험**: 패스키를 입력한 브라우저의 네트워크 응답에서 학생들의 전화번호, 주소, 비공개 관리 메모 등이 평문 노출됩니다.
- **개선 방안**:
  - 패스키 인증을 서버 엔드포인트(`/api/student/login`)로 경유하도록 전환
  - 반환 필드를 UI 표시에 필요한 최소 6개 필드로 한정:
    1. `id` (학생 UUID)
    2. `name` (이름)
    3. `school` (학교)
    4. `grade` (학년)
    5. `class_days` (등원 요일)
    6. `book_courses` (수강 코스)
- **최종 점검 방안**:
  - [ ] 패스키 로그인 응답 페이로드에서 `phone`, `management_notes` 등 민감 필드 제외 여부 확인

---

### 4. 교사 개인설정 브라우저 직접 UPDATE
- **현상**: `AccountSettings.tsx`, `SnippetSettingsLight.tsx`, `PasswordSettingsLight.tsx`에서 브라우저가 직접 `ams_teachers` 테이블을 UPDATE하고 있습니다.
- **위험**: 추후 RLS로 `ams_teachers` 직접 UPDATE를 전면 차단할 경우 해당 UI 기능이 동작하지 않을 수 있습니다.
- **개선 방안**:
  - 본인 식별 후 허용된 설정 필드(`homework_presets`, `snippets`, `snippet_trigger`, `snippet_sets`, `password`)만 갱신하는 전용 서버 API(`PATCH /api/teachers/me`) 도입
- **최종 점검 방안**:
  - [ ] 설정 페이지의 저장 로직이 서버 API를 경유하도록 전환되었는지 확인
  - [ ] DB 레벨에서 교사 테이블 직접 UPDATE 권한 축소 완료 여부 확인

---

### 5. 브라우저 로컬 스토리지 캐시 잔류 처리
- **현상**: 서버 API에서는 퇴원 학생(`is_deleted = false` 검사)과 퇴사 교사를 정상 차단(404, 403)하지만, 브라우저 로컬 스토리지(`ams_student`, 교사 프로필)에 이전 상태가 캐시되어 남아있을 수 있습니다.
- **위험**: 화면 진입 시 서버와 통신하기 직전까지 이전 캐시 정보가 일시적으로 화면에 렌더링될 수 있습니다.
- **개선 방안**:
  - `useStudentPortal.ts` 및 대시보드 진입 훅에서 서버 응답이 `is_deleted === true`이거나 404/403인 경우, 로컬 스토리지를 즉시 삭제하고 로그인 화면으로 리다이렉트
- **최종 점검 방안**:
  - [ ] 퇴원 직후 학생 포털 새로고침 시 즉시 로그아웃 및 캐시 파기 확인
  - [ ] 퇴사 직후 대시보드 새로고침 시 즉시 로그아웃 및 캐시 파기 확인

---

### 6. 모바일 앱(지혜의 노트 v3) 호환성 최종 확인
- **확인 대상**:
  - 윈도우 환경에서 작성된 모바일 앱(React Native / Flutter / Web 등)의 실제 API 호출 규격
  - 모바일 앱이 v2 공용 테이블(`wrong_answers`, `academies`)을 사용하는지, v3 신규 테이블(`ams_wrong_answers` 등)을 사용하는지 확인
- **최종 점검 방안**:
  - [ ] 모바일 앱 학생 로그인 및 오답 제출 시 RLS 및 트리거로 인한 차단/오류가 발생하지 않는지 실기기 검증

---

## ✅ 최종 배포 전 체크리스트 요약표

| 번호 | 점검 항목 | 담당 파일 / 객체 | 확인 기준 | 완료 여부 |
| :---: | :--- | :--- | :--- | :---: |
| 1 | 퇴원·퇴사 마이그레이션 SQL 1 적용 | `docs/migrations/20261021_retire_discharge_policies.sql` | 컬럼 생성, RPC 2종 등록, 배정 잠금 트리거 등록 | [ ] |
| 2 | 직접 접근 방어 트리거 SQL 2 적용 | `docs/migrations/20261021_direct_access_protection_triggers.sql` | 클라이언트의 `is_deleted`, `role` 등 변조 시 에러 차단 | [ ] |
| 3 | 패스키 로그인 필드 최소화 | `components/auth/LoginForm.tsx`, `/api/student/login` | 패스키 목록에 전화번호/메모 제외, 최소 6개 필드만 반환 | [ ] |
| 4 | 교사 개인설정 서버 API 경유 | `AccountSettings.tsx`, `PATCH /api/teachers/me` | 브라우저 직접 UPDATE 제거 및 전용 API 경유 | [ ] |
| 5 | 클라이언트 캐시 즉시 무효화 | `useStudentPortal.ts`, `useDashboardData.ts` | 퇴원/퇴사 계정 감지 시 로컬 스토리지 즉시 파기 | [ ] |
| 6 | 지혜의 노트 v3 모바일 연동 검증 | 모바일 앱 저장소 | 학생 로그인 및 오답 제출 정상 동작 확인 | [ ] |
| 7 | 비로그인(anon) 명부 직접 SELECT 차단 | Supabase RLS 정책 | anon 키로 학생/교사/일지 SELECT 시 빈 값 반환 확인 | [ ] |
