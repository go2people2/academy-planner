'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Loader2, CheckCircle, Wand2, Settings2, Check, ClipboardList, 
  Calendar as CalendarIcon, History as HistoryIcon, TrendingUp, MessageSquare, 
  LayoutGrid, Table as TableIcon, Share2, AlertCircle, X, Percent, ArrowLeft, Hash
} from 'lucide-react';
import { HomeworkItem, SessionLog, StudentStatus } from '@/types/dashboard';
import HomeworkEditor from './HomeworkEditor';
import TestAnswerModal from './TestAnswerModal';
import TestEditor from './TestEditor';

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
          position: 'sticky', // 💡 상하/좌우 모두 sticky 적용
          top: 0, // 💡 상단 고정
          left: col.id === 'name' ? 0 : 'auto',
          right: col.id === 'action' ? 0 : 'auto',
          zIndex: isStickyHorizontally ? 50 : 40, // 💡 본문(20)보다 높게, 교차점은 가장 높게
          backgroundColor: '#000000', // 💡 투명하면 본문이 비치므로 검정 배경 고정
        };
        return (
          <th key={col.id} style={styles} className="py-3 px-3 text-[11px] font-black uppercase tracking-widest text-gray-400 text-center border-r border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.1)]">
            <div className="flex items-center justify-center group relative gap-1.5">
              {col.label}
              
              {/* 💡 예정 테스트 헤더에 일괄 설정 버튼 추가 (디자인 개선) */}
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

function HistoryRows({ student, activeColumns, colWidths, isExpanded }: any) {
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

function TodaySheetRow({ student, masterTextbooks, onSave, onViewProgress, colWidths, activeColumns, selectedDate, isHistoryExpanded, onToggleHistory, currentUser }: any) {
  const [isHwEditorOpen, setIsHwEditorOpen] = useState(false);
  const [isCwEditorOpen, setIsCwEditorOpen] = useState(false);
  const [isNqEditorOpen, setIsNqEditorOpen] = useState(false);
  const [isTestEditorOpen, setIsTestEditorOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [rowDate, setRowDate] = useState(selectedDate);
  const [undoStack, setUndoStack] = useState<any[]>([]); // 💡 실행 취소용 스택

  const getSession = (date: string) => (student.allLogs || []).find((l: any) => l.date === date);
  const hasSession = useMemo(() => !!getSession(rowDate), [student.allLogs, rowDate]);

  const getInitialFormData = (date: string) => {
    const session = getSession(date);
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
      next_quiz_trial: session?.next_quiz_trial || 1, // 💡 추가 (기본 1차)
      test_id: session?.test_id || '',
      test_score: session?.test_score || '',
      test_score_type: session?.test_score_type || 'score'
    };
  };

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
  }, [formData, rowDate, student.allLogs]);

  const isCompleted = hasSession && !isDirty;

  // 💡 상태 변경 전 현재 상태 저장
  const pushUndo = (currentState: any) => {
    setUndoStack(prev => [JSON.parse(JSON.stringify(currentState)), ...prev].slice(0, 20));
  };

  const performUndo = () => {
    if (undoStack.length === 0) return;
    const [lastState, ...rest] = undoStack;
    setFormData(lastState);
    setUndoStack(rest);
  };

  useEffect(() => {
    const adjustHeight = (ref: React.RefObject<HTMLTextAreaElement>) => {
      if (ref.current) {
        ref.current.style.height = 'auto';
        const newHeight = Math.max(32, Math.min(250, ref.current.scrollHeight));
        ref.current.style.height = `${newHeight}px`;
      }
    };
    adjustHeight(testRef);
    adjustHeight(cwRef);
    adjustHeight(hwRef);
    adjustHeight(nqRef);
    adjustHeight(notesRef);
  }, [formData.test_id, formData.classwork_text, formData.homework_text, formData.next_quiz_text, formData.special_notes]);

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
    if (success) { 
      setSaveStatus('success'); 
      setUndoStack([]); // 💡 저장 성공 시 스택 초기화
      setTimeout(() => setSaveStatus('idle'), 2000); 
    }
    else { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 2000); }
  };

  const selectFeedback = (status: StudentStatus) => {
    pushUndo(formData); // 💡 취소 지점 저장
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
    setFormData({ ...formData, status, special_notes: updatedNotes });
    setIsFeedbackOpen(false);
  };

  const syncTextFromData = (newJson: HomeworkItem[], fieldPrefix: 'classwork' | 'homework' | 'next_quiz') => {
    pushUndo(formData); // 💡 취소 지점 저장
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
    // 💡 Ctrl+Z 또는 Cmd+Z 감지 (실행 취소)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      performUndo();
      return;
    }

    // 💡 Ctrl+S 또는 Cmd+S 감지 (현재 행 저장)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
      return;
    }

    // 💡 textarea 내부에서는 Enter 기본 동작(줄바꿈) 허용
    if (e.key === 'Enter' && (e.target as any).tagName === 'TEXTAREA') {
      return; 
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  const handleTestSave = (answers: any) => {
    pushUndo(formData); // 💡 취소 지점 저장
    handleSave({ test_answers: answers });
    setIsTestModalOpen(false);
  };

  const displayDateShort = useMemo(() => {
    return rowDate.slice(5).replace('-', '.');
  }, [rowDate]);

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
            verticalAlign: 'middle' // 💡 테이블 레벨 정렬 보장
          };

          return (
            <td key={col.id} style={styles} className={`border-r border-white/15`}>
              {/* 💡 모든 셀을 Flex Center로 감싸 수직 중앙 정렬 강제 */}
              <div className={`flex items-center min-h-[56px] h-full w-full ${col.id === 'name' || col.id === 'classwork' || col.id === 'assign' || col.id === 'notes' || col.id === 'test_id' ? 'justify-start' : 'justify-center'}`}>
                
                {col.id === 'date' && (
                  <div className="flex flex-col gap-1.5 items-center justify-center py-2.5 w-full">
                    <span className="font-black text-gray-500 text-[10px] tabular-nums">{displayDateShort}</span>
                    <button onClick={() => onToggleHistory(student.id)} className={`w-6 h-6 rounded-[2px] flex items-center justify-center transition-all ${isHistoryExpanded ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}><HistoryIcon size={12} /></button>
                  </div>
                )}

                {col.id === 'name' && (
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 w-full">
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
                  <select value={formData.attendance_status} onChange={(e) => setFormData({ ...formData, attendance_status: e.target.value })}
                    className={`w-full bg-transparent border-none px-1 text-[11px] font-black outline-none appearance-none text-center cursor-pointer transition-colors focus:bg-white/[0.05] ${formData.attendance_status === '출석' ? 'text-emerald-400' : formData.attendance_status === '결석' ? 'text-red-400' : 'text-amber-400'}`}>
                    <option value="출석">출석</option><option value="결석">결석</option><option value="보강">보강</option><option value="수업취소">취소</option><option value="온라인">온라인</option>
                  </select>
                )}

                {col.id === 'test_id' && (
                  <div className="relative w-full h-full flex items-center group/cell">
                    <textarea ref={testRef} value={formData.test_id || ''} onChange={(e) => setFormData({ ...formData, test_id: e.target.value })} onKeyDown={handleKeyDown} placeholder="-"
                      className={`w-full bg-transparent border-none px-3 py-4 text-[12px] text-left text-white focus:outline-none focus:bg-blue-500/5 transition-all font-bold resize-none overflow-y-auto custom-scrollbar-v block`} />
                    
                    <div className="absolute right-1 top-1 flex flex-col gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity z-10">
                      <button onClick={() => setIsTestEditorOpen(true)} className="w-6 h-6 rounded-[2px] bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shadow-sm" title="테스트 다중 입력"><Wand2 size={12} /></button>
                      <button onClick={() => setIsTestModalOpen(true)} className="w-6 h-6 rounded-[2px] bg-blue-600/30 text-blue-400 border border-blue-500/40 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center shadow-sm" title="테스트 상세 채점"><ClipboardList size={12} /></button>
                    </div>
                  </div>
                )}

                {col.id === 'test_score' && (
                  <div className="relative w-full h-full flex items-center justify-center group/score">
                    <input type="text" value={formData.test_score || ''} onChange={(e) => setFormData({ ...formData, test_score: e.target.value })} onKeyDown={handleKeyDown} placeholder="-"
                      className="w-full bg-transparent border-none px-1 text-[14px] text-center text-emerald-400 focus:outline-none focus:bg-emerald-500/5 transition-all font-black pr-4" />
                    
                    {/* 💡 점수/개수 타입 토글 */}
                    <div className="absolute right-1 flex flex-col gap-0.5">
                      <button 
                        onClick={() => setFormData({ ...formData, test_score_type: formData.test_score_type === 'score' ? 'count' : 'score' })}
                        className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${formData.test_score_type === 'score' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-400'}`}
                        title={formData.test_score_type === 'score' ? '점수(%) 모드' : '개수(ea) 모드'}
                      >
                        {formData.test_score_type === 'score' ? <Percent size={8} strokeWidth={4} /> : <Hash size={8} strokeWidth={4} />}
                      </button>
                      <span className="text-[7px] font-black text-gray-600/50 text-center uppercase">
                        {formData.test_score_type === 'score' ? '%' : 'ea'}
                      </span>
                    </div>
                  </div>
                )}

                {col.id === 'review' && (
                  <div className="flex items-center justify-between gap-2 px-4 py-3 w-full relative group/review">
                    <div className="flex-1 text-[11px] text-gray-400 font-bold whitespace-pre-wrap leading-snug text-left truncate">
                      {student.lastSession?.homework_text || '-'}
                    </div>
                    <div className="relative">
                      <button onClick={() => setIsFeedbackOpen(!isFeedbackOpen)} className={`w-8 h-8 rounded-[3px] flex items-center justify-center text-[12px] font-black shrink-0 transition-all shadow-lg active:scale-90 ${statusMap[formData.status as keyof typeof statusMap].color}`}>
                        {statusMap[formData.status as keyof typeof statusMap].label}
                      </button>
                      <AnimatePresence>
                        {isFeedbackOpen && (
                          <motion.div initial={{ opacity: 0, x: 10, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 10, scale: 0.9 }}
                            className="absolute right-full top-0 mr-2 flex gap-1 bg-[#1a1a1a] p-1 rounded-md border border-white/10 shadow-2xl z-[100]">
                            {(['perfect', 'good', 'neutral', 'poor', 'bad', 'none'] as const).map((k) => (
                              <button key={k} onClick={() => selectFeedback(k)} className={`w-7 h-7 rounded-[2px] flex items-center justify-center text-[10px] font-black transition-all hover:scale-110 ${statusMap[k as keyof typeof statusMap].color} shadow-md`}>
                                {statusMap[k as keyof typeof statusMap].label}
                              </button>
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
                    <textarea ref={cwRef} value={formData.classwork_text} onChange={(e) => setFormData({ ...formData, classwork_text: e.target.value })} onKeyDown={handleKeyDown}
                      className="w-full bg-transparent border-none px-4 py-4 text-[13px] text-emerald-50 font-semibold text-left focus:outline-none focus:bg-emerald-500/5 transition-all resize-none overflow-y-auto custom-scrollbar-v" />
                    <button onClick={() => setIsCwEditorOpen(true)} className="absolute right-1 top-1 w-6 h-6 rounded-[2px] bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center opacity-0 group-hover/cell:opacity-100 shadow-sm z-10" title="진도 정밀 편집"><Wand2 size={12} /></button>
                  </div>
                )}

                {col.id === 'assign' && (
                  <div className="relative w-full h-full flex items-center group/cell">
                    <textarea ref={hwRef} value={formData.homework_text} onChange={(e) => setFormData({ ...formData, homework_text: e.target.value })} onKeyDown={handleKeyDown}
                      className="w-full bg-transparent border-none px-4 py-4 text-[13px] text-white font-semibold text-left focus:outline-none focus:bg-blue-500/5 transition-all resize-none overflow-y-auto custom-scrollbar-v" />
                    <button onClick={() => setIsHwEditorOpen(true)} className="absolute right-1 top-1 w-6 h-6 rounded-[2px] bg-blue-600/30 text-blue-400 border border-blue-500/40 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center opacity-0 group-hover/cell:opacity-100 shadow-sm z-10" title="숙제 정밀 편집"><Wand2 size={12} /></button>
                  </div>
                )}

                {col.id === 'next_quiz' && (
                  <div className="relative w-full h-full flex items-center group/cell">
                    <div className="flex flex-col w-full h-full">
                      <textarea ref={nqRef} value={formData.next_quiz_text} onChange={(e) => setFormData({ ...formData, next_quiz_text: e.target.value })} onKeyDown={handleKeyDown} placeholder="Next Quiz..."
                        className="w-full bg-transparent border-none px-4 pt-4 pb-1 text-[13px] text-indigo-200 font-semibold text-left focus:outline-none focus:bg-indigo-500/5 transition-all resize-none overflow-y-auto custom-scrollbar-v flex-1" />
                      
                      {/* 💡 도구 모음: 회차(1~5차) 선택 */}
                      <div className="flex items-center gap-1.5 px-4 pb-2 shrink-0">
                        <span className="text-[8px] font-black text-indigo-500/50 uppercase tracking-tighter">Trial:</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(num => (
                            <button 
                              key={num}
                              onClick={() => setFormData({ ...formData, next_quiz_trial: num })}
                              className={`w-5 h-5 rounded-[2px] flex items-center justify-center text-[9px] font-black transition-all ${
                                formData.next_quiz_trial === num 
                                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-900/30 scale-110' 
                                  : 'bg-white/5 text-indigo-300/40 hover:bg-white/10'
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 💡 도구 모음: 편집 + 실행 + 커트라인 */}
                    <div className="absolute right-1 top-1 flex flex-col gap-1 z-10">
                      <div className="flex flex-col gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                        <button onClick={() => setIsNqEditorOpen(true)} className="w-6 h-6 rounded-[2px] bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center shadow-sm" title="예정 테스트 정밀 편집"><Wand2 size={12} /></button>
                        
                        <button 
                          onClick={() => {
                            if (!formData.next_quiz_text) return;
                            const isAlreadyDone = formData.next_quiz_text.startsWith('✅');
                            const trialText = (!isAlreadyDone && formData.next_quiz_trial > 1) ? ` (${formData.next_quiz_trial}차)` : '';
                            setFormData({
                              ...formData,
                              test_id: isAlreadyDone ? formData.test_id : `${formData.next_quiz_text}${trialText}`,
                              next_quiz_text: isAlreadyDone ? formData.next_quiz_text : `✅ ${formData.next_quiz_text}`
                            });
                          }}
                          className="w-6 h-6 rounded-[2px] bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center shadow-sm"
                          title="테스트 실행 (오늘 테스트명으로 복사)"
                        >
                          <ArrowLeft size={12} strokeWidth={3} />
                        </button>
                      </div>
                      
                      <div className="relative group/cut" title="커트라인(오답 허용 개수) 설정">
                        <select 
                          value={formData.next_quiz_cut} 
                          onChange={(e) => setFormData({ ...formData, next_quiz_cut: parseInt(e.target.value) })}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                        >
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
                  <textarea ref={notesRef} value={formData.special_notes} onChange={(e) => setFormData({ ...formData, special_notes: e.target.value })} onKeyDown={handleKeyDown} placeholder="..."
                    className="w-full bg-transparent border-none px-4 py-4 text-[12px] text-gray-400 text-left focus:outline-none focus:bg-white/5 transition-all font-medium resize-none overflow-y-auto custom-scrollbar-v" />
                )}

                {col.id === 'action' && (
                  <div className="px-3 py-2 w-full flex items-center justify-center">
                    <button onClick={() => handleSave()} disabled={isSaving || (isCompleted && saveStatus === 'idle')}
                      className={`w-full h-10 rounded-[4px] flex items-center justify-center transition-all shadow-lg ${isSaving ? 'bg-blue-600/50 cursor-wait' : saveStatus === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/40' : saveStatus === 'error' ? 'bg-red-500 text-white shadow-red-500/40' : (!hasSession || isDirty) ? 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-blue-900/40' : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40'}`}>
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : (saveStatus === 'success' || isCompleted) ? <Check size={18} className="stroke-[4px]" /> : saveStatus === 'error' ? <CheckCircle size={16} /> : <Send size={16} />}
                    </button>

                    {/* 💡 모달 에디터들을 td 내부로 이동하여 HTML 유효성 확보 (포털 사용하므로 시각적 차이 없음) */}
                    <AnimatePresence>
                      {isCwEditorOpen && (
                        <HomeworkEditor
                          title="Smart Classwork Editor"
                          homeworkJson={formData.classwork_json || []}
                          masterTextbooks={masterTextbooks}
                          onUpdate={(newJson) => syncTextFromData(newJson, 'classwork')}
                          onClose={() => setIsCwEditorOpen(false)}
                        />
                      )}
                      {isHwEditorOpen && (
                        <HomeworkEditor
                          title="Smart Homework Editor"
                          homeworkJson={formData.homework_json || []}
                          masterTextbooks={masterTextbooks}
                          onUpdate={(newJson) => syncTextFromData(newJson, 'homework')}
                          onClose={() => setIsHwEditorOpen(false)}
                        />
                      )}
                      {isNqEditorOpen && (
                        <HomeworkEditor
                          title="Next Quiz Range Editor"
                          homeworkJson={formData.next_quiz_json || []}
                          masterTextbooks={masterTextbooks}
                          onUpdate={(newJson) => syncTextFromData(newJson, 'next_quiz')}
                          onClose={() => setIsNqEditorOpen(false)}
                        />
                      )}
                      {isTestEditorOpen && (
                        <TestEditor 
                          testData={formData.test_id}
                          onUpdate={(formattedText, averageScore) => {
                            setFormData({ 
                              ...formData, 
                              test_id: formattedText,
                              test_score: averageScore !== null ? String(averageScore) : formData.test_score
                            });
                          }}
                          onClose={() => setIsTestEditorOpen(false)}
                        />
                      )}
                      {isTestModalOpen && (
                        <TestAnswerModal
                          testId={formData.test_id}
                          studentName={student.name}
                          onClose={() => setIsTestModalOpen(false)}
                          onSave={handleTestSave}
                        />
                      )}
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
  
  // 💡 프리셋 초기값 및 관리 로직 (사용자 요청 패턴 반영)
  const defaultCols = DEFAULT_COLUMNS.map(c => c.id);
  const [presets, setPresets] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`todaySheetPresets_${currentUser?.id || 'default'}`);
      if (saved) return JSON.parse(saved);
    }
    return { 
      '1': ['name', 'review', 'classwork', 'assign', 'action'], // 과제 집중
      '2': ['name', 'test_id', 'test_score', 'notes', 'action'], // 테스트/특이사항
      '3': ['name', 'next_quiz', 'action'], // 자료 준비 (Next Quiz)
      '4': defaultCols // 전체 보기
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

  // 💡 열 토글 시 현재 활성화된 세트에 즉시 저장
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
    setIsSendingReport(studentId);
    await new Promise(resolve => setTimeout(resolve, 1000));
    alert('카카오톡 리포트가 전송되었습니다.');
    setIsSendingReport(null);
  };

  const handleSendAll = async () => {
    const unsent = students.filter((s: any) => s.todaySession && !s.todaySession.report_sent_at);
    if (unsent.length === 0) return alert('이미 모든 리포트가 전송되었거나 전송할 리포트가 없습니다.');
    if (!confirm(`${unsent.length}명의 학부모님께 일괄 전송하시겠습니까?`)) return;
    setIsSendingReport('all');
    await new Promise(resolve => setTimeout(resolve, 2000));
    alert('전체 리포트 전송이 완료되었습니다.');
    setIsSendingReport(null);
  };

  // 💡 예정 테스트 커트라인 일괄 설정
  const handleBatchQuizCut = async (cut: number) => {
    const activeStudents = students.filter((s: any) => !s.is_deleted);
    if (activeStudents.length === 0) return;
    if (!confirm(`현재 목록의 ${activeStudents.length}명 학생 모두 커트라인을 ${cut}개로 변경하시겠습니까?\n(이미 저장된 데이터도 즉시 업데이트됩니다)`)) return;

    setIsSendingReport('batch-cut'); // 로딩 상태 재활용
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

  // 💡 학년별 학생 수 통계 복구
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
                  {/* 💡 세트 선택/편집 전환 섹션 */}
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
                  <p className="mt-3 text-[9px] text-gray-600 italic px-1 font-medium">* 선택 시 현재 Set에 자동 저장됩니다.</p>
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
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-1 space-y-4 pt-6 border-t border-white/10 min-h-0 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-2 mb-2 shrink-0">
              <h3 className="text-[12px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                <LayoutGrid size={18} className="text-amber-500" /> KakaoTalk Report Preview
              </h3>
              <div className="flex gap-5">
                <span className="flex items-center gap-2 text-[11px] font-black uppercase text-gray-600"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Ready</span>
                <span className="flex items-center gap-2 text-[11px] font-black uppercase text-gray-600"><div className="w-2.5 h-2.5 rounded-full bg-white/20" /> Sent</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar-v pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-5 pb-20 px-2 text-center">
                {students.map((s: any, idx: number) => {
                  const session = s.todaySession;
                  const hasData = session && (session.classwork_text || session.homework_text || session.test_id);
                  const isSent = !!session?.report_sent_at;

                  return (
                    <div key={`${s.id}-${idx}`} className="flex flex-col gap-2.5 w-full max-w-[220px] mx-auto group text-center">
                      <div className={`w-full aspect-[9/16] bg-[#bacee0] rounded-[28px] p-2.5 shadow-xl border-[4px] border-[#1a1a1a] relative overflow-hidden flex flex-col transition-all duration-300 ${!hasData ? 'opacity-30' : 'group-hover:translate-y-[-4px] group-hover:shadow-2xl'}`}>
                        <div className="flex justify-between items-center px-4 pt-1 pb-1.5 shrink-0">
                          <span className="text-[8px] font-black text-[#1a1a1a]/40">12:30</span>
                          <div className="flex gap-0.5"><div className="w-1.5 h-1.5 rounded-full bg-[#1a1a1a]/20" /><div className="w-1.5 h-1.5 rounded-full bg-[#1a1a1a]/20" /></div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar-v pr-0.5 space-y-4 min-h-0 text-center">
                          <div className="flex justify-center shrink-0">
                            <span className="bg-[#1a1a1a]/10 text-[#1a1a1a]/60 text-[7px] px-2 py-1 rounded-full font-bold">{selectedDate.replace(/-/g, '.')}</span>
                          </div>

                          <div className="flex items-start gap-1.5 text-left">
                            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm border border-white/10"><Share2 size={14} /></div>
                            <div className="flex-1 space-y-1.5 min-w-0">
                              <p className="text-[10px] font-black text-[#1a1a1a]/70 ml-0.5 truncate">{academyInfo?.academy_name || 'Hokma Math'}</p>
                              <div className={`bg-[#FEE500] rounded-tr-lg rounded-b-lg p-2.5 shadow-sm border border-[#e0cb00]/50 relative ${isSent ? 'grayscale-[0.5] opacity-80' : ''}`}>
                                <div className="border-b border-[#1a1a1a]/10 pb-2 mb-2 flex justify-between items-center">
                                  <h4 className="text-[10px] font-extrabold text-[#1a1a1a] flex items-center gap-1"><AlertCircle size={10} className="text-[#1a1a1a]/60" /> 알림톡</h4>
                                  {isSent && <Check size={10} className="text-blue-600 font-black" />}
                                </div>
                                {hasData ? (
                                  <div className="space-y-2.5">
                                    <p className="text-[11px] font-black text-[#1a1a1a] mb-0.5 text-center">[학습 리포트]</p>
                                    <div className="space-y-2 text-[10px] font-bold text-[#1a1a1a]/80 leading-tight">
                                      <p className="text-center">안녕하세요, <span className="text-blue-700 font-black">{s.name}</span> 학생 수업 내용입니다.</p>
                                      <div className="bg-white/40 p-2 rounded-md space-y-1.5 border border-black/5 text-[9px] text-left">
                                        <p>📚 <span className="text-black/60 font-black">진도:</span> {session.classwork_text || '-'}</p>
                                        <p>🏠 <span className="text-black/60 font-black">과제:</span> {session.homework_text || '-'}</p>
                                        {(session.test_id || session.test_score) && (
                                          <p>📝 <span className="text-black/60 font-black">테스트:</span> {session.test_id} {session.test_score ? `(${session.test_score}%)` : ''}</p>
                                        )}
                                        {session.next_quiz_text && (
                                          <div className="flex flex-col">
                                            <p>🔔 <span className="text-black/60 font-black">예정:</span> {session.next_quiz_text}</p>
                                            <p className="ml-5 text-[8px] text-indigo-700/70 font-black italic">
                                              (목표: 오답 {session.next_quiz_cut || 0}개 이하 통과)
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="py-6 text-center"><p className="text-[10px] font-bold text-[#1a1a1a]/40 uppercase tracking-widest italic">Waiting...</p></div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="h-0.5 w-14 bg-[#1a1a1a]/20 rounded-full mx-auto mt-2 mb-0.5 shrink-0" />
                      </div>
                      <button 
                        onClick={() => handleSendIndividual(s.id)}
                        disabled={!hasData || isSent || isSendingReport !== null}
                        className={`w-full py-3 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all flex items-center justify-center gap-2 shadow-xl ${
                          isSent ? 'bg-white/5 text-gray-600' : 
                          hasData ? 'bg-[#FEE500] text-[#1a1a1a] hover:brightness-95 active:scale-95' : 
                          'bg-white/5 text-gray-800'
                        }`}
                      >
                        {isSendingReport === s.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        {isSent ? '전송 완료' : '발송하기'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
