'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useModalEsc } from '@/hooks/useModalEsc';

interface AddProblemErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacherName: string;
  academyId: string;
  onSuccess: () => void;
}

export default function AddProblemErrorModal({
  isOpen,
  onClose,
  teacherName,
  academyId,
  onSuccess
}: AddProblemErrorModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 💡 [Esc 닫기 공통 적용]
  useModalEsc({
    isOpen,
    onClose,
    isSaving: isSubmitting
  });
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 폼 상태
  const [bookName, setBookName] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [problemId, setProblemId] = useState('');
  const [errorType, setErrorType] = useState('정답 오류');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState(teacherName || '');

  useEffect(() => {
    if (isOpen) {
      setIsSuccess(false);
      setErrorMessage(null);
      setBookName('');
      setPageNumber('');
      setProblemId('');
      setDescription('');
      setReporterName(teacherName || '');
      setErrorType('정답 오류');
    }
  }, [isOpen, teacherName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookName.trim() || !problemId.trim() || !description.trim() || !reporterName.trim()) {
      setErrorMessage('필수 항목을 모두 입력해 주세요.');
      return;
    }

    const defaultTodoList = [
      { id: 'hwp', label: '원본 한글 파일(.hwp) 수정', done: false },
      { id: 'pdf', label: '배포용 PDF 교재 파일 수정', done: false },
      { id: 'video', label: '유튜브 해설 동영상 수정/촬영', done: false },
      { id: 'answer_pdf', label: '정답/해설지 PDF 파일 수정', done: false },
      { id: 'bank', label: '문제은행 사이트 데이터 수정', done: false }
    ];

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.from('ams_problem_errors').insert([
        {
          academy_id: academyId,
          book_name: bookName.trim(),
          page_number: pageNumber.trim() || null,
          problem_id: problemId.trim(),
          reporter_name: reporterName.trim(),
          error_type: errorType,
          description: description.trim(),
          status: '검토중', // 선생님이 직접 등록하는 것은 바로 '검토중' 상태로 시작
          todo_list: defaultTodoList
        }
      ]);

      if (error) throw error;

      setIsSuccess(true);
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error adding problem error:', err);
      setErrorMessage(err.message || '오류 등록 중 에러가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const errorTypes = ['정답 오류', '오타/발문 오류', '그림 오류', '해설/영상 오류', '기타'];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 백드롭 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* 모달 본체 */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-white border border-[#e3e2e0] rounded-xl shadow-2xl overflow-hidden z-10"
          >
            {/* 상단 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#f7f7f5] border-b border-[#e3e2e0]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={16} />
                <h2 className="text-[12px] font-black text-[#37352f] uppercase tracking-widest">새 교재/기출 오류 등록</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-full text-gray-450 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* 본문 */}
            <div className="p-6">
              {isSuccess ? (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                  <CheckCircle2 className="text-emerald-500 animate-bounce" size={48} />
                  <div>
                    <h3 className="text-lg font-black text-[#37352f]">오류 등록 완료</h3>
                    <p className="text-xs text-gray-500 mt-1">대장에 성공적으로 추가되었습니다.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                  {errorMessage && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-750">
                      {errorMessage}
                    </div>
                  )}

                  {/* 등록인 */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-550 uppercase tracking-wider block">등록인 이름</label>
                    <input
                      type="text"
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      placeholder="교사명"
                      className="w-full bg-white border border-[#edece9] rounded-lg px-3 py-2 text-sm text-[#37352f] placeholder-gray-300 focus:border-blue-500 outline-none transition-colors font-bold"
                      required
                    />
                  </div>

                  {/* 교재명 입력 */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-550 uppercase tracking-wider block">교재명 / 기출명</label>
                    <input
                      type="text"
                      value={bookName}
                      onChange={(e) => setBookName(e.target.value)}
                      placeholder="예: 중3 에이급 프린트 2회 또는 RPM 수학(상)"
                      className="w-full bg-white border border-[#edece9] rounded-lg px-3 py-2 text-sm text-[#37352f] placeholder-gray-300 focus:border-blue-500 outline-none transition-colors font-bold"
                      required
                    />
                  </div>

                  {/* 페이지 & 문제 번호 (2열 그리드) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-550 uppercase tracking-wider block">페이지 (선택)</label>
                      <input
                        type="text"
                        value={pageNumber}
                        onChange={(e) => setPageNumber(e.target.value)}
                        placeholder="예: 42p"
                        className="w-full bg-white border border-[#edece9] rounded-lg px-3 py-2 text-sm text-[#37352f] placeholder-gray-300 focus:border-blue-500 outline-none transition-colors font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-550 uppercase tracking-wider block">문제 번호</label>
                      <input
                        type="text"
                        value={problemId}
                        onChange={(e) => setProblemId(e.target.value)}
                        placeholder="예: 5번"
                        className="w-full bg-white border border-[#edece9] rounded-lg px-3 py-2 text-sm text-[#37352f] placeholder-gray-300 focus:border-blue-500 outline-none transition-colors font-bold"
                        required
                      />
                    </div>
                  </div>

                  {/* 오류 유형 */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-550 uppercase tracking-wider block">오류 유형</label>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {errorTypes.map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setErrorType(type)}
                          className={`px-3 py-1 text-[10px] font-black rounded-full border transition-all ${
                            errorType === type
                              ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                              : 'bg-white border border-[#edece9] text-gray-550 hover:bg-gray-100 hover:text-gray-800'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 상세 설명 */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-550 uppercase tracking-wider block">오류 내용 및 메모</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="오류 상세 및 후속 작업에 필요한 내용을 적어주세요.&#13;&#10;예: 4번의 식에 분모 기호 누락됨.&#13;&#10;예: 정답이 4번인데 2번으로 잘못 채점되어 있음."
                      rows={3}
                      className="w-full bg-white border border-[#edece9] rounded-lg p-3 text-sm text-[#37352f] placeholder-gray-300 focus:border-blue-500 outline-none transition-colors resize-none font-medium leading-relaxed"
                      required
                    />
                  </div>

                  {/* 하단 저장 버튼 */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-755 hover:bg-blue-700 disabled:opacity-30 disabled:pointer-events-none text-white text-xs font-black rounded-lg uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          저장 중...
                        </>
                      ) : (
                        '새 오류 등록하기 💾'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
