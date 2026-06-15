'use client';

import { motion } from 'framer-motion';
import { Shield, Key, Clock, Globe } from 'lucide-react';

interface AcademyProfileProps {
  academyInfo: any;
  onUpdateAcademyInfo?: (updates: any) => Promise<void>;
  opSettings: any;
  setOpSettings: React.Dispatch<React.SetStateAction<any>>;
  updateOpSetting: (key: string, value: any) => Promise<void>;
  updateTimerPreset: (index: number, value: number) => Promise<void>;
}

export default function AcademyProfile({ 
  academyInfo, onUpdateAcademyInfo, opSettings, setOpSettings, updateOpSetting, updateTimerPreset 
}: AcademyProfileProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="max-w-2xl bg-white/5 border border-white/5 rounded-[4px] p-8 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="text-blue-500" size={20} />
          <h3 className="text-sm font-black text-white uppercase tracking-widest">학원 기본 설정</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-200 tracking-widest ml-1">학원명</label>
            <div className="px-4 py-2 bg-black/40 border border-white/10 rounded-[2px] text-sm font-black text-white">{academyInfo?.academy_name}</div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-200 tracking-widest ml-1">상담 주기</label>
            <div className="relative">
              <input type="number" defaultValue={academyInfo?.consultation_cycle || 21}
                onBlur={async (e) => {
                  if (!onUpdateAcademyInfo) return;
                  await onUpdateAcademyInfo({ consultation_cycle: parseInt(e.target.value) });
                  alert('상담 주기가 변경되었습니다.');
                }}
                className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-2 text-sm font-black text-blue-400 outline-none focus:border-blue-500 transition-all" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">일</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-200 tracking-widest ml-1">마스터 패스키</label>
            <div className="relative group">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 group-focus-within:text-amber-400 transition-colors" />
              <input 
                type="text" 
                maxLength={4}
                defaultValue={academyInfo?.student_passkey || '2324'}
                placeholder="4자리 숫자"
                onBlur={async (e) => {
                  if (!onUpdateAcademyInfo) return;
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  if (val.length !== 4) { alert('패스키는 숫자 4자리여야 합니다.'); return; }
                  await onUpdateAcademyInfo({ student_passkey: val });
                  alert('학생 페이지 패스키가 변경되었습니다.');
                }}
                className="w-full bg-black/40 border border-white/10 rounded-[2px] pl-9 pr-3 py-2 text-sm font-black text-amber-400 outline-none focus:border-amber-500 transition-all" 
              />
            </div>
            <p className="text-[9px] text-blue-200/70 italic ml-1 mt-1">* 모든 학생 페이지 접속용</p>
          </div>
        </div>

        <div className="pt-6 border-t border-white/5 space-y-6">
          <div className="flex items-center gap-3">
            <Clock className="text-amber-500" size={20} />
            <h3 className="text-sm font-black text-white tracking-widest">수업 및 지각 설정</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-blue-200 tracking-widest ml-1">1교시 시작 시각</label>
              <input 
                type="time"
                value={opSettings.first_period_time || ""}
                onChange={(e) => setOpSettings((prev:any) => ({ ...prev, first_period_time: e.target.value }))}
                onBlur={(e) => updateOpSetting('first_period_time', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm font-black text-amber-500 outline-none focus:border-amber-500 transition-all cursor-pointer [color-scheme:dark]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-blue-200 tracking-widest ml-1">지각 기준 (분)</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={opSettings.late_threshold || 0}
                  onChange={(e) => setOpSettings((prev:any) => ({ ...prev, late_threshold: parseInt(e.target.value) || 0 }))}
                  onBlur={(e) => updateOpSetting('late_threshold', parseInt(e.target.value) || 0)}
                  className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm font-black text-blue-400 outline-none focus:border-blue-500 transition-all" 
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">분</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-blue-200 tracking-widest ml-1">연락 알림 (분)</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={opSettings.alert_threshold || 0}
                  onChange={(e) => setOpSettings((prev:any) => ({ ...prev, alert_threshold: parseInt(e.target.value) || 0 }))}
                  onBlur={(e) => updateOpSetting('alert_threshold', parseInt(e.target.value) || 0)}
                  className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm font-black text-red-400 outline-none focus:border-red-500 transition-all" 
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">분</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5">
            <h4 className="text-[11px] font-black text-white tracking-widest mb-4 flex items-center gap-2">
              <Clock size={12} className="text-indigo-500" /> 타이머 프리셋 설정
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="space-y-1">
                  <label className="text-[10px] font-black text-blue-200 tracking-widest ml-1">프리셋 {idx + 1} (분)</label>
                  <input 
                    type="number" 
                    value={opSettings.timer_presets[idx] || 0}
                    onChange={(e) => {
                      const newPresets = [...opSettings.timer_presets];
                      newPresets[idx] = parseInt(e.target.value) || 0;
                      setOpSettings((prev:any) => ({ ...prev, timer_presets: newPresets }));
                    }}
                    onBlur={(e) => updateTimerPreset(idx, parseInt(e.target.value) || 0)}
                    className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm font-black text-indigo-400 outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              ))}
            </div>
          </div>


          <p className="text-[9px] text-gray-600 italic">
            * 1교시 시작 시각은 시간표의 파랑/주황 색상 구분(3교시 단위)의 기준이 됩니다.<br/>
            * 지각 및 연락 알림 설정은 수업 시작 (LIVE) 모드에서 실시간으로 반영됩니다.
          </p>
        </div>

        {/* 💡 학원 외부 링크 설정 */}
        <div className="pt-6 border-t border-white/5 space-y-6">
          <div className="flex items-center gap-3">
            <Globe className="text-blue-500" size={20} />
            <h3 className="text-sm font-black text-white uppercase tracking-widest">학원 외부 링크 설정 (학생 페이지 노출)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-left">
            {/* 홈페이지 설정 */}
            <div className="space-y-4 border border-white/5 bg-white/[0.01] p-4 rounded">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">학원 홈페이지 주소</label>
                <input 
                  type="url"
                  placeholder="https://example.com"
                  value={opSettings.homepage_url || ""}
                  onChange={(e) => setOpSettings((prev:any) => ({ ...prev, homepage_url: e.target.value }))}
                  onBlur={(e) => updateOpSetting('homepage_url', e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm font-black text-blue-400 outline-none focus:border-blue-500 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">홈페이지 버튼 이름</label>
                <input 
                  type="text"
                  placeholder="홈페이지"
                  value={opSettings.homepage_title || ""}
                  onChange={(e) => setOpSettings((prev:any) => ({ ...prev, homepage_title: e.target.value }))}
                  onBlur={(e) => updateOpSetting('homepage_title', e.target.value || "홈페이지")}
                  className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm font-black text-blue-300 outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* 네이버 카페 설정 */}
            <div className="space-y-4 border border-white/5 bg-white/[0.01] p-4 rounded">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">네이버 카페 주소</label>
                <input 
                  type="url"
                  placeholder="https://cafe.naver.com/..."
                  value={opSettings.naver_cafe_url || ""}
                  onChange={(e) => setOpSettings((prev:any) => ({ ...prev, naver_cafe_url: e.target.value }))}
                  onBlur={(e) => updateOpSetting('naver_cafe_url', e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm font-black text-green-400 outline-none focus:border-green-500 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">네이버 카페 버튼 이름</label>
                <input 
                  type="text"
                  placeholder="네이버 카페"
                  value={opSettings.naver_cafe_title || ""}
                  onChange={(e) => setOpSettings((prev:any) => ({ ...prev, naver_cafe_title: e.target.value }))}
                  onBlur={(e) => updateOpSetting('naver_cafe_title', e.target.value || "네이버 카페")}
                  className="w-full bg-black/40 border border-white/10 rounded-[2px] px-4 py-3 text-sm font-black text-green-300 outline-none focus:border-green-500 transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
