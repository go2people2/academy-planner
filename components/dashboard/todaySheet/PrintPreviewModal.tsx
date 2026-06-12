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

  // 1. Flatten all rows (Dividers & Student rows) to decide page breaks
  const flatRows: any[] = [];
  students.forEach((s: any, idx: number) => {
    const session = s.todaySession;
    
    // Class time calculation
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

    const currentStartTime = getStartTime(s);
    const prevStartTime = idx > 0 ? getStartTime(students[idx - 1]) : null;
    const isNewSection = currentStartTime !== prevStartTime;

    const timeSectionLabel = isNewSection 
      ? (currentStartTime === 999 
          ? '보강 / 기타 수업' 
          : (currentStartTime >= 12 
              ? (currentStartTime === 12 ? `오후 12:${displayMinute}` : `오후 ${currentStartTime-12}:${displayMinute}`) 
              : `오전 ${currentStartTime}:${displayMinute}`) + ' 수업'
        )
      : undefined;

    if (isNewSection && timeSectionLabel) {
      flatRows.push({ type: 'divider', label: timeSectionLabel });
    }
    
    flatRows.push({ type: 'student', data: s });
  });

  // 2. Chunk rows into pages (MAX_ROWS_PER_PAGE = 13 for optimal A4 Landscape fit)
  const MAX_ROWS_PER_PAGE = 13;
  const pages: any[][] = [];
  let currentPage: any[] = [];
  let currentRowCount = 0;

  flatRows.forEach(row => {
    if (currentRowCount >= MAX_ROWS_PER_PAGE) {
      pages.push(currentPage);
      currentPage = [];
      currentRowCount = 0;
    }
    currentPage.push(row);
    currentRowCount++;
  });
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  // Fallback for empty list
  if (pages.length === 0) {
    pages.push([]);
  }

  return (
    <div className="fixed inset-0 z-[250] flex flex-col items-center justify-start p-4 md:p-8 bg-black/85 backdrop-blur-md overflow-y-auto no-print">
      {/* Control bar */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-6 bg-gray-900/90 border border-white/10 rounded-xl p-4 shadow-xl shrink-0">
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
                <div className="flex justify-between items-end border-b-2 border-gray-800 pb-3 mb-5 text-left">
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
                <table className="w-full border-collapse table-fixed text-[9.5px] text-left border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      {displayCols.map(col => (
                        <th 
                          key={col.id} 
                          style={{ width: col.id === 'name' ? '70px' : col.id === 'date' ? '45px' : 'auto' }}
                          className="px-2.5 py-2 font-black text-gray-800 border border-gray-300 uppercase tracking-widest text-[8.5px]"
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
                              className="px-2.5 py-1 text-[8.5px] font-black text-indigo-700 tracking-wider bg-indigo-50/40 border border-gray-300"
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
                            } else if (col.id === 'test_score') {
                              if (session?.test_id) {
                                cellContent = `${session.test_id}${session.test_score ? ` (${session.test_score}%)` : ''}`;
                              }
                            } else if (col.id === 'classwork') {
                              cellContent = session?.classwork_text || '-';
                            } else if (col.id === 'homework') {
                              cellContent = session?.homework_text || '-';
                            } else if (col.id === 'next_quiz') {
                              if (session?.next_quiz_text) {
                                cellContent = `${session.next_quiz_text} (목표: 오답 ${session.next_quiz_cut || 0}개 이하)`;
                              }
                            } else if (col.id === 'notes') {
                              cellContent = session?.special_notes || '-';
                            } else if (col.id === 'completed_classwork') {
                              cellContent = session?.completed_classwork_text || '-';
                            } else if (col.id === 'status') {
                              const stat = session?.attendance_status || '수업전';
                              if (stat.startsWith('출석')) cellContent = '출석';
                              else if (stat.startsWith('지각')) cellContent = '지각';
                              else if (stat.startsWith('결석')) cellContent = '결석';
                              else if (stat.startsWith('보강')) cellContent = '보강';
                              else cellContent = '수업전';
                            }

                            return (
                              <td 
                                key={col.id} 
                                className="px-2.5 py-2 text-gray-800 border border-gray-300 align-middle whitespace-pre-wrap break-all leading-relaxed"
                              >
                                {col.id === 'name' ? (
                                  <span className="font-black text-black">{cellContent}</span>
                                ) : col.id === 'status' ? (
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
              <div className="mt-6 pt-3 border-t border-gray-100 flex items-center justify-between text-[8px] text-gray-400 font-bold uppercase tracking-widest shrink-0">
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
