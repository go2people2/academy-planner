'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, Clock, DollarSign, Users, Loader2, RefreshCw } from 'lucide-react';

interface StaffLogsManagementProps {
  academyInfo: any;
  teachers: any[];
}

export default function StaffLogsManagement({ academyInfo, teachers }: StaffLogsManagementProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 날짜 검색 필터 기본값: 이번 달 1일 ~ 오늘
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('All');
  const [hourlyWage, setHourlyWage] = useState<number>(10000); // 기본 시급 가이드 10,000원

  const fetchLogs = useCallback(async () => {
    if (!academyInfo) return;
    setIsLoading(true);
    try {
      // 💡 ams_teacher_logs 테이블에서 해당 학원의 근태기록 및 교직원 정보(조인) 로드
      let query = supabase
        .from('ams_teacher_logs')
        .select(`
          id,
          work_date,
          clock_in_at,
          clock_out_at,
          total_minutes,
          notes,
          teacher_id,
          ams_teachers (
            name,
            role,
            login_id
          )
        `)
        .eq('academy_id', academyInfo.id)
        .gte('work_date', startDate)
        .lte('work_date', endDate)
        .order('work_date', { ascending: false })
        .order('clock_in_at', { ascending: false });

      if (selectedTeacherId !== 'All') {
        query = query.eq('teacher_id', selectedTeacherId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (e) {
      console.error('근태기록 조회 실패:', e);
    } finally {
      setIsLoading(false);
    }
  }, [academyInfo, startDate, endDate, selectedTeacherId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // KST 시간 포맷 유틸
  const formatTime = (isoString: string | null) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch {
      return isoString;
    }
  };

  // 근무 시간 포맷 유틸 (분 -> 시간 + 분)
  const formatDuration = (mins: number) => {
    if (!mins || mins <= 0) return '-';
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    return hrs > 0 ? `${hrs}시간 ${m}분` : `${m}분`;
  };

  // 실시간 근무 통계 요약 정보 계산
  const stats = useMemo(() => {
    let totalMins = 0;
    let daysCount = logs.length;
    let activeStaffCount = new Set(logs.map(l => l.teacher_id)).size;

    logs.forEach(l => {
      totalMins += l.total_minutes || 0;
    });

    const hoursTotal = totalMins / 60;
    const estWage = Math.floor(hoursTotal * hourlyWage);

    return {
      daysCount,
      totalHoursStr: `${Math.floor(hoursTotal)}시간 ${Math.round((hoursTotal - Math.floor(hoursTotal)) * 60)}분`,
      activeStaffCount,
      estWage: estWage.toLocaleString('ko-KR')
    };
  }, [logs, hourlyWage]);

  // 역할 다국어 대응
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'master': return '대표원장';
      case 'admin': return '관리자';
      case 'teacher': return '강사';
      case 'assistant': return '조교';
      case 'staff': return '행정/데스크';
      default: return role;
    }
  };

  return (
    <div className="space-y-6">
      {/* 검색 및 필터 패널 */}
      <div className="bg-white/5 border border-white/10 rounded-[4px] p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Calendar size={16} /> Filter & Settings
          </h3>
          <button 
            onClick={fetchLogs} 
            disabled={isLoading}
            className="self-end px-3 py-1.5 bg-white/5 border border-white/10 rounded-[2px] text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-1.5"
          >
            {isLoading ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
            새로고침
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">시작일</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-[2px] px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-all"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">종료일</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-[2px] px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">직원 선택</label>
            <select 
              value={selectedTeacherId} 
              onChange={e => setSelectedTeacherId(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-[2px] px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value="All">전체 직원</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({getRoleLabel(t.role)})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">시급 계산 가이드 (원)</label>
            <input 
              type="number" 
              step="500"
              value={hourlyWage} 
              onChange={e => setHourlyWage(Number(e.target.value))}
              placeholder="예: 10000"
              className="w-full bg-black border border-white/10 rounded-[2px] px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* 실시간 대시보드 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-[4px] p-5 flex flex-col justify-between">
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">근무 인원</span>
          <div className="flex items-center gap-2 mt-2">
            <Users className="text-blue-500" size={20} />
            <span className="text-2xl font-black text-white">{stats.activeStaffCount}명</span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[4px] p-5 flex flex-col justify-between">
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">총 출근 횟수</span>
          <div className="flex items-center gap-2 mt-2">
            <Calendar className="text-emerald-500" size={20} />
            <span className="text-2xl font-black text-white">{stats.daysCount}회</span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[4px] p-5 flex flex-col justify-between">
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">총 근무 시간</span>
          <div className="flex items-center gap-2 mt-2">
            <Clock className="text-amber-500" size={20} />
            <span className="text-lg font-black text-white">{stats.totalHoursStr}</span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[4px] p-5 flex flex-col justify-between">
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">예상 정산 급여</span>
          <div className="flex items-center gap-2 mt-2">
            <DollarSign className="text-rose-500" size={20} />
            <span className="text-xl font-black text-rose-400">{stats.estWage}원</span>
          </div>
        </div>
      </div>

      {/* 근태기록 표 */}
      <div className="bg-white/5 border border-white/10 rounded-[4px] overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex flex-col items-center justify-center text-gray-500 gap-2">
            <Loader2 className="animate-spin" size={24} />
            <span className="text-[9px] font-black uppercase tracking-wider">Loading Staff Logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-[10px] font-black uppercase tracking-wider">
            조회된 기간 내에 출퇴근 기록이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="p-4 font-black uppercase tracking-widest text-gray-500 text-[9px]">근무일</th>
                  <th className="p-4 font-black uppercase tracking-widest text-gray-500 text-[9px]">이름</th>
                  <th className="p-4 font-black uppercase tracking-widest text-gray-500 text-[9px]">직책</th>
                  <th className="p-4 font-black uppercase tracking-widest text-gray-500 text-[9px]">출근시각</th>
                  <th className="p-4 font-black uppercase tracking-widest text-gray-500 text-[9px]">퇴근시각</th>
                  <th className="p-4 font-black uppercase tracking-widest text-gray-500 text-[9px] text-right">근무시간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => {
                  const teacherInfo = log.ams_teachers || {};
                  const isWorking = !log.clock_out_at;
                  
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="p-4 font-extrabold text-gray-300">{log.work_date}</td>
                      <td className="p-4 font-black text-white text-xs">{teacherInfo.name || '알 수 없음'}</td>
                      <td className="p-4 font-bold text-gray-400">
                        <span className={`px-2 py-0.5 rounded-[2px] text-[9px] font-black uppercase border ${
                          teacherInfo.role === 'assistant' 
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                            : teacherInfo.role === 'staff'
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                            : 'bg-white/5 text-gray-400 border-white/10'
                        }`}>
                          {getRoleLabel(teacherInfo.role)}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-gray-300">{formatTime(log.clock_in_at)}</td>
                      <td className="p-4 font-bold">
                        {isWorking ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black animate-pulse">
                            ● 근무 중
                          </span>
                        ) : (
                          <span className="text-gray-300">{formatTime(log.clock_out_at)}</span>
                        )}
                      </td>
                      <td className="p-4 font-black text-right text-white">
                        {isWorking ? '-' : formatDuration(log.total_minutes)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
