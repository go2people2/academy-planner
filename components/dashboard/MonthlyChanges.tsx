'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  UserPlus, UserMinus, ArrowLeftRight, Calendar, Info, Search
} from 'lucide-react';
import { Student } from '@/types/dashboard';

interface MonthlyChangesProps {
  students: Student[];
}

export default function MonthlyChanges({ students }: MonthlyChangesProps) {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const changes = useMemo(() => {
    const list: any[] = [];

    students.forEach(s => {
      // 1. 신입생 체크
      if (s.created_at) {
        const createDate = new Date(s.created_at);
        if (createDate.getMonth() === currentMonth && createDate.getFullYear() === currentYear) {
          list.push({
            id: `new-${s.id}`,
            date: createDate,
            studentName: s.name,
            type: '신입',
            icon: <UserPlus className="text-emerald-500" size={14} />,
            description: `${s.grade} ${s.class} 등록`,
            details: s.phone
          });
        }
      }

      // 2. 퇴원생 체크
      if (s.is_deleted && s.status_changed_at) {
        const deleteDate = new Date(s.status_changed_at);
        if (deleteDate.getMonth() === currentMonth && deleteDate.getFullYear() === currentYear) {
          list.push({
            id: `del-${s.id}`,
            date: deleteDate,
            studentName: s.name,
            type: '퇴원',
            icon: <UserMinus className="text-red-500" size={14} />,
            description: '퇴원 처리 및 보관',
            details: s.phone // 여기에 사유가 포함되어 있음 (이전 로직)
          });
        }
      }

      // 3. 수업 로그에서의 변동사항 (보강, 취소 등)
      s.allLogs.forEach(log => {
        const logDate = new Date(log.date);
        if (logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear) {
          if (log.attendance_status === '보강' || log.attendance_status === '수업제외') {
            list.push({
              id: `log-${log.id}`,
              date: logDate,
              studentName: s.student_name || s.name,
              type: log.attendance_status,
              icon: log.attendance_status === '보강' 
                ? <UserPlus className="text-blue-500" size={14} /> 
                : <UserMinus className="text-amber-500" size={14} />,
              description: log.special_notes || '사유 미기재',
              details: log.date
            });
          }
        }
      });
    });

    // 날짜 역순 정렬
    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [students, currentMonth, currentYear]);

  return (
    <div className="p-6 space-y-6 bg-[#080808] min-h-full">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">이번 달 변동 사항</h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">
            {currentYear}년 {currentMonth + 1}월 주요 학생 현황 및 수업 변경 기록
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
          <Calendar size={14} className="text-blue-500" />
          <span className="text-[11px] font-black text-gray-300">{currentMonth + 1}월 리포트</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.03] border-b border-white/5">
                <th className="py-4 px-6 text-[10px] font-black uppercase text-gray-500 tracking-widest w-24">날짜</th>
                <th className="py-4 px-4 text-[10px] font-black uppercase text-gray-500 tracking-widest w-24">구분</th>
                <th className="py-4 px-4 text-[10px] font-black uppercase text-gray-500 tracking-widest w-32">학생명</th>
                <th className="py-4 px-4 text-[10px] font-black uppercase text-gray-500 tracking-widest">변동 내용 및 사유</th>
                <th className="py-4 px-6 text-[10px] font-black uppercase text-gray-500 tracking-widest w-40 text-right">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {changes.map((change) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={change.id} 
                  className="hover:bg-white/[0.02] transition-colors group"
                >
                  <td className="py-4 px-6 text-[11px] font-bold text-gray-500 tabular-nums">
                    {change.date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`flex items-center gap-1.5 text-[10px] font-black px-2 py-0.5 rounded-full border w-fit ${
                      change.type === '신입' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                      change.type === '퇴원' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                      change.type === '보강' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                      'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                      {change.icon}
                      {change.type}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-[13px] font-black text-white group-hover:text-blue-400 transition-colors">
                    {change.studentName}
                  </td>
                  <td className="py-4 px-4 text-[11px] font-bold text-gray-400 leading-relaxed">
                    {change.description}
                  </td>
                  <td className="py-4 px-6 text-[10px] font-medium text-gray-600 text-right italic truncate">
                    {change.details}
                  </td>
                </motion.tr>
              ))}
              {changes.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-gray-700 uppercase font-black tracking-[0.3em] text-[11px]">
                    이번 달 변동 사항이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatsCard label="이번 달 신입" count={changes.filter(c => c.type === '신입').length} color="text-emerald-500" />
        <StatsCard label="이번 달 퇴원" count={changes.filter(c => c.type === '퇴원').length} color="text-red-500" />
        <StatsCard label="수업 변경 건수" count={changes.filter(c => c.type === '보강' || c.type === '수업제외').length} color="text-blue-500" />
      </div>
    </div>
  );
}

function StatsCard({ label, count, color }: any) {
  return (
    <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-5 space-y-2 shadow-xl border-t-2" style={{ borderTopColor: 'currentColor' }}>
      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
      <div className={`text-3xl font-black tabular-nums ${color}`}>{count}<span className="text-xs ml-1 text-gray-600">건</span></div>
    </div>
  );
}
