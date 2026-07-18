import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, CheckSquare, Square, XCircle } from 'lucide-react';
import { parseInlineTests } from '@/lib/utils';

export default function ApprovalModal({
  pendingStudents,
  onClose,
  onApprove,
  onReject
}: {
  pendingStudents: any[];
  onClose: () => void;
  onApprove: (studentIds: string[]) => Promise<void>;
  onReject: (studentIds: string[]) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(pendingStudents.map(s => s.id));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const toggleAll = () => {
    if (selectedIds.length === pendingStudents.length) setSelectedIds([]);
    else setSelectedIds(pendingStudents.map(s => s.id));
  };

  const toggleStudent = (id: string) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(x => x !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const handleApprove = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);
    await onApprove(selectedIds);
    setIsProcessing(false);
  };

  const handleReject = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm("선택한 학생의 제출을 반려하시겠습니까? (학생이 다시 수정할 수 있게 됩니다)")) return;
    setIsProcessing(true);
    await onReject(selectedIds);
    setIsProcessing(false);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Check className="text-emerald-400" />
              학생 제출 검사 대기록
            </h2>
            <p className="text-[11px] text-gray-400 mt-1">총 {pendingStudents.length}명의 학생이 제출했습니다.</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2">
          <button onClick={toggleAll} className="flex items-center gap-2 mb-4 text-emerald-400 text-[11px] font-black uppercase hover:text-emerald-300">
            {selectedIds.length === pendingStudents.length ? <CheckSquare size={16} /> : <Square size={16} />}
            전체 선택
          </button>
          
          {pendingStudents.map(s => {
            const isSelected = selectedIds.includes(s.id);
            return (
              <div key={s.id} className="flex flex-col gap-2">
                <div 
                  onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-4 ${
                    isSelected ? 'bg-emerald-600/10 border-emerald-500/30' : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div 
                    className={`shrink-0 cursor-pointer ${isSelected ? 'text-emerald-400' : 'text-gray-500'}`}
                    onClick={(e) => { e.stopPropagation(); toggleStudent(s.id); }}
                  >
                    {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                  </div>
                  <div>
                    <h3 className="text-[14px] font-black text-white">{s.name}</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">{s.school} {s.course}</p>
                  </div>
                  <div className="ml-auto text-right text-[11px]">
                    <span className="text-gray-400 font-bold bg-white/5 px-2 py-1 rounded">
                      {expandedId === s.id ? '접기 ▲' : '상세보기 ▼'}
                    </span>
                  </div>
                </div>

                {expandedId === s.id && (
                  <div className="p-4 bg-black/40 border border-white/5 rounded-xl ml-8 animate-in slide-in-from-top-2 text-[12px] space-y-3">
                    <div>
                      <span className="text-emerald-400 font-bold">학원공부 / 오답고치기</span>
                      <p className="text-gray-300 mt-1 whitespace-pre-wrap">{s.todaySession?.completed_classwork_text || '-'}</p>
                    </div>
                    <div>
                      <span className="text-blue-400 font-bold">집에서 할 숙제</span>
                      <p className="text-gray-300 mt-1 whitespace-pre-wrap">{s.todaySession?.homework_text || '-'}</p>
                    </div>
                    <div className="flex flex-wrap gap-6 border-t border-white/10 pt-3">
                      <div>
                        <span className="text-gray-400 font-bold">오늘 달성률</span>
                        <p className="text-white font-black mt-0.5">{s.todaySession?.todo_achievement || 0}%</p>
                      </div>
                      <div className="flex-1 min-w-[150px]">
                        <span className="text-gray-400 font-bold">테스트 결과</span>
                        {s.todaySession?.test_id ? (
                          <div className="mt-0.5">
                            {(() => {
                              const parsed = parseInlineTests(s.todaySession.test_id);
                              if (parsed && parsed.length > 0) {
                                return parsed.map((t, idx) => {
                                  const isPending = t.numericScore === null;
                                  const scoreColor = isPending ? 'text-gray-500' : (t.isPass ? 'text-blue-400' : 'text-rose-400');
                                  return (
                                    <div key={idx} className="mt-1 first:mt-0">
                                      <p className="text-white font-bold truncate">{t.name}</p>
                                      <p className="text-[11px] mt-0.5">
                                        {t.maxScore === 100 ? (
                                          <span className={`font-black ${scoreColor}`}>
                                            {isPending ? '채점 전' : `${t.numericScore}점`}
                                            {t.explicitCut ? ` (커트라인 ${t.explicitCut}점)` : ''}
                                          </span>
                                        ) : (
                                          <span className={`font-black ${scoreColor}`}>
                                            {isPending ? '채점 전' : `${t.numericScore} / ${t.maxScore}`}
                                            {t.explicitCut !== null ? ` (커트라인 ${t.explicitCut}개)` : ''}
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  );
                                });
                              }

                              // 인라인 포맷이 아닌 일반 입력일 경우 기존 로직 수행
                              return (
                                <>
                                  <p className="text-white font-bold truncate">{s.todaySession.test_id}</p>
                                  <p className="text-[11px] mt-0.5">
                                    {s.todaySession.test_score !== undefined && s.todaySession.test_score !== null ? (
                                      <span className={`font-black ${
                                        s.todaySession.test_cut !== undefined && s.todaySession.test_score >= s.todaySession.test_cut 
                                          ? 'text-blue-400' : 'text-rose-400'
                                      }`}>
                                        {s.todaySession.test_score}점 
                                        {s.todaySession.test_cut ? ` (커트라인 ${s.todaySession.test_cut}점)` : ''}
                                      </span>
                                    ) : (
                                      <span className="text-gray-500">결과 미입력</span>
                                    )}
                                  </p>
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <p className="text-gray-500 font-bold mt-0.5">배정된 테스트 없음</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 sm:p-6 border-t border-white/10 flex gap-3">
          <button 
            onClick={handleReject} 
            disabled={selectedIds.length === 0 || isProcessing}
            className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black rounded-xl transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <XCircle size={18} />
            선택 반려 (퇴짜)
          </button>
          <button 
            onClick={handleApprove} 
            disabled={selectedIds.length === 0 || isProcessing}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <Check size={18} />
            {selectedIds.length}명 일괄 검사 완료
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
