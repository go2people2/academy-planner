import { useCallback } from 'react';
import * as XLSX from 'xlsx';
import { normalizeAttendanceStatus } from '@/lib/sessionFieldMap';

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
 * 메인 시트 컴포넌트들에서 무거운 XLSX 바인딩 로직을 분리해 내어 품질을 대폭 향상시킵니다.
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
      dataRows = students.map((s: any) => {
        const session = s.todaySession || {}; 
        const teacher = teachers?.find((t: any) => t.id === s.teacher_id);
        const tName = teacher?.nickname || teacher?.name || '';
        const sortedDays = (s.class_days || []).slice().sort((a: string, b: string) => {
          const order: any = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
          return (order[a] || 0) - (order[b] || 0);
        }).join('');
        const teacherInitial = teacher?.initials || s.teacher_initial || '';

        // 오늘 날짜의 요일에 선택과목 수업이 배정되어 있는 경우, 반명을 해당 선택과목 전용 반명으로 변경
        const daysKorean = ['일', '월', '화', '수', '목', '금', '토'];
        const currentKoreanDay = daysKorean[new Date(selectedDate).getDay()];
        
        let electiveClassName = '';
        const rawElective = s.book_courses?.['__elective_courses'];
        if (rawElective) {
          try {
            const parsed = JSON.parse(rawElective);
            if (Array.isArray(parsed)) {
              const matched = parsed.find(item => (item.days || []).includes(currentKoreanDay));
              if (matched) {
                electiveClassName = matched.className?.trim() || `${s.name}-${teacherInitial}-${matched.subject}`;
              }
            }
          } catch (e) {
            console.error('Failed to parse elective courses during ACA export', e);
          }
        }

        const combinedName = electiveClassName 
          ? electiveClassName 
          : `${s.name}-${teacherInitial}-${sortedDays}`;
        const books = (s.assigned_books || []).map((code: string) => masterTextbooks.find((m: any) => m.bookcode === code)?.title || code).filter((title: any) => !!title).join(', ');
        
        const testDisplay = (() => {
          if (!session.test_id) return '';
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
        })();
        return [selectedDate, tName, combinedName, '개별수업', books, session.completed_classwork_text || '', testDisplay, session.homework_text || '', session.special_notes || ''];
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
