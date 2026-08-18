# Daily Sheet 자동채움(이월) 및 백스페이스 삭제 메커니즘 가이드 (DAILY_SHEET_AUTOFILL_RULES.md)

## 📌 문서 개요
본 문서는 **Daily Sheet**에서 단일/멀티셀 선택 후 `Backspace`/`Delete` 입력 시 발생하는 삭제 문제, 데이터 원복(살아남) 문제, 그리고 각 컬럼(입력창)별 자동 채움(이월) 규칙을 명확히 정의합니다.
다음 AI 에이전트(AGY Agent)나 개발자가 코드를 수정할 때 **이 메커니즘을 훼손하지 않도록** 반드시 읽고 준수해야 합니다.

---

## 1. 🚨 과거 사고 및 발생했던 문제 (Problem History)

### 1) 백스페이스 삭제 및 Cmd+D / 복사·붙여넣기 후 새로고침해야 반영되던 현상 (State & DOM Sync Issue)
- **원인**: 백스페이스 삭제, `Cmd + D` (아래로 복사), `Cmd + C/V` (붙여넣기) 실행 시 일괄 저장을 표기하는 `__ams_batch_saving = true` 락(Lock)이 걸렸는데, 개별 행 컴포넌트(`TodaySheetRow`)의 `useTodaySheetRowLogic.ts`에서 `isBatchSaving`일 때 자식 State(`formData`) 갱신을 스킵하는 조건문이 동작했습니다.
- **결과**: 부모 State(`students`)와 Supabase DB에는 정상 업데이트되었지만, 자식 화면(`formData`)이 저장 중 락에 걸려 이전 텍스트를 그대로 유지하여 새로고침하기 전까지는 삭제/복사 결과가 눈에 보이지 않거나 이전 값으로 원복되었습니다.

### 2) 오늘TEST 지움 시 실시간 자동 복구 문제 (Over-engineered Auto-restore)
- **원인**: `useTodaySheetShortcuts.ts`의 `Backspace` 처리 로직 내에서 `test_id`를 지울 때, "지난 수업의 예정 테스트(`next_quiz_text`)가 있으면 이를 가져와서 `test_id`에 다시 채워 넣는 코드"가 있었습니다.
- **결과**: 사용자가 새 테스트 내용을 쓰기 위해 `Backspace`로 비우는 순간 실시간으로 이전 예약 테스트가 재입력되어 삭제가 불가능했습니다.

### 3) 미션/주의점 지움 시 과거 기록 자동 수혈 문제
- **원인**: `useTodaySheetRowLogic.ts`의 `getInitialFormData`에서 당일 `mission`이나 `management_notes`가 비어있으면(`""`), 과거 수업 세션 기록 중 가장 최근 작성된 값을 자동으로 찾아와 덮어씌웠습니다.
- **결과**: 미션을 지워도 과거 미션 기록이 계속 다시 튀어나왔습니다.

---

## 2. 💡 대원칙: 자동 채움(이월) 및 삭제 메커니즘 (Core Rules)

### 🏆 [대원칙 1] 자동 채움(이월)의 개입 경계
1. **최초 로드 / 새로고침 시 (1회성 세팅)**:
   - 당일 세션 데이터가 아직 없는 초기화 단계에서만 필요한 지난 기록(숙제 ➔ 과제확인, 다음TEST ➔ 오늘TEST 등)을 **딱 1회 자동 입력**합니다.
2. **실시간 편집 / 삭제 작업 중 (자동 채움 절대 개입 금지)**:
   - 사용자가 화면에서 작업 중이거나 백스페이스/디리트로 셀을 지울 때는 **어떤 자동 채움/자동 복구 로직도 실시간으로 개입해서는 안 됩니다**.
   - 지우면 즉시 비워진 상태(`""`)로 유지되어 사용자가 새 내용을 쓸 수 있어야 합니다.

### 🏆 [대원칙 2] 셀 삭제 시 4단계 동기화 일체화
`Backspace` / `Delete` 실행 시 아래 4단계가 **실시간으로 즉시 일괄 비워져야** 새로고침 없는 삭제가 보장됩니다:
1. **DOM (`textarea.value = ""`)**
2. **자식 컴포넌트 State (`formData` 내 해당 필드 = `""`)**
3. **부모 컴포넌트 State (`setStudents` 내 `todaySession` 필드 = `""`)**
4. **Supabase DB (`onSave` / `handleBatchSave`)**

---

## 3. 📋 필드(컬럼)별 자동 채움 및 삭제 정책

