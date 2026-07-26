import { useCallback } from 'react';
import * as XLSX from 'xlsx';
import { normalizeAttendanceStatus } from '@/lib/sessionFieldMap';
import { parseBookCourseValue } from '@/lib/utils';

export interface UseTodaySheetExportParams {
  students: any[];
  teachers: any[];
  currentUser: any;
  academyInfo: any;
  selectedDate: string;
  masterTextbooks: any[];
  activeColumns: any[];
  setIsExportOpen: (open: boolean) => void;
}

/**
 * 📝 [리팩토링] useTodaySheetExport: 시트 명단 엑셀, CSV, ACA2000 가공 및 파일 제조 다운로드 전용 공용 훅
 * - students: filteredStudents (정규+특강 행이 이미 분리된 배열)를 받아 아카2000 행 생성 시 그대로 활용
 * - isSpecialClass 행은 courseName, electiveCourse 필드로 반명/세션 분기
 */
export function useTodaySheetExport({
  students,
  teachers,
  currentUser,
  academyInfo,
  selectedDate,
  masterTextbooks,
  activeColumns,
  setIsExportOpen,
}: UseTodaySheetExportParams) {

  const handleExport = useCallback((type: 'csv' | 'excel' | 'copy' | 'aca2000') => {
    let headers: string[] = []; let dataRows: any[][] = [];
    const dateClean = selectedDate.replace(/-/g, '');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = days[new Date(selectedDate).getDay()];
    const teacherName = currentUser?.name || '관리자';
    const customFileName = `업무일지_${dateClean}_${dayOfWeek}_${teacherName}`;

    if (type === 'aca2000') {
      headers = ['일자', '강사', '반명', '과목', '교재', '진도', '테스트', '과제', '기타'];

      // 💡 테스트 표기 문자열 생성 헬퍼
      const buildTestDisplay = (session: any): string => {
        if (!session?.test_id) return '';
        if (session.test_id.includes('(')) return session.test_id;
        if (session.test_score === undefined || session.test_score === null || session.test_score === '') return session.test_id;
        const scoreType = session.test_score_type || 'score';
        if (scoreType === 'score') {
          return `${session.test_id} (${session.test_score}점)`;
        } else {
          return session.test_total_count
            ? `${session.test_id} (${session.test_score}개 / ${session.test_total_count}개)`
            : `${session.test_id} (${session.test_score}개)`;
        }
      };

      // 💡 filteredStudents(이미 정규/특강 행 분리 완료)를 그대로 순회
      //    - isSpecialClass=false → 정규 행: 기존 반명 + 정규 todaySession
      //    - isSpecialClass=true  → 특강 행: 특강 반명 + 특강 todaySession
      dataRows = students.map((s: any) => {
        const teacher = teachers?.find((t: any) => t.id === s.teacher_id);
        const tName = teacher?.nickname || teacher?.name || '';
        const teacherInitial = teacher?.initials || s.teacher_initial || '';
        const session = s.todaySession || {};

        const currentRowTargetTag = s.isSpecialClass 
          ? `선택:${s.courseName || s.electiveCourse?.subject || ''}`
          : '정규';

        // 💡 킵해둔 교재(-keep), 완료된 교재(-done) 및 타 수업용 교재 제외
        const books = (s.assigned_books || [])
          .filter((code: string) => {
            const courseVal = String(s.book_courses?.[code] || '');
            if (courseVal.includes('-keep') || courseVal.includes('-done')) return false;

            const { targetTag } = parseBookCourseValue(courseVal);
            const isMatch = (targetTag === '공통') ||
                            (!s.isSpecialClass && (targetTag === '정규' || !targetTag.startsWith('선택:'))) ||
                            (s.isSpecialClass && (targetTag === currentRowTargetTag));

            return isMatch;
          })
          .map((code: string) => masterTextbooks.find((m: any) => m.bookcode === code)?.title || code)
          .filter((title: any) => !!title)
          .join(', ');


        let combinedName: string;

        if (s.isSpecialClass) {
          // 특강 행: 규격 반명 사용 (특강-[이름]-[강사이니셜]-[특강수업요일])
          const elective = s.electiveCourse;
          const daysArr = Array.isArray(elective?.days)
            ? elective.days
            : (Array.isArray(elective?.class_days) ? elective.class_days : []);

          const sortedElectiveDays = daysArr
            .map((d: any) => String(d).replace('요일', '').trim())
            .sort((a: string, b: string) => {
              const order: Record<string, number> = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
              return (order[a] || 0) - (order[b] || 0);
            })
            .join('');

          const daysStr = sortedElectiveDays || (s.class_days || []).join('').replace(/요일/g, '') || '특강';
          combinedName = `특강-${s.name}-${teacherInitial}-${daysStr}`;
        } else {
          // 정규 행: 기존 반명 (이름-강사이니셜-요일)
          const sortedDays = (s.class_days || []).slice().sort((a: string, b: string) => {
            const order: any = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
            return (order[a] || 0) - (order[b] || 0);
          }).join('');
          combinedName = `${s.name}-${teacherInitial}-${sortedDays}`;
        }

        return [
          selectedDate,
          tName,
          combinedName,
          '개별수업',
          books,
          session.completed_classwork_text || '',
          buildTestDisplay(session),
          session.homework_text || '',
          session.special_notes || '',
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 10 }, { wch: 30 }, { wch: 40 }, { wch: 20 }, { wch: 40 }, { wch: 30 }];
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "ACA2000_Upload");
      const acaFileName = `업무일지_${dateClean.slice(2)}_${dayOfWeek}_${teacherName}`;
      XLSX.writeFile(wb, `${acaFileName}.xls`, { bookType: 'biff8' });
    } else {
      const cols = activeColumns.filter(c => !['select', 'action'].includes(c.id));
      headers = cols.map(c => c.label);
      dataRows = students.map((s: any) => {
        const sess = s.todaySession || {};
        return cols.map(col => {
          if (col.id === 'date') return selectedDate; if (col.id === 'name') return s.name;
          if (col.id === 'attendance') {
            const status = normalizeAttendanceStatus(sess.attendance_status);
            const moved = sess.moved_to_hour;
            return moved ? `${status}(${moved}시)` : status;
          }
          if (col.id === 'test_id') return sess.test_id || '';
          if (col.id === 'test_score') return sess.test_score ? `${sess.test_score}${sess.test_score_type === 'count' ? '개' : '점'}` : '';
          if (col.id === 'next_quiz') return sess.next_quiz_text || '';
          if (col.id === 'review') return s.lastSession?.homework_text || '';
          if (col.id === 'classwork') return sess.classwork_text || '';
          if (col.id === 'assign') return sess.homework_text || '';
          if (col.id === 'mission') return s.recent_mission || '';
          if (col.id === 'notes') return sess.special_notes || '';
          return '';
        });
      });
      if (type === 'copy') { const text = [headers.join('\t'), ...dataRows.map(row => row.join('\t'))].join('\n'); navigator.clipboard.writeText(text); alert('표 전체가 클립보드에 복사되었습니다.'); } 
      else if (type === 'csv') { const content = '\uFEFF' + [headers.join(','), ...dataRows.map(row => row.map(v => `"${v}"`).join(','))].join('\n'); const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${customFileName}.csv`; link.click(); } 
      else if (type === 'excel') { const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]); ws['!cols'] = headers.map(() => ({ wch: 20 })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "DailySheet"); XLSX.writeFile(wb, `${customFileName}.xlsx`); }
    }
    setIsExportOpen(false);
  }, [students, teachers, currentUser, academyInfo, selectedDate, masterTextbooks, activeColumns, setIsExportOpen]);

  return { handleExport };
}
