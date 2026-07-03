import LoginForm from "@/components/auth/LoginForm";
import { supabase } from "@/lib/supabase";

export default async function LoginPage({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  // Next.js 버전에 따라 params가 Promise일 수도 있으므로 분기 처리
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  
  const normalizedSlug = Array.isArray(slug) ? slug[0] : slug;
  
  // 서버 측에서 안전하게 Supabase 조회
  const { data: academy, error } = await supabase
    .from('ams_academies')
    .select('*')
    .eq('slug', normalizedSlug.toLowerCase())
    .single();

  if (error || !academy) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-center p-6">
        <div className="bg-[#111111]/80 backdrop-blur-xl border border-red-500/20 p-10 rounded-[4px] shadow-2xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-xl font-black text-white uppercase tracking-tight">Unregistered Access</h1>
            <p className="text-gray-400 text-xs leading-relaxed">
              죄송합니다. <span className="text-red-400 font-bold">[{normalizedSlug}]</span> 슬러그로 등록된 학원을 찾을 수 없습니다.<br/>
              주소를 다시 확인하거나 관리자에게 문의해 주세요.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // 💡 서비스 일시 정지 체크 및 차단
  if (academy?.operation_settings?.is_suspended === true) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-center p-6">
        <div className="bg-[#111111]/80 backdrop-blur-xl border border-red-500/20 p-10 rounded-[4px] shadow-2xl space-y-6 max-w-sm">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30 text-red-500 mx-auto animate-pulse">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-sm font-black text-white uppercase tracking-widest">서비스 제공이 일시 중지되었습니다</h1>
            <p className="text-gray-400 text-[11px] leading-relaxed font-bold">
              본 지점은 현재 서비스 이용이 잠시 중지되었습니다.<br/>
              이용 구독 갱신 또는 상태 점검 중이오니 시스템 마스터 관리자에게 문의해 주세요.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0a0a0a] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1a1a1a] via-[#0a0a0a] to-[#050505]">
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      
      <div className="z-10 w-full max-w-md px-4">
        <LoginForm academy={academy} />
      </div>
    </main>
  );
}
