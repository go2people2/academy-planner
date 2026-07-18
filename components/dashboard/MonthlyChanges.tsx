'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  UserPlus, UserMinus, ArrowLeftRight, Calendar, Info, AlertCircle, Users, CheckSquare, Frown, ArrowRight
} from 'lucide-react';
import { Student } from '@/types/dashboard';

// 💡 최초 등록일과 퇴원일 사이의 실제 재원 기간을 계산하는 헬퍼 함수
const getMembershipPeriod = (createdVal: any, dischargedVal: any) => {
  if (!createdVal) return '';
  const start = new Date(createdVal);
  const end = dischargedVal ? new Date(dischargedVal) : new Date();
  
  // 두 날짜 사이의 밀리초 차이를 일단 일(Day) 수로 변환
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return '1일 미만';
  if (diffDays < 30) {
    return `${diffDays}일`;
  }
  
  const diffMonths = Math.floor(diffDays / 30);
  const remainingDays = diffDays % 30;
  if (remainingDays >= 15) {
    return `${diffMonths + 0.5}개월`;
  }
  return `${diffMonths}개월`;
};

interface MonthlyChangesProps {
  students: Student[];
  onSelectStudent?: (id: string) => void;
}

type TabType = 'new' | 'makeup' | 'absence' | 'dischargedMonth' | 'dischargedAll';

