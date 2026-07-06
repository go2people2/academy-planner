'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Trash2 } from 'lucide-react';

interface HolidayManagementProps {
  holidays: any[];
  onAddHoliday: (date: string, note: string) => Promise<void>;
  onDeleteHoliday: (date: string) => Promise<void>;
}

export default function HolidayManagementLight({ holidays, onAddHoliday, onDeleteHoliday }: HolidayManagementProps) {
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
      <div className="max-w-4xl bg-white border border-[#e3e2e0] rounded-lg p-8 space-y-8 shadow-sm">
        <div className="flex items-center gap-3">
          <Calendar className="text-emerald-600" size={20} />
          <h3 className="text-sm font-bold text-[#37352f] uppercase tracking-widest">Academy Holidays (휴일 관리)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50/50 p-6 rounded-lg border border-[#edece9]">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest ml-1">Holiday Date</label>
            <input 
              type="date" 
              value={newHoliday}
              onChange={(e) => setNewHoliday(e.target.value)}
              className="w-full bg-white border border-[#edece9] rounded px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-emerald-500 transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest ml-1">Description (Optional)</label>
            <input 
              type="text" 
              placeholder="예: 현충일, 학원 방학"
              value={holidayNote}
              onChange={(e) => setHolidayNote(e.target.value)}
              className="w-full bg-white border border-[#edece9] rounded px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-emerald-500 transition-all placeholder-gray-300"
            />
          </div>
          <div className="flex items-end">
            <button 
              onClick={handleAdd}
              disabled={!newHoliday}
              className="w-full py-3 bg-emerald-600 text-white rounded text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-md shadow-emerald-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Add Holiday
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Registered Holidays</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {holidays.length === 0 ? (
              <div className="col-span-full py-10 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/30">
                <p className="text-[11px] text-gray-400 font-bold uppercase">No holidays registered</p>
              </div>
            ) : (
              holidays.map((h: any) => (
                <div key={h.date} className="flex items-center justify-between p-4 bg-white border border-[#edece9] hover:border-emerald-350 hover:shadow-sm rounded-lg transition-all text-[#37352f]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded bg-emerald-50 flex items-center justify-center border border-emerald-100">
                      <Calendar size={18} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-800">{h.date}</p>
                      <p className="text-[13px] font-bold text-emerald-700 tracking-tight mt-0.5">{h.note || '설명 없음'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onDeleteHoliday(h.date)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-rose-50 rounded-full transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400 font-bold italic leading-relaxed">
          * 등록된 휴일은 정규 수업일이더라도 "수업 없는 날"로 처리됩니다.<br/>
          * 휴일에는 지난 수업의 테스트 데이터가 "오늘 테스트"로 이월되지 않고 다음 실제 수업일로 연기됩니다.
        </p>
      </div>
    </motion.div>
  );
}
