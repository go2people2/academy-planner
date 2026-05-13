'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Loader2, CheckCircle, Wand2, Check, ClipboardList, 
  History as HistoryIcon, TrendingUp, X, Percent, ArrowLeft, Hash, FileText, ClipboardCheck
} from 'lucide-react';
import { HomeworkItem, SessionLog, StudentStatus, Student, TextbookOption } from '@/types/dashboard';
import HomeworkEditor from './HomeworkEditor';
import TestAnswerModal from './TestAnswerModal';
import TestEditor from './TestEditor';

// --- Sub-components (Moved from TodaySheet.tsx) ---

export function HistoryRows({ student, activeColumns, colWidths, isExpanded }: {
  student: Student;
  activeColumns: any[];
  colWidths: Record<string, number>;
  isExpanded: boolean;
}) {
  if (!isExpanded || !student.allLogs) return null;
  const history = student.allLogs.slice(1, 4); 

  return history.map((log: any, idx: number) => (
    <tr key={`${student.id}-hist-${idx}`} className="bg-white/[0.01] border-b border-white/[0.05] transition-colors hover:bg-white/[0.03] align-middle text-[11px]">
      {activeColumns.map((col: any) => {
        const styles = { width: colWidths[col.id] || col.minWidth, minWidth: colWidths[col.id] || col.minWidth, left: col.id === 'name' ? 0 : 'auto', position: (col.isSticky ? 'sticky' : 'relative') as any, zIndex: 10, backgroundColor: '#050505' };
        if (col.id === 'date') return <td key={col.id} style={styles} className="py-2 px-3 border-r border-white/5 text-gray-700 text-[8px] font-bold text-center">{log.date.slice(5).replace('-', '.')}</td>;
        if (col.id === 'name') return <td key={col.id} style={styles} className="py-2 px-3 border-r border-white/10 opacity-30 italic text-gray-600">-</td>;
        if (col.id === 'attendance') return <td key={col.id} style={styles} className="py-2 px-2 border-r border-white/5 text-center text-gray-600 font-medium">{log.attendance_status}</td>;
        if (col.id === 'test_id') return <td key={col.id} style={styles} className="py-2 px-2 border-r border-white/5 text-gray-600 truncate text-left">{log.test_id}</td>;
        if (col.id === 'test_score') return <td key={col.id} style={styles} className="py-2 px-2 border-r border-white/5 text-center text-gray-600 font-bold">{log.test_score}%</td>;
        if (col.id === 'review') return <td key={col.id} style={styles} className="py-2 px-2 border-r border-white/5 text-gray-500 italic truncate bg-[#050505]">Prev: {log.status}</td>;
        if (col.id === 'classwork') return <td key={col.id} style={styles} className="py-2 px-2 border-r border-white/5 text-gray-500 italic whitespace-pre-wrap leading-tight text-left">{log.classwork_text}</td>;
        if (col.id === 'assign') return <td key={col.id} style={styles} className="py-2 px-2 border-r border-white/5 text-gray-500 italic whitespace-pre-wrap leading-tight text-left">{log.homework_text}</td>;
        if (col.id === 'next_quiz') return <td key={col.id} style={styles} className="py-2 px-2 border-r border-white/5 text-gray-600 italic whitespace-pre-wrap leading-tight text-left">{log.next_quiz_text} {log.next_quiz_cut !== undefined ? `(Cut: ${log.next_quiz_cut})` : ''}</td>;
        if (col.id === 'notes') return <td key={col.id} style={styles} className="py-2 px-2 border-r border-white/5 text-gray-600 italic truncate text-left">{log.special_notes}</td>;
        if (col.id === 'action') return <td key={col.id} style={styles} className="py-2 sticky right-0 bg-[#050505] z-20 border-l border-white/10 text-center text-gray-700">-</td>;
        return <td key={col.id} style={styles}></td>;
      })}
    </tr>
  ));
}

interface TodaySheetRowProps {
  student: Student;
  masterTextbooks: TextbookOption[];
  onSave: (id: string, data: any) => Promise<boolean>;
  onViewProgress: (id: string) => void;
  colWidths: Record<string, number>;
  activeColumns: any[];
  selectedDate: string;
  isHistoryExpanded: boolean;
  onToggleHistory: (id: string) => void;
  currentUser: any;
}

