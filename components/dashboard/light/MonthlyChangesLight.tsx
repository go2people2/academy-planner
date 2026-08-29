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
  
  // 조회 대상 연월 상태 (기본값: 현재 연월)
  const [targetDate, setTargetDate] = useState<Date>(() => new Date());

  const currentMonth = targetDate.getMonth();
  const currentYear = targetDate.getFullYear();

  // 이전 달 / 다음 달 이동
  const handlePrevMonth = () => {
    setTargetDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setTargetDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // 1. 현재 재원생 수 (퇴원생 제외)
  const activeStudentsCount = useMemo(() => {
    return students.filter(s => !s.is_deleted).length;
  }, [students]);

  // 2. 선택된 달의 신규 등록생 목록
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

  // 3. 선택된 달의 수업 보강 내역
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

  // 4. 선택된 달의 결석 / 지각 내역
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

  // 5. 퇴원일 추출 헬퍼 함수 (관리 메모의 [퇴원일: YYYY-MM-DD] 태그 최우선)
  const getDischargeDate = (s: any): Date => {
    const notes = s.management_notes || '';
    const match = notes.match(/\[퇴원일:\s*(\d{4}-\d{2}-\d{2})\]/);
    if (match && match[1]) {
      const d = new Date(match[1]);
      if (!isNaN(d.getTime())) return d;
    }
    const rawTime = s.status_changed_at || (s as any).updated_at;
    if (rawTime) {
      const d = new Date(rawTime);
      if (!isNaN(d.getTime())) return d;
    }
    // 💡 [핵심 보정] 등록일(created_at)만 있고 퇴원시각이 없던 원생은 오늘/현재 시점으로 보정하여 누락 차단
    return new Date();
  };

  // 5. 선택된 달의 퇴원생 내역
  const dischargedMonth = useMemo(() => {
    return students.filter(s => {
      if (!s.is_deleted) return false;
      const d = getDischargeDate(s);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).map(s => {
      const deleteDate = getDischargeDate(s);
      const lastLog = (s.allLogs || []).find((l: any) => l.attendance_status === '수업제외' || (l.special_notes && l.special_notes.toLowerCase().includes('퇴원')));
      return {
        id: s.id,
        name: s.name,
        grade: s.grade || '미지정',
        date: deleteDate,
        period: getMembershipPeriod(s.created_at, deleteDate.toISOString()),
        notes: s.management_notes || lastLog?.attendance_reason || lastLog?.special_notes || '퇴원 처리됨 (사유 미기재)',
        teacher: s.teacher_name || '미지정'
      };
    }).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [students, currentMonth, currentYear]);

  // 6. 누적 전체 퇴원생 명단 (아카이브)
  const dischargedAll = useMemo(() => {
    return students.filter(s => !!s.is_deleted).map(s => {
      const deleteDate = getDischargeDate(s);
      const lastLog = (s.allLogs || []).find((l: any) => l.attendance_status === '수업제외' || (l.special_notes && l.special_notes.toLowerCase().includes('퇴원')));
      return {
        id: s.id,
        name: s.name,
        grade: s.grade || '미지정',
        date: deleteDate,
        period: getMembershipPeriod(s.created_at, deleteDate.toISOString()),
        notes: s.management_notes || lastLog?.attendance_reason || lastLog?.special_notes || '퇴원 처리됨 (사유 미기재)',
        teacher: s.teacher_name || '미지정'
      };
    }).sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.getTime() - a.date.getTime();
    });
  }, [students]);

  return (
    <div className="p-8 space-y-8 bg-[#fcfcfc] min-h-full max-w-6xl mx-auto">
      {/* 헤더 섹션 */}
      <div className="flex items-center justify-between border-b border-[#edece9] pb-6">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-[#37352f] uppercase tracking-tight flex items-center gap-3">
            <ArrowLeftRight size={24} className="text-blue-600" />
            Monthly Changes & Archive
          </h2>
          <p className="text-[10px] text-[#37352f]/50 font-bold uppercase tracking-[0.4em]">
            {currentYear}년 {currentMonth + 1}월 학원 학생 동향 대시보드
          </p>
        </div>
        {/* 연/월 선택 컨트롤러 */}
        <div className="flex items-center gap-2 bg-[#fbfbfa] p-1 rounded-[4px] border border-[#edece9] shadow-sm">
          <button
            onClick={handlePrevMonth}
            className="px-2 py-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded transition-colors text-xs font-black"
            title="이전 달 조회"
          >
            ◀
          </button>
          
          <div className="flex items-center gap-1.5 px-2">
            <Calendar size={14} className="text-blue-600" />
            <select
              value={`${currentYear}-${currentMonth}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number);
                setTargetDate(new Date(y, m, 1));
              }}
              className="bg-transparent text-[#37352f] text-xs font-black outline-none cursor-pointer focus:bg-white py-0.5"
            >
              {Array.from({ length: 12 }).map((_, i) => {
                const d = new Date();
                d.setDate(1);
                d.setMonth(d.getMonth() - i);
                const y = d.getFullYear();
                const m = d.getMonth();
                return (
                  <option key={`${y}-${m}`} value={`${y}-${m}`} className="bg-white text-[#37352f] font-bold">
                    {y}년 {m + 1}월
                  </option>
                );
              })}
            </select>
          </div>

          <button
            onClick={handleNextMonth}
            className="px-2 py-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded transition-colors text-xs font-black"
            title="다음 달 조회"
          >
            ▶
          </button>
        </div>
      </div>

      {/* 요약 통계 카드 그리드 (재원생 수 추가) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatsCard 
          label="현재 재원생 수" 
          count={activeStudentsCount} 
          color="text-slate-700" 
          borderColor="border-slate-300"
          bg="bg-slate-50"
          icon={<Users size={16} className="text-slate-600" />}
          unit="명"
        />
        <StatsCard 
          label="이달의 신입생" 
          count={newStudents.length} 
          color="text-emerald-800" 
          borderColor="border-emerald-300"
          bg="bg-emerald-50"
          icon={<UserPlus size={16} className="text-emerald-600" />}
          unit="명"
        />
        <StatsCard 
          label="이달의 보강수업" 
          count={makeups.length} 
          color="text-blue-800" 
          borderColor="border-blue-300"
          bg="bg-blue-50"
          icon={<CheckSquare size={16} className="text-blue-600" />}
          unit="회"
        />
        <StatsCard 
          label="이달의 결석/지각" 
          count={absences.length} 
          color="text-amber-800" 
          borderColor="border-amber-300"
          bg="bg-amber-50"
          icon={<Frown size={16} className="text-amber-600" />}
          unit="건"
        />
        <StatsCard 
          label="이달의 퇴원생" 
          count={dischargedMonth.length} 
          color="text-red-700" 
          borderColor="border-red-300"
          bg="bg-red-50"
          icon={<UserMinus size={16} className="text-red-500" />}
          unit="명"
        />
      </div>

      {/* 5개 탭 내비게이션 바 */}
      <div className="flex bg-white p-1 rounded-lg border border-[#e3e2e0] w-full overflow-x-auto custom-scrollbar-h shadow-sm">
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
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-[13px] font-bold uppercase tracking-tight transition-all border whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-blue-50 text-blue-650 border-blue-200 shadow-sm' 
                : 'text-gray-500 hover:text-[#37352f] hover:bg-gray-100 border-transparent'
            }`}
          >
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums transition-colors ${
              activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-150 text-gray-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 영역 */}
      <div className="bg-white border border-[#e3e2e0] rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-[#f7f7f5] border-b border-[#edece9]">
              <th className="py-4 px-6 text-[12px] font-bold uppercase text-gray-600 tracking-wider w-32 text-center">날짜 / 기간</th>
              <th className="py-4 px-4 text-[12px] font-bold uppercase text-gray-600 tracking-wider w-28 text-center">구분</th>
              <th className="py-4 px-4 text-[12px] font-bold uppercase text-gray-600 tracking-wider w-40">학생명</th>
              <th className="py-4 px-4 text-[12px] font-bold uppercase text-gray-600 tracking-wider">사유 및 내용</th>
              <th className="py-4 px-6 text-[12px] font-bold uppercase text-gray-600 tracking-wider w-36 text-right">담당 선생님</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edece9]">
            {activeTab === 'new' && newStudents.map((item) => (
              <RowTemplate 
                key={item.id} 
                date={item.date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })} 
                badge={<span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200"><UserPlus size={10} /> 신규</span>}
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
                badge={<span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded bg-blue-50 text-blue-650 border border-blue-200"><CheckSquare size={10} /> 보강</span>}
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
                      ? 'bg-red-50 text-red-500 border-red-200' 
                      : 'bg-amber-50 text-amber-600 border-amber-200'
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
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <span className="font-bold text-[#37352f]">{item.date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}</span>
                    {item.period && <span className="text-[9px] font-black text-red-500 whitespace-nowrap bg-red-50 px-1.5 py-0.5 rounded-[3px] border border-red-100">({item.period})</span>}
                  </div>
                }
                badge={<span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded bg-red-50 text-red-500 border border-red-200"><UserMinus size={10} /> 퇴원</span>}
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
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <span className="font-bold text-[#37352f]">{item.date ? item.date.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '미기재'}</span>
                    {item.period && <span className="text-[9px] font-black text-red-500 whitespace-nowrap bg-red-50 px-1.5 py-0.5 rounded-[3px] border border-red-100">({item.period})</span>}
                  </div>
                }
                badge={<span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200"><UserMinus size={10} /> 아카이브</span>}
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
      className="hover:bg-gray-50/80 transition-colors group align-middle cursor-pointer"
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
          <h4 className="text-[13px] font-semibold text-gray-500 group-hover:text-blue-600 transition-colors tracking-tight">
            {name}
          </h4>
          <ArrowRight size={10} className="text-gray-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </div>
      </td>
      <td className="py-4 px-4">
        <p className="text-[12px] font-bold text-gray-650 leading-relaxed max-w-xl truncate" title={description}>
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
      <td colSpan={5} className="py-24 text-center text-gray-400 font-bold text-[11px] uppercase tracking-widest">
        <AlertCircle size={24} className="mx-auto mb-3 opacity-20" />
        {message}
      </td>
    </tr>
  );
}

function StatsCard({ label, count, color, borderColor, bg, icon, unit }: any) {
  return (
    <div className={`${bg} border ${borderColor} rounded-lg p-5 space-y-2.5 shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-all`}>
      <div className="flex justify-between items-start">
        <p className="text-[13px] font-bold text-gray-600 uppercase tracking-tight">{label}</p>
        <div className={`opacity-60 group-hover:opacity-100 transition-opacity`}>
          {icon}
        </div>
      </div>
      <div className={`text-3xl font-black tabular-nums ${color} flex items-baseline gap-1`}>
        {count}
        <span className="text-[12px] font-bold text-gray-500 tracking-normal ml-0.5">{unit}</span>
      </div>
      <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full ${bg} blur-2xl group-hover:scale-150 transition-transform duration-700`} />
    </div>
  );
}
