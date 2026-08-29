# AMS SaaS 단순화·모듈화 실행 계획서 (SaaS Simplification & Modularization Master Plan)

> **문서 상태**: 공식 승인 및 실행 가이드  
> **최초 작성일**: 2026-08-29  
> **관련 문서**:
> - [`md/FEATURE_MODULE_INVENTORY.md`](file:///Users/joonsik_air/documents/makecode/academy-planner/md/FEATURE_MODULE_INVENTORY.md) (현재 코드 기준 전수 조사 인벤토리)
> - [`md/PROJECT_LOG.md`](file:///Users/joonsik_air/documents/makecode/academy-planner/md/PROJECT_LOG.md) (개발 이력 로그)

---

## 1. 문서 목적과 범위 (Purpose & Scope)

### 1.1 신규 학원 대상 단순한 Core 중심 AMS 제공
현재 AMS는 고도화된 실시간 태블릿 수업, 시험지 아카이빙, 오답노트 자동화, 전자책 뷰어, 상세 진도 로드맵 등 풍부한 기능을 갖추고 있습니다. 그러나 소규모 학원이나 1인 교습소 등 신규 도입 학원에는 많은 메뉴와 기능이 초기 온보딩 진입장벽이 될 수 있습니다.  
본 계획서는 **출결·진도·숙제·테스트 기록 중심의 '절대 안 터지는 무적의 Core'**를 기본으로 제공하고, 학원의 규모와 요구에 따라 필요한 부가 기능을 패키지(Add-on) 단위로 활성화(On/Off)할 수 있는 **멀티테넌트 SaaS 구조**로 전환하는 장기 실행 로드맵을 정의합니다.

### 1.2 기존 학원 무중단 운영 보장 (Zero Regression)
- 기존에 AMS를 사용 중인 학원은 어떠한 기능도 중단되거나 숨겨지지 않아야 합니다.
- 기능 플래그(Feature Flag) 설정이 존재하지 않는 기존 테넌트는 **전체 기능 활성화(Fallback: All Enabled)**를 기본값으로 보장합니다.

### 1.3 기능 OFF의 본질: '화면 진입 및 실행 제어' (데이터 보존 원칙)
- 특정 Add-on 팩을 OFF하더라도 관련 테이블의 **DB 데이터는 절대로 삭제하거나 수정하지 않습니다**.
- 기능 OFF는 **(1) 사이드바 메뉴 숨김, (2) 내부 딥링크 버튼 비활성화, (3) 전역 단축키 차단, (4) 직접 URL 및 localStorage viewMode 진입 방어, (5) 비활성 뷰 렌더링 차단**을 의미합니다.
- 단순 메뉴 CSS 숨김(`display: none`)에 그치지 않고, 상태 제어 및 리다이렉트 가드를 포함한 **완전한 진입 경로 방어**를 구현합니다.

---

## 2. 핵심 설계 원칙 (Core Architectural Principles)

1. **Core Always-ON (비활성화 절대 불가)**
   - 학원 운영의 핵심인 TodaySheet, Overview, 학생정보수정, 기본 설정, 당일 수업 운영(보강/시간이동/수업제외)은 어떤 경우에도 비활성화할 수 없습니다.
2. **패키지 단위 제어 (No Granular Over-engineering)**
   - 초기 단계에서는 메뉴 하나하나 단위로 수십 개의 개별 플래그를 만들지 않고, 6대 논리적 패키지(Add-on Pack) 단위로만 제어합니다.
3. **안전한 기본값 (Safe Fallback)**
   - 설정이 비어 있거나 신규 필드가 누락된 경우 기본값은 `true`를 우선하여 기존 운영의 연속성을 보장합니다 (`labs` 제외).
4. **완전한 진입 경로 방어 (Comprehensive Route Guard)**
   - 비활성화된 기능은 사이드바뿐만 아니라 내부 버튼, 카드 액션, 전역 단축키, URL 쿼리, `localStorage`의 `last_view_mode` 복원 로직까지 빈틈없이 방어하여 Core 화면(`todayTable`)으로 안전 리다이렉트합니다.
5. **데이터 보존 (Data Preservation)**
   - 기능 On/Off 시 기존 생성된 시험지, 오답 데이터, 교재 진도 로그, PDF 링크 등은 DB에 영구 보존됩니다.
6. **다크/라이트 대시보드 동일 규칙 적용 (Single Source of Truth)**
   - `dashboard`와 `dashboard-light`는 동일한 Feature Flag 훅/헬퍼를 공유하여 일관된 메뉴 노출 및 가드 규칙을 적용합니다.
7. **보안 및 개인정보 보호 (Security Compliance)**
   - 본 문서 및 클라이언트 코드에는 API 키, Service Role 키, 학생 개인정보를 절대 기록하거나 노출하지 않습니다.

---

## 3. Core Always-ON 정의 (항상 ON, Feature Flag 금지)

> **⚠️ 절대 규칙**: 아래 기능들은 Master 관리자 화면(`/master`)이나 Feature Flag 설정에서 On/Off할 수 없으며, **모든 학원에 영구적으로 100% 활성화** 상태로 제공됩니다.

### 📌 Core Always-ON 기능 전수 목록

| 기능 영역 | 주요 컴포넌트 & 화면 | 관련 데이터 / State 연동 | Core 필수 이유 (비활성화 금지 사유) |
| :--- | :--- | :--- | :--- |
| **TodaySheet** | [`components/dashboard/TodaySheet.tsx`](file:///Users/joonsik_air/documents/makecode/academy-planner/components/dashboard/TodaySheet.tsx) | `ams_daily_logs`<br>`ams_students`<br>`ams_master_textbooks` | 일일 수업 출결, 진도, 숙제, 테스트, 특이사항 기록 및 즉각 저장의 핵심 엔진. |
| **Overview** | [`components/dashboard/Overview.tsx`](file:///Users/joonsik_air/documents/makecode/academy-planner/components/dashboard/Overview.tsx) | `ams_students`<br>`ams_daily_logs`<br>`ams_teachers` | 오늘 등원생 타임라인/시간대별 카드 그리드, 실시간 출결 현황 파악. |
| **학생정보수정** | [`Overview.tsx`](file:///Users/joonsik_air/documents/makecode/academy-planner/components/dashboard/Overview.tsx)<br>(`hideTodaySection={true}`) | `ams_students`<br>`ams_teachers` | 전교생 프로필(이름/학교/학년/연락처), 요일별(`class_days`) 및 정규 시간표(`day_schedules`) 관리. |
| **기본 Settings** | [`components/dashboard/SettingsView.tsx`](file:///Users/joonsik_air/documents/makecode/academy-planner/components/dashboard/SettingsView.tsx) | `ams_academies`<br>`ams_teachers` | 학원 기본 정보 설정, 교사 계정 관리, 테마 전환. |
| **정규 스케줄 & 당일 대상 자동 계산** | `useTodaySheetRows.ts`<br>`lib/studentDataEnricher.ts` | `ams_students.day_schedules`<br>`ams_students.class_days`<br>`ams_daily_logs` | 오늘 요일에 수업이 있는 학생 목록을 실시간으로 계산하고 시간표를 렌더링하는 기본 엔진. |
| **보강 추가 (Makeup Session)** | TodaySheet 상단 [보강 추가] 모달<br>Overview 내 [보강 추가] 버튼 | `ams_daily_logs`<br>(`attendance_status`, `attendance_reason`, `absence_session_id`) | 정규 수업 외에 추가 등원한 학생의 수업을 기록하는 필수 운영 기능. |
| **시간이동 (Reschedule / Move Hour)** | TodaySheet 등원시간 셀 드롭다운<br>Overview 시간대 카드 이동 | `ams_daily_logs.moved_to_hour`<br>`student.todaySession.moved_to_hour` | 정규 시간과 다른 교시로 이동한 학생의 시간대별 필터링(`selectedHour`) 및 출결 관리를 위해 필수. |
| **수업 제외 / 취소 (Omit Session)** | TodaySheet 출결 상태(`결석`, `이동`)<br>Overview 카드 내 상태 토글 | `ams_daily_logs.attendance_status`<br>`ams_daily_logs.attendance_reason` | 결석 사유 및 수업 취소를 기록하고 오늘 수업 대상 집계에서 정확히 반영하기 위해 필수. |
| **핵심 수업 로그 기록** | TodaySheet 셀 컴포넌트군 | `ams_daily_logs`<br>(진도, 숙제, 테스트, 특이사항) | 학원의 본질인 수업 기록 데이터 보존. |

### 🔒 보강·시간이동·수업제외 운영 원칙
1. **공통 운영 기반**: 보강, 시간이동, 수업 제외는 TodaySheet, Overview, 시간대별 카드 배치의 공통 토대입니다.
2. **파생 상태 규정**: `is_pure_makeup`은 DB 저장 컬럼이 아니며, `attendance_status`, `attendance_reason`, `absence_session_id`, `moved_to_hour` 등을 종합하여 클라이언트에서 판정하는 파생 상태(Derived State)입니다.
3. **독립 메뉴화 시 영구성 원칙**: 향후 종합 보강 캘린더나 보강 통계 리포트 같은 별도 메뉴가 Add-on으로 추가되어 해당 메뉴 노출 여부를 On/Off하더라도, **TodaySheet와 Overview 내부의 보강 추가, 시간이동, 수업 제외 기능은 영구적으로 항상 활성화(Always ON)** 상태를 유지합니다.
4. **FeatureKey 후보 제외**: `FeatureKey` 목록에 `makeup`, `reschedule`, `session_management` 관련 키는 절대로 추가하지 않습니다.

---

## 4. Add-on 패키지 분류 및 매핑 체계 (Add-on Packages)

| 패키지 Key (`FeatureKey`) | 패키지 목적 및 대상 학원 | 포함 메뉴 / `viewMode` | 기본값 (Default) | 주요 의존 컴포넌트 & API | 기능 OFF 시 차단할 진입점 (Route Guards) |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `digital_library` | **디지털 자료실 팩**<br>교재 PDF 열람 및 전자책 뷰어를 활용하는 학원 | • 교재 PDF 자료실 (`pdfLibrary`)<br>• 디지털 수학 서재 (`digitalLibrary`) | `true` | • `PdfLibraryView.tsx`<br>• `DigitalMathLibraryView.tsx`<br>• `/api/textbooks/pdf` | • 사이드바 메뉴 2개 숨김<br>• `viewMode` 접근 시 `todayTable` 리다이렉트<br>• `HomeworkEditor` 내 교재 PDF 열람 링크 숨김 |
| `live_classroom` | **실시간 수업 팩**<br>선생님-학생 간 태블릿 실시간 수업 및 제출 승인을 운영하는 스마트 학원 | • 수업 시작 LIVE (`onStartClass`)<br>• 학생 제출물 승인 (`ApprovalModal`) | `true` | • `ClassroomMode.tsx`<br>• `ApprovalModal.tsx`<br>• `ams_learning_hub` | • 사이드바 [수업 시작] 메뉴 숨김<br>• 상단 `pendingSubmissions` 플로팅 버튼 숨김<br>• 단축키 `Shift+Alt+L` 차단 |
| `assessment_tools` | **시험 & 문제은행 팩**<br>학교 기출 시험지 아카이빙, 오답노트 자동화, 교재 오류 제보 관리 | • 기출문제 관리 (`exams`)<br>• 오답노트 관리 (`wrongAnswersAdmin`)<br>• 교재 오류 관리 (`problemErrors`) | `true` | • `ExamPaperManager.tsx`<br>• `WrongAnswerManager.tsx`<br>• `ProblemErrorManager.tsx`<br>• `/api/exam/scan-omr` | • 사이드바 3개 메뉴 숨김<br>• `viewMode` 접근 시 `todayTable` 리다이렉트<br>• TodaySheet 내 시험지 자동채점 연동 차단 |
| `analytics_operations` | **학원 운영 & 분석 팩**<br>재원생 증감 추이, 교재 완독률 진도표, 교사 업무 체크리스트 관리 | • 이번 달 변동 사항 (`monthlyChanges`)<br>• 교재별진도 (`progress`)<br>• 업무/보강/설문 (`teacherTask`) | `true` | • `MonthlyChanges.tsx`<br>• `ProgressSequencer.tsx`<br>• `TeacherTasks.tsx`<br>• `ams_teacher_tasks` | • 사이드바 3개 메뉴 숨김<br>• `viewMode` 접근 시 `todayTable` 리다이렉트<br>• TodaySheet/Overview의 [진도 보기] 딥링크 버튼 비활성화 (학생 프로필 모달로 대체) |
| `student_parent_portal` | **학생/학부모 포털 팩**<br>학생 모바일 학습허브 및 학부모 리포트 카카오 알림톡 발송 | • 학생 포털 (`/[slug]/student`)<br>• 학부모 리포트 발송 (`report`) | `true` | • `app/[slug]/student/page.tsx`<br>• `StudentReportCardPrintModal.tsx`<br>• `/api/report` | • 학생 로그인 및 포털 진입 가드<br>• TodaySheet 리포트 전송 버튼 숨김/안내 토스트 |
| `labs` | **실험실 기능 (Experimental)**<br>개발 중인 프로토타입 기능 | • 실험실 기능 (현재 활성 메뉴 없음) | `false` | • (추가 조사 필요 / 신규 기능 샌드박스) | • 사이드바 실험실 카드 및 개발 중 뷰 숨김 |

---

## 5. Feature Flag 정책 및 기술 규격 (Feature Flag Policies)

### 5.1 공통 타입 및 인터페이스
```ts
// types/features.ts 또는 lib/constants/features.ts
export type FeatureKey =
  | 'digital_library'
  | 'live_classroom'
  | 'assessment_tools'
  | 'analytics_operations'
  | 'student_parent_portal'
  | 'labs';

export type AcademyFeatureFlags = Record<FeatureKey, boolean>;

export const DEFAULT_ACADEMY_FEATURE_FLAGS: AcademyFeatureFlags = {
  digital_library: true,
  live_classroom: true,
  assessment_tools: true,
  analytics_operations: true,
  student_parent_portal: true,
  labs: false,
};
```

### 5.2 기본값 및 Fallback 원칙
- DB에 학원 설정이 없거나, 신규 FeatureKey가 추가되었을 때 기본값은 `DEFAULT_ACADEMY_FEATURE_FLAGS`를 따릅니다.
- 기존 운영 중인 학원은 전체 기능(`labs` 제외)이 즉시 사용 가능한 상태로 유지됩니다.

### 5.3 DB 저장 구조 (향후 Phase 3 대상)
- **후보 1**: `ams_academies` 테이블의 `operation_settings` (JSONB) 내 `feature_flags: Record<string, boolean>` 필드.
- **후보 2**: `ams_academies.enabled_features` (TEXT[] 또는 JSONB) 전용 컬럼 추가.
- **원칙**: 실제 DB 컬럼 추가 및 마이그레이션은 별도의 RLS 및 데이터 무결성 영향도 검토 후 승인을 거쳐 진행합니다.

### 5.4 런타임 가드 및 안전 전환 정책
1. **Sidebar 메뉴 필터링**: `isFeatureEnabled(featureKey)`가 `false`인 메뉴는 목록에서 완전히 제외.
2. **뷰모드 교정 (ViewMode Sanitization)**:
   ```ts
   // viewMode 복원 및 렌더링 시 가드
   if (!isFeatureEnabled('digital_library') && (viewMode === 'pdfLibrary' || viewMode === 'digitalLibrary')) {
     setViewMode('todayTable');
     localStorage.setItem('last_view_mode', 'todayTable');
   }
   ```
3. **컴포넌트 렌더링 차단**: 비활성화된 viewMode 컴포넌트는 JSX 트리에서 언마운트 처리.

---

## 6. 단계별 실행 로드맵 (Phase 0 ~ Phase 6)

| 단계 | 목표 | 주요 작업 및 변경 범위 | 완료 기준 (Definition of Done) | 주요 위험 요소 & 대응 |
| :---: | :--- | :--- | :--- | :--- |
| **Phase 0** | 메뉴·의존성 전수조사 완료 | • [`FEATURE_MODULE_INVENTORY.md`](file:///Users/joonsik_air/documents/makecode/academy-planner/md/FEATURE_MODULE_INVENTORY.md) 작성<br>• Core Always-ON(보강/시간이동 포함) 확정 | • 전 메뉴 매핑 및 문서 승인 완료 | • 위험 없음 (문서화 단계) |
| **Phase 1** | 공통 Feature 스키마 및 헬퍼 구축 | • `types/features.ts` 공통 타입 정의<br>• `useAcademyFeatures()` 공통 훅/헬퍼 생성<br>• 메모리 기반 기본값 체계 확립 | • TypeScript 타입 검사 통과<br>• 프로덕션 빌드 성공 | • 기존 훅과의 네이밍 충돌 방지 |
| **Phase 2** | `digital_library` On/Off PoC 검증 | • 다크/라이트 Sidebar 조건부 렌더링<br>• `pdfLibrary`, `digitalLibrary` 뷰모드 가드<br>• 개발용 임시 override 테스트 | • `digital_library: false` 시 메뉴 숨김 및 `todayTable` 리다이렉트 정상 동작<br>• Core 화면 정상 동작 | • `localStorage`에 비활성 viewMode 잔존 시 새로고침 루프 방지 |
| **Phase 3** | DB 저장 및 테넌트/RLS 격리 | • `ams_academies` 스키마 반영<br>• 학원 로딩 시 `feature_flags` 로드<br>• 테넌트별 플래그 분리 | • 학원 A(`false`), 학원 B(`true`) 동시 접속 시 각자 격리 동작 확인 | • Supabase RLS 정책 위반 방지, 캐시 무효화 타이밍 |
| **Phase 4** | Master 관리 화면 및 프리셋 구축 | • `/master` 페이지에 학원별 토글 UI 구축<br>• 원클릭 4대 프리셋 버튼 제공<br>  (`[라이트]`, `[표준]`, `[확장]`, `[풀옵션]`) | • 마스터가 원클릭으로 학원 플래그 수정 및 즉각 반영 확인 | • 마스터 권한 없는 일반 교사의 임의 수정 원천 차단 |
| **Phase 5** | 전 Add-on 순차 확장 적용 | • 시험/문제은행(`assessment_tools`) 적용<br>• 학원분석(`analytics_operations`) 적용<br>• 실시간수업(`live_classroom`) 적용<br>• 학생포털(`student_parent_portal`) 적용 | • 각 팩별 On/Off 시 사이드바, 단축키, 딥링크 버튼 전체 방어 확인 | • TodaySheet 내부 딥링크(`[진도보기]`, `[수업시작]`) 누락 방지 |
| **Phase 6** | 종합 회귀 테스트 및 배포/롤백 체계 | • 전체 학원 대상 무중단 회귀 테스트<br>• 비상 롤백(Emergency All-ON) 스위치 검증 | • 운영 배포 완료 및 현장 이상 없음 확인 | • 장애 발생 시 원클릭 `ALL_ENABLED` 롤백 준비 |

---

## 7. 보안 및 멀티테넌트 격리 체크리스트 (Security & Tenant Isolation)

- [ ] **Academy ID 기반 격리**: 모든 Feature Flag 조회 및 수정은 `ams_academies.id` (또는 `slug`) 기준으로 엄격히 격리됩니다.
- [ ] **RLS 권한 통제**:
  - 일반 교사/원장: 본인 학원의 `feature_flags`에 대해서만 `SELECT` 권한 보유 (수정 불가).
  - 마스터 관리자(`/master`): 마스터 인증 세션이 확인된 경우에만 타 학원의 `feature_flags` `UPDATE` 가능.
- [ ] **클라이언트 Academy ID 위조 방어**: API 호출 시 클라이언트가 보낸 파라미터가 아닌 서버 세션 토큰의 `academy_id`를 검증합니다.
- [ ] **데이터 영구 보존**: 기능이 비활성화되더라도 해당 학원의 과거 데이터(`ams_daily_logs`, `ams_exams`, `ams_teacher_tasks` 등)는 절대 `DELETE`되지 않습니다.
- [ ] **민감 API 엔드포인트 방어**: UI 숨김뿐만 아니라 서버 API (`/api/textbooks/pdf`, `/api/exam/scan-omr` 등) 호출 시 학원의 플래그를 검증하여 비인가 호출을 차단합니다.

---

## 8. 테스트 검증 및 롤백 기준 (Testing & Rollback Standards)

### 8.1 기능 On/Off 검증 체크리스트
1. **Sidebar 메뉴 노출 검증**:
   - `true` 상태: 다크/라이트 사이드바에 해당 메뉴가 정상 표시되는가?
   - `false` 상태: 다크/라이트 사이드바에서 해당 메뉴가 완전히 제거되는가?
2. **비활성 viewMode 방어 검증**:
   - `false` 상태에서 URL 또는 코드로 `viewMode='pdfLibrary'` 강제 설정 시 즉시 `todayTable`로 리다이렉트되는가?
   - `localStorage`에 `pdfLibrary`가 저장된 상태로 새로고침했을 때 무한 루프 없이 `todayTable`로 안전 복구되는가?
3. **내부 진입점 및 딥링크 검증**:
   - `analytics_operations: false`일 때 TodaySheet/Overview의 [진도 보기] 버튼이 숨겨지거나 학생 상세 모달로 대체되는가?
   - `live_classroom: false`일 때 상단 플로팅 배너 및 `Shift+Alt+L` 단축키가 안전하게 차단되는가?
4. **Core 무결성 검증**:
   - 어떤 Add-on을 끄더라도 TodaySheet의 출결, 진도, 숙제, 테스트 셀 입력 및 저장이 100% 정상 작동하는가?
   - **보강 추가, 시간이동, 수업 제외/취소 기능이 온전히 작동하고 오늘 수업 대상 계산에 정확히 반영되는가?**
5. **빌드 및 타입 체크**:
   - `npm run build` 시 TypeScript 에러 및 빌드 에러가 0건인가?

### 8.2 비상 롤백 정책 (Emergency Rollback Policy)
- 기능 플래그 적용 후 현장에서 예기치 않은 UI 멈춤이나 오류가 발생할 경우, DB 마이그레이션 롤백 없이 **학원 플래그를 `DEFAULT_ACADEMY_FEATURE_FLAGS` (전체 ON)으로 즉시 전환**하여 1분 내에 기존 운영 상태로 원상 복구합니다.
