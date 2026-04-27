'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, GraduationCap, Phone, Book, Save, Loader2 } from 'lucide-react';

interface AddStudentModalProps {
  onClose: () => void;
  onSave: (studentData: any) => Promise<void>;
}

export default function AddStudentModal({ onClose, onSave }: AddStudentModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    school: '',
    grade: '고1',
    class_name: '일반반',
    phone: '', // 비밀번호로 사용될 전화번호
    class_days: [] as string[]
  });

  const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      class_days: prev.class_days.includes(day) 
        ? prev.class_days.filter(d => d !== day) 
        : [...prev.class_days, day]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    
    // 전화번호 뒷자리 4개를 초기 비밀번호로 설정하는 로직 포함 가능
    await onSave(formData);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <UserPlus className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Add New Student</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">학생 등록 및 자동 계정 생성</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 이름 & 학교 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Student Name</label>
              <input 
                required
                type="text" 
                placeholder="이름 입력"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">School</label>
              <input 
                type="text" 
                placeholder="학교명"
                value={formData.school}
                onChange={(e) => setFormData({...formData, school: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* 학년 & 반 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Grade</label>
              <select 
                value={formData.grade}
                onChange={(e) => setFormData({...formData, grade: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
              >
                <option value="중1" className="bg-[#121212]">중1</option>
                <option value="중2" className="bg-[#121212]">중2</option>
                <option value="중3" className="bg-[#121212]">중3</option>
                <option value="고1" className="bg-[#121212]">고1</option>
                <option value="고2" className="bg-[#121212]">고2</option>
                <option value="고3" className="bg-[#121212]">고3</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Class</label>
              <input 
                type="text" 
                placeholder="반 이름"
                value={formData.class_name}
                onChange={(e) => setFormData({...formData, class_name: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* 연락처 (비밀번호로 활용) */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Phone Number (Initial Password)</label>
            <div className="relative group">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                required
                type="tel" 
                placeholder="010-0000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <p className="text-[9px] text-gray-600 font-bold px-1">뒷자리 4자리가 학생의 초기 비밀번호가 됩니다.</p>
          </div>

          {/* 수업 요일 */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Class Days</label>
            <div className="flex justify-between gap-2">
              {DAYS.map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`flex-1 py-2 rounded-lg text-xs font-black transition-all border ${
                    formData.class_days.includes(day) 
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' 
                      : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/20'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* 저장 버튼 */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 mt-4 shadow-xl hover:bg-gray-100"
          >
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Register & Create Account</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
