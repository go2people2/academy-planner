# 📘 Data v3 교재 엑셀 템플릿 작성 가이드 (User Manual)

> **핵심 원칙**: **교재 1권 = Excel 파일 1개** (`[bookcode]_info.xlsx`, 예: `m11-gnssen_info.xlsx`)  
> 본 가이드는 AMS 및 Hokmanote Data v3 업로더가 정상 인식할 수 있도록 교재 메타데이터, 단원 범위, 문항  Cue, 동영상 미디어 및 재생 소스를 엑셀로 작성하는 매뉴얼입니다.

---

## 1. 📌 운영 및 입력 기본 규칙

1. **교재 독립 패키지**: 공용 교재든 학원 자체 교재든 동일한 5개 탭 엑셀 구조를 사용하며, 교재 1권당 1개의 엑셀 파일로 관리합니다.
2. **코드 표기 규칙 (Strict Code Rules)**:
   - `bookcode`, `unit_code`, `media_code`, `problem_code` 등 **code 계열은 반드시 영문 소문자, 숫자, 하이픈(`-`), 언더바(`_`)만 사용**합니다.
   - 코드 값에는 한글, 공백, 대문자를 절대 사용하지 않습니다.
3. **사람이 읽는 텍스트**: 교재 제목(`title`), 단원명(`unit_name`), 꿀팁 메모(`note`) 등 사람이 읽는 표기에는 자유롭게 한글 및 공백 작성이 가능합니다.
4. **Boolean 값**: 참/거짓 설정값은 반드시 대문자 **`TRUE`** 또는 **`FALSE`** 로 표기합니다.
5. **시간 입력 규칙 (Duration Format)**:
   - 엑셀의 `start_time`, `end_time`, `duration_time` 은 초 단위 숫자가 아니라 **사람이 읽기 쉬운 기간 형식(`m:ss` 또는 `h:mm:ss`)**으로 입력합니다.
   - 엑셀/Numbers에서 시각(DateTime)이 아닌 **기간(Duration)** 형식으로 작성합니다.
   - 업로드 서버가 이를 인식하여 DB 저장 시 초 단위(`start_seconds` 등)로 자동 변환합니다.
   - *입력 예시*: `0:10` (10초), `2:30` (150초), `10:20` (620초), `1:02:30` (3750초)
6. **문항 이미지 파일명 일치 규칙**:
   - 스캔받은 문항 이미지 파일명은 `problem_code`와 1:1로 정확히 동일해야 합니다 (예: `m11-gnssen_p008_q0001.webp`).
   - ⚠️ 이미지 파일명에는 단원 코드를 넣지 않습니다.

---

## 2. 📄 5개 탭 구조 및 헤더 명세

엑셀 파일은 정확히 아래 **5개의 탭**으로 구성해야 합니다. 과거의 별도 `video_cues` 탭은 사용하지 않으며, 문제별 Cue 타임스탬프 정보는 `problems` 탭에 포함하여 통합 관리합니다.

---

### 탭 1. `master` (교재 기본 정보 - 딱 1행 작성)

| 헤더 (A~H열) | 의미 | 입력 규칙 | 작성 예시 |
| :--- | :--- | :--- | :--- |
| **`bookcode`** | 교재 고유 코드 | 영문 소문자, 숫자, 하이픈만 사용 | `m11-gnssen` |
| **`title`** | 교재 한글 제목 | 공용 표준 교재명 | `개념쎈 중1-1` |
| **`grade_category`** | 학년/학기 구분 | 예: `중1`, `고1` 등 | `중1` |
| **`edition`** | 개정 연도 | 숫자 4자리 | `2022` |
| **`publisher`** | 출판사명 | 한글/영문 텍스트 | `좋은책신사고` |
| **`hokmanote_name`** | 오답노트 연결명 | (선택) 비어 있을 수 있음 | |
| **`status`** | 교재 상태 | `active` 또는 `inactive` | `active` |
| **`target_session`** | 권장 세션 수 | 숫자 | `20` |

---

### 탭 2. `unit_page` (단원 페이지 범위 - 단원별 1행)

| 헤더 (A~E열) | 의미 | 입력 규칙 | 작성 예시 |
| :--- | :--- | :--- | :--- |
| **`unit_order`** | 단원 순서 | 1부터 시작하는 숫자 | `1` |
| **`unit_code`** | 단원 고유 코드 | 대단원-소단원 코드 (`u01-1`, `u01-2`) | `u01-1` |
| **`unit_name`** | 단원 한글 명칭 | 텍스트 | `1.1 소인수분해` |
| **`start_page`** | 시작 페이지 | 인쇄 교재 기준 숫자 | `8` |
| **`end_page`** | 끝 페이지 | 인쇄 교재 기준 숫자 | `25` |

---

### 탭 3. `problems` (문항 마스터 & Cue 타임스탬프 통합 - 문제당 1행)

