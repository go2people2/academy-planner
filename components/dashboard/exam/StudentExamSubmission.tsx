'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { ExamPaper, ExamSubmission } from '@/types/exam';
import { 
  FileText, CheckCircle2, ChevronRight, Hash, Send, 
  Loader2, AlertCircle, HelpCircle, Check, ArrowLeft, RefreshCw, BookOpen, ExternalLink, Video,
  Camera
} from 'lucide-react';

import { useStudentExamSubmission } from './hooks/useStudentExamSubmission';

interface StudentExamSubmissionProps {
  academyId: string;
  studentId: string;
  studentName: string;
  studentGrade?: string;
  assignedExamId?: string; // 💡 추가: 오늘 배정된 시험 ID
  sessionDate?: string;     // 💡 추가: 오늘 날짜
}

export default function StudentExamSubmission({ 
  academyId, 
  studentId, 
  studentName, 
  studentGrade, 
  assignedExamId,
  sessionDate
}: StudentExamSubmissionProps) {

  const {
    exams,
    selectedExam,
    setSelectedExam,
    answers,
    backupAnswers,
    submitting,
    loadingExams,
    searchTerm,
    setSearchTerm,
    selectedGrade,
    setSelectedGrade,
    isScanning,
    fileInputRef,
    directFileInputRef,
    handleFileChange,
    handleDirectFileChange,
    submission,
    checkingStatus,
    incorrectResolved,
    examStats,
    activeSubTab,
    setActiveSubTab,
    mySubmissions,
    handleClearAnswers,
    handleRestoreAnswers,
    toggleIncorrectResolved,
    handleRefreshStatus,
    handleSelectSubmission,
    filteredExams,
    gradeOptions,
    handleMark,
    handleShortAnswerChange,
    handleSubmitAnswers,
  } = useStudentExamSubmission({
    academyId,
    studentId,
    studentName,
    studentGrade,
    assignedExamId,
    sessionDate,
  });

  // 버블 스타일 색상 매핑
  const getBubbleStyle = (qNum: number, choice: number) => {
    if (submission) {
      // 제출 후 뷰 모드
      const qKey = qNum.toString();
      const studentVal = answers[qKey];
      const isSelected = Array.isArray(studentVal) 
        ? studentVal.includes(choice) 
        : Number(studentVal) === choice;

      if (isSelected) {
        return "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20";
      }
      return "border-white/10 text-gray-400 bg-white/5 cursor-not-allowed";
    }

    // 작성 중 뷰 모드
    const qKey = qNum.toString();
    const studentVal = answers[qKey];
    const isSelected = Array.isArray(studentVal) 
      ? studentVal.includes(choice) 
      : Number(studentVal) === choice;

    if (isSelected) {
      return "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-105";
    }
    return "border-white/30 text-gray-200 bg-white/[0.04] hover:bg-white/10 hover:border-white/50 cursor-pointer";
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-6 relative">
      
      {/* ⚡ 스캐닝 진행 중 로딩 레이어 (화면 전체 덮기) */}
      {isScanning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-[3px] z-[9999] flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-emerald-400" size={38} />
          <div className="text-center space-y-1 px-4">
            <p className="text-[14px] font-black text-white">AI OMR 사진 스캔 중...</p>
            <p className="text-[11px] text-gray-400">인공지능이 이미지에서 시험 고유번호 및 마킹 정보를 정밀 분석하고 있습니다. (약 3초 소요)</p>
          </div>
        </div>
      )}
      
      {/* 1. 시험지 선택 목록 뷰 */}
      {!selectedExam && (
        <div className="space-y-4">
          {/* 숨겨진 자동 매칭용 파일 인풋 */}
          <input 
            type="file" 
            ref={directFileInputRef} 
            onChange={handleDirectFileChange} 
            accept="image/*" 
            className="hidden" 
          />

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0a0a0a]/60 border border-white/5 p-4 rounded-xl">
            <div>
              <h2 className="text-[16px] font-black text-white flex items-center gap-2">
                <BookOpen className="text-blue-500" size={18} />
                답안 제출 및 결과 조회
              </h2>
              <p className="text-[11px] text-gray-400 mt-1">
                학원 테스트 또는 학교 기출 시험지를 선택하여 OMR 정답을 마킹해 제출하거나, 지난 시험의 채점 결과를 확인하세요.
              </p>
            </div>
            
            {/* 💡 서브 탭 바 */}
            <div className="flex bg-black/60 p-1 rounded-lg border border-white/5 w-full md:w-auto items-center gap-1">
              {/* 📷 상시 노출 다이렉트 OMR 스캔 버튼 */}
              <button
                type="button"
                disabled={isScanning}
                onClick={() => directFileInputRef.current?.click()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-black transition-all shadow-md shadow-emerald-950/20 active:scale-95 flex items-center gap-1 shrink-0"
              >
                <Camera size={12} />
                OMR 스캔
              </button>
              
              <div className="w-px h-4 bg-white/10 mx-1 shrink-0"></div>

              <button
                onClick={() => setActiveSubTab('papers')}
                className={`flex-1 md:flex-initial px-4 py-1.5 rounded-md text-[11px] font-black transition-all ${
                  activeSubTab === 'papers'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                📝 새 시험 제출
              </button>
              <button
                onClick={() => setActiveSubTab('history')}
                className={`flex-1 md:flex-initial px-4 py-1.5 rounded-md text-[11px] font-black transition-all ${
                  activeSubTab === 'history'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                📊 내 시험 결과 목록 ({mySubmissions.length})
              </button>
            </div>
          </div>

          {activeSubTab === 'papers' ? (
            <>
              {loadingExams ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="animate-spin text-blue-500" size={24} />
                  <span className="text-[11px] text-gray-500 tracking-wider font-bold">오늘의 테스트 불러오는 중...</span>
                </div>
              ) : exams.length === 0 ? (
                <div className="text-center py-16 bg-[#0a0a0a]/20 border border-white/5 rounded-xl space-y-6">
                  <div>
                    <AlertCircle className="mx-auto text-gray-600 mb-2.5" size={30} />
                    <p className="text-[13px] text-gray-400 font-bold">오늘 배정된 테스트가 없습니다.</p>
                    <p className="text-[11px] text-gray-600 mt-1">선생님께 시험지 배정을 요청하시거나 아래 다이렉트 스캔을 이용하세요.</p>
                  </div>

                  <div className="w-px h-6 bg-white/10 mx-auto"></div>

                  <div className="max-w-sm mx-auto bg-white/[0.02] border border-white/5 p-5 rounded-xl space-y-4">
                    <div>
                      <h4 className="text-[12px] font-black text-white">📷 종이 OMR 카드 바로 스캔 채점</h4>
                      <p className="text-[10px] text-gray-500 mt-1">시험지를 선택하지 않고도, OMR 카드 상단에 마킹된 시험 고유번호를 판독해 채점합니다.</p>
                    </div>
                    
                    <input 
                      type="file" 
                      ref={directFileInputRef} 
                      onChange={handleDirectFileChange} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    <button
                      type="button"
                      disabled={isScanning}
                      onClick={() => directFileInputRef.current?.click()}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[12px] font-extrabold transition-all shadow-lg shadow-emerald-950/20 active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Camera size={14} />
                      OMR 사진 스캔 즉시 채점
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-[12px] font-extrabold text-gray-400">
                    오늘 해결할 시험지
                  </div>
                  {exams.map(exam => {
                    const existingSub = mySubmissions.find(sub => sub.exam_id === exam.id);
                    return (
                      <div 
                        key={exam.id} 
                        onClick={() => setSelectedExam(exam)}
                        className="group bg-[#0d0d0d] border border-white/5 hover:border-blue-500/40 hover:bg-blue-950/5 p-5 rounded-xl transition-all cursor-pointer flex justify-between items-center"
                      >
                        <div className="space-y-2 flex-1 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] bg-blue-600/10 text-blue-400 px-2 py-0.5 rounded-[4px] font-black border border-blue-500/20">
                              {exam.grade || '공통'}
                            </span>
                            <span className="text-[10px] text-gray-500 font-bold">
                              {exam.year}년 {exam.semester}
                            </span>
                            {existingSub && (
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-black">
                                제출 완료 - {existingSub.total_score}점
                              </span>
                            )}
                          </div>
                          <h3 className="text-[14px] font-black text-white group-hover:text-blue-400 transition-colors leading-tight">
                            {exam.title}
                          </h3>
                          <p className="text-[11px] text-gray-500 font-medium">
                            {exam.school || '학원 자체'} | {exam.question_count}문항 구성
                          </p>
                        </div>
                        <ChevronRight className="text-gray-600 group-hover:text-blue-400 transition-all group-hover:translate-x-1 shrink-0" size={20} />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* 💡 내가 제출한 시험 결과 목록 */
            <div className="space-y-4">
              <div className="text-[12px] font-extrabold text-gray-400">
                내가 완료한 시험 이력 ({mySubmissions.length}개)
              </div>

              {mySubmissions.length === 0 ? (
                <div className="text-center py-20 bg-[#0a0a0a]/20 border border-white/5 rounded-xl">
                  <FileText className="mx-auto text-gray-600 mb-3" size={32} />
                  <p className="text-[13px] text-gray-400 font-bold">아직 제출한 시험이 없습니다.</p>
                  <p className="text-[11px] text-gray-600 mt-1">새 시험 탭에서 답안을 마킹해 제출해 보세요.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mySubmissions.map(sub => {
                    const paper = sub.ams_exam_papers;
                    const dateStr = new Date(sub.submitted_at).toLocaleDateString('ko-KR', {
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    
                    return (
                      <div
                        key={sub.id}
                        onClick={() => handleSelectSubmission(sub)}
                        className="group bg-[#0d0d0d] border border-white/5 hover:border-blue-500/40 hover:bg-blue-950/5 p-4 rounded-xl transition-all cursor-pointer flex justify-between items-center"
                      >
                        <div className="space-y-1.5 flex-1 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] bg-blue-600/10 text-blue-400 px-2 py-0.5 rounded-[4px] font-black border border-blue-500/20">
                              {paper?.grade || '공통'}
                            </span>
                            <span className="text-[10px] text-gray-500 font-bold">
                              {paper?.year}년 {paper?.semester || ''}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black border ${
                              sub.reveal_answers 
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            }`}>
                              {sub.reveal_answers ? '🔓 정답 공개' : '🔒 정답 비공개'}
                            </span>
                          </div>
                          
                          <h3 className="text-[13px] font-black text-white group-hover:text-blue-400 transition-colors leading-tight">
                            {paper?.title || `${paper?.year}년 ${paper?.semester || ''} ${paper?.subject || '시험지'}`}
                          </h3>
                          
                          <div className="flex items-center gap-4 text-[11px] text-gray-500">
                            <span>제출: {dateStr}</span>
                            <span>|</span>
                            <span className="font-extrabold text-blue-400">
                              득점: {sub.total_score}점 (오답 {sub.wrong_questions?.length || 0}개)
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="text-gray-600 group-hover:text-blue-400 transition-all group-hover:translate-x-1 shrink-0" size={18} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. OMR 답안 마킹 및 결과 뷰 */}
      {selectedExam && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-[#0a0a0a]/60 border border-white/5 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedExam(null)}
                className="p-2 bg-white/5 border border-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
                title="시험지 목록으로 돌아가기"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-blue-600/10 text-blue-400 px-2 py-0.5 rounded-[4px] font-black border border-blue-500/20">
                    {selectedExam.grade}
                  </span>
                  <span className="text-[10px] text-gray-500 font-bold">
                    {selectedExam.school || '학원 자체'}
                  </span>
                </div>
                <h2 className="text-[14px] font-black text-white mt-1">
                  {selectedExam.title} <span className="text-[12px] font-bold text-gray-400 ml-1">({selectedExam.question_count}문항)</span>
                </h2>
              </div>
            </div>

            {submission && (
              <button 
                onClick={handleRefreshStatus}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/30 rounded-md text-[11px] font-extrabold transition-all shadow-md shadow-blue-900/20 active:scale-95"
                title="정답 공개 승인 여부 실시간 업데이트"
              >
                <RefreshCw size={12} className={checkingStatus ? "animate-spin text-white" : "text-blue-100"} />
                정답공개
              </button>
            )}
          </div>

          {checkingStatus && !submission ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="animate-spin text-blue-500" size={24} />
              <span className="text-[11px] text-gray-500 tracking-wider font-bold">CHECKING SUBMISSION STATUS...</span>
            </div>
          ) : submission ? (
            /* 💡 2-A. 제출 완료 리포트 화면 (정답/해설 공개 제어 포함) */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* 리포트 대시보드 카드 */}
              <div className="lg:col-span-1 bg-[#0a0a0a]/60 border border-white/10 p-3.5 rounded-xl space-y-4.5 h-fit">
                {/* 💡 [수정] 제출 완료 리포트 글씨 제거 후 실시간 학원 통계 패널 렌더링 */}
                <div className="py-2.5 border-b border-white/5 space-y-1.5">
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest block text-center">
                    학원 전체 응시 통계 ({examStats?.count || 0}명)
                  </span>
                  {examStats ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-left text-[11px] text-gray-400 font-bold px-1 pt-1">
                      <div className="flex justify-between border-r border-white/5 pr-2">
                        <span>평균:</span>
                        <span className="text-blue-300">{examStats.average}점</span>
                      </div>
                      <div className="flex justify-between pl-1">
                        <span>최고점:</span>
                        <span className="text-emerald-300">{examStats.max}점</span>
                      </div>
                      <div className="flex justify-between border-r border-white/5 pr-2">
                        <span>최저점:</span>
                        <span className="text-rose-300">{examStats.min}점</span>
                      </div>
                      <div className="flex justify-between pl-1">
                        <span>표준편차:</span>
                        <span className="text-purple-300">±{examStats.stdDev}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-600 italic text-center py-1 font-bold">통계 정보를 계산하고 있습니다...</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="bg-white/[0.02] border border-white/5 p-3 rounded-lg text-center">
                    <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">자동채점 총점</span>
                    <p className="text-[32px] font-black text-blue-400 mt-1.5 leading-none">{submission.total_score}점</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 p-3 rounded-lg text-center">
                    <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">틀린 문항</span>
                    <p className="text-[32px] font-black text-rose-400 mt-1.5 leading-none">{submission.wrong_questions?.length || 0}개</p>
                  </div>
                </div>
              </div>

              {/* 제출 답안 채점 디테일 상세 목록 */}
              <div className="lg:col-span-2 bg-[#0d0d0d] border border-white/5 rounded-xl p-5 space-y-4">
                <h3 className="text-[13px] font-black text-white pb-3 border-b border-white/5">문항별 채점 분석</h3>
                
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar-v">
                  {Array.from({ length: selectedExam.question_count }, (_, index) => {
                    const qNum = index + 1;
                    const qKey = qNum.toString();
                    const isWrong = submission.wrong_questions?.includes(qNum);
                    const studentVal = answers[qKey];
                    const correctVal = selectedExam.answer_key?.[qKey];
                    const qType = selectedExam.question_types?.[qKey] || 'multiple_choice';

                    // 복수 정답 포맷팅
                    const formatVal = (val: any) => {
                      if (Array.isArray(val)) return val.join(', ');
                      return val || '-';
                    };

                    // 동영상/해설 등 개별 문항 해설 메타데이터 (OMR 시험지는 기본 미지원)
                    const videoLink = null;
                    const pdfLink = null;

                    return (
                      <div 
                        key={qNum} 
                        className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-lg border transition-all ${
                          qType === 'essay' 
                            ? (qNum % 5 === 0 ? 'bg-orange-500/[0.02] border-orange-500/20' : 'bg-white/[0.01] border-white/5')
                            : isWrong 
                              ? (qNum % 5 === 0 ? 'bg-rose-500/5 border-orange-500/30' : 'bg-rose-500/5 border-rose-500/10') 
                              : (qNum % 5 === 0 ? 'bg-emerald-500/5 border-orange-500/30' : 'bg-emerald-500/5 border-emerald-500/10')
                        }`}
                      >
                        <div className="flex items-center gap-3.5 flex-wrap">
                          <span className={`text-[15px] font-black min-w-8 ${qNum % 5 === 0 ? 'text-orange-400' : 'text-yellow-200'}`}>#{qNum}</span>
                          <span className={`text-[11px] font-extrabold px-2.5 py-0.8 rounded-[4px] ${
                            qType === 'essay' 
                              ? 'bg-white/5 text-gray-400' 
                              : isWrong 
                                ? 'bg-rose-500/10 text-rose-400' 
                                : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {qType === 'essay' ? '서술형' : isWrong ? '오답' : '정답'}
                          </span>
                          <div className="text-[14px] font-bold text-white mr-1">
                            내가 쓴 답: <span className="text-blue-300 font-black text-[15px]">{formatVal(studentVal)}</span>
                          </div>
                          
                          {/* 💡 오답수정 완료 토글 버튼 */}
                          {isWrong && (
                            <button
                              onClick={() => toggleIncorrectResolved(qNum)}
                              className={`px-2 py-0.8 text-[11px] font-extrabold rounded border transition-all flex items-center gap-1 shrink-0 ${
                                incorrectResolved[qKey]
                                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-900/10'
                                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white'
                              }`}
                            >
                              {incorrectResolved[qKey] ? '✅ 오답완료' : '✍️ 오답수정'}
                            </button>
                          )}
                        </div>

                        {/* 💡 정답 공개 여부에 따른 조건부 렌더링 */}
                        {qType !== 'essay' && (
                          <div className="flex items-center gap-3 self-end md:self-auto">
                            {submission.reveal_answers ? (
                              <>
                                <div className="text-[14px] font-bold text-gray-300">
                                  실제 정답: <span className="text-emerald-300 font-black text-[15px]">{formatVal(correctVal)}</span>
                                </div>
                                
                                {/* 해설 동영상/PDF 링크 */}
                                {(videoLink || pdfLink) && (
                                  <div className="flex items-center gap-1.5 pl-3 border-l border-white/10">
                                    {videoLink && (
                                      <a 
                                        href={videoLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="p-1.5 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded border border-red-500/30 transition-all"
                                        title="풀이 해설 동영상 보기"
                                      >
                                        <Video size={12} />
                                      </a>
                                    )}
                                    {pdfLink && (
                                      <a 
                                        href={pdfLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="p-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded border border-blue-500/30 transition-all"
                                        title="해설지 PDF 다운로드"
                                      >
                                        <BookOpen size={12} />
                                      </a>
                                    )}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-[13px] text-gray-500 font-bold italic">정답 비공개</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          ) : (
            /* 💡 2-B. OMR 답안지 입력 마킹 카드 화면 */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* OMR 버블 시트 마킹 카드 (2/3 영역) */}
              <div className="lg:col-span-2 bg-[#0d0d0d] border border-white/5 rounded-xl p-3.5 space-y-4.5 max-h-[75vh] overflow-y-auto custom-scrollbar-v relative">
                
                {/* 📷 AI OMR 스캔 단추 및 컨트롤 영역 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                  <div>
                    <h3 className="text-[13px] font-black text-white">OMR 마킹 보드</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">답안을 직접 마킹하거나, 종이 OMR 카드를 사진으로 찍어 올리세요.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    <button
                      type="button"
                      disabled={isScanning}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-extrabold transition-all shadow-md shadow-emerald-950/20 active:scale-95 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                      <Camera size={13} />
                      📷 OMR 사진 스캔 채점
                    </button>
                  </div>
                </div>



                <div className="space-y-4">
                  {Array.from({ length: selectedExam.question_count }, (_, index) => {
                    const qNum = index + 1;
                    const qKey = qNum.toString();
                    const qType = selectedExam.question_types?.[qKey] || 'multiple_choice';

                    return (
                      <div 
                        key={qNum} 
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 py-4 px-4 rounded-lg transition-all ${
                          qNum % 5 === 0
                            ? 'bg-orange-500/[0.03] border border-orange-500/25 hover:bg-orange-500/[0.05]'
                            : 'bg-white/[0.01] border border-white/5 hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-[14px] font-black min-w-8 ${qNum % 5 === 0 ? 'text-orange-400' : 'text-yellow-200'}`}>#{qNum}</span>
                          <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded border border-white/5 font-extrabold">
                            {qType === 'multiple_choice' && '객관식'}
                            {qType === 'multiple_choice_multi' && '객관식(복수)'}
                            {qType === 'short_answer' && '주관식 단답'}
                            {qType === 'essay' && '서술형'}
                          </span>
                        </div>

                        {/* 입력 영역 분기 */}
                        {qType === 'essay' ? (
                          <span className="text-[11px] text-gray-500 italic">서술형 문항은 시험지에 직접 서술하십시오.</span>
                        ) : qType === 'short_answer' ? (
                          <input
                            type="text"
                            placeholder="정답 입력"
                            value={(answers[qKey] as string) || ''}
                            onChange={(e) => handleShortAnswerChange(qNum, e.target.value)}
                            className="bg-black border border-white/20 rounded px-3 py-1.5 text-[13px] font-bold text-white placeholder:text-gray-600 focus:border-blue-500 outline-none w-full sm:w-44 transition-all"
                          />
                        ) : (
                          /* 객관식 단일/복수형 버블 기호 */
                          <div className="flex items-center gap-3.5 select-none">
                            {[1, 2, 3, 4, 5].map(choice => (
                              <button
                                key={choice}
                                onClick={() => handleMark(qNum, choice, qType === 'multiple_choice_multi')}
                                className={`w-9.5 h-9.5 rounded-full border text-[13px] font-bold flex items-center justify-center transition-all ${getBubbleStyle(qNum, choice)}`}
                              >
                                {choice}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* OMR 요약 및 제출 확인 카드 (1/3 영역) */}
              <div className="lg:col-span-1 bg-[#0a0a0a]/60 border border-white/5 p-5 rounded-xl space-y-4 h-fit flex flex-col">
                <div>
                  <h3 className="text-[13px] font-black text-white">마킹 요약 현황</h3>
                  <p className="text-[11px] text-gray-500 mt-1">답안 작성이 잘 완료되었는지 한눈에 검토해 보세요.</p>
                </div>

                {/* 마킹 현황 미니 그리드 */}
                <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto p-1 custom-scrollbar-v border-y border-white/5 py-3">
                  {Array.from({ length: selectedExam.question_count }, (_, index) => {
                    const qNum = index + 1;
                    const qKey = qNum.toString();
                    const val = answers[qKey];
                    const qType = selectedExam.question_types?.[qKey] || 'multiple_choice';

                    const hasMarked = qType === 'essay' 
                      ? true // 서술형은 제외
                      : val !== undefined && val !== '' && val !== 0 && (!Array.isArray(val) || val.length > 0);

                    return (
                      <div 
                        key={qNum}
                        className={`text-center py-2 rounded-[4px] text-[12px] font-black border transition-all ${
                          hasMarked 
                            ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/10' 
                            : qNum % 5 === 0
                              ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                              : 'bg-white/10 border-white/10 text-gray-300'
                        }`}
                        title={`${qNum}번 문항`}
                      >
                        {qNum}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleSubmitAnswers}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-[12px] font-black shadow-xl shadow-blue-900/20 transition-all"
                  >
                    {submitting ? (
                      <span className="animate-pulse flex items-center gap-1.5">
                        <Loader2 className="animate-spin" size={14} /> 제출 중...
                      </span>
                    ) : (
                      <>
                        <Send size={14} />
                        답안 최종 제출하기
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleClearAnswers}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-[11px] font-bold transition-all border border-white/5"
                  >
                    마킹 전체 초기화
                  </button>
                  {backupAnswers && (
                    <button
                      onClick={handleRestoreAnswers}
                      className="w-full py-2 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 hover:text-amber-300 border border-amber-500/20 rounded-lg text-[11px] font-extrabold transition-all mt-1"
                    >
                      ↩️ 되돌리기 (초기화 하기 전으로)
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

    </div>
  );
}
