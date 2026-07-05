'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { User, Lock, ArrowRight, Loader2, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function LoginForm({ academy }: { academy: any }) {
  const { slug } = useParams();
  const [loginType, setLoginType] = useState<'teacher' | 'student'>('teacher');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phoneLast4, setPhoneLast4] = useState('');
  const [candidateStudents, setCandidateStudents] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLightTheme, setIsLightTheme] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light') {
        setIsLightTheme(true);
      }
    }
  }, []);

  if (!academy) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white bg-black p-4 text-center">
        <div className="space-y-4">
          <Lock size={48} className="mx-auto text-red-500" />
          <h1 className="text-xl font-black uppercase tracking-widest">Unregistered Access</h1>
          <p className="text-gray-400 text-sm">죄송합니다. [{slug}] 슬러그로 등록된 학원을 찾을 수 없습니다.</p>
          <button 
            onClick={() => window.location.href = '/'} 
            className="px-6 py-2 bg-white/10 hover:bg-white/20 transition-all rounded-[2px] text-xs font-black uppercase tracking-widest"
          >
            Back to Main
          </button>
        </div>
      </div>
    );
  }

  const handleSelectStudent = (student: any) => {
    localStorage.setItem('ams_student', JSON.stringify(student));
    router.push(`/${slug}/student`);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (loginType === 'teacher') {
        // 💡 [개선] Supabase Auth 공식 인증 (이메일 매핑 기반)
        const email = `${username.trim().toLowerCase()}@hokma-academy.com`;
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (authError) {
          console.error('Auth error:', authError.message);
          alert('아이디 또는 비밀번호가 올바르지 않습니다.');
          setIsLoading(false);
          return;
        }

        if (data?.user) {
          // 💡 [중요] Auth 세션 기반으로 ams_teachers 테이블에서 실제 프로필 정보 로드
          const { data: profile, error: pErr } = await supabase
            .from('ams_teachers')
            .select('id, name, role, academy_id')
            .eq('user_id', data.user.id)
            .maybeSingle();

          if (pErr || !profile) {
            console.error('Profile fetch error:', pErr);
            alert('인증은 성공했으나 교사 정보를 찾을 수 없습니다. (마이그레이션 확인 필요)');
            setIsLoading(false);
            return;
          }

          // 💡 [호환성] 기존 앱 상태 포맷으로 localStorage 저장
          localStorage.setItem('ams_user', JSON.stringify({
            role: profile.role || 'teacher',
            id: profile.id, // 앱 내부에서 쓰이는 DB PK (teacher_id)
            name: profile.name,
            academy_id: profile.academy_id
          }));
          
          setIsLoading(false); // 이동 전 로딩 상태 해제
          router.push(`/${slug}/dashboard`);
        }
      } else {
        // 3. 학생 로그인 체크 (ams_students 테이블 조회)
        const masterPasskey = academy.student_passkey || '2324';
        const isMasterAccess = phoneLast4 === masterPasskey;

        if (!phoneLast4 || phoneLast4.length < 4) {
          alert('번호 4자리를 입력해 주세요.');
          setIsLoading(false);
          return;
        }

        try {
          if (isMasterAccess) {
            // 마스터 패스키인 경우: 학원의 모든 학생 목록 로드 (가나다순)
            const { data: allStudents, error: sErr } = await supabase
              .from('ams_students')
              .select('*')
              .eq('academy_id', academy.id)
              .is('is_deleted', false)
              .order('name', { ascending: true });

            if (sErr) throw sErr;

            if (allStudents && allStudents.length > 0) {
              setCandidateStudents(allStudents);
            } else {
              alert('학원에 등록된 학생이 없습니다.');
            }
            setIsLoading(false);
            return;
          }

          // 일반 4자리 조회
          const { data: list, error: sErr } = await supabase
            .from('ams_students')
            .select('*')
            .eq('academy_id', academy.id)
            .is('is_deleted', false)
            .like('phone', `%${phoneLast4}`);

          if (sErr) throw sErr;

          // 실제 전화번호 뒷 4자리 재검증
          const matchedList = (list || []).filter(s => {
            const sCleanPhone = (s.phone || '').replace(/[^0-9]/g, '');
            return sCleanPhone.endsWith(phoneLast4);
          });

          if (matchedList.length === 0) {
            alert('등록된 학생 정보를 찾을 수 없습니다.');
          } else if (matchedList.length === 1) {
            localStorage.setItem('ams_student', JSON.stringify(matchedList[0]));
            router.push(`/${slug}/student`);
          } else {
            // 중복 시 선택 리스트 생성
            setCandidateStudents(matchedList);
          }
        } catch (err) {
          console.error('Student login error:', err);
          alert('학생 로그인 중 오류가 발생했습니다.');
        } finally {
          setIsLoading(false);
        }
      }
    } catch (err) {
      console.error('Login fatal error:', err);
      alert('로그인 처리 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center transition-all duration-300 ${
      isLightTheme 
        ? 'bg-[#f4f4f5] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-[#f4f4f5] to-[#edece9]' 
        : 'bg-[#0a0a0a] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1a1a1a] via-[#0a0a0a] to-[#050505]'
    }`}>
      {!isLightTheme && (
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      )}
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`z-10 w-full max-w-md p-8 rounded-lg border transition-all duration-350 ${
          isLightTheme 
            ? 'bg-white border-[#e3e2e0] shadow-xl text-[#37352f]' 
            : 'bg-[#111111]/80 backdrop-blur-xl border-white/10 shadow-2xl text-white'
        }`}
      >
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-black tracking-tight mb-2 uppercase ${
            isLightTheme ? 'text-[#37352f]' : 'text-white'
          }`}>
            {academy.academy_name}
          </h1>
        </div>

        <div className={`flex mb-8 p-1 rounded-md border gap-1 transition-all ${
          isLightTheme 
            ? 'bg-gray-100 border-[#edece9]' 
            : 'bg-black/40 border-white/5'
        }`}>
          <button 
            type="button"
            onClick={() => setLoginType('teacher')}
            className={`flex-1 py-2.5 text-sm font-black tracking-tight transition-all rounded-md ${
              loginType === 'teacher' 
                ? (isLightTheme ? 'bg-white text-blue-600 shadow-sm border border-[#edece9]' : 'bg-blue-600 text-white shadow-lg') 
                : (isLightTheme ? 'text-gray-400 hover:text-[#37352f]' : 'text-gray-600 hover:text-gray-400')
            }`}
          >
            선생님 / 관리자
          </button>
          <button 
            type="button"
            onClick={() => setLoginType('student')}
            className={`flex-1 py-2.5 text-sm font-black tracking-tight transition-all rounded-md ${
              loginType === 'student' 
                ? (isLightTheme ? 'bg-white text-blue-600 shadow-sm border border-[#edece9]' : 'bg-blue-600 text-white shadow-lg') 
                : (isLightTheme ? 'text-gray-400 hover:text-[#37352f]' : 'text-gray-600 hover:text-gray-400')
            }`}
          >
            학생 로그인
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {loginType === 'teacher' ? (
            <>
              <div className="space-y-1">
                <label className="text-[13px] font-bold text-gray-500 tracking-tight ml-1">
                  선생님 아이디
                </label>
                <div className="relative group">
                  <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
                    isLightTheme ? 'text-gray-400 group-focus-within:text-blue-600' : 'text-gray-600 group-focus-within:text-blue-500'
                  }`} />
                  <input 
                    type="text"
                    placeholder="ID"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={`w-full border rounded-[4px] py-4 pl-12 pr-4 outline-none transition-all ${
                      isLightTheme 
                        ? 'bg-white border-[#edece9] text-[#37352f] focus:border-blue-500 placeholder-gray-300 font-bold' 
                        : 'bg-black/40 border-white/5 text-white focus:ring-1 focus:ring-blue-500/50'
                    }`}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[13px] font-bold text-gray-500 tracking-tight ml-1">
                  비밀번호
                </label>
                <div className="relative group">
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
                    isLightTheme ? 'text-gray-400 group-focus-within:text-blue-600' : 'text-gray-600 group-focus-within:text-blue-500'
                  }`} />
                  <input 
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full border rounded-[4px] py-4 pl-12 pr-4 outline-none transition-all ${
                      isLightTheme 
                        ? 'bg-white border-[#edece9] text-[#37352f] focus:border-blue-500 placeholder-gray-300 font-bold' 
                        : 'bg-black/40 border-white/5 text-white focus:ring-1 focus:ring-blue-500/50'
                    }`}
                    required
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {candidateStudents && candidateStudents.length > 0 ? (
                <div className="space-y-4 text-left">
                  <div className={`text-center pb-2 border-b ${
                    isLightTheme ? 'border-gray-200' : 'border-white/5'
                  }`}>
                    <h3 className={`text-sm font-black uppercase tracking-widest ${
                      isLightTheme ? 'text-[#37352f]' : 'text-white'
                    }`}>
                      {phoneLast4 === (academy.student_passkey || '2324') ? '전체 학생 목록 (마스터)' : '본인 이름을 선택해 주세요'}
                    </h3>
                    <p className="text-gray-500 text-xs mt-1 font-bold">
                      {phoneLast4 === (academy.student_passkey || '2324') ? '접속할 학생을 클릭하세요.' : '전화번호 뒷자리가 일치하는 학생 목록입니다.'}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar-v">
                    {candidateStudents.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectStudent(s)}
                        className={`py-3.5 px-3 border rounded-[4px] transition-all text-left flex flex-col justify-between h-16 ${
                          isLightTheme 
                            ? 'bg-white border-[#edece9] hover:bg-blue-50 hover:border-blue-300 text-[#37352f]' 
                            : 'bg-white/5 border border-white/10 hover:bg-blue-600 hover:border-blue-500 text-white'
                        }`}
                      >
                        <span className={`font-black text-sm block truncate ${isLightTheme ? 'text-[#37352f]' : ''}`}>{s.name}</span>
                        <span className={`text-[11px] block truncate font-bold mt-1 ${isLightTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                          {s.school || '학원생'} {s.grade || ''}
                        </span>
                      </button>
                    ))}
                  </div>
  
                  <button
                    type="button"
                    onClick={() => setCandidateStudents(null)}
                    className={`w-full py-3.5 border rounded-[4px] text-sm font-black tracking-tight transition-all mt-2 ${
                      isLightTheme 
                        ? 'bg-gray-100 border-[#edece9] text-gray-500 hover:text-black' 
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    뒤로 가기 (다시 입력)
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[13px] font-bold text-gray-500 tracking-tight ml-1">
                    학생 패스코드 (전화번호 뒷 4자리)
                  </label>
                  <div className="relative group">
                    <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
                      isLightTheme ? 'text-gray-400 group-focus-within:text-blue-600' : 'text-gray-600 group-focus-within:text-blue-400'
                    }`} />
                    <input 
                      type="tel"
                      maxLength={4}
                      placeholder="번호 4자리 입력"
                      value={phoneLast4}
                      onChange={(e) => setPhoneLast4(e.target.value.replace(/[^0-9]/g, ''))}
                      className={`w-full border rounded-[4px] py-4 pl-12 pr-4 outline-none transition-all font-black text-lg tracking-[0.3em] text-center ${
                        isLightTheme 
                          ? 'bg-white border-[#edece9] text-[#37352f] focus:border-blue-500 placeholder-gray-300' 
                          : 'bg-black/40 border-white/5 text-white focus:ring-1 focus:ring-blue-500/50'
                      }`}
                      required
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {!(loginType === 'student' && candidateStudents && candidateStudents.length > 0) && (
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-[4px] transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span className="tracking-tight text-sm font-bold">안전하게 로그인</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          )}
        </form>
      </motion.div>
    </div>
  );
}
