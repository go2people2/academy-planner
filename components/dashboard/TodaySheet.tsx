'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, CheckCircle, Wand2, Settings2, Check, ClipboardList, Calendar as CalendarIcon, History as HistoryIcon } from 'lucide-react';
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
  { id: 'grade', label: 'Grade', minWidth: 45, canHide: true },
  { id: 'class', label: 'Class', minWidth: 70, canHide: true },
  { id: 'attendance', label: 'Att.', minWidth: 45, canHide: true },
  { id: 'test', label: 'Test ID', minWidth: 80, canHide: true },
  { id: 'review', label: 'Review', minWidth: 150, canHide: true },
  { id: 'assign', label: 'Homework Assignment', minWidth: 250, canHide: true }, 
  { id: 'notes', label: 'Notes', minWidth: 120, canHide: true },
  { id: 'action', label: 'Save', minWidth: 40, isSticky: true, canHide: false },
];

function HistoryPeekRow({ log, studentName, colWidths, activeColumns }: any) {
  return (
    <tr className="bg-white/[0.01] opacity-60 align-middle text-[10px] border-l-2 border-blue-500/30">
      {activeColumns.map((col: any) => {
        const styles: React.CSSProperties = {
          width: col.id === 'assign' ? 'auto' : colWidths[col.id],
          position: col.isSticky ? 'sticky' : 'relative' as any,
          left: col.id === 'name' ? 0 : 'auto',
          right: col.id === 'action' ? 0 : 'auto',
          zIndex: col.isSticky ? 20 : 1
        };

        if (col.id === 'date') return <td key={col.id} style={styles} className="py-1 px-1 text-center border-r border-white/5 font-bold tabular-nums text-blue-400/50 bg-[#0a0a0a]">{log.date.slice(5).replace('-', '.')}</td>;
        if (col.id === 'name') return <td key={col.id} style={styles} className="py-1 px-2 sticky left-0 bg-[#0a0a0a] z-20 border-r border-white/10 font-bold text-gray-500 italic">{studentName} (Hist)</td>;
        if (col.id === 'grade' || col.id === 'class') return <td key={col.id} style={styles} className="py-1 px-1 text-center border-r border-white/5 text-gray-600 bg-[#0a0a0a]">-</td>;
        if (col.id === 'attendance') return <td key={col.id} style={styles} className="py-1 px-1 text-center border-r border-white/5 text-gray-500 bg-[#0a0a0a]">{log.attendance_status}</td>;
        if (col.id === 'test') return <td key={col.id} style={styles} className="py-1 px-1 border-r border-white/5 text-gray-500 text-center truncate bg-[#0a0a0a]">{log.test_id || '-'}</td>;
        if (col.id === 'review') return <td key={col.id} style={styles} className="py-1 px-2 border-r border-white/5 text-gray-500 italic truncate bg-[#0a0a0a]">Prev: {log.status}</td>;
        if (col.id === 'assign') return <td key={col.id} style={styles} className="py-1 px-1 border-r border-white/5 text-gray-400 font-medium truncate italic bg-[#0a0a0a]">{log.homework_text || 'No homework'}</td>;
        if (col.id === 'notes') return <td key={col.id} style={styles} className="py-1 px-1 border-r border-white/5 text-gray-600 truncate bg-[#0a0a0a]">{log.special_notes}</td>;
        if (col.id === 'action') return <td key={col.id} style={styles} className="py-1 sticky right-0 bg-[#0a0a0a] z-20 border-l border-white/10 text-center text-gray-700">-</td>;
        return null;
      })}
    </tr>
  );
}

