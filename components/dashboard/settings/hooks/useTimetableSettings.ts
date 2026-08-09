import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface TimetableCell {
  day_of_week: string;
  time_slot: string;
  row_index: number;
  student_id: string | null;
  bg_color: string;
}

export const DAYS = ['월', '화', '수', '목', '금'];
export const ALL_SLOTS = ['1~2', '2~3', '3~4', '4~5', '5~6', '6~7', '7~8', '8~9', '9~10', '10~11', '11~12'];
export const ROW_COUNT = 40;

export const convertTimeToSlots = (startVal: any, endVal: any): string[] => {
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
  const sH_raw = startHour !== null ? startHour : 16;
  const getNormalizedHour = (h: number) => h <= 12 ? h + 12 : h;
  const sH = getNormalizedHour(sH_raw);

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
    if (sH <= item.start && eH >= item.end) {
      slots.push(item.name);
    }
  });

  if (sH === 13 && (eH === 15 || eH === 16 || eH === 1530)) {
    if (!slots.includes('3~4')) slots.push('3~4');
  }

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

export const buildAutoGrid = (targetStudents: any[], activeSlots: string[]): Record<string, TimetableCell> => {
  const newGrid: Record<string, any> = {};

  DAYS.forEach(day => {
    const studentsOnDay: { studentId: string; name: string; slots: string[]; startSlotIdx: number; isSpecial: boolean }[] = [];

    targetStudents.forEach(student => {
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
                  eSlots = ['1~2', '2~3', '3~4'];
                }

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

    const vacationGroup = studentsOnDay.filter(s => s.slots.length > 0 && ['1~2', '2~3', '3~4'].includes(s.slots[0]));
    const normalGroup = studentsOnDay.filter(s => s.slots.length > 0 && ['4~5', '5~6', '6~7'].includes(s.slots[0]));
    const nightGroup = studentsOnDay.filter(s => s.slots.length > 0 && ['7~8', '8~9', '9~10'].includes(s.slots[0]));

    vacationGroup.sort((a, b) => a.startSlotIdx !== b.startSlotIdx ? a.startSlotIdx - b.startSlotIdx : a.name.localeCompare(b.name, 'ko'));
    normalGroup.sort((a, b) => a.startSlotIdx !== b.startSlotIdx ? a.startSlotIdx - b.startSlotIdx : a.name.localeCompare(b.name, 'ko'));
    nightGroup.sort((a, b) => a.startSlotIdx !== b.startSlotIdx ? a.startSlotIdx - b.startSlotIdx : a.name.localeCompare(b.name, 'ko'));

    const upperMaxCount = Math.max(vacationGroup.length, normalGroup.length);
    let upperRowsUsed = 0;

    for (let i = 0; i < upperMaxCount; i++) {
      const targetRow = 1 + i;
      if (targetRow > ROW_COUNT) break;

      const vacStudent = vacationGroup[i];
      const normStudent = normalGroup[i];

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

    const lowerStartRow = Math.max(upperRowsUsed + 2, 7);

    for (let i = 0; i < nightGroup.length; i++) {
      const targetRow = lowerStartRow + i;
      if (targetRow > ROW_COUNT) break;

      const nightStudent = nightGroup[i];
      nightStudent.slots.forEach((s, sIdx) => {
        if (!activeSlots.includes(s)) return;
        const cellKey = `${day}-${s}-${targetRow}`;
        newGrid[cellKey] = {
          day_of_week: day,
          time_slot: s,
          row_index: targetRow,
          student_id: nightStudent.studentId,
          bg_color: sIdx === 0 ? 'blue' : 'default'
        };
      });
    }
  });

  return newGrid;
};
