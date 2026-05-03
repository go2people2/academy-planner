'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, CheckCircle, Wand2, Settings2, Check, ClipboardList, Calendar as CalendarIcon, History as HistoryIcon, TrendingUp } from 'lucide-react';
import { HomeworkItem } from '@/types/dashboard';
import HomeworkEditor from './HomeworkEditor';
import TestAnswerModal from './TestAnswerModal';

interface ColumnConfig {
  id: string;
  label: string;
  minWidth: number;
  isSticky?: boolean;
  canHide?: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'date', label: 'Date', minWidth: 45, canHide: true },
  { id: 'name', label: 'Student', minWidth: 100, isSticky: true, canHide: false },
  { id: 'attendance', label: 'Att', minWidth: 45, canHide: true },
  { id: 'test_id', label: 'Test ID', minWidth: 100, canHide: true },
  { id: 'test_score', label: 'Score', minWidth: 60, canHide: true },
  { id: 'review', label: 'Review', minWidth: 150, canHide: true },
  { id: 'assign', label: 'Assign', minWidth: 200, canHide: false },
  { id: 'notes', label: 'Notes', minWidth: 150, canHide: true },
  { id: 'action', label: 'Action', minWidth: 50, isSticky: true, canHide: false }
];

function TodaySheetHeader({ colWidths, activeColumns, onMouseDown }: any) {
  return (
    <tr className="bg-white/[0.03] border-b border-white/10 select-none">
      {activeColumns.map((col: any) => {
        const styles: React.CSSProperties = {
          width: colWidths[col.id] || col.minWidth,
          minWidth: colWidths[col.id] || col.minWidth,
          position: col.isSticky ? 'sticky' : 'relative',
          left: col.id === 'name' ? 0 : 'auto',
          right: col.id === 'action' ? 0 : 'auto',
          zIndex: col.isSticky ? 30 : 1,
        };
        return (
          <th key={col.id} style={styles} className="py-2 px-3 text-[9px] font-black uppercase tracking-widest text-gray-500 text-left border-r border-white/5 bg-[#0a0a0a]">
            <div className="flex items-center justify-between group">
              {col.label}
              <div 
                onMouseDown={(e) => onMouseDown(e, col.id)}
                className="w-1 h-4 cursor-col-resize hover:bg-blue-500/50 rounded transition-colors opacity-0 group-hover:opacity-100" 
              />
            </div>
          </th>
        );
      })}
    </tr>
  );
}

function HistoryRows({ student, activeColumns, colWidths, isExpanded }: any) {
  if (!isExpanded || !student.allLogs) return null;
  const history = student.allLogs.slice(1, 4); 

  return history.map((log: any, idx: number) => (
    <tr key={`${student.id}-hist-${idx}`} className="bg-white/[0.01] border-b border-white/[0.02] transition-colors hover:bg-white/[0.03] align-middle text-[10px]">
      {activeColumns.map((col: any) => {
        const styles = { width: colWidths[col.id] || col.minWidth, minWidth: colWidths[col.id] || col.minWidth, left: col.id === 'name' ? 0 : 'auto', position: (col.isSticky ? 'sticky' : 'relative') as any, zIndex: 10, backgroundColor: '#0a0a0a' };
        if (col.id === 'date') return <td key={col.id} style={styles} className="py-1 px-3 border-r border-white/5 text-gray-700 text-[8px] font-bold">{log.date.slice(5).replace('-', '.')}</td>;
        if (col.id === 'name') return <td key={col.id} style={styles} className="py-1 px-3 border-r border-white/10 opacity-30 italic text-gray-600">-</td>;
        if (col.id === 'attendance') return <td key={col.id} style={styles} className="py-1 px-2 border-r border-white/5 text-center text-gray-600 font-medium">{log.attendance_status}</td>;
        if (col.id === 'test_id') return <td key={col.id} style={styles} className="py-1 px-2 border-r border-white/5 text-gray-600 truncate">{log.test_id}</td>;
        if (col.id === 'test_score') return <td key={col.id} style={styles} className="py-1 px-2 border-r border-white/5 text-center text-gray-600 font-bold">{log.test_score}</td>;
        if (col.id === 'review') return <td key={col.id} style={styles} className="py-1 px-2 border-r border-white/5 text-gray-500 italic truncate bg-[#0a0a0a]">Prev: {log.status}</td>;
        if (col.id === 'assign') return <td key={col.id} style={styles} className="py-1 px-2 border-r border-white/5 text-gray-500 italic truncate whitespace-pre-wrap leading-tight">{log.homework_text}</td>;
        if (col.id === 'notes') return <td key={col.id} style={styles} className="py-1 px-2 border-r border-white/5 text-gray-600 italic truncate">{log.special_notes}</td>;
        if (col.id === 'action') return <td key={col.id} style={styles} className="py-1 sticky right-0 bg-[#0a0a0a] z-20 border-l border-white/10 text-center text-gray-700">-</td>;
        return null;
      })}
    </tr>
  ));
}

