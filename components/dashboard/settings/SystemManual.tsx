import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Bell, Table, ClipboardCheck, Activity, 
  UserCog, ArrowLeftRight, Settings, Info, Keyboard, 
  Sparkles, ChevronDown, Play 
} from 'lucide-react';

import VideoPlayerModal from '@/components/common/VideoPlayerModal';

const DEFAULT_TIMESTAMPS_TEXT = `[00:00] 시작
[00:05] 27번
[02:10] 28번
[04:46] 29번
[05:57] 30번
[06:58] 31번
[07:47] 32번
[08:49] 33번
[10:33] 34번
[12:53] 35번
[13:16] 36번
[14:22] 37번
[15:44] 38번
[17:20] 39번
[18:50] 40번
[20:14] 41번
[21:11] 42번
[22:24] 43번
[23:27] 44번
[25:15] 45번
[26:33] 46번
[28:03] 47번
[30:52] 48번
[34:03] 49번`;

export default function SystemManual() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  const manuals = [
    {
      icon: <LayoutDashboard size={20} className="text-blue-400" />,
      title: "Overview (대시보드 요약)",
      desc: "학원의 전반적인 등원 현황, 출석 비율, 오늘 예정된 학생 수 등 큰 그림을 한눈에 파악하는 공간입니다. 빠른 검색과 그룹 필터링을 통해 특정 학생이나 반을 훑어보기에 최적화되어 있습니다."
    },
    {
      icon: <Bell size={20} className="text-amber-400" />,
      title: "Notifications (알림 및 건의사항)",
      desc: "선생님이 학생들(학생 페이지)에게 전달하는 전체 공지나 메시지를 작성할 수 있습니다. 또한 학생들이 보내온 건의사항(숙제 조절, 질문 등)을 실시간으로 확인하고 답변을 기록합니다."
    },
    {
      icon: <Table size={20} className="text-emerald-400" />,
      title: "Daily Sheet (오늘의 출결 및 기록표)",
      desc: (
        <div className="space-y-3 pt-2">
          <p>가장 핵심적인 메뉴입니다! 선생님이 오늘 등원한 학생들의 '학원 공부', '집에서 할 숙제', '오늘 할 일 목록'을 부여합니다. 학생들이 제출(Submit)한 학습 기록을 일괄 승인하거나 반려하여 진행률을 확정 짓는 공간입니다. (할 일을 번호나 기호로 작성하면 체크박스로 자동 변환됩니다!)</p>
          <div className="p-3 bg-[#0a0a0a] rounded-[4px] border border-white/10 shadow-inner leading-relaxed">
            <p className="text-amber-400 font-black mb-1.5 flex items-center gap-1.5 tracking-wide"><Table size={12}/> 오늘 테스트 초간단 입력 문법</p>
            <ul className="space-y-1.5 text-[11px] text-gray-300">
              <li><span className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded mr-1">- 기출 : 85</span> ➜ 100점 만점으로 자동 인식 (85점 획득)</li>
              <li><span className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded mr-1">- 기출 : </span> ➜ 점수를 비워두면 <b>'채점 전'</b> 대기 상태 (회색 뱃지)</li>
              <li><span className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded mr-1">- 퀴즈 : 7/10</span> ➜ 10개 만점으로 자동 인식 (7개 획득)</li>
              <li><span className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded mr-1">- 퀴즈 : 7/10/2</span> ➜ 마지막 숫자는 커트라인(오답 허용 개수)</li>
              <li><span className="text-white font-bold bg-white/10 px-1.5 py-0.5 rounded mr-1">- 퀴즈 : /10/2</span> ➜ 점수를 비워둔 채 <b>만점</b>과 <b>컷라인</b>만 미리 세팅 (채점 전 대기)</li>
              <li className="text-gray-500 italic mt-2 border-t border-white/5 pt-1.5">
                * 쉼표(,) 뒤에 쓰거나 줄을 바꿔서 쓰는 글은 학생 리포트에는 노출되지 않는 '선생님 전용 비밀 메모'가 됩니다.
              </li>
            </ul>
          </div>

          <div className="p-3 bg-blue-950/20 rounded-[4px] border border-blue-500/20 shadow-inner leading-relaxed mt-3">
            <p className="text-blue-400 font-black mb-1.5 flex items-center gap-1.5 tracking-wide"><Sparkles size={12}/> 🔄 순환형(Cyclic) 스마트 버튼 완벽 매뉴얼</p>
            <ul className="space-y-2 text-[11px] text-gray-300">
              <li>
                <span className="text-white font-bold bg-blue-600/30 border border-blue-500/30 px-1.5 py-0.5 rounded mr-1">1. 시트 헤더 스마트 체크박스 (4단계 순환)</span>
                <p className="text-gray-400 text-[10.5px] mt-0.5 pl-2">
                  테이블 좌측 맨 첫 번째 헤더 체크박스를 누를 때마다 단 1개 버튼으로 순환됩니다:<br/>
                  <b>[ ] (전체 해제)</b> ➜ <b>[✓ 파란색] (전체 선택)</b> ➜ <b>[✓ 주황색] (선택과목만 선택)</b> ➜ <b>[✓ 청록색] (정규수업만 선택)</b> ➜ <b>[ ] (전체 해제)</b>
                </p>
              </li>
              <li>
                <span className="text-white font-bold bg-purple-600/30 border border-purple-500/30 px-1.5 py-0.5 rounded mr-1">2. Sort 정렬 통합 버튼 (4단계 순환)</span>
                <p className="text-gray-400 text-[10.5px] mt-0.5 pl-2">
                  우측 상단 툴바의 Sort 버튼 1개를 누를 때마다 정렬 모드가 즉시 바뀝니다:<br/>
                  <b>⏰ 시간순</b> ➜ <b>🔤 이름순</b> ➜ <b>🎓 학년순</b> ➜ <b>🏫 학교순</b> (옆의 UP/DOWN 버튼으로 오름차순/내림차순 유지)
                </p>
              </li>
              <li>
                <span className="text-white font-bold bg-amber-600/30 border border-amber-500/30 px-1.5 py-0.5 rounded mr-1">3. 보강 모달 과목 필터 토글 (상호 배타적)</span>
                <p className="text-gray-400 text-[10.5px] mt-0.5 pl-2">
                  보강 학생 선택 모달에서 <b>[정규만]</b> 또는 <b>[선택과목만]</b> 체크 시 상대방은 자동 해제되어 실수 없이 원하는 과목 학생만 깔끔하게 검색/선택할 수 있습니다.
                </p>
              </li>
              <li>
                <span className="text-white font-bold bg-emerald-600/30 border border-emerald-500/30 px-1.5 py-0.5 rounded mr-1">4. ⚡ 과제확인 키보드 초고속 평가 단축키</span>
                <p className="text-gray-400 text-[10.5px] mt-0.5 pl-2">
                  과제확인 팝업이 뜬 상태에서 키보드 <b>[A]~[F]</b> (또는 숫자 <b>[1]~[6]</b>)를 누르면 마우스 클릭 없이 번개처럼 평가가 즉시 입력됩니다!<br/>
                  * <b>[Esc]</b> 누름 ➜ 팝업 취소 / * 잘못된 키 입력 시 <b>좌우 쉐이크 경고 효과</b>로 시각 피드백 제공
                </p>
              </li>
            </ul>
          </div>
        </div>
      )
    },
    {
      icon: <ClipboardCheck size={20} className="text-purple-400" />,
      title: "업무 및 보강 관리",
      desc: "결석생들의 보강 일정을 캘린더에 스케줄링하고, 선생님 개개인의 업무(교재 준비, 학부모 상담 등)를 관리하는 개인별 To-Do 보드입니다."
    },
    {
      icon: <Activity size={20} className="text-rose-400" />,
      title: "Progress (진도 및 성취도 현황)",
      desc: "학생들이 현재 풀고 있는 교재의 단원별 진도율과 시험 점수, 할 일 달성률 등을 시각화된 그래프로 확인하는 곳입니다. 학생별 취약 단원을 한눈에 파악할 수 있습니다."
    },
    {
      icon: <UserCog size={20} className="text-indigo-400" />,
      title: "학생 정보 관리 (추가/수정)",
      desc: (
        <div className="space-y-1.5 pt-2">
          <p>신규 학생을 등록하거나 기존 학생의 정보(수강 반, 등원 요일, 부여된 교재 목록, 앱 비밀번호 초기화)를 수정하고 퇴원 처리를 진행할 수 있습니다.</p>
          <div className="p-2 bg-black/25 rounded border border-amber-500/10 text-[11px] text-amber-300 font-bold leading-relaxed">
            ⚠️ <b>[전화번호 뒷 4자리 중복 해결 가이드]</b><br/>
            학원에 전화번호 뒷자리가 겹치는 학생들이 존재할 경우, 로그인 페이지 충돌 및 타인 페이지 노출을 방지하기 위해 <b>&apos;Login Extra Digit(추가번호)&apos;</b>를 지정해야 합니다.
            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-gray-400 font-semibold">
              <li>중복된 학생들의 상세 수정 창에서 <span className="text-amber-400">Login Extra Digit</span> 칸에 각각 <span className="text-amber-400">1</span>, <span className="text-amber-400">2</span> 등의 숫자를 부여해 저장해 주세요.</li>
              <li>추가번호를 받은 원생은 학생 페이지 로그인 시 기존의 <span className="text-white">연락처 뒷 4자리 + 부여받은 추가번호 1자리(총 5자리)</span>를 입력하여 안전하게 독립 로그인할 수 있습니다.</li>
              <li>추가번호가 설정되지 않은 원생은 평소와 똑같이 4자리로 로그인됩니다.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      icon: <ArrowLeftRight size={20} className="text-teal-400" />,
      title: "이번 달 변동 사항",
      desc: "이번 달 신규 등록생, 휴원생, 퇴원생의 통계를 기록하고 변동 흐름을 체크하는 운영 관리 지표입니다."
    },
    {
      icon: <Settings size={20} className="text-gray-400" />,
      title: "Settings (시스템 설정)",
      desc: "학원의 기본 운영 방침을 세팅합니다. (휴일 캘린더 등록, 학원 홈페이지 연동, 사용할 교재 마스터 목록 관리, 학교별 시험 기간 설정, 동료 선생님 계정 발급 등)"
    },
    {
      icon: <Sparkles size={20} className="text-blue-400" />,
      title: "🤖 AI 상담 브리핑 연동 스펙 (프롬프트 명세)",
      desc: (
        <div className="space-y-2 pt-2">
          <p>AI 브리핑 생성 시 전달되는 정량/정성 데이터와 프롬프트 규칙 안내입니다. 가맹 학원 설명 또는 AI 조율 시 아래 명세를 활용하실 수 있습니다.</p>
          <div className="p-3 bg-[#0a0a0a] rounded-[4px] border border-white/10 shadow-inner space-y-2.5 text-[11px] leading-relaxed">
            <div>
              <span className="text-amber-400 font-black block">1. System Prompt (역할 설정 및 지시문)</span>
              <p className="text-gray-400 font-semibold mt-0.5">
                "당신은 수학 학원의 원장님과 담당 강사를 돕는 전문적인 인공지능 학습 컨설턴트 및 상담 분석가입니다. 전달받은 학생의 기본 정보, 지정된 날짜 범위의 수업 일지 데이터(출결, 숙제 태도, 평소 테스트 점수, 특이사항), 그리고 최근 OMR 고사 시험 성적 정보를 종합 분석하여 '학부모 상담용 고품질 리포트'를 작성해 주세요."
              </p>
            </div>
            <div className="border-t border-white/5 pt-2">
              <span className="text-blue-400 font-black block">2. User Prompt (데이터 구조화 템플릿)</span>
              <pre className="text-gray-500 font-mono text-[9px] whitespace-pre-wrap mt-0.5 bg-black/50 p-2 rounded border border-white/5">
{`[학생 기본 정보]
- 이름: {이름} / 학년: {학년} / 학교: {학교}
- 코스/클래스: {코스} / {클래스}

[설정된 기간의 수업 일지 기록]
- 날짜: {날짜} / 출결: {출결} / 일지 상태: {상태} / 숙제체크: {완료/미흡} / 성적: {일일테스트점수} / 특이사항: {메모}
... (기간 내 전체 로그)

[설정된 기간의 정기/OMR 고사 성적]
- 시험명: {시험지 제목} / 점수: {총점}점 / 틀린 문항 번호: {오답 문항 번호 목록}
... (기간 내 전체 시험 제출)`}
              </pre>
            </div>
            <div className="border-t border-white/5 pt-2">
              <span className="text-emerald-400 font-black block">3. AI 출력 가이드라인 (H3 3단 구성)</span>
              <ul className="list-disc pl-4 text-gray-400 space-y-0.5">
                <li><strong className="text-white">### 📊 성적 및 취약점 분석</strong>: OMR 오답 문항 번호 기반 취약 단원 도출 및 퀴즈 대비 성취도 비교</li>
                <li><strong className="text-white">### 🏃 성실도 및 태도 분석</strong>: 출결 상태와 숙제 이행률 수치적 요약, 태도 및 학습 습관 평가</li>
                <li><strong className="text-white">### 🗣️ 학부모 추천 상담 멘트</strong>: 선생님이 구두로 즉시 발화하기에 적절하고 신뢰감 높은 구체적인 클리닉 멘트 제공</li>
              </ul>
            </div>
          </div>
        </div>
      )
    }
  ];

  const handleToggle = (index: number) => {
    setExpandedIndex(prev => (prev === index ? null : index));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Info size={24} className="text-purple-400" />
          <div>
            <h3 className="text-xl font-black text-white">시스템 가이드북 (Manual)</h3>
            <p className="text-sm text-gray-400">사이드바 메뉴별 기능과 활용 방법을 아코디언으로 안내합니다.</p>
          </div>
        </div>
      </div>

      {/* 🎬 [비디오 매뉴얼 가이드 카드] 클릭 시 영상 모달 팝업 실행 */}
      <div 
        onClick={() => setIsVideoModalOpen(true)}
        className="group relative p-5 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-500/30 hover:border-purple-400/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-2xl transition-all cursor-pointer overflow-hidden"
      >
        <div className="flex items-center gap-4 relative z-10 min-w-0">
          {/* 섬네일 미리보기 프리뷰 박스 */}
          <div className="relative w-24 h-16 sm:w-28 sm:h-18 rounded-lg bg-black/80 border border-purple-500/40 flex items-center justify-center shrink-0 overflow-hidden group-hover:scale-105 transition-transform shadow-lg">
            <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&q=80')" }} />
            <div className="relative z-10 w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg group-hover:bg-indigo-500 transition-colors">
              <Play size={18} className="ml-0.5 fill-current" />
            </div>
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500 text-white uppercase tracking-wider shadow-sm">
                영상 매뉴얼
              </span>
              <h4 className="font-black text-sm text-white flex items-center gap-1.5 truncate">
                🎬 [수능/기출] 27번~49번 문항별 타임스탬프 해설 플레이어
              </h4>
            </div>
            <p className="text-xs text-slate-300 font-bold truncate">
              버튼을 누르면 영상 팝업이 실행되며, **우측 문항 번호 클릭 시 해당 문제 위치로 시원하게 이동**합니다.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsVideoModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all shrink-0 shadow-lg shadow-indigo-600/30 flex items-center gap-2 group-hover:scale-105"
        >
          <Play size={14} className="fill-current" />
          <span>▶ 동영상 가이드 실행</span>
        </button>
      </div>

      {/* 비디오 모달 */}
      <VideoPlayerModal
        isOpen={isVideoModalOpen}
        videoUrl="http://192.168.0.13:8080/video/sample.mp4"
        title="[수능/모의고사 기출] 27번~49번 문항별 해설강의 (실험실 테스트)"
        timestampsText={DEFAULT_TIMESTAMPS_TEXT}
        onClose={() => setIsVideoModalOpen(false)}
      />

      <div className="space-y-3">
        {manuals.map((item, i) => {
          const isOpen = expandedIndex === i;
          return (
            <div 
              key={i}
              className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden transition-colors"
            >
              {/* Accordion Header */}
              <button
                onClick={() => handleToggle(i)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/[0.04] transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-white/5 rounded-lg border border-white/10">
                    {item.icon}
                  </div>
                  <h4 className="text-[14px] font-black text-white tracking-wide">{item.title}</h4>
                </div>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-gray-500"
                >
                  <ChevronDown size={16} />
                </motion.div>
              </button>

              {/* Accordion Body */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    <div className="px-5 pb-5 pt-1 text-[13px] leading-relaxed text-gray-400 border-t border-white/[0.05] break-keep">
                      {item.desc}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* 💡 단축키 가이드 섹션 */}
      <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
        <div className="flex items-center gap-3">
          <Keyboard size={22} className="text-blue-400" />
          <div>
            <h4 className="text-lg font-black text-white">시스템 단축키 가이드</h4>
            <p className="text-xs text-gray-400">마우스 동작 없이 빠르게 작업할 수 있는 효율적인 단축키 일람입니다.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
            <h5 className="text-[12px] font-black text-blue-400 uppercase tracking-wider">TodaySheet 일지 편집</h5>
            <ul className="space-y-2 text-[11px] text-gray-300">
              <li className="flex items-center justify-between"><span className="text-gray-400">아래 방향 일괄 채우기</span> <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">Ctrl + D</kbd> 또는 <kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">Alt + D</kbd></span></li>
              <li className="flex items-center justify-between"><span className="text-gray-400">단축어 보관함 세트 전환 (1~4번)</span> <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">Alt + Q / W / E / R</kbd></span></li>
              <li className="flex items-center justify-between"><span className="text-gray-400">하단 2행 상세 설정 바 토글</span> <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">Alt + U</kbd></span></li>
              <li className="flex items-center justify-between"><span className="text-gray-400">툴박스 접기/펼치기 토글</span> <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">Alt + T</kbd></span></li>
              <li className="flex items-center justify-between"><span className="text-gray-400">학생 학습/출결 히스토리 패널 토글</span> <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">Alt + H</kbd></span></li>
              <li className="flex items-center justify-between"><span className="text-gray-400">대형 텍스트 편집기 실행 (입력 중)</span> <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">Cmd + /</kbd> 또는 <kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">Alt + Enter</kbd></span></li>
              <li className="flex items-center justify-between"><span className="text-gray-400">엑셀식 즉시 덮어쓰기 입력</span> <span className="text-gray-500 italic">셀 선택 후 즉시 타이핑</span></li>
              <li className="flex items-center justify-between"><span className="text-gray-400">다중 셀 데이터 일괄 삭제</span> <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">Backspace</kbd> 또는 <kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">Delete</kbd></span></li>
              <li className="flex items-center justify-between"><span className="text-gray-400">셀 복사 / 붙여넣기</span> <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">Ctrl + C / V</kbd></span></li>
              <li className="flex items-center justify-between"><span className="text-gray-400">셀 이동 (이동 / 저장 이동)</span> <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">방향키</kbd> / <kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">Enter</kbd> / <kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">Tab</kbd></span></li>
            </ul>
          </div>
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-4">
            <div className="space-y-2">
              <h5 className="text-[12px] font-black text-emerald-400 uppercase tracking-wider">전역 단축키</h5>
              <ul className="space-y-2 text-[11px] text-gray-300">
                <li className="flex items-center justify-between"><span className="text-gray-400">LIVE 실시간 수업 현황판 토글</span> <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-emerald-300">Shift + Alt + L</kbd></span></li>
                <li className="flex items-center justify-between"><span className="text-gray-400">시간표 전체화면 모달 토글</span> <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-emerald-300">Shift + Alt + T</kbd></span></li>
              </ul>
            </div>
            <div className="space-y-2 pt-2 border-t border-white/5">
              <h5 className="text-[12px] font-black text-indigo-400 uppercase tracking-wider">숙제 입력 모달 내 단축키</h5>
              <ul className="space-y-2 text-[11px] text-gray-300">
                <li className="flex items-center justify-between"><span className="text-gray-400">시작 페이지 입력란 포커스 (1~9행)</span> <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">Alt + 1 ~ 9</kbd></span></li>
                <li className="flex items-center justify-between"><span className="text-gray-400">확인 및 즉시 저장</span> <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">Ctrl + Enter</kbd></span></li>
                <li className="flex items-center justify-between"><span className="text-gray-400">창 닫기 (취소)</span> <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/20 font-mono text-[9px] text-amber-300">Escape</kbd></span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
