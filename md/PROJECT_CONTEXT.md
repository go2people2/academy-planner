# 📐 AMS (Academy Management System) - Project Context & Architecture

> 이 문서는 다른 AI 보조 도구(AI Coding Assistant)가 **전체 호크마 에듀테크 생태계(Hokma Full Ecosystem)** 내에서 이 프로젝트(AMS)의 위치, 상호 연동 관계, 핵심 구조, 기술 스택, 데이터 흐름 및 엄격한 아키텍처 규칙을 신속하고 정확하게 파악하도록 작성된 종합 가이드입니다.

---

## 0. 🌐 Hokma 전체 생태계 아키텍처 및 AMS의 역할 (Hokma Full Ecosystem)

호크마 시스템은 **"콘텐츠 생성 ➡️ 오답 수집 ➡️ 맞춤 클리닉 ➡️ 미디어 스트리밍 ➡️ 학원 운영 관리 ➡️ 학부모 안심 소통"**이 유기적으로 연결된 올인원 에듀테크 생태계입니다.

### 시스템 간 데이터 흐름

```text
Fascan
  → Data V3 콘텐츠 표준 생성
  → Hokmanote 콘텐츠 공급

AMS 학생 포털 `/[slug]/student`
  └─ 지혜의 노트
       → 학생별 오답 번호 제출
       → Supabase를 통한 Hokmanote 오답 학습 흐름 연동

Hokmanote
  ← Data V3 콘텐츠
  ← 학생별 오답 제출
  → 개인 맞춤 오답 학습·클리닉

AMF
  ← Data V3의 문항/미디어/Cue 참조
  → 원내 미디어 스트리밍

AMS (현재 프로젝트)
  → 학생·수업·출결·진도·숙제·테스트·보강·상담·리포트 관리
  → 학생 포털 및 지혜의 노트 제출 접점 제공
```

> **📌 핵심 생태계 원칙 요약**:
> 1. **지혜의 노트**는 AMS 학생 포털(`/[slug]/student`) 안에 통합된 학생 오답 제출 모듈입니다.
> 2. **Data V3**는 Fascan이 생성하는 콘텐츠 표준 구조(5탭: master/unit_page/problems/media/media_sources)이며 독립 앱이 아닙니다.
> 3. **Hokmanote**는 Data V3와 학생 오답 데이터를 활용하는 오답노트·클리닉 앱입니다. (AMS가 오답노트 조판/콘텐츠 생성을 직접 맡지 않음)
> 4. **AMS의 현행 Google Sheets/CSV 기반 bookcode는 Data V3가 아닙니다.**
> 5. **AMS의 Data V3 연동**은 향후 `dual-read + fallback` 방식으로 점진 전환합니다.

---

### 현재 AMS 교재 데이터 상태와 Data V3 관계

🚨 **중요 현황**: **현재 AMS의 Google Sheets/CSV 기반 bookcode 및 교재 리스트 구조는 Data V3가 아닙니다.**

AMS는 현재 Google Sheets/CSV에서 가져오는 레거시 `bookcode` 및 교재 목록을 사용하고 있습니다. 따라서 다음처럼 오해하면 안 됩니다.
- ❌ AMS가 이미 Data V3 DB를 사용하고 있다.
- ❌ AMS의 현재 bookcode가 Data V3의 textbook ID다.
- ❌ Google Sheets의 교재 구조가 Data V3 5탭 구조와 동일하다.
- ❌ Data V3 통합을 위해 현재 Google Sheets 기반 수업 흐름을 즉시 제거해도 된다.

| 구분 | 현재 상태 (Current) | 향후 목표 (Target) |
|---|---|---|
| **AMS 교재 기준** | Google Sheets/CSV 기반 레거시 bookcode 사용 | Data V3 공통 콘텐츠 식별자와 점진적 연결 |
| **Data V3 역할** | Fascan이 만들고 Hokmanote가 사용하는 콘텐츠 표준 | AMS도 필요한 범위(교재 참조·매핑)에서 활용 |
| **AMS 진도 기록** | TodaySheet의 텍스트 중심 기록 | 텍스트 유지 + 선택적 구조화 참조 |
| **학생 오답 제출** | 기존 학생 포털/지혜의 노트 흐름 | Data V3 문항 식별자와 단계적 연결 |
| **전환 방식** | 레거시 구조 안정 운영 중 | dual-read + fallback 기반의 무중단 점진 전환 |

---

### 향후 Data V3 연동 원칙

