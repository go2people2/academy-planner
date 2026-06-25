'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LayoutGrid, Plus, Globe, User, Lock, Loader2, LogOut, CheckCircle2, AlertTriangle, ChevronRight, School } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MasterDashboard() {
  const [mounted, setMounted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [academies, setAcademies] = useState<any[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Form fields (Create Academy)
  const [academyName, setAcademyName] = useState('');
  const [slug, setSlug] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | null, text: string }>({ type: null, text: '' });
  
  // Master Login Fields
  const [masterId, setMasterId] = useState('');
  const [masterPw, setMasterPw] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const userStr = localStorage.getItem('ams_user');
    if (!userStr) {
      setIsAuthorized(false);
      return;
    }
    try {
      const user = JSON.parse(userStr);
      if (user.role !== 'master') {
        setIsAuthorized(false);
        return;
      }
      
      // 💡 [개선] 마스터가 시스템 포털(/master)에 돌아오면 임시 타 학원 접속 상태를 해제하고 실제 DB상 소속(가상 관리국)으로 복원
      const { data: profile, error } = await supabase
        .from('ams_teachers')
        .select('academy_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && profile) {
        const restoredUser = {
          ...user,
          academy_id: profile.academy_id
        };
        localStorage.setItem('ams_user', JSON.stringify(restoredUser));
        localStorage.removeItem('ams_is_warp'); // 💡 임시 원격 접속(워프) 플래그 제거
      }

      setIsAuthorized(true);
      fetchAcademies();
    } catch (e) {
      setIsAuthorized(false);
    }
  };

  const handleMasterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      let email = masterId.trim().toLowerCase();
      if (!email.includes('@')) {
        email = `${email}@hokma-academy.com`;
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: masterPw,
      });

      if (authError) {
        setLoginError('아이디 또는 비밀번호가 올바르지 않습니다.');
        setIsLoggingIn(false);
        return;
      }

      if (data?.user) {
        const { data: profile, error: pErr } = await supabase
          .from('ams_teachers')
          .select('id, name, role, academy_id')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (pErr || !profile) {
          await supabase.auth.signOut();
          setLoginError('사용자 프로필을 가져올 수 없습니다.');
          setIsLoggingIn(false);
          return;
        }

        if (profile.role !== 'master') {
          await supabase.auth.signOut();
          setLoginError('접근 권한이 없습니다. 마스터 계정만 접근 가능합니다.');
          setIsLoggingIn(false);
          return;
        }

        // 로그인 성공 처리
        const masterUser = {
          role: profile.role,
          id: profile.id,
          name: profile.name,
          academy_id: profile.academy_id
        };
        localStorage.setItem('ams_user', JSON.stringify(masterUser));
        setIsAuthorized(true);
        fetchAcademies();
      }
    } catch (err) {
      console.error('Master login exception:', err);
      setLoginError('로그인 중 알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const fetchAcademies = async () => {
    setIsLoadingList(true);
    try {
      const { data, error } = await supabase
        .from('ams_academies')
        .select('id, academy_name, slug, created_at')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setAcademies(data);
      }
    } catch (e) {
      console.error('Fetch academies error:', e);
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg({ type: null, text: '' });

    // 간단한 프론트엔드 포맷 검증
    if (!/^[a-zA-Z0-9-]+$/.test(slug)) {
      setStatusMsg({
        type: 'error',
        text: '슬러그는 오직 영문자, 숫자, 하이픈(-)만 포함할 수 있습니다.'
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/master/create-academy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academyName, slug, username, password })
      });
      const data = await res.json();
      
      if (data.success) {
        setStatusMsg({
          type: 'success',
          text: `[${academyName}] 학원이 성공적으로 자동 개설되었습니다! 로그인 ID: ${username}`
        });
        // 폼 리셋
        setAcademyName('');
        setSlug('');
        setUsername('');
        setPassword('');
        fetchAcademies();
      } else {
        setStatusMsg({
          type: 'error',
          text: data.error || '학원 개설에 실패했습니다.'
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: '서버 통신 오류가 발생했습니다.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ams_user');
    setIsAuthorized(false);
  };

  const handleWarpToAcademy = (targetAcademyId: string, targetSlug: string) => {
    const userStr = localStorage.getItem('ams_user');
    if (!userStr) return;
    try {
      const user = JSON.parse(userStr);
      if (user.role === 'master') {
        const tempUser = {
          ...user,
          academy_id: targetAcademyId
        };
        localStorage.setItem('ams_user', JSON.stringify(tempUser));
        localStorage.setItem('ams_is_warp', 'true'); // 💡 임시 원격 접속(워프) 플래그 설정
        router.push(`/${targetSlug}/dashboard`);
      }
    } catch (e) {
      console.error('Warp error:', e);
    }
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
                      <th className="py-3 px-2 text-right">개설 일시</th>
                      <th className="py-3 px-2 text-right">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academies.map((ac) => (
                      <tr key={ac.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-all font-bold text-white/90 group">
                        <td className="py-3.5 px-2 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 group-hover:scale-125 transition-transform" />
                          <span>{ac.academy_name}</span>
                        </td>
                        <td className="py-3.5 px-2">
                          <code className="bg-black/40 border border-white/5 px-2 py-1 rounded-[2px] text-[10px] text-blue-300 font-bold">
                            /{ac.slug}
                          </code>
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
                          <button
                            onClick={() => handleWarpToAcademy(ac.id, ac.slug)}
                            className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-[9px] font-black uppercase tracking-wider rounded-[2px] transition-all shadow-md shadow-purple-900/10"
                          >
                            접속
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
