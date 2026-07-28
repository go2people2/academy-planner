'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Users, Save, RefreshCcw, Loader2, AlertCircle, Sparkles, UserPlus, Printer, Download, FileImage } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

interface TimetableSettingsProps {
  academyInfo: any;
  teachers: any[];
  students: any[];
  isLight?: boolean;
}

interface TimetableCell {
  day_of_week: string;
  time_slot: string;
  row_index: number;
  student_id: string | null;
  bg_color: string; // 'default', 'green', 'yellow', 'orange', 'blue'
}

// 💡 숫자로 저장된 등원/하원 시각(예: 1600, '16:00' 등 다양한 포맷)을 시간표의 교시 슬롯들로 변환
const convertTimeToSlots = (startVal: any, endVal: any): string[] => {
  const slots: string[] = [];

  const parseHour = (val: any) => {
    if (val === undefined || val === null || val === '') return null;
    const str = String(val).replace(':', '').trim();
    const num = parseInt(str);
    if (isNaN(num)) return null;
    if (str.length >= 3) return Math.floor(num / 100);
    return num;
  };

  const startHour = parseHour(startVal);
  // 시작 시간이 파싱되지 않으면 기본 16시로 처리
  const sH_raw = startHour !== null ? startHour : 16;
  const getNormalizedHour = (h: number) => h <= 12 ? h + 12 : h;
  const sH = getNormalizedHour(sH_raw);

  // 하원 시간 파싱 (없으면 시작 시간 + 2시간 뒤로 보정)
  const endHour = parseHour(endVal);
  const eH_raw = endHour !== null ? endHour : (sH_raw + 2);
  const eH = getNormalizedHour(eH_raw);

  const slotsMap = [
    { start: 13, end: 14, name: '1~2' },
    { start: 14, end: 15, name: '2~3' },
    { start: 15, end: 16, name: '3~4' },
    { start: 16, end: 17, name: '4~5' },
    { start: 17, end: 18, name: '5~6' },
    { start: 18, end: 19, name: '6~7' },
    { start: 19, end: 20, name: '7~8' },
    { start: 20, end: 21, name: '8~9' },
    { start: 21, end: 22, name: '9~10' },
    { start: 22, end: 23, name: '10~11' },
    { start: 23, end: 24, name: '11~12' },
  ];

  slotsMap.forEach(item => {
    // 시작 및 종료 시간 범위 내에 슬롯이 걸쳐져 있으면 수집
    if (sH <= item.start && eH >= item.end) {
      slots.push(item.name);
    }
  });

  // 💡 13시(1시) 시작 특강 수강 시 15시(3시)/16시(4시) 하원 지정에 맞춰 1~2, 2~3, 3~4 3개 슬롯이 모두 확보되도록 유연 보정
  if (sH === 13 && (eH === 15 || eH === 16 || eH === 1530)) {
    if (!slots.includes('3~4')) slots.push('3~4');
  }

  // 💡 [초강력 방어막] 범위 파싱 어긋남으로 인해 단 하나의 슬롯도 확보하지 못한 경우, 등원 시작 시각(sH)을 기준으로 1교시를 강제 배치
  if (slots.length === 0) {
    if (sH === 13) slots.push('1~2');
    else if (sH === 14) slots.push('2~3');
    else if (sH === 15) slots.push('3~4');
    else if (sH === 16) slots.push('4~5');
    else if (sH === 17) slots.push('5~6');
    else if (sH === 18) slots.push('6~7');
    else if (sH === 19) slots.push('7~8');
    else if (sH === 20) slots.push('8~9');
    else if (sH === 21) slots.push('9~10');
    else if (sH === 22) slots.push('10~11');
    else if (sH === 23) slots.push('11~12');
  }

  return slots;
};

const DAYS = ['월', '화', '수', '목', '금'];
const ALL_SLOTS = ['1~2', '2~3', '3~4', '4~5', '5~6', '6~7', '7~8', '8~9', '9~10', '10~11', '11~12'];
const ROW_COUNT = 40;