function TodaySheetRow({ student, masterTextbooks, onSave, onViewProgress, colWidths, activeColumns, selectedDate, isHistoryExpanded, onToggleHistory }: any) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [rowDate, setRowDate] = useState(selectedDate);

  const getInitialFormData = (date: string) => {
    const session = (student.allLogs || []).find((l: any) => l.date === date);
    const initialHwJson = session?.homework_json?.length 
      ? session.homework_json 
      : (student.assigned_books || []).map((b:any) => ({ type: 'book', book_name: b, range: '', units: [] }));

    return {
      attendance_status: session?.attendance_status || '출석',
      status: session?.status || 'none',
      special_notes: session?.special_notes || '',
      homework_text: session?.homework_text || '',
      homework_json: initialHwJson,
      test_id: session?.test_id || ''
    };
  };

  const [formData, setFormData] = useState<any>(() => getInitialFormData(selectedDate));

  useEffect(() => {
    setRowDate(selectedDate);
    setFormData(getInitialFormData(selectedDate));
  }, [selectedDate, student.allLogs]);

  const handleDateChange = (newDate: string) => {
    setRowDate(newDate);
    setFormData(getInitialFormData(newDate));
  };

  const handleSave = async (extraData = {}) => {
    if (isSaving) return;
    const finalData = { ...formData, ...extraData, session_date: rowDate };
    setIsSaving(true);
    const success = await onSave(student.id, finalData);
    setIsSaving(false);
    if (success) { setSaveStatus('success'); setTimeout(() => setSaveStatus('idle'), 2000); }
    else { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 2000); }
  };

  const syncHomeworkText = (newJson: HomeworkItem[]) => {
    const assignedBookTitles = newJson.map(h => {
      const bookInfo = masterTextbooks.find((m: any) => m.bookcode === h.book_name);
      return bookInfo?.title || h.book_name;
    });

    const manualNotes = (formData.homework_text || '').split('\n').filter((line: string) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return false;
      const startsWithBook = assignedBookTitles.some(title => trimmedLine.startsWith(title));
      return !startsWithBook;
    });

    const bookLines = newJson.filter(h => h.range).map(h => {
      const bookInfo = masterTextbooks.find((m: any) => m.bookcode === h.book_name);
      const title = bookInfo?.title || h.book_name;
      return `${title} ${h.range}`;
    });

    const combinedText = [...manualNotes, ...bookLines].join('\n');
    setFormData({ ...formData, homework_json: newJson, homework_text: combinedText });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleTestSave = (answers: any) => {
    handleSave({ test_answers: answers });
    setIsTestModalOpen(false);
  };

  const currentPrimaryTestId = useMemo(() => {
    if (!formData.test_id) return '';
    const lines = formData.test_id.split('\n').filter((l: string) => l.trim() !== '');
    return lines.length > 0 ? lines[0].trim() : '';
  }, [formData.test_id]);

  const displayDateShort = useMemo(() => {
    return rowDate.slice(5).replace('-', '.');
  }, [rowDate]);

  return (
    <tr className="hover:bg-white/[0.02] transition-colors group align-middle text-[11px]">
      {activeColumns.map((col: any) => {
        const styles: React.CSSProperties = {
          position: col.isSticky ? 'sticky' : 'relative',
          left: col.id === 'name' ? 0 : 'auto',
          right: col.id === 'action' ? 0 : 'auto',
          zIndex: col.isSticky ? 20 : 1,
          width: colWidths[col.id] || col.minWidth,
          minWidth: colWidths[col.id] || col.minWidth,
          backgroundColor: (col.isSticky ? '#0a0a0a' : 'transparent')
        };
        if (col.id === 'date') return (
          <td key={col.id} style={styles} className="py-1.5 px-3 border-r border-white/5 font-black text-gray-600 text-[8px] tabular-nums">
            <div className="flex flex-col gap-1">
              {displayDateShort}
              <button onClick={() => onToggleHistory(student.id)} className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${isHistoryExpanded ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}><HistoryIcon size={10} /></button>
            </div>
          </td>
        );
        if (col.id === 'name') return (
          <td key={col.id} style={styles} className="py-1.5 px-3 sticky left-0 bg-[#0a0a0a] z-20 border-r border-white/10 group-hover:bg-[#111] transition-colors">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col min-w-0 overflow-hidden">
                <span className="font-black text-white text-[12px] tracking-tight truncate">{student.name}</span>
                <span className="text-[8px] font-bold text-gray-600 uppercase tracking-tighter truncate">{student.grade} · {student.course} · {student.class}</span>
              </div>
              {onViewProgress && (
                <button 
                  onClick={() => onViewProgress(student.id)}
                  className="p-1.5 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                  title="진도표 바로가기"
                >
                  <TrendingUp size={10} />
                </button>
              )}
            </div>
          </td>
        );
        if (col.id === 'attendance') return (
          <td key={col.id} style={styles} className="py-1.5 px-1 border-r border-white/5">
            <select value={formData.attendance_status} onChange={(e) => setFormData({ ...formData, attendance_status: e.target.value })}
              className={`w-full bg-white/5 border border-white/10 rounded-[2px] px-1 py-1 text-[9px] font-bold outline-none appearance-none text-center cursor-pointer transition-colors ${formData.attendance_status === '출석' ? 'text-emerald-400' : formData.attendance_status === '결석' ? 'text-red-400' : 'text-amber-400'}`}>
              <option value="출석">출석</option><option value="결석">결석</option><option value="보강">보강</option><option value="수업취소">취소</option><option value="온라인">온라인</option>
            </select>
          </td>
        );
        if (col.id === 'test_id') return (
          <td key={col.id} style={styles} className="py-1.5 px-1 border-r border-white/5">
            <div className="flex items-start gap-1 h-full">
              <textarea rows={Math.min(3, (formData.test_id || '').split('\n').length || 1)} value={formData.test_id || ''} onChange={(e) => setFormData({ ...formData, test_id: e.target.value })} onKeyDown={handleKeyDown} placeholder="ID"
                className="flex-1 bg-white/[0.03] border border-white/10 rounded-[2px] px-1 py-0.5 text-[9px] text-center text-white focus:outline-none focus:border-blue-500 transition-all font-bold resize-none overflow-hidden min-h-[24px]" />
              <button onClick={() => setIsTestModalOpen(true)} disabled={!currentPrimaryTestId}
                className="w-5 h-6 shrink-0 rounded-[2px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed mt-0.5"><ClipboardList size={10} /></button>
            </div>
            {isTestModalOpen && (<TestAnswerModal testId={currentPrimaryTestId} studentName={student.name} onClose={() => setIsTestModalOpen(false)} onSave={handleTestSave} />)}
          </td>
        );
        if (col.id === 'test_score') return (
          <td key={col.id} style={styles} className="py-1.5 px-1 border-r border-white/5">
            <input type="text" value={formData.test_score || ''} onChange={(e) => setFormData({ ...formData, test_score: e.target.value })} onKeyDown={handleKeyDown} placeholder="-"
              className="w-full bg-white/[0.03] border border-white/10 rounded-[2px] px-1 py-1 text-[11px] text-center text-emerald-400 focus:outline-none focus:border-blue-500 transition-all font-black" />
          </td>
        );
        if (col.id === 'review') return (
          <td key={col.id} style={styles} className="py-1.5 px-2 border-r border-white/5">
            <div className="flex items-start justify-between gap-1 h-full min-h-[24px]">
              <div className="flex-1 text-[9px] text-gray-400 font-medium whitespace-pre-wrap leading-tight">{student.lastSession?.homework_text || <span className="text-gray-600 italic">None</span>}</div>
              <button onClick={() => { const seq = ['none', 'perfect', 'warning', 'late']; setFormData({ ...formData, status: seq[(seq.indexOf(formData.status) + 1) % seq.length] }); }}
                className={`w-5 h-5 rounded-[2px] flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5 ${formData.status === 'perfect' ? 'bg-emerald-500 text-white' : formData.status === 'warning' ? 'bg-amber-500 text-white' : formData.status === 'late' ? 'bg-red-500 text-white' : 'bg-white/5 text-gray-600'}`}>{formData.status === 'none' ? '-' : formData.status[0].toUpperCase()}</button>
            </div>
          </td>
        );
        if (col.id === 'assign') return (
          <td key={col.id} style={styles} className="py-1.5 px-1 border-r border-white/5">
            <div className="flex items-start gap-1 h-full">
              <textarea rows={Math.min(3, formData.homework_text.split('\n').length || 1)} value={formData.homework_text} onChange={(e) => setFormData({ ...formData, homework_text: e.target.value })} onKeyDown={handleKeyDown}
                className="flex-1 bg-white/[0.03] border border-white/10 rounded-[2px] px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-blue-500 transition-all font-medium resize-none overflow-hidden min-h-[24px]" />
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditorOpen(true);
                }} 
                className="w-6 h-6 shrink-0 rounded-[2px] bg-blue-600/20 text-blue-400 border border-blue-500/40 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center mt-0.5 shadow-sm shadow-blue-900/20"
                title="숙제 정밀 편집"
              >
                <Wand2 size={10} />
              </button>
            </div>
            {isEditorOpen && (
              <HomeworkEditor 
                homeworkJson={formData.homework_json} 
                masterTextbooks={masterTextbooks} 
                onUpdate={syncHomeworkText} 
                onClose={() => setIsEditorOpen(false)} 
              />
            )}
          </td>
        );
        if (col.id === 'notes') return (
          <td key={col.id} style={styles} className="py-1.5 px-1 border-r border-white/5">
            <textarea rows={Math.min(3, formData.special_notes.split('\n').length || 1)} value={formData.special_notes} onChange={(e) => setFormData({ ...formData, special_notes: e.target.value })} onKeyDown={handleKeyDown} placeholder="..."
              className="w-full bg-white/[0.03] border border-white/10 rounded-[2px] px-1.5 py-0.5 text-[10px] text-gray-400 focus:outline-none focus:border-blue-500 transition-all font-medium resize-none overflow-hidden min-h-[24px]" />
          </td>
        );
        if (col.id === 'action') return (
          <td key={col.id} style={styles} className="py-1.5 px-2 sticky right-0 bg-[#0a0a0a] z-20 border-l border-white/10">
            <button onClick={() => handleSave()} disabled={isSaving}
              className={`w-full h-8 rounded-[4px] flex items-center justify-center transition-all shadow-lg ${saveStatus === 'success' ? 'bg-emerald-500 text-white' : saveStatus === 'error' ? 'bg-red-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-blue-900/20'}`}>
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : saveStatus === 'success' ? <CheckCircle size={14} /> : <Send size={14} />}
            </button>
          </td>
        );
        return null;
      })}
    </tr>
  );
}

