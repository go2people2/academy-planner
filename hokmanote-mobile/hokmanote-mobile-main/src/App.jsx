import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, User, Users, MapPin } from 'lucide-react';
import { supabase } from './lib/supabase';
import AdminPage from './pages/AdminPage';
import StudentSubmitPage from './pages/StudentSubmitPage';

// 학원별 테마 설정
const THEMES = {
  navy: {
    primary: '#1e3a8a', // navy (blue-900)
    bg: '#f8faff',
    ring: 'focus:ring-blue-900'
  },
  default: {
    primary: '#1e3a8a',
    bg: '#f8faff',
    ring: 'focus:ring-blue-900'
  },
  green: {
    primary: '#10b981', // green (emerald-500)
    bg: '#ecfdf5',
    ring: 'focus:ring-emerald-500'
  },
  orange: {
    primary: '#f97316', // orange-500
    bg: '#fff7ed',
    ring: 'focus:ring-orange-500'
  },
  purple: {
    primary: '#8b5cf6', // purple-500
    bg: '#f5f3ff',
    ring: 'focus:ring-purple-500'
  },
  skyblue: {
    primary: '#0ea5e9', // sky-500
    bg: '#f0f9ff',
    ring: 'focus:ring-sky-500'
  },
  pink: {
    primary: '#db2777', // pink-600
    bg: '#fdf2f8',
    ring: 'focus:ring-pink-600'
  },
  indigo: {
    primary: '#4f46e5', // indigo-600
    bg: '#eef2ff',
    ring: 'focus:ring-indigo-600'
  },
  rose: {
    primary: '#e11d48', // rose-600
    bg: '#fff1f2',
    ring: 'focus:ring-rose-600'
  },
  teal: {
    primary: '#0d9488', // teal-600
    bg: '#f0fdfa',
    ring: 'focus:ring-teal-600'
  },
  slate: {
    primary: '#64748b', // slate-500 (중회색)
    bg: '#f1f5f9',      // slate-100 (연회색 배경)
    ring: 'focus:ring-slate-500'
  },
  black: {
    primary: '#000000', // pure black
    bg: '#ffffff',      // pure white
    ring: 'focus:ring-black'
  },
  yellow: {
    primary: '#451a03', // 찐브라운 (deep brown)
    bg: '#fbbf24',      // 진노랑 (bright amber-400)
    ring: 'focus:ring-amber-950'
  },
  mint: {
    primary: '#064e3b', // 딥에메랄드 (deep emerald-950)
    bg: '#34d399',      // 선명한 민트 (emerald-400)
    ring: 'focus:ring-emerald-950'
  },
  lime: {
    primary: '#1a2e05', // 딥올리브 (deep lime-950)
    bg: '#a3e635',      // 형광라임 (lime-400)
    ring: 'focus:ring-lime-950'
  },
  gold: {
    primary: '#431407', // 딥브라운 (deep orange-950)
    bg: '#f97316',      // 선명한 오렌지/골드 (orange-500)
    ring: 'focus:ring-orange-950'
  },
  charcoal: {
    primary: '#a3e635', // 라임 그린 (lime-400)
    bg: '#0f172a',      // 차콜 그레이 (slate-900)
    ring: 'focus:ring-lime-400',
    buttonText: '#0f172a' // 차콜 그레이색 글씨
  },
  'coral-navy': {
    primary: '#fb7185', // 코랄 (rose-400)
    bg: '#020617',      // 네이비 블루 (blue-950)
    ring: 'focus:ring-rose-400'
  },
  chalkboard: {
    primary: '#ffffff', // 분필 화이트 (white)
    bg: '#064e3b',      // 칠판 그린 (emerald-900)
    ring: 'focus:ring-white',
    buttonText: '#064e3b' // 칠판 그린색 글씨
  }
};

