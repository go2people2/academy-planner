'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Student } from '@/types/dashboard';
import { getDayOfWeek, parseInlineTests, parseBookCourseValue } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, TrendingUp, X, BookOpen, Plus, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import TextbookSystem from '@/components/student/TextbookSystem';

interface HistoryRowsProps {
  student: Student;
  activeColumns: any[];
  colWidths: Record<string, number>;
  isExpanded: boolean;
  selectedDate: string;
  limit?: number;
  masterTextbooks?: any[];
  isLight?: boolean;
  onUpdateStudentInfo?: (id: string, field: string, value: any) => Promise<void>;
  onSave?: (id: string, data: any) => Promise<boolean>;
  academyInfo?: any;
}

const renderHighlightedHistoryText = (text: string, isLight: boolean = false) => {
  if (!text) return '-';
  return text.split('\n').map((line, i) => {
    const match = line.match(/^(\s*[-*+•]\s*)(.*)$/);
    if (!match) {
      // 불릿 없는 일반 줄도 ,, 메모 분리
      const plainCommaIdx = line.indexOf(',,');
      if (plainCommaIdx === -1) {
        return (
          <div key={i} className="min-h-[14px]">
            {line || ' '}
          </div>
        );
      }
      const plainContent = line.substring(0, plainCommaIdx);
      const plainMemo = line.substring(plainCommaIdx + 2);
      return (
        <div key={i} className="min-h-[14px]">
          <span>{plainContent}</span>
          <span className={`${isLight ? 'text-amber-600/80' : 'text-gray-500'} italic ml-0.5`}>{plainMemo}</span>
        </div>
      );
    }
    
    const bulletStr = match[1];
    const rest = match[2];
    const commaIdx = rest.indexOf(',,');
    
    if (commaIdx === -1) {
      return (
        <div key={i} className="min-h-[14px]">
          <span className={`${isLight ? 'text-blue-600' : 'text-blue-400'} font-bold`}>{bulletStr}</span>
          <span>{rest}</span>
        </div>
      );
    } else {
      const contentStr = rest.substring(0, commaIdx);
      const memoStr = rest.substring(commaIdx + 2);
      return (
        <div key={i} className="min-h-[14px]">
          <span className={`${isLight ? 'text-blue-600' : 'text-blue-400'} font-bold`}>{bulletStr}</span>
          <span className={`font-medium ${isLight ? 'text-gray-800' : 'text-white/90'}`}>{contentStr}</span>
          <span className={`${isLight ? 'text-amber-600/80' : 'text-gray-505'} italic ml-0.5`}>{memoStr}</span>
        </div>
      );
    }
  });
};

// 💡 빈 껍데기 세션 로그(출결도 없고 학습 내용도 없는 가짜 로그) 판정 헬퍼
const isValidHistoryLog = (l: any) => {
  if (!l) return false;
  const hasStatus = l.status && l.status !== 'none';
  const hasAttendance = l.attendance_status && l.attendance_status !== '출석전' && l.attendance_status !== 'BEFORE';
  const hasContent = (l.classwork_text || '').trim() || 
                     (l.completed_classwork_text || '').trim() || 
                     (l.homework_text || '').trim() || 
                     (l.special_notes || '').trim() || 
                     (l.mission || '').trim();
  const hasTest = l.test_completed || (l.test_score !== undefined && l.test_score !== null && l.test_score !== '');
  
  return hasStatus || hasAttendance || hasContent || hasTest;
};