| 컬럼 ID | 컬럼명 | 시트 최초 로드 / 새로고침 시 | 실시간 백스페이스 삭제 시 | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| `review` | 과제확인 | 지난 수업의 **오늘숙제 (`assign`)** 이월 | **즉시 비워짐 (`""`)** | 이전 기록 재채움 없음 |
| `test_id` | 오늘TEST | 지난 수업의 **다음TEST (`next_quiz`)** 이월 | **즉시 비워짐 (`""`)** | **절대 이전 예약으로 자동 복구하지 않음** |
| `management_notes` | 주의점 | **자동 채움 없음** (빈 상태 시작, 필요시 헤더 `🪄` 버튼으로 수동 이월) | **즉시 비워짐 (`""`)** | 삭제 시 재채움 절대 없음 (`Cmd+Z` 취소 가능) |
| `mission` | 학생미션 | **자동 입력 없음** (빈 상태 시작) | **즉시 비워짐 (`""`)** | 당일 기록 전용 (과거 기록 수혈 금지) |
| `classwork` | 오늘 할 일 | **자동 입력 없음** | **즉시 비워짐 (`""`)** | 독립 동작 |
| `next_quiz` | 다음TEST | **자동 입력 없음** | **즉시 비워짐 (`""`)** | 선생님이 다음 수업 시험을 적는 원천 입력 칸 |

---

## 4. 🛠 핵심 구현 코드 위치 및 복구 가이드 (Code Anchors & Recovery Snippets)

### 1) 멀티셀 백스페이스 삭제 핸들러
- **파일**: [useTodaySheetShortcuts.ts](file:///Users/joonsik_air/documents/makecode/academy-planner/components/dashboard/hooks/useTodaySheetShortcuts.ts)
- **올바른 구현 코드 (복구용)**:
```typescript
targetColIds.forEach(colId => {
  const prop = mapColumnToProp(colId);
  if (colId === 'test_id') {
    nD['test_id'] = '';
    nD['test_status'] = '';
    nD['test_cut'] = 0;
  } else if (colId === 'mission') {
    nD['mission'] = '';
  } else if (colId === 'management_notes') {
    nD['management_notes'] = '';
  } else if (prop) {
    nD[prop] = '';
  }
  chg = true;
});

// 💡 [필수] 부모 setStudents 반영 시 특강/분반 학생(originalId 또는 _special ID)까지 100% 매칭
setStudents((prev: any[]) => prev.map(s => {
  const realId = s.originalId || s.id;
  const update = updates.find(u => 
    String(u.studentId) === String(s.id) || 
    String(u.studentId) === String(realId) ||
    (s.originalId && String(u.studentId).startsWith(String(s.originalId)))
  );
  if (update) {
    return {
      ...s,
      todaySession: { ...(s.todaySession || {}), ...update.newData }
    };
  }
  return s;
}));
```
*(주의: `s.id`로만 찾으면 특강/선택 수업 학생 행(예: 2번째 행)이 스킵되어 삭제가 복원되는 버그가 발생하므로 반드시 `realId` 및 `startsWith` 매칭 포함할 것!)*

---

### 2) 자식 컴포넌트 State 동기화 및 이월 초기화 핸들러
- **파일**: [useTodaySheetRowLogic.ts](file:///Users/joonsik_air/documents/makecode/academy-planner/components/dashboard/hooks/useTodaySheetRowLogic.ts)
- **올바른 구현 코드 (복구용)**:

```typescript
// 1. getInitialFormData 내부: mission은 과거 수혈 금지, management_notes는 최신값 이월
const initialMission = (sessionMission !== undefined && sessionMission !== null)
  ? sessionMission
  : '';

const initialNotes = (sessionNotes !== undefined && sessionNotes !== null && String(sessionNotes).trim() !== '')
  ? sessionNotes
  : getPastMostRecentValue('management_notes');

// 2. useEffect 내부: 부모 student.todaySession 변경 시 isBatchSaving 락 없이 무조건 갱신
const isSessionPropsChanged = prevSessionRef.current !== student.todaySession;
if (isSessionPropsChanged) {
  prevSessionRef.current = student.todaySession;
  const isUserTyping = editingCell?.studentId === student.id || (student.originalId && editingCell?.studentId === student.originalId);

  // 💡 isBatchSaving 락으로 인해 화면 동기화가 차단되지 않도록 !isUserTyping 조건만 사용
  if (!isUserTyping) {
    const newData = getInitialFormData(selectedDate);
    setFormData(newData);
  }
}
```
*(주의: `if (!isUserTyping && !isBatchSaving)` 처럼 `isBatchSaving` 락 조건을 다시 넣으면 Cmd+D, 복사/붙여넣기, 백스페이스 삭제 후 새로고침해야만 화면에 보이는 버그가 재발함!)*

---

## ⚠️ 다음 에이전트 준수 사항 (Agent Mandates)
1. **시간표 및 프로필 데이터 보호 규칙 (`GEMINI.md` 참조)**:
   - `ams_students`의 `class_days`, `day_schedules` 컬럼은 절대로 시간표 저장 로직 등에서 UPDATE하지 않는다.
2. **오늘TEST 및 미션 자동 복구 코드 추가 금지**:
   - "사용자가 실수로 지웠을까 봐 지난 예약을 자동으로 다시 채워 넣는" 로직을 절대로 새로 추가하지 마십시오.
3. **`formData` 동기화 락 추가 금지**:
   - `isBatchSaving` 등을 이유로 부모 ➔ 자식 `formData` 동기화를 차단하지 마십시오. 화면 반응성이 파괴됩니다.