// 🔧 자동 배치 그리드 생성: slots 매개변수 추가 (방학 모드 지원)
const buildAutoGrid = (targetStudents: any[], activeSlots: string[]): Record<string, { day_of_week: string; time_slot: string; row_index: number; student_id: string | null; bg_color: string }> => {
  const newGrid: Record<string, any> = {};

  DAYS.forEach(day => {
    const studentsOnDay: { studentId: string; name: string; slots: string[]; startSlotIdx: number; isSpecial: boolean }[] = [];

    targetStudents.forEach(student => {
      // 1. 정규 수업 스케줄 수집 (독립 항목)
      let regSched = student.day_schedules || {};
      const classDays = student.class_days || [];

      const isRegularClassDay = classDays.some((d: string) => d === day || d === `${day}요일` || d.startsWith(day));
      const rawRegVal = regSched[day] || regSched[`${day}요일`] || null;
      let regSlots: string[] = [];

      if (rawRegVal || isRegularClassDay) {
        if (Array.isArray(rawRegVal) && rawRegVal.length > 0) {
          if (typeof rawRegVal[0] === 'number') {
            regSlots = convertTimeToSlots(rawRegVal[0], rawRegVal[1] || rawRegVal[0]);
          } else {
            regSlots = rawRegVal.map(String).filter((s: string) => activeSlots.includes(s));
          }
        } else if (isRegularClassDay) {
          // 정규 수업 기본 시간대 (4~5, 5~6)
          regSlots = ['4~5', '5~6'].filter((s: string) => activeSlots.includes(s));
        }
      }

      if (regSlots.length > 0) {
        regSlots.sort((a, b) => ALL_SLOTS.indexOf(a) - ALL_SLOTS.indexOf(b));
        const startSlotIdx = activeSlots.indexOf(regSlots[0]);
        studentsOnDay.push({
          studentId: student.id,
          name: student.name || '',
          slots: regSlots,
          startSlotIdx: startSlotIdx === -1 ? 99 : startSlotIdx,
          isSpecial: false
        });
      }

      // 2. 방학 특강(선택과목) 스케줄 수집 (독립 항목으로 완전 분리)
      const rawElective = student.book_courses?.['__elective_courses'] ?? student.book_courses?.["'__elective_courses'"];
      if (rawElective) {
        try {
          const courses = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
          if (Array.isArray(courses)) {
            courses.forEach((c: any) => {
              if (!c) return;
              const days = c.days || c.class_days || [];
              const isTargetDay = days.some((d: string) => d === day || d === `${day}요일` || d.startsWith(day));
              if (isTargetDay) {
                let eSlots: string[] = [];
                const schedArr = (c.schedules && (c.schedules[day] || c.schedules[`${day}요일`])) ? (c.schedules[day] || c.schedules[`${day}요일`]) : null;

                if (Array.isArray(schedArr) && schedArr.length > 0) {
                  eSlots = convertTimeToSlots(schedArr[0], schedArr[1] || schedArr[0]);
                } else if (c.startTime && c.endTime) {
                  eSlots = convertTimeToSlots(c.startTime, c.endTime);
                } else if (c.slots && Array.isArray(c.slots)) {
                  eSlots = c.slots.map(String);
                } else {
                  // 특강 기본 시간대 보정 (1시~4시 -> 1~2, 2~3, 3~4)
                  eSlots = ['1~2', '2~3', '3~4'];
                }

                // 💡 1시(13시) 시작 특강의 경우 3~4교시(3시~4시) 누락 방지 보정
                const sStr = String((Array.isArray(schedArr) && schedArr.length > 0) ? schedArr[0] : (c.startTime || '')).replace(':', '');
                if (sStr === '13' || sStr === '1' || sStr === '1300' || sStr === '0100') {
                  if (!eSlots.includes('3~4')) eSlots.push('3~4');
                }

                const validESlots = eSlots.filter(s => activeSlots.includes(s));
                if (validESlots.length > 0) {
                  validESlots.sort((a, b) => ALL_SLOTS.indexOf(a) - ALL_SLOTS.indexOf(b));
                  const startSlotIdx = activeSlots.indexOf(validESlots[0]);
                  studentsOnDay.push({
                    studentId: student.id,
                    name: student.name || '',
                    slots: validESlots,
                    startSlotIdx: startSlotIdx === -1 ? 99 : startSlotIdx,
                    isSpecial: true
                  });
                }
              }
            });
          }
        } catch (e) {
          console.error('Failed to parse elective courses in timetable', e);
        }
      }
    });

    // 💡 학생들을 등원 시작 시간에 따라 분류
    // 1. 1시 방학 특강생 (1~2, 2~3, 3~4 시작)
    const vacationGroup = studentsOnDay.filter(s => s.slots.length > 0 && ['1~2', '2~3', '3~4'].includes(s.slots[0]));
    // 2. 4시/5시/6시 오후 그룹 (4~5, 5~6, 6~7 시작 정규 및 특강생)
    const normalGroup = studentsOnDay.filter(s => s.slots.length > 0 && ['4~5', '5~6', '6~7'].includes(s.slots[0]));
    // 3. 7시 야간 그룹 (7~8, 8~9, 9~10 시작 정규 및 특강생)
    const nightGroup = studentsOnDay.filter(s => s.slots.length > 0 && ['7~8', '8~9', '9~10'].includes(s.slots[0]));

    // 각 그룹별 정렬 (시작 교시 순 -> 가나다 순)
    vacationGroup.sort((a, b) => a.startSlotIdx !== b.startSlotIdx ? a.startSlotIdx - b.startSlotIdx : a.name.localeCompare(b.name, 'ko'));
    normalGroup.sort((a, b) => a.startSlotIdx !== b.startSlotIdx ? a.startSlotIdx - b.startSlotIdx : a.name.localeCompare(b.name, 'ko'));
    nightGroup.sort((a, b) => a.startSlotIdx !== b.startSlotIdx ? a.startSlotIdx - b.startSlotIdx : a.name.localeCompare(b.name, 'ko'));

    // [Step 1] 상단 영역 (1시 방학 특강생 + 4/5/6시 등원생을 1행부터 가로 병렬 결합 배치)
    const upperMaxCount = Math.max(vacationGroup.length, normalGroup.length);
    let upperRowsUsed = 0;

    for (let i = 0; i < upperMaxCount; i++) {
      const targetRow = 1 + i;
      if (targetRow > ROW_COUNT) break;

      const vacStudent = vacationGroup[i];
      const normStudent = normalGroup[i];

      // 1-1. 1시 방학 특강생 배치 (1행부터 차례대로 1~2, 2~3, 3~4 영역에 채움)
      if (vacStudent) {
        vacStudent.slots.forEach((s, sIdx) => {
          if (!activeSlots.includes(s)) return;
          const cellKey = `${day}-${s}-${targetRow}`;
          newGrid[cellKey] = {
            day_of_week: day,
            time_slot: s,
            row_index: targetRow,
            student_id: vacStudent.studentId,
            bg_color: sIdx === 0 ? 'cyan' : 'default'
          };
        });
      }

      // 1-2. 4/5/6시 등원 정규/특강생 배치 (1행부터 차례대로 4~5, 5~6, 6~7 영역에 채움)
      if (normStudent) {
        normStudent.slots.forEach((s, sIdx) => {
          if (!activeSlots.includes(s)) return;
          const cellKey = `${day}-${s}-${targetRow}`;
          newGrid[cellKey] = {
            day_of_week: day,
            time_slot: s,
            row_index: targetRow,
            student_id: normStudent.studentId,
            bg_color: sIdx === 0 
              ? (normStudent.isSpecial ? 'cyan' : (s.startsWith('4') ? 'green' : s.startsWith('5') ? 'orange' : s.startsWith('6') ? 'yellow' : 'blue')) 
              : 'default'
          };
        });
      }

      upperRowsUsed++;
    }

    // [Step 2] 하부 영역 (7시 야간 그룹) 시작 지점 설정 (상단 배치 행수 다음 + 2행 여유, 최소 7행 이상 유지)
    const lowerStartRow = Math.max(upperRowsUsed + 2, 7);

    // [Step 3] 7시 야간 그룹 정규/특강생 배치 (하부 영역 1행부터 차례대로 누적)
    nightGroup.forEach((nightStudent, i) => {
      const targetRow = lowerStartRow + i;
      if (targetRow > ROW_COUNT) return;

      nightStudent.slots.forEach((s, sIdx) => {
        if (!activeSlots.includes(s)) return;
        const cellKey = `${day}-${s}-${targetRow}`;
        newGrid[cellKey] = {
          day_of_week: day,
          time_slot: s,
          row_index: targetRow,
          student_id: nightStudent.studentId,
          bg_color: sIdx === 0 ? (nightStudent.isSpecial ? 'cyan' : 'blue') : 'default'
        };
      });
    });
  });

  return newGrid;
};

