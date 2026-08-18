# 📁 AMS Folder Structure & Component Dependencies

이 문서는 AMS 프로젝트의 디렉토리 구조, 주요 컴포넌트 간의 연관 관계 및 데이터 흐름을 설명합니다.

---

## 1. 📂 전체 폴더 구조 개요

```
academy-planner/
├── app/                        # Next.js App Router 페이지 및 API 라우트
│   ├── [slug]/
│   │   ├── dashboard/          # 선생님/원장님용 메인 대시보드 (TodaySheet)
│   │   ├── dashboard-light/    # 경량화 대시보드
│   │   ├── student/            # 학생 전용 학습 포털
│   │   ├── attendance/         # 출석 태블릿 화면
│   │   └── login/              # 로그인 페이지
│   └── api/                    # 시간표, 교재, OMR 스캔 REST API
├── components/                 # UI 컴포넌트 모음
│   ├── dashboard/
│   │   ├── TodaySheet.tsx      # 핵심 대용량 시트 컴포넌트
│   │   ├── todaySheet/         # 셀(TodaySheetCell), 헤더(TodaySheetHeader), 인쇄모달 등
│   │   └── hooks/              # 단축키, 클립보드, Undo/Redo 커스텀 훅
│   └── student/
│       ├── LearningDashboard.tsx # 학생 학습 카드 메인 UI
│       └── TextbookSystem.tsx   # 교재 시스템 및 진도 체크리스트
├── hooks/                      # 공통 훅 (교재 시스템 상태 관리 등)
├── lib/                        # 중앙 매핑 테이블 및 DOM sync 유틸
│   ├── sessionFieldMap.ts      # TodaySheet ↔ DB 컬럼 매핑
│   ├── todaySheetDomSync.ts    # 실시간 DOM 동기화 유틸
│   └── utils.ts                # 공통 지원 유틸리티
├── md/                         # AI 연동 및 시스템 사양 문서 모음
└── types/                      # TypeScript 데이터 인터페이스 정의
```

---

## 2. 🔄 주요 파일 간 연관 관계 및 데이터 흐름

### 1) 대시보드 레이어 (Teacher Side)
```
app/[slug]/dashboard/page.tsx (부모 데이터 및 API 관리)
  └── components/dashboard/TodaySheet.tsx (시트 렌더링 및 락 제어)
        ├── components/dashboard/todaySheet/TodaySheetHeader.tsx (헤더 및 요술봉 기능)
        ├── components/dashboard/todaySheet/TodaySheetCell.tsx (셀 렌더링 및 입력)
        └── components/dashboard/hooks/
              ├── useTodaySheetShortcuts.ts (키보드 단축키 & 백스페이스 삭제)
              ├── useTodaySheetClipboard.ts (복사 / 붙여넣기 처리)
              └── useTodaySheetRowLogic.ts (셀 로컬 폼 상태 관리)
```

### 2) 학생 포털 레이어 (Student Side)
```
app/[slug]/student/page.tsx (학생 뷰 메인)
  ├── app/[slug]/student/hooks/useStudentPortal.ts (학생 데이터 및 1:1 과목 세션 매칭)
  ├── components/student/LearningDashboard.tsx (학원공부/숙제/오늘테스트 카드)
  └── components/student/TextbookSystem.tsx (교재 진도 체크)
```