1. **역할 분리 철저 준수**:
   - **Fascan**: PDF 스캔, 문항 이미지 추출, Data V3 콘텐츠 생성
   - **Data V3**: 공통 콘텐츠 표준 구조
   - **Hokmanote**: 학생별 오답 학습, 오답노트 조판 및 클리닉
   - **지혜의 노트**: 학생 오답 번호 제출 접점
   - **AMF**: 원내 미디어·Cue 기반 스트리밍 엔진
   - **AMS**: 학생 수업·운영 맥락과 학생 포털을 관리하는 운영 허브
2. **무중단 점진 전환 (Dual-Read & Fallback)**:
   - 기존 Google Sheets/CSV `bookcode` 흐름을 즉시 삭제하거나 강제 교체하지 않습니다.
   - Data V3와 연결되는 교재만 선택적으로 새 표준 식별자를 연결합니다.
   - Data V3 매핑이 없거나 조회 실패 시 기존 Google Sheets 기반 동작으로 무중단 폴백(Fallback)되어야 합니다.
   - 기존 학생 배정, TodaySheet 진도, 숙제, 테스트, 오답 제출 데이터의 유실은 절대 허용되지 않습니다.
   - 레거시 교재와 Data V3 교재는 일정 기간 공존합니다.
3. **AMS 데이터의 책임 범위**:
   - AMS는 Data V3의 대용량 콘텐츠 전체를 중복 복제하지 않습니다.
   - AMS가 관리·참조하는 데이터: 학원(tenant), 학생, 수업 일지, 학생 교재 배정, 레거시 bookcode, 향후 Data V3 교재/단원/문항 식별자 참조, 텍스트 진도와 선택적 구조화 링크, 학생 오답 제출의 운영 맥락.
   - 교재 PDF 원본, 문항 이미지 생성, 콘텐츠 조판, 대용량 미디어 스트리밍은 각각 Fascan, Hokmanote, AMF의 책임 경계입니다.

---

### 타 프로젝트 AI 에이전트를 위한 역할·보안 경계

1. **테넌트 격리 (`academy_id`)**:
   - 학생, 출결, 숙제, 상담, 오답 제출 등 모든 운영 데이터는 `academy_id` 기준으로 엄격히 격리됩니다.
   - 타 학원의 학생 정보, 오답 제출 내역, 교재 배정, 상담·수업 기록이 조회되거나 수정되면 안 됩니다.
2. **공용 콘텐츠 vs 테넌트 전용 콘텐츠 구분**:
   - 특정 학원 전용 교재, PDF, 문항 이미지, 영상 URL, 자체 제작 콘텐츠는 다른 테넌트에 절대 노출되지 않아야 합니다.
3. **서버 인가 및 클라이언트 입력 불신**:
   - 클라이언트가 전달한 `academy_id`, `student_id`, 교재/문항 ID를 신뢰하지 않고, API 및 Supabase RLS에서 로그인 주체와 권한 일치 여부를 서버에서 검증합니다.
   - 교재 콘텐츠를 공유하는 경우에도 학생별 오답·출결·상담·성적 데이터는 절대 타 학원과 공유하지 않습니다.
4. **개인정보 및 보안 데이터 보호**:
   - 학생 개인정보, 결석 사유, 상담 내용, API Key, Service Role Key를 문서 예시, 로그, 콘솔 출력에 노출하지 않습니다.

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
├── md/                         # 다른 AI 공유용 핵심 문서 모음 (DB 스키마, 권한, 폴더 구조 등)
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
  - 미션은 **헤더의 요술봉(`🪄`) 버튼을 눌렀을 때만 선택적으로 최신 과거 기록을 이월**하며, 작성되지 않은 날짜의 셀은 100% 빈 칸으로 시작됩니다.

### 3) TodaySheet 입력 및 DOM Sync 하이브리드 구조
- 대용량 그리드 렌더링 성능 확보를 위해 `TodaySheetCell`은 React State 제어와 함께 `lib/todaySheetDomSync.ts`를 통해 `requestAnimationFrame` 단위로 DOM `textarea.value`와 `scrollHeight`를 직접 동기화합니다.
- 셀을 선택하고 백스페이스/Delete 키로 지우거나 복사/붙여넣기 시 0.1밀리초 내로 DOM과 로컬 State가 매끄럽게 동기화됩니다.

### 4) `ams_students` 데이터 보호 규칙
- 시간표 저장(`ams_timetables`) 및 일지 저장 로직이 `ams_students`의 `class_days`나 `day_schedules`를 Update하거나 덮어쓰는 코드를 엄격히 금지합니다.