// 🎨 색상 테마 매핑 테이블 (다크/라이트 지원)
const COLOR_CLASSES: Record<string, { dark: string; light: string; label: string }> = {
  default: { dark: 'bg-zinc-900/50 border border-zinc-800/40 text-zinc-300', light: 'bg-[#fafafa] text-gray-800', label: '기본색' },
  green: { dark: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black', light: 'bg-[#D9EAD3] text-gray-800 font-extrabold', label: '초록색' },
  yellow: { dark: 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-black', light: 'bg-amber-50 text-gray-800 font-extrabold', label: '노란색' },
  orange: { dark: 'bg-orange-500/10 border border-orange-500/20 text-orange-400 font-black', light: 'bg-orange-200 text-orange-950 font-extrabold', label: '주황색' },
  blue: { dark: 'bg-sky-500/10 border border-sky-500/20 text-sky-400 font-black', light: 'bg-blue-100 border border-blue-200/60 text-blue-900 font-extrabold', label: '파란색' },
  cyan: { dark: 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-black', light: 'bg-[#4CD5FF] text-gray-900 font-extrabold', label: '하늘색(특강)' }
};

export default function TimetableSettings({ academyInfo, teachers = [], students = [], isLight = false }: TimetableSettingsProps) {
  // 1. 상태 관리
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [gridData, setGridData] = useState<Record<string, TimetableCell>>({}); // 키: "요일-교시-행번호"
  const [localStudents, setLocalStudents] = useState<any[]>(students);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVacationMode, setIsVacationMode] = useState(false);

  // 💡 선택된 선생님 학생들의 실제 수업시간에 맞춰 10~11, 11~12교시 슬롯을 유연하게 감지 및 노출
  const activeSlots = useMemo(() => {
    let base = ['4~5', '5~6', '6~7', '7~8', '8~9', '9~10'];
    if (isVacationMode) {
      base = ['1~2', '2~3', '3~4', '4~5', '5~6', '6~7', '7~8', '8~9', '9~10'];
    }

    // 그리드 데이터나 학생 스케줄 상에 10~11, 11~12 슬롯 사용 여부 확인
    const has10to11 = Object.keys(gridData).some(k => k.includes('-10~11-') && gridData[k]?.student_id);
    const has11to12 = Object.keys(gridData).some(k => k.includes('-11~12-') && gridData[k]?.student_id);

    // 학생들 원본 시간표 스케줄 체크
    const teacherStudents = localStudents.filter(s => !s.is_deleted && s.teacher_id === selectedTeacherId);
    let schedHas10to11 = false;
    let schedHas11to12 = false;

    teacherStudents.forEach(s => {
      const sched = s.day_schedules || {};
      Object.keys(sched).forEach(day => {
        const val = sched[day];
        if (Array.isArray(val) && val.length > 0) {
          const startVal = typeof val[0] === 'number' ? val[0] : parseInt(String(val[0]).replace(':', ''));
          const endVal = typeof val[1] === 'number' ? val[1] : (val[1] ? parseInt(String(val[1]).replace(':', '')) : startVal + 200);
          if (startVal >= 2200 || endVal > 2200) schedHas10to11 = true;
          if (startVal >= 2300 || endVal > 2300) schedHas11to12 = true;
        }
      });
    });

    if (has10to11 || schedHas10to11 || has11to12 || schedHas11to12) {
      base.push('10~11');
    }
    if (has11to12 || schedHas11to12) {
      base.push('11~12');
    }

    return base;
  }, [isVacationMode, gridData, localStudents, selectedTeacherId]);
  // 인라인 편집 상태 { key: "요일-교시-행번호" }
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // 커스텀 컨텍스트 메뉴 상태 (우클릭 색상 지정을 위해)
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    key: string;
  } | null>(null);

  // 2. 해당 학원의 활성 교사 목록 (대표교사, 일반교사 포함)
  const activeTeachers = useMemo(() => {
    return teachers.filter(t => !t.is_deleted && t.role !== 'master');
  }, [teachers]);

  // 기본 교사 자동 지정
  useEffect(() => {
    if (activeTeachers.length > 0 && !selectedTeacherId) {
      // 윤여태 선생님이 있으면 우선 지정, 없으면 첫 번째 교사
      const target = activeTeachers.find(t => t.name?.includes('윤여태')) || activeTeachers[0];
      setSelectedTeacherId(target.id);
    }
  }, [activeTeachers, selectedTeacherId]);

  // 💡 2-2. DB 또는 학생 데이터에 방학 특강(1시~4시 타임) 배정이 존재하면 자동으로 방학 모드 활성화
  useEffect(() => {
    let hasVacationData = Object.keys(gridData).some(key => {
      const [, slot] = key.split('-');
      return ['1~2', '2~3', '3~4'].includes(slot) && gridData[key]?.student_id !== null;
    });

    if (!hasVacationData && localStudents.length > 0) {
      hasVacationData = localStudents.some(s => {
        if (s.is_deleted) return false;
        const rawElective = s.book_courses?.['__elective_courses'] ?? s.book_courses?.["'__elective_courses'"];
        if (!rawElective) return false;
        try {
          const courses = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
          return Array.isArray(courses) && courses.length > 0;
        } catch (e) {
          return false;
        }
      });
    }

    if (hasVacationData) {
      setIsVacationMode(true);
    }
  }, [gridData, localStudents]);

  // 💡 동적 행 개수 결정: 데이터가 있는 가장 큰 row_index를 구해서 맞춰 자름 (최소 15행)
  const dynamicRowCount = useMemo(() => {
    let maxRow = 15;
    Object.keys(gridData).forEach(key => {
      const cell = gridData[key];
      if (cell && (cell.student_id || cell.bg_color !== 'default')) {
        if (cell.row_index > maxRow) {
          maxRow = cell.row_index;
        }
      }
    });
    return Math.min(maxRow, ROW_COUNT); // ROW_COUNT(40) 한도 내에서 동적으로 조절
  }, [gridData]);

  // 💡 요일별로 7시 타임(뒷 시간대 파트)이 시작하는 실제 row_index를 계산하는 함수 (요일마다 다름)
  const lowerStartRows = useMemo(() => {
    const rows: Record<string, number> = {};
    DAYS.forEach(day => {
      let minRow = 999;
      
      // 💡 [정교화] 각 행(1~ROW_COUNT)을 돌며 이 행의 학생이 등원을 개시하는 '첫 번째 시간 슬롯'을 찾습니다.
      for (let r = 1; r <= ROW_COUNT; r++) {
        let firstActiveSlot: string | null = null;
        for (const slot of activeSlots) {
          const key = `${day}-${slot}-${r}`;
          const cell = gridData[key];
          if (cell && cell.student_id) {
            firstActiveSlot = slot;
            break; // 첫 등원 슬롯 발견 즉시 루프 탈출
          }
        }
        
        // 이 행의 최초 등원 개시 시간대가 7시 이후('7~8', '8~9', '9~10', '10~11', '11~12')인 경우만 진짜 야간반 행으로 인정!
        if (firstActiveSlot && ['7~8', '8~9', '9~10', '10~11', '11~12'].includes(firstActiveSlot)) {
          if (r < minRow) {
            minRow = r;
          }
        }
      }
      
      // 만약 7시 타임 학생을 찾지 못했다면, 이 요일의 전체 배치 학생 중 가장 큰 row_index + 2로 지정
      if (minRow === 999) {
        let maxRow = 0;
        Object.keys(gridData).forEach(key => {
          const [d, , rowStr] = key.split('-');
          if (d === day) {
            const cell = gridData[key];
            if (cell && cell.student_id) {
              const r = parseInt(rowStr);
              if (r > maxRow) maxRow = r;
            }
          }
        });
        minRow = maxRow > 0 ? maxRow + 2 : 17;
      }
      rows[day] = minRow;
    });
    return rows;
  }, [gridData, activeSlots]);

  // 💡 요일별/행별 정확한 학생 순번(번호) 매핑 연산
  // - 상단 5타임 그룹: 학생이 배치된 행 순서대로 1, 2, 3...
  // - 하단 7타임 그룹: 7시 타임 시작 행부터 첫 학생부터 다시 1, 2, 3...
  const studentDisplayNumbers = useMemo(() => {
    const numbers: Record<string, string> = {}; // 키: "day-rowNum"

    DAYS.forEach(day => {
      const lowerStartRow = lowerStartRows[day] || 99;
      let upperCount = 0;
      let lowerCount = 0;

      for (let r = 1; r <= ROW_COUNT; r++) {
        // 해당 요일의 이 행에 학생이 배치되어 있는지 확인
        const hasStudent = activeSlots.some(slot => {
          const cellKey = `${day}-${slot}-${r}`;
          return gridData[cellKey]?.student_id;
        });

        if (hasStudent) {
          if (r < lowerStartRow) {
            upperCount++;
            numbers[`${day}-${r}`] = String(upperCount);
          } else {
            lowerCount++;
            numbers[`${day}-${r}`] = String(lowerCount);
          }
        } else {
          numbers[`${day}-${r}`] = '';
        }
      }
    });

    return numbers;
  }, [gridData, lowerStartRows, activeSlots]);

  // 3. 시간표 데이터 불러오기
  const fetchTimetable = async () => {
    if (!academyInfo?.id || !selectedTeacherId) return;
    setIsLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;
      if (!token) return;

      // 💡 Supabase에서 최신 학생 목록을 직접 불러옵니다.
      const { data: latestStudents, error: fetchErr } = await supabase
        .from('ams_students')
        .select('*')
        .eq('academy_id', academyInfo.id)
        .eq('is_deleted', false);

      let currentStudents = localStudents;
      if (!fetchErr && latestStudents) {
        setLocalStudents(latestStudents);
        currentStudents = latestStudents;
      }

      const res = await fetch(`/api/timetables?academyId=${academyInfo.id}&teacherId=${selectedTeacherId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        const mapped: Record<string, TimetableCell> = {};
        
        const dbTimetables = data.timetables || [];
        if (dbTimetables.length > 0) {
          dbTimetables.forEach((t: any) => {
            const key = `${t.day_of_week}-${t.time_slot}-${t.row_index}`;
            mapped[key] = {
              day_of_week: t.day_of_week,
              time_slot: t.time_slot,
              row_index: t.row_index,
              student_id: t.student_id,
              bg_color: t.bg_color || 'default'
            };
          });
          setGridData(mapped);
        } else {
          // DB에 시간표 없을 때 학생 스케줄 기반 자동 초안 생성 (시간대 순 → 가나다 순)
          const teacherStudents = currentStudents.filter((s: any) => !s.is_deleted && s.teacher_id === selectedTeacherId);
          
          // 💡 로드 시점에 방학 타임(1~3시) 학생 존재 여부 감지
          const hasVacationStudent = teacherStudents.some((student: any) => {
            const sched = student.day_schedules || {};
            return Object.keys(sched).some(day => {
              const rawVal = sched[day] || sched[`${day}요일`] || null;
              if (!rawVal) return false;
              let slots: string[] = [];
              if (Array.isArray(rawVal)) {
                if (rawVal.length > 0 && typeof rawVal[0] === 'number') {
                  slots = convertTimeToSlots(rawVal[0], rawVal[1] || rawVal[0]);
                } else {
                  slots = rawVal.map(String).filter((s: string) => ALL_SLOTS.includes(s));
                }
              }
              return slots.some(s => ['1~2', '2~3', '3~4'].includes(s));
            });
          });

          const targetSlots = hasVacationStudent 
            ? ['1~2', '2~3', '3~4', '4~5', '5~6', '6~7', '7~8', '8~9', '9~10']
            : activeSlots;

          if (hasVacationStudent) {
            setIsVacationMode(true);
          }

          setGridData(buildAutoGrid(teacherStudents, targetSlots));
        }
      }
    } catch (e) {
      console.error('Failed to load timetables:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
    setEditingKey(null);
    setContextMenu(null);
  }, [selectedTeacherId, academyInfo?.id]);

  // 4. 선택된 선생님 담당 학생 목록 필터링 (정규반 담임 교사 또는 특강 과목 교사가 일치하는 모든 원생 수집)
  const teacherStudents = useMemo(() => {
    return localStudents.filter(s => {
      if (s.is_deleted) return false;
      if (s.teacher_id === selectedTeacherId) return true;

      const rawElective = s.book_courses?.['__elective_courses'] ?? s.book_courses?.["'__elective_courses'"];
      if (rawElective) {
        try {
          const courses = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
          if (Array.isArray(courses)) {
            return courses.some((c: any) => c && (c.teacher_id === selectedTeacherId || (!c.teacher_id && s.teacher_id === selectedTeacherId)));
          }
        } catch (e) {}
      }
      return false;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [localStudents, selectedTeacherId]);

  // 💡 중복 제거용 셀 공통 렌더링 헬퍼 함수
  const renderCell = (day: string, slot: string, rowNum: number) => {
    const cellKey = `${day}-${slot}-${rowNum}`;
    const cell = gridData[cellKey];
    const isEditing = editingKey === cellKey;
    const studentId = cell?.student_id || null;
    const bgColor = cell?.bg_color || 'default';
    
    const assignedStudent = localStudents.find(s => s.id === studentId);
    
    // 🔒 [추가] 학생이 배정되어 있고 수동 색상 지정이 없을 때(default) 또는 기존 일괄 연두색(green)인 경우, 등원 시작 세션(첫 교시)인 경우에만 타임별 색상 자동 매칭
    let displayBgColor = bgColor;
    if (assignedStudent && (bgColor === 'default' || bgColor === 'green' || bgColor === 'blue' || bgColor === 'orange' || bgColor === 'yellow')) {
      const currentSlotIdx = activeSlots.indexOf(slot);
      let isFirstSession = true;

      // 💡 현재 교시 이전의 시간대(동일 요일, 동일 행)에 동일한 학생이 배정되어 있는지 스캔
      for (let i = 0; i < currentSlotIdx; i++) {
        const prevSlot = activeSlots[i];
        const prevCellKey = `${day}-${prevSlot}-${rowNum}`;
        if (gridData[prevCellKey]?.student_id === studentId) {
          isFirstSession = false;
          break;
        }
      }

      let isElectiveSession = false;
      const rawElective = assignedStudent?.book_courses?.['__elective_courses'] ?? assignedStudent?.book_courses?.["'__elective_courses'"];
      if (rawElective) {
        try {
          const courses = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
          if (Array.isArray(courses)) {
            isElectiveSession = courses.some((c: any) => {
              if (!c) return false;
              const days = c.days || c.class_days || [];
              const isDayMatch = days.some((d: string) => d === day || d === `${day}요일` || d.startsWith(day));
              if (!isDayMatch) return false;

              const schedArr = (c.schedules && (c.schedules[day] || c.schedules[`${day}요일`])) ? (c.schedules[day] || c.schedules[`${day}요일`]) : null;
              let eSlots: string[] = [];
              if (Array.isArray(schedArr) && schedArr.length > 0) {
                eSlots = convertTimeToSlots(schedArr[0], schedArr[1] || schedArr[0]);
              } else if (c.startTime && c.endTime) {
                eSlots = convertTimeToSlots(c.startTime, c.endTime);
              } else {
                eSlots = ['1~2', '2~3', '3~4'];
              }
              return eSlots.includes(slot);
            });
          }
        } catch (e) {}
      }

      if (isFirstSession) {
        if (isElectiveSession || slot.startsWith('1') || slot.startsWith('2') || slot.startsWith('3')) displayBgColor = 'cyan'; // 특강 교시: 스카이블루(하늘색)
        else if (slot.startsWith('4')) displayBgColor = 'green';        // 4시 타임 정규: 초록색(연두색)
        else if (slot.startsWith('5')) displayBgColor = 'orange';       // 5시 타임 정규: 주황색(호박색)
        else if (slot.startsWith('6')) displayBgColor = 'yellow';   // 6시 타임 정규: 노란색
        else if (slot.startsWith('7')) displayBgColor = 'blue';     // 7시 타임 정규: 파란색
      } else {
        // 첫 교시가 아님에도 green이나 다른 색이 칠해져 있다면 연장 수업이므로 기본색으로 강제 회귀
        displayBgColor = 'default';
      }
    }

    const themeColor = COLOR_CLASSES[displayBgColor] || COLOR_CLASSES.default;
    const colorClass = isLight ? themeColor.light : themeColor.dark;

    return (
      <td
        key={cellKey}
        onDoubleClick={() => handleCellDoubleClick(cellKey)}
        onContextMenu={(e) => handleCellContextMenu(e, cellKey)}
        className={`p-0 border-r border-b transition-all relative font-medium group/cell cell-color-${bgColor} ${
          isLight ? 'border-gray-300' : 'border-zinc-800/70'
        } ${colorClass}`}
        title="더블클릭: 배정 | 우클릭: 배경색"
      >
        {isEditing ? (
          <select
            value={studentId || 'empty'}
            onChange={(e) => handleSelectStudent(cellKey, day, slot, rowNum, e.target.value)}
            onBlur={() => setEditingKey(null)}
            autoFocus
            className={`w-full py-0 h-[20px] text-[10px] font-bold outline-none rounded-[2px] border ${
              isLight 
                ? 'bg-white border-blue-500 text-gray-800' 
                : 'bg-[#121212] border-blue-500/70 text-white'
            }`}
          >
            <option value="empty">- 비어있음 -</option>
            {teacherStudents.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.school || '학교미지정'})</option>
            ))}
          </select>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center min-h-[20px] py-0 px-0.5 select-none cursor-pointer">
            {assignedStudent ? (
              <div className="w-full flex flex-col items-center leading-none overflow-hidden">
                <span className="font-extrabold text-[10px] whitespace-normal break-all w-full text-center block leading-[1.1]">
                  {assignedStudent.name}
                </span>
              </div>
            ) : (
              <span className="opacity-0 group-hover/cell:opacity-30 transition-opacity text-[8px] font-bold text-gray-500 uppercase">
                +
              </span>
            )}
          </div>
        )}
      </td>
    );
  };
  // 5. 셀 더블클릭 시 편집 전환
  const handleCellDoubleClick = (key: string) => {
    setEditingKey(key);
    setContextMenu(null);
  };

  // 6. 셀 내부 학생 정보 변경 반영
  const handleSelectStudent = (key: string, day: string, slot: string, rowIdx: number, studentId: string) => {
    const prevCell = gridData[key];
    const updatedCell: TimetableCell = {
      day_of_week: day,
      time_slot: slot,
      row_index: rowIdx,
      student_id: studentId === 'empty' ? null : studentId,
      bg_color: prevCell?.bg_color || 'default'
    };

    setGridData(prev => ({ ...prev, [key]: updatedCell }));
    setEditingKey(null);
  };

  // 7. 셀 우클릭 컨텍스트 메뉴 활성화 (색상 설정용)
  const handleCellContextMenu = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      key
    });
  };

  // 8. 셀 배경색 변경 적용
  const handleColorChange = (key: string, color: string) => {
    const prevCell = gridData[key];
    if (prevCell) {
      setGridData(prev => ({
        ...prev,
        [key]: { ...prevCell, bg_color: color }
      }));
    } else {
      // 빈 셀에 색상 먼저 지정할 경우
      const [day, slot, rowStr] = key.split('-');
      setGridData(prev => ({
        ...prev,
        [key]: {
          day_of_week: day,
          time_slot: slot,
          row_index: parseInt(rowStr),
          student_id: null,
          bg_color: color
        }
      }));
    }
    setContextMenu(null);
  };



  // 💡 [추가] 기존 학생들의 요일 정보를 기반으로 시간표 자동 초안 생성 (방학 타임 자동 대응)
  const handleAutoPopulate = () => {
    if (!selectedTeacherId) return;
    if (!confirm('기존 학생들의 등원 요약 정보(class_days)를 기반으로 시간표 초안을 자동으로 배치하시겠습니까?\n(이미 임시 작성 중이던 내용은 덮어씌워집니다)')) return;

    const teacherStudents = localStudents.filter(s => !s.is_deleted && s.teacher_id === selectedTeacherId);

    // 💡 학생들 중 1~3시 타임(방학 타임) 등원이 1명이라도 존재하면 자동으로 방학 모드 선감지
    const hasVacationStudent = teacherStudents.some(student => {
      const sched = student.day_schedules || {};
      return Object.keys(sched).some(day => {
        const rawVal = sched[day] || sched[`${day}요일`] || null;
        if (!rawVal) return false;
        let slots: string[] = [];
        if (Array.isArray(rawVal)) {
          if (rawVal.length > 0 && typeof rawVal[0] === 'number') {
            slots = convertTimeToSlots(rawVal[0], rawVal[1] || rawVal[0]);
          } else {
            slots = rawVal.map(String).filter((s: string) => ALL_SLOTS.includes(s));
          }
        }
        return slots.some(s => ['1~2', '2~3', '3~4'].includes(s));
      });
    });

    const targetSlots = hasVacationStudent 
      ? ['1~2', '2~3', '3~4', '4~5', '5~6', '6~7', '7~8', '8~9', '9~10']
      : activeSlots;

    if (hasVacationStudent) {
      setIsVacationMode(true);
    }

    setGridData(buildAutoGrid(teacherStudents, targetSlots));
    alert('기존 요일 정보를 기반으로 임시 시간표가 자동 배치되었습니다.\n배치를 보정하신 후 반드시 상단의 [시간표 저장]을 눌러주셔야 반영됩니다.');
  };

  // 10. 시간표 전체 데이터 일괄 저장 (API 호출)
  const handleSaveAll = async () => {
    if (!selectedTeacherId || isSaving) return;
    setIsSaving(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;
      if (!token) throw new Error('인증 토큰이 누락되었습니다.');

      // 맵핑 딕셔너리에서 배열 데이터로 전환하여 전송 (빈 셀은 제외하되 색칠이나 학생이 있는 경우만)
      const list = Object.keys(gridData)
        .map(key => gridData[key])
        .filter(cell => cell.student_id !== null || cell.bg_color !== 'default');

      const res = await fetch('/api/timetables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          academyId: academyInfo.id,
          teacherId: selectedTeacherId,
          timetables: list
        })
      });

      if (res.ok) {
        alert('주간 시간표 정보가 안전하게 저장되었습니다.');
        fetchTimetable();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || '저장 실패');
      }
    } catch (e: any) {
      alert(`시간표 저장 중 오류가 발생했습니다: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  // 💡 11. 이미지(사진) 파일로 시간표 다운로드
  const handleSaveAsImage = async () => {
    if (!selectedTeacherId) return;
    const teacherName = activeTeachers.find(t => t.id === selectedTeacherId)?.name || '선생님';
    const container = document.querySelector('.print-timetable-container') as HTMLElement;
    if (!container) return;

    setIsExporting(true);

    // 💡 [안정화] 캡처용 임시 스타일 조절: 가로 스크롤을 강제로 펼쳐서 잘림 없는 전체 캡처를 진행합니다.
    const originalWidth = container.style.width;
    const originalOverflow = container.style.overflow;
    
    const tableEl = container.querySelector('table');
    const tableWidth = tableEl ? tableEl.offsetWidth : container.scrollWidth;
    
    container.style.width = `${tableWidth}px`;
    container.style.overflow = 'visible';

    try {
      const canvas = await html2canvas(container, {
        scale: 2.5, // 2.5배 고화질
        useCORS: true,
        backgroundColor: isLight ? '#ffffff' : '#161616',
        logging: false,
        width: tableWidth, // 전체 가로폭 강제 인쇄
        height: container.scrollHeight,
        windowWidth: tableWidth + 100, // 가상 창 크기 확대
        scrollX: 0,
        scrollY: 0
      });
      
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `[MakeCode]_${teacherName}선생님_주간시간표.png`;
      link.click();
    } catch (e) {
      console.error(e);
      alert('이미지 저장 중 오류가 발생했습니다.');
    } finally {
      // 💡 무조건 스타일을 기존 상태로 원상 복구합니다.
      container.style.width = originalWidth;
      container.style.overflow = originalOverflow;
      setIsExporting(false);
    }
  };

  // 💡 12. 가로 A4 규격의 PDF 파일로 시간표 다운로드
  const handleSaveAsPdf = async () => {
    if (!selectedTeacherId) return;
    const teacherName = activeTeachers.find(t => t.id === selectedTeacherId)?.name || '선생님';
    const container = document.querySelector('.print-timetable-container') as HTMLElement;
    if (!container) return;

    setIsExporting(true);

    // 💡 [안정화] 캡처용 임시 스타일 조절: 가로 스크롤을 강제로 펼쳐서 잘림 없는 전체 캡처를 진행합니다.
    const originalWidth = container.style.width;
    const originalOverflow = container.style.overflow;
    
    const tableEl = container.querySelector('table');
    const tableWidth = tableEl ? tableEl.offsetWidth : container.scrollWidth;
    
    container.style.width = `${tableWidth}px`;
    container.style.overflow = 'visible';

    try {
      const canvas = await html2canvas(container, {
        scale: 2.5, // 2.5배 고화질
        useCORS: true,
        backgroundColor: isLight ? '#ffffff' : '#161616',
        logging: false,
        width: tableWidth, // 전체 가로폭 강제 인쇄
        height: container.scrollHeight,
        windowWidth: tableWidth + 100, // 가상 창 크기 확대
        scrollX: 0,
        scrollY: 0
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const margin = 8;
      const targetWidth = pdfWidth - (margin * 2);
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgHeight / imgWidth;
      const targetHeight = targetWidth * ratio;
      
      let finalWidth = targetWidth;
      let finalHeight = targetHeight;
      if (targetHeight > (pdfHeight - (margin * 2))) {
        finalHeight = pdfHeight - (margin * 2);
        finalWidth = finalHeight / ratio;
      }
      
      const xOffset = (pdfWidth - finalWidth) / 2;
      const yOffset = (pdfHeight - finalHeight) / 2;
      
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);
      pdf.save(`[MakeCode]_${teacherName}선생님_주간시간표.pdf`);
    } catch (e) {
      console.error(e);
      alert('PDF 저장 중 오류가 발생했습니다.');
    } finally {
      // 💡 무조건 스타일을 기존 상태로 원상 복구합니다.
      container.style.width = originalWidth;
      container.style.overflow = originalOverflow;
      setIsExporting(false);
    }
  };

  // 외부 클릭 시 컨텍스트 메뉴 닫기
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  // 💡 오늘 날짜 문자열 포맷 계산 (예: "2026년 7월 12일 일요일")
  const getTodayFormatted = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const date = today.getDate();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = dayNames[today.getDay()];
    return `${year}년 ${month}월 ${date}일 (${dayOfWeek}요일)`;
  };

  return (
    <div className="space-y-4">
      {/* 상단 컨트롤 및 선택 영역 (인쇄 시 숨김 no-print) */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-black/10 p-3 rounded-[4px] border border-white/5 no-print">
        {/* 1. 좌측 선생님 선택 & 단축키 안내 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-black uppercase tracking-wider ${isLight ? 'text-gray-700' : 'text-white/80'}`}>
              담당 선생님 선택:
            </span>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className={`px-3 py-1.5 border rounded-[3px] text-xs font-bold outline-none ${
                isLight 
                  ? 'bg-white border-gray-300 text-gray-800' 
                  : 'bg-black/40 border-white/10 text-white focus:border-blue-500/50'
              }`}
            >
              {activeTeachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name} 선생님 ({t.role === 'admin' ? '원장' : '강사'})</option>
              ))}
            </select>
          </div>
          {/* 단축키 힌트 뱃지 */}
          <span className={`text-[9px] font-black px-2 py-0.5 rounded tracking-wide ${
            isLight 
              ? 'bg-gray-100 text-gray-500 border border-gray-200/80' 
              : 'bg-white/5 text-gray-400 border border-white/5'
          }`}>
            Shift + Alt + T
          </span>
        </div>

        {/* 2. 가운데 오늘 날짜 및 방학 모드 토글 (기존 헤더 빈 공간 활용) */}
        <div className="flex items-center gap-3">
          <span className={`text-[13px] font-black px-4 py-1.5 rounded-full ${
            isLight ? 'bg-gray-100/70 text-gray-700 border border-gray-200/80' : 'bg-white/5 text-gray-300 border border-white/5'
          }`}>
            📅 {getTodayFormatted()}
          </span>

          {/* 🏖️ 방학 모드 토글 (1~4시 교시 활성화) */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none border border-dashed rounded px-2.5 py-1 transition-all hover:bg-black/5 dark:hover:bg-white/5 border-gray-300 dark:border-white/10">
            <input
              type="checkbox"
              checked={isVacationMode}
              onChange={(e) => setIsVacationMode(e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
            />
            <span className={`text-[10px] font-black uppercase tracking-wider ${
              isLight ? 'text-gray-650' : 'text-gray-300'
            }`}>
              🏖️ 방학 (1~4시)
            </span>
          </label>
        </div>

        {/* 3. 우측 버튼 그룹 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoPopulate}
            disabled={isLoading || isSaving || !selectedTeacherId}
            className={`px-3 py-2 rounded-[2px] text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
              isLight
                ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100/50'
                : 'bg-blue-500/5 border-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white'
            }`}
          >
            <Sparkles size={12} className="text-amber-500" />
            UPDATE
          </button>

          <button
            onClick={handleSaveAll}
            disabled={isLoading || isSaving || !selectedTeacherId}
            className={`px-4 py-2 rounded-[2px] text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
              isSaving
                ? 'opacity-50 cursor-wait'
                : isLight
                  ? 'bg-blue-600 border-blue-700 text-white hover:bg-blue-700'
                  : 'bg-blue-600/10 border-blue-500/20 text-blue-400 hover:bg-blue-600 hover:text-white'
            }`}
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            시간표 저장
          </button>

          <button
            onClick={handleSaveAsImage}
            disabled={isLoading || isSaving || isExporting || !selectedTeacherId}
            className={`px-3 py-2 rounded-[2px] text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
              isExporting
                ? 'opacity-50 cursor-wait'
                : isLight
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/50'
                  : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white'
            }`}
          >
            {isExporting ? <Loader2 size={12} className="animate-spin" /> : <FileImage size={12} />}
            사진
          </button>

          <button
            onClick={handleSaveAsPdf}
            disabled={isLoading || isSaving || isExporting || !selectedTeacherId}
            className={`px-3 py-2 rounded-[2px] text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
              isExporting
                ? 'opacity-50 cursor-wait'
                : isLight
                  ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/50'
                  : 'bg-rose-500/5 border-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white'
            }`}
          >
            {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            PDF
          </button>
        </div>
      </div>

      {/* 📅 거대 시간표 격자 렌더링 영역 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-gray-500 text-xs font-black">
          <Loader2 className="animate-spin" size={16} />
          시간표 데이터 로드 중...
        </div>
      ) : (
        <div className={`w-full overflow-x-auto border-2 rounded-[4px] custom-scrollbar-h relative print-timetable-container shadow-sm ${
          isLight ? 'border-black' : 'border-[#333333]'
        }`}>
          <table className={`w-full border-collapse text-[10px] text-center table-fixed ${
            isVacationMode ? 'min-w-[1700px]' : 'min-w-[1300px]'
          }`}>
            <thead>
              {/* 1단 요일 구분 헤더 */}
              <tr className={`border-b text-[10px] font-black uppercase tracking-widest ${
                isLight ? 'bg-gray-100 border-gray-300 text-gray-700' : 'bg-zinc-900/90 border-zinc-800 text-zinc-200'
              }`}>
                <th className={`py-1 px-1 w-[50px] border-r ${isLight ? 'border-gray-300 text-gray-800' : 'border-zinc-800'}`} rowSpan={2}>선생님</th>
                {DAYS.map(day => (
                  <th key={day} colSpan={activeSlots.length + 1} className={`py-1 px-1 border-r last:border-r-0 ${isLight ? 'border-gray-300' : 'border-zinc-700'}`}>
                    {day}요일
                  </th>
                ))}
              </tr>
              {/* 2단 교시/시간대 구분 헤더 */}
              <tr className={`border-b text-[9px] font-black ${
                isLight ? 'bg-gray-50 border-gray-300 text-gray-700' : 'bg-zinc-900/50 text-zinc-300'
              }`}>
                {DAYS.map(day => (
                  <th key={`subheader-${day}`} colSpan={activeSlots.length + 1} className={`p-0 border-r last:border-r-0 ${isLight ? 'border-gray-300' : 'border-zinc-800'}`}>
                    <table className="w-full table-fixed border-collapse">
                      <thead>
                        <tr>
                          {/* 동적 활성 슬롯 배치 */}
                          {activeSlots.map(slot => (
                            <th key={slot} className={`py-1 px-1 border-r font-bold ${isLight ? 'border-gray-300' : 'border-zinc-800/40'}`}>{slot}</th>
                          ))}
                          {/* 맨 오른쪽 번호 */}
                          <th className={`py-1 px-1 w-[24px] ${isLight ? 'bg-black/5 text-gray-700' : 'bg-zinc-800/60 text-zinc-300'}`}>번호</th>
                        </tr>
                      </thead>
                    </table>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-white/5'}`}>
              {/* 상단 본수업 영역 (동적 행 개수로 렌더링) */}
              {Array.from({ length: dynamicRowCount }).map((_, rIdx) => {
                const rowNum = rIdx + 1;
                return (
                  <tr key={`upper-${rowNum}`} className={`h-[24px] ${isLight ? 'hover:bg-gray-50/30' : 'hover:bg-white/[0.01]'}`}>
                    {/* 선생님 이름 세로 병합 표시 */}
                    {rIdx === 0 && (
                      <td rowSpan={dynamicRowCount} className={`py-0 font-black border-r border-gray-300 text-[10px] text-center w-[50px] select-none ${
                        isLight ? 'bg-gray-50/70 text-gray-700' : 'bg-black/40 text-gray-300'
                      }`}>
                        {selectedTeacherId ? activeTeachers.find(t => t.id === selectedTeacherId)?.name : ''}
                      </td>
                    )}

                    {/* 요일별 컬럼 */}
                    {DAYS.map(day => (
                      <td key={`${day}-${rowNum}`} colSpan={activeSlots.length + 1} className={`p-0 border-r last:border-r-0 ${isLight ? 'border-gray-300' : 'border-zinc-800/70'}`}>
                        <table className="w-full h-full table-fixed border-collapse">
                          <tbody>
                            <tr className="h-[24px]">
                              
                              {/* 2. 시간대 셀 동적 연속 출력 */}
                              {activeSlots.map(slot => renderCell(day, slot, rowNum))}

                              {/* 3. 맨 오른쪽 번호 (7시 타임 시작 시 1부터 재카운트) */}
                              {(() => {
                                const displayNum = studentDisplayNumbers[`${day}-${rowNum}`] || '';
                                return (
                                  <td className={`py-0 font-extrabold border-l border-b text-[10px] text-center w-[24px] select-none ${
                                    isLight ? 'bg-gray-50/50 text-gray-800 border-gray-300' : 'bg-black/20 text-zinc-300 border-zinc-800/70'
                                  }`}>
                                    {displayNum}
                                  </td>
                                );
                              })()}
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 🎨 커스텀 컨텍스트 메뉴 (셀 배경색 우클릭 변경) */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className={`fixed z-[99999] py-1.5 w-32 border rounded-[4px] shadow-xl text-xs font-bold ${
            isLight ? 'bg-white border-gray-200 text-gray-700' : 'bg-[#1a1a1a]/95 backdrop-blur-md border-white/10 text-white'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[9px] font-black text-gray-500 uppercase tracking-wider border-b border-white/5 mb-1">
            자리 배경색 지정
          </div>
          {Object.keys(COLOR_CLASSES).map(colorKey => (
            <button
              key={colorKey}
              onClick={() => handleColorChange(contextMenu.key, colorKey)}
              className={`w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 ${
                gridData[contextMenu.key]?.bg_color === colorKey ? 'text-blue-500' : ''
              }`}
            >
              <div className={`w-2.5 h-2.5 rounded-full border ${
                colorKey === 'default' 
                  ? 'bg-transparent border-gray-400' 
                  : colorKey === 'green' ? 'bg-emerald-500 border-emerald-600'
                  : colorKey === 'yellow' ? 'bg-amber-500 border-amber-600'
                  : colorKey === 'orange' ? 'bg-orange-500 border-orange-650'
                  : 'bg-blue-500 border-blue-600'
              }`} />
              {COLOR_CLASSES[colorKey].label}
            </button>
          ))}
        </div>
      )}
      {/* 🖨️ 시간표 인쇄용 스타일 (가로 landscape, A4 피팅) */}
      <style>{`
        @media print {
          /* 1. 가로 방향 인쇄 및 여백 강제 */
          @page {
            size: A4 landscape;
            margin: 6mm !important;
          }
          
          /* 2. 바깥 껍데기 레이아웃 숨기기 및 배경/그림자 투명화 */
          body, html, #__next, main, div, header, aside, section {
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* 프린트하지 않을 UI 일체 숨기기 (헤더 바, 버튼, 대시보드 껍데기 등) */
          .no-print,
          header,
          aside,
          nav,
          button,
          select,
          .fixed.inset-0.z-\[9999\] > div > div:first-child, /* 모달 헤더 바 */
          .bg-black\\/10,
          .bg-black\\/40,
          .fixed.inset-0.bg-black\\/60 {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* 3. 시간표 테이블을 A4 1페이지 전체화면으로 강제 고정 */
          .print-timetable-container {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            border: 2px solid black !important;
            border-radius: 4px !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            background: white !important;
            z-index: 99999999 !important;
          }
          
          table {
            width: 100% !important;
            height: 100% !important;
            min-width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }

          /* 격자 경계선 인쇄 시 뚜렷하게 회색선으로 강제 렌더링 */
          th, td {
            color: black !important;
            border-color: #9ca3af !important; /* gray-400 선색 */
            font-size: 8.5px !important;
            font-weight: bold !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 선생님 칸 세로 병합 스타일 강제 */
          td[rowspan] {
            background-color: #f3f4f6 !important;
            color: black !important;
            font-weight: 900 !important;
            font-size: 9.5px !important;
          }

          /* 배경색 칠해진 칸들 엑셀처럼 100% 출력 강제 (box-shadow inset 기법 적용) */
          .cell-color-green {
            background-color: #D9EAD3 !important;
            box-shadow: inset 0 0 0 1000px #D9EAD3 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .cell-color-yellow {
            background-color: #fef3c7 !important;
            box-shadow: inset 0 0 0 1000px #fef3c7 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .cell-color-orange {
            background-color: #FCE5CD !important;
            box-shadow: inset 0 0 0 1000px #FCE5CD !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .cell-color-blue {
            background-color: #eff6ff !important;
            box-shadow: inset 0 0 0 1000px #eff6ff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .custom-scrollbar-h {
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );
}