export default function App() {
  // 단계 관리: 0(학원확인), 1(이름입력), 2(동명이인), 3(PIN), 4(제출), 100(관리자)
  const [step, setStep] = useState(0); 
  
  // ★ 신규 추가: 학원 데이터 상태
  const [academy, setAcademy] = useState(null);
  const [academySlug, setAcademySlug] = useState('');
  
  // 기존 데이터 상태
  const [teachers, setTeachers] = useState([]); // 선생님 목록
  const [searchName, setSearchName] = useState(''); // 검색할 이름
  const [candidates, setCandidates] = useState([]); // 동명이인 목록
  
  const [studentData, setStudentData] = useState(null); // 선택된 학생
  const [pin, setPin] = useState(''); // 입력한 PIN
  
  // UI 상태
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoClicks, setLogoClicks] = useState(0); // 관리자 진입용 클릭 카운트
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // 현재 테마 (학원 정보가 없으면 기본값 사용)
  const currentTheme = academy && THEMES[academy.theme] ? THEMES[academy.theme] : THEMES.default;

  // 에러 메시지 3초 뒤 자동 숨김 기능 (기존 유지)
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 3000);
    return () => clearTimeout(t);
  }, [error]);

  // ★ 1. 앱 실행 시 학원 정보 확인 (서브도메인 -> 환경변수 -> URL 파라미터)
  useEffect(() => {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    let targetSlug = '';

    // 1순위: 서브도메인 체크 (예: hokma.hokmanote.com)
    // 도메인이 3부분 이상이고(sub.domain.com), 로컬호스트가 아닐 때
    if (parts.length >= 3 && !hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
      // 첫 번째 파트가 학원 코드 (단, netlify나 cloudflare 자체 주소인 경우 제외 로직 추가 가능)
      if (parts[parts.length - 2] === 'hokmanote') { // 우리 도메인일 때만 서브도메인 사용
        targetSlug = parts[0];
      }
    }

    // 2순위: URL 파라미터 확인 (?center=...) 또는 환경변수
    if (!targetSlug) {
      const params = new URLSearchParams(window.location.search);
      const urlSlug = params.get('center');
      const envSlug = import.meta.env.VITE_ACADEMY_SLUG;
      targetSlug = urlSlug || envSlug;
    }

    if (targetSlug) {
      setAcademySlug(targetSlug);
      checkAcademy(targetSlug);
    }
  }, []);

  // ★ 학원 정보 가져오기 & 선생님 목록 로딩 함수
  const checkAcademy = async (slugInput) => {
    const slug = slugInput || academySlug;
    if (!slug.trim()) {
      setError('지점 코드가 입력되지 않았습니다.');
      return;
    }

    setLoading(true);
    try {
      // academies 테이블에서 slug로 정보 조회
      const { data, error } = await supabase
        .from('academies')
        .select('*')
        .eq('slug', slug.trim())
        .single();

      if (error || !data) {
        throw new Error('학원 정보를 찾을 수 없습니다.');
      }

      console.log('Fetched Academy Data:', data); // ★ 디버깅용 로그 추가

      setAcademy(data); // 학원 정보 저장
      setStep(1); // 학원 확인 완료 -> 이름 입력 단계로 이동
      
      // 해당 학원의 선생님 목록 불러오기
      fetchTeachers(data.id);

    } catch (err) {
      console.error(err);
      setError('지점 정보를 불러올 수 없습니다. 코드를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // 선생님 목록 불러오기 (학원 ID로 필터링)
  const fetchTeachers = async (academyId) => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, name')
        .eq('academy_id', academyId); // ★ 핵심: 우리 학원 선생님만!
      
      if (error) throw error;
      if (data) setTeachers(data);
    } catch (err) {
      console.error('선생님 목록 로딩 실패:', err);
    }
  };

  // 1단계: 이름으로 학생 찾기
  const handleSearchStudent = async (e) => {
    e.preventDefault();
    if (!searchName.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 이름 + 학원ID로 검색 (다른 학원 학생 검색 방지)
      const { data: students, error: searchError } = await supabase
        .from('student_users')
        .select('*')
        .eq('name', searchName.trim())
        .eq('academy_id', academy.id); // ★ 핵심: 우리 학원 학생만!

      if (searchError) throw searchError;

      if (!students || students.length === 0) {
        setError('등록되지 않은 학생입니다. 이름을 확인해주세요.');
        setLoading(false);
        return;
      }

      if (students.length === 1) {
        // 1명만 발견되면 바로 PIN 입력 단계로
        setStudentData(students[0]);
        setStep(3); 
      } else {
        // 동명이인이 있으면 목록 보여주기 (Step 2)
        setCandidates(students);
        setStep(2); 
      }
    } catch (err) {
      console.error(err);
      setError('학생 검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 2단계: 동명이인 중 본인 선택
  const handleSelectCandidate = (student) => {
    setStudentData(student);
    setStep(3); // PIN 입력으로 이동
  };

  // 3단계: PIN 검증 (보안 RPC 호출)
  const handlePinLogin = async (e) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setLoading(true);
    
    // DB 함수(verify_pin) 호출하여 보안 검증
    const { data: isCorrect, error: rpcError } = await supabase.rpc('verify_pin', {
      student_id_input: studentData.id,
      pin_input: pin.trim(),
    });

    if (rpcError) {
      console.error(rpcError);
      setError('로그인 시스템 오류가 발생했습니다.');
    } else if (isCorrect) {
      // 로그인 성공: 최신 정보(교재 배정 내역 등) 다시 불러오기
      const { data: fullData } = await supabase
        .from('student_users')
        .select('*')
        .eq('id', studentData.id)
        .single();
      
      setStudentData(fullData);
      setStep(4); // 메인 화면(제출 페이지)으로 이동
      setPin('');
      setError('');
    } else {
      setError('PIN 번호가 올바르지 않습니다.');
    }

    setLoading(false);
  };

  // 로그아웃 (학원 정보는 유지)
  const handleLogout = () => {
    setStudentData(null);
    setCandidates([]);
    setSearchName('');
    setPin('');
    // 학원 정보(academy)는 유지한 채 이름 입력 단계(1)로 이동
    // (학생이 실수로 로그아웃해도 학원 코드를 다시 칠 필요 없음)
    setStep(1); 
  };

  // 관리자 인증 로직
  const handleAdminLogin = (e) => {
    e.preventDefault();
    // ★ 데이터베이스에서 가져온 학원별 비밀번호와 비교
    if (academy && adminPassword === academy.admin_password) {
      setShowAdminLogin(false);
      setAdminPassword('');
      setStep(100); // 관리자 페이지로 이동
    } else {
      alert('비밀번호가 일치하지 않습니다.');
    }
  };

  // --- 화면 렌더링 ---

  // AdminPage (학원 ID와 테마 전달)
  if (step === 100) {
    return (
      <AdminPage
        onExit={() => {
          setStep(1);
          setLogoClicks(0);
        }}
        academyId={academy?.id}
        theme={currentTheme} // ★ 테마 객체 전달
      />
    );
  }

  // 학생 메인 페이지 (테마 색상 전달)
  if (step === 4 && studentData) {
    return (
      <StudentSubmitPage
        studentData={studentData}
        handleLogout={handleLogout}
        theme={currentTheme}
        academyId={academy?.id}
      />
    );
  }

  // 동적 스타일 생성 (테마 색상 적용)
  const themeStyle = {
    text: { color: currentTheme.primary },
    bg: { backgroundColor: currentTheme.bg },
    button: { 
      backgroundColor: currentTheme.primary,
      color: currentTheme.buttonText || '#ffffff' 
    },
    // 포커스 링 색상은 Tailwind 클래스로 직접 적용하거나 style 변수 활용
    ringColor: currentTheme.primary 
  };

  return (
    <div className="max-w-md mx-auto p-6 min-h-screen flex flex-col justify-center transition-colors duration-500" style={themeStyle.bg}>

    {/* 로고 및 학원 이름 영역 */}
    <div className="text-center mb-10 flex flex-col items-center justify-center">
      <div 
        onClick={() => {
          setLogoClicks(p => p + 1);
          if (logoClicks + 1 >= 5) {
            setShowAdminLogin(true);
            setLogoClicks(0);
          }
        }} 
        className="cursor-pointer select-none transition-all duration-300 hover:scale-105"
      >
        {/* 1. 로고 이미지가 있으면 이미지 표시 */}
        {academy?.logo_url ? (
          <img 
            src={academy.logo_url} 
            alt={academy.academy_name} 
            className="h-52 w-auto object-contain mx-auto mb-6"
            style={{ maxHeight: '200px', width: 'auto' }}
          />
        ) : null}

        {/* 2. 학원 이름을 텍스트로 항상 표시 (로고 유무와 상관없이) */}
        <h1 className="text-4xl font-black tracking-tight" style={themeStyle.text}>
          {academy ? academy.academy_name : '오답노트'}
        </h1>
      </div>
      
        {/* 3. 하단 보조 문구 (환영 메시지) */}
          <p className="text-slate-400 text-sm font-bold mt-2 tracking-widest opacity-80 uppercase">
            {academy?.welcome_message || 'ONLINE SUBMISSION'}
          </p>
    </div>

      {/* 로딩 인디케이터 */}
      {loading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Loader2 className="animate-spin" size={40} style={themeStyle.text} />
        </div>
      )}

      {/* STEP 0: 학원 코드 입력 (설정된 학원이 없을 때만 보임) */}
      {step === 0 && (
        <form onSubmit={(e) => { e.preventDefault(); checkAcademy(); }} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100">
            <label className="block text-center text-sm font-bold text-slate-400 mb-4">
              지점 코드를 입력하세요
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
              <input
                value={academySlug}
                onChange={(e) => setAcademySlug(e.target.value)}
                className={`w-full text-center text-xl font-bold p-4 pl-10 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-opacity-50 transition-all text-slate-800 ${currentTheme.ring}`}
                style={{ '--tw-ring-color': currentTheme.primary }}
                placeholder="code"
                autoFocus
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full p-4 font-bold rounded-xl shadow-lg hover:brightness-110 transition-all active:scale-95"
            style={themeStyle.button}
          >
            확인
          </button>
        </form>
      )}

      {/* STEP 1: 이름 입력 */}
      {step === 1 && (
        <form onSubmit={handleSearchStudent} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <input
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className={`w-full text-center text-2xl font-bold p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 placeholder:text-slate-300 text-slate-800 transition-all ${currentTheme.ring}`}
              style={{ '--tw-ring-color': currentTheme.primary }}
              placeholder="이름을 입력하세요"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={!searchName.trim()}
            className="w-full p-4 font-bold rounded-2xl shadow-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:scale-100 active:scale-95"
            style={themeStyle.button}
          >
            확인
          </button>
        </form>
      )}

      {/* STEP 2: 동명이인 선택 (본인 확인) */}
      {step === 2 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-slate-800">
              '{searchName}' 학생이 여러 명입니다.
            </h2>
            <p className="text-sm text-slate-500">본인의 정보를 선택해주세요.</p>
          </div>
          
          <div className="space-y-3">
            {candidates.map((student) => {
              // 선생님 이름 찾기
              const teacherName = teachers.find(t => t.id === student.teacher_id)?.name || '선생님 미정';
              
              return (
                <button
                  key={student.id}
                  onClick={() => handleSelectCandidate(student)}
                  className="w-full bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all text-left flex items-center gap-4 group"
                  style={{ borderColor: 'transparent' }} 
                  onMouseOver={(e) => e.currentTarget.style.borderColor = currentTheme.primary}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'transparent'}
                >
                  <div 
                    className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 group-hover:text-white transition-colors"
                    style={{ '--hover-color': currentTheme.primary }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = currentTheme.primary}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} // slate-100
                  >
                    <User size={24} />
                  </div>
                  <div>
                    <div className="font-black text-lg text-slate-800">
                      {student.name}
                      <span 
                        className="ml-2 text-sm font-bold px-2 py-0.5 rounded-md bg-slate-100" 
                        style={{ color: currentTheme.primary }}
                      >
                        {student.grade || '학년 미정'}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400 font-bold mt-1 flex items-center gap-1">
                      <Users size={12} />
                      {teacherName} 선생님 담당
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setStep(1)}
            className="w-full p-4 text-slate-400 font-bold hover:text-slate-600 transition-colors"
          >
            이름 다시 입력하기
          </button>
        </div>
      )}

      {/* STEP 3: PIN 입력 */}
      {step === 3 && studentData && (
        <form onSubmit={handlePinLogin} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-800 mb-1">
              오늘도 화이팅, {studentData.name}
            </h2>
            <p className="text-sm font-bold text-slate-400">
              {studentData.grade ? `${studentData.grade}  •  ` : ''}
              {teachers.find(t => t.id === studentData.teacher_id)?.name} 선생님 반
            </p>
          </div>

          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <label className="block text-center text-xs font-black text-slate-400 mb-4 uppercase tracking-widest">
              Passcode
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                if (val.length <= 6) setPin(val);
              }}
              className={`w-full text-center text-4xl font-mono tracking-[0.5em] p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 placeholder:text-slate-200 text-slate-800 ${currentTheme.ring}`}
              style={{ '--tw-ring-color': currentTheme.primary }}
              placeholder="••••"
              maxLength={6}
              autoFocus
            />
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={pin.length < 3}
              className="w-full p-4 font-bold rounded-2xl shadow-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:scale-100 active:scale-95"
              style={themeStyle.button}
            >
              로그인
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setPin('');
                setSearchName('');
              }}
              className="w-full text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              다른 계정으로 로그인
            </button>
          </div>
        </form>
      )}

      {/* 에러 메시지 알림 (화면 하단) */}
      {error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-rose-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold z-50 animate-bounce">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* 관리자 로그인 모달 (5회 클릭 시 등장) */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-3xl w-full max-w-xs shadow-2xl space-y-4">
            <h3 className="text-center font-black text-slate-800 text-lg">
              관리자 모드 ({academy ? academy.academy_name : '전체'})
            </h3>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full p-4 bg-slate-100 rounded-2xl text-center font-mono text-xl outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Password"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdminLogin(false)}
                className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
              >
                취소
              </button>
              <button
                onClick={handleAdminLogin}
                className="flex-1 py-3 text-white font-bold rounded-xl hover:brightness-110"
                style={themeStyle.button}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}