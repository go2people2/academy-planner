import { mapColumnToProp } from './sessionFieldMap';

/**
 * 💡 붙여넣기나 삭제 작업 후 UI(DOM)를 즉시 업데이트합니다.
 * React의 상태 업데이트 지연을 방지하기 위해 직접 textarea/input의 value를 조작합니다.
 */
export const syncTodaySheetDom = (
  updates: { studentId: string; newData: any; prevData?: any }[],
  colIds: string[],
  isClearMode: boolean = false
) => {
  requestAnimationFrame(() => {
    updates.forEach((u) => {
      colIds.forEach((colId) => {
        const prop = mapColumnToProp(colId);
        if (!prop) return;

        // [최적화] 삭제 모드가 아니고 값이 이전과 동일하면 스킵
        if (!isClearMode && u.prevData && String(u.newData[prop] || '') === String(u.prevData[prop] || '')) {
          return;
        }

        // 🔒 [추가] clear 모드일지라도 newData에 해당 프로퍼티가 정의되지 않은 경우(스킵된 필드)는 DOM을 갱신하지 않음
        if (isClearMode && u.newData[prop] === undefined) {
          return;
        }

        const selector = `[data-student-id="${u.studentId}"][data-col-id="${colId}"]`;
        const el = document.querySelector(selector) as HTMLTextAreaElement | HTMLInputElement;
        
        if (el) {
          el.value = isClearMode ? '' : (u.newData[prop] || '');
        }
      });
    });
  });
};
