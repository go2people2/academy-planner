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
