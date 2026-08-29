'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LayoutGrid, Plus, Globe, User, Lock, Loader2, LogOut, CheckCircle2, AlertTriangle, ChevronRight, School, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useMasterDashboard } from './hooks/useMasterDashboard';

export default function MasterDashboard() {
  const {
    mounted,
    isAuthorized,
    academies,
    isLoadingList,
    editingAcademy,
    setEditingAcademy,
    editAcademyName,
    setEditAcademyName,
    editSlug,
    setEditSlug,
    editIsSuspended,
    setEditIsSuspended,
    isUpdating,
    editAiSettings,
    setEditAiSettings,
    editFeatures,
    setEditFeatures,
    isDeleting,
    deleteConfirmInput,
    setDeleteConfirmInput,
    showDeleteSection,
    setShowDeleteSection,
    academyName,
    setAcademyName,
    slug,
    setSlug,
    username,
    setUsername,
    password,
    setPassword,
    isSubmitting,
    statusMsg,
    masterId,
    setMasterId,
    masterPw,
    setMasterPw,
    loginError,
    isLoggingIn,
    handleMasterLogin,
    handleSubmit,
    handleUpdateAcademy,
    handleDeleteAcademy,
    handleWarpToAcademy,
    openEditModal,
    handleCloseEditModal,
  } = useMasterDashboard();

  // 💡 [접근성] ESC 키 입력 시 모달 닫기 (저장 전 변경사항 보호 적용)
  useEffect(() => {
    if (!editingAcademy) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        handleCloseEditModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingAcademy, handleCloseEditModal]);

  const handleLogout = () => {
    localStorage.removeItem('ams_user');
    window.location.reload();
  };


  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white font-sans">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto" />
          <p className="text-xs text-gray-500 uppercase tracking-widest font-black">Loading Portal...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center relative overflow-hidden font-sans p-6 text-white selection:bg-purple-500/30">
        {/* 네온 배경 백라이트 효과 */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-purple-600/10 to-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-72 h-72 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[420px] relative z-10"
        >
          {/* 헤더 심볼 */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20 mx-auto mb-4">
              <LayoutGrid size={22} className="text-white" />
            </div>
            <h1 className="text-lg font-black uppercase tracking-[0.25em] text-white">Hokma Portal</h1>
            <p className="text-[10px] text-purple-400 font-extrabold uppercase tracking-widest mt-1.5">Master Gateway</p>
          </div>

          {/* 로그인 카드 */}
          <div className="bg-[#0f0f0f]/80 border border-white/10 rounded-lg p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" />
            
            <form onSubmit={handleMasterLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Master Access Key</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    required
                    placeholder="Enter Username"
                    value={masterId}
                    onChange={(e) => setMasterId(e.target.value)}
                    className="w-full bg-black/50 border border-white/5 focus:border-purple-500/50 rounded py-3.5 pl-12 pr-4 text-xs text-white outline-none focus:ring-1 focus:ring-purple-500/20 transition-all font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Security Signature</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="password"
                    required
                    placeholder="Enter Password"
                    value={masterPw}
                    onChange={(e) => setMasterPw(e.target.value)}
                    className="w-full bg-black/50 border border-white/5 focus:border-purple-500/50 rounded py-3.5 pl-12 pr-4 text-xs text-white outline-none focus:ring-1 focus:ring-purple-500/20 transition-all font-bold"
                  />
                </div>
              </div>

              {loginError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-[11px] font-bold text-red-400 flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 transition-all py-4 text-[11px] font-black uppercase tracking-widest rounded text-white flex items-center justify-center gap-2 group shadow-lg shadow-purple-950/20"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Authorizing...</span>
                  </>
                ) : (
                  <>
                    <span>Decrypt & Authenticate</span>
                    <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="text-center mt-6">
            <p className="text-[9px] text-gray-600 font-extrabold uppercase tracking-widest">
              Authorized personnel only. Activities are logged.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans selection:bg-blue-500/30">
      {/* GFM Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <LayoutGrid size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-[14px] font-black uppercase tracking-[0.2em] leading-none text-white/90">Hokma Planner</h1>
              <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider mt-1 block">Master Admin Portal</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3.5 py-2 border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded-sm text-xs font-bold transition-all"
          >
            <LogOut size={12} /> 로그아웃
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Create Academy Form */}
        <section className="lg:col-span-5 space-y-6">
          <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-6 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400"><Plus size={16} /></div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-white/90">원스톱 학원 개설</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Create New Client Account Instantly</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">학원 이름 (한글)</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="예: 맥수학학원"
                    value={academyName}
                    onChange={(e) => setAcademyName(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 focus:border-blue-500/60 rounded-sm py-3.5 px-4 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/30 transition-all font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">인터넷 주소 슬러그 (영문)</label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <input
                    type="text"
                    required
                    placeholder="예: mac-math (소문자, 숫자, 하이픈만 가능)"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 focus:border-blue-500/60 rounded-sm py-3.5 pl-12 pr-4 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/30 transition-all font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">원장님 관리자 로그인 ID</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <input
                    type="text"
                    required
                    placeholder="예: mac_admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 focus:border-blue-500/60 rounded-sm py-3.5 pl-12 pr-4 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/30 transition-all font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">관리자 비밀번호</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <input
                    type="password"
                    required
                    placeholder="비밀번호 설정"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 focus:border-blue-500/60 rounded-sm py-3.5 pl-12 pr-4 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/30 transition-all font-bold"
                  />
                </div>
              </div>

              {/* Status Display */}
              <AnimatePresence>
                {statusMsg.type && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`p-3.5 rounded-sm border text-[11px] font-bold flex items-start gap-2.5 ${
                      statusMsg.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}
                  >
                    {statusMsg.type === 'success' ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
                    <span>{statusMsg.text}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all py-4 text-[11px] font-black uppercase tracking-widest rounded-sm flex items-center justify-center gap-2 group"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>개설 처리 중...</span>
                  </>
                ) : (
                  <>
                    <span>학원 자동 개설하기</span>
                    <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Guide Card */}
          <div className="bg-[#111111]/40 border border-white/5 rounded-sm p-5 space-y-3">
            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">💡 개설 완료 후 주소 안내</h4>
            <p className="text-[11px] text-gray-400 leading-relaxed font-bold">
              학원이 개설되면 다음 주소로 즉시 접근하실 수 있습니다.
            </p>
            <div className="bg-black/60 p-3 rounded-sm text-[10px] font-mono text-gray-500 space-y-1.5 border border-white/[0.02]">
              <div className="flex items-center justify-between"><span className="text-gray-300">원장님 로그인</span><span>https://hokmanote.xyz/[슬러그]/login</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-300">학생 로그인</span><span>https://hokmanote.xyz/[슬러그]/student</span></div>
            </div>
          </div>

          {/* 🤖 AI Briefing Sales & Spec Guide */}
          <div className="bg-[#111111]/80 border border-blue-500/10 rounded-sm p-6 space-y-4 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500" />
            <div className="flex items-center gap-2.5 text-blue-400">
              <Sparkles size={16} />
              <h4 className="text-xs font-black uppercase tracking-widest text-white/95">AI 브리핑 작동 원리 & 세일즈 가이드</h4>
            </div>
            
            <div className="space-y-3.5 text-[11px] text-gray-400 leading-relaxed font-bold">
              <div className="space-y-1">
                <span className="text-[10px] text-white/90 font-black block">1. 어떤 자료(Data)가 수집되나요?</span>
                <p className="text-gray-500">학원 DB(Supabase)에서 학생의 핵심 학습 기록만을 안전하게 비식별화하여 결합합니다.</p>
                <ul className="list-disc ml-4 text-[10px] text-gray-400 space-y-0.5">
                  <li>학생 기본 인적사항 (학년, 학교, 담당 선생님)</li>
                  <li>성실도 지표: 최근 10회 수업의 출결 상태 및 숙제 수행률(%)</li>
                  <li>성취도 지표: 일일 테스트 퀴즈 점수 및 평균 성적</li>
                  <li>정기 고사 OMR 결과: 최근 3회 고사 점수 및 오답 문항 정보</li>
                </ul>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-white/90 font-black block">2. 어떤 과정을 거쳐 브리핑이 나오나요?</span>
                <p className="text-gray-500">수집된 원천 데이터를 AI가 읽기 쉬운 정량적 요약 프롬프트 텍스트로 가공합니다.</p>
                <ul className="list-disc ml-4 text-[10px] text-gray-400 space-y-0.5">
                  <li>안전한 SSL 보안망을 통해 설정된 AI API(OpenAI/Gemini)로 송신됩니다.</li>
                  <li>수학 전문 강사 및 학습 설계사의 톤앤매너 프롬프트 규칙이 적용됩니다.</li>
                  <li>3대 세부 영역(성적 및 취약점, 성실도 분석, 추천 상담 멘트)으로 자동 분류되어 가맹 학원 화면에 렌더링됩니다.</li>
                </ul>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-white/90 font-black block">3. 원장님/고객 대상 핵심 세일즈 멘트</span>
                <p className="text-gray-500">가맹 학원에 본 시스템의 가치를 설명할 때 유용한 핵심 장점입니다.</p>
                <ul className="list-disc ml-4 text-[10px] text-gray-400 space-y-0.5">
                  <li><strong className="text-blue-400">시간 단축</strong>: 10회차 일지를 뒤지며 숙제 완성도와 지각 횟수를 계산할 필요 없이 클릭 한 번에 성실도가 정량화됩니다.</li>
                  <li><strong className="text-blue-400">맞춤형 진단</strong>: OMR 오답 문항을 토대로 학생이 서술형에 약한지, 특정 개념 실수가 잦은지 AI가 즉석에서 짚어냅니다.</li>
                  <li><strong className="text-blue-400">즉각 연동</strong>: 분석된 상담 가이드 멘트를 상담 일지에 원클릭으로 저장해 상담 기록 누적 업무를 자동화합니다.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Right: Existing Academy List */}
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400"><School size={16} /></div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-white/90">현재 개설된 학원 목록</h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Currently Active Academies</p>
                </div>
              </div>
              <span className="text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full uppercase">
                총 {academies.length}개 지점
              </span>
            </div>

            {isLoadingList ? (
              <div className="py-20 flex flex-col items-center justify-center text-gray-500 gap-2">
                <Loader2 size={24} className="animate-spin text-gray-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Loading lists...</span>
              </div>
            ) : academies.length === 0 ? (
              <div className="py-20 text-center text-xs text-gray-500 font-bold">
                등록된 학원 정보가 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-[9px] font-black text-gray-500 uppercase tracking-widest">
                      <th className="py-3 px-2">학원명</th>
                      <th className="py-3 px-2">슬러그 (인터넷 주소)</th>
                      <th className="py-3 px-2">AI 엔진</th>
                      <th className="py-3 px-2 text-right">개설 일시</th>
                      <th className="py-3 px-2 text-right">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academies.map((ac) => {
                      const isAcSuspended = ac.operation_settings?.is_suspended === true;
                      return (
                        <tr key={ac.id} className={`border-b transition-all font-bold group ${
                          isAcSuspended 
                            ? 'bg-red-950/15 hover:bg-red-950/25 text-red-200 border-red-500/10' 
                            : 'text-white/90 hover:bg-white/[0.01] border-white/[0.03]'
                        }`}>
                          <td className="py-3.5 px-2 flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full group-hover:scale-125 transition-transform ${
                              isAcSuspended ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-blue-500'
                            }`} />
                            <span className={isAcSuspended ? 'text-red-300' : ''}>{ac.academy_name}</span>
                            {isAcSuspended && (
                              <span className="px-2 py-0.5 rounded-[2px] bg-red-600 text-white text-[8px] font-black tracking-tight animate-pulse shadow-sm shadow-red-900/50">서비스 정지</span>
                            )}
                          </td>
                          <td className="py-3.5 px-2">
                            <code className={`border px-2 py-1 rounded-[2px] text-[10px] font-bold ${
                              isAcSuspended 
                                ? 'bg-red-950/40 border-red-500/20 text-red-300' 
                                : 'bg-black/40 border-white/5 text-blue-300'
                            }`}>
                              /{ac.slug}
                            </code>
                          </td>
                          <td className="py-3.5 px-2">
                            <div className="flex gap-1 items-center">
                              {ac.operation_settings?.ai_settings?.active_models?.includes('openai') ? (
                                <span className="px-1.5 py-0.5 rounded-[2px] bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-black uppercase tracking-tight">GPT-4o</span>
                              ) : null}
                              {ac.operation_settings?.ai_settings?.active_models?.includes('gemini') ? (
                                <span className="px-1.5 py-0.5 rounded-[2px] bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[9px] font-black uppercase tracking-tight">Gemini</span>
                              ) : null}
                              {(!ac.operation_settings?.ai_settings?.active_models || ac.operation_settings?.ai_settings?.active_models.length === 0) ? (
                                <span className="px-1.5 py-0.5 rounded-[2px] bg-slate-800 text-slate-400 border border-white/5 text-[9px] font-black uppercase tracking-tight">GPT-4o (기본)</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-3.5 px-2 text-right text-[10px] text-gray-500">
                            {new Date(ac.created_at).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="py-3.5 px-2 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(ac)}
                                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-[9px] font-black uppercase tracking-wider rounded-[2px] border border-white/10 transition-all"
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => handleWarpToAcademy(ac.id, ac.slug)}
                                className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-[9px] font-black uppercase tracking-wider rounded-[2px] transition-all shadow-md shadow-purple-900/10"
                              >
                                접속
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

      </main>

      {/* 💡 [추가] 지점 정보 수정 모달 */}
      <AnimatePresence>
        {editingAcademy && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm"
            onClick={() => handleCloseEditModal()}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-academy-title"
              onClick={(e) => e.stopPropagation()}
              className="bg-[#121212] border border-white/10 rounded-sm max-w-lg w-full max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Sticky Header */}
              <div className="sticky top-0 z-10 shrink-0 bg-[#121212] flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-2 text-blue-400">
                  <School size={16} />
                  <h3 id="edit-academy-title" className="text-xs font-black uppercase tracking-widest text-white/95">지점 정보 및 기능 설정</h3>
                </div>
                <button 
                  type="button"
                  aria-label="닫기"
                  onClick={() => handleCloseEditModal()}
                  className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form with scrollable body */}
              <form onSubmit={handleUpdateAcademy} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto custom-scrollbar-v p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block ml-0.5">학원 이름 (한글)</label>
                  <input
                    type="text"
                    required
                    value={editAcademyName}
                    onChange={(e) => setEditAcademyName(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-sm py-2.5 px-3 text-xs text-white outline-none focus:border-blue-500/60 transition-all font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block ml-0.5">인터넷 주소 슬러그 (영문)</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                    <input
                      type="text"
                      required
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      className="w-full bg-black/60 border border-white/10 rounded-sm py-2.5 pl-9 pr-3 text-xs text-white outline-none focus:border-blue-500/60 transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block ml-0.5">서비스 제공 상태</label>
                  <select
                    value={editIsSuspended ? 'suspended' : 'active'}
                    onChange={(e) => setEditIsSuspended(e.target.value === 'suspended')}
                    className={`w-full bg-black/60 border border-white/10 rounded-sm py-2.5 px-3 text-xs outline-none focus:border-blue-500/60 transition-all font-bold ${
                      editIsSuspended ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    <option value="active" className="text-emerald-400 bg-[#121212]">✅ 정상 제공 (Active)</option>
                    <option value="suspended" className="text-red-400 bg-[#121212]">❌ 일시 중지 (Suspended)</option>
                  </select>
                </div>

                {/* 💡 AI 브리핑 연동 설정 */}
                <div className="space-y-2 border-t border-white/5 pt-3">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block ml-0.5">🤖 AI 브리핑 연동 설정</label>
                  <div className="bg-black/40 border border-white/5 rounded-sm p-3 space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-[9px] text-gray-400 font-bold block mb-1">사용 가능한 AI 엔진</span>
                      {[
                        { id: 'openai', label: 'OpenAI (GPT-4o)' },
                        { id: 'gemini', label: 'Google (Gemini 1.5 Pro)' }
                      ].map((model) => {
                        const isChecked = editAiSettings.active_models.includes(model.id);
                        return (
                          <label key={model.id} className="flex items-center gap-2 text-xs text-white/80 cursor-pointer select-none">
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                let nextModels = [...editAiSettings.active_models];
                                if (e.target.checked) {
                                  if (!nextModels.includes(model.id)) nextModels.push(model.id);
                                } else {
                                  nextModels = nextModels.filter(m => m !== model.id);
                                }
                                
                                if (nextModels.length === 0) {
                                  alert('최소 1개의 AI 엔진은 선택되어야 합니다.');
                                  return;
                                }
                                
                                let nextDefault = editAiSettings.default_model;
                                if (!nextModels.includes(nextDefault)) {
                                  nextDefault = nextModels[0];
                                }
                                setEditAiSettings({
                                  active_models: nextModels,
                                  default_model: nextDefault
                                });
                              }}
                              className="accent-blue-500 rounded border-white/10"
                            />
                            <span>{model.label}</span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] text-gray-400 font-bold block">기본 AI 엔진</span>
                      <select 
                        value={editAiSettings.default_model}
                        onChange={(e) => setEditAiSettings(prev => ({ ...prev, default_model: e.target.value }))}
                        className="w-full bg-black/60 border border-white/10 rounded-sm py-1.5 px-2 text-xs text-white outline-none focus:border-blue-500/60 font-bold"
                      >
                        {editAiSettings.active_models.includes('openai') && (
                          <option value="openai" className="bg-[#121212]">OpenAI (GPT-4o)</option>
                        )}
                        {editAiSettings.active_models.includes('gemini') && (
                          <option value="gemini" className="bg-[#121212]">Google (Gemini 1.5 Pro)</option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 💡 기능 사용 설정 (Feature Flags) */}
                <div className="space-y-2 border-t border-white/5 pt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block ml-0.5">🎛️ 기능 사용 설정</label>
                    <span className="text-[9px] text-gray-500 font-bold">학원별 Add-on 제어</span>
                  </div>

                  <div className="bg-black/40 border border-white/5 rounded-sm p-3 space-y-3">
                    {/* 기본 제공 기능 (Always-ON 읽기 전용) */}
                    <div className="space-y-1.5 pb-2.5 border-b border-white/5">
                      <span className="text-[9px] text-gray-400 font-bold block mb-1">기본 제공 기능 (항상 사용)</span>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px] text-gray-400">
                        <div className="flex items-center gap-1.5 bg-white/[0.02] px-2 py-1 rounded-[2px] border border-white/5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>TodaySheet</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/[0.02] px-2 py-1 rounded-[2px] border border-white/5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>Overview</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/[0.02] px-2 py-1 rounded-[2px] border border-white/5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>학생 지원</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/[0.02] px-2 py-1 rounded-[2px] border border-white/5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>Settings</span>
                        </div>
                      </div>
                    </div>

                    {/* 선택 기능 토글 (운영 관리, 학습 자료, 평가 관리) */}
                    <div className="space-y-2">
                      <span className="text-[9px] text-gray-400 font-bold block">선택 기능 (ON / OFF)</span>
                      
                      {/* 운영 관리 */}
                      <label className="flex items-start justify-between gap-2 p-2 rounded-[2px] bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 cursor-pointer transition-colors">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${editFeatures.operations_tools ? 'bg-blue-400' : 'bg-gray-600'}`} />
                            <span className="text-xs font-bold text-white/90">운영 관리</span>
                          </div>
                          <p className="text-[9px] text-gray-500 leading-tight">교재별진도, 교사 업무, 학생 건의, 설문/수요조사, 유용한 링크</p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={editFeatures.operations_tools}
                          onChange={(e) => setEditFeatures(prev => ({ ...prev, operations_tools: e.target.checked }))}
                          className="accent-blue-500 rounded border-white/10 mt-1 cursor-pointer"
                        />
                      </label>

                      {/* 학습 자료 */}
                      <label className="flex items-start justify-between gap-2 p-2 rounded-[2px] bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 cursor-pointer transition-colors">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${editFeatures.learning_resources ? 'bg-blue-400' : 'bg-gray-600'}`} />
                            <span className="text-xs font-bold text-white/90">학습 자료</span>
                          </div>
                          <p className="text-[9px] text-gray-500 leading-tight">교재 PDF 자료실, 디지털 수학 서재</p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={editFeatures.learning_resources}
                          onChange={(e) => setEditFeatures(prev => ({ ...prev, learning_resources: e.target.checked }))}
                          className="accent-blue-500 rounded border-white/10 mt-1 cursor-pointer"
                        />
                      </label>

                      {/* 평가 관리 */}
                      <label className="flex items-start justify-between gap-2 p-2 rounded-[2px] bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 cursor-pointer transition-colors">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${editFeatures.assessment_tools ? 'bg-blue-400' : 'bg-gray-600'}`} />
                            <span className="text-xs font-bold text-white/90">평가 관리</span>
                          </div>
                          <p className="text-[9px] text-gray-500 leading-tight">기출문제 관리, 오답노트 관리, 교재 오류 관리</p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={editFeatures.assessment_tools}
                          onChange={(e) => setEditFeatures(prev => ({ ...prev, assessment_tools: e.target.checked }))}
                          className="accent-blue-500 rounded border-white/10 mt-1 cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* 💡 [추가] 위험 지대: 학원 영구 삭제 UI */}
                <div className="border-t border-red-950/30 pt-4 mt-2">
                  {!showDeleteSection ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteSection(true)}
                      className="w-full py-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 hover:border-red-500/30 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      🚨 이 학원 영구 삭제하기
                    </button>
                  ) : (
                    <div className="space-y-3 bg-red-950/10 border border-red-900/30 p-4 rounded-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-red-400 font-black uppercase tracking-widest">위험: 학원 영구 파괴</span>
                        <button type="button" onClick={() => setShowDeleteSection(false)} className="text-gray-500 hover:text-white text-[10px] font-bold">닫기</button>
                      </div>
                      <p className="text-[9px] text-red-300/80 leading-relaxed font-bold">
                        이 작업은 되돌릴 수 없습니다. 확인을 위해 학원 주소 슬러그 <code className="bg-black/60 px-1.5 py-0.5 rounded text-white font-mono text-[9px]">{editingAcademy.slug}</code>를 아래에 똑같이 입력해 주세요.
                      </p>
                      <input
                        type="text"
                        placeholder="슬러그 입력"
                        value={deleteConfirmInput}
                        onChange={(e) => setDeleteConfirmInput(e.target.value)}
                        className="w-full bg-black/60 border border-red-500/30 rounded-sm py-2 px-3 text-xs text-white outline-none focus:border-red-500 font-bold"
                      />
                      <button
                        type="button"
                        disabled={isDeleting || deleteConfirmInput.trim().toLowerCase() !== editingAcademy.slug}
                        onClick={handleDeleteAcademy}
                        className="w-full py-3 bg-red-700 hover:bg-red-600 disabled:opacity-30 disabled:hover:bg-red-700 text-white rounded-sm text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                      >
                        {isDeleting ? <Loader2 size={12} className="animate-spin" /> : '영구 삭제 실행 (Auth 포함)'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-red-500/5 border border-red-500/10 p-3 rounded-sm text-[10px] text-red-400 font-bold leading-relaxed">
                  ⚠️ 주의: 주소 식별자(slug) 변경 시 해당 지점의 접속 URL이 완전히 변경되며, 오답노트 지점의 슬러그도 동시에 갱신됩니다.
                </div>

                </div>

                {/* Sticky Footer */}
                <div className="sticky bottom-0 z-10 shrink-0 bg-[#121212] border-t border-white/10 p-4 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleCloseEditModal()}
                    disabled={isUpdating}
                    className="flex-1 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-300 py-2.5 text-xs font-black uppercase tracking-wider rounded-sm transition-all border border-white/10"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 text-xs font-black uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/20"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>저장 중...</span>
                      </>
                    ) : (
                      <span>변경 저장</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
