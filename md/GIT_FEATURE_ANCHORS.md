# ⚓ TodaySheet 기능별 Git 앵커 & 검증 이력 맵 (GIT_FEATURE_ANCHORS.md)

> **용도**: 
> TodaySheet(Daily Sheet)의 특정 기능이 실제로 잘 작동하여 검증된 시점의 Git Commit Hash를 기록하는 기준점 지도입니다.
> 다른 기능을 수정하다가 사이드 이펙트(회귀)가 발생했을 때, 해당 기능이 잘 작동하던 과거 커밋과 즉시 `git diff`를 대조하거나 복구하기 위한 용도로 사용합니다.
> **(원칙: 실제 브라우저 검증이 완료된 기능만 앵커로 등록하고 누적해 나갑니다.)**

---

## 📌 기능별 검증 커밋 앵커 인덱스 (Anchor Index)

| 기능 영역 | 검증된 동작 내용 | 기준 Git Commit Hash | 등록 일자 | 관련 파일 |
| :--- | :--- | :---: | :---: | :--- |
| **순환 출결 저장 & 롤백 차단** | '수업전' ➔ '출석' 클릭 후 1~2초 뒤 '수업전'으로 되돌아가지 않고 유지 | `00f7054` | 2026-09-01 | `page.tsx`, `useTodaySheetRowLogic.ts` |
| **결석 사유 저장 & 팝오버 안정화** | 결석 팝오버에서 사유 입력 ➔ 저장 즉시 반영 및 재오픈/새로고침 후 보존 | `00f7054` | 2026-09-01 | `page.tsx`, `TodaySheetCell.tsx`, `useTodaySheetRowLogic.ts` |
| **텍스트 셀 동기화 & 클립보드 잘라내기** | `Cmd+X` 즉시 비우기, 글자 삭제 후 Blur 시 내용 부활 방지, 편집 중 BS 보호 | `9c1e6ff` | 2026-09-01 | `SimpleTextCell.tsx`, `TodaySheetCell.tsx`, `useTodaySheetClipboard.ts` |
| **순수 계약 & 세션 식별 (Phase 1)** | `SessionIdentity` 및 `SessionPatch` 타입/유틸 순수 추출 (동작 영향 0건) | `9a432ab` | 2026-09-01 | `types/sessionContract.ts`, `lib/sessionIdentity.ts` |
| **학생 일지 동시 편집 보호 & Fail-Closed** | 승인된 학생 제출 내용이 오래 열린 빈 창의 빈값("") 저장으로 덮어써지는 것 차단 및 복원 | `4fdc7bd` | 2026-09-05 | `dashboard/page.tsx`, `dashboard-light/page.tsx` |
| **Gemini AI 브리핑 연동 & 프롬프트 보존** | 구버전 404 모델 교체 및 마스터 학원 설정 저장 시 `custom_prompt` deep-merge 보존 | `7df67ae` | 2026-09-05 | `api/briefing/route.ts`, `api/master/update-academy/route.ts`, `master/page.tsx` |

---

## 📝 커밋별 상세 앵커 로그 (Detail Anchor Log)

### 🔹 [Commit: `7df67ae`] Gemini AI 브리핑 404 모델 교체 및 커스텀 프롬프트 deep-merge 보존
* **등록 일자**: 2026-09-05
* **해결 및 검증된 문제**:
  1. **Gemini 404 오류 해결**: 구버전 `gemini-1.5-pro` 호출 시 발생하던 404 Not Found 에러를 제거하고 실제 지원되는 최신 Gemini 엔드포인트로 교체.
  2. **마스터 설정 저장 시 AI 프롬프트 보존**: 마스터 페이지에서 학원 설정을 저장할 때 기존 `operation_settings.ai_settings.custom_prompt`가 덮어써져 사라지지 않도록 서버 API에서 `ai_settings` deep-merge 처리.
  3. **마스터 UI 레이블 동기화**: 마스터 설정 화면의 AI 엔진 표시명을 최신 모델명으로 갱신.
* **관련 파일**:
  - `app/api/briefing/route.ts`
  - `app/api/master/update-academy/route.ts`
  - `app/master/page.tsx`

---

### 🔹 [Commit: `4fdc7bd`] TodaySheet 승인된 학생 제출 일지 동시 편집 덮어쓰기 방어 (Fail-Closed)
* **등록 일자**: 2026-09-05
* **해결 및 검증된 문제**:
  1. **오래된 창의 빈값 덮어쓰기 원천 차단**: 3~4인 공유 원장 계정 환경에서, 다른 기기/창이 학생 일지를 승인한 직후 오래 열려 있던 빈 TodaySheet 창이 `completed_classwork_text`나 `homework_text`에 빈값(`""`) 저장을 시도할 때 사전 감지하여 저장을 차단(`return false`)하고 DB의 승인된 텍스트로 로컬 상태를 복원.
  2. **Fail-Closed 안전 정책**: 최신 상태 사전 조회 중 네트워크 장애/DB 에러 또는 세션 불일치 발생 시, 데이터 유실을 방지하기 위해 저장을 안전하게 중단하고 새로고침 안내 모달 표시.
  3. **교사 정상 업무 무간섭 보장**: 출결, 점수, 특이사항, 비어있지 않은 새 진도 입력은 사전 조회를 거치지 않고 기존대로 즉시 저장.