export default function MonthlyChanges({ students, onSelectStudent }: MonthlyChangesProps) {
  const [activeTab, setActiveTab] = useState<TabType>('new');
  
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // 1. 현재 재원생 수 (퇴원생 제외)
  const activeStudentsCount = useMemo(() => {
    return students.filter(s => !s.is_deleted).length;
  }, [students]);

  // 2. 이번 달 신규 등록생 목록
  const newStudents = useMemo(() => {
    return students.filter(s => {
      if (!s.created_at) return false;
      const createDate = new Date(s.created_at);
      return createDate.getMonth() === currentMonth && createDate.getFullYear() === currentYear;
    }).map(s => {
      const createDate = new Date(s.created_at!);
      return {
        id: s.id,
        name: s.name,
        grade: s.grade || '미지정',
        class: s.class || '일반반',
        date: createDate,
        teacher: s.teacher_name || '미지정'
      };
    }).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [students, currentMonth, currentYear]);

  // 3. 이번 달 수업 보강 내역
  const makeups = useMemo(() => {
    const list: any[] = [];
    students.forEach(s => {
      (s.allLogs || []).forEach(log => {
        const logDate = new Date(log.date);
        if (logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear) {
          if (log.attendance_status === '보강') {
            list.push({
              id: log.id,
              studentId: s.id,
              name: s.name,
              grade: s.grade || '미지정',
              date: logDate,
              dateStr: log.date,
              notes: log.attendance_reason || log.special_notes || '보강 수업 진행',
              teacher: s.teacher_name || '미지정'
            });
          }
        }
      });
    });
    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [students, currentMonth, currentYear]);

  // 4. 이번 달 결석 / 지각 내역
  const absences = useMemo(() => {
    const list: any[] = [];
    students.forEach(s => {
      (s.allLogs || []).forEach(log => {
        const logDate = new Date(log.date);
        if (logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear) {
          if (log.attendance_status === '결석' || log.attendance_status === '지각') {
            list.push({
              id: log.id,
              studentId: s.id,
              name: s.name,
              grade: s.grade || '미지정',
              date: logDate,
              dateStr: log.date,
              type: log.attendance_status,
              notes: log.attendance_reason || log.special_notes || '사유 미기재',
              teacher: s.teacher_name || '미지정'
            });
          }
        }
      });
    });
    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [students, currentMonth, currentYear]);

  // 5. 이번 달 퇴원생 내역
  const dischargedMonth = useMemo(() => {
    return students.filter(s => {
      if (!s.is_deleted) return false;
      // status_changed_at 우선, 없으면 updated_at 사용
      const changeTime = s.status_changed_at || (s as any).updated_at;
      if (!changeTime) return false;
      // UTC ISO 문자열 파싱 후 로컬 기준 연·월 비교
      const d = new Date(changeTime);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).map(s => {
      const changeTime = s.status_changed_at || (s as any).updated_at;
      const deleteDate = new Date(changeTime);
      const lastLog = (s.allLogs || []).find((l: any) => l.attendance_status === '수업제외' || (l.special_notes && l.special_notes.toLowerCase().includes('퇴원')));
      return {
        id: s.id,
        name: s.name,
        grade: s.grade || '미지정',
        date: deleteDate,
        period: getMembershipPeriod(s.created_at, changeTime), // 💡 재원 기간 계산
        notes: lastLog?.attendance_reason || lastLog?.special_notes || '퇴원 처리됨 (사유 미기재)',
        teacher: s.teacher_name || '미지정'
      };
    }).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [students, currentMonth, currentYear]);

  // 6. 누적 전체 퇴원생 명단 (아카이브)
  const dischargedAll = useMemo(() => {
    return students.filter(s => !!s.is_deleted).map(s => {
      // status_changed_at -> updated_at -> created_at 순으로 최후의 날짜 폴백 확보!
      const changeTime = s.status_changed_at || (s as any).updated_at || s.created_at;
      const deleteDate = changeTime ? new Date(changeTime) : null;
      const lastLog = (s.allLogs || []).find((l: any) => l.attendance_status === '수업제외' || (l.special_notes && l.special_notes.toLowerCase().includes('퇴원')));
      return {
        id: s.id,
        name: s.name,
        grade: s.grade || '미지정',
        date: deleteDate,
        period: getMembershipPeriod(s.created_at, changeTime), // 💡 재원 기간 계산
        notes: lastLog?.attendance_reason || lastLog?.special_notes || '퇴원 처리됨 (사유 미기재)',
        teacher: s.teacher_name || '미지정'
      };
    }).sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.getTime() - a.date.getTime();
    });
  }, [students]);

  return (
    <div className="p-8 space-y-8 bg-[#080808] min-h-full max-w-6xl mx-auto">
      {/* 헤더 섹션 */}
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <ArrowLeftRight size={24} className="text-blue-500" />
            Monthly Changes & Archive
          </h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.4em]">
            {currentYear}년 {currentMonth + 1}월 학원 학생 동향 대시보드
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-[4px] border border-white/10 shadow-xl">
          <Calendar size={14} className="text-blue-500" />
          <span className="text-[11px] font-black text-gray-200 uppercase tracking-widest">{currentMonth + 1}월 현황</span>
        </div>
      </div>

      {/* 요약 통계 카드 그리드 (재원생 수 추가) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatsCard 
          label="현재 재원생 수" 
          count={activeStudentsCount} 
          color="text-white" 
          borderColor="border-white/10"
          bg="bg-white/[0.02]"
          icon={<Users size={16} className="text-blue-400" />}
          unit="명"
        />
        <StatsCard 
          label="이달의 신입생" 
          count={newStudents.length} 
          color="text-emerald-500" 
          borderColor="border-emerald-500/20"
          bg="bg-emerald-500/5"
          icon={<UserPlus size={16} />}
          unit="명"
        />
        <StatsCard 
          label="이달의 보강수업" 
          count={makeups.length} 
          color="text-blue-500" 
          borderColor="border-blue-500/20"
          bg="bg-blue-500/5"
          icon={<CheckSquare size={16} />}
          unit="회"
        />
        <StatsCard 
          label="이달의 결석/지각" 
          count={absences.length} 
          color="text-amber-500" 
          borderColor="border-amber-500/20"
          bg="bg-amber-500/5"
          icon={<Frown size={16} />}
          unit="건"
        />
        <StatsCard 
          label="이달의 퇴원생" 
          count={dischargedMonth.length} 
          color="text-red-500" 
          borderColor="border-red-500/20"
          bg="bg-red-500/5"
          icon={<UserMinus size={16} />}
          unit="명"
        />
      </div>

      {/* 5개 탭 내비게이션 바 */}
      <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 w-full overflow-x-auto custom-scrollbar-h">
        {[
          { id: 'new', label: '신규 등록', count: newStudents.length },
          { id: 'makeup', label: '수업 보강', count: makeups.length },
          { id: 'absence', label: '결석 / 지각', count: absences.length },
          { id: 'dischargedMonth', label: '이달의 퇴원', count: dischargedMonth.length },
          { id: 'dischargedAll', label: '전체 퇴원생', count: dischargedAll.length }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2 px-3 rounded-md text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black tabular-nums ${
              activeTab === tab.id ? 'bg-white text-blue-600' : 'bg-white/5 text-gray-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 영역 */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-lg overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/10">
              <th className="py-4 px-6 text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] w-32 text-center">날짜 / 기간</th>
              <th className="py-4 px-4 text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] w-28 text-center">구분</th>
              <th className="py-4 px-4 text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] w-40">학생명</th>
              <th className="py-4 px-4 text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">사유 및 내용</th>
              <th className="py-4 px-6 text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] w-36 text-right">담당 선생님</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {activeTab === 'new' && newStudents.map((item) => (
              <RowTemplate 
                key={item.id} 
                date={item.date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })} 
                badge={<span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><UserPlus size={10} /> 신규</span>}
                name={item.name}
                description={`${item.grade} • ${item.class} 신규 입학`}
                teacher={item.teacher}
                onClick={() => onSelectStudent?.(item.id)}
              />
            ))}
            
            {activeTab === 'makeup' && makeups.map((item) => (
              <RowTemplate 
                key={item.id} 
                date={item.dateStr.slice(5).replace('-', '/')} 
                badge={<span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20"><CheckSquare size={10} /> 보강</span>}
                name={item.name}
                description={item.notes}
                teacher={item.teacher}
                onClick={() => onSelectStudent?.(item.studentId)}
              />
            ))}

            {activeTab === 'absence' && absences.map((item) => (
              <RowTemplate 
                key={item.id} 
                date={item.dateStr.slice(5).replace('-', '/')} 
                badge={
                  <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded border ${
                    item.type === '결석' 
                      ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  }`}>
                    <Frown size={10} /> {item.type}
                  </span>
                }
                name={item.name}
                description={item.notes}
                teacher={item.teacher}
                onClick={() => onSelectStudent?.(item.studentId)}
              />
            ))}

            {activeTab === 'dischargedMonth' && dischargedMonth.map((item) => (
              <RowTemplate 
                key={item.id} 
                date={
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span className="font-bold text-gray-200">{item.date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}</span>
                    {item.period && <span className="text-[9px] font-black text-red-400 whitespace-nowrap bg-red-950/30 px-1.5 py-0.5 rounded-[3px] border border-red-900/40">({item.period})</span>}
                  </div>
                }
                badge={<span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20"><UserMinus size={10} /> 퇴원</span>}
                name={item.name}
                description={item.notes}
                teacher={item.teacher}
                onClick={() => onSelectStudent?.(item.id)}
              />
            ))}

            {activeTab === 'dischargedAll' && dischargedAll.map((item) => (
              <RowTemplate 
                key={item.id} 
                date={
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span className="font-bold text-gray-200">{item.date ? item.date.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '미기재'}</span>
                    {item.period && <span className="text-[9px] font-black text-red-400 whitespace-nowrap bg-red-950/30 px-1.5 py-0.5 rounded-[3px] border border-red-900/40">({item.period})</span>}
                  </div>
                }
                badge={<span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-gray-500/20"><UserMinus size={10} /> 아카이브</span>}
                name={item.name}
                description={item.notes}
                teacher={item.teacher}
                onClick={() => onSelectStudent?.(item.id)}
              />
            ))}

            {/* 데이터가 비어 있을 경우 */}
            {activeTab === 'new' && newStudents.length === 0 && <EmptyRow message="이번 달에 새로 등록한 신입생이 없습니다." />}
            {activeTab === 'makeup' && makeups.length === 0 && <EmptyRow message="이번 달에 기록된 보강 수업이 없습니다." />}
            {activeTab === 'absence' && absences.length === 0 && <EmptyRow message="이번 달에 기록된 결석이나 지각 내역이 없습니다." />}
            {activeTab === 'dischargedMonth' && dischargedMonth.length === 0 && <EmptyRow message="이번 달에 퇴원한 학생이 없습니다." />}
            {activeTab === 'dischargedAll' && dischargedAll.length === 0 && <EmptyRow message="누적된 전체 퇴원생 정보가 없습니다." />}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowTemplate({ date, badge, name, description, teacher, onClick }: any) {
  return (
    <motion.tr 
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      className="hover:bg-white/[0.02] transition-colors group align-middle cursor-pointer"
      onClick={onClick}
    >
      <td className="py-4 px-6 text-[11px] font-black text-gray-500 tabular-nums text-center">
        {date}
      </td>
      <td className="py-4 px-4 text-center">
        {badge}
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-1.5">
          <h4 className="text-[13px] font-black text-white group-hover:text-blue-400 transition-colors tracking-tight">
            {name}
          </h4>
          <ArrowRight size={10} className="text-gray-700 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </div>
      </td>
      <td className="py-4 px-4">
        <p className="text-[12px] font-bold text-gray-400 leading-relaxed max-w-xl truncate" title={description}>
          {description}
        </p>
      </td>
      <td className="py-4 px-6 text-[11px] font-black text-gray-500 text-right">
        {teacher} 선생님
      </td>
    </motion.tr>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={5} className="py-24 text-center text-gray-600 font-bold text-[11px] uppercase tracking-widest">
        <AlertCircle size={24} className="mx-auto mb-3 opacity-20" />
        {message}
      </td>
    </tr>
  );
}

function StatsCard({ label, count, color, borderColor, bg, icon, unit }: any) {
  return (
    <div className={`${bg} border ${borderColor} rounded-lg p-5 space-y-2.5 shadow-2xl relative overflow-hidden group hover:scale-[1.02] transition-all`}>
      <div className="flex justify-between items-start">
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{label}</p>
        <div className={`opacity-40 group-hover:opacity-100 transition-opacity`}>
          {icon}
        </div>
      </div>
      <div className={`text-3xl font-black tabular-nums ${color} flex items-baseline gap-1`}>
        {count}
        <span className="text-[10px] font-bold text-gray-500 tracking-normal ml-0.5">{unit}</span>
      </div>
      <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full ${bg} blur-2xl group-hover:scale-150 transition-transform duration-700`} />
    </div>
  );
}
