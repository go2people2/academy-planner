'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Student } from '@/types/dashboard';
import { getDayOfWeek, parseInlineTests } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface HistoryRowsProps {
  student: Student;
  activeColumns: any[];
  colWidths: Record<string, number>;
  isExpanded: boolean;
  selectedDate: string;
  limit?: number;
  masterTextbooks?: any[];
}

const renderHighlightedHistoryText = (text: string) => {
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
          <span className="text-blue-400 font-bold">{bulletStr}</span>
          <span>{rest}</span>
        </div>
      );
    } else {
      const contentStr = rest.substring(0, commaIdx);
      const memoStr = rest.substring(commaIdx);
      return (
        <div key={i} className="min-h-[14px]">
          <span className="text-blue-400 font-bold">{bulletStr}</span>
          <span className="font-medium text-white/90">{contentStr}</span>
          <span className="text-gray-500 italic ml-0.5">{memoStr}</span>
        </div>
      );
    }
  });
};

export const HistoryRows = React.memo(function HistoryRows({ student, activeColumns, colWidths, isExpanded, selectedDate, limit = 3, masterTextbooks }: HistoryRowsProps) {
  if (!isExpanded || !student.allLogs) return null;
  const pastLogs = student.allLogs.filter((l: any) => l.date && l.date < selectedDate).sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
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

  return (
    <>
      {history.map((log: any, idx: number) => {
        const rowBg = idx % 2 === 0 ? "bg-white/10" : "bg-transparent";
        return (
          <tr key={`${student.id}-hist-${idx}`} className={`${rowBg} border-b border-white/10 transition-colors hover:bg-white/20 align-middle text-[11px]`}>
          {activeColumns.map((col: any) => {
            const styles = { 
              width: colWidths[col.id] || col.minWidth, 
              minWidth: colWidths[col.id] || col.minWidth, 
              left: col.id === 'name' ? 0 : 'auto', 
              position: (col.isSticky ? 'sticky' : 'relative') as any, 
              zIndex: 10, 
              backgroundColor: '#050505' 
            };
            
            if (col.id === 'select') return <td key={col.id} style={styles} className="border-r border-white/12"></td>;
            if (col.id === 'date') return <td key={col.id} style={styles} className="py-3 px-3 border-r border-white/12 text-gray-400 text-[10px] font-black text-center">{log.date ? log.date.slice(5).replace('-', '.') : '-'}</td>;
            if (col.id === 'name') {
              if (idx === 0) {
                return (
                  <td 
                    key={col.id} 
                    rowSpan={history.length} 
                    style={{ ...styles, height: 'auto', verticalAlign: 'top' }} 
                    className="py-3.5 px-3 border-r border-white/12 text-left bg-[#050505]"
                  >
                    <div className="flex flex-col gap-1 pr-1 select-none">
                      <div className="text-[9px] font-black text-emerald-400/80 tracking-wider uppercase mb-1.5 flex items-center gap-1">
                        📚 배정 교재
                      </div>
                      {student.assigned_books && student.assigned_books.length > 0 ? (
                        <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto custom-scrollbar-v pr-0.5">
                          {student.assigned_books.map((book: string, bIdx: number) => {
                            const translated = translateBook(book);
                            return (
                              <div 
                                key={bIdx} 
                                className="px-2.5 py-1.5 bg-white/10 border border-white/20 rounded-[4px] text-[10.5px] font-extrabold text-gray-100 truncate leading-tight shadow-sm"
                                title={translated}
                              >
                                {translated}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[9.5px] text-gray-600 italic px-1">배정 교재 없음</div>
                      )}

                      {/* 💡 [추가] 공구함 박스 아래 빈공간에 관리 주의점 히스토리 렌더링 */}
                      <ManagementLogsTimeline student={student} />
                    </div>
                  </td>
                );
              } else {
                return null;
              }
            }
            if (col.id === 'tools') return <td key={col.id} style={styles} className="border-r border-white/12 opacity-30 italic text-gray-600 text-center">-</td>;
            if (col.id === 'attendance') {
              const status = log.attendance_status || '출석';
              const colorClass = status.startsWith('출석') ? 'text-emerald-400' : status.startsWith('결석') ? 'text-red-400' : 'text-amber-400';
              return <td key={col.id} style={styles} className={`py-3 px-3 border-r border-white/12 text-left font-black text-[11px] ${colorClass}`}>{status}</td>;
            }
            if (col.id === 'test_id') return <td key={col.id} style={styles} className="py-3 px-3 border-r border-white/12 text-gray-300 font-bold text-[11px] whitespace-pre-wrap leading-tight text-left">{log.test_id}</td>;
            if (col.id === 'test_score') {
              const parsedTests = parseInlineTests(log.test_id);
              if (parsedTests) {
                return (
                  <td key={col.id} style={styles} className="py-2 px-3 border-r border-white/12 text-right">
                    <div className="flex flex-col items-end justify-center">
                      {parsedTests.map((t: any, tIdx: number) => {
                        const isPending = t.numericScore === null;
                        let scoreColor = 'text-gray-400';
                        if (!isPending) {
                          if (t.maxScore === 100) {
                            scoreColor = t.isPass ? 'text-emerald-400' : 'text-red-400';
                          } else {
                            scoreColor = t.isPass ? 'text-pink-300' : 'text-red-400';
                          }
                        }
                        return (
                          <div key={tIdx} className="text-[11px] font-normal leading-snug">
                            {t.maxScore === 100 ? (
                              <span className={scoreColor}>{isPending ? '채점 전' : `${t.numericScore}점`}</span>
                            ) : (
                              <>
                                <span className={scoreColor}>{isPending ? '-' : t.numericScore}</span>
                                <span className="text-gray-600 mx-0.5">/</span>
                                <span className="text-blue-400">{t.maxScore}</span>
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
              return <td key={col.id} style={styles} className="py-3 px-3 border-r border-white/12 text-left text-blue-400 font-black text-[12px]">{log.test_score ? `${log.test_score}${unit}` : '-'}</td>;
            }
            if (col.id === 'review') {
              const prevLog = pastLogs[idx + 1];
              const prevHw = prevLog?.homework_text;
              const rawDate = prevLog?.date ? prevLog.date.slice(5).replace('-', '.') : '';
              const rawDay = prevLog?.date ? getDayOfWeek(prevLog.date) : '';
              return (
                <td key={col.id} style={styles} className="py-3 px-3 border-r border-white/12 text-teal-200 italic text-[11px] whitespace-pre-wrap leading-[1.15] text-left">
                  {prevHw ? (
                    <div className="flex flex-col text-teal-200 italic text-[11px] whitespace-pre-wrap leading-[1.15] text-left break-all">
                      <div className="text-teal-200 italic text-[11px] whitespace-pre-wrap leading-[1.15] text-left break-all">
                        {rawDate && (
                          <div>
                            <span className="text-teal-500/80 text-[14px] font-normal mr-1 align-top leading-[1.15]">"</span>
                            [{rawDate} <span className="text-amber-300">({rawDay})</span>]
                          </div>
                        )}
                        {prevHw.split(/\n\s*\n/).map((para: string, i: number, arr: string[]) => (
                          <span key={i} className={`block ${i !== arr.length - 1 ? 'mb-1.5' : ''}`}>
                            {!rawDate && i === 0 && <span className="text-teal-500/80 text-[14px] font-normal mr-1 align-top leading-[1.15]">"</span>}
                            {para.split(/(\([월화수목금토일]\))/g).map((part, j) => 
                              part.match(/^\([월화수목금토일]\)$/) ? <span key={j} className="text-amber-300">{part}</span> : part
                            )}
                            {i === arr.length - 1 && <span className="text-teal-500/80 text-[14px] font-normal ml-1 align-bottom leading-[1.15]">"</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : <span className="text-gray-600">-</span>}
                </td>
              );
            }
            if (col.id === 'classwork') return <td key={col.id} style={styles} className="py-3 px-4 border-r border-white/12 text-gray-200 font-normal text-[12px] whitespace-pre-wrap leading-[14px] text-left">{renderHighlightedHistoryText(log.classwork_text)}</td>;
            if (col.id === 'completed_classwork') return <td key={col.id} style={styles} className="py-3 px-4 border-r border-white/12 text-blue-300 font-normal text-[12px] whitespace-pre-wrap leading-[14px] text-left">{renderHighlightedHistoryText(log.completed_classwork_text)}</td>;
            if (col.id === 'assign') return <td key={col.id} style={styles} className="py-3 px-4 border-r border-white/12 text-gray-200 font-normal text-[12px] whitespace-pre-wrap leading-[14px] text-left">{renderHighlightedHistoryText(log.homework_text)}</td>;
            if (col.id === 'mission') return <td key={col.id} style={styles} className="py-3 px-4 border-r border-white/12 text-amber-200/90 font-normal text-[12px] whitespace-pre-wrap leading-[14px] text-left">{renderHighlightedHistoryText(log.mission)}</td>;
            if (col.id === 'next_quiz') return <td key={col.id} style={styles} className="py-3 px-3 border-r border-white/12 text-gray-400 italic text-[11px] whitespace-pre-wrap leading-tight text-left">{log.next_quiz_text}</td>;
            if (col.id === 'notes') return <td key={col.id} style={styles} className="py-3 px-3 border-r border-white/12 text-amber-200/50 italic text-[10px] truncate text-left">{log.special_notes}</td>;
            if (col.id === 'action') return <td key={col.id} style={styles} className="py-3 sticky right-0 bg-[#050505] z-20 border-l border-white/10" />;
            return <td key={col.id} style={styles}></td>;
          })}
        </tr>
        );
      })}
    </>
  );
});

// 💡 [추가] 관리 주의점 변경이력 타임라인 컴포넌트
const ManagementLogsTimeline = React.memo(function ManagementLogsTimeline({ student }: { student: Student }) {
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

  return (
    <div className="mt-4">
      <div className="text-[9px] font-black text-amber-500/80 tracking-wider uppercase mb-1.5 flex items-center gap-1">
        ⚠️ 관리 주의점 히스토리
      </div>
      {isLoading ? (
        <div className="text-[9px] text-gray-600 italic px-1">이력 로딩 중...</div>
      ) : logs.length > 0 ? (
        <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto custom-scrollbar-v pr-0.5 select-text">
          {logs.map((log: any) => (
            <div 
              key={log.id} 
              className="px-2 py-1.5 bg-amber-500/5 border border-amber-500/10 rounded-[4px] text-[10px] leading-relaxed text-gray-200"
            >
              <div className="flex justify-between text-[8px] text-amber-500/60 font-bold uppercase tracking-tighter mb-0.5 select-none">
                <span>{log.ams_teachers?.name || '시스템'}</span>
                <span>{log.created_at.slice(0, 10).replace(/-/g, '.')}</span>
              </div>
              <p className="whitespace-pre-wrap break-all text-gray-300 font-medium">{log.notes}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[9.5px] text-gray-600 italic px-1">등록된 주의점 이력 없음</div>
      )}
    </div>
  );
});
