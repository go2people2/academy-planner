'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Trash2 } from 'lucide-react';

interface HolidayManagementProps {
  holidays: any[];
  onAddHoliday: (date: string, note: string) => Promise<void>;
  onDeleteHoliday: (date: string) => Promise<void>;
  isAdmin?: boolean;
}

export default function HolidayManagement({ holidays, onAddHoliday, onDeleteHoliday, isAdmin = true }: HolidayManagementProps) {
  const [newHoliday, setNewHoliday] = useState('');
  const [holidayNote, setHolidayNote] = useState('');

  const handleAdd = async () => {
    if (!newHoliday) return;
    await onAddHoliday(newHoliday, holidayNote);
    setNewHoliday('');
    setHolidayNote('');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="max-w-4xl bg-white/5 border border-white/5 rounded-[4px] p-8 space-y-8">
        <div className="flex items-center gap-3">
          <Calendar className="text-emerald-500" size={20} />
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Academy Holidays (휴일 관리)</h3>
        </div>

        {/* 관리자(isAdmin)일 때만 휴일 신규 등록 폼 노출 */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-black/40 p-6 rounded-lg border border-white/5">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-1">Holiday Date</label>
              <input 
                type="date" 
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm font-black text-white outline-none focus:border-emerald-500 transition-all [color-scheme:dark]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-1">Description (Optional)</label>
              <input 
                type="text" 
                placeholder="예: 현충일, 학원 방학"
                value={holidayNote}
                onChange={(e) => setHolidayNote(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm font-black text-white outline-none focus:border-emerald-500 transition-all"
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={handleAdd}
                disabled={!newHoliday}
                className="w-full py-3 bg-emerald-600 text-white rounded-[2px] text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Add Holiday
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] ml-1">Registered Holidays</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {holidays.length === 0 ? (
              <div className="col-span-full py-10 text-center border border-dashed border-white/10 rounded-lg">
                <p className="text-[11px] text-gray-300 font-bold uppercase">No holidays registered</p>
              </div>
            ) : (
              holidays.map((h: any) => {
                const currentMonthStr = new Date().toISOString().substring(0, 7);
                const isCurrentMonth = h.date.startsWith(currentMonthStr);
                return (
                  <div 
                    key={h.date} 
                    className={`flex items-center justify-between p-4 bg-white/5 border rounded-md group transition-all ${
                      isCurrentMonth 
                        ? 'border-white/5 hover:border-emerald-500/30' 
                        : 'border-white/5 opacity-55 hover:opacity-100 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded flex items-center justify-center border ${
                        isCurrentMonth 
                          ? 'bg-emerald-500/10 border-emerald-500/20' 
                          : 'bg-white/5 border-white/10'
                      }`}>
                        <Calendar size={18} className={isCurrentMonth ? 'text-emerald-500' : 'text-gray-400'} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">{h.date}</p>
                        <p className={`text-[13px] font-black tracking-tight mt-0.5 ${
                          isCurrentMonth ? 'text-emerald-400' : 'text-gray-400'
                        }`}>{h.note || '설명 없음'}</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <button 
                        onClick={() => onDeleteHoliday(h.date)}
                        className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <p className="text-[10px] text-gray-400 italic leading-relaxed">
          * 등록된 휴일은 정규 수업일이더라도 "수업 없는 날"로 처리됩니다.<br/>
          * 휴일에는 지난 수업의 테스트 데이터가 "오늘 테스트"로 이월되지 않고 다음 실제 수업일로 연기됩니다.
        </p>
      </div>
    </motion.div>
  );
}
