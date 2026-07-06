'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Key, Clock, Globe, BookOpen, X } from 'lucide-react';

interface AcademyProfileProps {
  academyInfo: any;
  currentUser?: any;
  onUpdateAcademyInfo?: (updates: any) => Promise<void>;
  opSettings: any;
  setOpSettings: React.Dispatch<React.SetStateAction<any>>;
  updateOpSetting: (key: string, value: any) => Promise<void>;
  updateTimerPreset: (index: number, value: number) => Promise<void>;
}

export default function AcademyProfileLight({ 
  academyInfo, currentUser, onUpdateAcademyInfo, opSettings, setOpSettings, updateOpSetting, updateTimerPreset 
}: AcademyProfileProps) {
  const [newCategory, setNewCategory] = useState('');

  const handleAddCategory = () => {
    const val = newCategory.trim();
    if (!val) return;
    const current = opSettings.textbook_categories || [];
    if (current.includes(val)) {
      alert('이미 등록된 분류입니다.');
      return;
    }
    const updated = [...current, val];
    updateOpSetting('textbook_categories', updated);
    setNewCategory('');
  };

  const handleRemoveCategory = (cat: string) => {
    const current = opSettings.textbook_categories || [];
    const updated = current.filter((c: string) => c !== cat);
    updateOpSetting('textbook_categories', updated);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="w-full space-y-6 text-[#37352f]"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* 왼쪽 단 (핵심 설정 영역) */}
        <div className="space-y-6">
          {/* 1. 학원 기본 설정 */}
          <div className="bg-white border border-[#e3e2e0] rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-3 pb-2 border-b border-[#e3e2e0]">
              <Shield className="text-blue-600" size={18} />
              <h3 className="text-xs font-bold text-[#37352f] uppercase tracking-widest">학원 기본 설정</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1 text-left col-span-1">
                <label className="text-[11px] font-bold text-blue-700 tracking-widest ml-0.5">학원명</label>
                <div className="px-3 py-2 bg-gray-50 border border-[#edece9] rounded text-[13px] font-bold text-gray-800 truncate">{academyInfo?.academy_name}</div>
              </div>

              <div className="space-y-1 text-left col-span-1">
                <label className="text-[11px] font-bold text-blue-700 tracking-widest ml-0.5">상담 주기</label>
                <div className="relative">
                  <input 
                    type="number" 
                    defaultValue={academyInfo?.consultation_cycle || 21}
                    onBlur={async (e) => {
                      if (!onUpdateAcademyInfo) return;
                      await onUpdateAcademyInfo({ consultation_cycle: parseInt(e.target.value) || 21 });
                      alert('상담 주기가 변경되었습니다.');
                    }}
                    className="w-full bg-white border border-[#edece9] rounded px-3 py-1.5 text-[13px] font-bold text-blue-700 outline-none focus:border-blue-500 transition-all focus:ring-1 focus:ring-blue-500/30" 
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">일</span>
                </div>
              </div>

              <div className="space-y-1 text-left col-span-1">
                <label className="text-[11px] font-bold text-blue-700 tracking-widest ml-0.5">마스터 패스키</label>
                <div className="relative group">
                  <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 group-focus-within:text-amber-600 transition-colors" />
                  <input 
                    type="text" 
                    maxLength={4}
                    defaultValue={academyInfo?.student_passkey || '2324'}
                    placeholder="4자리"
                    onBlur={async (e) => {
                      if (!onUpdateAcademyInfo) return;
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      if (val.length !== 4) { alert('패스키는 숫자 4자리여야 합니다.'); return; }
                      await onUpdateAcademyInfo({ student_passkey: val });
                      alert('학생 페이지 패스키가 변경되었습니다.');
                    }}
                    className="w-full bg-white border border-[#edece9] rounded pl-7 pr-2 py-1.5 text-[13px] font-bold text-amber-700 outline-none focus:border-amber-500 transition-all focus:ring-1 focus:ring-amber-500/30" 
                  />
                </div>
              </div>

              <div className="space-y-1 text-left col-span-1">
                <label className="text-[11px] font-bold text-blue-700 tracking-widest ml-0.5">학원 위치 (지역)</label>
                <input 
                  type="text"
                  placeholder="예: 인천, 서울/강남"
                  value={opSettings.location || ""}
                  onChange={(e) => setOpSettings((prev:any) => ({ ...prev, location: e.target.value }))}
                  onBlur={(e) => updateOpSetting('location', e.target.value.trim())}
                  className="w-full bg-white border border-[#edece9] rounded px-3 py-1.5 text-[13px] font-bold text-blue-700 outline-none focus:border-blue-500 transition-all focus:ring-1 focus:ring-blue-500/30"
                />
              </div>
            </div>
            <p className="text-[9px] text-gray-450 font-bold italic text-left ml-0.5">* 모든 학원 정보 설정은 입력 후 마우스 커서를 입력창 바깥으로 빼면 자동 저장됩니다.</p>
          </div>

          {/* 2. 수업 및 지각 / 타이머 설정 */}
          <div className="bg-white border border-[#e3e2e0] rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-3 pb-2 border-b border-[#e3e2e0]">
              <Clock className="text-amber-600" size={18} />
              <h3 className="text-xs font-bold text-[#37352f] tracking-widest">수업 및 지각 설정</h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1 text-left">
                <label className="text-[11px] font-bold text-blue-700 tracking-widest ml-0.5">1교시 시작 시각</label>
                <input 
                  type="time"
                  value={opSettings.first_period_time || ""}
                  onChange={(e) => setOpSettings((prev:any) => ({ ...prev, first_period_time: e.target.value }))}
                  onBlur={(e) => updateOpSetting('first_period_time', e.target.value)}
                  className="w-full bg-white border border-[#edece9] rounded px-3 py-2 text-[13px] font-bold text-amber-700 outline-none focus:border-amber-500 transition-all cursor-pointer focus:ring-1 focus:ring-amber-500/30"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[11px] font-bold text-blue-700 tracking-widest ml-0.5">지각 기준</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={opSettings.late_threshold || 0}
                    onChange={(e) => setOpSettings((prev:any) => ({ ...prev, late_threshold: parseInt(e.target.value) || 0 }))}
                    onBlur={(e) => updateOpSetting('late_threshold', parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-[#edece9] rounded px-3 py-2 text-[13px] font-bold text-blue-700 outline-none focus:border-blue-500 transition-all focus:ring-1 focus:ring-blue-500/30" 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">분</span>
                </div>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[11px] font-bold text-blue-700 tracking-widest ml-0.5">연락 알림</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={opSettings.alert_threshold || 0}
                    onChange={(e) => setOpSettings((prev:any) => ({ ...prev, alert_threshold: parseInt(e.target.value) || 0 }))}
                    onBlur={(e) => updateOpSetting('alert_threshold', parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-[#edece9] rounded px-3 py-2 text-[13px] font-bold text-red-600 outline-none focus:border-red-500 transition-all focus:ring-1 focus:ring-red-500/30" 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">분</span>
                </div>
              </div>
            </div>

            {/* 타이머 프리셋 */}
            <div className="pt-2 border-t border-[#edece9]">
              <h4 className="text-[10px] font-black text-[#37352f] tracking-widest mb-3 text-left flex items-center gap-2">
                <Clock size={11} className="text-indigo-650" /> 타이머 프리셋 설정
              </h4>
              <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="space-y-1 text-left">
                    <label className="text-[11px] font-bold text-blue-700 tracking-widest ml-0.5">프리셋 {idx + 1}</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={opSettings.timer_presets[idx] || 0}
                        onChange={(e) => {
                          const newPresets = [...opSettings.timer_presets];
                          newPresets[idx] = parseInt(e.target.value) || 0;
                          setOpSettings((prev:any) => ({ ...prev, timer_presets: newPresets }));
                        }}
                        onBlur={(e) => updateTimerPreset(idx, parseInt(e.target.value) || 0)}
                        className="w-full bg-white border border-[#edece9] rounded px-3 py-2 text-[13px] font-bold text-indigo-700 outline-none focus:border-indigo-500 transition-all focus:ring-1 focus:ring-indigo-500/30"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">분</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-4 border-t border-[#edece9] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <p className="text-[9px] text-gray-400 font-bold italic text-left ml-0.5">
                * 1교시 시작 시각은 시간표의 파랑/주황 색상 구분(3교시 단위)의 기준이 됩니다.
              </p>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open(`/${academyInfo?.slug}/attendance`, '_blank');
                  }
                }}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition-all font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm shrink-0"
              >
                👣 학생 출결 키오스크 화면 바로가기
              </button>
            </div>
          </div>

          {/* 3. 기본 통과 기준 설정 */}
          <div className="bg-white border border-[#e3e2e0] rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-3 pb-2 border-b border-[#e3e2e0]">
              <Shield className="text-emerald-600" size={18} />
              <h3 className="text-xs font-bold text-[#37352f] tracking-widest">기본 통과 기준 설정</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="bg-gray-50 border border-[#edece9] rounded-lg p-3 space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase block">백분율형(100점) 기준</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    value={opSettings.default_score_cut !== undefined ? opSettings.default_score_cut : 80} 
                    onChange={(e) => {
                      setOpSettings((prev:any) => ({ ...prev, default_score_cut: parseInt(e.target.value) || 0 }));
                    }}
                    onBlur={(e) => updateOpSetting('default_score_cut', parseInt(e.target.value) || 0)}
                    className="w-16 bg-transparent border-b border-gray-300 px-1 py-0.5 text-sm font-bold text-[#37352f] outline-none focus:border-blue-500 text-center"
                  />
                  <span className="text-[10px] text-gray-500 font-bold">점 이상 통과</span>
                </div>
              </div>

              <div className="bg-gray-50 border border-[#edece9] rounded-lg p-3 space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase block">개수형 오답 허용 기준</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    value={opSettings.default_count_cut !== undefined ? opSettings.default_count_cut : 2} 
                    onChange={(e) => {
                      setOpSettings((prev:any) => ({ ...prev, default_count_cut: parseInt(e.target.value) || 0 }));
                    }}
                    onBlur={(e) => updateOpSetting('default_count_cut', parseInt(e.target.value) || 0)}
                    className="w-16 bg-transparent border-b border-gray-300 px-1 py-0.5 text-sm font-bold text-[#37352f] outline-none focus:border-blue-500 text-center"
                  />
                  <span className="text-[10px] text-gray-500 font-bold">개 이하 통과</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽 단 (분류 및 링크 영역) */}
        <div className="space-y-6">
          {/* 1. 교재 대분류 설정 */}
          <div className="bg-white border border-[#e3e2e0] rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-3 pb-2 border-b border-[#e3e2e0]">
              <BookOpen className="text-emerald-600" size={18} />
              <h3 className="text-xs font-bold text-[#37352f] uppercase tracking-widest">교재 대분류 설정</h3>
            </div>

            <div className="space-y-3 text-left">
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 bg-gray-50 border border-[#edece9] rounded-lg px-2 min-h-[42px] items-center">
                {(opSettings.textbook_categories || []).map((cat: string) => (
                  <div key={cat} className="flex items-center gap-1 bg-white border border-gray-200 shadow-sm rounded px-2 py-0.5 text-[11px] font-bold text-gray-700 transition-colors shrink-0">
                    <span>{cat}</span>
                    <button 
                      onClick={() => handleRemoveCategory(cat)}
                      className="p-0.5 hover:bg-red-50 hover:text-red-600 rounded text-gray-400 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                {(opSettings.textbook_categories || []).length === 0 && (
                  <span className="text-[10px] font-bold text-gray-450 italic px-1">등록된 대분류가 없습니다.</span>
                )}
              </div>

              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="새 분류 입력 (예: 중1, 기하)"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
                  className="flex-1 bg-white border border-[#edece9] rounded px-3 py-1.5 text-xs font-bold text-gray-800 placeholder:text-gray-300 outline-none focus:border-emerald-500 transition-all focus:ring-1 focus:ring-emerald-500/30"
                />
                <button 
                  onClick={handleAddCategory}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded transition-colors shadow-sm"
                >
                  추가
                </button>
              </div>
            </div>
          </div>

          {/* 2. 학원 외부 링크 설정 */}
          <div className="bg-white border border-[#e3e2e0] rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-3 pb-2 border-b border-[#e3e2e0]">
              <Globe className="text-blue-600" size={18} />
              <h3 className="text-xs font-bold text-[#37352f] uppercase tracking-widest">학원 외부 링크 설정</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              {/* 홈페이지 설정 */}
              <div className="space-y-2 border border-[#edece9] bg-gray-50/30 p-3 rounded-lg">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-0.5">홈페이지 주소</label>
                  <input 
                    type="url"
                    placeholder="https://example.com"
                    value={opSettings.homepage_url || ""}
                    onChange={(e) => setOpSettings((prev:any) => ({ ...prev, homepage_url: e.target.value }))}
                    onBlur={(e) => updateOpSetting('homepage_url', e.target.value)}
                    className="w-full bg-white border border-[#edece9] rounded px-3 py-1.5 text-[12px] font-bold text-blue-700 outline-none focus:border-blue-500 transition-all focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-0.5">버튼 이름</label>
                  <input 
                    type="text"
                    placeholder="홈페이지"
                    value={opSettings.homepage_title || ""}
                    onChange={(e) => setOpSettings((prev:any) => ({ ...prev, homepage_title: e.target.value }))}
                    onBlur={(e) => updateOpSetting('homepage_title', e.target.value || "홈페이지")}
                    className="w-full bg-white border border-[#edece9] rounded px-3 py-1.5 text-[12px] font-bold text-blue-650 outline-none focus:border-blue-500 transition-all focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              {/* 네이버 카페 설정 */}
              <div className="space-y-2 border border-[#edece9] bg-gray-50/30 p-3 rounded-lg">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-0.5">네이버 카페 주소</label>
                  <input 
                    type="url"
                    placeholder="https://cafe.naver.com/..."
                    value={opSettings.naver_cafe_url || ""}
                    onChange={(e) => setOpSettings((prev:any) => ({ ...prev, naver_cafe_url: e.target.value }))}
                    onBlur={(e) => updateOpSetting('naver_cafe_url', e.target.value)}
                    className="w-full bg-white border border-[#edece9] rounded px-3 py-1.5 text-[12px] font-bold text-green-700 outline-none focus:border-green-500 transition-all focus:ring-1 focus:ring-green-500/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-0.5">버튼 이름</label>
                  <input 
                    type="text"
                    placeholder="네이버 카페"
                    value={opSettings.naver_cafe_title || ""}
                    onChange={(e) => setOpSettings((prev:any) => ({ ...prev, naver_cafe_title: e.target.value }))}
                    onBlur={(e) => updateOpSetting('naver_cafe_title', e.target.value || "네이버 카페")}
                    className="w-full bg-white border border-[#edece9] rounded px-3 py-1.5 text-[12px] font-bold text-green-700 outline-none focus:border-green-500 transition-all focus:ring-1 focus:ring-green-500/30"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
