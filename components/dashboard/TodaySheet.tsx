'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Loader2, Settings2, Check, 
  Calendar as CalendarIcon, History as HistoryIcon, 
  LayoutGrid, Table as TableIcon, Share2, Percent
} from 'lucide-react';
import { TodaySheetRow, HistoryRows } from './TodaySheetRow';
import ReportPreview from './ReportPreview';

interface ColumnConfig {
  id: string;
  label: string;
  minWidth: number;
  isSticky?: boolean;
  canHide?: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'date', label: '날짜', minWidth: 50, canHide: true },
  { id: 'name', label: '이름', minWidth: 120, isSticky: true, canHide: false },
  { id: 'attendance', label: '출결', minWidth: 60, canHide: true },
  { id: 'test_id', label: '테스트명', minWidth: 140, canHide: true },
  { id: 'test_score', label: '점수', minWidth: 60, canHide: true },
  { id: 'next_quiz', label: '예정 테스트', minWidth: 200, canHide: true },
  { id: 'review', label: '과제확인', minWidth: 180, canHide: true },
  { id: 'classwork', label: '오늘진도', minWidth: 220, canHide: false },
  { id: 'assign', label: '오늘숙제', minWidth: 220, canHide: false },
  { id: 'notes', label: '특이사항', minWidth: 160, canHide: true },
  { id: 'action', label: '저장', minWidth: 60, isSticky: true, canHide: false }
];

// --- Sub-components ---

