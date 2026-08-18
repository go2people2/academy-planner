# 🔐 AMS Auth & Row-Level Security (RLS) Architecture

이 문서는 AMS 프로젝트의 사용자 역할 구분, URL 슬러그 기반의 멀티테넌시(Multi-tenancy) 인증 구조 및 Supabase 데이터 접근 권한을 설명합니다.

---

## 1. 🌐 멀티테넌시 라우팅 및 URL 구조

AMS는 학원 식별자(`slug`)를 URL 최상위 경로에 배치하여 학원별 데이터를 완전히 격리합니다.

- **원장 / 선생님 관리자 경로**: `/[slug]/dashboard`
- **학생 학습 포털 경로**: `/[slug]/student`
- **출결 전용 키오스크 경로**: `/[slug]/attendance`
- **학원 접속 로그인 경로**: `/[slug]/login`

---

## 2. 👤 사용자 역할 (Roles) 및 인증 방식

### 1) 원장 / 선생님 (Manager & Teacher)
- **접속 방식**: `/[slug]/login`에서 학원 슬러그 검증 후 로그인
- **세션 관리**: 로컬 스토리지 `ams_teacher`에 로그인 정보 보관
- **권한 범위**: 
  - TodaySheet를 통한 전체 학생 일지 조회 및 수정
  - 제출된 학생 학습일지 승인 (`approval_status = 'approved'`)
  - 시간표, 교재 마스터, 학생 프로필 관리

### 2) 학생 (Student)
- **접속 방식**: `/[slug]/login`에서 지정된 학원 학생 계정으로 로그인
- **세션 관리**: 로컬 스토리지 `ams_student`에 학생 정보 보관
- **권한 범위**:
  - 본인의 정규수업 및 선택과목 학습 포털 접근
  - 당일 학습 내용 및 완료 진도/숙제 제출 (`approval_status = 'submitted'`)
  - 본인에게 지정된 오늘 테스트 답안 제출

---

## 3. 🛡️ Supabase RLS (Row Level Security) 정책 개요

모든 핵심 테이블(`ams_students`, `ams_session_logs`, `ams_textbooks` 등)은 `academy_id`를 포함하고 있습니다.

- **학원 단위 접근 제한**:
  - 모든 클라이언트 쿼리는 현재 URL `slug`를 바탕으로 조회된 `academy_id` 조건이 필수로 결합됩니다.
  - 다른 학원의 학생 데이터나 세션 일지를 교차 조회할 수 없도록 격리됩니다.
