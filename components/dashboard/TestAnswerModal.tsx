'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle2, ChevronRight, Hash, FileText, Send, Loader2, AlertCircle } from 'lucide-react';

interface TestAnswerModalProps {
  testId: string;
  studentName: string;
  onClose: () => void;
  onSave: (answers: any) => void;
}

export default function TestAnswerModal({ testId: initialTestId, studentName, onClose, onSave }: TestAnswerModalProps) {
  const [testId, setTestId] = useState(initialTestId || '');
  const [testInfo, setTestInfo] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'mc' | 'desc'>('mc'); 

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 💡 API를 통해 실제 시험 정보를 가져옵니다.
  useEffect(() => {
    async function fetchTestInfo() {
      // 💡 쉼표(,)나 괄호가 포함된 경우(멀티 테스트)는 유효한 단일 ID가 아니라고 판단
      const isValidId = testId && testId.length >= 2 && !testId.includes(',') && !testId.includes('(');
      
      if (!isValidId) {
        setTestInfo(null);
        setError(null);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/tests/${encodeURIComponent(testId.trim())}`);
        const data = await res.json();
        if (data.success) {
          setTestInfo({
            title: data.title,
            mcCount: data.mcAnswers?.length || 0,
            descCount: data.descCount || 0,
            mcAnswers: data.mcAnswers || []
          });
        } else {
          setError(data.error || '시험 정보를 찾을 수 없습니다.');
          setTestInfo(null);
        }
      } catch (e) {
        setError('서버 연동 중 오류가 발생했습니다.');
        setTestInfo(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTestInfo();
  }, [testId]);

  const handleAnswerChange = (type: 'mc' | 'desc', index: number, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [`${type}_${index}`]: value
    }));
  };

  const handleSubmit = () => {
    if (!testInfo) return;

    let correctCount = 0;
    if (testInfo.mcAnswers) {
      testInfo.mcAnswers.forEach((correct: string, i: number) => {
        if (answers[`mc_${i}`] === correct) correctCount++;
      });
    }

    const mcTotal = testInfo.mcCount || 0;
    const score = mcTotal > 0 ? Math.round((correctCount / mcTotal) * 100) : 0;

    if (confirm(`객관식 ${mcTotal}문항 중 ${correctCount}문항 정답입니다.\n예상 점수: ${score}점\n제출하시겠습니까?`)) {
      onSave({ 
        answers, 
        calculatedScore: score,
        correctCount,
        testId: testId.trim()
      });
    }
  };

  if (isLoading) return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#121212] border border-white/10 p-10 rounded-[4px] flex flex-col items-center gap-4 shadow-2xl">
        <Loader2 className="animate-spin text-blue-500" size={32} />
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Fetching Test Metadata...</p>
      </div>
    </div>
  );

  // 💡 에러 발생 시 또는 정보가 없을 때 ID 수동 입력을 허용하는 통합 UI
  if (error || !testInfo) return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#121212] border border-white/10 p-8 rounded-[4px] text-center space-y-6 w-full max-w-sm shadow-2xl">
        {error ? <AlertCircle className="text-red-500 mx-auto" size={40} /> : <Hash className="text-blue-500 mx-auto opacity-50" size={40} />}
        
        <div className="space-y-1">
          <h3 className="text-white text-sm font-black uppercase tracking-widest">{error ? 'Error' : 'Enter Test ID'}</h3>
          <p className="text-[10px] text-gray-500 font-medium">{error || '상세 채점을 위해 유효한 테스트 번호를 입력하세요.'}</p>
        </div>

        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-[2px] px-3 py-2">
          <Hash size={14} className="text-gray-500" />
          <input 
            type="text"
            placeholder="시험 번호 입력 (예: 1001)"
            value={testId}
            autoFocus
            onChange={(e) => setTestId(e.target.value)}
            className="bg-transparent border-none text-[12px] text-white focus:outline-none w-full font-black"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 bg-white/5 text-gray-400 text-[10px] font-black uppercase rounded-[2px] hover:bg-white/10 transition-all border border-white/5">Cancel</button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#121212] border border-white/10 rounded-[4px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* 헤더 */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-[2px] flex items-center justify-center shadow-lg">
              <Hash className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-tight">{testInfo.title}</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                Student: <span className="text-blue-400">{studentName}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => setTestInfo(null)} className="p-2 hover:bg-white/5 rounded-md transition-all text-gray-500 hover:text-white" title="다른 시험 번호 입력">
                <Hash size={16} />
             </button>
             <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X size={18} className="text-gray-500" />
             </button>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div className="flex border-b border-white/5 px-4">
          <button 
            onClick={() => setActiveTab('mc')}
            className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'mc' ? 'border-blue-500 text-white' : 'border-transparent text-gray-600'}`}
          >
            Multiple Choice ({testInfo.mcCount})
          </button>
          <button 
            onClick={() => setActiveTab('desc')}
            className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'desc' ? 'border-blue-500 text-white' : 'border-transparent text-gray-600'}`}
          >
            Descriptive ({testInfo.descCount})
          </button>
        </div>

        {/* 입력 영역 */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar-v">
          {activeTab === 'mc' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
              {Array.from({ length: testInfo.mcCount }).map((_, i) => (
                <div key={i} className="flex items-center justify-between bg-white/[0.02] border border-white/5 p-3 rounded-[4px] hover:border-white/10 transition-colors">
                  <label className="text-[11px] font-black text-gray-500 uppercase w-8">Q{i + 1}</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(num => (
                      <button
                        key={num}
                        onClick={() => handleAnswerChange('mc', i, String(num))}
                        className={`w-10 h-10 rounded-[4px] text-[13px] font-black transition-all border-2 ${
                          answers[`mc_${i}`] === String(num) 
                            ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-110' 
                            : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from({ length: testInfo.descCount }).map((_, i) => (
                <div key={i} className="space-y-2 group">
                  <div className="flex items-center gap-2">
                    <FileText size={12} className="text-blue-500" />
                    <label className="text-[10px] font-black text-gray-400 uppercase">Descriptive Question {i + 1}</label>
                  </div>
                  <textarea
                    rows={3}
                    value={answers[`desc_${i}`] || ''}
                    onChange={(e) => handleAnswerChange('desc', i, e.target.value)}
                    placeholder="답안을 입력하세요..."
                    className="w-full bg-white/[0.03] border border-white/5 rounded-[2px] p-3 text-xs text-white focus:outline-none focus:border-blue-500 transition-all resize-none group-hover:border-white/10"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-white/5 bg-white/[0.01] flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-[2px] text-[10px] font-black uppercase text-gray-500 hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!testInfo}
            className="flex items-center gap-2 px-6 py-2 rounded-[2px] bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all disabled:opacity-30 disabled:grayscale"
          >
            <Send size={12} />
            Submit Answers
          </button>
        </div>
      </motion.div>
    </div>
  );
}
