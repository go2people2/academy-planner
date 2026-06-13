'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, Plus, Trash2, Download, CheckCircle2, Circle, AlertCircle, X, Users, MessageSquare, ClipboardList
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Student, Task } from '@/types/dashboard';

interface SurveyManagementProps {
  academyInfo: any;
  students: Student[];
  currentUser: any;
}

export default function SurveyManagement({ academyInfo, students, currentUser }: SurveyManagementProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingSurvey, setIsAddingSurvey] = useState(false);

  const [newSurvey, setNewSurvey] = useState({ 
    title: '', 
    question_type: 'objective', // 'objective' | 'subjective'
    options: '토요일,일요일,참석 불가', // 콤마로 구분
    target_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  
  const [targetStudentIds, setTargetStudentIds] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, '+' | '-'>>({});

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'master';

  useEffect(() => {
    fetchTasks();
  }, [academyInfo.id]);

  const fetchTasks = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('ams_tasks')
      .select('*')
      .eq('academy_id', academyInfo.id)
      .in('type', ['survey', 'survey_response'])
      .order('created_at', { ascending: false });
    
    if (!error) setTasks(data || []);
    setIsLoading(false);
  };

  const handleAddSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSurvey.title) return;

    const contentObj = {
      type: newSurvey.question_type,
      options: newSurvey.question_type === 'objective' ? newSurvey.options.split(',').map(s => s.trim()).filter(Boolean) : [],
      target_students: targetStudentIds
    };

    const { data, error } = await supabase.from('ams_tasks').insert([{
      academy_id: academyInfo.id,
      title: newSurvey.title,
      content: JSON.stringify(contentObj),
      start_date: new Date().toISOString().split('T')[0],
      target_date: newSurvey.target_date,
      display_period_type: 'custom',
      is_completed: false,
      created_by: currentUser?.id || null,
      type: 'survey'
    }]).select();

    if (!error && data) {
      setTasks([data[0], ...tasks]);
      setIsAddingSurvey(false);
      setNewSurvey({ title: '', question_type: 'objective', options: '토요일,일요일,참석 불가', target_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] });
      setTargetStudentIds([]);
      setActiveFilters({});
    } else if (error) {
      alert(`설문 생성 실패: ${error.message}`);
    }
  };

  const deleteSurvey = async (id: string) => {
    if (!confirm('설문을 삭제하시겠습니까? 관련된 모든 응답도 삭제됩니다.')) return;
    
    // 연관된 응답 삭제
    const responses = tasks.filter(t => t.type === 'survey_response' && t.title === id);
    for (const r of responses) {
      await supabase.from('ams_tasks').delete().eq('id', r.id);
    }
    // 설문 자체 삭제
    const { error } = await supabase.from('ams_tasks').delete().eq('id', id);
    if (!error) setTasks(tasks.filter(t => t.id !== id && t.title !== id));
  };

  const surveys = useMemo(() => tasks.filter(t => t.type === 'survey'), [tasks]);
  const responses = useMemo(() => tasks.filter(t => t.type === 'survey_response'), [tasks]);

  const handleDownloadExcel = (surveyId: string, surveyTitle: string) => {
    const surveyResponses = responses.filter(r => r.title === surveyId);
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "학생이름,응답내용,응답시간\n";

    surveyResponses.forEach(r => {
      let resData: any = {};
      try { resData = JSON.parse(r.content || '{}'); } catch(e){}
      
      const student = students.find(s => s.id === resData.student_id);
      const studentName = student ? student.name : '알수없음';
      const answer = resData.response || '';
      const date = new Date(r.created_at).toLocaleString();
      
      csvContent += `${studentName},"${answer.replace(/"/g, '""')}","${date}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `수요조사_${surveyTitle}_결과.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <BarChart3 size={14} className="text-purple-400" /> Active Surveys
        </h3>
        {isAdmin && (
          <button onClick={() => { setIsAddingSurvey(true); setTargetStudentIds(students.map(s => s.id)); }} className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 text-purple-400 border border-purple-500/30 text-[10px] font-black uppercase tracking-widest rounded hover:bg-purple-600/40 transition-all">
            <Plus size={14} /> New Survey
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAddingSurvey && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <form onSubmit={handleAddSurvey} className="bg-white/5 border border-purple-500/30 p-5 rounded-md mb-6 space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-[11px] font-black text-white uppercase tracking-widest">수요조사 생성</h4>
                <button type="button" onClick={() => setIsAddingSurvey(false)} className="text-gray-500 hover:text-white"><X size={16} /></button>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">질문 내용</label>
                <input required type="text" value={newSurvey.title} onChange={e => setNewSurvey({...newSurvey, title: e.target.value})} placeholder="예: 이번 주말 보충수업 언제 올 거야?" className="w-full bg-black/50 border border-white/10 rounded p-2.5 text-sm text-white focus:border-purple-500 outline-none" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">응답 유형</label>
                  <select value={newSurvey.question_type} onChange={e => setNewSurvey({...newSurvey, question_type: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded p-2.5 text-sm text-white focus:border-purple-500 outline-none">
                    <option value="objective">객관식 (선택형)</option>
                    <option value="subjective">서술형 (텍스트 입력)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">제출 기한 (마감일)</label>
                  <input type="date" value={newSurvey.target_date} onChange={e => setNewSurvey({...newSurvey, target_date: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded p-2.5 text-sm text-white focus:border-purple-500 outline-none [color-scheme:dark]" />
                </div>
                
                {newSurvey.question_type === 'objective' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">선택지 (콤마로 구분)</label>
                    <input type="text" value={newSurvey.options} onChange={e => setNewSurvey({...newSurvey, options: e.target.value})} placeholder="토요일,일요일,못 옴" className="w-full bg-black/50 border border-white/10 rounded p-2.5 text-sm text-white focus:border-purple-500 outline-none" />
                  </div>
                )}
              </div>

              {/* 하단 2단 레이아웃: 좌측 대상학생 / 우측 미리보기 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-white/10 mt-4">
                {/* 대상 학생 선택 영역 */}
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <label className="block text-sm font-bold text-gray-300 mt-1 shrink-0">대상 학생 ({targetStudentIds.length}명)</label>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                    <button type="button" onClick={() => { setTargetStudentIds(students.map(s => s.id)); setActiveFilters({}); }} className="px-3 py-1 mb-1 rounded text-[11px] font-black uppercase border transition-all bg-blue-600/20 text-blue-400 border-blue-500/30 hover:bg-blue-600/40">전체선택</button>
                    <button type="button" onClick={() => { setTargetStudentIds([]); setActiveFilters({}); }} className="px-3 py-1 mb-1 rounded text-[11px] font-black uppercase border transition-all bg-red-600/20 text-red-400 border-red-500/30 hover:bg-red-600/40">전체해제</button>
                    {[
                      ...Array.from(new Set(students.map(s => s.teacher_name || s.teacher_initial).filter(Boolean))).map(tName => ({
                        label: `${tName}T`,
                        fn: (s: Student) => s.teacher_name === tName || s.teacher_initial === tName
                      })),
                      { label: '월', fn: (s: Student) => s.class_days?.includes('월') },
                      { label: '화', fn: (s: Student) => s.class_days?.includes('화') },
                      { label: '수', fn: (s: Student) => s.class_days?.includes('수') },
                      { label: '목', fn: (s: Student) => s.class_days?.includes('목') },
                      { label: '금', fn: (s: Student) => s.class_days?.includes('금') },
                      { label: '토', fn: (s: Student) => s.class_days?.includes('토') },
                      { label: '일', fn: (s: Student) => s.class_days?.includes('일') },
                      { label: '초등', fn: (s: Student) => s.grade.includes('초') },
                      { label: '중등', fn: (s: Student) => s.grade.includes('중') },
                      { label: '고등', fn: (s: Student) => s.grade.includes('고') },
                      { label: '1학년', fn: (s: Student) => s.grade.includes('1') },
                      { label: '2학년', fn: (s: Student) => s.grade.includes('2') },
                      { label: '3학년', fn: (s: Student) => s.grade.includes('3') },
                    ].map(btn => {
                      const matches = students.filter(btn.fn);
                      const filterState = activeFilters[btn.label];
                      
                      let plusBtnClass = "px-2.5 py-1 text-sm font-black text-blue-400 bg-blue-500/10 hover:bg-blue-600 hover:text-white border-l border-white/5 transition-all";
                      let minusBtnClass = "px-2.5 py-1 text-sm font-black text-red-400 bg-red-500/10 hover:bg-red-600 hover:text-white border-l border-white/5 transition-all";
                      
                      if (filterState === '+') {
                        plusBtnClass = "px-2.5 py-1 text-sm font-black text-white bg-blue-600 border-l border-white/5 shadow-[inset_0_0_5px_rgba(0,0,0,0.3)] transition-all";
                      } else if (filterState === '-') {
                        minusBtnClass = "px-2.5 py-1 text-sm font-black text-white bg-red-600 border-l border-white/5 shadow-[inset_0_0_5px_rgba(0,0,0,0.3)] transition-all";
                      }

                      return (
                        <div key={btn.label} className="flex items-center border border-white/10 rounded-[3px] overflow-hidden mb-1 shadow-sm transition-all bg-black/40">
                          <span className="px-3 py-1 text-xs font-bold text-gray-200">{btn.label}</span>
                          <button 
                            type="button" 
                            onClick={() => {
                              if (filterState === '+') {
                                setActiveFilters(prev => { const next = {...prev}; delete next[btn.label]; return next; });
                                setTargetStudentIds(prev => prev.filter(id => !matches.find(m => m.id === id)));
                              } else {
                                setActiveFilters(prev => ({ ...prev, [btn.label]: '+' }));
                                setTargetStudentIds(prev => Array.from(new Set([...prev, ...matches.map(s => s.id)])));
                              }
                            }} 
                            className={plusBtnClass}
                            title={`${btn.label} 학생 일괄 추가 (한 번 더 누르면 취소)`}
                          >
                            +
                          </button>
                          <button 
                            type="button" 
                            onClick={() => {
                              if (filterState === '-') {
                                setActiveFilters(prev => { const next = {...prev}; delete next[btn.label]; return next; });
                                setTargetStudentIds(prev => Array.from(new Set([...prev, ...matches.map(s => s.id)])));
                              } else {
                                setActiveFilters(prev => ({ ...prev, [btn.label]: '-' }));
                                setTargetStudentIds(prev => prev.filter(id => !matches.find(m => m.id === id)));
                              }
                            }} 
                            className={minusBtnClass}
                            title={`${btn.label} 학생 일괄 제외 (한 번 더 누르면 취소)`}
                          >
                            -
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-black/40 border border-white/5 rounded p-2 h-[300px] overflow-y-auto custom-scrollbar-v grid grid-cols-2 gap-2">
                  {students.map(s => (
                    <label key={s.id} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-all h-fit ${targetStudentIds.includes(s.id) ? 'bg-purple-500/20 text-purple-100' : 'hover:bg-white/5 text-gray-400'}`}>
                      <input 
                        type="checkbox" 
                        checked={targetStudentIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) setTargetStudentIds(prev => [...prev, s.id]);
                          else setTargetStudentIds(prev => prev.filter(id => id !== s.id));
                        }}
                        className="w-4 h-4 rounded-sm accent-purple-500 bg-black border-white/20 shrink-0"
                      />
                      <span className="text-sm font-bold truncate flex-1 text-white">{s.name} <span className="text-xs text-gray-400 font-normal ml-1">{s.grade}</span></span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 학생 화면 미리보기 (우측) */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">학생 화면 미리보기 (Preview)</label>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-left shadow-lg pointer-events-none transform scale-90 origin-top">
                  <div className="flex items-center gap-2 mb-3">
                    <ClipboardList size={16} className="text-purple-400" />
                    <h3 className="text-sm font-bold text-purple-100">{newSurvey.title || '여기에 질문 내용이 표시됩니다.'}</h3>
                  </div>
                  <div className="space-y-3 mt-4">
                    {newSurvey.question_type === 'objective' ? (
                      <div className="grid grid-cols-2 gap-2">
                        {newSurvey.options.split(',').map(s => s.trim()).filter(Boolean).length > 0 
                          ? newSurvey.options.split(',').map(s => s.trim()).filter(Boolean).map((opt, i) => (
                            <div key={i} className="p-2 rounded border text-xs font-bold bg-black/30 border-white/10 text-gray-400 text-center">
                              {opt}
                            </div>
                          ))
                          : <div className="col-span-2 text-xs text-gray-500 italic">선택지를 입력해주세요...</div>
                        }
                      </div>
                    ) : (
                      <div className="w-full h-[60px] bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-gray-500">
                        답변을 입력해주세요...
                      </div>
                    )}
                    <div className="w-full py-2.5 rounded text-xs font-black uppercase tracking-widest text-center bg-purple-600/50 text-white/50 border border-purple-500/20">
                      제출하기
                    </div>
                  </div>
                </div>
              </div>
            </div>
              
              <div className="flex justify-end pt-2 mt-2">
                <button type="submit" className="px-5 py-2 bg-purple-600 text-white text-[11px] font-black uppercase rounded hover:bg-purple-500 transition-all">생성하기</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {isLoading ? (
          <div className="py-10 text-center text-gray-600 animate-pulse text-[10px] font-black uppercase tracking-widest">Loading surveys...</div>
        ) : surveys.length === 0 ? (
          <div className="py-10 border border-dashed border-white/5 rounded text-center text-gray-700 text-[10px] font-bold uppercase tracking-widest">진행 중인 수요조사가 없습니다.</div>
        ) : (
          surveys.map(survey => {
            const surveyResponses = responses.filter(r => r.title === survey.id);
            let sData: any = {};
            try { sData = JSON.parse(survey.content || '{}'); } catch(e){}

            // 결과 통계 계산 (객관식인 경우)
            const stats: Record<string, number> = {};
            if (sData.type === 'objective' && sData.options) {
              sData.options.forEach((opt: string) => stats[opt] = 0);
            }
            
            const formattedResponses = surveyResponses.map(r => {
              let resData: any = {};
              try { resData = JSON.parse(r.content || '{}'); } catch(e){}
              const student = students.find(s => s.id === resData.student_id);
              
              if (sData.type === 'objective' && resData.response && stats[resData.response] !== undefined) {
                stats[resData.response]++;
              }
              
              return {
                id: r.id,
                studentId: resData.student_id,
                studentName: student ? student.name : '알수없음',
                grade: student ? student.grade : '',
                answer: resData.response || '',
                date: new Date(r.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              };
            });

            const isExpanded = activeFilters[`expand_${survey.id}`] === '+';

            return (
              <div key={survey.id} className="bg-[#0f0f0f] border border-white/10 hover:border-purple-500/30 rounded transition-all group">
                <div className="flex items-start justify-between p-4">
                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-[2px] uppercase ${sData.type === 'objective' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {sData.type === 'objective' ? '객관식' : '서술형'}
                        </span>
                        <h4 className="text-sm font-bold text-white">{survey.title}</h4>
                      </div>
                      <span className="text-[10px] text-gray-500">마감: {survey.target_date}</span>
                    </div>
                    {sData.type === 'objective' && sData.options && (
                      <p className="text-[11px] text-gray-500">보기: {sData.options.join(' / ')}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3 pt-2 border-t border-white/5">
                      <p className="text-[11px] font-bold text-purple-400 flex items-center gap-1">
                        <Users size={12} /> 응답 수: {surveyResponses.length}명 <span className="text-gray-600">/ {sData.target_students?.length || 0}명</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <button 
                      onClick={() => {
                        let sData: any = {};
                        try { sData = JSON.parse(survey.content || '{}'); } catch(e){}
                        setNewSurvey({
                          title: survey.title,
                          question_type: sData.type || 'objective',
                          options: sData.options ? sData.options.join(', ') : '',
                          target_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                        });
                        setTargetStudentIds([]);
                        setActiveFilters({});
                        setIsAddingSurvey(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }} 
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/20 text-yellow-500 border border-yellow-500/30 text-[10px] font-black uppercase rounded hover:bg-yellow-600/40 transition-all"
                    >
                      <Plus size={12} /> 복사
                    </button>
                    <button 
                      onClick={() => setActiveFilters(prev => ({ ...prev, [`expand_${survey.id}`]: isExpanded ? '-' : '+' }))} 
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase rounded transition-all ${isExpanded ? 'bg-purple-600 text-white' : 'bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/40'}`}
                    >
                      {isExpanded ? '닫기' : '결과 열람'}
                    </button>
                    <button onClick={() => handleDownloadExcel(survey.id, survey.title)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 text-green-400 border border-green-500/30 text-[10px] font-black uppercase rounded hover:bg-green-600/40 transition-all">
                      <Download size={12} /> Excel
                    </button>
                    {isAdmin && (
                      <button onClick={() => deleteSurvey(survey.id)} className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* 결과 열람 영역 */}
                {isExpanded && (
                  <div className="border-t border-white/5 bg-black/40 p-4">
                    {/* 객관식 통계 요약 */}
                    {sData.type === 'objective' && sData.options && (
                      <div className="flex gap-2 flex-wrap mb-4 pb-4 border-b border-white/5">
                        {Object.entries(stats).map(([opt, count]) => (
                          <div key={opt} className="px-3 py-2 bg-white/5 rounded border border-white/10 flex items-center gap-2">
                            <span className="text-[11px] text-gray-400">{opt}</span>
                            <span className="text-[12px] font-black text-white">{count}명</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 응답자 목록 */}
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar-v pr-2">
                      {formattedResponses.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 py-4">아직 응답한 학생이 없습니다.</p>
                      ) : (
                        <div className="space-y-1">
                          {formattedResponses.map(res => (
                            <div key={res.id} className="flex items-center justify-between py-2 px-3 hover:bg-white/5 rounded transition-all">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white w-[70px] truncate">{res.studentName}</span>
                                <span className="text-xs text-gray-400 w-[40px]">{res.grade}</span>
                                <span className="text-sm text-purple-300 font-bold ml-2">{res.answer}</span>
                              </div>
                              <span className="text-xs text-gray-400">{res.date}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 미응답자 목록 */}
                    {sData.target_students && (() => {
                      const respondedIds = formattedResponses.map(r => r.studentId);
                      const pendingIds = sData.target_students.filter((id: string) => !respondedIds.includes(id));
                      const pendingStudents = pendingIds.map((id: string) => students.find(s => s.id === id)).filter(Boolean);
                      
                      if (pendingStudents.length === 0) return null;
                      
                      return (
                        <div className="mt-4 pt-4 border-t border-white/5">
                          <h5 className="text-sm font-bold text-red-400 mb-2 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                            미응답 학생 ({pendingStudents.length}명)
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {pendingStudents.map((s: any) => (
                              <span key={s.id} className="text-sm font-bold bg-black text-white border border-red-500/50 px-2.5 py-1 rounded-[3px] shadow-sm flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-red-500"></div>
                                {s.name} <span className="text-xs text-gray-400 font-normal ml-0.5">{s.grade}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
