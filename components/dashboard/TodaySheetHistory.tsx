'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Student } from '@/types/dashboard';
import { getDayOfWeek, parseInlineTests } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, TrendingUp, X } from 'lucide-react';

interface HistoryRowsProps {
  student: Student;
  activeColumns: any[];
  colWidths: Record<string, number>;
  isExpanded: boolean;
  selectedDate: string;
  limit?: number;
  masterTextbooks?: any[];
  isLight?: boolean;
}

const renderHighlightedHistoryText = (text: string, isLight: boolean = false) => {
  if (!text) return '-';
  return text.split('\n').map((line, i) => {
    const match = line.match(/^(\s*[-*+•]\s*)(.*)$/);
    if (!match) {
      return (
        <div key={i} className="min-h-[14px]">
          {line || ' '}
        </div>
      );
    }
    
    const bulletStr = match[1];
    const rest = match[2];
    const commaIdx = rest.indexOf(',');
    
    if (commaIdx === -1) {
      return (
        <div key={i} className="min-h-[14px]">
          <span className={`${isLight ? 'text-blue-600' : 'text-blue-400'} font-bold`}>{bulletStr}</span>
          <span>{rest}</span>
        </div>
      );
    } else {
      const contentStr = rest.substring(0, commaIdx);
      const memoStr = rest.substring(commaIdx);
      return (
        <div key={i} className="min-h-[14px]">
          <span className={`${isLight ? 'text-blue-600' : 'text-blue-400'} font-bold`}>{bulletStr}</span>
          <span className={`font-medium ${isLight ? 'text-gray-800' : 'text-white/90'}`}>{contentStr}</span>
          <span className={`${isLight ? 'text-gray-400' : 'text-gray-505'} italic ml-0.5`}>{memoStr}</span>
        </div>
      );
    }
  });
};

export const HistoryRows = React.memo(function HistoryRows({ student, activeColumns, colWidths, isExpanded, selectedDate, limit = 3, masterTextbooks, isLight = false }: HistoryRowsProps) {
  if (!isExpanded) return null;
  const pastLogs = (student.allLogs || []).filter((l: any) => l.date && l.date < selectedDate).sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
  const history = pastLogs.slice(0, limit); 

  const translateBook = (bookName: string) => {
    if (!bookName || !masterTextbooks || masterTextbooks.length === 0) return bookName;
    let result = bookName;
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
                  <td key={col.id} style={styles} className={`py-3 px-3 ${borderClass} ${reviewColor} italic text-[11px] whitespace-pre-wrap leading-[1.15] text-left`}>
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
              if (col.id === 'classwork') return <td key={col.id} style={styles} className={`py-3 px-4 ${borderClass} ${isLight ? 'text-gray-800' : 'text-gray-200'} font-normal text-[12px] whitespace-pre-wrap leading-[14px] text-left`}>{renderHighlightedHistoryText(log.classwork_text, isLight)}</td>;
              if (col.id === 'completed_classwork') return <td key={col.id} style={styles} className={`py-3 px-4 ${borderClass} ${isLight ? 'text-blue-700 font-medium' : 'text-blue-300'} font-normal text-[12px] whitespace-pre-wrap leading-[14px] text-left`}>{renderHighlightedHistoryText(log.completed_classwork_text, isLight)}</td>;
              if (col.id === 'assign') return <td key={col.id} style={styles} className={`py-3 px-4 ${borderClass} ${isLight ? 'text-gray-800' : 'text-gray-200'} font-normal text-[12px] whitespace-pre-wrap leading-[14px] text-left`}>{renderHighlightedHistoryText(log.homework_text, isLight)}</td>;
              if (col.id === 'mission') return <td key={col.id} style={styles} className={`py-3 px-4 ${borderClass} ${isLight ? 'text-amber-700 font-medium' : 'text-amber-200/90'} font-normal text-[12px] whitespace-pre-wrap leading-[14px] text-left`}>{renderHighlightedHistoryText(log.mission, isLight)}</td>;
              if (col.id === 'next_quiz') return <td key={col.id} style={styles} className={`py-3 px-3 ${borderClass} ${isLight ? 'text-gray-600' : 'text-gray-400'} italic text-[11px] whitespace-pre-wrap leading-tight text-left`}>{log.next_quiz_text}</td>;
              if (col.id === 'notes') return <td key={col.id} style={styles} className={`py-3 px-3 ${borderClass} ${isLight ? 'text-amber-700/60' : 'text-amber-200/50'} italic text-[10px] truncate text-left`}>{log.special_notes}</td>;
              if (col.id === 'management_notes') return <td key={col.id} style={styles} className={`py-3 px-4 ${borderClass} ${isLight ? 'text-gray-800' : 'text-gray-200'} font-normal text-[12px] whitespace-pre-wrap leading-[14px] text-left`}>{renderHighlightedHistoryText(log.management_notes, isLight)}</td>;
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
              <div className={`text-[9.5px] font-black ${isLight ? 'text-emerald-700' : 'text-emerald-400/80'} tracking-wider uppercase mb-2 flex items-center gap-1 select-none`}>
                📚 배정 교재 전체 목록 ({student.assigned_books?.length || 0}개)
              </div>
              {student.assigned_books && student.assigned_books.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pr-1 max-h-[300px] overflow-y-auto custom-scrollbar-v">
                  {student.assigned_books.map((book: string, bIdx: number) => {
                    const translated = translateBook(book);
                    return (
                      <div 
                        key={bIdx} 
                        className={`px-3 py-1.5 ${
                          isLight 
                            ? 'bg-white border-gray-250 text-[#37352f] shadow-sm' 
                            : 'bg-white/10 border-white/20 text-gray-100 shadow-sm'
                        } border rounded-[4px] text-[10.5px] font-extrabold`}
                        title={translated}
                      >
                        {translated}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={`text-[10px] ${isLight ? 'text-gray-400' : 'text-gray-600'} italic select-none`}>
                  배정 교재 없음
                </div>
              )}
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
