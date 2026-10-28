export type TextbookSortKey = 'bookcode' | 'title' | 'grade' | 'custom_title' | 'unit_count';
export type SortDirection = 'asc' | 'desc';

/**
 * 💡 학년 정렬 가중치 계산 (초등 -> 중등 -> 고등)
 */
function getGradeWeight(grade?: string): number {
  if (!grade) return 99;
  const g = grade.toLowerCase();
  if (g.includes('초')) return 10;
  if (g.includes('중')) return 20;
  if (g.includes('고') || /공수|미적|대수|확통|기하/.test(g)) return 30;
  return 40;
}

/**
 * 💡 교재 목록 동적 정렬 헬퍼
 */
export function sortTextbooks<T extends { bookcode: string; title: string; grade?: string; custom_title?: string; unit_count?: number }>(
  books: T[],
  key: TextbookSortKey,
  dir: SortDirection
): T[] {
  const multiplier = dir === 'asc' ? 1 : -1;

  return [...books].sort((a, b) => {
    if (key === 'grade') {
      const wA = getGradeWeight(a.grade);
      const wB = getGradeWeight(b.grade);
      if (wA !== wB) return (wA - wB) * multiplier;
      return (a.grade || '').localeCompare(b.grade || '', 'ko') * multiplier;
    }

    if (key === 'unit_count') {
      const uA = a.unit_count || 0;
      const uB = b.unit_count || 0;
      return (uA - uB) * multiplier;
    }

    const valA = String(a[key] || '').trim();
    const valB = String(b[key] || '').trim();
    return valA.localeCompare(valB, 'ko') * multiplier;
  });
}
