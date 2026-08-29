# data_v3 교재 메타데이터(Excel) 자동 생성 가이드라인

이 문서는 **AGY (Antigravity AI Agent)**가 스캔본 교재 PDF와 기본 엑셀 템플릿을 받아 `data_v3` 오답노트 시스템 표준 메타데이터 엑셀 파일(`[bookcode]_info.xlsx`)을 완벽하게 채우기 위한 작업 지침서입니다.

---

## 1. 전달받는 3가지 필수 입력 자료

1. **`[bookcode].pdf`**: 교재 전체 스캔본 PDF (예: `2022-kh-rpm-main.pdf`)
2. **`[bookcode]_info.xlsx`**: 메타데이터 엑셀 템플릿 파일
3. **본 작업 지침서 (`DATA_V3_EXCEL_GUIDE.md`)**

---

## 2. 엑셀 시트별 작성 상세 규칙

엑셀 파일은 총 5개 시트로 이루어져 있으며, AI가 주로 바로잡아 채워야 하는 탭은 **`unit_page` (2번째)** 및 **`problems` (3번째)** 탭입니다.

### ① `master` 탭 (1번째 시트)
- **목적:** 교재 기본 정보 확인
- `bookcode`: PDF 파일명의 기본 식별자 (예: `2022-rpm-kh-main`)
- `title`: 교재명
- `grade_category`, `publisher`, `is_active` 확인

### ② `unit_page` 탭 (2번째 시트) - ⚠️ AI 작성 대상
- **목적:** 교재 단원별 범위 및 페이지 매핑
- **분석 방법:**
  1. PDF의 **목차/차례 페이지(보통 3~5페이지)**를 열어 단원명과 시작 페이지를 확인합니다.
  2. PDF 맨 마지막 페이지를 확인하여 마지막 단원의 `end_page`를 결정합니다.
  3. 이전 단원의 `end_page`는 다음 단원 `start_page - 1`로 자동 설정합니다.

- **컬럼 정의:**
  - `unit_order`: 단원 순서 (1, 2, 3...)
  - `unit_code`: 단원 코드 (`u01`, `u02`, `u03`...)
  - `unit_name`: 단원 번호 및 단원명 (예: `01 이차곡선`, `02 이차곡선의 접선`)
  - `start_page`: 단원 시작 페이지 (정수)
  - `end_page`: 단원 종료 페이지 (정수)

- **작성 예시:**
  | unit_order | unit_code | unit_name | start_page | end_page |
  |:---:|:---:|:---|:---:|:---:|
  | 1 | u01 | 01 이차곡선 | 6 | 25 |
  | 2 | u02 | 02 이차곡선의 접선 | 26 | 39 |
  | 3 | u03 | 03 공간도형 | 40 | 55 |

---

### ③ `problems` 탭 (3번째 시트) - ⚠️ AI 작성 대상
- **목적:** 교재 전체 문제 식별자 목록 생성
- **분석 방법:**
  1. PDF의 본문 문제 번호 시작(1번)부터 마지막 문제 번호(예: 806번)를 확인합니다.
  2. 1번부터 마지막 번호까지 순차적으로 행을 생성합니다.

- **컬럼 정의 및 작성 규칙:**
  - `problem_code`: `[bookcode]_p[3자리페이지]_[4자리문제번호]` 포맷
    - *(주의: 페이지 추출 전 임시로 `p000` 처리하거나 렌더링 페이지 반영)*
    - 예시: `2022-rpm-kh-main_p000_q0001`, `2022-rpm-kh-main_p000_q0806`
  - `media_code`: **`None` (비워둘 것)**
  - `start_time`: **`None` (비워둘 것)**
  - `end_time`: **`None` (비워둘 것)**
  - `cue_title`: `1번`, `2번`, ..., `806번` (문제 번호 + '번')
  - `cue_type`: **`solution` (고정)**
  - `is_primary`: **`True` (고정)**

- **작성 예시:**
  | problem_code | media_code | start_time | end_time | cue_title | cue_type | is_primary |
  |:---|:---:|:---:|:---:|:---:|:---:|:---:|
  | `2022-rpm-kh-main_p000_q0001` | | | | `1번` | `solution` | `TRUE` |
  | `2022-rpm-kh-main_p000_q0002` | | | | `2번` | `solution` | `TRUE` |
  | `2022-rpm-kh-main_p000_q0806` | | | | `806번` | `solution` | `TRUE` |

---

## 4. AGY 실행 시 파이썬 가이드 코드

AGY는 `openpyxl` 라이브러리를 사용하여 엑셀을 직접 갱신할 수 있습니다.

```python
import openpyxl

file_path = "2022-kh-rpm-main_info.xlsx"
wb = openpyxl.load_workbook(file_path)

# 1. unit_page 업데이트
ws_unit = wb['unit_page']
ws_unit.delete_rows(2, ws_unit.max_row + 1)
unit_data = [
    [1, 'u01', '01 이차곡선', 6, 25],
    [2, 'u02', '02 이차곡선의 접선', 26, 39],
    # ... 추가 단원 ...
]
for r_idx, row in enumerate(unit_data, start=2):
    for c_idx, val in enumerate(row, start=1):
        ws_unit.cell(row=r_idx, column=c_idx, value=val)

# 2. problems 업데이트
ws_prob = wb['problems']
ws_prob.delete_rows(2, ws_prob.max_row + 1)
bookcode = '2022-rpm-kh-main'
for q_num in range(1, total_questions + 1):
    prob_code = f'{bookcode}_p000_q{q_num:04d}'
    cue_title = f'{q_num}번'
    row = [prob_code, None, None, None, cue_title, 'solution', True]
    for c_idx, val in enumerate(row, start=1):
        ws_prob.cell(row=q_num + 1, column=c_idx, value=val)

wb.save(file_path)
```

---

## 5. 검증 체크리스트
- [ ] `unit_page`의 `start_page`와 `end_page`가 빈틈없이 연속되는가?
- [ ] `problems`의 `problem_code` 문제 번호 4자리가 `q0001` 형식으로 맞춰졌는가?
- [ ] `media_code`, `start_time`, `end_time` 컬럼은 안전하게 비워져 있는가?
- [ ] `cue_title`에 '번' 접미사가 올바르게 붙어 있는가? (예: `102번`)
