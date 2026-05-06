'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  UserPlus, UserMinus, ArrowLeftRight, Calendar, Info, Search, AlertCircle, TrendingUp
} from 'lucide-react';
import { Student } from '@/types/dashboard';

interface MonthlyChangesProps {
  students: Student[];
}

export default function MonthlyChanges({ students }: MonthlyChangesProps) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const changes = useMemo(() => {
    const list: any[] = [];

    students.forEach(s => {
      // 1. 신입생 체크 (이번 달 등록)
      if (s.created_at) {
        const createDate = new Date(s.created_at);
        if (createDate.getMonth() === currentMonth && createDate.getFullYear() === currentYear) {
          list.push({
            id: `new-${s.id}`,
            date: createDate,
            studentName: s.name,
            type: '신입',
            icon: <UserPlus className="text-emerald-500" size={14} />,
            description: `${s.grade} ${s.class} 신규 등록`,
            details: '신입생'
          });
        }
      }

      // 2. 퇴원생 체크 (이번 달 퇴원)
      if (s.is_deleted) {
        // status_changed_at이 없으면 updated_at을 사용 (이전 데이터 호환성)
        const changeTime = s.status_changed_at || (s as any).updated_at;
        if (changeTime) {
          const deleteDate = new Date(changeTime);
          if (deleteDate.getMonth() === currentMonth && deleteDate.getFullYear() === currentYear) {
            // 퇴원 사유 찾기 (수업로그 중 마지막 특이사항 혹은 이름 매칭)
            const lastLog = s.allLogs.find(l => l.attendance_status === '수업제외' || l.special_notes.toLowerCase().includes('퇴원'));
            
            list.push({
              id: `del-${s.id}`,
              date: deleteDate,
              studentName: s.name,
              type: '퇴원',
              icon: <UserMinus className="text-red-500" size={14} />,
              description: lastLog?.special_notes || '퇴원 처리됨 (사유 미기재)',
              details: '퇴원생'
            });
          }
        } else {
          // 💡 날짜 정보가 전혀 없는 경우에도 '이번 달'로 간주하여 일단 표시 (데이터 누락 방지)
          list.push({
            id: `del-unknown-${s.id}`,
            date: now, 
            studentName: s.name,
            type: '퇴원',
            icon: <UserMinus className="text-red-500" size={14} />,
            description: '퇴원 정보 로드됨 (날짜 확인 불가)',
            details: '데이터 확인 필요'
          });
        }
      }

      // 3. 수업 로그에서의 주요 변동사항 (보강 등)
      s.allLogs.forEach(log => {
        const logDate = new Date(log.date);
        if (logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear) {
          if (log.attendance_status === '보강') {
            list.push({
              id: `log-${log.id}`,
              date: logDate,
              studentName: s.name,
              type: '보강',
              icon: <UserPlus className="text-blue-500" size={14} />,
              description: log.special_notes || '보강 수업 진행',
              details: log.date.slice(5).replace('-', '.')
            });
          }
        }
      });
    });

    // 날짜 역순 정렬
    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [students, currentMonth, currentYear]);

  return (
    <div className="p-8 space-y-10 bg-[#080808] min-h-full max-w-6xl mx-auto">
      {/* 헤더 섹션 */}
      <div className="flex items-center justify-between border-b border-white/5 pb-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <ArrowLeftRight size={28} className="text-blue-500" />
            Monthly Changes
          </h2>
          <p className="text-[11px] text-gray-500 font-bold uppercase tracking-[0.4em]">
            {currentYear}년 {currentMonth + 1}월 학생 현황 및 수업 변동 리포트
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white/5 px-5 py-2.5 rounded-[4px] border border-white/10 shadow-xl">
          <Calendar size={16} className="text-blue-500" />
          <span className="text-[12px] font-black text-gray-200 uppercase tracking-widest">{currentMonth + 1}월 현황</span>
        </div>
      </div>

      {/* 리포트 테이블 */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-md overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-white/[0.03] border-b border-white/10">
              <th className="py-5 px-8 text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] w-32 text-center">날짜</th>
              <th className="py-5 px-4 text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] w-28 text-center">구분</th>
              <th className="py-5 px-4 text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] w-40">학생명</th>
              <th className="py-5 px-4 text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">내용 및 사유</th>
              <th className="py-5 px-8 text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] w-48 text-right">비고</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {changes.map((change) => (
              <motion.tr 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={change.id} 
                className="hover:bg-white/[0.02] transition-colors group align-middle"
              >
                <td className="py-5 px-8 text-[12px] font-black text-gray-600 tabular-nums text-center">
                  {change.date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                </td>
                <td className="py-5 px-4 text-center">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-[2px] border ${
                    change.type === '신입' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                    change.type === '퇴원' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                    'bg-blue-500/10 text-blue-500 border-blue-500/20'
                  }`}>
                    {change.icon}
                    {change.type}
                  </span>
                </td>
                <td className="py-5 px-4">
                  <h4 className="text-[15px] font-black text-white group-hover:text-blue-400 transition-colors tracking-tight">
                    {change.studentName}
                  </h4>
                </td>
                <td className="py-5 px-4">
                  <p className="text-[12px] font-bold text-gray-400 leading-relaxed max-w-lg">
                    {change.description}
                  </p>
                </td>
                <td className="py-5 px-8 text-[11px] font-black text-gray-600 text-right italic uppercase tracking-tighter">
                  {change.details}
                </td>
              </motion.tr>
            ))}
            {changes.length === 0 && (
              <tr>
                <td colSpan={5} className="py-32 text-center text-gray-700">
                  <AlertCircle size={32} className="mx-auto mb-4 opacity-20" />
                  <p className="uppercase font-black tracking-[0.4em] text-[12px] opacity-40">No changes recorded this month</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 요약 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <StatsCard 
          label="신규 등록 학생" 
          count={changes.filter(c => c.type === '신입').length} 
          color="text-emerald-500" 
          borderColor="border-emerald-500/30"
          bg="bg-emerald-500/5"
        />
        <StatsCard 
          label="이번 달 퇴원생" 
          count={changes.filter(c => c.type === '퇴원').length} 
          color="text-red-500" 
          borderColor="border-red-500/30"
          bg="bg-red-500/5"
        />
        <StatsCard 
          label="수업 변동 (보강)" 
          count={changes.filter(c => c.type === '보강').length} 
          color="text-blue-500" 
          borderColor="border-blue-500/30"
          bg="bg-blue-500/5"
        />
      </div>
    </div>
  );
}

function StatsCard({ label, count, color, borderColor, bg }: any) {
  return (
    <div className={`${bg} border ${borderColor} rounded-md p-6 space-y-3 shadow-2xl relative overflow-hidden group hover:scale-[1.02] transition-all`}>
      <div className="flex justify-between items-start">
        <p className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">{label}</p>
        <TrendingUp size={16} className={`${color} opacity-30`} />
      </div>
      <div className={`text-4xl font-black tabular-nums ${color} flex items-baseline gap-2`}>
        {count}
        <span className="text-xs font-bold text-gray-600 tracking-normal">명/건</span>
      </div>
      {/* 장식용 배경 */}
      <div className={`absolute -right-4 -bottom-4 w-20 h-20 rounded-full ${bg} blur-3xl group-hover:scale-150 transition-transform duration-700`} />
    </div>
  );
}