function TodaySheetRow({ student, masterTextbooks, onSave, colWidths, activeColumns, selectedDate, isHistoryExpanded, onToggleHistory }: any) {
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
    const manualNotes = (formData.homework_text || '').split('\n').filter((line: string) => {
      if (!line.trim()) return false;
      return !newJson.some(h => {
        const title = masterTextbooks.find((m:any) => m.tabName === h.book_name)?.title || h.book_name;
        return line.startsWith(`${title}:`);
      });
    });
    const bookLines = newJson.filter(h => h.range).map(h => {
      const title = masterTextbooks.find((m:any) => m.tabName === h.book_name)?.title || h.book_name;
      return `${title}: ${h.range}`;
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
        if (col.id === 'date') return (
          <td key={col.id} className="py-1.5 px-1 text-center border-r border-white/5 font-bold tabular-nums truncate relative group/date" style={{ width: colWidths.date }}>
            <span className="opacity-40 group-hover/date:opacity-0 transition-opacity">{displayDateShort}</span>
            <input 
              type="date" 
              value={rowDate} 
              onChange={(e) => handleDateChange(e.target.value)}
              className="absolute inset-0 opacity-0 group-hover/date:opacity-100 bg-[#1a1a1a] text-blue-500 cursor-pointer outline-none [color-scheme:dark] px-1 text-[9px] transition-opacity"
            />
          </td>
        );
        if (col.id === 'name') return (
          <td key={col.id} className="py-1.5 px-2 sticky left-0 bg-[#0f0f0f] z-10 border-r border-white/10 font-bold text-white group-hover:bg-[#151515] h-full align-middle" style={{ width: colWidths.name }}>
            <div className="flex items-center justify-between gap-1 overflow-hidden">
              <span className="truncate flex-1">{student.name}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); onToggleHistory(); }}
                className={`p-1 rounded-sm transition-all ${isHistoryExpanded ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-600 hover:text-white'}`}
                title="지난 수업 기록 보기"
              >
                <HistoryIcon size={10} />
              </button>
            </div>
          </td>
        );
        if (col.id === 'grade') return (
          <td key={col.id} className="py-1.5 px-1 text-[10px] text-gray-500 text-center font-bold border-r border-white/5 truncate" style={{ width: colWidths.grade }}>
            {student.grade}
          </td>
        );
        if (col.id === 'class') return (
          <td key={col.id} className="py-1.5 px-1 text-[10px] text-gray-400 text-center border-r border-white/5 truncate" style={{ width: colWidths.class }}>
            {student.class}
          </td>
        );
        if (col.id === 'attendance') return (
          <td key={col.id} className="py-1.5 px-1 text-center border-r border-white/5" style={{ width: colWidths.attendance }}>
            <button onClick={() => setFormData({ ...formData, attendance_status: formData.attendance_status === '출석' ? '결석' : formData.attendance_status === '결석' ? '지각' : '출석' })}
              className={`w-full py-0.5 rounded-[2px] text-[8px] font-black border transition-all ${formData.attendance_status === '출석' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : formData.attendance_status === '결석' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>{formData.attendance_status}</button>
          </td>
        );
        if (col.id === 'test') return (
          <td key={col.id} className="py-1.5 px-1 border-r border-white/5" style={{ width: colWidths.test }}>
            <div className="flex items-start gap-1 h-full">
              <textarea rows={Math.min(3, formData.test_id.split('\n').length || 1)} value={formData.test_id || ''} onChange={(e) => setFormData({ ...formData, test_id: e.target.value })} onKeyDown={handleKeyDown} placeholder="ID"
                className="flex-1 bg-white/[0.03] border border-white/10 rounded-[2px] px-1 py-0.5 text-[9px] text-center text-white focus:outline-none focus:border-blue-500 transition-all font-bold resize-none overflow-hidden min-h-[24px]" />
              <button onClick={() => setIsTestModalOpen(true)} disabled={!currentPrimaryTestId}
                className="w-5 h-6 shrink-0 rounded-[2px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed mt-0.5"><ClipboardList size={10} /></button>
            </div>
            {isTestModalOpen && (<TestAnswerModal testId={currentPrimaryTestId} studentName={student.name} onClose={() => setIsTestModalOpen(false)} onSave={handleTestSave} />)}
          </td>
        );
        if (col.id === 'review') return (
          <td key={col.id} className="py-1.5 px-2 border-r border-white/5" style={{ width: colWidths.review }}>
            <div className="flex items-center justify-between gap-1 overflow-hidden h-full">
              <div className="flex-1 truncate text-[9px] text-gray-400 font-medium">{student.lastSession?.homework_text || <span className="text-gray-600 italic">None</span>}</div>
              <button onClick={() => { const seq = ['none', 'perfect', 'warning', 'late']; setFormData({ ...formData, status: seq[(seq.indexOf(formData.status) + 1) % seq.length] }); }}
                className={`w-5 h-5 rounded-[2px] flex items-center justify-center text-[9px] font-black shrink-0 ${formData.status === 'perfect' ? 'bg-emerald-500 text-white' : formData.status === 'warning' ? 'bg-amber-500 text-white' : formData.status === 'late' ? 'bg-red-500 text-white' : 'bg-white/5 text-gray-600'}`}>{formData.status === 'none' ? '-' : formData.status[0].toUpperCase()}</button>
            </div>
          </td>
        );
        if (col.id === 'assign') return (
          <td key={col.id} className="py-1.5 px-1 border-r border-white/5" style={{ width: col.id === 'assign' ? 'auto' : colWidths[col.id] }}>
            <div className="flex items-start gap-1 h-full">
              <textarea rows={Math.min(3, formData.homework_text.split('\n').length || 1)} value={formData.homework_text} onChange={(e) => setFormData({ ...formData, homework_text: e.target.value })} onKeyDown={handleKeyDown}
                className="flex-1 bg-white/[0.03] border border-white/10 rounded-[2px] px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-blue-500 transition-all font-medium resize-none overflow-hidden min-h-[24px]" />
              <button onClick={() => setIsEditorOpen(true)} className="w-6 h-6 shrink-0 rounded-[2px] bg-blue-600/10 text-blue-500 border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center mt-0.5"><Wand2 size={10} /></button>
            </div>
            <AnimatePresence>{isEditorOpen && (<HomeworkEditor homeworkJson={formData.homework_json} masterTextbooks={masterTextbooks} onUpdate={syncHomeworkText} onClose={() => setIsEditorOpen(false)} />)}</AnimatePresence>
          </td>
        );
        if (col.id === 'notes') return (
          <td key={col.id} className="py-1.5 px-1 border-r border-white/5" style={{ width: colWidths.notes }}>
            <textarea rows={Math.min(3, (formData.special_notes || '').split('\n').length || 1)} value={formData.special_notes || ''} onChange={(e) => setFormData({ ...formData, special_notes: e.target.value })} onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-b border-transparent focus:border-blue-500/50 px-1 py-0 text-[10px] text-gray-400 outline-none resize-none overflow-hidden min-h-[24px]" />
          </td>
        );
        if (col.id === 'action') return (
          <td key={col.id} className="px-1 sticky right-0 bg-[#0f0f0f] z-10 border-l border-white/10 text-center" style={{ width: colWidths.action }}>
            <button onClick={() => handleSave()} disabled={isSaving} className={`w-6 h-6 rounded-[2px] transition-all flex items-center justify-center mx-auto ${saveStatus === 'success' ? 'bg-emerald-500 text-white' : saveStatus === 'error' ? 'bg-red-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
              {isSaving ? <Loader2 className="animate-spin" size={10} /> : saveStatus === 'success' ? <CheckCircle size={10} /> : <Send size={10} />}
            </button>
          </td>
        );
        return null;
      })}
    </tr>
  );
}

