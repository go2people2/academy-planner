# 📐 3세대 클린 데이터 아키텍처 및 미디어 타임스탬프 명세 (data_v3)

> **문서 목적**: AMS(Academy Management System) 및 오답노트(Hokmanote)의 대규모 확장(교재 200권, 문항 30만 개 이상)을 대비하여, 문항 이미지 고유 식별자 규격과 AMF-YouTube 하이브리드 미디어 스트리밍 아키텍처(Media-Source-Cue)의 영구 표준 가이드를 정의합니다.

---

## 1. 📝 3세대 클린 문항 데이터 포맷 규격 (`data_v3`)

### 1.1 배경 및 개선 목적
- **기존 (2세대)**: 한글 폴더명 및 한글 파일명 (`중학교 2학년/중2-1 쎈B/01. 유리수와 순환소수/0001.png`)
  - **문제점**: Mac(NFD)과 Windows/Linux(NFC) 간 유니코드 한글 자모 분리 현상(`ㅇㅠㄹㅣㅅㅜ...`), 공백/특수문자 및 OS 간 경로 깨짐 에러 빈번 발생.
- **3세대 (`data_v3`)**: 영문 ASCII 기반 고유 파이프라인 및 `.webp` 포맷
  - **개선점**: OS 간 유니코드 자모 분리 에러 100% 소멸, 글로벌 유일 식별성 보장, WebP 압축을 통한 60~80% 용량 절감 및 초고속 로딩.

### 1.2 독립 교재 패키지 구조
```text
backend/data_v3/[bookcode]/
  ├── book_info.xlsx                 # 교재 메타데이터 (단원, 페이지, 문항 매핑)
  ├── gnssen-m31-15_p018_q03.webp    # 문항 이미지 (.webp)
  ├── gnssen-m31-15_p018_q04.webp
  └── ...
```

### 1.3 영문 교재 코드 (`bookcode`) 규격
- **포맷**: 소문자 영문 / 숫자 / 하이픈(`-`) 조합
- **예시**:
  - `gnssen-m31`: 개념쎈 중3-1
  - `rpm-m31`: RPM 중3-1
  - `gnssen-m31-15`: 2015년 개정판 구분을 위해 접미사 `-15` 부여

### 1.4 문항 이미지 파일명 식별자 규칙 (`.webp`)
```text
고유 식별자 = [bookcode] + _p[3자리페이지] + _q[문항번호]
```

- **단원별 리셋형**: `[bookcode]_p[3자리페이지]_q[2자리문항].webp`
  - 예: `bla-m31-15_p018_q03.webp` (블랙라벨 중3-1 2015개정, 18페이지 3번 문항)
- **전체 누적 연번형**: `[bookcode]_p[3자리페이지]_q[4자리연번문항].webp`
  - 예: `rpm-m31_p018_q0067.webp` (RPM 중3-1, 18페이지 67번 문항)

---

## 2. 🎬 하이브리드 미디어 스트리밍 & 타임스탬프 아키텍처 (Media-Source-Cue)

### 2.1 분리 아키텍처의 필요성
RPM 공수1의 1,500문항을 처리할 때 문제마다 전체 동영상 URL을 중복 저장하면 유지보수 재앙이 발생합니다. 영상 콘텐츠(`Media`), 재생 소스(`Source`), 문제별 시작 시점(`Cue`)을 3중 구조로 분리하여 효율성과 확장성을 극대화합니다.

```text
  [lecture_media] (강의 자체 콘텐츠 - 예: "RPM 공수1 1단원 해설, 86분")
         │
         ├───► [lecture_media_sources] (재생 경로 분리)
         │       ├─ 학원 내부망: AMF MP4 상대경로 (/videos/rpm_cs1_ch01.mp4)
         │       └─ 집 복습용: YouTube URL (https://youtu.be/ABCDE12345)
         │
         └───► [problem_video_cues] (문제별 책갈피 타임스탬프)
                 ├─ 7번 문제  ➔ start_seconds: 1125 (18:45)
                 ├─ 12번 문제 ➔ start_seconds: 1470 (24:30)
                 └─ 13번 문제 ➔ start_seconds: 1870 (31:10)
```

### 2.2 하이브리드 운영 시나리오 (학원 AMF vs 집 YouTube)
- **학원 내부망 시청 시**:
  - 학원 내부 PC 및 스마트폰 접속 시 AMF 로컬 서버 주소(`http://192.168.0.109:8080/videos/...`)를 사용하여 무제한 초고속 로컬 시청.
- **가정 복습 시청 시**:
  - 학원 IP 접근이 불가능한 가정/스터디카페 접속 시 YouTube 링크(`https://youtu.be/...`)로 자동 스위칭되어 끊김 없는 학습 제공.
- **학생 UX 통일성**:
  - 어디서 시청하든 동일한 **AMS 전용 팝업 플레이어 모달(`VideoPlayerModal`)** 안에서 짠! 하고 오픈되어 외부 앱 이탈 없이 학습 몰입 유지.

---

## 3. 📊 DB 테이블 데이터 모델링 가이드

### 3.1 `lecture_media` (강의 콘텐츠 마스터)
| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `id` | BigInt / UUID | PK |
| `textbook_id` | String | 교재 식별자 (`bookcode`) |
| `unit_id` | String | 단원 식별자 |
| `title` | String | 강의 제목 (예: "RPM 공수1 1단원 해설") |
| `duration_seconds` | Integer | 전체 영상 길이 (초 단위) |
| `is_published` | Boolean | 공개 여부 |

### 3.2 `lecture_media_sources` (재생 소스)
| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `id` | BigInt / UUID | PK |
| `media_id` | BigInt / UUID | FK (`lecture_media.id`) |
| `source_type` | Enum | `amf_mp4` \| `youtube` |
| `source_url` | String | AMF 상대경로 (`/videos/...mp4`) 또는 YouTube URL |
| `is_active` | Boolean | 활성화 여부 |
| `priority` | Integer | 우선순위 (1: AMF, 2: YouTube 등) |

### 3.3 `problem_video_cues` (문항별 타임스탬프)
| 필드명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `id` | BigInt / UUID | PK |
| `problem_id` | String | `data_v3` 문항 식별자 (`gnssen-m31-15_p018_q03`) |
| `media_id` | BigInt / UUID | FK (`lecture_media.id`) |
| `start_seconds` | Integer | 시작 초 (예: 1470초 = 24분 30초) |
| `end_seconds` | Integer | 종료 초 (선택 사항) |
| `cue_title` | String | 타임스탬프 제목 (예: "12번 풀이") |
| `cue_type` | Enum | `concept` \| `solution` \| `hint` |
| `is_primary` | Boolean | 대표 해설 여부 |

---

## 4. 🚀 대규모 확장 로드맵 (교재 200권 / 30만 문항)

1. **상대 경로 보존**: AMF 소스에는 전체 IP 주소를 넣지 않고 `/videos/파일명.mp4` 상대 경로만 저장하여 학원 서버 주소 변경 시에도 DB 수정 최소화.
2. **테넌트(Tenant) 격리**: 교재 및 문항 마스터 데이터는 공용으로 관리하되, 학원별 Settings(`base_server_url`)와 학생 오답/시청 기록은 `academy_id` 기반 완벽 격리.
3. **단계별 적용**: 초기 단원별 1개 영상 ➔ 주요 오답 문항 Cue 등록 ➔ 30만 문항 전체 확장 순으로 가볍게 시작하여 유연하게 확장.

---
*최종 업데이트: 2026-08-15 | AMS & Hokmanote 아키텍처 명세 가이드*
