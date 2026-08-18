# 🗄️ AMS Database Schema & Data Models

이 문서는 AMS(Academy Management System) 데이터베이스 스키마 구조, 핵심 테이블의 역할, 테이블 간의 연관 관계 및 엄격한 관리 규칙을 정리한 문서입니다.

---

## 1. 📋 주요 테이블 명세

### 1) `ams_students` (학생 프로필 마스터)
학생의 고유 인적사항, 학원 등록 정보, 요일 및 교재 설정의 단일 출처(Single Source of Truth)입니다.

- **주요 컬럼**:
  - `id` (UUID, PK): 학생 고유 식별자
  - `academy_id` (UUID, FK): 소속 학원 ID
  - `name` (TEXT): 학생 성명
  - `school` (TEXT), `grade` (TEXT): 학교 및 학년
  - `teacher_id` (UUID, FK): 담당 선생님 ID
  - `class_days` (TEXT[]): 정규 등원 요일 목록 (예: `["월", "수", "금"]`)
  - `assigned_books` (TEXT[]): 배정된 교재명 목록
  - `book_courses` (JSONB): 교재별 과목/태그 매핑 및 완료/보존 상태
  - `__elective_courses` (JSONB): 선택과목/특강 요일 및 과목 정보

> 🚨 **데이터 보호 규칙**: `ams_students`의 `class_days` 및 요일 정보는 시간표 갱신이나 세션 저장 시 절대 임의로 UPDATE하거나 덮어쓰지 않습니다.

---

### 2) `ams_session_logs` (일별/과목별 세션 학습 일지)
날짜별, 과목별로 기록되는 학생의 실제 학습 수행 데이터입니다.

- **주요 컬럼**:
  - `id` (BIGINT, PK): 세션 일지 고유 ID
  - `student_id` (UUID, FK): 대상 학생 ID
  - `academy_id` (UUID, FK): 소속 학원 ID
  - `session_date` (DATE): 수업/일지 날짜 (YYYY-MM-DD)
  - `course_name` (TEXT): 과목 구분 (`'정규'` 또는 선택과목/특강명)
  - `moved_to_hour` (NUMERIC, Optional): 보강/시간 이동 시 이동 시간
  - `classwork_text` (TEXT): 오늘 진행한 학원 공부 텍스트
  - `homework_text` (TEXT): 과제확인/숙제 텍스트
  - `next_quiz_text` (TEXT): 다음 시간 예정 테스트 명칭
  - `homework_to` (JSONB/TEXT): 다음 시간 예정 테스트 상세 JSON 데이터
  - `test_id` (TEXT), `test_status` (TEXT), `test_score` (TEXT): 오늘 테스트 관련 데이터
  - `mission` (TEXT): 학생 당일 개별 미션
  - `management_notes` (TEXT): 주의점/관리 메모
  - `special_notes` (TEXT): 안내장 및 특이사항
  - `approval_status` (TEXT): 모바일 제출 승인 상태 (`'none'`, `'submitted'`, `'approved'`)

- **복합 유니크 제약조건**:
  - `(student_id, session_date, course_name, moved_to_hour)`
  - 동일 학생이 같은 날짜에 듣는 정규수업과 특강수업 일지가 완전히 독립되도록 보장합니다.

---

### 3) `ams_textbooks` (학원 교재 마스터)
학원에 등록된 전체 교재 라이브러리 정보입니다.

- **주요 컬럼**:
  - `id` (BIGINT, PK): 교재 ID
  - `academy_id` (UUID, FK): 소속 학원 ID
  - `bookcode` (TEXT): 교재 고유 식별 코드 (예: `BK001`)
  - `title` (TEXT): 교재명
  - `tab_name` (TEXT): 분류 탭 (`'정규'`, `'특강'`, `'공통'`)
  - `units` (JSONB): 교재의 대단원/중단원/소단원 목록

---

### 4) `ams_timetables` (시간표 전용 레이아웃)
시간표 설정 모듈(`TimetableSettings`)에서 사용되는 레이아웃 전용 데이터입니다.
- **원칙**: 시간표 레이아웃 데이터는 읽기 전용으로 활용되며, 이 테이블의 저장 로직이 `ams_students` 프로필 데이터를 역산하여 수정하지 않도록 관리합니다.

---

## 2. 🔗 테이블 간의 관계 (ERD 구조 요약)

```
[ ams_academies ] (1) ───< (N) [ ams_students ] (1) ───< (N) [ ams_session_logs ]
       │                                 │
       ├───< (N) [ ams_teachers ]        └───< (M:N) [ ams_textbooks ]
       └───< (N) [ ams_tasks ]
```
