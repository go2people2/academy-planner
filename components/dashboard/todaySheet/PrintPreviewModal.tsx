'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Printer, X, FileText, Palette } from 'lucide-react';
import { getDayOfWeek } from '@/lib/utils';
import { useModalEsc } from '@/hooks/useModalEsc';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: any[];
  selectedDate: string;
  academyInfo: any;
  activeColumns: any[];
  columnWidths?: Record<string, number>;
}

// 🎨 Daily Sheet 인쇄 테마 정의
const PRINT_THEMES = {
  classic: {
    name: '클래식 (Classic)',
    headerBorderColor: '#1f2937',
    titleColor: '#000000',
    theadBg: '#f3f4f6',
    theadText: '#1f2937',
    dividerBg: '#eef2ff',
    dividerText: '#3730a3',
    badgeBg: '#f9fafb',
    badgeBorder: '#e5e7eb',
    badgeText: '#374151',
    footerBorderColor: '#f3f4f6',
  },
  blue: {
    name: '블루 스틸 (Blue Steel)',
    headerBorderColor: '#1e40af',
    titleColor: '#1e3a8a',
    theadBg: '#dbeafe',
    theadText: '#1e3a8a',
    dividerBg: '#eff6ff',
    dividerText: '#1d4ed8',
    badgeBg: '#eff6ff',
    badgeBorder: '#bfdbfe',
    badgeText: '#1e40af',
    footerBorderColor: '#dbeafe',
  },
  forest: {
    name: '포레스트 (Forest)',
    headerBorderColor: '#14532d',
    titleColor: '#14532d',
    theadBg: '#dcfce7',
    theadText: '#14532d',
    dividerBg: '#f0fdf4',
    dividerText: '#15803d',
    badgeBg: '#f0fdf4',
    badgeBorder: '#bbf7d0',
    badgeText: '#15803d',
    footerBorderColor: '#dcfce7',
  },
  burgundy: {
    name: '버건디 (Burgundy)',
    headerBorderColor: '#881337',
    titleColor: '#881337',
    theadBg: '#ffe4e6',
    theadText: '#881337',
    dividerBg: '#fff1f2',
    dividerText: '#9f1239',
    badgeBg: '#fff1f2',
    badgeBorder: '#fecdd3',
    badgeText: '#9f1239',
    footerBorderColor: '#ffe4e6',
  },
  amber: {
    name: '앰버 (Amber)',
    headerBorderColor: '#92400e',
    titleColor: '#78350f',
    theadBg: '#fef3c7',
    theadText: '#78350f',
    dividerBg: '#fffbeb',
    dividerText: '#b45309',
    badgeBg: '#fffbeb',
    badgeBorder: '#fde68a',
    badgeText: '#b45309',
    footerBorderColor: '#fef3c7',
  },
};

type ThemeKey = keyof typeof PRINT_THEMES;

