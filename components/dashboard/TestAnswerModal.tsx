'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { 
  X, CheckCircle2, ChevronRight, Hash, FileText, Send, 
  Loader2, AlertCircle, Video, FileDown, BookOpen, Check, HelpCircle
} from 'lucide-react';

interface TestAnswerModalProps {
  testId: string;
  studentName: string;
  onClose: () => void;
  onSave?: (answers: any) => void;
  reviewData?: Record<string, string>; // 학생이 이미 제출한 답 (리뷰 모드용)
}

interface TestResult {
  completed: boolean;
  score: number;
  correctCount: number;
  totalCount: number;
  answers: Record<string, string>;
}

export default function TestAnswerModal({ testId: initialTestId, studentName, onClose, onSave, reviewData }: TestAnswerModalProps) {
  const [mounted, setMounted] = useState(false);
  
  // 💡 다중 테스트 코드 파싱: M101, M102 또는 M101\nM102 등
  const testIds = (initialTestId || '')
    .split(/[\n,]+/)
    .map(id => id.trim())
    .filter(id => id.length > 0);

  const [testId, setTestId] = useState(testIds[0] || '');
  const [selectedTestId, setSelectedTestId] = useState(testIds[0] || ''); // 💡 현재 활성화된 테스트 ID
  const [testInfo, setTestInfo] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>(reviewData || {});
  const [activeTab, setActiveTab] = useState<'mc' | 'desc'>('mc'); 
  const [scoreMode, setScoreMode] = useState<'score' | 'count'>('score');

  // 💡 각 테스트별 개별 채점 데이터 보관
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReviewMode = !!reviewData;

  useEffect(() => {
    setMounted(true);
  }, []);

  // 💡 수동/자동 로드 함수 (대상 ID 지정 가능)
  const handleLoadTest = async (targetId = selectedTestId) => {
    const trimmedId = targetId?.trim();
    if (!trimmedId || trimmedId.length < 2) {
      if (testIds.length === 0) {
        alert('유효한 시험 코드를 입력해 주세요.');
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tests/${encodeURIComponent(trimmedId)}`);
      const data = await res.json();
      if (data.success) {
        setTestInfo({
          id: trimmedId,
          title: data.title,
          mcCount: data.mcCount,
          mcAnswers: data.mcAnswers || [],
          descCount: data.descCount || 0
        });
        // 이전에 마킹한 답안이 있다면 복원, 없으면 빈 객체
        setAnswers(testResults[trimmedId]?.answers || {});
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
  };

  // 💡 선택된 테스트 ID가 변경될 때마다 자동 로드
  useEffect(() => {
    if (selectedTestId && !reviewData) {
      handleLoadTest(selectedTestId);
    }
  }, [selectedTestId]);

  // 초기 testId가 있고 리뷰 모드가 아닐 때 첫 로드 트리거
  useEffect(() => {
    if (testIds.length > 0 && !reviewData) {
      setSelectedTestId(testIds[0]);
    }
  }, []);

  if (!mounted) return null;

  const handleAnswerChange = (type: 'mc' | 'desc', index: number, value: string) => {
    if (isReviewMode) return;
    const newAnswers = { ...answers, [`${type}_${index}`]: value };
    setAnswers(newAnswers);

    // 💡 현재 활성화된 테스트의 실시간 채점 정보 갱신
    if (testInfo) {
      let correctCount = 0;
      testInfo.mcAnswers.forEach((correctObj: any, i: number) => {
        const correctAns = typeof correctObj === 'string' ? correctObj : correctObj.ans;
        if (newAnswers[`mc_${i}`] === correctAns) correctCount++;
      });
      const mcTotal = testInfo.mcCount || 0;
      const score = mcTotal > 0 ? Math.round((correctCount / mcTotal) * 100) : 0;

      setTestResults(prev => ({
        ...prev,
        [selectedTestId]: {
          completed: true,
          score,
          correctCount,
          totalCount: mcTotal,
          answers: newAnswers
        }
      }));
    }
  };

  const handleSubmit = () => {
    if (!testInfo || !onSave) return;

    // 만약 단일 수동 입력 시험 코드인 경우 로컬 결과를 강제 할당
    let currentResults = { ...testResults };
    if (testIds.length <= 1) {
      let correctCount = 0;
      testInfo.mcAnswers.forEach((correctObj: any, i: number) => {
        const correctAns = typeof correctObj === 'string' ? correctObj : correctObj.ans;
        if (answers[`mc_${i}`] === correctAns) correctCount++;
      });
      const mcTotal = testInfo.mcCount || 0;
      const score = mcTotal > 0 ? Math.round((correctCount / mcTotal) * 100) : 0;

      currentResults[selectedTestId] = {
        completed: true,
        score,
        correctCount,
        totalCount: mcTotal,
        answers
      };
    }

    // 💡 미채점 시험 체크
    const uncompletedIds = testIds.filter(id => !currentResults[id]?.completed);
    if (testIds.length > 1 && uncompletedIds.length > 0) {
      if (!confirm(`아직 채점하지 않은 시험(${uncompletedIds.join(', ')})이 존재합니다.\n이대로 제출하시겠습니까?`)) {
        return;
      }
    }

    const completedList = Object.values(currentResults).filter(r => r.completed);
    if (completedList.length === 0) {
      alert('최소 한 개 이상의 시험을 채점해야 제출할 수 있습니다.');
      return;
    }

    // 💡 모든 완료된 시험의 성적 취합 (평균 점수 및 전체 총 맞은 개수 연산)
    const avgScore = Math.round(completedList.reduce((sum, r) => sum + r.score, 0) / completedList.length);
    const totalCorrect = completedList.reduce((sum, r) => sum + r.correctCount, 0);
    const totalCount = completedList.reduce((sum, r) => sum + r.totalCount, 0);

    const modeText = scoreMode === 'score' ? '점수(점)' : '개수(개)';
    const resultText = scoreMode === 'score' ? `${avgScore}점` : `${totalCorrect}개 / ${totalCount}개`;

    if (confirm(`채점 결과를 제출하시겠습니까?\n표기 방식: ${modeText}\n결과: ${resultText}`)) {
      onSave({ 
        answers: testIds.length > 1 ? currentResults : answers, // 다중 상태 연계
        calculatedScore: avgScore, 
        correctCount: totalCorrect, 
        totalCount: totalCount,
        scoreMode,
        testId: initialTestId // 기존 테스트 코드 그대로 유지
      });
    }
  };

  const modalContent = (() => {
    if (isLoading) return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-[#121212] border border-white/10 p-10 rounded-[4px] flex flex-col items-center gap-4 shadow-2xl">
          <Loader2 className="animate-spin text-blue-500" size={32} />
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Fetching Test Data...</p>
        </div>
      </div>
    );

    if (!testInfo) return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-[#121212] border border-white/10 p-8 rounded-[4px] text-center space-y-6 w-full max-w-sm shadow-2xl">
          {error ? <AlertCircle className="text-red-500 mx-auto" size={40} /> : <Hash className="text-blue-500 mx-auto opacity-50" size={40} />}
          <div className="space-y-1">
            <h3 className="text-white text-sm font-black uppercase tracking-widest">{error ? 'Error' : 'Enter Test ID'}</h3>
            <p className="text-[10px] text-gray-500 font-medium">{error || '상세 채점을 위해 유효한 테스트 번호를 입력하세요.'}</p>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-[2px] px-3 py-2 focus-within:border-blue-500 transition-all">
            <Hash size={14} className="text-gray-500" />
            <input type="text" placeholder="시험 번호 입력 (예: M101)" value={testId} autoFocus 
              onChange={(e) => setTestId(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLoadTest(testId); }}
              className="bg-transparent border-none text-[12px] text-white focus:outline-none w-full font-black uppercase" />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-3 bg-white/5 text-gray-400 text-[10px] font-black uppercase rounded-[2px] hover:bg-white/10 transition-all border border-white/5">Cancel</button>
            <button onClick={() => handleLoadTest(testId)} disabled={isLoading} className="flex-2 py-3 px-6 bg-blue-600 text-white text-[10px] font-black uppercase rounded-[2px] hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 min-w-[100px]">
              {isLoading ? <Loader2 size={12} className="animate-spin" /> : <><CheckCircle2 size={12} /> Find Test</>}
            </button>
          </div>
        </motion.div>
      </div>
    );

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-[#121212] border border-white/10 rounded-[4px] w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          
          <div className="p-4 border-b border-white/5 bg-white/[0.02] flex flex-col gap-3">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-[2px] flex items-center justify-center shadow-lg ${isReviewMode ? 'bg-amber-600' : 'bg-blue-600'}`}>
                  {isReviewMode ? <BookOpen className="text-white" size={20} /> : <Hash className="text-white" size={20} />}
                </div>
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-tight">{testInfo.title}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                      {isReviewMode ? 'Detailed Solution Review' : `Student: ${studentName}`}
                    </p>
                    {!isReviewMode && (
                      <div className="flex bg-black/40 p-0.5 rounded border border-white/10 ml-2">
                        <button onClick={() => setScoreMode('score')} className={`px-2 py-0.5 text-[8px] font-black rounded-[1px] transition-all ${scoreMode === 'score' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}>점수(점)</button>
                        <button onClick={() => setScoreMode('count')} className={`px-2 py-0.5 text-[8px] font-black rounded-[1px] transition-all ${scoreMode === 'count' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}>개수(개)</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {!isReviewMode && testIds.length <= 1 && <button onClick={() => setTestInfo(null)} className="p-2 hover:bg-white/5 rounded-md transition-all text-gray-500 hover:text-white"><Hash size={16} /></button>}
                 <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X size={18} className="text-gray-500" /></button>
              </div>
            </div>
            
            {/* 💡 다중 테스트 선택용 가로 탭바 */}
            {!isReviewMode && testIds.length > 1 && (
              <div className="flex flex-wrap gap-1 pt-2 border-t border-white/5">
                {testIds.map((id) => {
                  const isSelected = selectedTestId === id;
                  const isCompleted = testResults[id]?.completed;
                  const score = testResults[id]?.score;
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedTestId(id)}
                      className={`px-3 py-1.5 rounded-[3px] text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30 scale-[1.02]' 
                          : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      <span>📑</span> {id}
                      {isCompleted && (
                        <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-extrabold ml-1">
                          {scoreMode === 'score' ? `${score}점` : `${testResults[id]?.correctCount}개`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar-v">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: testInfo.mcCount }).map((_, i) => {
                const studentAns = answers[`mc_${i}`];
                const correctObj = testInfo.mcAnswers[i];
                const correctAns = typeof correctObj === 'string' ? correctObj : correctObj?.ans;
                const isCorrect = studentAns === correctAns;
                const hasVideo = correctObj?.video;
                const hasPdf = correctObj?.pdf;
                const hasExplanation = correctObj?.desc;

                return (
                  <div key={i} className={`flex flex-col bg-white/[0.02] border p-4 rounded-[4px] transition-all ${isReviewMode ? (isCorrect ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5') : 'border-white/5 hover:border-white/10'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[12px] font-black uppercase ${isReviewMode ? (isCorrect ? 'text-emerald-500' : 'text-red-500') : 'text-blue-500/60'}`}>Q{i + 1}</span>
                        {isReviewMode && (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                            {isCorrect ? 'CORRECT' : 'INCORRECT'}
                          </span>
                        )}
                      </div>
                      {isReviewMode && !isCorrect && (
                        <div className="text-[10px] font-bold text-gray-400">
                          Correct Answer: <span className="text-emerald-500 font-black">{correctAns}</span>
                        </div>
                      )}
                    </div>

                    {!isReviewMode ? (
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map(num => (
                          <button key={num} onClick={() => handleAnswerChange('mc', i, String(num))}
                            className={`flex-1 h-9 rounded-full text-[13px] font-black transition-all border-2 ${answers[`mc_${i}`] === String(num) ? 'bg-blue-600 border-blue-400 text-white shadow-lg scale-105' : 'bg-white/5 border-white/10 text-gray-600 hover:text-white'}`}>{num}</button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-gray-500 uppercase">My:</span>
                            <span className={`text-[16px] font-black ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>{studentAns || '-'}</span>
                          </div>
                          {!isCorrect && (
                            <div className="flex flex-wrap gap-2 flex-1">
                              {hasVideo && (
                                <button onClick={() => window.open(hasVideo, '_blank')} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-[2px] text-[10px] font-black hover:bg-red-500 transition-all shadow-lg shadow-red-900/20">
                                  <Video size={12} /> Solution Video
                                </button>
                              )}
                              {hasPdf && (
                                <button onClick={() => window.open(hasPdf, '_blank')} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-[2px] text-[10px] font-black hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20">
                                  <FileDown size={12} /> Similar Problems
                                </button>
                              )}
                              {hasExplanation && (
                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white rounded-[2px] text-[10px] font-black hover:bg-white/20 transition-all border border-white/10">
                                  <HelpCircle size={12} /> View Hint
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {hasExplanation && !isCorrect && (
                          <div className="p-3 bg-black/40 rounded border border-white/5 text-[11px] text-gray-300 leading-relaxed font-medium italic">
                            <span className="text-amber-500 font-black uppercase text-[9px] block mb-1">Key Concept:</span>
                            {hasExplanation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-white/5 bg-white/[0.01] flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-[2px] text-[10px] font-black uppercase text-gray-500 hover:bg-white/5 transition-all">Close</button>
            {!isReviewMode && (
              <button onClick={handleSubmit} disabled={!testInfo} className="flex items-center gap-2 px-6 py-2 rounded-[2px] bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all disabled:opacity-30">
                <Send size={12} /> Submit Answers
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  })();

  return createPortal(modalContent, document.body);
}
