'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Hash, FileText, Plus, Trash2, Video, FileDown, BookOpen, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface QuestionSolution {
  ans: string;
  video: string;
  pdf: string;
  desc: string;
}

interface TestContentEditorProps {
  test?: any; // null이면 신규 등록
  onSave: () => void;
  onClose: () => void;
}

export default function TestContentEditor({ test, onSave, onClose }: TestContentEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    test_code: '',
    title: '',
    total_questions: 10,
    answers: [] as QuestionSolution[]
  });

  useEffect(() => {
    if (test) {
      // 💡 기존 데이터 파싱 (단순 문자열 배열인 경우 호환성 처리)
      const rawAnswers = test.answers || [];
      const formattedAnswers = Array.from({ length: test.total_questions }).map((_, i) => {
        const item = rawAnswers[i];
        if (typeof item === 'string') return { ans: item, video: '', pdf: '', desc: '' };
        return { 
          ans: item?.ans || '', 
          video: item?.video || '', 
          pdf: item?.pdf || '', 
          desc: item?.desc || '' 
        };
      });

      setFormData({
        test_code: test.test_code,
        title: test.title,
        total_questions: test.total_questions,
        answers: formattedAnswers
      });
    } else {
      // 💡 신규 등록 시 초기값
      setFormData({
        test_code: '',
        title: '',
        total_questions: 10,
        answers: Array.from({ length: 10 }).map(() => ({ ans: '', video: '', pdf: '', desc: '' }))
      });
    }
  }, [test]);

  const handleTotalQuestionsChange = (count: number) => {
    const num = Math.max(1, Math.min(100, count));
    const newAnswers = [...formData.answers];
    if (num > newAnswers.length) {
      for (let i = newAnswers.length; i < num; i++) {
        newAnswers.push({ ans: '', video: '', pdf: '', desc: '' });
      }
    } else {
      newAnswers.splice(num);
    }
    setFormData({ ...formData, total_questions: num, answers: newAnswers });
  };

  const updateQuestion = (index: number, updates: Partial<QuestionSolution>) => {
    const newAnswers = [...formData.answers];
    newAnswers[index] = { ...newAnswers[index], ...updates };
    setFormData({ ...formData, answers: newAnswers });
  };

  const handleSave = async () => {
    if (!formData.test_code.trim() || !formData.title.trim()) {
      alert('테스트 코드와 제목을 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const dbData = {
        test_code: formData.test_code.trim(),
        title: formData.title.trim(),
        total_questions: formData.total_questions,
        answers: formData.answers
      };

      let error;
      if (test?.id) {
        const { error: err } = await supabase.from('ams_tests').update(dbData).eq('id', test.id);
        error = err;
      } else {
        const { error: err } = await supabase.from('ams_tests').insert([dbData]);
        error = err;
      }

      if (error) throw error;
      alert('테스트 정보가 저장되었습니다.');
      onSave();
      onClose();
    } catch (e: any) {
      console.error(e);
      alert(e.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0a0a0a] border border-white/10 rounded-lg w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-[4px] flex items-center justify-center shadow-lg">
              <BookOpen className="text-white" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">{test ? 'Edit Test Solutions' : 'Register New Test'}</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Configure questions and learning resources</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-all"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* 좌측: 기본 정보 설정 */}
          <div className="w-full md:w-80 p-8 border-r border-white/5 space-y-8 bg-black/20">
            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Test Code</label>
                <div className="relative">
                  <input value={formData.test_code} onChange={e => setFormData({ ...formData, test_code: e.target.value })}
                    className="w-full bg-black border border-white/10 rounded-[2px] px-4 py-3 text-sm font-black text-blue-400 outline-none focus:border-blue-500 transition-all" placeholder="예: M101" />
                  <Hash className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Test Title</label>
                <div className="relative">
                  <input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-black border border-white/10 rounded-[2px] px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500 transition-all" placeholder="예: 중1-1 정수와 유리수" />
                  <FileText className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Total Questions</label>
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-[2px] border border-white/5">
                  <input type="range" min="1" max="50" value={formData.total_questions} onChange={e => handleTotalQuestionsChange(parseInt(e.target.value))} className="flex-1 accent-blue-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                  <span className="text-xl font-black text-white tabular-nums w-8 text-center">{formData.total_questions}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-[4px] space-y-3">
              <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Guide</h4>
              <p className="text-[11px] text-gray-400 leading-relaxed font-medium">
                각 문항별로 정답(1~5)을 입력하고, 학생들이 오답 시 공부할 수 있는 유튜브 영상 링크나 유사문제 PDF 링크를 등록할 수 있습니다.
              </p>
            </div>
          </div>

          {/* 우측: 문항별 상세 설정 */}
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar-v space-y-6">
            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Question Details & Solutions</h4>
            <div className="grid grid-cols-1 gap-4">
              {formData.answers.map((q, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/5 rounded-[4px] p-6 hover:border-white/10 transition-all group">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* 문항 번호 및 정답 선택 */}
                    <div className="shrink-0 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[12px] font-black text-blue-500">Q{i + 1}</span>
                        <span className="text-[10px] font-black text-gray-600 uppercase">Answer</span>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(num => (
                          <button key={num} onClick={() => updateQuestion(i, { ans: String(num) })}
                            className={`w-10 h-10 rounded-[2px] text-[14px] font-black transition-all border-2 ${q.ans === String(num) ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-black border-white/5 text-gray-700 hover:text-gray-400'}`}>{num}</button>
                        ))}
                      </div>
                    </div>

                    {/* 솔루션 링크 및 해설 */}
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-[9px] font-black text-red-500/70 uppercase tracking-tighter"><Video size={12} /> Video Solution URL</div>
                          <input value={q.video} onChange={e => updateQuestion(i, { video: e.target.value })}
                            className="w-full bg-black/60 border border-white/5 rounded-[2px] px-3 py-2 text-[11px] text-gray-300 outline-none focus:border-red-500/50 transition-all" placeholder="YouTube 주소를 붙여넣으세요" />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-[9px] font-black text-blue-500/70 uppercase tracking-tighter"><FileDown size={12} /> Similar Problem PDF</div>
                          <input value={q.pdf} onChange={e => updateQuestion(i, { pdf: e.target.value })}
                            className="w-full bg-black/60 border border-white/5 rounded-[2px] px-3 py-2 text-[11px] text-gray-300 outline-none focus:border-blue-500/50 transition-all" placeholder="PDF 파일 주소를 입력하세요" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[9px] font-black text-gray-500 uppercase tracking-tighter">Key Explanation / Hint</div>
                        <textarea value={q.desc} onChange={e => updateQuestion(i, { desc: e.target.value })}
                          className="w-full bg-black/60 border border-white/5 rounded-[2px] px-3 py-3 text-[11px] text-gray-300 outline-none focus:border-white/20 transition-all h-[84px] resize-none leading-relaxed" placeholder="간단한 풀이 핵심이나 힌트를 입력하세요" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="p-6 border-t border-white/5 bg-white/[0.02] flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 rounded-[2px] text-xs font-black uppercase text-gray-500 hover:bg-white/5 transition-all">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-10 py-3 rounded-[2px] bg-blue-600 text-white text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-900/40 hover:bg-blue-500 transition-all active:scale-[0.98]">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Save Test Content</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Loader2({ size, className }: { size?: number, className?: string }) {
  return <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className={className}><Hash size={size} /></motion.div>;
}