export default function TodaySheet({ students, masterTextbooks, onSave, selectedDate, onDateChange }: any) {
  const [colWidths, setColWidths] = useState<Record<string, number>>(
    Object.fromEntries(DEFAULT_COLUMNS.map(col => [col.id, col.minWidth]))
  );
  
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
    resizingCol.current = { id: colId, startX: e.pageX, startWidth: colWidths[colId] };
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
    activeColumns.reduce((acc, col) => acc + colWidths[col.id], 0),
    [activeColumns, colWidths]
  );

  const toggleColumn = (id: string) => {
    setVisibleColumns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  return (
    <div className="p-0.5 relative">
      <div className="absolute right-4 top-2 z-50 flex items-center gap-2">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-gray-400 hover:text-white transition-all group">
          <CalendarIcon size={12} className="group-hover:text-blue-500" />
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer [color-scheme:dark]"
          />
        </div>

        <button 
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`p-1.5 rounded-md transition-all border ${isSettingsOpen ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'}`}
        >
          <Settings2 size={14} />
        </button>

        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 top-full w-48 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl p-2 z-[60]">
              <h4 className="text-[10px] font-black uppercase text-gray-500 mb-2 px-2 tracking-widest">Columns</h4>
              <div className="space-y-0.5">
                {DEFAULT_COLUMNS.filter(c => c.canHide).map(col => (
                  <div key={col.id} onClick={() => toggleColumn(col.id)}
                    className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer group">
                    <span className={`text-[11px] font-bold ${visibleColumns.includes(col.id) ? 'text-white' : 'text-gray-500'}`}>{col.label}</span>
                    {visibleColumns.includes(col.id) && <Check size={12} className="text-blue-500" />}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#0f0f0f] border border-white/10 rounded-lg overflow-hidden shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar-h min-h-[500px]">
          <table 
            style={{ minWidth: totalWidth, width: '100%' }} 
            className="text-left border-collapse table-fixed select-none"
          >
            <thead>
              <tr className="bg-white/[0.05] border-b border-white/10">
                {activeColumns.map((col) => (
                  <th key={col.id} 
                    style={{ 
                      width: col.id === 'assign' ? 'auto' : colWidths[col.id], 
                      position: col.isSticky ? 'sticky' : 'relative', 
                      left: col.id === 'name' ? 0 : 'auto', 
                      right: col.id === 'action' ? 0 : 'auto',
                      zIndex: col.isSticky ? 30 : 10 
                    }}
                    className={`py-1.5 px-1.5 text-[9px] font-black uppercase text-gray-500 bg-[#0f0f0f] border-r border-white/10 ${col.isSticky ? 'z-30' : ''}`}>
                    <div className="relative flex items-center h-full overflow-hidden">
                      <span className="truncate pr-2">{col.label}</span>
                      <div onMouseDown={(e) => onMouseDown(e, col.id)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-blue-500/30 transition-colors z-40" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {students.map((s: any) => {
                const historyCount = expandedHistory[s.id] || 0;
                const pastLogs = (s.allLogs || []).filter((l: any) => l.date < selectedDate).slice(0, historyCount);

                return (
                  <React.Fragment key={s.id}>
                    {pastLogs.map((log: any) => (
                      <HistoryPeekRow 
                        key={`${s.id}-${log.date}`} 
                        log={log} 
                        studentName={s.name}
                        colWidths={colWidths} 
                        activeColumns={activeColumns} 
                      />
                    ))}
                    <TodaySheetRow 
                      student={s} 
                      selectedDate={selectedDate} 
                      colWidths={colWidths} 
                      activeColumns={activeColumns} 
                      masterTextbooks={masterTextbooks} 
                      onSave={onSave} 
                      isHistoryExpanded={historyCount > 0}
                      onToggleHistory={() => toggleHistory(s.id)}
                    />
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
      {isSettingsOpen && <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)} />}
    </div>
  );
}
