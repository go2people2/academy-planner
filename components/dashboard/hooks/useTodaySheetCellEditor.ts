export interface UseTodaySheetCellEditorOptions {
  snippets?: string[];
  snippetTrigger?: string;
}

export interface ProcessLocalInputResult {
  value: string;
  wasSnippetExpanded: boolean;
}

export interface UseTodaySheetCellEditorReturn {
  processLocalInput: (
    element: HTMLTextAreaElement | HTMLInputElement
  ) => ProcessLocalInputResult;
}

export const useTodaySheetCellEditor = ({
  snippets,
  snippetTrigger,
}: UseTodaySheetCellEditorOptions = {}): UseTodaySheetCellEditorReturn => {
  const processLocalInput = (
    element: HTMLTextAreaElement | HTMLInputElement
  ): ProcessLocalInputResult => {
    let val = element.value;
    let wasSnippetExpanded = false;

    // 💡 단축어 트리거 치환 감지 (textarea 에서만 동작)
    if (
      element instanceof HTMLTextAreaElement &&
      snippets &&
      snippetTrigger &&
      snippetTrigger !== 'none'
    ) {
      const escapedTrigger = snippetTrigger.replace(
        /[-\/\\^$*+?.()|[\]{}]/g,
        '\\$&'
      );

      // 맥북 한글 상태에서 백틱 입력 시 ₩로 입력되는 현상 대응
      let triggerRegexStr = escapedTrigger;
      if (snippetTrigger === '`') {
        triggerRegexStr = '[`₩]';
      }

      const regex = new RegExp(`${triggerRegexStr}([1-9]|10|0)$`);

      // 💡 현재 커서 위치 기준으로 커서 앞 텍스트만 단축어 패턴 매칭 검사 (문장 중간 위치 치환 지원)
      const cursor = element.selectionStart ?? val.length;
      const textBeforeCursor = val.substring(0, cursor);
      const textAfterCursor = val.substring(cursor);

      const match = textBeforeCursor.match(regex);

      if (match) {
        const matchedStr = match[0];
        const numStr = match[1];
        let idx = parseInt(numStr, 10) - 1;
        if (numStr === '0' || numStr === '10') idx = 9;

        const snip = snippets[idx];
        if (snip) {
          const beforeStr = textBeforeCursor.substring(
            0,
            textBeforeCursor.length - matchedStr.length
          );
          const newVal = beforeStr + snip + textAfterCursor;

          val = newVal;
          element.value = newVal;
          wasSnippetExpanded = true;

          const newCursorPos = beforeStr.length + snip.length;
          requestAnimationFrame(() => {
            element.selectionStart = newCursorPos;
            element.selectionEnd = newCursorPos;
          });
        }
      }
    }

    if (element instanceof HTMLTextAreaElement) {
      element.style.height = 'auto';
      element.style.height = `${element.scrollHeight}px`;
    }

    return {
      value: val,
      wasSnippetExpanded,
    };
  };

  return {
    processLocalInput,
  };
};

export default useTodaySheetCellEditor;
