'use client';

import React from 'react';
import { Student } from '@/types/dashboard';
import { getDayOfWeek } from '@/lib/utils';

interface HistoryRowsProps {
  student: Student;
  activeColumns: any[];
  colWidths: Record<string, number>;
  isExpanded: boolean;
  selectedDate: string;
}

export const HistoryRows = React.memo(function HistoryRows({ student, activeColumns, colWidths, isExpanded, selectedDate }: HistoryRowsProps) {
  if (!isExpanded || !student.allLogs) return null;
  const pastLogs = student.allLogs.filter((l: any) => l.date < selectedDate).sort((a: any, b: any) => b.date.localeCompare(a.date));
  const history = pastLogs.slice(0, 3); 

  return (
    <>
      {history.map((log: any, idx: number) => (
        <tr key={`${student.id}-hist-${idx}`} className="bg-white/[0.01] border-b border-white/10 transition-colors hover:bg-white/[0.03] align-middle text-[11px]">
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
            if (col.id === 'date') return <td key={col.id} style={styles} className="py-3 px-3 border-r border-white/12 text-gray-400 text-[10px] font-black text-center">{log.date.slice(5).replace('-', '.')}</td>;
            if (col.id === 'name') return <td key={col.id} style={styles} className="py-3 px-3 border-r border-white/12 opacity-30 italic text-gray-600">-</td>;
            if (col.id === 'tools') return <td key={col.id} style={styles} className="border-r border-white/12 opacity-30 italic text-gray-600 text-center">-</td>;
            if (col.id === 'attendance') {
              const status = log.attendance_status || '출석';
              const colorClass = status.startsWith('출석') ? 'text-emerald-400' : status.startsWith('결석') ? 'text-red-400' : 'text-amber-400';
              return <td key={col.id} style={styles} className={`py-3 px-3 border-r border-white/12 text-left font-black text-[11px] ${colorClass}`}>{status}</td>;
            }
            if (col.id === 'test_id') return <td key={col.id} style={styles} className="py-3 px-3 border-r border-white/12 text-gray-300 font-bold text-[11px] truncate text-left">{log.test_id}</td>;
            if (col.id === 'test_score') return <td key={col.id} style={styles} className="py-3 px-3 border-r border-white/12 text-left text-blue-400 font-black text-[12px]">{log.test_score ? `${log.test_score}%` : '-'}</td>;
            if (col.id === 'review') {
              const prevLog = pastLogs[idx + 1];
              const prevHw = prevLog?.homework_text;
              const prevDateStr = prevLog?.date ? `${prevLog.date.slice(5).replace('-', '.')} (${getDayOfWeek(prevLog.date)})` : '';
              return (
                <td key={col.id} style={styles} className="py-3 px-3 border-r border-white/12 text-teal-200 italic text-[11px] whitespace-pre-wrap leading-[1.15] text-left">
                  {prevHw ? (
                    <div className="flex flex-col text-teal-200 italic text-[11px] whitespace-pre-wrap leading-[1.15] text-left break-all">
                      <span className="text-teal-200 text-[9.5px] font-medium not-italic block mb-0.5 tracking-wider">[{prevDateStr}]</span>
                      <div className="text-teal-200 italic text-[11px] whitespace-pre-wrap leading-[1.15] text-left break-all">
                        {prevHw.split(/\n\s*\n/).map((para: string, i: number, arr: string[]) => (
                          <span key={i} className={`block ${i !== arr.length - 1 ? 'mb-1.5' : ''}`}>
                            {i === 0 && <span className="text-teal-500/80 text-[14px] font-normal mr-1 align-top leading-[1.15]">"</span>}
                            {para}
                            {i === arr.length - 1 && <span className="text-teal-500/80 text-[14px] font-normal ml-1 align-bottom leading-[1.15]">"</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : <span className="text-gray-600">-</span>}
                </td>
              );
            }
            if (col.id === 'classwork') return <td key={col.id} style={styles} className="py-3 px-4 border-r border-white/12 text-gray-200 font-medium text-[11px] whitespace-pre-wrap leading-relaxed text-left">{log.classwork_text || '-'}</td>;
            if (col.id === 'completed_classwork') return <td key={col.id} style={styles} className="py-3 px-4 border-r border-white/12 text-blue-300 font-medium text-[11px] whitespace-pre-wrap leading-relaxed text-left">{log.completed_classwork_text || '-'}</td>;
            if (col.id === 'assign') return <td key={col.id} style={styles} className="py-3 px-4 border-r border-white/12 text-gray-200 font-medium text-[11px] whitespace-pre-wrap leading-relaxed text-left">{log.homework_text || '-'}</td>;
            if (col.id === 'mission') return <td key={col.id} style={styles} className="py-3 px-4 border-r border-white/12 text-fuchsia-300 font-medium text-[11px] whitespace-pre-wrap leading-relaxed text-left">{log.mission || '-'}</td>;
            if (col.id === 'next_quiz') return <td key={col.id} style={styles} className="py-3 px-3 border-r border-white/12 text-gray-400 italic text-[11px] whitespace-pre-wrap leading-tight text-left">{log.next_quiz_text} {log.next_quiz_cut !== undefined ? `(Cut: ${log.next_quiz_cut})` : ''}</td>;
            if (col.id === 'notes') return <td key={col.id} style={styles} className="py-3 px-3 border-r border-white/12 text-amber-200/50 italic text-[10px] truncate text-left">{log.special_notes}</td>;
            if (col.id === 'action') return <td key={col.id} style={styles} className="py-3 sticky right-0 bg-[#050505] z-20 border-l border-white/10" />;
            return <td key={col.id} style={styles}></td>;
          })}
        </tr>
      ))}
    </>
  );
});