export default function TodaySheet({ students, masterTextbooks, onSave, selectedDate, onDateChange, onViewProgress }: any) {
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const defaultWidths = Object.fromEntries(DEFAULT_COLUMNS.map(col => [col.id, col.minWidth]));
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('todaySheetColWidths');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return { ...defaultWidths, ...parsed };
        } catch (e) {
          console.error('Failed to parse saved column widths', e);
        }
      }
    }
    return defaultWidths;
  });
  
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    DEFAULT_COLUMNS.map(c => c.id)
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, number>>({});

  const toggleHistory = (studentId: string) => {
    setExpandedHistory(prev => ({
      ...prev,
      [studentId]: prev[studentId] ? 0 : 3
    }));
  };

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
    const newWidth = Math.max(30, startWidth + (e.pageX - startX));
    setColWidths(prev => ({ ...prev, [id]: newWidth }));
  };

  const onMouseUp = () => {
    if (resizingCol.current) {
      setColWidths(latest => {
        localStorage.setItem('todaySheetColWidths', JSON.stringify(latest));
        return latest;
      });
    }
    resizingCol.current = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'default';
  };

  const activeColumns = useMemo(() => 
    DEFAULT_COLUMNS.filter(col => visibleColumns.includes(col.id)),
    [visibleColumns]
  );

  const totalWidth = useMemo(() => 
    activeColumns.reduce((acc, col) => acc + (colWidths[col.id] || col.minWidth), 0),
    [activeColumns, colWidths]
  );

  const toggleColumn = (id: string) => {
    setVisibleColumns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const gradeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    students.forEach((s: any) => {
      const g = s.grade || '미지정';
      stats[g] = (stats[g] || 0) + 1;
    });
    // 학년별 정렬 (초->중->고 순서 및 숫자 순)
    return Object.entries(stats).sort((a, b) => {
      const order = (name: string) => {
        if (name.includes('초')) return 10 + parseInt(name.replace(/[^0-9]/g, '') || '0');
        if (name.includes('중')) return 20 + parseInt(name.replace(/[^0-9]/g, '') || '0');
        if (name.includes('고')) return 30 + parseInt(name.replace(/[^0-9]/g, '') || '0');
        return 99;
      };
      return order(a[0]) - order(b[0]);
    });
  }, [students]);

  return (
    <div className="p-2 space-y-4 relative">
      <div className="flex items-center justify-between px-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
            <ClipboardList size={14} /> 
            Daily Learning Sheet
            <span className="ml-1 text-[9px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded-full border border-white/5 uppercase font-bold">
              {students.length} Students
            </span>
          </h3>
          {/* 💡 학년별 요약 표시 */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 ml-6">
            {gradeStats.map(([grade, count]) => (
              <div key={grade} className="flex items-center gap-1">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">{grade}</span>
                <span className="text-[10px] font-black text-blue-400/80">{count}명</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-gray-400 hover:text-white transition-all group">
            <CalendarIcon size={12} className="group-hover:text-blue-500" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer [color-scheme:dark]"
            />
          </div>

          <div className="relative">
            <button 
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`p-2 rounded-lg transition-all border ${isSettingsOpen ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/10'}`}
            >
              <Settings2 size={14} />
            </button>

            <AnimatePresence>
              {isSettingsOpen && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl p-2 z-[60]">
                  <h4 className="text-[10px] font-black uppercase text-gray-500 mb-2 px-2 tracking-widest">Columns Settings</h4>
                  <div className="space-y-0.5 max-h-[300px] overflow-y-auto custom-scrollbar-v">
                    {DEFAULT_COLUMNS.filter(c => c.canHide).map(col => (
                      <div key={col.id} onClick={() => toggleColumn(col.id)}
                        className={`flex items-center justify-between px-2 py-2 rounded-md transition-all cursor-pointer group ${visibleColumns.includes(col.id) ? 'bg-blue-600/10' : 'hover:bg-white/5'}`}>
                        <span className={`text-[11px] font-bold ${visibleColumns.includes(col.id) ? 'text-blue-400' : 'text-gray-500'}`}>{col.label}</span>
                        {visibleColumns.includes(col.id) && <Check size={12} className="text-blue-500" />}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-2xl custom-scrollbar-h overflow-x-auto">
        <table style={{ width: totalWidth, minWidth: '100%' }} className="border-collapse table-fixed">
          <thead>
            <TodaySheetHeader colWidths={colWidths} activeColumns={activeColumns} onMouseDown={onMouseDown} />
          </thead>
          <tbody className="divide-y divide-white/5">
            {students.map((s: any) => {
              const isHistoryExpanded = !!expandedHistory[s.id];
              return (
                <React.Fragment key={s.id}>
                  <TodaySheetRow 
                    student={s} 
                    masterTextbooks={masterTextbooks} 
                    onSave={onSave} 
                    onViewProgress={onViewProgress}
                    colWidths={colWidths} 
                    activeColumns={activeColumns} 
                    selectedDate={selectedDate} 
                    isHistoryExpanded={isHistoryExpanded}
                    onToggleHistory={toggleHistory}
                  />
                  <HistoryRows student={s} activeColumns={activeColumns} colWidths={colWidths} isExpanded={isHistoryExpanded} />
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