| 헤더 (A~G열) | 의미 | 입력 규칙 | 작성 예시 |
| :--- | :--- | :--- | :--- |
| **`problem_code`** | 문항 고유 식별자 | `[bookcode]_p[3자리페이지]_q[4자리문항]` | `m11-gnssen_p008_q0001` |
| **`media_code`** | 연결 강의 코드 | `media` 탭의 `media_code` 와 정확히 일치 | `m11-gnssen_u01-1_sol` |
| **`start_time`** | 동영상 시작 시간 | `m:ss` 또는 `h:mm:ss` 기간 형식 | `0:10` |
| **`end_time`** | 동영상 종료 시간 | `m:ss` 또는 `h:mm:ss` 기간 형식 | `2:30` |
| **`cue_title`** | 팝업 표시 제목 | 예: `1번 풀이` | `1번` |
| **`cue_type`** | 해설/개념 유형 | `solution` \| `concept` \| `hint` \| `review` | `solution` |
| **`is_primary`** | 대표 해설 여부 | `TRUE` 또는 `FALSE` | `TRUE` |

---

### 탭 4. `media` (학원 강의 마스터 - 강의별 1행)

| 헤더 (A~E열) | 의미 | 입력 규칙 | 작성 예시 |
| :--- | :--- | :--- | :--- |
| **`media_code`** | 강의 고유 코드 | 영문 소문자, 숫자, 언더바, 하이픈 | `m11-gnssen_u01-1_sol` |
| **`unit_code`** | 연결 단원 코드 | `unit_page` 탭의 `unit_code` 와 일치 | `u01-1` |
| **`title`** | 강의 한글 제목 | 사람이 읽는 강의 명칭 | `1단원 소인수분해 개념 및 대표문제 풀이` |
| **`duration_time`** | 강의 전체 시간 | `m:ss` 또는 `h:mm:ss` 기간 형식 | `10:20` |
| **`is_published`** | 학생 공개 여부 | `TRUE` (공개) 또는 `FALSE` (비공개) | `TRUE` |

---

### 탭 5. `media_sources` (강의 재생 경로 - 소스별 1행)

| 헤더 (A~F열) | 의미 | 입력 규칙 | 작성 예시 |
| :--- | :--- | :--- | :--- |
| **`media_code`** | 연결 강의 코드 | `media` 탭의 `media_code` 와 일치 | `m11-gnssen_u01-1_sol` |
| **`source_type`** | 재생 위치 유형 | `amf` (학원 MP4) 또는 `youtube` (유튜브) | `amf` |
| **`source_url`** | 실제 재생 경로 | 상대 경로(`/videos/...`) 또는 YouTube URL | `/videos/m11-gnssen_u01-1_sol.mp4` |
| **`is_active`** | 활성화 여부 | `TRUE` 또는 `FALSE` | `TRUE` |
| **`is_default_for_student`** | 학생 기본 소스 | `TRUE` (기본 소스) 또는 `FALSE` | `TRUE` |
| **`priority`** | 우선순위 | 1, 2, 3 숫자 | `1` |

> 💡 **다중 소스 작성 규칙**: 동일한 `media_code`에 대해 AMF 경로와 YouTube 주소가 모두 있는 경우 `media_sources` 탭에 별도의 행으로 2개를 작성합니다.  
> - 1행: `source_type = amf`, `source_url = /videos/m11-gnssen_u01-1_sol.mp4`, `is_default_for_student = TRUE`  
> - 2행: `source_type = youtube`, `source_url = https://youtu.be/HOKMA_VIDEO_123`, `is_default_for_student = FALSE`

---

## 3. 🔍 자동 검증 및 업로드 체크리스트 (Upload Validator Rules)

업로드 API 실행 시 서버의 자동 검증 엔진이 아래 11개 항목을 사전 검증하며, 하나라도 위반 시 업로드가 거부(Reject)됩니다.

- [ ] **1. 연결성**: `problems.media_code` 가 `media` 탭의 `media_code`에 존재하는가?
- [ ] **2. 연결성**: `media_sources.media_code` 가 `media` 탭의 `media_code`에 존재하는가?
- [ ] **3. 연결성**: `media.unit_code` 가 `unit_page` 탭의 `unit_code`에 존재하는가?
- [ ] **4. 중복 금지**: `problem_code` 가 교재 내에서 중복되지 않았는가?
- [ ] **5. 중복 금지**: `media_code` 가 `media` 탭 내에서 중복되지 않았는가?
- [ ] **6. 소스 중복 방지**: 동일 `media_code` 내에서 동일한 `source_type` 이 중복되지 않는가?
- [ ] **7. 기본 소스 유일성**: 각 `media_code` 당 `is_default_for_student = TRUE` 인 소스가 정확히 최대 1개인가?
- [ ] **8. 시간 포맷**: `start_time`, `end_time`, `duration_time` 이 유효한 기간 형식(`m:ss` 또는 `h:mm:ss`)인가?
- [ ] **9. 시간 순서**: `end_time` 이 작성된 경우 `start_time` 보다 뒤에 위치하는가?
- [ ] **10. 시간 범위**: Cue의 `start_time` / `end_time` 이 영상 전체 `duration_time` 을 초과하지 않는가?
- [ ] **11. 테넌트 보안**: 엑셀 시트에 `academy_id` 를 적지 않았는가? (서버가 로그인 세션 기준으로 강제 부여함)

---
*Data v3 교재 엑셀 템플릿 가이드 매뉴얼*
