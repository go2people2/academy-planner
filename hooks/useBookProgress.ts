import { useState, useEffect, useMemo } from 'react';
import { Student, SessionLog } from '@/types/dashboard';

interface UseBookProgressProps {
  student: Student;
  bookCode: string;
  textbook: any;
  onSaveLegacy?: (studentId: string, bookCode: string, unitName: string) => Promise<boolean>;
}

export function useBookProgress({ student, bookCode, textbook, onSaveLegacy }: UseBookProgressProps) {
  const [units, setUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingLegacy, setIsSavingLegacy] = useState<string | null>(null);
  const [stepStates, setStepStates] = useState<Record<string, boolean[]>>({});

  // 1. LocalStorage에서 체크리스트 로컬 상태 복원
  useEffect(() => {
    const saved = localStorage.getItem(`progress_${student.id}_${bookCode}`);
    if (saved) {
      try {
        setStepStates(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, [student.id, bookCode]);

  // 2. 체크리스트 토글 핸들러
  const toggleStep = (unitName: string, stepIdx: number) => {
    const newState = { ...stepStates };
    const currentSteps = newState[unitName] || [false, false, false, false];
    const updatedSteps = [...currentSteps];
    updatedSteps[stepIdx] = !updatedSteps[stepIdx];
    newState[unitName] = updatedSteps;
    setStepStates(newState);
    localStorage.setItem(`progress_${student.id}_${bookCode}`, JSON.stringify(newState));
  };

  // 3. 마스터 단원 목록 Fetch
  useEffect(() => {
    async function fetchUnits() {
      if (!textbook) return;
      setIsLoading(true);
      try {
        const res = await fetch(`/api/textbooks/${textbook.bookcode}`);
        if (res.ok) {
          const data = await res.json();
          setUnits(data || []);
        }
      } catch (e) {
        console.error('Fetch units error:', e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchUnits();
  }, [textbook]);

  // 4. 단원 수동 완료 처리 핸들러
  const handleFlagClick = async (targetUnitIdx: number) => {
    if (!onSaveLegacy || isSavingLegacy) return;

    const targetUnitName = units[targetUnitIdx].unit;

    if (!confirm(`[${targetUnitName}] 단원을 완료 처리하시겠습니까?\n(기존 기록이 없어도 완료바가 100% 차게 됩니다)`)) return;

    setIsSavingLegacy(targetUnitName);
    const success = await onSaveLegacy(student.id, textbook.bookcode, targetUnitName);
    setIsSavingLegacy(null);

    if (success) {
      alert(`[${targetUnitName}] 단원이 완료 처리되었습니다.`);
    }
  };

  // 5. 세션 로그 텍스트/JSON 분석하여 페이지별 상태 맵 생성
  const bookPageStatus = useMemo(() => {
    const statusMap = new Map<number, 'wrong' | 'classwork' | 'homework'>();
    const actualBookCode = textbook?.bookcode || bookCode;

    student.allLogs.forEach((log: SessionLog) => {
      const processText = (t: string | undefined | null, baseType: 'classwork' | 'homework') => {
        if (!t) return;
        const displayTitle = (textbook?.title || bookCode).replace(/^\[.*?\]\s*/, '');
        const cleanTitle = displayTitle.replace(/\s+/g, '').toLowerCase();
        const cleanBookCode = actualBookCode.replace(/\s+/g, '').toLowerCase();

        t.split('\n').forEach(line => {
          const cleanLine = line.replace(/\s+/g, '').toLowerCase();
          if (cleanLine.includes(cleanTitle) || cleanLine.includes(cleanBookCode)) {
            const isWrong = cleanLine.includes('[오답]');
            const isCancel = cleanLine.includes('[취소]');
            const status = baseType === 'classwork' ? (isWrong ? 'wrong' : 'classwork') : (isCancel ? 'cancel' : 'homework');
            const regex = /p(\d+)[~-]?p?(\d+)?/gi;
            let match;
            while ((match = regex.exec(cleanLine)) !== null) {
              const s = parseInt(match[1]);
              const e = match[2] ? parseInt(match[2]) : s;
              if (!isNaN(s) && !isNaN(e)) {
                for (let i = Math.min(s, e); i <= Math.max(s, e); i++) {
                  const current = statusMap.get(i);
                  if (status === 'cancel') {
                    if (current === 'homework') statusMap.delete(i);
                  } else if (status === 'wrong') {
                    statusMap.set(i, 'wrong');
                  } else if (status === 'classwork' && current !== 'wrong') {
                    statusMap.set(i, 'classwork');
                  } else if (status === 'homework' && !current) {
                    statusMap.set(i, 'homework');
                  }
                }
              }
            }
          }
        });
      };

      processText(log.homework_text, 'homework');
      processText(log.classwork_text, 'classwork');
      processText(log.completed_classwork_text, 'classwork');

      const combinedJson = [...(log.classwork_json || []), ...(log.homework_json || [])];
      combinedJson.forEach((h: any) => {
        if ((h.book_name === bookCode || h.book_name === actualBookCode) && h.range) {
          const type = h.type === 'wrong' ? 'wrong' : (log.classwork_json?.includes(h) ? 'classwork' : 'homework');
          const matches = h.range.match(/p(\d+)\s*[~-]\s*p?(\d+)/i) || h.range.match(/p(\d+)/i);
          if (matches) {
            const s = parseInt(matches[1]);
            const e = matches[2] ? parseInt(matches[2]) : s;
            if (!isNaN(s) && !isNaN(e)) {
              for (let i = Math.min(s, e); i <= Math.max(s, e); i++) {
                const current = statusMap.get(i);
                if (type === 'wrong') statusMap.set(i, 'wrong');
                else if (type === 'classwork' && current !== 'wrong') statusMap.set(i, 'classwork');
                else if (type === 'homework' && !current) statusMap.set(i, 'homework');
              }
            }
          }
        }
      });
    });
    return statusMap;
  }, [student.allLogs, bookCode, textbook]);

  // 6. 1900-01-01 날짜의 완료 기록 단원 취합
  const completedUnitNames = useMemo(() => {
    const names = new Set<string>();
    const actualBookCode = textbook?.bookcode || bookCode;

    student.allLogs.forEach((log: any) => {
      if (log.date === '1900-01-01' || log.session_date === '1900-01-01') {
        const combinedJson = [...(log.classwork_json || []), ...(log.homework_json || [])];
        combinedJson.forEach((h: any) => {
          if ((h.book_name === bookCode || h.book_name === actualBookCode) && h.units) {
            h.units.forEach((u: string) => names.add(u));
          }
        });
      }
    });
    return names;
  }, [student.allLogs, bookCode, textbook]);

  // 7. 누락된 페이지 범위 계산 헬퍼 함수
  const getMissingRanges = (start: number, end: number) => {
    const missing: number[] = [];
    for (let i = start; i <= end; i++) {
      if (!bookPageStatus.has(i)) missing.push(i);
    }
    if (missing.length === 0) return [];

    const ranges: string[] = [];
    if (missing.length > 0) {
      let rStart = missing[0];
      let rEnd = missing[0];
      for (let i = 1; i <= missing.length; i++) {
        if (i < missing.length && missing[i] === rEnd + 1) {
          rEnd = missing[i];
        } else {
          ranges.push(rStart === rEnd ? `${rStart}` : `${rStart}~${rEnd}`);
          if (i < missing.length) {
            rStart = missing[i];
            rEnd = missing[i];
          }
        }
      }
    }
    return ranges;
  };

  const handleSupplement = (unit: string, range: string) => {
    alert(`[${unit}] 단원의 누락된 p.${range} 내용을 보충 기록해야 진도율이 100%가 됩니다.`);
  };

  return {
    units,
    isLoading,
    isSavingLegacy,
    stepStates,
    toggleStep,
    handleFlagClick,
    bookPageStatus,
    completedUnitNames,
    getMissingRanges,
    handleSupplement,
  };
}
