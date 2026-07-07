# Project Integration Logs & Future Roadmap

본 문서는 오답노트 시스템("지혜의 노트")과 출석부/플래너 웹 앱("Academy Planner")의 통합 과정 및 교사용 기능에 대한 예외 처리 설계, 향후 진행 계획을 정리해 둔 개발 기록서입니다.

---

## 1. 진행 현황 (1단계 완료)
- **학생용 포털 페이지 통합**: [app/[slug]/student/page.tsx](file:///Users/joonsik_air/documents/makecode/academy-planner/app/[slug]/student/page.tsx)
  - 데스크톱용 상단 탭 및 모바일용 하단 탭에 `오답 제출` 메뉴 추가 완료.
  - 학생이 플래너에 [전화번호 뒷 4자리]로 로그인하면, 이름/슬러그 매핑 조회를 통해 오답제출 탭 진입 시 추가 로그인(PIN 입력) 없이 오답 제출 페이지([StudentSubmitPage.tsx](file:///Users/joonsik_air/documents/makecode/academy-planner/components/wrong-answers/StudentSubmitPage.tsx))로 자동 세션 연동 완료.
  - 외부 백업 소스 폴더에 의한 컴파일 오류 방지를 위해 [tsconfig.json](file:///Users/joonsik_air/documents/makecode/academy-planner/tsconfig.json) 수정 및 프로덕션 빌드(`npm run build`) 성공 검증 완료.

---

## 2. 2단계 설계: 교사용 교재 배정 자동 동기화 & 에러 처리 계획

선생님이 출석부에서 교재를 변경할 때 오답노트 데이터베이스(`student_users` 테이블)와 백그라운드에서 실시간으로 안전하게 동기화가 일어나도록 구현하되, 두 시스템의 교재 이름 불일치 문제에 대해 아래와 같이 철저한 예외 가드를 설계합니다.

### A. 구글 시트 `odap_name` 기반 백그라운드 교재 번역
- 구글 시트 `master` 탭에 새로 마련된 `odap_name` (오답노트 연동 교재명) 컬럼의 정보를 사전 정보로 로드하여 활용합니다.
- 플래너에서 `bookcode`를 배정하면, 백그라운드에서 `odap_name` 값으로 번역하여 오답노트 DB의 `assigned_books` 필드에 업데이트합니다.

### B. 예외 처리 및 에러 대응 설계 (핵심)

#### ① 구글 시트 매핑 이름(`odap_name`)이 비어 있는 과도기 상황 대응
- **예외 현상**: 아직 구글 시트 매핑 정보를 기입하지 않아 `odap_name`이 빈 값(`""`)인 경우.
- **대응책**: 매핑 정보가 없으면 플래너 교재의 실제 한글 타이틀(예: `[공수1] 개념쎈`)을 백그라운드 기본값으로 그대로 넣어 동기화합니다. 시트 기입이 완료되는 즉시 번역본으로 유연하게 교체됩니다.

#### ② 플래너에는 있으나 오답노트 DB에는 없는 교재 대응 (학생 화면 가드)
- **예외 현상**: 플래너에서 교재를 배정받았으나, 실제 오답노트 DB(`problem_catalog` 테이블)에는 등록된 문제/단원 데이터가 아예 없어 오답 제출 시 DB 에러가 발생할 수 있는 경우.
- **대응책**: 학생용 오답 제출 화면([StudentSubmitPage.tsx](file:///Users/joonsik_air/documents/makecode/academy-planner/components/wrong-answers/StudentSubmitPage.tsx))이 켜질 때, 배정 교재 중 `problem_catalog` 상에 단원 정보가 1개도 없는 교재는 **교재 선택 드롭다운에서 자동으로 숨김 처리**하여 오류를 사전 차단합니다.

#### ③ 오답노트 전용 교재의 보존 대응 (합집합 동기화)
- **예외 현상**: 오답노트 시스템에서만 쓰이던 옛날 교재가 있어서 플래너 마스터 시트에는 등록되어 있지 않은 경우, 플래너 배정 저장 시 이 정보가 덮어씌워져 지워질 위험.
- **대응책**: 동기화 저장 시 기존 학생의 `student_users.assigned_books` 값을 먼저 대조하여, **"구글 시트에 아예 존재하지 않는 오답 전용 교재명"은 지우지 않고 그대로 합집합하여 유지**시킵니다.

---

## 3. 향후 작업 계획 (1~3단계 통합 완료)
- [x] **학생용 오답제출 이력 UI 구현**: [StudentSubmitPage.tsx](file:///Users/joonsik_air/documents/makecode/academy-planner/components/wrong-answers/StudentSubmitPage.tsx)에 최근 오답 제출 이력 10개 조회 및 제출 성공 시 즉시 갱신 기능 완료.
- [x] **교사용 오답노트 관리 화면 구현**: 교사용 대시보드 사이드바에 `오답노트 관리` 메뉴 신설 및 학생 교재 배정과 PIN 리셋 기능 통합 완료.
- [x] **교재 동기화 로직 구현**: [app/[slug]/dashboard/page.tsx](file:///Users/joonsik_air/documents/makecode/academy-planner/app/[slug]/dashboard/page.tsx) 의 `updateStudentInfo` 내에 위 2단계 사양의 합집합 동기화 로직 적용.
- [x] **학생용 컴포넌트 보강**: [StudentSubmitPage.tsx](file:///Users/joonsik_air/documents/makecode/academy-planner/components/wrong-answers/StudentSubmitPage.tsx)에 실제 문제 DB 검사 후 없는 교재 드롭다운 자동 필터링 기능 탑재.
- [x] **통합 테스트**: 교재 배정 변경 후 학생 오답제출 목록 정상 확인 및 파이썬 PDF 시험지 생성 연동 테스트.

---

## 4. 최근 개발 사항 및 점검 이력 (2026-06-27)

### A. 전역 및 TodaySheet 키보드 단축키 무결성 점검 완료
- **목적**: `TodaySheet`의 편집, 네비게이션, 복사/붙여넣기 등 단축키 오작동 여부 전수 점검.
- **점검 결과**:
   - `e.isComposing` 방어 가드로 한글 IME 조립 중 엔터 조기 블러(Blur) 현상 방지 완벽 작동 확인.
   - `Ctrl + D`의 윈도우 크롬 북마크 충돌을 해결하기 위해 `Alt + D` 이중 바인딩하여 안전성 확보.
   - `isInput` 분기 처리를 통해 입력 중인 셀 내의 Undo/Redo(브라우저 기본)와 입력되지 않은 셀 선택 범위의 Undo/Redo(앱 히스토리) 충돌을 명확하게 라우팅함.
   - 자세한 분석 보고서는 [keyboard_shortcuts_audit.md](file:///Users/joonsik_air/.gemini/antigravity-cli/brain/8de8d4c9-5152-4680-980a-c5a17319f7ce/keyboard_shortcuts_audit.md) 아티팩트로 분리 작성 완료.

### B. 유연한 자동 커리큘럼 스케줄러 (Curriculum Scheduler) 기획 설계
- **목적**: 교재별 진도표를 일괄 배정하고, 결석/지연 시 뒤쪽 스케줄을 클릭 한 번으로 자동 밀어내기 및 재정렬.
- **설계 내용**:
   - **커리큘럼 템플릿**: 회차별 진도, 과제, 테스트 목록 마스터화 (`ams_curriculums` / `ams_curriculum_steps` 테이블).
   - **요일/날짜 자동 매핑**: 학생의 수업 요일(`class_days`)과 시작일을 대조하여 미래 날짜 달력에 회차별 진도를 1:1 자동 바인딩 (`ams_student_curriculums.schedule_map`).
   - **유연한 재조정 (Flexible Rescheduling)**: 결석 발생 시, 해당 시점부터 전체 일정을 다음 등원 요일로 1일씩 순차 Shift 연산하는 알고리즘 구상.
   - **맞춤형 학교 검색**: 전체 학교 DB 대신 실제 DB에 누적된 학생들의 학교명을 `DISTINCT` 쿼리로 조회해 지역 계열 드롭다운을 동적으로 구성하여 불필요한 트래픽 및 오차율 최소화.
   - 자세한 아키텍처 및 스키마 설계는 [curriculum_planner_design.md](file:///Users/joonsik_air/.gemini/antigravity-cli/brain/8de8d4c9-5152-4680-980a-c5a17319f7ce/curriculum_planner_design.md) 아티팩트에 정리 완료. (현재 보류 중으로 향후 Quota 여유 시 개발 착수)

---

## 5. 향후 디자인 리팩토링 계획: Light Mode 마이그레이션 로드맵
- **일자**: 2026-07-03 기획 기록
- **배경**: 
  - 현재 다크 모드로 작업되어 있으나, 가독성 향상(특히 회색 텍스트 시인성 부족)을 위해 추후 라이트 모드(Light Mode) 중심의 UI 테마로 전환 예정.
  - 리소스 쿼터(Quota) 제약으로 인해 디자인 전면 수정은 추후 여유가 있을 때 단계적으로 진행.

### 마이그레이션 실행 전략
1. **디자인 시스템 & CSS 변수 정의 (`app/globals.css` 또는 공통 테마)**
   - 다크 모드 색상이 하드코딩된 부분(`bg-[#050505]`, `border-white/5` 등)을 CSS 변수로 치환.
   - 예시:
     ```css
     :root {
       --bg-main: #f8fafc; /* Slate 50 */
       --bg-card: #ffffff;
       --border-subtle: #e2e8f0; /* Slate 200 */
       --text-primary: #0f172a; /* Slate 900 */
       --text-muted: #64748b; /* Slate 500 */
       --accent-blue: #2563eb;
     }
     ```
2. **사이드바 (`Sidebar.tsx`) 및 메인 대시보드 (`Overview.tsx`)**
   - 어두운 반투명 유리 배경(`bg-[#0a0a0a]/90 backdrop-blur-2xl`)을 밝은 톤의 섀도우를 동반한 화이트로 전환.
   - 아이콘 및 폰트 색상을 어두운 계열로 변경하여 시인성 확보.
3. **Daily Sheet (`TodaySheet.tsx` & `TodaySheetRow.tsx`)**
   - 스프레드시트 뷰포트의 격자선(`border-white/5` -> `border-slate-200`) 및 헤더 색상 대비 개선.
   - 텍스트 입력창 포커스 시 고대비 하이라이팅 적용.
4. **모달 및 인쇄 레이아웃 컴포넌트**
   - 안내장 인쇄 모달 등 이미 라이트 톤을 기반으로 하는 컴포넌트는 큰 변화 없이 정렬과 배치만 최적화.

---

## 6. 테마 후보 및 컬러 세트 기획 (Notion & 추천 테마)
추후 도입할 멀티 테마 시스템을 위한 추천 테마 컬러 세트 명세입니다.

### ① Notion (노션) 테마 💡 (강력 추천 / 최우선)
- **컨셉**: 서류철과 워크스페이스 같은 아주 정갈하고 군더더기 없는 디자인. 백색에 가깝지만 지나치게 눈이 시리지 않고, 차분한 그레이와 조합.
- **라이트 모드**:
  ```css
  --bg-main: #ffffff;
  --bg-sidebar: #f7f7f5;      /* 노션 특유의 연한 미색 그레이 */
  --bg-card: #ffffff;
  --border-subtle: #edece9;   /* 따뜻한 연그레이 테두리 */
  --text-primary: #37352f;    /* 노션 특유의 완전 검지 않은 먹색 */
  --text-muted: #787774;      /* 연한 브라운-그레이 */
  --accent-blue: #2383e2;     /* 노션 시그니처 블루 */
  ```
- **다크 모드**:
  ```css
  --bg-main: #191919;         /* 완전 검지 않은 차분한 차콜 */
  --bg-sidebar: #202020;
  --bg-card: #202020;
  --border-subtle: #2f2f2f;
  --text-primary: #ffffff;
  --text-muted: #9b9b9b;
  ```

### ② Warm Cream (따뜻한 아이보리) 테마 (라이트 모드 전용)
- **컨셉**: 장시간 화면을 보는 학원 선생님들의 피로도를 줄이기 위해 푸른 기를 빼고 따뜻한 노란빛을 한 방울 섞은 도화지 감성의 테마.
- **색상 구성**:
  ```css
  --bg-main: #FAF8F5;         /* 부드러운 오프화이트/크림 */
  --bg-sidebar: #F4EFEA;      /* 따뜻한 모래색 베이지 */
  --bg-card: #ffffff;
  --border-subtle: #EBE5DC;
  --text-primary: #2C2620;    /* 따뜻한 다크 브라운 */
  --text-muted: #827568;      /* 세련된 회갈색 */
  --accent-blue: #3B82F6;     /* 소프트 블루 */
  ```

### ③ Linear (리니어) 테마 (다크 & 라이트 겸용 프리미엄)
- **컨셉**: 테크니컬하고 하이테크 느낌을 주는 세련된 퍼플-그레이 톤. 현대적이고 아주 고급스러운 분위기 연출.
- **라이트 모드**:
  ```css
  --bg-main: #f4f5f6;
  --bg-sidebar: #ffffff;
  --bg-card: #ffffff;
  --border-subtle: #e4e6eb;
  --text-primary: #121314;
  --text-muted: #6e7681;
  --accent-blue: #5e6ad2;     /* 리니어 특유의 보랏빛이 도는 프리미엄 블루 */
  ```


---

## 6. 향후 추가 백로그: 직원 근태(급여) 2차 보안 잠금 장치 개발 계획
* **개발 배경**: 
  - 조교/스태프의 근무 시간 기록은 일반 관리자(`admin`)도 체크해야 하지만, 시급 설정 및 정산된 급여 정보는 오직 대표원장(`master`)만 접근할 수 있어야 함.
* **기획 사양**:
  - **급여 블라인드 가드**: `Staff Logs` 탭 내부의 `[예상 정산 급여]` 및 `[시급 계산 가이드]` 카드 영역을 자물쇠 아이콘(🔒)으로 마스킹 처리하여 보이지 않게 가림.
  - **2차 보안 비번 확인**: `[🔓 잠금 해제]` 터치 시 대표원장이 지정한 2차 비밀번호 입력을 강제하고, 일치할 때만 인라인으로 급여 정보를 복화하여 노출.
  - **비밀번호 설정 및 저장**: 첫 진입 시 신규 비밀번호 지정을 유도하며, 암호화된 비밀번호는 `ams_academies.operation_settings.staff_log_password`에 보관하여 연동 처리.

---

## 7. 본점-분점(지점) 간 시험지 데이터 실시간 공유 설계 (방안 1 - 정석)
* **개발 배경**:
  - 오답노트 시스템의 특성(각 학원 내부 로컬 서버 구동 및 저작권 문제)으로 인해 `hokma`(본점)와 `hokma-cn`(청라 분점) 학원이 별개의 슬러그 및 `academy_id`를 사용하여 물리적으로 분리되어 있습니다.
  - 하지만 교육 자산(시험지 템플릿)의 효율적 공유를 위해 본점의 시험지 데이터베이스를 분점에서도 실시간으로 공유받아 사용하되, 지점 고유 정보(학생 명단, 출결, 개별 오답 제출 이력)는 완벽히 격리되도록 설계합니다.

### A. DB 스키마 마이그레이션 계획
1. **`parent_id` 외래키 컬럼 추가**:
   - `ams_academies` 테이블에 `parent_id` (UUID, nullable, 자기 참조) 컬럼을 생성합니다.
   - **매핑 규칙**:
     - 본점(`hokma`)의 `parent_id` ➡️ `null`
     - 청라 분점(`hokma-cn`)의 `parent_id` ➡️ **본점(`hokma`) 학원의 고유 UUID** 지정.
2. **RLS (Row Level Security) 정책 완화**:
   - `ams_exam_papers` 테이블에서 타 학원(본점)의 데이터를 조회할 수 있도록 RLS 조회 권한을 보완합니다. (본인이 소속된 학원 ID이거나 부모 학원의 ID인 경우 조회를 허용)

### B. API 및 프론트엔드 제어 사양
1. **시험지 조회 API (`GET /api/tests` 등) 보완**:
   - 요청자의 슬러그를 기반으로 현재 학원 ID(`myAcademyId`)와 해당 학원의 `parent_id`를 조회합니다.
   - `parent_id`가 존재할 경우, Supabase 조회 시 `OR` 쿼리를 적용하여 본인 학원 및 부모 학원의 시험지 목록을 결합하여 반환합니다.
     - 예: `supabase.from('ams_exam_papers').select('*').or(academy_id.eq.${myAcademyId},academy_id.eq.${parentId})`
2. **수정/삭제 권한 제어 (읽기 전용 가드)**:
   - 템플릿 원본 훼손을 방지하기 위해, 현재 로그인한 사용자의 학원 ID와 시험지의 `academy_id`가 다를 경우(즉, 부모 학원의 자산을 가져와 쓰는 상태인 경우) 프론트엔드에서 수정/삭제 기능을 비활성화하고 '읽기 전용'으로 제공합니다.
3. **학생 제출 및 오답 데이터 격리 유지**:
   - 학생들이 OMR 등으로 시험을 치르고 제출한 기록(`ams_exam_submissions`)은 철저히 개별 지점의 `academy_id`를 유지합니다.
   - 이로 인해 오답 제출 로직 및 로컬 오답노트 서버 연동은 지점의 슬러그(`hokma-cn`)를 그대로 이용하므로 상호 충돌이나 저작권 유출 우려가 전혀 없습니다.