function TodaySheetHeader({ colWidths, activeColumns, onMouseDown, onBatchQuizCut }: any) {
  return (
    <tr className="bg-black border-b border-white/20 select-none">
      {activeColumns.map((col: any) => {
        const isStickyHorizontally = col.id === 'name' || col.id === 'action';
        const styles: React.CSSProperties = {
          width: colWidths[col.id] || col.minWidth,
          minWidth: colWidths[col.id] || col.minWidth,
          position: 'sticky',
          top: 0,
          left: col.id === 'name' ? 0 : 'auto',
          right: col.id === 'action' ? 0 : 'auto',
          zIndex: isStickyHorizontally ? 50 : 40,
          backgroundColor: '#000000',
        };
        return (
          <th key={col.id} style={styles} className="py-3 px-3 text-[11px] font-black uppercase tracking-widest text-gray-400 text-center border-r border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.1)]">
            <div className="flex items-center justify-center group relative gap-1.5">
              {col.label}
              
              {col.id === 'next_quiz' && onBatchQuizCut && (
                <div className="relative group/batch" title="모든 학생 커트라인 일괄 설정">
                  <select 
                    onChange={(e) => onBatchQuizCut(parseInt(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    defaultValue=""
                  >
                    <option value="" disabled>전체 설정</option>
                    {[...Array(11)].map((_, i) => <option key={i} value={i} className="bg-[#121212]">{i}개</option>)}
                  </select>
                  <div className="flex items-center gap-1 bg-indigo-500/20 hover:bg-indigo-500 hover:text-white px-1.5 py-0.5 rounded-[2px] border border-indigo-500/30 transition-all cursor-pointer">
                    <span className="text-[7px] font-black tracking-tighter">SET ALL</span>
                    <Percent size={8} strokeWidth={4} />
                  </div>
                </div>
              )}

              <div 
                onMouseDown={(e) => onMouseDown(e, col.id)}
                className="absolute right-[-12px] w-1.5 h-5 cursor-col-resize hover:bg-blue-500/50 rounded transition-colors opacity-0 group-hover:opacity-100" 
              />
            </div>
          </th>
        );
      })}
    </tr>
  );
}

// --- Main Component ---

export default function TodaySheet({ students, masterTextbooks, onSave, selectedDate, onDateChange, onViewProgress, academyInfo, currentUser }: any) {
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const defaultWidths = Object.fromEntries(DEFAULT_COLUMNS.map(col => [col.id, col.minWidth]));
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('todaySheetColWidths');
      if (saved) { try { const parsed = JSON.parse(saved); return { ...defaultWidths, ...parsed }; } catch (e) { console.error(e); } }
    }
    return defaultWidths;
  });
  
  const defaultCols = DEFAULT_COLUMNS.map(c => c.id);
  const [presets, setPresets] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`todaySheetPresets_${currentUser?.id || 'default'}`);
      if (saved) return JSON.parse(saved);
    }
    return { 
      '1': ['name', 'review', 'classwork', 'assign', 'action'],
      '2': ['name', 'test_id', 'test_score', 'notes', 'action'],
      '3': ['name', 'next_quiz', 'action'],
      '4': defaultCols
    };
  });

  const [activeSet, setActiveSet] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(`todaySheetActiveSet_${currentUser?.id || 'default'}`) || '1';
    return '1';
  });

  const visibleColumns = useMemo(() => presets[activeSet] || defaultCols, [presets, activeSet]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, number>>({});
  const [isSendingReport, setIsSendingReport] = useState<string | null>(null);
  const [isReportVisible, setIsReportVisible] = useState(false);

  const toggleHistory = (studentId: string) => { setExpandedHistory(prev => ({ ...prev, [studentId]: prev[studentId] ? 0 : 3 })); };

  const resizingCol = useRef<{ id: string; startX: number; startWidth: number } | null>(null);
  const onMouseDown = (e: React.MouseEvent, colId: string) => {
    resizingCol.current = { id: colId, startX: e.pageX, startWidth: colWidths[colId] || 100 };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!resizingCol.current) return;
    const { id, startX, startWidth } = resizingCol.current;
    const newWidth = Math.max(40, startWidth + (e.pageX - startX));
    setColWidths(prev => ({ ...prev, [id]: newWidth }));
  };
  const onMouseUp = () => {
    if (resizingCol.current) { setColWidths(latest => { localStorage.setItem('todaySheetColWidths', JSON.stringify(latest)); return latest; }); }
    resizingCol.current = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'default';
  };

  const activeColumns = useMemo(() => DEFAULT_COLUMNS.filter(col => visibleColumns.includes(col.id)), [visibleColumns]);
  const totalWidth = useMemo(() => activeColumns.reduce((acc, col) => acc + (colWidths[col.id] || col.minWidth), 0), [activeColumns, colWidths]);

  const toggleColumn = (id: string) => {
    const currentCols = presets[activeSet] || defaultCols;
    const newCols = currentCols.includes(id) 
      ? currentCols.filter(c => c !== id) 
      : [...currentCols, id];
    
    const newPresets = { ...presets, [activeSet]: newCols };
    setPresets(newPresets);
    localStorage.setItem(`todaySheetPresets_${currentUser?.id || 'default'}`, JSON.stringify(newPresets));
  };

  const handleSetSwitch = (setId: string) => {
    setActiveSet(setId);
    localStorage.setItem(`todaySheetActiveSet_${currentUser?.id || 'default'}`, setId);
  };

  const handleSendIndividual = async (studentId: string) => {
    const student = students.find((s: any) => s.id === studentId);
    if (!student || !student.todaySession) return;

    setIsSendingReport(studentId);
    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: student.name,
          phone: student.phone,
          sessionData: student.todaySession,
          academyName: academyInfo?.academy_name
        }),
      });

      const result = await response.json();
      if (result.success) {
        await onSave(studentId, { 
          ...student.todaySession, 
          report_sent_at: new Date().toISOString() 
        });
        alert(`${student.name} 학생의 리포트가 전송되었습니다.`);
      } else {
        alert('발송 실패: ' + result.error);
      }
    } catch (e) {
      console.error(e);
      alert('전송 중 오류가 발생했습니다.');
    } finally {
      setIsSendingReport(null);
    }
  };

  const handleSendAll = async () => {
    const unsent = students.filter((s: any) => {
      const hasData = s.todaySession && (s.todaySession.classwork_text || s.todaySession.homework_text || s.todaySession.test_id);
      return hasData && !s.todaySession.report_sent_at;
    });

    if (unsent.length === 0) return alert('전송할 새 리포트가 없습니다.');
    if (!confirm(`${unsent.length}명의 학부모님께 일괄 전송하시겠습니까?`)) return;

    setIsSendingReport('all');
    let successCount = 0;

    for (const student of unsent) {
      try {
        const response = await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentName: student.name,
            phone: student.phone,
            sessionData: student.todaySession,
            academyName: academyInfo?.academy_name
          }),
        });

        const result = await response.json();
        if (result.success) {
          await onSave(student.id, { 
            ...student.todaySession, 
            report_sent_at: new Date().toISOString() 
          });
          successCount++;
        }
      } catch (e) {
        console.error(`${student.name} 전송 실패:`, e);
      }
    }

    alert(`${successCount}명의 리포트 전송이 완료되었습니다.`);
    setIsSendingReport(null);
  };

  const handleBatchQuizCut = async (cut: number) => {
    const activeStudents = students.filter((s: any) => !s.is_deleted);
    if (activeStudents.length === 0) return;
    if (!confirm(`현재 목록의 ${activeStudents.length}명 학생 모두 커트라인을 ${cut}개로 변경하시겠습니까?`)) return;

    setIsSendingReport('batch-cut');
    try {
      await Promise.all(activeStudents.map((s: any) => 
        onSave(s.id, { 
          ...s.todaySession,
          next_quiz_cut: cut 
        })
      ));
      alert(`모든 학생의 커트라인이 ${cut}개로 변경되었습니다.`);
    } catch (e) {
      console.error(e);
      alert('일괄 변경 중 오류가 발생했습니다.');
    } finally {
      setIsSendingReport(null);
    }
  };

  const gradeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    const grades = ['초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
    grades.forEach(g => stats[g] = 0);
    students.forEach((s: any) => {
      const g = s.grade || '';
      if (stats[g] !== undefined) stats[g]++;
    });
    return stats;
  }, [students]);

  return (
    <div className="p-3 space-y-4 relative flex flex-col h-full overflow-hidden bg-[#050505] text-center">
      {/* 1. 상단 컨트롤 바 */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/50 border border-white/10 rounded-lg shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-0.5 items-start">
            <h3 className="text-[13px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-2.5">
              <TableIcon size={16} /> Daily Sheet
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] text-gray-500 uppercase font-black tracking-tighter mr-1">{students.length} Total</span>
              {Object.entries(gradeStats).filter(([_, count]) => count > 0).map(([grade, count]) => {
                const isES = grade.includes('초');
                const isMS = grade.includes('중');
                const isHS = grade.includes('고');
                const colorClass = isES ? 'text-emerald-500/80' : isHS ? 'text-amber-500/80' : 'text-blue-500/80';
                
                return (
                  <div key={grade} className="flex items-center gap-1 bg-white/[0.03] border border-white/5 px-1.5 py-0.5 rounded-[2px]">
                    <span className="text-[8px] font-bold text-gray-600 uppercase">{grade}</span>
                    <span className={`text-[8px] font-black ${colorClass}`}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-center">
          <div onClick={(e) => { const input = e.currentTarget.querySelector('input'); if (input && 'showPicker' in input) try { (input as any).showPicker(); } catch (err) { console.error(err); } }}
            className="flex items-center gap-2 bg-black border border-white/20 rounded-[6px] px-4 py-2 text-gray-400 hover:text-white transition-all group cursor-pointer shadow-xl">
            <CalendarIcon size={16} className="group-hover:text-blue-500" />
            <input type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} className="bg-transparent text-[12px] font-black uppercase outline-none cursor-pointer [color-scheme:dark]" />
          </div>

          <button 
            onClick={() => setIsReportVisible(!isReportVisible)}
            className={`flex items-center gap-2 px-5 py-2 rounded-[6px] text-[11px] font-black uppercase tracking-widest transition-all border shadow-xl ${
              isReportVisible 
                ? 'bg-blue-600 border-blue-500 text-white shadow-blue-900/30' 
                : 'bg-black border-white/20 text-gray-400 hover:text-white'
            }`}
          >
            <LayoutGrid size={16} /> {isReportVisible ? '리포트 닫기' : '리포트 미리보기'}
          </button>

          <button onClick={handleSendAll} disabled={isSendingReport === 'all'}
            className="flex items-center gap-2 px-6 py-2 bg-amber-500 text-black text-[11px] font-black uppercase tracking-widest rounded-[6px] hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/30 disabled:opacity-50">
            {isSendingReport === 'all' ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} 일괄 발송
          </button>

          <div className="relative">
            <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className={`p-3 rounded-[6px] transition-all border shadow-xl ${isSettingsOpen ? 'bg-blue-600 border-blue-500 text-white' : 'bg-black border-white/20 text-gray-500 hover:text-white'}`}><Settings2 size={18} /></button>
            <AnimatePresence>
              {isSettingsOpen && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-3 w-64 bg-[#121212] border border-white/15 rounded-[6px] shadow-2xl p-3 z-[60]">
                  <div className="border-b border-white/10 pb-3 mb-3">
                    <h4 className="text-[10px] font-black uppercase text-gray-500 mb-2 px-1 tracking-[0.2em]">Select Set to Edit</h4>
                    <div className="flex gap-1">
                      {['1', '2', '3', '4'].map(setId => (
                        <button key={setId} onClick={() => handleSetSwitch(setId)}
                          className={`flex-1 py-1.5 rounded-[2px] text-[10px] font-black transition-all ${activeSet === setId ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-600 hover:bg-white/10'}`}>
                          SET {setId}
                        </button>
                      ))}
                    </div>
                  </div>

                  <h4 className="text-[10px] font-black uppercase text-gray-500 mb-2 px-1 tracking-[0.2em]">Visible Columns</h4>
                  <div className="space-y-0.5 max-h-[300px] overflow-y-auto custom-scrollbar-v pt-1">
                    {DEFAULT_COLUMNS.filter(c => c.canHide).map(col => (
                      <div key={col.id} onClick={() => toggleColumn(col.id)} className={`flex items-center justify-between px-3 py-2.5 rounded-md transition-all cursor-pointer group ${visibleColumns.includes(col.id) ? 'bg-blue-600/20' : 'hover:bg-white/5'}`}>
                        <span className={`text-[12px] font-bold ${visibleColumns.includes(col.id) ? 'text-blue-400' : 'text-gray-500'}`}>{col.label}</span>
                        {visibleColumns.includes(col.id) && <Check size={16} className="text-blue-500" />}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 2. TOP 섹션 (Data Entry Table) */}
      <div className={`bg-black border border-white/20 rounded-lg shadow-2xl custom-scrollbar-h overflow-x-auto overflow-y-auto transition-all duration-500 ${isReportVisible ? 'max-h-[35vh] shrink-0' : 'flex-1 min-h-0'}`}>
        <table style={{ width: totalWidth, minWidth: '100%' }} className="border-collapse table-fixed text-xs text-center">
          <thead><TodaySheetHeader colWidths={colWidths} activeColumns={activeColumns} onMouseDown={onMouseDown} onBatchQuizCut={handleBatchQuizCut} /></thead>
          <tbody className="divide-y divide-white/10">
            {students.map((s: any, idx: number) => (
              <React.Fragment key={`${s.id}-${idx}`}>
                <TodaySheetRow student={s} masterTextbooks={masterTextbooks} onSave={onSave} onViewProgress={onViewProgress} colWidths={colWidths} activeColumns={activeColumns} selectedDate={selectedDate} isHistoryExpanded={!!expandedHistory[s.id]} onToggleHistory={toggleHistory} currentUser={currentUser} />
                <HistoryRows student={s} activeColumns={activeColumns} colWidths={colWidths} isExpanded={!!expandedHistory[s.id]} />
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. BTM 섹션 (Report Preview Cards) */}
      <AnimatePresence>
        {isReportVisible && (
          <ReportPreview 
            students={students}
            selectedDate={selectedDate}
            academyInfo={academyInfo}
            isSendingReport={isSendingReport}
            handleSendIndividual={handleSendIndividual}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
