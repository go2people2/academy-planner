import { motion } from 'framer-motion';
import { LayoutDashboard, Bell, Table, ClipboardCheck, Activity, UserCog, ArrowLeftRight, Settings, Info } from 'lucide-react';

export default function SystemManual() {
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
      desc: "가장 핵심적인 메뉴입니다! 선생님이 오늘 등원한 학생들의 '학원 공부', '집에서 할 숙제', '오늘 할 일 목록'을 부여합니다. 학생들이 제출(Submit)한 학습 기록을 일괄 승인하거나 반려하여 진행률을 확정 짓는 공간입니다. (할 일을 번호(1., 2.)나 기호(-, *)로 작성하면 학생 화면에 자동으로 체크박스로 나타납니다!)"
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
      desc: "신규 학생을 등록하거나 기존 학생의 정보(수강 반, 등원 요일, 부여된 교재 목록, 앱 비밀번호 초기화)를 수정하고 퇴원 처리를 진행할 수 있습니다."
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
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
        <Info size={24} className="text-purple-400" />
        <div>
          <h3 className="text-xl font-black text-white">시스템 가이드북 (Manual)</h3>
          <p className="text-sm text-gray-400">사이드바 메뉴별 기능과 활용 방법을 안내합니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {manuals.map((item, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white/[0.03] border border-white/10 rounded-xl p-5 hover:bg-white/[0.05] transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                {item.icon}
              </div>
              <h4 className="text-[15px] font-black text-white tracking-wide">{item.title}</h4>
            </div>
            <p className="text-[13px] leading-relaxed text-gray-400 break-keep">
              {item.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
