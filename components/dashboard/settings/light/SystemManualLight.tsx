import { motion } from 'framer-motion';
import { LayoutDashboard, Bell, Table, ClipboardCheck, Activity, UserCog, ArrowLeftRight, Settings, Info, Keyboard } from 'lucide-react';

export default function SystemManualLight() {
  const manuals = [
    {
      icon: <LayoutDashboard size={20} className="text-blue-600" />,
      title: "Overview (대시보드 요약)",
      desc: "학원의 전반적인 등원 현황, 출석 비율, 오늘 예정된 학생 수 등 큰 그림을 한눈에 파악하는 공간입니다. 빠른 검색과 그룹 필터링을 통해 특정 학생이나 반을 훑어보기에 최적화되어 있습니다."
    },
    {
      icon: <Bell size={20} className="text-amber-600" />,
      title: "Notifications (알림 및 건의사항)",
      desc: "선생님이 학생들(학생 페이지)에게 전달하는 전체 공지나 메시지를 작성할 수 있습니다. 또한 학생들이 보내온 건의사항(숙제 조절, 질문 등)을 실시간으로 확인하고 답변을 기록합니다."
    },
    {
      icon: <Table size={20} className="text-emerald-600" />,
      title: "Daily Sheet (오늘의 출결 및 기록표)",
      desc: (
        <div className="space-y-3">
          <p className="text-gray-600">가장 핵심적인 메뉴입니다! 선생님이 오늘 등원한 학생들의 '학원 공부', '집에서 할 숙제', '오늘 할 일 목록'을 부여합니다. 학생들이 제출(Submit)한 학습 기록을 일괄 승인하거나 반려하여 진행률을 확정 짓는 공간입니다. (할 일을 번호나 기호로 작성하면 체크박스로 자동 변환됩니다!)</p>
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-250 shadow-inner leading-relaxed text-[#37352f]">
            <p className="text-amber-800 font-bold mb-2 flex items-center gap-1.5 tracking-wide text-xs"><Table size={13}/> 오늘 테스트 초간단 입력 문법</p>
            <ul className="space-y-2 text-[11px] text-gray-700">
              <li><span className="text-gray-800 font-bold bg-white border border-gray-250 px-1.5 py-0.5 rounded mr-1">- 기출 : 85</span> ➜ 100점 만점으로 자동 인식 (85점 획득)</li>
              <li><span className="text-gray-800 font-bold bg-white border border-gray-250 px-1.5 py-0.5 rounded mr-1">- 기출 : </span> ➜ 점수를 비워두면 <b>'채점 전'</b> 대기 상태 (회색 뱃지)</li>
              <li><span className="text-gray-800 font-bold bg-white border border-gray-250 px-1.5 py-0.5 rounded mr-1">- 퀴즈 : 7/10</span> ➜ 10개 만점으로 자동 인식 (7개 획득)</li>
              <li><span className="text-gray-800 font-bold bg-white border border-gray-250 px-1.5 py-0.5 rounded mr-1">- 퀴즈 : 7/10/2</span> ➜ 마지막 숫자는 커트라인(오답 허용 개수)</li>
              <li><span className="text-gray-800 font-bold bg-white border border-gray-250 px-1.5 py-0.5 rounded mr-1">- 퀴즈 : /10/2</span> ➜ 점수를 비워둔 채 <b>만점</b>과 <b>컷라인</b>만 미리 세팅 (채점 전 대기)</li>
              <li className="text-gray-400 font-bold italic mt-2 border-t border-amber-200 pt-1.5">
                * 쉼표(,) 뒤에 쓰거나 줄을 바꿔서 쓰는 글은 학생 리포트에는 노출되지 않는 '선생님 전용 비밀 메모'가 됩니다.
              </li>
            </ul>
          </div>
        </div>
      )
    },
    {
      icon: <ClipboardCheck size={20} className="text-purple-600" />,
      title: "업무 및 보강 관리",
      desc: "결석생들의 보강 일정을 캘린더에 스케줄링하고, 선생님 개개인의 업무(교재 준비, 학부모 상담 등)를 관리하는 개인별 To-Do 보드입니다."
    },
    {
      icon: <Activity size={20} className="text-rose-600" />,
      title: "Progress (진도 및 성취도 현황)",
      desc: "학생들이 현재 풀고 있는 교재의 단원별 진도율과 시험 점수, 할 일 달성률 등을 시각화된 그래프로 확인하는 곳입니다. 학생별 취약 단원을 한눈에 파악할 수 있습니다."
    },
    {
      icon: <UserCog size={20} className="text-indigo-650" />,
      title: "학생 정보 관리 (추가/수정)",
      desc: "신규 학생을 등록하거나 기존 학생의 정보(수강 반, 등원 요일, 부여된 교재 목록, 앱 비밀번호 초기화)를 수정하고 퇴원 처리를 진행할 수 있습니다."
    },
    {
      icon: <ArrowLeftRight size={20} className="text-teal-600" />,
      title: "이번 달 변동 사항",
      desc: "이번 달 신규 등록생, 휴원생, 퇴원생의 통계를 기록하고 변동 흐름을 체크하는 운영 관리 지표입니다."
    },
    {
      icon: <Settings size={20} className="text-gray-500" />,
      title: "Settings (시스템 설정)",
      desc: "학원의 기본 운영 방침을 세팅합니다. (휴일 캘린더 등록, 학원 홈페이지 연동, 사용할 교재 마스터 목록 관리, 학교별 시험 기간 설정, 동료 선생님 계정 발급 등)"
    }
  ];

  return (
    <div className="space-y-6 text-[#37352f]">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#e3e2e0]">
        <Info size={24} className="text-purple-600" />
        <div>
          <h3 className="text-xl font-bold text-[#37352f]">시스템 가이드북 (Manual)</h3>
          <p className="text-sm text-gray-500">사이드바 메뉴별 기능과 활용 방법을 안내합니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {manuals.map((item, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white border border-[#e3e2e0] rounded-lg p-5 hover:border-blue-400 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-gray-50 rounded-lg border border-[#edece9]">
                {item.icon}
              </div>
              <h4 className="text-[15px] font-bold text-[#37352f] tracking-wide">{item.title}</h4>
            </div>
            <div className="text-[13px] leading-relaxed text-gray-650 font-semibold break-keep">
              {item.desc}
            </div>
          </motion.div>
        ))}
      </div>

      {/* 단축키 가이드 섹션 */}
      <div className="mt-8 pt-6 border-t border-[#e3e2e0] space-y-4">
        <div className="flex items-center gap-3">
          <Keyboard size={22} className="text-blue-600" />
          <div>
            <h4 className="text-lg font-bold text-[#37352f]">시스템 단축키 가이드</h4>
            <p className="text-xs text-gray-500 font-bold">마우스 동작 없이 빠르게 작업할 수 있는 효율적인 단축키 일람입니다.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white border border-[#edece9] shadow-sm rounded-lg space-y-2">
            <h5 className="text-[12px] font-bold text-blue-700 uppercase tracking-wider">TodaySheet 일지 편집</h5>
            <ul className="space-y-2 text-[11px] text-gray-700">
              <li className="flex items-center justify-between"><span className="text-gray-500 font-semibold">아래 방향 일괄 채우기</span> <span><kbd className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-mono text-[9px] text-amber-800 font-bold">Ctrl + D</kbd> 또는 <kbd className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-mono text-[9px] text-amber-800 font-bold">Alt + D</kbd></span></li>
              <li className="flex items-center justify-between"><span className="text-gray-500 font-semibold">단축어 보관함 세트 전환 (1~4번)</span> <span><kbd className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-mono text-[9px] text-amber-800 font-bold">Alt + Q / W / E / R</kbd></span></li>
              <li className="flex items-center justify-between"><span className="text-gray-500 font-semibold">하단 2행 상세 설정 바 토글</span> <span><kbd className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-mono text-[9px] text-amber-800 font-bold">Alt + T</kbd></span></li>
              <li className="flex items-center justify-between"><span className="text-gray-500 font-semibold">학생 학습/출결 히스토리 패널 토글</span> <span><kbd className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-mono text-[9px] text-amber-800 font-bold">Alt + H</kbd></span></li>
              <li className="flex items-center justify-between"><span className="text-gray-500 font-semibold">대형 텍스트 편집기 실행 (입력 중)</span> <span><kbd className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-mono text-[9px] text-amber-800 font-bold">Cmd + /</kbd> 또는 <kbd className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-mono text-[9px] text-amber-800 font-bold">Alt + Enter</kbd></span></li>
              <li className="flex items-center justify-between"><span className="text-gray-500 font-semibold">엑셀식 즉시 덮어쓰기 입력</span> <span className="text-gray-400 italic font-bold">셀 선택 후 즉시 타이핑</span></li>
              <li className="flex items-center justify-between"><span className="text-gray-500 font-semibold">다중 셀 데이터 일괄 삭제</span> <span><kbd className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-mono text-[9px] text-amber-800 font-bold">Backspace</kbd> 또는 <kbd className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-mono text-[9px] text-amber-800 font-bold">Delete</kbd></span></li>
              <li className="flex items-center justify-between"><span className="text-gray-500 font-semibold">셀 복사 / 붙여넣기</span> <span><kbd className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-mono text-[9px] text-amber-800 font-bold">Ctrl + C / V</kbd></span></li>
              <li className="flex items-center justify-between"><span className="text-gray-500 font-semibold">셀 이동 (이동 / 저장 이동)</span> <span><kbd className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-mono text-[9px] text-amber-800 font-bold">방향키</kbd> / <kbd className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-mono text-[9px] text-amber-800 font-bold">Enter</kbd> / <kbd className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-mono text-[9px] text-amber-800 font-bold">Tab</kbd></span></li>
            </ul>
          </div>
          <div className="p-4 bg-white border border-[#edece9] shadow-sm rounded-lg space-y-4">
            <div className="space-y-2">
              <h5 className="text-[12px] font-bold text-emerald-700 uppercase tracking-wider">전역 단축키</h5>
              <ul className="space-y-2 text-[11px] text-gray-700">
                <li className="flex items-center justify-between"><span className="text-gray-500 font-semibold">LIVE 실시간 수업 현황판 토글</span> <span><kbd className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-250 font-mono text-[9px] text-emerald-800 font-bold">Shift + Alt + L</kbd></span></li>
              </ul>
            </div>
            <div className="space-y-2 pt-2 border-t border-[#edece9]">
              <h5 className="text-[12px] font-bold text-indigo-700 uppercase tracking-wider">숙제 입력 모달 내 단축키</h5>
              <ul className="space-y-2 text-[11px] text-gray-700">
                <li className="flex items-center justify-between"><span className="text-gray-500 font-semibold">시작 페이지 입력란 포커스 (1~9행)</span> <span><kbd className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-mono text-[9px] text-amber-800 font-bold">Alt + 1 ~ 9</kbd></span></li>
                <li className="flex items-center justify-between"><span className="text-gray-500 font-semibold">확인 및 즉시 저장</span> <span><kbd className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-mono text-[9px] text-amber-800 font-bold">Ctrl + Enter</kbd></span></li>
                <li className="flex items-center justify-between"><span className="text-gray-500 font-semibold">창 닫기 (취소)</span> <span><kbd className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-250 font-mono text-[9px] text-amber-800 font-bold">Escape</kbd></span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
