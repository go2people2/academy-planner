import { useState, useEffect } from 'react';
import { Student } from '@/types/dashboard';

export interface ActiveTimer {
  id: number;           // timer_started_at 타임스탬프 (고유 ID)
  startTime: number;    // 시작 시간
  duration: number;     // 설정된 시간 (분)
  studentIds: string[]; // 배정된 학생 ID 목록
}

export function useClassroomTimers(
  students: Student[],
  onSave: (id: string, data: any) => Promise<boolean>,
  timerPresets: number[]
) {
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  const [studentTimerMap, setStudentTimerMap] = useState<Record<string, number>>({});
  const [selectedDuration, setSelectedDuration] = useState<number>(15);
  const [customDurationInput, setCustomDurationInput] = useState<string>('');

  // 💡 설정의 타이머 프리셋이 로드되면 기본값을 첫 번째 프리셋으로 초기 세팅
  useEffect(() => {
    if (timerPresets && timerPresets.length > 0) {
      setSelectedDuration(timerPresets[0]);
    }
  }, [timerPresets]);

  // 💡 컴포넌트 마운트 및 students 변경 시 기존 타이머 데이터 복구
  useEffect(() => {
    const groupMap: Record<number, { duration: number; studentIds: string[] }> = {};
    const newMapping: Record<string, number> = {};

    students.forEach((s) => {
      const startTime = s.todaySession?.timer_started_at;
      const duration = s.todaySession?.timer_duration;
      if (startTime && duration) {
        if (!groupMap[startTime]) {
          groupMap[startTime] = { duration, studentIds: [] };
        }
        groupMap[startTime].studentIds.push(s.id);
        newMapping[s.id] = startTime;
      }
    });

    const recovered = Object.entries(groupMap)
      .map(([startTimeStr, info]) => ({
        id: Number(startTimeStr),
        startTime: Number(startTimeStr),
        duration: info.duration,
        studentIds: info.studentIds,
      }))
      .sort((a, b) => a.startTime - b.startTime);

    setActiveTimers(recovered);
    setStudentTimerMap(newMapping);
  }, [students]);

  // 💡 새로운 동적 타이머 생성 (스타트)
  const handleStartTimer = async (selectedIds: string[], onClearSelection: () => void) => {
    if (selectedIds.length === 0) return;

    let duration = selectedDuration;
    if (customDurationInput.trim() !== '') {
      const parsed = parseInt(customDurationInput, 10);
      if (!isNaN(parsed) && parsed > 0) {
        duration = parsed;
      }
    }

    const now = Date.now();

    // 1. 로컬 상태 낙관적 업데이트
    const newTimer: ActiveTimer = {
      id: now,
      startTime: now,
      duration,
      studentIds: [...selectedIds],
    };

    setActiveTimers((prev) => [...prev, newTimer]);
    setStudentTimerMap((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id) => {
        next[id] = now;
      });
      return next;
    });

    // 2. DB 저장
    await Promise.all(
      selectedIds.map((id) =>
        onSave(id, { timer_started_at: now, timer_duration: duration })
      )
    );

    // 3. 컨트롤러 상태 및 선택 목록 초기화
    onClearSelection();
    setCustomDurationInput('');
  };

  // 💡 기존 동적 타이머에 학생 추가 배정
  const handleAssignToTimer = async (timerId: number, selectedIds: string[], onClearSelection: () => void) => {
    if (selectedIds.length === 0) return;

    const timer = activeTimers.find((t) => t.id === timerId);
    if (!timer) return;

    // 1. 로컬 상태 낙관적 업데이트
    setActiveTimers((prev) =>
      prev.map((t) =>
        t.id === timerId
          ? { ...t, studentIds: [...t.studentIds, ...selectedIds] }
          : t
      )
    );
    setStudentTimerMap((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id) => {
        next[id] = timerId;
      });
      return next;
    });

    // 2. DB 저장
    await Promise.all(
      selectedIds.map((id) =>
        onSave(id, {
          timer_started_at: timerId,
          timer_duration: timer.duration,
        })
      )
    );

    // 3. 선택 목록 초기화
    onClearSelection();
  };

  // 💡 특정 동적 타이머 중지 및 해당 학생들의 타이머 세션 제거
  const handleStopTimer = async (timerId: number) => {
    const timer = activeTimers.find((t) => t.id === timerId);
    if (!timer) return;

    const studentsToClear = timer.studentIds;

    // 1. 로컬 상태 낙관적 업데이트
    setActiveTimers((prev) => prev.filter((t) => t.id !== timerId));
    setStudentTimerMap((prev) => {
      const next = { ...prev };
      studentsToClear.forEach((id) => {
        delete next[id];
      });
      return next;
    });

    // 2. DB 저장
    await Promise.all(
      studentsToClear.map((id) =>
        onSave(id, { timer_started_at: null, timer_duration: null })
      )
    );
  };

  return {
    activeTimers,
    studentTimerMap,
    selectedDuration,
    setSelectedDuration,
    customDurationInput,
    setCustomDurationInput,
    handleStartTimer,
    handleAssignToTimer,
    handleStopTimer,
  };
}