export function TodaySheetRow({ 
  student, masterTextbooks, onSave, onViewProgress, colWidths, activeColumns, 
  selectedDate, isHistoryExpanded, onToggleHistory, currentUser 
}: TodaySheetRowProps) {
  const [isHwEditorOpen, setIsHwEditorOpen] = useState(false);
  const [isCwEditorOpen, setIsCwEditorOpen] = useState(false);
  const [isNqEditorOpen, setIsNqEditorOpen] = useState(false);
  const [isTestEditorOpen, setIsTestEditorOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [rowDate, setRowDate] = useState(selectedDate);
  const [undoStack, setUndoStack] = useState<any[]>([]); 

  const getSession = (date: string) => (student.allLogs || []).find((l: any) => l.date === date);
  const hasSession = useMemo(() => !!getSession(rowDate), [student.allLogs, rowDate]);

  const getInitialFormData = useCallback((date: string) => {
    const getSessionInternal = (d: string) => (student.allLogs || []).find((l: any) => l.date === d);
    const session = getSessionInternal(date);
    const getFreshBookJson = () => (student.assigned_books || []).map((b:any) => ({ type: 'book', book_name: b, range: '', units: [] }));
    
    return {
      attendance_status: session?.attendance_status || '출석',
      status: session?.status || 'none',
      special_notes: session?.special_notes || '',
      classwork_text: session?.classwork_text || '',
      classwork_json: session?.classwork_json?.length ? session.classwork_json : getFreshBookJson(),
      homework_text: session?.homework_text || '',
      homework_json: session?.homework_json?.length ? session.homework_json : getFreshBookJson(),
      next_quiz_text: session?.next_quiz_text || '',
      next_quiz_json: session?.next_quiz_json?.length ? session.next_quiz_json : getFreshBookJson(),
      next_quiz_cut: session?.next_quiz_cut || 0,
      next_quiz_trial: session?.next_quiz_trial || 1,
      test_id: session?.test_id || '',
      test_score: session?.test_score || '',
      test_score_type: session?.test_score_type || 'score'
    };
  }, [student.allLogs, student.assigned_books]);

  const [formData, setFormData] = useState<any>(() => getInitialFormData(selectedDate));
  const testRef = useRef<HTMLTextAreaElement>(null);
  const cwRef = useRef<HTMLTextAreaElement>(null);
  const hwRef = useRef<HTMLTextAreaElement>(null);
  const nqRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = useMemo(() => {
    const initial = getInitialFormData(rowDate);
    return (
      formData.attendance_status !== initial.attendance_status ||
      formData.status !== initial.status ||
      formData.special_notes !== initial.special_notes ||
      formData.classwork_text !== initial.classwork_text ||
      formData.homework_text !== initial.homework_text ||
      formData.next_quiz_text !== initial.next_quiz_text ||
      String(formData.next_quiz_cut) !== String(initial.next_quiz_cut) ||
      formData.next_quiz_trial !== initial.next_quiz_trial ||
      formData.test_id !== initial.test_id ||
      String(formData.test_score) !== String(initial.test_score) ||
      formData.test_score_type !== initial.test_score_type
    );
  }, [formData, rowDate, getInitialFormData]);

  const isCompleted = hasSession && !isDirty;

  const pushUndo = (currentState: any) => {
    setUndoStack(prev => [JSON.parse(JSON.stringify(currentState)), ...prev].slice(0, 20));
  };

  const performUndo = () => {
    if (undoStack.length === 0) return;
    const [lastState, ...rest] = undoStack;
    setFormData(lastState);
    setUndoStack(rest);
  };

  const handleSave = useCallback(async (extraData = {}) => {
    if (isSaving) return;
    const finalData = { ...formData, ...extraData, session_date: rowDate };
    
    const initial = getInitialFormData(rowDate);
    const hasChanged = Object.keys(finalData).some(key => {
      if (key === 'session_date') return false;
      return String((finalData as any)[key]) !== String((initial as any)[key]);
    });

    if (!hasChanged && Object.keys(extraData).length === 0) return;

    setIsSaving(true);
    const success = await onSave(student.id, finalData);
    setIsSaving(false);
    if (success) { 
      setSaveStatus('success'); 
      setUndoStack([]); 
      setTimeout(() => setSaveStatus('idle'), 2000); 
    }
    else { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 2000); }
  }, [formData, rowDate, student.id, isSaving, onSave, getInitialFormData]);

  useEffect(() => {
    const adjustHeight = (ref: React.RefObject<HTMLTextAreaElement>) => {
      if (ref.current) {
        ref.current.style.height = 'auto';
        const newHeight = Math.max(32, Math.min(250, ref.current.scrollHeight));
        ref.current.style.height = `${newHeight}px`;
      }
    };
    adjustHeight(testRef); adjustHeight(cwRef); adjustHeight(hwRef); adjustHeight(nqRef); adjustHeight(notesRef);
  }, [formData.test_id, formData.classwork_text, formData.homework_text, formData.next_quiz_text, formData.special_notes]);

  useEffect(() => {
    const isActuallyDirty = isDirty;
    if (rowDate !== selectedDate) {
      setRowDate(selectedDate);
      setFormData(getInitialFormData(selectedDate));
    } else if (!isActuallyDirty) {
      setFormData(getInitialFormData(selectedDate));
    }
  }, [selectedDate, getInitialFormData, rowDate, isDirty]);

  useEffect(() => {
    if (!hasSession && !isDirty) return;
    const timer = setTimeout(() => { if (isDirty) handleSave(); }, 800);
    return () => clearTimeout(timer);
  }, [formData, isDirty, hasSession, handleSave]);

  const selectFeedback = (status: StudentStatus) => {
    pushUndo(formData);
    const presets = currentUser?.homework_presets || {
      'perfect': '숙제를 아주 완벽하게 잘 해왔습니다. *^^*',
      'good': '숙제를 잘 수행했습니다.',
      'neutral': '숙제 수행이 보통입니다.',
      'poor': '숙제가 미흡한 부분이 있습니다.',
      'bad': '숙제를 거의 해오지 않았습니다.'
    };
    
    let currentNotes = formData.special_notes || '';
    const allPresetValues = Object.values(presets);
    const newComment = presets[status as keyof typeof presets] || '';

    let found = false;
    let updatedNotes = currentNotes;
    for (const preset of allPresetValues) {
      if (preset && currentNotes.includes(preset)) {
        updatedNotes = currentNotes.replace(preset, newComment).replace(/\n\n/g, '\n').trim();
        found = true;
        break;
      }
    }
    if (!found && newComment) {
      updatedNotes = currentNotes ? `${currentNotes}\n${newComment}`.trim() : newComment;
    }
    
    const newData = { ...formData, status, special_notes: updatedNotes };
    setFormData(newData);
    handleSave(newData);
    setIsFeedbackOpen(false);
  };

  const syncTextFromData = (newJson: HomeworkItem[], fieldPrefix: 'classwork' | 'homework' | 'next_quiz') => {
    pushUndo(formData);
    const assignedBookTitles = newJson.map(h => {
      const bookInfo = masterTextbooks.find((m: any) => m.bookcode === h.book_name);
      return bookInfo?.title || h.book_name;
    });
    const currentText = (formData as any)[`${fieldPrefix}_text`];
    const manualNotes = (currentText || '').split('\n').filter((line: string) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return false;
      return !assignedBookTitles.some(title => trimmedLine.startsWith(title));
    });
    const bookLines = newJson.filter(h => h.range).map(h => {
      const bookInfo = masterTextbooks.find((m: any) => m.bookcode === h.book_name);
      const title = bookInfo?.title || h.book_name;
      return `${title} ${h.range}`;
    });
    const combinedText = [...manualNotes, ...bookLines].join('\n');
    setFormData({ ...formData, [`${fieldPrefix}_json`]: newJson, [`${fieldPrefix}_text`]: combinedText });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); performUndo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); return; }
    if (e.key === 'Enter' && (e.target as any).tagName === 'TEXTAREA') return; 
    else if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
  };

  const handleTestSave = (result: any) => {
    pushUndo(formData);
    const updatedData = {
      ...formData,
      test_id: result.testId || formData.test_id,
      test_score: result.calculatedScore !== undefined ? String(result.calculatedScore) : formData.test_score,
      test_answers: result.answers
    };
    setFormData(updatedData);
    handleSave(updatedData);
    setIsTestModalOpen(false);
  };

  const displayDateShort = useMemo(() => rowDate.slice(5).replace('-', '.'), [rowDate]);

  const statusMap = {
    'none': { label: '-', color: 'bg-white/5 text-gray-500' },
    'perfect': { label: 'S', color: 'bg-emerald-500 text-white' },
    'good': { label: 'A', color: 'bg-blue-500 text-white' },
    'neutral': { label: 'B', color: 'bg-white/20 text-gray-400' },
    'poor': { label: 'C', color: 'bg-amber-500 text-white' },
    'bad': { label: 'F', color: 'bg-red-500 text-white' }
  };

  return (
    <>
      <tr className={`hover:bg-white/[0.04] transition-colors group ${isCompleted ? 'bg-emerald-500/[0.04]' : ''}`}>
        {activeColumns.map((col: any) => {
          const styles: React.CSSProperties = {
            position: col.isSticky ? 'sticky' : 'relative',
            left: col.id === 'name' ? 0 : 'auto',
            right: col.id === 'action' ? 0 : 'auto',
            zIndex: col.isSticky ? 20 : 1,
            width: colWidths[col.id] || col.minWidth,
            minWidth: colWidths[col.id] || col.minWidth,
            backgroundColor: (col.isSticky ? ( isCompleted ? '#080a08' : '#080808') : 'transparent'),
            padding: 0,
            verticalAlign: 'middle'
          };

          return (
            <td key={col.id} style={styles} className={`border-r border-white/15`}>
              <div className={`flex items-center min-h-[56px] h-full w-full ${['name','classwork','assign','notes','test_id'].includes(col.id) ? 'justify-start' : 'justify-center'}`}>
                
                {col.id === 'date' && (
                  <div className="flex flex-col gap-1.5 items-center justify-center py-2.5 w-full">
                    <span className="font-black text-gray-500 text-[10px] tabular-nums">{displayDateShort}</span>
                    <button onClick={() => onToggleHistory(student.id)} className={`w-6 h-6 rounded-[2px] flex items-center justify-center transition-all ${isHistoryExpanded ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}><HistoryIcon size={12} /></button>
                  </div>
                )}

                {col.id === 'name' && (
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 w-full relative group/namecell">
                    {student.management_notes && (
                      <div className="absolute top-0 right-0 group/note">
                        <div className="w-0 h-0 border-t-[8px] border-l-[8px] border-t-amber-500/60 border-l-transparent" />
                        <div className="absolute top-2 right-2 w-48 opacity-0 pointer-events-none group-hover/note:opacity-100 transition-all duration-300 z-[100] translate-x-2 group-hover/note:translate-x-0">
                          <div className="bg-amber-100 p-4 rounded-sm shadow-2xl border border-amber-200 rotate-1 relative">
                            <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-amber-900/10">
                              <ClipboardCheck size={10} className="text-amber-700" />
                              <span className="text-[9px] font-black text-amber-900/60 uppercase">Management Note</span>
                            </div>
                            <p className="text-[11px] font-bold text-amber-900/80 leading-relaxed whitespace-pre-wrap italic">{student.management_notes}</p>
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-amber-200/50 rounded-tl-full" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col min-w-0 overflow-hidden items-start text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white text-[14px] tracking-tight truncate">{student.name}</span>
                        {isCompleted && <Check size={12} className="text-emerald-500 stroke-[3px]" />}
                      </div>
                      <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter truncate">{student.grade} · {student.course}</span>
                    </div>
                    {onViewProgress && (
                      <button onClick={() => onViewProgress(student.id)} className="p-2 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm shrink-0" title="진도표 바로가기"><TrendingUp size={12} /></button>
                    )}
                  </div>
                )}

                {col.id === 'attendance' && (
                  <select value={formData.attendance_status} onChange={(e) => { pushUndo(formData); setFormData({ ...formData, attendance_status: e.target.value }); }}
                    className={`w-full bg-transparent border-none px-1 text-[11px] font-black outline-none appearance-none text-center cursor-pointer transition-colors focus:bg-white/[0.05] ${formData.attendance_status === '출석' ? 'text-emerald-400' : formData.attendance_status === '결석' ? 'text-red-400' : 'text-amber-400'}`}>
                    <option value="출석">출석</option><option value="결석">결석</option><option value="보강">보강</option><option value="수업취소">취소</option><option value="온라인">온라인</option>
                  </select>
                )}

                {col.id === 'test_id' && (
                  <div className="relative w-full h-full flex items-center group/cell">
                    <textarea ref={testRef} value={formData.test_id || ''} onChange={(e) => setFormData({ ...formData, test_id: e.target.value })} onKeyDown={handleKeyDown} onBlur={() => handleSave()} placeholder="-"
                      className={`w-full bg-transparent border-none px-3 py-4 text-[12px] text-left text-white focus:outline-none focus:bg-blue-500/5 transition-all font-bold resize-none overflow-y-auto custom-scrollbar-v block`} />
                    <div className="absolute right-1 top-1 flex flex-col gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity z-10">
                      {formData.test_id && (
                        <button onClick={() => window.open(`/api/pdf/${formData.test_id}`, '_blank')} className="w-6 h-6 rounded-[2px] bg-red-600/30 text-red-400 border border-red-500/40 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-sm" title="로컬 PDF 열기"><FileText size={12} /></button>
                      )}
                      <button onClick={() => setIsTestEditorOpen(true)} className="w-6 h-6 rounded-[2px] bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shadow-sm" title="테스트 다중 입력"><Wand2 size={12} /></button>
                      <button onClick={() => setIsTestModalOpen(true)} className="w-6 h-6 rounded-[2px] bg-blue-600/30 text-blue-400 border border-blue-500/40 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center shadow-sm" title="테스트 상세 채점"><ClipboardList size={12} /></button>
                    </div>
                  </div>
                )}

                {col.id === 'test_score' && (
                  <div className="relative w-full h-full flex items-center justify-center group/score">
                    <input type="text" value={formData.test_score || ''} onChange={(e) => setFormData({ ...formData, test_score: e.target.value })} onKeyDown={handleKeyDown} onBlur={() => handleSave()} placeholder="-"
                      className="w-full bg-transparent border-none px-1 text-[14px] text-center text-emerald-400 focus:outline-none focus:bg-emerald-500/5 transition-all font-black pr-4" />
                    <div className="absolute right-1 flex flex-col gap-0.5">
                      <button onClick={() => { pushUndo(formData); setFormData({ ...formData, test_score_type: formData.test_score_type === 'score' ? 'count' : 'score' }); }}
                        className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${formData.test_score_type === 'score' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-400'}`} title={formData.test_score_type === 'score' ? '점수(%) 모드' : '개수(ea) 모드'}>
                        {formData.test_score_type === 'score' ? <Percent size={8} strokeWidth={4} /> : <Hash size={8} strokeWidth={4} />}
                      </button>
                      <span className="text-[7px] font-black text-gray-600/50 text-center uppercase">{formData.test_score_type === 'score' ? '%' : 'ea'}</span>
                    </div>
                  </div>
                )}

                {col.id === 'review' && (
                  <div className="flex items-center justify-between gap-2 px-4 py-3 w-full relative group/review">
                    <div className="flex-1 text-[11px] text-gray-400 font-bold whitespace-pre-wrap leading-snug text-left truncate">{student.lastSession?.homework_text || '-'}</div>
                    <div className="relative">
                      <button onClick={() => setIsFeedbackOpen(!isFeedbackOpen)} className={`w-8 h-8 rounded-[3px] flex items-center justify-center text-[12px] font-black shrink-0 transition-all shadow-lg active:scale-90 ${statusMap[formData.status as keyof typeof statusMap].color}`}>{statusMap[formData.status as keyof typeof statusMap].label}</button>
                      <AnimatePresence>
                        {isFeedbackOpen && (
                          <motion.div initial={{ opacity: 0, x: 10, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 10, scale: 0.9 }}
                            className="absolute right-full top-0 mr-2 flex gap-1 bg-[#1a1a1a] p-1 rounded-md border border-white/10 shadow-2xl z-[100]">
                            {(['perfect', 'good', 'neutral', 'poor', 'bad', 'none'] as const).map((k) => (
                              <button key={k} onClick={() => selectFeedback(k)} className={`w-7 h-7 rounded-[2px] flex items-center justify-center text-[10px] font-black transition-all hover:scale-110 ${statusMap[k as keyof typeof statusMap].color} shadow-md`}>{statusMap[k as keyof typeof statusMap].label}</button>
                            ))}
                            <button onClick={() => setIsFeedbackOpen(false)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white"><X size={14} /></button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {col.id === 'classwork' && (
                  <div className="relative w-full h-full flex items-center group/cell">
                    <textarea ref={cwRef} value={formData.classwork_text} onChange={(e) => setFormData({ ...formData, classwork_text: e.target.value })} onKeyDown={handleKeyDown} onBlur={() => handleSave()}
                      className="w-full bg-transparent border-none px-4 py-4 text-[13px] text-emerald-50 font-semibold text-left focus:outline-none focus:bg-emerald-500/5 transition-all resize-none overflow-y-auto custom-scrollbar-v" />
                    <button onClick={() => setIsCwEditorOpen(true)} className="absolute right-1 top-1 w-6 h-6 rounded-[2px] bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center opacity-0 group-hover/cell:opacity-100 shadow-sm z-10" title="진도 정밀 편집"><Wand2 size={12} /></button>
                  </div>
                )}

                {col.id === 'assign' && (
                  <div className="relative w-full h-full flex items-center group/cell">
                    <textarea ref={hwRef} value={formData.homework_text} onChange={(e) => setFormData({ ...formData, homework_text: e.target.value })} onKeyDown={handleKeyDown} onBlur={() => handleSave()}
                      className="w-full bg-transparent border-none px-4 py-4 text-[13px] text-white font-semibold text-left focus:outline-none focus:bg-blue-500/5 transition-all resize-none overflow-y-auto custom-scrollbar-v" />
                    <button onClick={() => setIsHwEditorOpen(true)} className="absolute right-1 top-1 w-6 h-6 rounded-[2px] bg-blue-600/30 text-blue-400 border border-blue-500/40 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center opacity-0 group-hover/cell:opacity-100 shadow-sm z-10" title="숙제 정밀 편집"><Wand2 size={12} /></button>
                  </div>
                )}

                {col.id === 'next_quiz' && (
                  <div className="relative w-full h-full flex items-center group/cell">
                    <div className="flex flex-col w-full h-full">
                      <textarea ref={nqRef} value={formData.next_quiz_text} onChange={(e) => setFormData({ ...formData, next_quiz_text: e.target.value })} onKeyDown={handleKeyDown} onBlur={() => handleSave()} placeholder="Next Quiz..."
                        className="w-full bg-transparent border-none px-4 pt-4 pb-1 text-[13px] text-indigo-200 font-semibold text-left focus:outline-none focus:bg-indigo-500/5 transition-all resize-none overflow-y-auto custom-scrollbar-v flex-1" />
                      <div className="flex items-center gap-1.5 px-4 pb-2 shrink-0">
                        <span className="text-[8px] font-black text-indigo-500/50 uppercase tracking-tighter">Trial:</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(num => (
                            <button key={num} onClick={() => { pushUndo(formData); setFormData({ ...formData, next_quiz_trial: num }); }}
                              className={`w-5 h-5 rounded-[2px] flex items-center justify-center text-[9px] font-black transition-all ${formData.next_quiz_trial === num ? 'bg-amber-500 text-black shadow-lg shadow-amber-900/30 scale-110' : 'bg-white/5 text-indigo-300/40 hover:bg-white/10'}`}>{num}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="absolute right-1 top-1 flex flex-col gap-1 z-10">
                      <div className="flex flex-col gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                        <button onClick={() => setIsNqEditorOpen(true)} className="w-6 h-6 rounded-[2px] bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center shadow-sm" title="예정 테스트 정밀 편집"><Wand2 size={12} /></button>
                        <button onClick={() => { if (!formData.next_quiz_text) return; pushUndo(formData); const isAlreadyDone = formData.next_quiz_text.startsWith('✅'); const trialText = (!isAlreadyDone && formData.next_quiz_trial > 1) ? ` (${formData.next_quiz_trial}차)` : ''; setFormData({ ...formData, test_id: isAlreadyDone ? formData.test_id : `${formData.next_quiz_text}${trialText}`, next_quiz_text: isAlreadyDone ? formData.next_quiz_text : `✅ ${formData.next_quiz_text}` }); }}
                          className="w-6 h-6 rounded-[2px] bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center shadow-sm" title="테스트 실행 (오늘 테스트명으로 복사)"><ArrowLeft size={12} strokeWidth={3} /></button>
                      </div>
                      <div className="relative group/cut" title="커트라인(오답 허용 개수) 설정">
                        <select value={formData.next_quiz_cut} onChange={(e) => { pushUndo(formData); setFormData({ ...formData, next_quiz_cut: parseInt(e.target.value) }); }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20">
                          {[...Array(11)].map((_, i) => <option key={i} value={i} className="bg-[#121212]">{i}개</option>)}
                        </select>
                        <div className="w-6 h-6 rounded-[2px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex flex-col items-center justify-center transition-all group-hover/cut:bg-indigo-500/20 group-hover/cut:border-indigo-500/40 shadow-sm shadow-indigo-900/10">
                          <span className="text-[5px] font-black leading-none opacity-40 mb-0.5">CUT</span>
                          <span className="text-[10px] font-black leading-none">{formData.next_quiz_cut}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {col.id === 'notes' && (
                  <textarea ref={notesRef} value={formData.special_notes} onChange={(e) => setFormData({ ...formData, special_notes: e.target.value })} onKeyDown={handleKeyDown} onBlur={() => handleSave()} placeholder="..."
                    className="w-full bg-transparent border-none px-4 py-4 text-[12px] text-gray-400 text-left focus:outline-none focus:bg-white/5 transition-all font-medium resize-none overflow-y-auto custom-scrollbar-v" />
                )}

                {col.id === 'action' && (
                  <div className="px-3 py-2 w-full flex items-center justify-center">
                    <button onClick={() => handleSave()} disabled={isSaving || (isCompleted && saveStatus === 'idle')}
                      className={`w-full h-10 rounded-[4px] flex items-center justify-center transition-all shadow-lg ${isSaving ? 'bg-blue-600/50 cursor-wait' : saveStatus === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/40' : saveStatus === 'error' ? 'bg-red-500 text-white shadow-red-500/40' : (!hasSession || isDirty) ? 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-blue-900/40' : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40'}`}>
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : (saveStatus === 'success' || isCompleted) ? <Check size={18} className="stroke-[4px]" /> : saveStatus === 'error' ? <CheckCircle size={16} /> : <Send size={16} />}
                    </button>

                    <AnimatePresence>
                      {isCwEditorOpen && <HomeworkEditor title="Smart Classwork Editor" homeworkJson={formData.classwork_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'classwork')} onClose={() => setIsCwEditorOpen(false)} />}
                      {isHwEditorOpen && <HomeworkEditor title="Smart Homework Editor" homeworkJson={formData.homework_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'homework')} onClose={() => setIsHwEditorOpen(false)} />}
                      {isNqEditorOpen && <HomeworkEditor title="Next Quiz Range Editor" homeworkJson={formData.next_quiz_json || []} masterTextbooks={masterTextbooks} onUpdate={(newJson) => syncTextFromData(newJson, 'next_quiz')} onClose={() => setIsNqEditorOpen(false)} />}
                      {isTestEditorOpen && <TestEditor testData={formData.test_id} onUpdate={(formattedText, averageScore) => { const newData = { ...formData, test_id: formattedText, test_score: averageScore !== null ? String(averageScore) : formData.test_score }; setFormData(newData); handleSave(newData); }} onClose={() => setIsTestEditorOpen(false)} />}
                      {isTestModalOpen && <TestAnswerModal testId={formData.test_id} studentName={student.name} onClose={() => setIsTestModalOpen(false)} onSave={handleTestSave} />}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </td>
          );
        })}
      </tr>
    </>
  );
}
