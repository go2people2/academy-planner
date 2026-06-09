/**
 * 💡 클립보드 텍스트(TSV/CSV)를 2차원 배열 데이터로 파싱합니다.
 */
export const parseClipboardText = (text: string): string[][] => {
  if (!text) return [];

  const dataMatrix: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === '\t' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if (((char === '\r' && nextChar === '\n') || char === '\n') && !inQuotes) {
      currentRow.push(currentCell);
      dataMatrix.push(currentRow);
      currentRow = [];
      currentCell = '';
      if (char === '\r') i++;
    } else {
      currentCell += char;
    }
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell);
    dataMatrix.push(currentRow);
  }

  // 엑셀 등에서 마지막 빈 줄이 생기는 경우 처리
  if (
    dataMatrix.length > 1 &&
    dataMatrix[dataMatrix.length - 1].length === 1 &&
    dataMatrix[dataMatrix.length - 1][0] === ''
  ) {
    dataMatrix.pop();
  }

  return dataMatrix;
};
