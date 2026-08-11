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
      const match = val.match(regex);

      if (match) {
        const matchedStr = match[0];
        const numStr = match[1];
        let idx = parseInt(numStr, 10) - 1;
        if (numStr === '0' || numStr === '10') idx = 9;

        const snip = snippets[idx];
        if (snip) {
          const startPos = element.selectionStart - matchedStr.length;
          const endPos = element.selectionStart;
          const before = val.substring(0, startPos);
          const after = val.substring(endPos);
          const newVal = before + snip + after;

          val = newVal;
          element.value = newVal;
          wasSnippetExpanded = true;

          const newCursorPos = startPos + snip.length;
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
