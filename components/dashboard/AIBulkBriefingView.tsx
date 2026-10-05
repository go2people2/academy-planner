'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Student, Teacher } from '@/types/dashboard';
import { Sparkles, Loader2, AlertCircle, Cpu, CheckCircle2, XCircle, RotateCcw, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface AIBulkBriefingViewProps {
  academyInfo: any;
  students: Student[];
  teachers: Teacher[];
  currentUser: any;
  isLight?: boolean;
}

type StudentTaskStatus = 'idle' | 'waiting' | 'generating' | 'completed' | 'failed';

export default function AIBulkBriefingView({
  academyInfo,
  students,
  teachers,
  currentUser,
  isLight = false,
}: AIBulkBriefingViewProps) {
  // 1. 기간 설정 상태 (기본 최근 30일)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    const todayKST = new Date(Date.now() + 9 * 3600 * 1000);
    const end = todayKST.toISOString().split('T')[0];
    const start = new Date(todayKST.getTime() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
    setStartDate(start);
    setEndDate(end);
  }, []);

  // 2. AI 모델 설정 상태 (학원 설정 반영)
  const [activeModels, setActiveModels] = useState<string[]>(['openai']);
  const [selectedModel, setSelectedModel] = useState<string>('openai');

  useEffect(() => {
    if (academyInfo?.operation_settings?.ai_settings) {
      const aiSettings = academyInfo.operation_settings.ai_settings;
      const models = Array.isArray(aiSettings.active_models) && aiSettings.active_models.length > 0
        ? aiSettings.active_models
        : ['openai'];
      setActiveModels(models);
      setSelectedModel(aiSettings.default_model || models[0] || 'openai');
    }
  }, [academyInfo?.operation_settings?.ai_settings]);

  // 3. 독립 필터 상태 (검색어, 학년, 담당 교사)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('All');
  const [selectedTeacherId, setSelectedTeacherId] = useState('All');

  // 교사 계정 로그인 시 기본 교사 필터 자동 선택
  useEffect(() => {
    if (currentUser?.role === 'teacher' && currentUser?.id) {
      setSelectedTeacherId(currentUser.id);
    }
  }, [currentUser]);

  // 학년 옵션 목록 추출
  const availableGrades = useMemo(() => {
    const grades = new Set<string>();
    students.forEach((s) => {
      if (s.grade && s.grade.trim()) grades.add(s.grade.trim());
    });
    return Array.from(grades).sort();
  }, [students]);

  // 필터링된 재원생 목록 (퇴원생 제외)
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (s.is_deleted) return false;
      if (searchQuery.trim() && !s.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
        return false;
      }
      if (selectedGrade !== 'All' && s.grade !== selectedGrade) {
        return false;
      }
      if (selectedTeacherId !== 'All' && s.teacher_id !== selectedTeacherId) {
        return false;
      }
      return true;
    });
  }, [students, searchQuery, selectedGrade, selectedTeacherId]);

  // 4. 체크박스 다중 선택 상태
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  const handleToggleSelectAll = () => {
    if (isProcessing) return;
    const allFilteredIds = filteredStudents.map((s) => s.id);
    const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedStudentIds.has(id));

    if (isAllSelected) {
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleToggleSelectStudent = (studentId: string) => {
    if (isProcessing) return;
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  // 5. 큐 실행 상태 관리
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, StudentTaskStatus>>({});
  const [resultsMap, setResultsMap] = useState<Record<string, string>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // 날짜 유효성 검증
  const isDateRangeValid = useMemo(() => {
    if (!startDate || !endDate) return false;
    return startDate <= endDate;
  }, [startDate, endDate]);

  // 상단 진행 통계 계산
  const targetStudentList = useMemo(() => {
    return filteredStudents.filter((s) => selectedStudentIds.has(s.id));
  }, [filteredStudents, selectedStudentIds]);

  const queueStats = useMemo(() => {
    const total = targetStudentList.length;
    let completed = 0;
    let failed = 0;
    let generating = 0;
    let waiting = 0;

    targetStudentList.forEach((s) => {
      const st = statusMap[s.id];
      if (st === 'completed') completed++;
      else if (st === 'failed') failed++;
      else if (st === 'generating') generating++;
      else if (st === 'waiting') waiting++;
    });

    return { total, completed, failed, generating, waiting };
  }, [targetStudentList, statusMap]);

  // 단일 학생 브리핑 생성 내부 실행기 (1명 단위)
  const executeBriefingForStudent = useCallback(
    async (studentId: string, model: string, start: string, end: string) => {
      const requestId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
      }

      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId,
          model,
          startDate: start,
          endDate: end,
          requestId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '상담 브리핑 생성에 실패했습니다.');
      }

      return data.briefing as string;
    },
    []
  );

  // 6. 1명씩 순차 실행 큐 엔진
  const handleStartBulkGeneration = async () => {
    if (isProcessing || targetStudentList.length === 0 || !isDateRangeValid) return;

    // 대기 중인 대상 학생들 (이미 완료된 학생은 제외)
    const pendingStudents = targetStudentList.filter((s) => statusMap[s.id] !== 'completed');
    if (pendingStudents.length === 0) return;

    setIsProcessing(true);

    // 큐에 들어갈 대상들의 상태를 'waiting'으로 초기화
    setStatusMap((prev) => {
      const next = { ...prev };
      pendingStudents.forEach((s) => {
        next[s.id] = 'waiting';
      });
      return next;
    });

    // 반드시 1명씩 순차 실행 (한 학생이 끝나거나 실패한 뒤 다음 학생 호출)
    for (const student of pendingStudents) {
      setStatusMap((prev) => ({ ...prev, [student.id]: 'generating' }));

      try {
        const briefingText = await executeBriefingForStudent(
          student.id,
          selectedModel,
          startDate,
          endDate
        );

        setResultsMap((prev) => ({ ...prev, [student.id]: briefingText }));
        setStatusMap((prev) => ({ ...prev, [student.id]: 'completed' }));
        setErrorMap((prev) => {
          const next = { ...prev };
          delete next[student.id];
          return next;
        });
      } catch (err: any) {
        // 실패 시 에러 기록 및 상태 'failed' 전환 (전체 큐는 중단하지 않고 다음 학생 계속 진행)
        const safeError = err?.message || '생성에 실패했습니다.';
        setErrorMap((prev) => ({ ...prev, [student.id]: safeError }));
        setStatusMap((prev) => ({ ...prev, [student.id]: 'failed' }));
      }
    }

    setIsProcessing(false);
  };

  // 7. 실패 학생 개별 재시도
  const handleRetryStudent = async (studentId: string) => {
    if (isProcessing) return;

    setStatusMap((prev) => ({ ...prev, [studentId]: 'generating' }));
    setErrorMap((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });

    try {
      const briefingText = await executeBriefingForStudent(
        studentId,
        selectedModel,
        startDate,
        endDate
      );

      setResultsMap((prev) => ({ ...prev, [studentId]: briefingText }));
      setStatusMap((prev) => ({ ...prev, [studentId]: 'completed' }));
    } catch (err: any) {
      const safeError = err?.message || '재시도에 실패했습니다.';
      setErrorMap((prev) => ({ ...prev, [studentId]: safeError }));
      setStatusMap((prev) => ({ ...prev, [studentId]: 'failed' }));
    }
  };

  // 8. 기존 AIConsultationBriefing의 안전한 마크다운 렌더러 재사용 (dangerouslySetInnerHTML 미사용)
  const renderMarkdown = (text: string) => {
    if (!text) return null;

    return text.split('\n').map((line, idx) => {
      if (line.startsWith('###')) {
        const title = line.replace('###', '').trim();
        return (
          <h4
            key={idx}
            className={`text-xs font-black mt-4 mb-2 pb-1 border-b uppercase tracking-wider flex items-center gap-1.5 ${
              isLight ? 'text-amber-700 border-gray-200' : 'text-amber-500 border-white/10'
            }`}
          >
            <Sparkles size={11} className={isLight ? 'text-amber-600' : 'text-amber-500'} />
            {title}
          </h4>
        );
      }
      if (line.startsWith('-')) {
        const item = line.replace(/^-/, '').trim();
        return (
          <div key={idx} className="flex items-start gap-1.5 pl-2 py-0.5">
            <span className={`${isLight ? 'text-blue-600' : 'text-blue-500'} mt-1 select-none`}>•</span>
            <p className={`text-[11px] font-bold leading-relaxed ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>{item}</p>
          </div>
        );
      }
      if (line.trim() === '') {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className={`text-[11px] font-bold leading-relaxed ${isLight ? 'text-gray-650' : 'text-gray-400'}`}>
          {line}
        </p>
      );
    });
  };

  const isAllFilteredSelected =
    filteredStudents.length > 0 && filteredStudents.every((s) => selectedStudentIds.has(s.id));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ⚠️ 화면 이탈 주의 및 초안 안내 배너 */}
      <div
        className={`p-3.5 rounded-[4px] border flex items-start gap-3 ${
          isLight
            ? 'bg-amber-50/80 border-amber-200 text-amber-900'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
        }`}
      >
        <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-500" />
        <div className="text-[11px] leading-relaxed font-bold">
          <p className="font-black text-xs mb-0.5">생성 작업 안내</p>
          <p>
            생성 중 화면을 닫거나 새로고침하면 아직 처리되지 않은 작업은 중단됩니다.{' '}
            생성된 브리핑은 이번 단계에서는 현재 화면에서만 확인할 수 있습니다.
          </p>
        </div>
      </div>

      {/* ⚙️ 컨트롤 패널: 기간, 모델, 액션 버튼 */}
      <div
        className={`p-5 rounded-[4px] border space-y-4 ${
          isLight ? 'bg-white border-gray-200 shadow-sm' : 'bg-[#111111] border-white/10'
        }`}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          {/* 기간 설정 */}
          <div className="flex items-center gap-3">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">
                📅 분석 시작일
              </label>
              <input
                type="date"
                value={startDate}
                disabled={isProcessing}
                onChange={(e) => setStartDate(e.target.value)}
                className={`border rounded-[2px] px-2.5 py-1.5 text-xs font-bold outline-none ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-800'
                    : 'bg-black/40 border-white/10 text-white focus:border-blue-500'
                }`}
              />
            </div>
            <span className="text-gray-500 pt-5">~</span>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">
                📅 분석 종료일
              </label>
              <input
                type="date"
                value={endDate}
                disabled={isProcessing}
                onChange={(e) => setEndDate(e.target.value)}
                className={`border rounded-[2px] px-2.5 py-1.5 text-xs font-bold outline-none ${
                  isLight
                    ? 'bg-white border-gray-300 text-gray-800'
                    : 'bg-black/40 border-white/10 text-white focus:border-blue-500'
                }`}
              />
            </div>
            {!isDateRangeValid && (
              <span className="text-[10px] text-rose-500 font-bold pt-5">
                시작일이 종료일보다 늦을 수 없습니다.
              </span>
            )}
          </div>

          {/* AI 모델 선택 */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">
              🤖 AI 모델 선택
            </label>
            <div className="flex gap-1.5">
              {activeModels.map((model) => (
                <button
                  key={model}
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setSelectedModel(model)}
                  className={`px-3 py-1.5 rounded-[2px] text-[10px] font-black uppercase tracking-wider border transition-all ${
                    selectedModel === model
                      ? isLight
                        ? 'bg-blue-50 text-blue-600 border-blue-600/30'
                        : 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                      : isLight
                      ? 'bg-transparent text-gray-400 border-gray-200 hover:text-gray-600'
                      : 'bg-transparent text-gray-500 border-white/5 hover:text-gray-300'
                  }`}
                >
                  {model === 'openai' ? 'OpenAI GPT-4o' : 'Google Gemini Pro'}
                </button>
              ))}
            </div>
          </div>

          {/* 생성 버튼 */}
          <div>
            <button
              type="button"
              disabled={isProcessing || targetStudentList.length === 0 || !isDateRangeValid}
              onClick={handleStartBulkGeneration}
              className={`px-5 py-2.5 rounded-[3px] text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed ${
                isProcessing
                  ? 'bg-amber-600 text-white cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  순차 생성 진행 중...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  선택 {targetStudentList.length}명 브리핑 순차 생성
                </>
              )}
            </button>
          </div>
        </div>

        {/* 상단 진행률 바 및 통계 */}
        {targetStudentList.length > 0 && (
          <div
            className={`pt-3 border-t text-[11px] font-bold flex flex-wrap items-center justify-between gap-2 ${
              isLight ? 'border-gray-150 text-gray-650' : 'border-white/5 text-gray-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>
                진행 현황:{' '}
                <strong className={isLight ? 'text-blue-600' : 'text-blue-400'}>
                  성공 {queueStats.completed}
                </strong>{' '}
                / 전체 {queueStats.total}명
              </span>
              <span>·</span>
              <span className={queueStats.failed > 0 ? 'text-rose-500 font-black' : ''}>
                실패 {queueStats.failed}명
              </span>
              <span>·</span>
              <span>대기 {queueStats.waiting}명</span>
              {queueStats.generating > 0 && (
                <span className="text-amber-400 animate-pulse font-black">
                  (1명 생성 중...)
                </span>
              )}
            </div>

            {/* 게이지 바 */}
            <div
              className={`w-48 h-2 rounded-full overflow-hidden border ${
                isLight ? 'bg-gray-100 border-gray-200' : 'bg-white/5 border-white/10'
              }`}
            >
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{
                  width: `${
                    queueStats.total > 0
                      ? Math.round((queueStats.completed / queueStats.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 🔍 독립 필터 바 */}
      <div
        className={`p-4 rounded-[4px] border flex flex-wrap items-center justify-between gap-3 ${
          isLight ? 'bg-white border-gray-200' : 'bg-[#111111] border-white/10'
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* 검색어 */}
          <input
            type="text"
            placeholder="학생 이름 검색..."
            value={searchQuery}
            disabled={isProcessing}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`border rounded-[2px] px-3 py-1.5 text-xs font-bold outline-none w-44 ${
              isLight
                ? 'bg-white border-gray-300 text-gray-800'
                : 'bg-black/40 border-white/10 text-white focus:border-blue-500'
            }`}
          />

          {/* 학년 필터 */}
          <select
            value={selectedGrade}
            disabled={isProcessing}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className={`border rounded-[2px] px-2.5 py-1.5 text-xs font-bold outline-none ${
              isLight
                ? 'bg-white border-gray-300 text-gray-800'
                : 'bg-black/40 border-white/10 text-white'
            }`}
          >
            <option value="All">전체 학년</option>
            {availableGrades.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          {/* 담당 교사 필터 */}
          <select
            value={selectedTeacherId}
            disabled={isProcessing}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className={`border rounded-[2px] px-2.5 py-1.5 text-xs font-bold outline-none ${
              isLight
                ? 'bg-white border-gray-300 text-gray-800'
                : 'bg-black/40 border-white/10 text-white'
            }`}
          >
            <option value="All">전체 담당 교사</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} 선생님
              </option>
            ))}
          </select>
        </div>

        <div className="text-[11px] font-bold text-gray-400">
          표시 {filteredStudents.length}명 / 선택 {selectedStudentIds.size}명
        </div>
      </div>

      {/* 📋 학생 목록 및 상태 테이블 */}
      <div
        className={`border rounded-[4px] overflow-hidden ${
          isLight ? 'bg-white border-gray-200' : 'bg-[#0f0f0f] border-white/10'
        }`}
      >
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr
              className={`border-b text-[10px] font-black uppercase tracking-wider ${
                isLight ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  disabled={isProcessing || filteredStudents.length === 0}
                  checked={isAllFilteredSelected}
                  onChange={handleToggleSelectAll}
                  className="rounded cursor-pointer"
                />
              </th>
              <th className="p-3">학생명</th>
              <th className="p-3">학교 / 학년</th>
              <th className="p-3">담당 선생님</th>
              <th className="p-3">최근 상담일</th>
              <th className="p-3">생성 상태</th>
              <th className="p-3 text-right">결과 확인</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isLight ? 'divide-gray-150' : 'divide-white/5'}`}>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500 font-bold">
                  조건에 일치하는 학생이 없습니다.
                </td>
              </tr>
            ) : (
              filteredStudents.map((st) => {
                const isChecked = selectedStudentIds.has(st.id);
                const status = statusMap[st.id] || 'idle';
                const hasResult = Boolean(resultsMap[st.id]);
                const errorMsg = errorMap[st.id];
                const isExpanded = expandedStudentId === st.id;

                const teacher = teachers.find((t) => t.id === st.teacher_id);
                const teacherName = teacher?.name || st.teacher_name || '-';

                return (
                  <React.Fragment key={st.id}>
                    <tr
                      className={`transition-colors ${
                        isChecked
                          ? isLight
                            ? 'bg-blue-50/40'
                            : 'bg-blue-600/5'
                          : isLight
                          ? 'hover:bg-gray-50'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          disabled={isProcessing}
                          checked={isChecked}
                          onChange={() => handleToggleSelectStudent(st.id)}
                          className="rounded cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-black text-sm">
                        {st.name}
                      </td>
                      <td className="p-3 font-bold text-gray-400">
                        {st.school || '미지정'} {st.grade ? `(${st.grade})` : ''}
                      </td>
                      <td className="p-3 font-bold text-gray-400">
                        {teacherName}
                      </td>
                      <td className="p-3 font-bold text-gray-500">
                        {st.last_consulted_at ? st.last_consulted_at.slice(0, 10) : '기록 없음'}
                      </td>
                      <td className="p-3">
                        {status === 'generating' && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
                            <Loader2 size={11} className="animate-spin" /> 생성 중
                          </span>
                        )}
                        {status === 'waiting' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20">
                            대기 중
                          </span>
                        )}
                        {status === 'completed' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={11} /> 생성 완료
                          </span>
                        )}
                        {status === 'failed' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle size={11} /> 실패
                          </span>
                        )}
                        {status === 'idle' && (
                          <span className="text-gray-500 text-[10px] font-bold">대기</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {status === 'failed' && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleRetryStudent(st.id)}
                              className="px-2 py-1 rounded text-[10px] font-bold bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center gap-1"
                            >
                              <RotateCcw size={10} /> 재시도
                            </button>
                          )}
                          {hasResult && (
                            <button
                              type="button"
                              onClick={() => setExpandedStudentId(isExpanded ? null : st.id)}
                              className="px-2.5 py-1 rounded text-[10px] font-black bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 flex items-center gap-1"
                            >
                              {isExpanded ? (
                                <>접기 <ChevronUp size={12} /></>
                              ) : (
                                <>결과 보기 <ChevronDown size={12} /></>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* 에러 메시지 행 */}
                    {status === 'failed' && errorMsg && (
                      <tr className={isLight ? 'bg-rose-50/50' : 'bg-rose-950/20'}>
                        <td colSpan={7} className="px-6 py-2">
                          <p className="text-[11px] font-bold text-rose-400 flex items-center gap-1.5">
                            <AlertCircle size={12} />
                            오류 안내: {errorMsg}
                          </p>
                        </td>
                      </tr>
                    )}

                    {/* 결과 아코디언 상세 뷰 */}
                    {isExpanded && hasResult && (
                      <tr className={isLight ? 'bg-gray-50' : 'bg-black/40'}>
                        <td colSpan={7} className="p-5">
                          <div
                            className={`p-5 rounded-[4px] border ${
                              isLight
                                ? 'bg-white border-gray-200 text-gray-800'
                                : 'bg-[#111111] border-white/10 text-white'
                            }`}
                          >
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/5">
                              <h4 className="text-xs font-black flex items-center gap-2">
                                <Sparkles size={13} className="text-blue-400" />
                                {st.name} 학생 AI 상담 브리핑 초안 리포트
                              </h4>
                              <span className="text-[10px] text-gray-400 font-bold">
                                분석 모델: {selectedModel.toUpperCase()}
                              </span>
                            </div>
                            <div className="prose prose-invert max-w-none space-y-2">
                              {renderMarkdown(resultsMap[st.id])}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
