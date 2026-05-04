'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle2, ChevronRight, Hash, FileText, Send } from 'lucide-react';

interface TestAnswerModalProps {
  testId: string;
  studentName: string;
  onClose: () => void;
  onSave: (answers: any) => void;
}

export default function TestAnswerModal({ testId, studentName, onClose, onSave }: TestAnswerModalProps) {
  const [testInfo, setTestInfo] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'mc' | 'desc'>('mc'); // Multiple Choice or Descriptive

  // 목업 데이터: 실제로는 API를 통해 고유번호에 해당하는 시험 정보를 가져옵니다.
  useEffect(() => {
    if (testId) {
      // 예시: 고유번호에 따라 문항 수 조절 (나중에 API 연동)
      const mcCount = 20; // 객관식 20개
      const descCount = 5; // 서술형 5개
      setTestInfo({
        title: `테스트 #${testId}`,
        mcCount,
        descCount
      });
    }
  }, [testId]);

  const handleAnswerChange = (type: 'mc' | 'desc', index: number, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [`${type}_${index}`]: value
    }));
  };

  if (!testInfo) return null;

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
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {Array.from({ length: testInfo.mcCount }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <label className="text-[9px] font-black text-gray-600 uppercase">Q{i + 1}</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(num => (
                      <button
                        key={num}
                        onClick={() => handleAnswerChange('mc', i, String(num))}
                        className={`w-7 h-7 rounded-[2px] text-[10px] font-black transition-all border ${
                          answers[`mc_${i}`] === String(num) 
                            ? 'bg-blue-600 border-blue-500 text-white shadow-lg' 
                            : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/20'
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
            onClick={() => onSave(answers)}
            className="flex items-center gap-2 px-6 py-2 rounded-[2px] bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all"
          >
            <Send size={12} />
            Submit Answers
          </button>
        </div>
      </motion.div>
    </div>
  );
}