* **관련 파일**:
  - `app/[slug]/dashboard/page.tsx`
  - `app/[slug]/dashboard-light/page.tsx`

---

### 🔹 [Commit: `9c1e6ff`] 텍스트 셀 동기화 및 클립보드 잘라내기(Cmd+X) 안정화
* **등록 일자**: 2026-09-01
* **해결 및 검증된 문제**:
  1. **Cmd+X (잘라내기) 즉시 비우기**: 단일 셀(`activeCell`) 및 멀티셀(`selectedRange`)에서 `Cmd+X` 시 즉시 클립보드 복사 + 화면 셀 내용 `''` 클리어 + DB 배치 저장 완벽 작동.
  2. **글자 삭제 후 Blur 시 부활 방지**: 텍스트 셀 내용을 백스페이스로 지우고 다른 셀 클릭(Blur) 시 이전 내용이 다시 나타나던 버그 해결 (`(e.currentTarget as HTMLTextAreaElement).value` 최우선 반영 및 draft 리셋).
  3. **편집 중 Backspace 보호**: textarea 내부 편집 중에는 전역 단축키 간섭 없이 브라우저 네이티브 글자 단위 삭제 100% 보장.
* **관련 파일**:
  - `components/dashboard/hooks/useTodaySheetClipboard.ts`
  - `components/dashboard/todaySheet/cells/SimpleTextCell.tsx`
  - `components/dashboard/todaySheet/TodaySheetCell.tsx`
  - `components/dashboard/hooks/useTodaySheetShortcuts.ts`
  - `lib/todaySheetDomSync.ts`

### 🔹 [Commit: `00f7054`] 순환 출결 저장 분기 및 결석 사유/팝오버 안정화
* **등록 일자**: 2026-09-01
* **해결 및 검증된 문제**:
  1. **출결 롤백 차단**: 출석 클릭 시 즉시 바뀌었다가 1~2초 뒤(네트워크 응답 시점) 다시 '수업전'으로 롤백되던 문제 해결.
  2. **결석 사유 저장 & 팝오버 안정화**: 결석 상태에서 연필(📝) 팝오버로 입력한 결석 사유(`attendance_reason`)가 DB에 안전하게 update/insert되고, 재오픈 및 새로고침 후에도 정상 보존됨 확인.
* **검증된 핵심 구현**:
  1. `app/[slug]/dashboard/page.tsx` (`saveTodaySession`):
     - Supabase 복합 `onConflict`(`student_id,session_date,course_name,moved_to_hour`) 에러(42P10)로 인해 저장이 실패하던 것을 방지.
     - `targetId`가 존재하면 `update().eq('id', targetId)`, 없으면 `insert()`로 명시적 분기하여 출결 및 결석 사유 DB 저장 성공 보장.
  2. `components/dashboard/hooks/useTodaySheetRowLogic.ts`:
     - 저장 완료 1초 뒤 무조건 `getInitialFormData(rowDate)`를 호출하여 화면을 덮어쓰던 임의의 `setTimeout(..., 1000)` 타이머 완전 제거.
* **관련 파일**:
  - `app/[slug]/dashboard/page.tsx`
  - `app/[slug]/dashboard-light/page.tsx`
  - `components/dashboard/hooks/useTodaySheetRowLogic.ts`
  - `components/dashboard/todaySheet/TodaySheetCell.tsx`
* **비고**: 출결 및 결석 사유 외 다른 기능(삭제, 텍스트 저장 등)은 단계별 점검 및 테스트 진행 중.

---

### 🔹 [Commit: `9a432ab`] Phase 1: SessionIdentity 및 SessionPatch 순수 계약 추출
* **등록 일자**: 2026-09-01
* **목적**: 기존 동작 변경 없이, 향후 정규/특강/보강 세션을 일관되게 특정하기 위한 순수 타입과 유틸 함수 정의
* **생성된 파일**:
  - `types/sessionContract.ts` (`SessionIdentity`, `SessionPatch`, `SaveSessionPatchRequest`)
  - `lib/sessionIdentity.ts` (`isValidDbSessionId`, `createSessionIdentity`, `isMatchingIdentity`, `findMatchingLog`)
* **비고**: 기존 호출부 수정 0건으로 독립 보존됨.

---

## 🧭 앞으로의 기록 원칙

1. **섣부른 정상 판정 금지**: 코드를 수정했다고 바로 적지 않고, **실제 브라우저 화면에서 원장님/선생님이 직접 테스트하여 확실히 잘 동작함이 확인된 기능만** 커밋 해시와 함께 추가합니다.
2. **다른 기능이 고장 났을 때의 활용법**:
   ```bash
   # 예: 출결 기능이 잘 되던 시점과 현재 코드의 차이점 비교
   git diff 00f7054 components/dashboard/hooks/useTodaySheetRowLogic.ts
   ```
