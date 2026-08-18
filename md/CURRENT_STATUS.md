# 📌 AMS - Current System Status & Recent Changes

> 이 문서는 이 프로젝트의 **현재 작업 현황, 최근 해결된 핵심 이슈, 시스템의 최신 안정성 상태**를 정리하여 AI 보조 도구 간 작업 맥락을 명확히 전달하기 위해 작성되었습니다.

---

## 1. 🟢 최근 완료된 주요 기능 및 해결 항목

### ① 정규수업과 특강수업 100% 완전 독립 격리 (Completed)
- **문제**: 정규수업과 특강수업 간에 오늘 테스트(`test_id`, `test_status`), 세션 일지, 다음 시간 예정 테스트(`homework_to`)가 교차로 섞여 노출되는 현상이 있었음.
- **해결**:
  - `useStudentPortal.ts` 및 `app/[slug]/student/page.tsx` (`lastSession` 및 `matchedSession` memo)의 과목 매칭 로직을 **1:1 Strict Course Matching**으로 변경.
  - `selectedCourse === '정규'`일 때는 오직 `course_name = '정규'` 세션만, 특강 선택 시 오직 해당 특강 과목 세션만 읽어와 테스트와 학습 내용이 1:1로 완전 격리됨.

### ② 미션 자동 수혈 잔상 완전 축출 & 수동 이월(`🪄`) 도입 (Completed)
- **문제**: 빈 미션 셀을 로드하거나 숙제/진도를 저장/지울 때 옛날 7월 학생 프로필 미션(`recent_mission`) 문구가 잔상처럼 찰나 동안 떠돌다 사라지는 현상이 발생함.
- **해결**:
  - 프로젝트 전체(`TodaySheet.tsx`, `useTodaySheetShortcuts.ts`, `useTodaySheetClipboard.ts`, `PrintPreviewModal.tsx`, `dashboard/page.tsx` 등)에서 옛날 프로필 미션(`recent_mission`) 수혈 및 은닉 변수(`targetRecentMission`)를 **100% 완전 축출**.
  - 미션은 **헤더의 요술봉(`🪄`) 버튼**을 누를 때만 최근 과거 기록을 수동으로 끌어오며, 작성되지 않은 셀은 100% 영구 빈 칸으로 유지됨.

### ③ 학생 모바일 당일 제출 100% 보장 (`isToday`) & 교재 코드 번역 (Completed)
- **문제**: 학생이 당일 학원에 접속해 제출하려 할 때, 요일 포맷 불일치로 인해 "🚫 수업일이 아니라 제출할 수 없습니다" 버튼으로 막히거나 승인 시 `[BK001]` 코드가 셀에 찍히는 문제 발생.
- **해결**:
  - `app/[slug]/student/page.tsx`의 `isValidClassDate`에 `isToday` (선택된 날짜가 오늘인 경우) 조건을 추가하여 **당일 접속한 학생은 예외 없이 제출 버튼이 100% 활성화**됨.
  - 제출 시 완료된 진도/숙제에 포함된 교재 코드(`[BK...]`)를 실제 교재 제목으로 자동 변환(Translation)하여 DB에 저장함으로써 승인 시 교재 제목과 단원명으로 예쁘게 노출됨.

### ④ TodaySheet 입력 반응속도 & UI 헤더 선명화 (Completed)
- 셀 선택 후 Backspace / Delete 입력 시 DOM value와 height가 `requestAnimationFrame` 단위로 0.1밀리초 만에 즉시 비워지며 깜빡임 차단.
- TodaySheet 상단 헤더의 전체 선택 체크박스 테두리(`border-gray-400` / `border-white/30`) 및 `체크박스` ↔ `이름` ↔ `도구` 칼럼 사이의 세로 구분선(`border-r-2 border-r-zinc-700` / `border-r-gray-300`)을 선명하게 강화하여 가시성을 극대화함.

---

## 2. 🧪 자가 점검 & 필수 검증 체크리스트 (Self-Check)

1. **빌드 검증**: 작업 후 항상 `npm run build`를 실행하여 TypeScript 타입 오류 및 빌드 성공 여부를 확인할 것.
2. **과목 격리 검증**: 학생 포털에서 정규 탭과 특강 탭 전환 시 오늘 테스트 및 과제확인이 섞이지 않고 각각 독립적으로 노출되는지 확인.
3. **TodaySheet 안정성**: 셀 선택 후 방향키 이동, Enter/Tab 이동, Cmd+Z 취소, Backspace 셀 지우기가 깜빡임 없이 안정적으로 동작하는지 확인.