export default function PrintPreviewModal({
  isOpen,
  onClose,
  students,
  selectedDate,
  academyInfo,
  activeColumns,
  columnWidths
}: PrintPreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>('classic');

  useEffect(() => {
    setMounted(true);
  }, []);

  useModalEsc({
    isOpen,
    onClose
  });

  if (!isOpen || !mounted) return null;

  const theme = PRINT_THEMES[selectedTheme];

  // Filter columns to exclude interactive ones (checkbox, action buttons), date column, and management notes (for confidentiality)
  const displayCols = activeColumns.filter(c => c.id !== 'select' && c.id !== 'action' && c.id !== 'date' && c.id !== 'tools' && c.id !== 'management_notes');

  // 화면상 설정된 너비 비율을 기반으로 각 열의 프린트 너비 비율(%) 계산
  const totalScreenWidth = displayCols.reduce((sum, col) => sum + (columnWidths?.[col.id] || col.minWidth || 100), 0);

  const handlePrint = () => {
    document.body.classList.add('daily-print-mode');

    // createPortal은 body 맨 끝에 붙으므로, 인쇄 전에 모달을 body 첫 번째로 이동
    // → 앞쪽 앱 콘텐츠(display:none)가 빈 첫 페이지를 만드는 현상 방지
    const modal = document.querySelector('.print-preview-modal-container');
    if (modal) {
      document.body.prepend(modal);
    }

    const cleanup = () => {
      document.body.classList.remove('daily-print-mode');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
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
    if (hours.length > 0) {
      const firstVal = hours[0];
      let h = firstVal >= 100 ? Math.floor(firstVal / 100) : firstVal;
      if (h <= 12) h += 12;
      return h;
    }
    return 999;
  };

  const getTimeLabel = (time: number) => {
    if (time === 999) return '보강 / 기타 수업';
    return (time >= 12
      ? (time === 12 ? `오후 12:${displayMinute}` : `오후 ${time-12}:${displayMinute}`)
      : `오전 ${time}:${displayMinute}`) + ' 수업';
  };

  // 💡 students prop은 TodaySheet의 filteredStudents로, 이미 정규/특강 행이 분리 확장된 상태.
  // 내부에서 재확장하지 않고 그대로 사용하여 중복 key 발생을 원천 차단.
  const seenIds = new Set<string>();
  const expandedStudents: any[] = [];
  (students || []).forEach((s: any) => {
    if (!s) return;
    const sid = s.id;
    if (sid && seenIds.has(sid)) return;
    if (sid) seenIds.add(sid);
    expandedStudents.push(s);
  });

  // 1. Group students by start time
  interface TimeGroup {
    time: number;
    label: string;
    students: any[];
  }

  const groups: TimeGroup[] = [];
  expandedStudents.forEach((s: any) => {
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
  const MAX_ROWS_PER_PAGE = 20;
  const MIN_STUDENTS_FOR_NEW_PAGE = 3;
  const pages: any[][] = [];
  let currentPage: any[] = [];
  let globalIndex = 1;

  groups.forEach((group) => {
    const groupRows: any[] = [];
    groupRows.push({ type: 'divider', label: group.label });
    group.students.forEach(s => {
      groupRows.push({ type: 'student', data: s, printIndex: globalIndex++ });
    });

    const isSmallGroup = group.students.length < MIN_STUDENTS_FOR_NEW_PAGE;
    const currentLength = currentPage.length;
    const willExceedLimit = currentLength + groupRows.length > MAX_ROWS_PER_PAGE;

    if (currentLength > 0 && (!isSmallGroup || willExceedLimit)) {
      pages.push(currentPage);
      currentPage = [];
    }

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

  if (pages.length === 0) {
    pages.push([]);
  }

  return createPortal(
    <div className="fixed inset-0 z-[250] flex flex-col items-center justify-start p-4 md:p-8 bg-black/85 backdrop-blur-md overflow-y-auto print:static print:block print:overflow-visible print:p-0 print:bg-white print-preview-modal-container">
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

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded border border-slate-700">
            <Palette size={13} className="text-indigo-400" />
            <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">테마</span>
            <select
              value={selectedTheme}
              onChange={(e) => setSelectedTheme(e.target.value as ThemeKey)}
              className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer"
            >
              {Object.entries(PRINT_THEMES).map(([key, cfg]) => (
                <option key={key} value={key} className="bg-slate-800 text-white">
                  {cfg.name}
                </option>
              ))}
            </select>
          </div>

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
      <div className="w-full max-w-5xl flex flex-col gap-8 print:block print:gap-0">
        {pages.map((pageRows, pageIdx) => {
          return (
            <div
              key={pageIdx}
              className={`print-page-panel w-full bg-white text-gray-900 rounded-2xl shadow-2xl p-8 md:p-12 overflow-x-auto border border-gray-200 flex flex-col justify-between print:block print:border-none print:shadow-none print:p-0 print:overflow-visible print:mb-0 mb-8${pageIdx < pages.length - 1 ? ' print:break-after-page' : ''}`}
              style={{ minHeight: '680px', pageBreakAfter: pageIdx < pages.length - 1 ? 'always' : 'auto', pageBreakInside: 'avoid' }}
            >
              <div>
                {/* Paper Header */}
                <div
                  className="flex justify-between items-end pb-2 mb-3 text-left"
                  style={{ borderBottom: `2px solid ${theme.headerBorderColor}` }}
                >
                  <div>
                    <h1 className="text-lg font-black tracking-tight leading-none" style={{ color: theme.titleColor }}>
                      {academyInfo?.academy_name || 'Hokma Math'} 수업 일지
                    </h1>
                    <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                      Daily Study &amp; Task Report
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <span
                      className="text-[10px] font-black px-2.5 py-1 rounded-full leading-none"
                      style={{ color: theme.badgeText, background: theme.badgeBg, border: `1px solid ${theme.badgeBorder}` }}
                    >
                      수업일자: {selectedDate.replace(/-/g, '.')} ({getDayOfWeek(selectedDate)}요일)
                    </span>
                  </div>
                </div>

                {/* Paper Table */}
                <table className="w-full border-collapse table-fixed text-[9px] text-left border border-gray-300">
                  <thead>
                    <tr style={{ backgroundColor: theme.theadBg }}>
                      {displayCols.map(col => {
                        const screenWidth = columnWidths?.[col.id] || col.minWidth || 100;
                        const widthPercent = (screenWidth / totalScreenWidth) * 100;
                        return (
                          <th
                            key={col.id}
                            style={{ width: `${widthPercent}%`, color: theme.theadText, backgroundColor: theme.theadBg }}
                            className="px-2 py-1.2 font-black border border-gray-300 uppercase tracking-widest text-[8.5px]"
                          >
                            {col.label}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pageRows.map((row, rIdx) => {
                      if (row.type === 'divider') {
                        return (
                          <tr key={`div-${rIdx}`} className="border-y border-gray-300">
                            <td
                              colSpan={displayCols.length}
                              className="px-2 py-0.8 text-[8.5px] font-black tracking-wider border border-gray-300"
                              style={{ backgroundColor: theme.dividerBg, color: theme.dividerText }}
                            >
                              🕒 {row.label}
                            </td>
                          </tr>
                        );
                      }

                      const s = row.data;
                      const printIndex = row.printIndex;
                      const session = s.todaySession;
                      const displayDateShort = selectedDate.slice(5).replace('-', '.');

                      return (
                        <tr
                          key={`row-${rIdx}`}
                          className={`border-b border-gray-200 transition-colors ${rIdx % 2 === 1 ? 'bg-gray-50/20' : 'bg-white'}`}
                        >
                          {displayCols.map(col => {
                            let cellContent: React.ReactNode = '';
                            if (col.id === 'date') {
                              cellContent = displayDateShort;
                            } else if (col.id === 'name') {
                              const classDays = s.class_days && s.class_days.length > 0
                                ? [...s.class_days].sort((a, b) => {
                                    const order: any = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
                                    return (order[a] || 0) - (order[b] || 0);
                                  }).join('')
                                : '무';
                              cellContent = (
                                <div className="flex flex-col gap-0.5 mt-0.5 relative pl-3">
                                  <span className="absolute -left-0.5 top-0 text-[7.5px] text-gray-400 font-bold tracking-tighter">{printIndex}.</span>
                                  <span className="font-medium text-[9.5px] text-gray-900 leading-none tracking-tight">{(() => {
                                    if (!s.isSpecialClass) return '';
                                    const subj = s.electiveCourse?.subject?.trim();
                                    if (!subj || subj === '특강' || subj === '방학특강') return '특강-';
                                    return `${subj}-`;
                                  })()}{s.name}-{s.teacher_initial || '?'}-{classDays}</span>
                                  <span className="text-[7px] text-gray-500 font-bold uppercase tracking-tighter leading-none">{s.school} · {s.grade}</span>
                                </div>
                              );
                            } else if (col.id === 'attendance') {
                              const stat = session?.attendance_status || '수업전';
                              if (stat.startsWith('출석')) cellContent = '출석';
                              else if (stat.startsWith('지각')) cellContent = '지각';
                              else if (stat.startsWith('결석')) cellContent = '결석';
                              else if (stat.startsWith('보강')) cellContent = '보강';
                              else cellContent = '수업전';
                            } else if (col.id === 'test_id') {
                              cellContent = session?.test_id || '';
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
                                cellContent = '';
                              }
                            } else if (col.id === 'next_quiz') {
                              if (session?.next_quiz_text) {
                                cellContent = `${session.next_quiz_text} (목표: 오답 ${session.next_quiz_cut || 0}개 이하)`;
                              }
                            } else if (col.id === 'review') {
                              cellContent = s.lastSession?.homework_text ? `"${s.lastSession.homework_text}"` : '';
                            } else if (col.id === 'classwork') {
                              cellContent = session?.classwork_text || '';
                            } else if (col.id === 'completed_classwork') {
                              cellContent = session?.completed_classwork_text || '';
                            } else if (col.id === 'assign') {
                              cellContent = session?.homework_text || '';
                            } else if (col.id === 'mission') {
                              cellContent = session?.mission || '';
                            } else if (col.id === 'notes') {
                              cellContent = session?.special_notes || '';
                            } else if (col.id === 'book_progress') {
                              if (s.book_progress) {
                                if (typeof s.book_progress === 'string') {
                                  cellContent = s.book_progress;
                                } else if (typeof s.book_progress === 'object') {
                                  cellContent = Object.entries(s.book_progress)
                                    .filter(([_, prog]) => prog && String(prog).trim())
                                    .map(([book, prog]) => `${book}: ${prog}`)
                                    .join('\n');
                                }
                              } else {
                                cellContent = '';
                              }
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

              {/* Paper Footer */}
              <div
                className="mt-3.5 pt-1.5 flex items-center justify-between text-[8px] text-gray-400 font-bold uppercase tracking-widest shrink-0"
                style={{ borderTop: `1px solid ${theme.footerBorderColor}` }}
              >
                <span>© {academyInfo?.academy_name || 'Hokma Math'} Management System</span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded"
                  style={{ color: theme.badgeText, background: theme.badgeBg, border: `1px solid ${theme.badgeBorder}` }}
                >
                  {pageIdx + 1} / {pages.length} 페이지
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
