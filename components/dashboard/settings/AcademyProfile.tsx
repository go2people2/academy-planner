'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Key, Clock, Globe, BookOpen, X, Upload, Trash2, FileImage } from 'lucide-react';

interface AcademyProfileProps {
  academyInfo: any;
  currentUser?: any; // 💡 추가
  onUpdateAcademyInfo?: (updates: any) => Promise<void>;
  opSettings: any;
  setOpSettings: React.Dispatch<React.SetStateAction<any>>;
  updateOpSetting: (key: string, value: any) => Promise<void>;
  updateTimerPreset: (index: number, value: number) => Promise<void>;
}

export default function AcademyProfile({ 
  academyInfo, currentUser, onUpdateAcademyInfo, opSettings, setOpSettings, updateOpSetting, updateTimerPreset 
}: AcademyProfileProps) {
  const [newCategory, setNewCategory] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false); // 로고 업로드 중 로컬 상태
  const isMaster = currentUser?.role === 'master' || currentUser?.role === 'admin';

  // 💡 학원 로고 업로드 핸들러 (Base64 변환 후 업데이트)
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      alert('로고 이미지 용량은 1.5MB 이하여야 합니다.');
      return;
    }

    setIsUploadingLogo(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        if (onUpdateAcademyInfo) {
          await onUpdateAcademyInfo({ logo_url: base64String });
          alert('학원 로고가 성공적으로 등록되어 저장되었습니다.');
        }
      } catch (err) {
        console.error(err);
        alert('로고 저장에 실패했습니다.');
      } finally {
        setIsUploadingLogo(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // 💡 학원 로고 삭제 핸들러 (기본 로고 복원)
  const handleLogoDelete = async () => {
    if (!confirm('등록된 학원 로고를 삭제하고 기본 로고로 복원하시겠습니까?')) return;

    setIsUploadingLogo(true);
    try {
      if (onUpdateAcademyInfo) {
        await onUpdateAcademyInfo({ logo_url: null });
        alert('기본 로고로 복원되었습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('로고 삭제에 실패했습니다.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

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
      className="w-full space-y-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* 💡 왼쪽 단 (핵심 설정 영역) */}
        <div className="space-y-6">
          {/* 1. 학원 기본 설정 */}
          <div className="bg-white/5 border border-white/5 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b border-white/5">
              <Shield className="text-blue-500" size={18} />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">학원 기본 설정</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1 text-left col-span-1">
                <label className="text-[9px] font-black text-blue-200 tracking-widest ml-0.5">학원명</label>
                <div className="px-3 py-2 bg-black/40 border border-white/10 rounded text-[13px] font-black text-white truncate">{academyInfo?.academy_name}</div>
              </div>

              <div className="space-y-1 text-left col-span-1">
                <label className="text-[9px] font-black text-blue-200 tracking-widest ml-0.5">상담 주기</label>
                <div className="relative">
                  <input type="number" defaultValue={academyInfo?.consultation_cycle || 21}
                    onBlur={async (e) => {
                      if (!onUpdateAcademyInfo) return;
                      await onUpdateAcademyInfo({ consultation_cycle: parseInt(e.target.value) || 21 });
                      alert('상담 주기가 변경되었습니다.');
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-1.5 text-[13px] font-black text-blue-400 outline-none focus:border-blue-500 transition-all" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-600">일</span>
                </div>
              </div>

              <div className="space-y-1 text-left col-span-1">
                <label className="text-[9px] font-black text-blue-200 tracking-widest ml-0.5">마스터 패스키</label>
                <div className="relative group">
                  <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600 group-focus-within:text-amber-400 transition-colors" />
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
                    className="w-full bg-black/40 border border-white/10 rounded pl-7 pr-2 py-1.5 text-[13px] font-black text-amber-400 outline-none focus:border-amber-500 transition-all" 
                  />
                </div>
              </div>

              {/* 💡 학원 위치 (지역) 입력 필드 추가 */}
              <div className="space-y-1 text-left col-span-1">
                <label className="text-[9px] font-black text-blue-200 tracking-widest ml-0.5">학원 위치 (지역)</label>
                <input 
                  type="text"
                  placeholder="예: 인천, 서울/강남"
                  value={opSettings.location || ""}
                  onChange={(e) => setOpSettings((prev:any) => ({ ...prev, location: e.target.value }))}
                  onBlur={(e) => updateOpSetting('location', e.target.value.trim())}
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-1.5 text-[13px] font-black text-blue-400 outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* 💡 학원 로고 업로드 및 설정 관리 영역 */}
            <div className="border-t border-white/5 pt-4 space-y-3">
              <label className="text-[10px] font-black text-blue-200 tracking-widest ml-0.5 flex items-center gap-1.5 uppercase">
                <FileImage size={11} className="text-blue-500" /> 학원 로고 이미지 관리
              </label>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-black/20 border border-white/5 rounded-lg p-3">
                {/* 1) 로고 이미지 프리뷰 */}
                <div className="relative w-32 h-14 bg-black/40 border border-white/10 rounded flex items-center justify-center overflow-hidden group shrink-0">
                  {academyInfo?.logo_url ? (
                    <img 
                      src={academyInfo.logo_url} 
                      alt="Academy Logo Preview" 
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-gray-500 italic">기본 로고 사용 중</span>
                  )}
                  {isUploadingLogo && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[10px] font-bold text-white">
                      업로드 중...
                    </div>
                  )}
                </div>

                {/* 2) 로고 변경/삭제 제어 버튼 */}
                <div className="flex-1 w-full flex flex-col gap-1.5 text-left">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-black cursor-pointer transition-colors shadow-sm">
                      <Upload size={12} />
                      <span>로고 이미지 선택</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleLogoChange}
                        disabled={isUploadingLogo}
                        className="hidden" 
                      />
                    </label>
                    {academyInfo?.logo_url && (
                      <button
                        onClick={handleLogoDelete}
                        disabled={isUploadingLogo}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-transparent text-red-400 hover:text-white rounded text-[11px] font-black transition-all"
                      >
                        <Trash2 size={12} />
                        <span>삭제</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[8px] text-gray-500 leading-tight">
                    * 권장 비율: 2:1 가로형 로고(예: 270x130px) / 배경이 투명한 PNG 파일을 사용하시면 일지 배경색(호박색 등)에 가장 예쁘게 녹아납니다. (최대 1.5MB)
                  </p>
                </div>
              </div>
            </div>

            <p className="text-[8px] text-blue-200/50 italic text-left ml-0.5">* 모든 학원 정보 설정은 입력 후 마우스 커서를 입력창 바깥으로 빼면 자동 저장됩니다.</p>
          </div>

          {/* 2. 수업 및 지각 / 타이머 설정 */}
          <div className="bg-white/5 border border-white/5 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b border-white/5">
              <Clock className="text-amber-500" size={18} />
              <h3 className="text-xs font-black text-white tracking-widest">수업 및 지각 설정</h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black text-blue-200 tracking-widest ml-0.5">1교시 시작 시각</label>
                <input 
                  type="time"
                  value={opSettings.first_period_time || ""}
                  onChange={(e) => setOpSettings((prev:any) => ({ ...prev, first_period_time: e.target.value }))}
                  onBlur={(e) => updateOpSetting('first_period_time', e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-[13px] font-black text-amber-500 outline-none focus:border-amber-500 transition-all cursor-pointer [color-scheme:dark]"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black text-blue-200 tracking-widest ml-0.5">지각 기준</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={opSettings.late_threshold || 0}
                    onChange={(e) => setOpSettings((prev:any) => ({ ...prev, late_threshold: parseInt(e.target.value) || 0 }))}
                    onBlur={(e) => updateOpSetting('late_threshold', parseInt(e.target.value) || 0)}
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-[13px] font-black text-blue-400 outline-none focus:border-blue-500 transition-all" 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-600">분</span>
                </div>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black text-blue-200 tracking-widest ml-0.5">연락 알림</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={opSettings.alert_threshold || 0}
                    onChange={(e) => setOpSettings((prev:any) => ({ ...prev, alert_threshold: parseInt(e.target.value) || 0 }))}
                    onBlur={(e) => updateOpSetting('alert_threshold', parseInt(e.target.value) || 0)}
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-[13px] font-black text-red-400 outline-none focus:border-red-500 transition-all" 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-600">분</span>
                </div>
              </div>
            </div>

            {/* 타이머 프리셋 */}
            <div className="pt-2 border-t border-white/5">
              <h4 className="text-[10px] font-black text-white tracking-widest mb-3 text-left flex items-center gap-2">
                <Clock size={11} className="text-indigo-500" /> 타이머 프리셋 설정
              </h4>
              <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="space-y-1 text-left">
                    <label className="text-[9px] font-black text-blue-200 tracking-widest ml-0.5">프리셋 {idx + 1}</label>
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
                        className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-[13px] font-black text-indigo-400 outline-none focus:border-indigo-500 transition-all"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-600">분</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-4 border-t border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <p className="text-[8px] text-blue-200/50 italic text-left ml-0.5">
                * 1교시 시작 시각은 시간표의 파랑/주황 색상 구분(3교시 단위)의 기준이 됩니다.
              </p>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open(`/${academyInfo?.slug}/attendance`, '_blank');
                  }
                }}
                className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded border border-blue-500/20 transition-all font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm shrink-0"
              >
                👣 학생 출결 키오스크 화면 바로가기
              </button>
            </div>
          </div>


        </div>

        {/* 💡 오른쪽 단 (분류 및 링크 영역) */}
        <div className="space-y-6">
          {/* 1. 교재 대분류 설정 */}
          <div className="bg-white/5 border border-white/5 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b border-white/5">
              <BookOpen className="text-emerald-500" size={18} />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">교재 대분류 설정</h3>
            </div>

            <div className="space-y-3 text-left">
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 bg-black/20 border border-white/5 rounded-lg px-2 min-h-[42px] items-center">
                {(opSettings.textbook_categories || []).map((cat: string) => (
                  <div key={cat} className="flex items-center gap-1 bg-white/10 hover:bg-white/15 border border-white/10 rounded px-2 py-0.5 text-[11px] font-bold text-white transition-colors shrink-0">
                    <span>{cat}</span>
                    <button 
                      onClick={() => handleRemoveCategory(cat)}
                      className="p-0.5 hover:bg-red-500/20 rounded text-white/50 hover:text-red-400 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                {(opSettings.textbook_categories || []).length === 0 && (
                  <span className="text-[10px] font-bold text-gray-500 italic px-1">등록된 대분류가 없습니다.</span>
                )}
              </div>

              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="새 분류 입력 (예: 중1, 기하)"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
                  className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-1.5 text-xs font-bold text-white placeholder:text-white/20 outline-none focus:border-emerald-500 transition-all"
                />
                <button 
                  onClick={handleAddCategory}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded transition-colors"
                >
                  추가
                </button>
              </div>
            </div>
          </div>

          {/* 2. 학원 외부 링크 설정 */}
          <div className="bg-white/5 border border-white/5 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b border-white/5">
              <Globe className="text-blue-500" size={18} />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">학원 외부 링크 설정</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              {/* 홈페이지 설정 */}
              <div className="space-y-2 border border-white/5 bg-white/[0.01] p-3 rounded-lg">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-0.5">홈페이지 주소</label>
                  <input 
                    type="url"
                    placeholder="https://example.com"
                    value={opSettings.homepage_url || ""}
                    onChange={(e) => setOpSettings((prev:any) => ({ ...prev, homepage_url: e.target.value }))}
                    onBlur={(e) => updateOpSetting('homepage_url', e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-1.5 text-[12px] font-bold text-blue-400 outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-0.5">버튼 이름</label>
                  <input 
                    type="text"
                    placeholder="홈페이지"
                    value={opSettings.homepage_title || ""}
                    onChange={(e) => setOpSettings((prev:any) => ({ ...prev, homepage_title: e.target.value }))}
                    onBlur={(e) => updateOpSetting('homepage_title', e.target.value || "홈페이지")}
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-1.5 text-[12px] font-bold text-blue-300 outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* 네이버 카페 설정 */}
              <div className="space-y-2 border border-white/5 bg-white/[0.01] p-3 rounded-lg">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-0.5">네이버 카페 주소</label>
                  <input 
                    type="url"
                    placeholder="https://cafe.naver.com/..."
                    value={opSettings.naver_cafe_url || ""}
                    onChange={(e) => setOpSettings((prev:any) => ({ ...prev, naver_cafe_url: e.target.value }))}
                    onBlur={(e) => updateOpSetting('naver_cafe_url', e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-1.5 text-[12px] font-bold text-green-400 outline-none focus:border-green-500 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-0.5">버튼 이름</label>
                  <input 
                    type="text"
                    placeholder="네이버 카페"
                    value={opSettings.naver_cafe_title || ""}
                    onChange={(e) => setOpSettings((prev:any) => ({ ...prev, naver_cafe_title: e.target.value }))}
                    onBlur={(e) => updateOpSetting('naver_cafe_title', e.target.value || "네이버 카페")}
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-1.5 text-[12px] font-bold text-green-300 outline-none focus:border-green-500 transition-all"
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