export const HistoryRows = React.memo(function HistoryRows({ student, activeColumns, colWidths, isExpanded, selectedDate, limit = 3, masterTextbooks, isLight = false, onUpdateStudentInfo, onSave, academyInfo }: HistoryRowsProps) {
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [showBookSearch, setShowBookSearch] = useState(false);

  // 💡 추가: 단원/쪽수 조회 드로어용 상태
  const [selectedBookForDrawer, setSelectedBookForDrawer] = useState<string | null>(null);
  const [bookUnits, setBookUnits] = useState<any[]>([]);
  const [selectedDrawerUnits, setSelectedDrawerUnits] = useState<any[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);

  // 💡 추가: 📌 진도파악 수동/Auto 파싱 팝오버용 상태
  const [pinTargetBook, setPinTargetBook] = useState<string | null>(null);
  const [startPageInput, setStartPageInput] = useState('');
  const [endPageInput, setEndPageInput] = useState('');
  const [matchedUnitPreview, setMatchedUnitPreview] = useState<string>('');

  // 💡 입력 중 실시간 단원 매칭 헬퍼 (단일 페이지 전용)
  const checkLiveUnitMatch = async (bookCode: string, pageStr: string, _dummy = '') => {
    if (!pageStr) {
      setMatchedUnitPreview('');
      return;
    }
    const pageNum = parseInt(pageStr, 10);

    // masterTextbooks에서 실제 구글시트 bookcode 가져오기
    const targetMaster = masterTextbooks?.find((m: any) => m.title === bookCode || m.bookcode === bookCode);
    const realCode = targetMaster?.bookcode || bookCode;

    try {
      const res = await fetch(`/api/textbooks/${realCode}`);
      if (res.ok) {
        const units = await res.json();
        const found = (units || []).find((u: any) => {
          const uStart = parseInt(u.start_page ?? u.sPage ?? u.startPage ?? '0', 10);
          const uEnd = parseInt(u.end_page ?? u.ePage ?? u.endPage ?? '9999', 10);
          return pageNum >= uStart && pageNum <= uEnd;
        });

        if (found) {
          const uName = found.unit || found.unitName || found.title;
          setMatchedUnitPreview(`${uName} (p.${pageStr})`);
        } else {
          setMatchedUnitPreview(`해당 페이지(p.${pageStr})의 단원을 찾을 수 없습니다`);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };
  if (!isExpanded) return null;
  
  const currentRowCourseName = student.isSpecialClass 
    ? (student.courseName || student.electiveCourse?.subject || '').trim() 
    : '정규';

  const pastLogs = (student.allLogs || [])
    .filter((l: any) => {
      if (!l.date || l.date >= selectedDate || !isValidHistoryLog(l)) return false;
      const logCourse = (l.course_name || '정규').trim();
      
      if (student.isSpecialClass) {
        // 💡 특강 행: 오직 해당 특강 수업의 과거 일지 이력만 노출
        return logCourse === currentRowCourseName || (currentRowCourseName && logCourse.includes(currentRowCourseName));
      } else {
        // 💡 정규 행: 오직 정규 수업 과거 일지 이력만 노출
        return logCourse === '정규' || !logCourse;
      }
    })
    .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
  const history = pastLogs.slice(0, limit); 

  const translateBook = (bookName: string) => {
    if (!bookName) return '';
    if (!masterTextbooks || masterTextbooks.length === 0) return bookName;
    const trimmed = bookName.trim();
    const foundMaster = masterTextbooks.find(m => m.bookcode === trimmed || m.title === trimmed);
    if (foundMaster && foundMaster.title) {
      return foundMaster.title;
    }
    let result = trimmed;
    const sortedMaster = [...masterTextbooks].sort((a, b) => (b.bookcode?.length || 0) - (a.bookcode?.length || 0));
    sortedMaster.forEach(m => {
      if (m.bookcode && m.title) {
        const escapedCode = m.bookcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedCode, 'gi');
        result = result.replace(regex, m.title);
      }
    });
    return result;
  };

  // 💡 단원 목록 조회 API 호출
  const fetchBookUnits = async (bookCode: string) => {
    setIsLoadingUnits(true);
    const targetMaster = masterTextbooks?.find((m: any) => m.title === bookCode || m.bookcode === bookCode);
    const realCode = targetMaster?.bookcode || bookCode;
    try {
      const res = await fetch(`/api/textbooks/${realCode}`);
      if (res.ok) {
        const data = await res.json();
        setBookUnits(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch units:', e);
    } finally {
      setIsLoadingUnits(false);
    }
  };

  // 💡 선택한 단원들 일지(수업진도/숙제/오답) 일괄 반영 헬퍼
  const handleQuickAddDrawerUnits = async (type: 'classwork' | 'homework' | 'wrong') => {
    if ((!onSave && !onUpdateStudentInfo) || selectedDrawerUnits.length === 0 || !selectedBookForDrawer) return;
    const title = translateBook(selectedBookForDrawer);
    const unitTexts = selectedDrawerUnits.map(u => {
      const pageStr = u.start_page && u.end_page ? `p.${u.start_page}~${u.end_page}` : u.start_page ? `p.${u.start_page}` : '';
      return `${u.unit || u.unitName || u.title}${pageStr ? ` (${pageStr})` : ''}`;
    }).join(', ');

    const prefix = type === 'wrong' ? '[오답고치기] ' : '';
    const textToAdd = `[${title}] ${prefix}${unitTexts}`;

    const targetKey = type === 'homework' ? 'homework_text' : 'completed_classwork_text';
    const currentText = (student.todaySession as any)?.[targetKey] || (student as any)?.[targetKey] || '';
    const newText = currentText ? `${currentText}\n${textToAdd}` : textToAdd;

    if (onSave) {
      await onSave(student.id, { [targetKey]: newText });
    } else if (onUpdateStudentInfo) {
      await onUpdateStudentInfo(student.id, targetKey, newText);
    }
    setSelectedBookForDrawer(null);
    setSelectedDrawerUnits([]);
  };

  // 💡 📌 진도파악 수동 페이지 입력 저장 헬퍼 (단일 또는 | 구분 2개 진도 지원)
  const handleSaveManualProgress = async (bookCode: string) => {
    if (!onUpdateStudentInfo || !startPageInput) return;
    const bookTitle = translateBook(bookCode);
    const targetMaster = masterTextbooks?.find((m: any) => m.title === bookCode || m.bookcode === bookCode);
    const realCode = targetMaster?.bookcode || bookCode;

    let units: any[] = [];
    try {
      const res = await fetch(`/api/textbooks/${realCode}`);
      if (res.ok) units = (await res.json()) || [];
    } catch (e) {
      console.error(e);
    }

    const formatPart = (rawInput: string) => {
      const trimmed = rawInput.trim();
      if (!trimmed) return '';
      const pageNum = parseInt(trimmed.replace(/[^0-9]/g, ''), 10);
      if (isNaN(pageNum) || pageNum <= 0) return trimmed;

      const found = units.find((u: any) => {
        const uStart = parseInt(u.start_page ?? u.sPage ?? u.startPage ?? '0', 10);
        const uEnd = parseInt(u.end_page ?? u.ePage ?? u.endPage ?? '9999', 10);
        return pageNum >= uStart && pageNum <= uEnd;
      });

      const pageText = trimmed.toLowerCase().includes('p') ? trimmed : `p.${trimmed}`;
      return found ? `${found.unit || found.unitName || found.title} (${pageText})` : pageText;
    };

    let resultVal = '';
    if (startPageInput.includes('|')) {
      const parts = startPageInput.split('|').map(p => formatPart(p));
      resultVal = parts.join(' | ');
    } else {
      resultVal = formatPart(startPageInput);
    }

    const cleanProgress: Record<string, string> = { ...(student.book_progress || {}) };
    delete cleanProgress[bookCode]; // 영문 북코드 키 제거
    delete cleanProgress[bookCode.toLowerCase()];
    cleanProgress[bookTitle] = resultVal;
    await onUpdateStudentInfo(student.id, 'book_progress', cleanProgress);

    // 💡 선택된 날짜 및 업데이트 시간 함께 저장
    const cleanUpdated = { ...((student as any).book_progress_updated_at || {}) };
    cleanUpdated[bookTitle] = new Date().toISOString();
    await onUpdateStudentInfo(student.id, 'book_progress_updated_at', cleanUpdated);

    setPinTargetBook(null);
  };

  // 💡 📌 진도파악 Auto ⚡ 자동 파싱 헬퍼 (범위 안 교재 검증 + 과거 일지 소급)
  const handleAutoParseProgress = async (bookCode: string) => {
    if (!onUpdateStudentInfo) return;
    const sAny = student as any;

    const todayText = `${student.todaySession?.completed_classwork_text || ''}\n${student.todaySession?.homework_text || ''}\n${sAny.completed_classwork_text || ''}\n${sAny.homework_text || ''}`;
    const pastLogs = (student.allLogs || []).slice().sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
    const pastTexts = pastLogs.map((l: any) => `${l.completed_classwork_text || ''}\n${l.homework_text || ''}`);
    const candidateTexts = [todayText, ...pastTexts];

    const bookTitle = translateBook(bookCode);
    const targetMaster = masterTextbooks?.find((m: any) => m.title === bookTitle || m.bookcode === bookCode);
    const realCode = targetMaster?.bookcode || bookCode;

    let parsedResult = '';

    try {
      const res = await fetch(`/api/textbooks/${realCode}`);
      if (res.ok) {
        const units = (await res.json()) || [];

        let minBookPage = 1;
        let maxBookPage = 0;
        units.forEach((u: any) => {
          const uStart = parseInt(u.start_page ?? u.sPage ?? u.startPage ?? '0', 10);
          const uEnd = parseInt(u.end_page ?? u.ePage ?? u.endPage ?? '0', 10);
          if (uStart > 0 && (minBookPage === 1 || uStart < minBookPage)) minBookPage = uStart;
          if (uEnd > maxBookPage) maxBookPage = uEnd;
        });
        if (maxBookPage === 0) maxBookPage = 500;

        for (const text of candidateTexts) {
          if (!text.trim()) continue;

          const pageMatches = Array.from(text.matchAll(/(?:p\.?|페이지\s*|\b)(\d{1,4})\s*(?:p|페이지|\b)/gi));
          const foundPages = pageMatches
            .map(m => parseInt(m[1], 10))
            .filter(p => p >= minBookPage && p <= maxBookPage);

          if (foundPages.length > 0) {
            const lastP = foundPages[foundPages.length - 1];
            const foundUnit = units.find((u: any) => {
              const uStart = parseInt(u.start_page ?? u.sPage ?? u.startPage ?? '0', 10);
              const uEnd = parseInt(u.end_page ?? u.ePage ?? u.endPage ?? '9999', 10);
              return lastP >= uStart && lastP <= uEnd;
            });

            if (foundUnit) {
              const uName = foundUnit.unit || foundUnit.unitName || foundUnit.title;
              parsedResult = `${uName} (p.${lastP})`;
            } else {
              parsedResult = `p.${lastP}`;
            }
            break;
          } else {
            const matchedUnit = units.slice().reverse().find((u: any) => {
              const uName = u.unit || u.unitName || u.title;
              return uName && text.includes(uName);
            });
            if (matchedUnit) {
              parsedResult = matchedUnit.unit || matchedUnit.unitName || matchedUnit.title;
              break;
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    }

    if (parsedResult) {
      const cleanProgress: Record<string, string> = { ...(student.book_progress || {}) };
      delete cleanProgress[bookCode];
      delete cleanProgress[bookCode.toLowerCase()];
      delete cleanProgress[bookTitle];
      cleanProgress[bookTitle] = parsedResult;

      await onUpdateStudentInfo(student.id, 'book_progress', cleanProgress);
      setPinTargetBook(null);
    } else {
      alert(`오늘 및 지난 일지 기록에서 [${bookTitle}] 교재의 페이지나 단원을 찾지 못했습니다.`);
    }
  };

  const borderClass = isLight ? "border-r border-gray-250/60" : "border-r border-white/12";

  return (
    <>
      {history.map((log: any, idx: number) => {
        const rowBg = isLight
          ? (idx % 2 === 0 ? "bg-[#f0f4f8]" : "bg-[#e2ebf5]")
          : (idx % 2 === 0 ? "bg-white/5" : "bg-transparent");
        const trBorder = isLight ? "border-b border-blue-100/70" : "border-b border-white/5";
        const trHover = isLight ? "hover:bg-[#d0dfef]" : "hover:bg-white/10";
        
        return (
          <tr key={`${student.id}-hist-${idx}`} className={`${rowBg} ${trBorder} ${trHover} transition-colors align-middle text-[11px]`}>
            {activeColumns.map((col: any) => {
              const styles = { 
                width: colWidths[col.id] || col.minWidth, 
                minWidth: colWidths[col.id] || col.minWidth, 
                left: col.id === 'name' ? 0 : 'auto', 
                position: (col.isSticky ? 'sticky' : 'relative') as any, 
                zIndex: 10, 
                backgroundColor: isLight ? (idx % 2 === 0 ? '#f0f4f8' : '#e2ebf5') : '#050505' 
              };
              
              if (col.id === 'select') return <td key={col.id} style={styles} className={borderClass}></td>;
              if (col.id === 'date') return <td key={col.id} style={styles} className={`py-3 px-3 ${borderClass} ${isLight ? 'text-gray-500' : 'text-gray-400'} text-[10px] font-black text-center`}>{log.date ? log.date.slice(5).replace('-', '.') : '-'}</td>;
              if (col.id === 'name') {
                return (
                  <td 
                    key={col.id} 
                    style={styles} 
                    className={`py-3 px-3 ${borderClass} text-left italic text-gray-500 font-bold select-none`}
                  >
                    이전 이력
                  </td>
                );
              }
              if (col.id === 'tools') return <td key={col.id} style={styles} className={`${borderClass} opacity-30 italic ${isLight ? 'text-gray-400' : 'text-gray-650'} text-center`}>-</td>;
              if (col.id === 'attendance') {
                const status = log.attendance_status || '출석';
                const colorClass = status.startsWith('출석') 
                  ? (isLight ? 'text-emerald-600' : 'text-emerald-400') 
                  : status.startsWith('결석') 
                    ? (isLight ? 'text-red-600' : 'text-red-400') 
                    : (isLight ? 'text-amber-600' : 'text-amber-400');
                return <td key={col.id} style={styles} className={`py-3 px-3 ${borderClass} text-left font-black text-[11px] ${colorClass}`}>{status}</td>;
              }
              if (col.id === 'test_id') return <td key={col.id} style={styles} className={`py-3 px-3 ${borderClass} ${isLight ? 'text-gray-700' : 'text-gray-300'} font-bold text-[11px] whitespace-pre-wrap leading-tight text-left`}>{log.test_id}</td>;
              if (col.id === 'test_score') {
                const parsedTests = parseInlineTests(log.test_id);
                if (parsedTests) {
                  return (
                    <td key={col.id} style={styles} className={`py-2 px-3 ${borderClass} text-right`}>
                      <div className="flex flex-col items-end justify-center">
                        {parsedTests.map((t: any, tIdx: number) => {
                          const isPending = t.numericScore === null;
                          let scoreColor = isLight ? 'text-gray-500' : 'text-gray-400';
                          if (!isPending) {
                            if (t.maxScore === 100) {
                              scoreColor = t.isPass 
                                ? (isLight ? 'text-emerald-600 font-bold' : 'text-emerald-400') 
                                : (isLight ? 'text-red-600 font-bold' : 'text-red-400');
                            } else {
                              scoreColor = t.isPass 
                                ? (isLight ? 'text-pink-600 font-bold' : 'text-pink-300') 
                                : (isLight ? 'text-red-600 font-bold' : 'text-red-400');
                            }
                          }
                          return (
                            <div key={tIdx} className="text-[11px] font-normal leading-snug">
                              {t.maxScore === 100 ? (
                                <span className={scoreColor}>{isPending ? (isLight ? '채점전' : '채점 전') : `${t.numericScore}점`}</span>
                              ) : (
                                <>
                                  <span className={scoreColor}>{isPending ? '-' : t.numericScore}</span>
                                  <span className={`${isLight ? 'text-gray-400' : 'text-gray-600'} mx-0.5`}>/</span>
                                  <span className={isLight ? 'text-blue-600 font-bold' : 'text-blue-400'}>{t.maxScore}</span>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                }
                const unit = log.test_score_type === 'count' ? '개' : '점';
                return <td key={col.id} style={styles} className={`py-3 px-3 ${borderClass} text-left ${isLight ? 'text-blue-650' : 'text-blue-400'} font-black text-[12px]`}>{log.test_score ? `${log.test_score}${unit}` : '-'}</td>;
              }
              if (col.id === 'review') {
                const prevLog = pastLogs[idx + 1];
                const prevHw = prevLog?.homework_text;
                const rawDate = prevLog?.date ? prevLog.date.slice(5).replace('-', '.') : '';
                const rawDay = prevLog?.date ? getDayOfWeek(prevLog.date) : '';
                const reviewColor = isLight ? 'text-teal-700' : 'text-teal-200';
                const quoteColor = isLight ? 'text-teal-600/80' : 'text-teal-500/80';
                const dayColor = isLight ? 'text-amber-700 font-bold' : 'text-amber-300';
                return (
                  <td key={col.id} style={styles} onMouseDown={(e) => e.stopPropagation()} className={`py-3 px-3 ${borderClass} ${reviewColor} italic text-[11px] whitespace-pre-wrap leading-[1.15] text-left select-text cursor-text`}>
                    {prevHw ? (
                      <div className={`flex flex-col ${reviewColor} italic text-[11px] whitespace-pre-wrap leading-[1.15] text-left break-all`}>
                        <div className={`${reviewColor} italic text-[11px] whitespace-pre-wrap leading-[1.15] text-left break-all`}>
                          {rawDate && (
                            <div>
                              <span className={`${quoteColor} text-[14px] font-normal mr-1 align-top leading-[1.15]`}>"</span>
                              [{rawDate} <span className={dayColor}>({rawDay})</span>]
                            </div>
                          )}
                          {prevHw.split(/\n\s*\n/).map((para: string, i: number, arr: string[]) => (
                            <span key={i} className={`block ${i !== arr.length - 1 ? 'mb-1.5' : ''}`}>
                              {!rawDate && i === 0 && <span className={`${quoteColor} text-[14px] font-normal mr-1 align-top leading-[1.15]`}>"</span>}
                              {para.split(/(\([월화수목금토일]\))/g).map((part, j) => 
                                part.match(/^\([월화수목금토일]\)$/) ? <span key={j} className={dayColor}>{part}</span> : part
                              )}
                              {i === arr.length - 1 && <span className={`${quoteColor} text-[14px] font-normal ml-1 align-bottom leading-[1.15]`}>"</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : <span className={isLight ? 'text-gray-400' : 'text-gray-605'}>-</span>}
                  </td>
                );
              }
              if (col.id === 'book_progress') {
                const recordedEntries = (Array.isArray((student as any).book_progress_history) ? (student as any).book_progress_history : []).filter(
                  (h: any) => h.date === log.date
                );

                const dateFormatted = log.date ? log.date.slice(5).replace('-', '.').replace(/^0/, '') : '';
                const dateTag = dateFormatted ? `[${dateFormatted}]` : '';

                if (recordedEntries.length > 0) {
                  return (
                    <td key={col.id} style={styles} onMouseDown={(e) => e.stopPropagation()} className={`py-2 px-3 ${borderClass} text-left select-text cursor-text`}>
                      <div className="flex flex-col gap-1">
                        {recordedEntries.map((e: any, eIdx: number) => (
                          <span key={eIdx} className={`text-[11px] font-medium leading-tight ${
                            isLight ? 'text-emerald-900' : 'text-emerald-300'
                          }`}>
                            {dateTag}{e.book ? `[${e.book}]` : ''} {e.progress}
                          </span>
                        ))}
                      </div>
                    </td>
                  );
                }

                return (
                  <td key={col.id} style={styles} onMouseDown={(e) => e.stopPropagation()} className={`py-2 px-3 ${borderClass} text-left select-text cursor-text`}>
                    <span className={isLight ? 'text-gray-400' : 'text-gray-600'}>-</span>
                  </td>
                );
              }
              if (col.id === 'classwork') return <td key={col.id} style={styles} onMouseDown={(e) => e.stopPropagation()} className={`py-3 px-4 ${borderClass} ${isLight ? 'text-gray-800' : 'text-gray-200'} font-normal text-[12px] whitespace-pre-wrap leading-[14px] text-left select-text cursor-text`}>{renderHighlightedHistoryText(log.classwork_text, isLight)}</td>;
              if (col.id === 'completed_classwork') return <td key={col.id} style={styles} onMouseDown={(e) => e.stopPropagation()} className={`py-3 px-4 ${borderClass} ${isLight ? 'text-blue-700 font-medium' : 'text-blue-300'} font-normal text-[12px] whitespace-pre-wrap leading-[14px] text-left select-text cursor-text`}>{renderHighlightedHistoryText(log.completed_classwork_text, isLight)}</td>;
              if (col.id === 'assign') return <td key={col.id} style={styles} onMouseDown={(e) => e.stopPropagation()} className={`py-3 px-4 ${borderClass} ${isLight ? 'text-gray-800' : 'text-gray-200'} font-normal text-[12px] whitespace-pre-wrap leading-[14px] text-left select-text cursor-text`}>{renderHighlightedHistoryText(log.homework_text, isLight)}</td>;
              if (col.id === 'mission') return <td key={col.id} style={styles} onMouseDown={(e) => e.stopPropagation()} className={`py-3 px-4 ${borderClass} ${isLight ? 'text-amber-700 font-medium' : 'text-amber-200/90'} font-normal text-[12px] whitespace-pre-wrap leading-[14px] text-left select-text cursor-text`}>{renderHighlightedHistoryText(log.mission, isLight)}</td>;
              if (col.id === 'next_quiz') return <td key={col.id} style={styles} onMouseDown={(e) => e.stopPropagation()} className={`py-3 px-3 ${borderClass} ${isLight ? 'text-gray-600' : 'text-gray-400'} italic text-[11px] whitespace-pre-wrap leading-tight text-left select-text cursor-text`}>{log.next_quiz_text}</td>;
              if (col.id === 'notes') return <td key={col.id} style={styles} onMouseDown={(e) => e.stopPropagation()} className={`py-3 px-3 ${borderClass} ${isLight ? 'text-amber-700/60' : 'text-amber-200/50'} italic text-[10px] truncate text-left select-text cursor-text`}>{log.special_notes}</td>;
              if (col.id === 'management_notes') return <td key={col.id} style={styles} onMouseDown={(e) => e.stopPropagation()} className={`py-3 px-4 ${borderClass} ${isLight ? 'text-gray-800' : 'text-gray-200'} font-normal text-[12px] whitespace-pre-wrap leading-[14px] text-left select-text cursor-text`}>{renderHighlightedHistoryText(log.management_notes, isLight)}</td>;
              if (col.id === 'action') {
                const actionBg = isLight ? (idx % 2 === 0 ? 'bg-[#f0f4f8]' : 'bg-[#e2ebf5]') : 'bg-[#050505]';
                return <td key={col.id} style={styles} className={`py-3 sticky right-0 ${actionBg} ${isLight ? 'border-l border-blue-100/50' : 'border-l border-white/10'} z-20`} />;
              }
              return <td key={col.id} style={styles}></td>;
            })}
          </tr>
        );
      })}

      {/* 교재 및 관리 주의점 통합 현황 행 (colSpan 적용하여 겹침 없이 넓고 시원하게 전체 공개) */}
      <tr className={`${isLight ? 'bg-blue-50/40 border-b border-blue-100/50' : 'bg-white/[0.02] border-b border-white/5'} text-[11px]`}>
        <td colSpan={activeColumns.length} className="py-4 px-6 select-text">
          <div className="flex flex-col md:flex-row gap-6">
            {/* 1. 배정 교재 목록 */}
            <div className="flex-1 min-w-[200px]">
              {(() => {
                const currentSubject = (student.courseName || student.electiveCourse?.subject || '').trim();
                const currentRowTargetTag = student.isSpecialClass ? `선택:${currentSubject}` : '정규';

                const activeBooks = (student.assigned_books || []).filter((book: string) => {
                  if (!book || book.startsWith('__')) return false;
                  const rawVal = String(student.book_courses?.[book] || '');
                  const { isKeep, targetTag } = parseBookCourseValue(rawVal);
                  if (rawVal.includes('-done') || isKeep) return false;

                  if (student.isSpecialClass) {
                    return targetTag === currentRowTargetTag || (currentSubject && targetTag.includes(currentSubject)) || targetTag === '공통';
                  } else {
                    return targetTag === '정규' || targetTag === '공통' || !targetTag.startsWith('선택:');
                  }
                });
                const allAssignedBooks = student.assigned_books || [];
                const unassignedBooks = (masterTextbooks || []).filter(
                  (b: any) => b.bookcode && !allAssignedBooks.includes(b.bookcode)
                );
                const bookCategories = (() => {
                  const customCats = academyInfo?.operation_settings?.textbook_categories;
                  if (Array.isArray(customCats) && customCats.length > 0) return ['전체', ...customCats];
                  return ['전체', '초5', '초6', '중1', '중2', '중3', '공수1', '공수2', '대수', '미적분1', '미적분2', '확통', '기하'];
                })();
                const filteredUnassignedBooks = unassignedBooks.filter((b: any) => {
                  const matchCategory = (!selectedCategory || selectedCategory === '전체') ||
                    b.title?.toLowerCase().includes(selectedCategory.toLowerCase()) ||
                    (b.grade || '').toLowerCase().includes(selectedCategory.toLowerCase());
                  const matchSearch = !bookSearchQuery.trim() ||
                    b.title?.toLowerCase().includes(bookSearchQuery.trim().toLowerCase()) ||
                    b.bookcode?.toLowerCase().includes(bookSearchQuery.trim().toLowerCase());
                  return matchCategory && matchSearch;
                });

                return (
                  <>
                    <div className={`text-[9.5px] font-black ${isLight ? 'text-emerald-700' : 'text-emerald-400/80'} tracking-wider uppercase mb-2 flex items-center gap-1 select-none`}>
                      📚 배정 교재 목록 ({activeBooks.length}개)
                    </div>
                    <div className="flex flex-wrap gap-1.5 pr-1 max-h-[300px] overflow-y-auto custom-scrollbar-v">
                              {/* 💡 교재 추가 버튼 (맨 앞) */}
                      {onUpdateStudentInfo && (
                        <button
                          onClick={() => { setShowAddBookModal(true); setSelectedCategory('전체'); setBookSearchQuery(''); setShowBookSearch(false); }}
                          className={`flex items-center gap-1 px-2.5 py-1.5 border border-dashed rounded-[4px] text-[10.5px] font-extrabold transition-all ${
                            isLight
                              ? 'border-emerald-400/50 text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                              : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15'
                          }`}
                        >
                          <Plus size={11} strokeWidth={3} />
                          추가
                        </button>
                      )}
                      {activeBooks.map((book: string, bIdx: number) => {
                        const translated = translateBook(book);
                        const progressVal = student.book_progress?.[book] || student.book_progress?.[translated] || '';
                        const progressParts = progressVal ? progressVal.split('|').map(s => s.trim()).filter(Boolean) : [];
                        return (
                          <div key={bIdx} className="flex items-center gap-1">
                            {/* 💡 1번 메인 버튼: 교재 칩 전체 어디를 눌러도 단원별 페이지 모달 오픈 */}
                            <button
                              onClick={() => {
                                setSelectedBookForDrawer(book);
                                fetchBookUnits(book);
                              }}
                              className={`px-3 py-1.5 ${
                                isLight
                                  ? 'bg-white border-gray-250 text-[#37352f] hover:bg-gray-100 shadow-sm'
                                  : 'bg-white/10 border-white/20 text-gray-100 hover:bg-white/20 shadow-sm'
                              } border rounded-[4px] text-[10.5px] font-extrabold flex items-center gap-1.5 cursor-pointer transition-all`}
                              title={`${translated} 단원 및 페이지 목록 보기`}
                            >
                              {progressParts.length > 1 ? (
                                <div className="flex flex-col gap-0.5 text-left py-0.5">
                                  <span>{translated}</span>
                                  <div className="flex flex-col gap-0.5 pt-0.5">
                                    {progressParts.map((part, pIdx) => (
                                      <span key={pIdx} className={`text-[9px] font-medium px-1 rounded flex items-center gap-1 ${isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                        <span className="text-[8px] text-amber-400 font-bold">{pIdx === 0 ? '①' : '②'}</span>
                                        <span>{part}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <span>{translated}</span>
                                  {progressVal && (
                                    <span className={`text-[9px] font-medium px-1 rounded ${isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                      {progressVal}
                                    </span>
                                  )}
                                </>
                              )}
                            </button>

                            {/* 💡 2번 진도파악 버튼: 📌 아이콘 독립 버튼 */}
                            {onUpdateStudentInfo && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPinTargetBook(pinTargetBook === book ? null : book);
                                  setStartPageInput('');
                                  setEndPageInput('');
                                  setMatchedUnitPreview('');
                                }}
                                className={`px-2 py-1.5 border rounded-[4px] text-[10.5px] transition-colors cursor-pointer ${
                                  pinTargetBook === book
                                    ? 'bg-amber-500 border-amber-400 text-white'
                                    : isLight
                                      ? 'bg-white border-gray-250 text-amber-600 hover:bg-amber-50'
                                      : 'bg-white/10 border-white/20 text-amber-400 hover:bg-white/20'
                                }`}
                                title="진도파악 단원 설정"
                              >
                                📌
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {activeBooks.length === 0 && !onUpdateStudentInfo && (
                        <div className={`text-[10px] ${isLight ? 'text-gray-400' : 'text-gray-600'} italic select-none`}>
                          배정 교재 없음
                        </div>
                      )}
                    </div>



                    {/* 💡 2번 📌 버튼 클릭 시: 군더더기 없이 페이지 입력 시 해당 단원을 실시간으로 바로 보여주는 깔끔한 팝오버 */}
                    {pinTargetBook && typeof window !== 'undefined' && createPortal(
                      <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center p-4">
                        <div className="absolute inset-0 pointer-events-auto" onClick={() => setPinTargetBook(null)} />
                        
                        <div className={`pointer-events-auto relative z-10 w-72 rounded-2xl shadow-2xl p-3.5 border ${
                          isLight ? 'bg-white border-amber-300 text-gray-800' : 'bg-[#141414] border-amber-500/40 text-white'
                        } transition-all animate-in zoom-in-95 duration-150 space-y-2.5`}>
                          <div className="flex items-center justify-between border-b pb-1.5 border-amber-500/20">
                            <h4 className="text-[12px] font-black text-amber-500 flex items-center gap-1">
                              📌 [{translateBook(pinTargetBook)}] 단원 조회
                            </h4>
                            <button onClick={() => setPinTargetBook(null)} className="p-0.5 opacity-60 hover:opacity-100"><X size={14} /></button>
                          </div>

                          {/* 💡 실시간 단원 조회 결과 뱃지 */}
                          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                            <span className="text-[9px] font-bold text-amber-400/80 uppercase block mb-0.5">매칭 단원 결과</span>
                            <p className="text-[13px] font-black text-amber-300 truncate">
                              {matchedUnitPreview || '페이지를 입력해 주세요'}
                            </p>
                          </div>

                          {/* 단 1개의 페이지 번호 입력창 */}
                          <div>
                            <input
                              type="text"
                              placeholder="페이지 입력 (예: 80 또는 25p | 120p)"
                              value={startPageInput}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStartPageInput(val);
                                checkLiveUnitMatch(pinTargetBook, val, '');
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveManualProgress(pinTargetBook);
                                }
                              }}
                              className={`w-full px-3 py-2.5 rounded-xl border text-[13px] font-black outline-none text-center ${
                                isLight ? 'bg-gray-50 border-gray-300 focus:border-amber-500' : 'bg-white/5 border-white/15 focus:border-amber-400'
                              }`}
                              autoFocus
                            />
                          </div>

                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              onClick={() => handleSaveManualProgress(pinTargetBook)}
                              className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-lg text-[10.5px] shadow transition-colors"
                            >
                              이 단원으로 저장
                            </button>
                            <button
                              onClick={() => handleAutoParseProgress(pinTargetBook)}
                              className="px-2.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg text-[10.5px] shadow transition-colors flex items-center gap-1 shrink-0"
                              title="오늘/과거 일지에서 페이지/단원 자동 파싱"
                            >
                              ⚡ 자동파싱
                            </button>
                            {onUpdateStudentInfo && (
                              <button
                                onClick={async () => {
                                  const bookTitle = translateBook(pinTargetBook);
                                  const cleanProgress = { ...(student.book_progress || {}) };
                                  delete cleanProgress[pinTargetBook];
                                  delete cleanProgress[pinTargetBook.toLowerCase()];
                                  delete cleanProgress[bookTitle];
                                  await onUpdateStudentInfo(student.id, 'book_progress', cleanProgress);
                                  setPinTargetBook(null);
                                }}
                                title="이 교재의 진도 삭제"
                                className="px-2.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold rounded-lg text-[10.5px] transition-colors shrink-0"
                              >
                                🗑️ 삭제
                              </button>
                            )}
                          </div>
                        </div>
                      </div>,
                      document.body
                    )}

                    {/* 💡 학생 모바일 원본 TextbookSystem 자체 단일 드로어 렌더링 (창 2개 중복 완전히 해결) */}
                    {selectedBookForDrawer && typeof window !== 'undefined' && createPortal(
                      <TextbookSystem
                        student={student}
                        availableTextbooks={masterTextbooks || []}
                        allLogs={student.allLogs || []}
                        initialBookCode={selectedBookForDrawer}
                        localCompletedClasswork={student.todaySession?.completed_classwork_text || ''}
                        setLocalCompletedClasswork={(val) => {
                          if (onSave) onSave(student.id, { completed_classwork_text: val });
                        }}
                        localHomework={student.todaySession?.homework_text || ''}
                        setLocalHomework={(val) => {
                          if (onSave) onSave(student.id, { homework_text: val });
                        }}
                        todayPlan={student.todaySession?.classwork_text || ''}
                        handleManualSave={async (field, val) => {
                          const keyMap: any = {
                            completed_classwork: 'completed_classwork_text',
                            homework: 'homework_text',
                            classwork: 'classwork_text',
                            special_notes: 'special_notes'
                          };
                          const targetKey = keyMap[field] || field;
                          if (onSave) {
                            await onSave(student.id, { [targetKey]: val });
                          }
                        }}
                        isSaving={false}
                        onBookSelect={(isActive) => {
                          if (!isActive) setSelectedBookForDrawer(null);
                        }}
                        selectedDate={selectedDate}
                        academy={academyInfo}
                      />,
                      document.body
                    )}

                    {/* 💡 교재 추가 모달 (createPortal로 document.body 레벨 최상단 z-[9999] 처리) */}
                    {typeof window !== 'undefined' && createPortal(
                      <AnimatePresence>
                        {showAddBookModal && (
                          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                            <motion.div
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              onClick={() => setShowAddBookModal(false)}
                              className="absolute inset-0 bg-black/60 backdrop-blur-md"
                            />
                            <motion.div
                              initial={{ scale: 0.95, opacity: 0, y: 10 }}
                              animate={{ scale: 1, opacity: 1, y: 0 }}
                              exit={{ scale: 0.95, opacity: 0, y: 10 }}
                              className={`${isLight ? 'bg-white border-gray-200' : 'bg-[#0f0f0f] border-white/10'} border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[80vh]`}
                            >
                              {/* 헤더 */}
                              <div className={`flex items-center justify-between px-5 py-4 border-b ${isLight ? 'border-gray-100 bg-gray-50' : 'border-white/5 bg-white/[0.02]'}`}>
                                <h3 className={`text-[14px] font-black ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>📚 추가할 교재 선택</h3>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      if (showBookSearch) setBookSearchQuery('');
                                      setShowBookSearch(prev => !prev);
                                    }}
                                    className={`p-1.5 rounded-full transition-colors ${
                                      showBookSearch
                                        ? (isLight ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/20 text-emerald-400')
                                        : (isLight ? 'hover:bg-gray-100 text-gray-400 hover:text-gray-600' : 'hover:bg-white/10 text-white/50 hover:text-white')
                                    }`}
                                    title="검색"
                                  >
                                    <Search size={14} />
                                  </button>
                                  <button
                                    onClick={() => setShowAddBookModal(false)}
                                    className={`p-1.5 rounded-full transition-colors ${isLight ? 'hover:bg-gray-100 text-gray-400 hover:text-gray-600' : 'hover:bg-white/10 text-white/50 hover:text-white'}`}
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              </div>

                              {/* 검색창 (토글형) */}
                              {showBookSearch && (
                                <div className={`px-4 pt-3 pb-2 border-b ${isLight ? 'bg-gray-50/50 border-gray-100' : 'bg-white/[0.01] border-white/5'}`}>
                                  <input
                                    type="text"
                                    placeholder="교재명 검색..."
                                    value={bookSearchQuery}
                                    onChange={(e) => setBookSearchQuery(e.target.value)}
                                    autoFocus
                                    className={`w-full px-3.5 py-2 rounded-lg text-[12px] font-bold outline-none transition-all ${
                                      isLight
                                        ? 'bg-white border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30'
                                        : 'bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20'
                                    }`}
                                  />
                                </div>
                              )}

                              {/* 카테고리 칩 */}
                              <div className={`px-4 py-2.5 border-b shrink-0 ${isLight ? 'bg-gray-50/50 border-gray-100' : 'bg-white/[0.01] border-white/5'}`}>
                                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                                  {bookCategories.map((cat: string) => {
                                    const isActive = selectedCategory === cat;
                                    return (
                                      <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-3 py-1.5 rounded-[4px] text-[11px] font-black whitespace-nowrap transition-all border shrink-0 ${
                                          isActive
                                            ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                                            : isLight
                                              ? 'bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                                              : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                                        }`}
                                      >
                                        {cat}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* 교재 리스트 */}
                              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar-v text-left">
                                {filteredUnassignedBooks.length === 0 ? (
                                  <div className={`text-center py-8 text-[12px] font-bold ${isLight ? 'text-gray-400' : 'text-white/40'}`}>
                                    {selectedCategory !== '전체' || bookSearchQuery ? '일치하는 교재가 없습니다.' : '추가할 수 있는 교재가 없습니다.'}
                                  </div>
                                ) : (
                                  filteredUnassignedBooks.map((book: any) => (
                                    <button
                                      key={book.bookcode}
                                      onClick={async () => {
                                        if (!onUpdateStudentInfo) return;
                                        const nextBooks = [...allAssignedBooks, book.bookcode];
                                        await onUpdateStudentInfo(student.id, 'assigned_books', nextBooks);
                                        setShowAddBookModal(false);
                                      }}
                                      className={`w-full flex items-center justify-between p-3.5 border rounded-xl transition-all text-left group ${
                                        isLight
                                          ? 'bg-gray-50 border-gray-200 hover:bg-emerald-50 hover:border-emerald-400/50'
                                          : 'bg-white/5 border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/50'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <BookOpen size={16} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                                        <div>
                                          <span className={`text-[13px] font-black block ${isLight ? 'text-gray-800' : 'text-white'}`}>{book.title}</span>
                                          <span className={`text-[10px] font-bold block mt-0.5 ${isLight ? 'text-gray-400' : 'text-white/40'}`}>{book.grade || '공통'}</span>
                                        </div>
                                      </div>
                                      <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-[4px] opacity-0 group-hover:opacity-100 transition-opacity">
                                        즉시 추가
                                      </span>
                                    </button>
                                  ))
                                )}
                              </div>
                            </motion.div>
                          </div>
                        )}
                      </AnimatePresence>,
                      document.body
                    )}
                  </>
                );
              })()}
            </div>

            {/* 2. 관리 주의점 히스토리 타임라인 */}
            <div className="flex-1 min-w-[200px]">
              <ManagementLogsTimeline student={student} isLight={isLight} />
            </div>
          </div>
        </td>
      </tr>
    </>
  );
});

// 💡 [추가] 관리 주의점 변경이력 타임라인 컴포넌트
const ManagementLogsTimeline = React.memo(function ManagementLogsTimeline({ student, isLight = false }: { student: Student, isLight?: boolean }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('ams_student_management_logs')
          .select(`
            id,
            notes,
            created_at,
            ams_teachers (
              name
            )
          `)
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (!error && data) {
          setLogs(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [student.id, student.management_notes]);

  const cardBg = isLight ? "bg-amber-600/5 border-amber-500/20 text-gray-800" : "bg-amber-500/5 border-amber-500/10 text-gray-200";
  const headerColor = isLight ? "text-amber-700/80" : "text-amber-500/60";
  const bodyColor = isLight ? "text-gray-700" : "text-gray-300";

  return (
    <div className="mt-0">
      <div className={`text-[9.5px] font-black ${isLight ? 'text-amber-700' : 'text-amber-500/80'} tracking-wider uppercase mb-2 flex items-center gap-1 select-none`}>
        ⚠️ 관리 주의점 히스토리
      </div>
      {isLoading ? (
        <div className={`text-[9.5px] ${isLight ? 'text-gray-400' : 'text-gray-600'} italic px-1 select-none`}>
          이력 로딩 중...
        </div>
      ) : logs.length > 0 ? (
        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar-v pr-0.5 select-text">
          {logs.map((log: any) => (
            <div 
              key={log.id} 
              className={`px-3 py-2 ${cardBg} border rounded-[4px] text-[10.5px] leading-relaxed`}
            >
              <div className={`flex justify-between text-[8px] ${headerColor} font-bold uppercase tracking-tighter mb-1 select-none`}>
                <span>{log.ams_teachers?.name || '시스템'}</span>
                <span>{log.created_at.slice(0, 10).replace(/-/g, '.')}</span>
              </div>
              <p className={`whitespace-pre-wrap break-all ${bodyColor} font-medium`}>
                {log.notes}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className={`text-[10px] ${isLight ? 'text-gray-400' : 'text-gray-600'} italic px-1 select-none`}>
          등록된 주의점 이력 없음
        </div>
      )}
    </div>
  );
});

