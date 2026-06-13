'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Printer, X, FileText } from 'lucide-react';
import { getDayOfWeek } from '@/lib/utils';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: any[];
  selectedDate: string;
  academyInfo: any;
  activeColumns: any[];
}

export default function PrintPreviewModal({
  isOpen,
  onClose,
  students,
  selectedDate,
  academyInfo,
  activeColumns
}: PrintPreviewModalProps) {
  if (!isOpen) return null;

  // Filter columns to exclude interactive ones (checkbox, action buttons)
  const displayCols = activeColumns.filter(c => c.id !== 'select' && c.id !== 'action');

  const handlePrint = () => {
    window.print();
  };

  const dayKey = getDayOfWeek(selectedDate);
  const [_, configM] = (academyInfo?.operation_settings?.first_period_time || "00:00").split(':').map(Number);
  const displayMinute = configM.toString().padStart(2, '0');

  // Class time calculation helper
  const getStartTime = (st: any) => {
    if (st.todaySession?.moved_to_hour !== undefined && st.todaySession?.moved_to_hour !== null) {
      return st.todaySession.moved_to_hour;
    }
    const stat = st.todaySession?.attendance_status || '수업전';
    if (stat.includes(':')) {
      const parts = stat.split(':');
      const val = parseInt(parts[parts.length - 1]);
      if (!isNaN(val) && val < 24) return val;
    }
    const hours = st.day_schedules?.[dayKey] || [];
    return hours.length > 0 ? Math.min(...hours.map((h: number) => h % 100)) : 999;
  };

  const getTimeLabel = (time: number) => {
    if (time === 999) return '보강 / 기타 수업';
    return (time >= 12 
      ? (time === 12 ? `오후 12:${displayMinute}` : `오후 ${time-12}:${displayMinute}`) 
      : `오전 ${time}:${displayMinute}`) + ' 수업';
  };

  // 1. Group students by start time
  interface TimeGroup {
    time: number;
    label: string;
    students: any[];
  }

  const groups: TimeGroup[] = [];
  students.forEach((s: any) => {
    const time = getStartTime(s);
    const label = getTimeLabel(time);
    let group = groups.find(g => g.time === time);
    if (!group) {
      group = { time, label, students: [] };
      groups.push(group);
    }
    group.students.push(s);
  });

  // Sort groups by class time
  groups.sort((a, b) => a.time - b.time);

  // 2. Distribute groups into pages using smart logic (MAX_ROWS_PER_PAGE = 20)
  // Threshold: if a group has < 3 students, it is merged with the previous page to save paper
  const MAX_ROWS_PER_PAGE = 20;
  const MIN_STUDENTS_FOR_NEW_PAGE = 3;
  const pages: any[][] = [];
  let currentPage: any[] = [];

  groups.forEach((group) => {
    const groupRows: any[] = [];
    groupRows.push({ type: 'divider', label: group.label });
    group.students.forEach(s => {
      groupRows.push({ type: 'student', data: s });
    });

    const isSmallGroup = group.students.length < MIN_STUDENTS_FOR_NEW_PAGE;
    const currentLength = currentPage.length;
    const willExceedLimit = currentLength + groupRows.length > MAX_ROWS_PER_PAGE;

    // Split page if:
    // 1) Current page is not empty
    // 2) Group is NOT a small group (>= 3 students) OR merging would exceed page limit (20 rows)
    if (currentLength > 0 && (!isSmallGroup || willExceedLimit)) {
      pages.push(currentPage);
      currentPage = [];
    }

    // Distribute group rows (splitting within group if group itself exceeds MAX_ROWS_PER_PAGE)
    let remainingRows = groupRows;
    while (remainingRows.length > 0) {
      const spaceLeft = MAX_ROWS_PER_PAGE - currentPage.length;
      if (remainingRows.length <= spaceLeft) {
        currentPage.push(...remainingRows);
        remainingRows = [];
      } else {
        currentPage.push(...remainingRows.slice(0, spaceLeft));
        pages.push(currentPage);
        currentPage = [];
        remainingRows = remainingRows.slice(spaceLeft);
        if (remainingRows.length > 0 && remainingRows[0].type === 'student') {
          remainingRows.unshift({ type: 'divider', label: `${group.label} (이어서)` });
        }
      }
    }
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  // Fallback for empty list
  if (pages.length === 0) {
    pages.push([]);
  }

  return (
    <div className="fixed inset-0 z-[250] flex flex-col items-center justify-start p-4 md:p-8 bg-black/85 backdrop-blur-md overflow-y-auto print-preview-modal-container">
      {/* Control bar */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-6 bg-gray-900/90 border border-white/10 rounded-xl p-4 shadow-xl shrink-0 no-print">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
            <FileText size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              인쇄 미리보기 <span className="text-indigo-400 text-xs font-bold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">{pages.length} Pages</span>
            </h3>
            <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">A4 가로형 수업일지 분할 출력 미리보기</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/10 active:scale-95"
          >
            <Printer size={14} /> 프린터로 인쇄
          </button>
          <button
            onClick={onClose}
            className="p-2 bg-white/5 border border-white/10 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-all"
            title="닫기"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Pages Container */}
      <div className="w-full max-w-5xl flex flex-col gap-8">
        {pages.map((pageRows, pageIdx) => {
          return (
            <div 
              key={pageIdx} 
              className="print-page-panel w-full bg-white text-gray-900 rounded-2xl shadow-2xl p-8 md:p-12 overflow-x-auto border border-gray-200 flex flex-col justify-between"
              style={{ minHeight: '680px' }} // Proportional A4 landscape height
            >
              <div>
                {/* Paper Header (Rendered on every single page) */}
                <div className="flex justify-between items-end border-b-2 border-gray-800 pb-2 mb-3 text-left">
                  <div>
                    <h1 className="text-lg font-black text-black tracking-tight leading-none">
                      {academyInfo?.academy_name || 'Hokma Math'} 수업 일지
                    </h1>
                    <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                      Daily Study & Task Report
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <span className="text-[10px] font-black text-gray-700 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full leading-none">
                      수업일자: {selectedDate.replace(/-/g, '.')} ({getDayOfWeek(selectedDate)}요일)
                    </span>
                  </div>
                </div>

                {/* Paper Table */}
                <table className="w-full border-collapse table-fixed text-[9px] text-left border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      {displayCols.map(col => (
                        <th 
                          key={col.id} 
                          style={{ width: col.id === 'name' ? '70px' : col.id === 'date' ? '45px' : 'auto' }}
                          className="px-2 py-1.2 font-black text-gray-800 border border-gray-300 uppercase tracking-widest text-[8.5px]"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pageRows.map((row, rIdx) => {
                      if (row.type === 'divider') {
                        return (
                          <tr key={`div-${rIdx}`} className="bg-gray-50 border-y border-gray-300">
                            <td 
                              colSpan={displayCols.length} 
                              className="px-2 py-0.8 text-[8.5px] font-black text-indigo-700 tracking-wider bg-indigo-50/40 border border-gray-300"
                            >
                              🕒 {row.label}
                            </td>
                          </tr>
                        );
                      }

                      const s = row.data;
                      const session = s.todaySession;
                      const displayDateShort = selectedDate.slice(5).replace('-', '.');

                      return (
                        <tr 
                          key={s.id} 
                          className={`border-b border-gray-200 transition-colors ${rIdx % 2 === 1 ? 'bg-gray-50/20' : 'bg-white'}`}
                        >
                          {displayCols.map(col => {
                            let cellContent = '-';
                            if (col.id === 'date') {
                              cellContent = displayDateShort;
                            } else if (col.id === 'name') {
                              cellContent = s.name;
                            } else if (col.id === 'attendance') {
                              const stat = session?.attendance_status || '수업전';
                              if (stat.startsWith('출석')) cellContent = '출석';
                              else if (stat.startsWith('지각')) cellContent = '지각';
                              else if (stat.startsWith('결석')) cellContent = '결석';
                              else if (stat.startsWith('보강')) cellContent = '보강';
                              else cellContent = '수업전';
                            } else if (col.id === 'test_id') {
                              cellContent = session?.test_id || '-';
                            } else if (col.id === 'test_score') {
                              if (session?.test_score) {
                                const isScoreMode = session.test_score_type === 'score';
                                if (isScoreMode) {
                                  cellContent = `${session.test_score}점`;
                                } else {
                                  cellContent = session.test_total_count 
                                    ? `${session.test_score}개 / ${session.test_total_count}개` 
                                    : `${session.test_score}개`;
                                }
                              } else {
                                cellContent = '-';
                              }
                            } else if (col.id === 'next_quiz') {
                              if (session?.next_quiz_text) {
                                cellContent = `${session.next_quiz_text} (목표: 오답 ${session.next_quiz_cut || 0}개 이하)`;
                              }
                            } else if (col.id === 'review') {
                              cellContent = s.lastSession?.homework_text ? `"${s.lastSession.homework_text}"` : '기존 숙제 없음';
                            } else if (col.id === 'classwork') {
                              cellContent = session?.classwork_text || '-';
                            } else if (col.id === 'completed_classwork') {
                              cellContent = session?.completed_classwork_text || '-';
                            } else if (col.id === 'assign') {
                              cellContent = session?.homework_text || '-';
                            } else if (col.id === 'mission') {
                              cellContent = session?.mission || s.recent_mission || '-';
                            } else if (col.id === 'notes') {
                              cellContent = session?.special_notes || '-';
                            }

                            return (
                              <td 
                                key={col.id} 
                                className="px-2 py-1.2 text-gray-800 border border-gray-300 align-middle whitespace-pre-wrap break-all leading-relaxed"
                              >
                                {col.id === 'name' ? (
                                  <span className="font-black text-black">{cellContent}</span>
                                ) : col.id === 'attendance' ? (
                                  <span className={`font-black px-1.5 py-0.5 rounded-[3px] text-[7.5px] border leading-none inline-block ${
                                    cellContent === '출석' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    cellContent === '지각' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    cellContent === '결석' ? 'bg-red-50 text-red-700 border-red-200' :
                                    cellContent === '보강' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    'bg-gray-100 text-gray-500 border-gray-200'
                                  }`}>
                                    {cellContent}
                                  </span>
                                ) : (
                                  cellContent
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paper Footer with page numbers */}
              <div className="mt-3.5 pt-1.5 border-t border-gray-100 flex items-center justify-between text-[8px] text-gray-400 font-bold uppercase tracking-widest shrink-0">
                <span>© {academyInfo?.academy_name || 'Hokma Math'} Management System</span>
                <span className="text-[10px] text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                  {pageIdx + 1} / {pages.length} 페이지
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
