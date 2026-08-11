# 📐 AMS (Academy Management System) - Project Context & Architecture

> 이 문서는 다른 AI 보조 도구(AI Coding Assistant)가 이 프로젝트의 핵심 구조, 기술 스택, 데이터 흐름, 핵심 파일 및 엄격한 아키텍처 규칙을 신속하고 정확하게 파악하도록 작성된 종합 가이드입니다.

---

## 1. 🚀 프로젝트 개요 및 기술 스택

- **프로젝트명**: AMS (Academy Management System - 학원 학습 관리 및 플래너 시스템)
- **프레임워크**: **Next.js 16 (App Router)** + React 19
- **언어**: TypeScript
- **스타일링**: Tailwind CSS + Lucide React 아이콘
- **데이터베이스 / 백엔드**: **Supabase (PostgreSQL)** Realtime DB
- **인증 및 슬러그 기반 텐언시**: URL 슬러그 기반 학원 분리 (`/[slug]/dashboard`, `/[slug]/student`)

---

## 2. 🗂️ 핵심 파일 및 라우팅 구조

```
academy-planner/
├── app/
│   ├── [slug]/
│   │   ├── dashboard/          # 원장/선생님용 메인 관리자 대시보드 (TodaySheet)
│   │   ├── dashboard-light/    # 경량화 대시보드
│   │   ├── student/            # 학생 모바일/웹 학습 포털 (오늘 학습, 제출, 테스트)
│   │   ├── attendance/         # 학생 출석 태블릿/키오스크 화면
│   │   └── login/              # 로그인 페이지
│   └── api/                    # 시간표, 교재, OMR 스캔, 보고서 등 REST API
├── components/
│   ├── dashboard/
│   │   ├── TodaySheet.tsx      # 핵심 스프레드시트형 학습 일지 종합 관리 컴포넌트
│   │   ├── todaySheet/         # TodaySheetCell, TodaySheetHeader, PrintPreviewModal 등
│   │   └── hooks/              # TodaySheet 단축키, 클립보드, 렌더링 최적화 훅
│   └── student/
│       ├── LearningDashboard.tsx # 학생 모바일 메인 학습 카드 (학원공부, 숙제, 오늘테스트)
│       └── TextbookSystem.tsx   # 교재 시스템 및 진도 체크리스트
├── hooks/                      # 공통 전역 커스텀 훅 (교재 시스템 상태 등)
├── lib/
│   ├── sessionFieldMap.ts      # TodaySheet 컬럼과 DB 컬럼 간 중앙 매핑 정의
│   ├── todaySheetDomSync.ts    # React state 지연 방지용 실시간 DOM Sync 유틸
│   └── utils.ts                # 공통 유틸리티 (교재 타겟 태그 파싱 등)
└── types/
    └── dashboard.ts            # Student, SessionLog, TextbookOption 등 핵심 데이터 타입
```

---

## 3. 💾 데이터 흐름 및 핵심 DB 스키마

### 1) DB 테이블 관계 및 흐름
- **`ams_students` (학생 프로필)**:
  - 학생 성명, 학년, 학교, 담당선생님(`teacher_id`), **등원 요일(`class_days`)**, **선택과목 요일(`__elective_courses`)**, 배정 교재(`assigned_books`), 교재 과목 매핑(`book_courses`) 등 **학생 고유 프로필**을 관리합니다.
  - 🚨 **절대 규칙**: `class_days` 및 요일/프로필 정보는 시간표 저장이나 일지 작성 로직으로 절대 덮어쓰거나 수혈하지 않습니다!

- **`ams_session_logs` (일별 세션 일지)**:
  - 복합 유니크 키: `(student_id, session_date, course_name, moved_to_hour)`
  - 학생의 **특정 날짜(`session_date`) + 특정 수업(`course_name`)**에 대한 모든 학습 기록(진도 `classwork_text`, 숙제 `homework_text`, 다음 테스트 `next_quiz_text`, 미션 `mission`, 제출 승인 `approval_status`)을 관리합니다.

---

## 4. 🔒 핵심 개발 원칙 & 🚨 절대 규칙 (AI 필독)

### 1) 정규수업과 특강수업(선택과목) 100% 완전 격리 (Strict Isolation)
- 한 학생이 동일하더라도 **`정규수업`**과 **`특강수업(선택과목)`**은 마치 **서로 다른 두 명의 학생이 각각 독립된 수업을 듣는 것처럼 100% 분리**됩니다.
- 세션 일지(`ams_session_logs`) 매칭 시 `course_name = '정규'` 일지 및 `course_name = '[특강명]'` 일지가 1:1로만 매칭되며, 오늘 테스트(`test_id`, `test_status`) 및 숙제/진도가 절대로 과목 간 섞이지 않습니다.

### 2) 데이터 단일 출처 (Single Source of Truth) & 수동 이월 원칙
- **학생 미션(`mission`) / 주의점(`management_notes`) / 안내장(`special_notes`)**:
  - 과거 일지 데이터를 페이지 로드 시 자동으로 끌어와서 셀을 채우는 자동 수혈(Past Fallback)을 **100% 금지**합니다.
  - 미션은 **헤더의 요술봉(`🪄`) 버튼을 눌렀을 때만 선택적으로 최신 과거 기록을 이월**하며, 작성되지 않은 날짜의 셀은 100% 빈 칸으로 깔끔하게 시작됩니다.

### 3) TodaySheet 입력 및 DOM Sync 하이브리드 구조
- 대용량 그리드 렌더링 성능 확보를 위해 `TodaySheetCell`은 React State 제어와 함께 `lib/todaySheetDomSync.ts`를 통해 `requestAnimationFrame` 단위로 DOM `textarea.value`와 `scrollHeight`를 직접 동기화합니다.
- 셀을 선택하고 백스페이스/Delete 키로 지우거나 복사/붙여넣기 시 0.1밀리초 내로 DOM과 로컬 State가 매끄럽게 동기화됩니다.

### 4) `ams_students` 데이터 보호 규칙
- 시간표 저장(`ams_timetables`) 및 일지 저장 로직이 `ams_students`의 `class_days`나 `day_schedules`를 Update하거나 덮어쓰는 코드를 추가하는 것을 엄격히 금지합니다.
