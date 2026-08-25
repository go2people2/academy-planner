import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Bell, Table, ClipboardCheck, Activity, 
  UserCog, ArrowLeftRight, Settings, Info, Keyboard, 
  Sparkles, ChevronDown, User, History as HistoryIcon, TrendingUp, ExternalLink, Lock, Unlock, Settings2
} from 'lucide-react';

export default function SystemManual() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

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
      title: "TodaySheet (오늘의 출결 및 기록표)",
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

          <div className="p-3 bg-zinc-900/60 rounded-[4px] border border-white/15 shadow-inner leading-relaxed mt-3 space-y-2.5">
            <p className="text-purple-400 font-black flex items-center gap-1.5 tracking-wide text-xs">
              <Settings2 size={13}/> 🛠️ TodaySheet 도구함 (Tools) 버튼별 완벽 동작 가이드
            </p>
            <p className="text-[11px] text-gray-300">
              TodaySheet 각 행의 도구함 열에는 <b>총 8종의 기능 버튼</b>과 <b>1개의 경계선(구분선)</b>이 제공됩니다.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-[11px]">
              {/* 1. 시간이동 */}
              <div className="p-2 bg-black/40 rounded border border-purple-500/30 space-y-1">
                <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                  <span className="w-5 h-5 rounded bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300"><ArrowLeftRight size={11} /></span>
                  1. 수업시간 / 교시 이동 (Timeshift)
                </div>
                <p className="text-gray-400 text-[10.5px]">
                  • <b>동작</b>: 클릭 시 시간 선택 팝업 오픈 ➔ 시작 교시 변경 또는 보강 시간 설정<br/>
                  • <b>활성</b>: 전 행 상시 활성화
                </p>
              </div>

              {/* 2. 스냅샷 수정 */}
              <div className="p-2 bg-black/40 rounded border border-blue-500/30 space-y-1">
                <div className="flex items-center gap-1.5 text-blue-300 font-bold">
                  <span className="w-5 h-5 rounded bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-300"><Settings2 size={11} /></span>
                  2. 수업 정보 및 스냅샷 수정 (Snapshot)
                </div>
                <p className="text-gray-400 text-[10.5px]">
                  • <b>동작</b>: 클릭 시 '당시 수업 정보 수정' 모달 오픈 ➔ 수업 구분(정규/특강/보강), 과목명, 예정 요일/시간, 진행 시간, 순수보강 여부 수정<br/>
                  • <b>활성 조건</b>: <b>DB에 저장된 실제 일지 로그가 있는 행만 활성화</b> (임시 temp 행은 비활성 및 안내 툴팁 표시)<br/>
                  • <b>특징</b>: 학생의 현재 시간표는 건드리지 않고 <b>해당 날짜 일지의 스냅샷만 안전하게 불변 박제/보정</b>
                </p>
              </div>

              {/* 3. 프로필 */}
              <div className="p-2 bg-black/40 rounded border border-emerald-500/30 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                  <span className="w-5 h-5 rounded bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300"><User size={11} /></span>
                  3. 학생 프로필 서랍 열기 (Profile)
                </div>
                <p className="text-gray-400 text-[10.5px]">
                  • <b>동작</b>: 우측에서 학생 상세 정보 서랍(Drawer) 오픈<br/>
                  • <b>활성</b>: 전 행 상시 활성화
                </p>
              </div>

              {/* 4. 이전 기록 */}
              <div className="p-2 bg-black/40 rounded border border-white/20 space-y-1">
                <div className="flex items-center gap-1.5 text-gray-200 font-bold">
                  <span className="w-5 h-5 rounded bg-white/10 border border-white/20 flex items-center justify-center text-gray-300"><HistoryIcon size={11} /></span>
                  4. 이전 기록 보기 (History)
                </div>
                <p className="text-gray-400 text-[10.5px]">
                  • <b>동작</b>: 클릭 시 해당 학생의 최근 과거 일지 행을 테이블 아래로 즉시 펼침/접기<br/>
                  • <b>활성</b>: 전 행 상시 활성화
                </p>
              </div>

              {/* 5. 진도표 */}
              <div className="p-2 bg-black/40 rounded border border-indigo-500/30 space-y-1">
                <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
                  <span className="w-5 h-5 rounded bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300"><TrendingUp size={11} /></span>
                  5. 진도표 바로가기 (Progress)
                </div>
                <p className="text-gray-400 text-[10.5px]">
                  • <b>동작</b>: 해당 학생의 전체 교재 단원별 진도 현황 탭으로 전환<br/>
                  • <b>활성</b>: 전 행 상시 활성화
                </p>
              </div>

              {/* 6. 태그 */}
              <div className="p-2 bg-black/40 rounded border border-amber-500/30 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <span className="w-5 h-5 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 text-[10px] font-black">가</span>
                  6. 태그 순환 변경 (Tag)
                </div>
                <p className="text-gray-400 text-[10.5px]">
                  • <b>동작</b>: 클릭할 때마다 <b>[가(초록)] ➔ [나(파랑)] ➔ [다(노랑)] ➔ [라(빨강)] ➔ [해제(+)]</b> 순환 변경<br/>
                  • <b>활성</b>: 전 행 상시 활성화
                </p>
              </div>

              {/* 7. 학생 페이지 */}
              <div className="p-2 bg-black/40 rounded border border-sky-500/30 space-y-1">
                <div className="flex items-center gap-1.5 text-sky-300 font-bold">
                  <span className="w-5 h-5 rounded bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-300"><ExternalLink size={11} /></span>
                  7. 학생 페이지 보기 (Portal)
                </div>
                <p className="text-gray-400 text-[10.5px]">
                  • <b>동작</b>: 학생 전용 모바일 웹 포털(`/[slug]/student?id=...`)을 새 브라우저 탭으로 오픈<br/>
                  • <b>활성</b>: 전 행 상시 활성화
                </p>
              </div>

              {/* 8. 학생 제출 리셋 */}
              <div className="p-2 bg-black/40 rounded border border-rose-500/30 space-y-1">
                <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                  <span className="w-5 h-5 rounded bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300"><Lock size={11} /></span>
                  8. 학생 제출 리셋 (Reset Lock)
                </div>
                <p className="text-gray-400 text-[10.5px]">
                  • <b>동작</b>: 학생이 모바일에서 [제출]하여 승인 대기(Pending/Approved)된 상태를 <b>'none'으로 리셋</b> ➔ 학생이 다시 일지 내용을 수정하고 재제출할 수 있도록 잠금 해제<br/>
                  • <b>활성 조건</b>: 제출/승인된 학생만 활성화 (미제출 상태는 잠금 아이콘 비활성)
                </p>
              </div>
            </div>

            {/* 9. 기록 리셋 및 보강 삭제 (위험 동작) */}
            <div className="p-2.5 bg-rose-950/20 rounded border border-rose-500/30 space-y-1 mt-2">
              <div className="flex items-center gap-1.5 text-rose-400 font-black">
                <span className="w-5 h-5 rounded bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 text-[10px]">R</span>
                ⚠️ 9. 기록 리셋 / 보강 제외 (Reset & Remove - 위험 작업)
              </div>
              <p className="text-gray-300 text-[10.5px] leading-relaxed">
                • <b>정규 시간표 수업 행</b>: 확인창 승인 시 <b>수업 행은 그대로 유지</b>되며, 당일 작성된 출결·진도·숙제·테스트 등 <b>일지 내용만 초기 상태로 안전하게 리셋</b>됩니다.<br/>
                • <b>시간표 외 순수 보강 행</b>: 확인창 승인 시 오늘 명단에서 <b>해당 보강 행 자체가 제외(삭제)</b>됩니다.
              </p>
            </div>

            {/* 도구함 헤더 버튼 및 순서 편집 안내 */}
            <div className="p-2.5 bg-white/5 rounded border border-white/10 space-y-1 text-[10.5px] text-gray-300 mt-2">
              <p className="font-bold text-amber-400">📌 [도구함 헤더 버튼 및 순서/상시노출 커스텀 안내]</p>
              <ul className="list-disc pl-4 space-y-1 text-gray-400">
                <li><b>헤더 [ &gt; ] 접기/펼치기 버튼</b>: 클릭 시 상시 노출 모드(기본 약 4~5개)와 전체 펼침 모드(총 8개 도구, 폭 260px)로 전환됩니다.</li>
                <li><b>헤더 [ ⚙️ ] 도구 편집 버튼</b>: 도구 전체를 펼친 상태에서 [ ⚙️ ]를 누르면 <b>'도구 편집 모드'</b>가 켜집니다.</li>
                <li><b>드래그로 도구 순서 변경</b>: 편집 모드에서 원하는 아이콘을 마우스로 끌어다 놓으면 순서가 즉시 변경되며, 브라우저 로컬 스토리지(`ams_tools_order`)에 영구 저장됩니다.</li>
                <li><b>노란색 점선 세로 바(Separator)의 실제 용도</b>: 세로 바는 '컬럼 가로 크기 리사이즈용 바'가 아니라 <b>"평소 접혀 있을 때 상시 노출될 도구의 경계선"</b>입니다. 편집 모드에서 세로 바를 원하는 위치로 드래그하면, 접었을 때 세로 바 앞쪽에 있는 도구들만 화면에 상시 노출됩니다.</li>
              </ul>
            </div>
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
