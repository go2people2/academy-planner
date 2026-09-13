# 🍏 HokmaNote macOS 클라이언트 연동 및 인증 규격서 (v1.0)

> **문서 목적**: 본 문서는 HokmaNote macOS 로컬 앱 개발자가 학원 자동 등록, 일회성 설치 코드 활성화, 주기적 라이선스 검증 및 오프라인 캐시 정책을 구현할 수 있도록 서버 API 계약과 로컬 설정 파일 규격을 정의합니다.

---

## 1. 📁 로컬 파일 저장 경로 및 보존 원칙

### 1) 사용자 데이터 격리 디렉토리
앱 업데이트, 덮어쓰기, 재설치 시에도 고객의 데이터가 유실되지 않도록 **반드시 macOS Application Support 경로**를 단일 루트로 사용합니다.

* **루트 디렉토리**:
  ```text
  ~/Library/Application Support/HokmaNote/
  ```

### 2) 세부 파일 및 데이터베이스 배치

| 파일/디렉토리명 | 설명 | 보존 규칙 |
| :--- | :--- | :--- |
| **`academy_config.json`** | 활성화 후 발급된 학원 기본 설정 및 라이선스 캐시 메타데이터 | **절대 덮어쓰기 금지** (앱 첫 실행 시 존재 여부 확인) |
| **`app.db`** | 학생 관리, 출력 이력, 오답노트 큐 등 로컬 SQLite DB | **절대 덮어쓰기 금지** |
| **`data_v3/`** | 교재 원본 PDF, 분할된 문항 이미지 | **절대 덮어쓰기 금지** (로컬 디스크 유지) |
| **`past_exams/`** | 학원 자체 기출문제 및 시험지 PDF | **절대 덮어쓰기 금지** |

> 🚨 **보안 주의사항**:
> * `SUPABASE_SERVICE_ROLE_KEY`, 관리자 비밀번호, 카드 정보, 설치 코드 원문은 앱 패키지나 로컬 설정 파일에 **절대로 저장하지 않습니다.**
> * `refresh_token`은 가급적 **macOS Keychain(키체인)**에 안전하게 보관하는 것을 강력히 권장합니다.

---

## 2. 📄 `academy_config.json` 포맷 명세

앱 활성화 성공 시 `~/Library/Application Support/HokmaNote/academy_config.json`에 저장되는 표준 JSON 구조입니다.

```json
{
  "version": 1,
  "academy_id": "7b0d9124-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "academy_name": "Hokma 수학",
  "slug": "hokma",
  "device_id": "9921efxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "device_uuid": "MAC-UUID-A1B2-C3D4-E5F6",
  "activated_at": "2026-09-14T07:30:00.000Z",
  "license": {
    "status": "active",
    "grace_period_days": 14,
    "last_checked_at": "2026-09-14T07:30:00.000Z",
    "offline_cache_until": "2026-09-28T07:30:00.000Z"
  }
}
```

---

## 3. 🌐 서버 API 계약 (Endpoints)

* **서버 베이스 URL**: `https://hokmanote.xyz` (또는 Vercel 운영 도메인)

---

### ① 최초 설치 코드 활성화 (`/api/app/v1/activate`)

원장님이 앱 첫 실행 시 화면에 나타나는 입력창에 AMS 관리자에게 전달받은 16자리 코드를 입력했을 때 호출합니다.

* **Method**: `POST`
* **URL**: `/api/app/v1/activate`
* **인증**: 불필요 (Public, Rate Limit 적용: IP 및 device_uuid당 5회 실패 시 15분 차단)
* **요청 본문 (JSON)**:
  ```json
  {
    "code": "HN-7K9A-4820-WXYZ",
    "device_uuid": "MAC-UUID-A1B2-C3D4-E5F6",
    "device_name": "원장실 Mac mini M2",
    "platform": "macos",
    "os_version": "15.0",
    "app_version": "1.0.0"
  }
  ```

* **성공 응답 (`200 OK`)**:
  ```json
  {
    "success": true,
    "config": {
      "academy_id": "7b0d9124-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "academy_name": "Hokma 수학",
      "slug": "hokma",
      "device_id": "9921efxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "access_token": "eyJhbGciOi...",
      "refresh_token": "rt_8f29...",
      "license": {
        "status": "active",
        "grace_period_days": 14,
        "offline_cache_until": "2026-09-28T07:30:00.000Z"
      }
    }
  }
  ```

* **실패 응답 (`400 Bad Request` / `429 Too Many Requests`)**:
  ```json
  {
    "success": false,
    "error": "유효하지 않거나 만료된 설치 코드입니다."
  }
  ```

---

### ② 주기적 라이선스 검증 & 하트비트 (`/api/app/v1/license-check`)

앱 구동 시 백그라운드로 호출하여 라이선스 유효성 및 기기 해제 여부를 확인합니다.

* **Method**: `GET`
* **URL**: `/api/app/v1/license-check`
* **인증**: `Authorization: Bearer <access_token>`

* **성공 응답 (`200 OK`)**:
  ```json
  {
    "success": true,
    "status": "active",
    "grace_period_days": 14,
    "server_time": "2026-09-14T08:00:00.000Z"
  }
  ```

* **기기 해제 시 응답 (`401 Unauthorized`)**:
  ```json
  {
    "success": false,
    "error_code": "DEVICE_REVOKED",
    "message": "해당 기기의 등록이 해제되었습니다. 관리자에게 새 설치 코드를 요청하세요."
  }
  ```
  > 💡 앱 처리: `academy_config.json`의 라이선스 상태를 즉시 무효화하고, "등록이 해제된 기기입니다. 관리자에게 문의하세요" 팝업을 표시합니다. (로컬 교재/오답 DB는 절대 삭제하지 않음)

---

### ③ 토큰 갱신 (`/api/app/v1/refresh-token`)

`access_token`이 만료(1시간)되었을 때 새 토큰을 요청합니다.

* **Method**: `POST`
* **URL**: `/api/app/v1/refresh-token`
* **요청 본문 (JSON)**:
  ```json
  {
    "device_id": "9921efxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "refresh_token": "rt_8f29..."
  }
  ```

* **성공 응답 (`200 OK`)**:
  ```json
  {
    "success": true,
    "access_token": "eyJhbGciOi...새_토큰...",
    "expires_in": 3600
  }
  ```

---

## 4. 🛡️ 오프라인 내결함성 (Offline Grace Period) 정책

1. **14일 오프라인 유예**:
   * 인터넷 단절, 와이파이 불안정 등으로 서버 통신이 실패하더라도, 앱은 **`academy_config.json`의 `offline_cache_until` 일시까지 100% 정상 작동**합니다.
   * 로컬 오답노트 조판, PDF 생성, 시험지 인쇄가 오프라인에서도 중단 없이 실행됩니다.
2. **미납/이용 중지 시 데이터 보존 원칙**:
   * 서버에서 라이선스가 `suspended` 또는 만료되었더라도, 학원 Mac 내의 **`app.db`, `data_v3`, `past_exams`는 절대로 삭제하거나 훼손하지 않습니다.**
   * 신규 PDF 조판 및 중앙 동기화 기능만 안전하게 잠금 처리됩니다.
