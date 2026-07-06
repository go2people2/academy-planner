'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon
} from 'lucide-react';
import SchoolExamSettings from './SchoolExamSettingsLight';
import NoticeSettings from '../settings/light/NoticeSettingsLight';
import HolidayManagement from '../settings/light/HolidayManagementLight';
import TeacherManagement from '../settings/light/TeacherManagementLight';
import AcademyProfile from '../settings/light/AcademyProfileLight';
import AccountSettings from '../settings/light/AccountSettingsLight';
import SystemManual from '../settings/light/SystemManualLight';

interface SettingsViewProps {
  teachers: any[];
  students: any[];
  onAddTeacher: (data: any) => Promise<void>;
  onDeleteTeacher: (id: string) => Promise<void>;
  onUpdateTeacher: (id: string, updates: any) => Promise<void>;
  onUpdateCurrentUser: (updates: any) => void;
  onUpdateAcademyInfo?: (updates: any) => Promise<void>;
  academyInfo: any;
  currentUser: any;
  noticeDrafts: Record<string, string>;
  onNoticeDraftChange: (key: string, value: string) => void;
}

export default function SettingsViewLight({ teachers, students, onAddTeacher, onDeleteTeacher, onUpdateTeacher, onUpdateCurrentUser, onUpdateAcademyInfo, academyInfo, currentUser, noticeDrafts, onNoticeDraftChange }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'teachers' | 'academy' | 'account' | 'notices' | 'holidays' | 'exams' | 'manual'>('teachers');

  // 학원 운영 설정 로컬 상태
  const [opSettings, setOpSettings] = useState({
    first_period_time: "",
    late_threshold: 0,
    alert_threshold: 0,
    timer_presets: [] as number[],
    holidays: [] as any[],
    homepage_url: "",
    homepage_title: "",
    naver_cafe_url: "",
    naver_cafe_title: "",
    textbook_categories: [] as string[],
    location: ""
  });

  const [isDataInitialized, setIsDataInitialized] = useState(false);
  const DEFAULT_CATEGORIES = useMemo(() => ['초5', '초6', '중1', '중2', '중3', '공수1', '공수2', '대수', '미적분1', '미적분2', '확통', '기하'], []);

  useEffect(() => {
    if (!academyInfo) return;
    
    if (!isDataInitialized) {
      const dbSettings = academyInfo.operation_settings;
      if (dbSettings) {
        setOpSettings({
          first_period_time: dbSettings.first_period_time || "",
          late_threshold: dbSettings.late_threshold ?? 10,
          alert_threshold: dbSettings.alert_threshold ?? 15,
          timer_presets: dbSettings.timer_presets || [30, 60, 90],
          holidays: dbSettings.holidays || [],
          homepage_url: dbSettings.homepage_url || "",
          homepage_title: dbSettings.homepage_title || "홈페이지",
          naver_cafe_url: dbSettings.naver_cafe_url || "",
          naver_cafe_title: dbSettings.naver_cafe_title || "네이버 카페",
          textbook_categories: dbSettings.textbook_categories || DEFAULT_CATEGORIES,
          location: dbSettings.location || ""
        });
      }
    }
    setIsDataInitialized(true);
  }, [academyInfo, isDataInitialized, DEFAULT_CATEGORIES]);

  const updateOpSetting = async (key: string, value: any) => {
    if (!onUpdateAcademyInfo || !academyInfo) return;
    const nextSettings = { ...opSettings, [key]: value };
    setOpSettings(nextSettings);
    await onUpdateAcademyInfo({ operation_settings: nextSettings });
  };

  const updateTimerPreset = async (index: number, value: number) => {
    if (!onUpdateAcademyInfo || !academyInfo) return;
    const newPresets = [...opSettings.timer_presets];
    newPresets[index] = value;
    const nextSettings = { ...opSettings, timer_presets: newPresets };
    setOpSettings(nextSettings);
    await onUpdateAcademyInfo({ operation_settings: nextSettings });
  };

  const handleAddHoliday = async (date: string, note: string) => {
    if (opSettings.holidays.some((h: any) => h.date === date)) {
      alert('이미 등록된 휴일입니다.');
      return;
    }
    const updatedHolidays = [...opSettings.holidays, { date, note }].sort((a, b) => a.date.localeCompare(b.date));
    await updateOpSetting('holidays', updatedHolidays);
  };

  const handleDeleteHoliday = async (date: string) => {
    const updatedHolidays = opSettings.holidays.filter((h: any) => h.date !== date);
    await updateOpSetting('holidays', updatedHolidays);
  };

  const TABS = useMemo(() => [
    { id: 'notices', label: 'Notices', color: 'text-amber-600', activeBg: 'bg-amber-500', roles: ['admin', 'master'] },
    { id: 'exams', label: 'Exams', color: 'text-rose-600', activeBg: 'bg-rose-500', roles: ['admin', 'master'] },
    { id: 'teachers', label: 'Teachers', color: 'text-blue-600', activeBg: 'bg-blue-500', roles: ['admin', 'master'] },
    { id: 'holidays', label: 'Holidays', color: 'text-emerald-600', activeBg: 'bg-emerald-500', roles: ['admin', 'master'] },
    { id: 'academy', label: 'Academy Info', color: 'text-blue-650', activeBg: 'bg-blue-650', roles: ['admin', 'master'] },
    { id: 'manual', label: 'Manual', color: 'text-purple-600', activeBg: 'bg-purple-500', roles: ['admin', 'master', 'teacher'] },
    { id: 'account', label: 'My Account', color: 'text-slate-700', activeBg: 'bg-slate-700', roles: ['admin', 'master', 'teacher'] }
  ], []);

  const userRole = currentUser?.role || 'teacher';
  const availableTabs = useMemo(() => TABS.filter(tab => tab.roles.includes(userRole)), [TABS, userRole]);

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(tab => tab.id === activeTab)) {
      setActiveTab(availableTabs[0].id as any);
    }
  }, [availableTabs, activeTab]);

  if (availableTabs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500 font-bold">
        권한이 없습니다. (Access Denied)
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10 bg-[#fbfbfa] min-h-screen rounded-lg border border-[#e3e2e0]">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200">
            <SettingsIcon className="text-blue-600" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#37352f] uppercase tracking-tight">System Settings</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Configure academy operations</p>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-[#e3e2e0] gap-8">
        {availableTabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`pb-3 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${
              activeTab === tab.id ? tab.color : 'text-gray-400 hover:text-[#37352f]'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div 
                layoutId="tab-underline-light" 
                className={`absolute bottom-0 left-0 right-0 h-0.5 ${tab.activeBg}`} 
              />
            )}
          </button>
        ))}
      </div>

      <div className="pt-4">
        {activeTab === 'notices' && (
          <NoticeSettings 
            academyInfo={academyInfo} 
            isAdmin={currentUser.role === 'admin' || currentUser.role === 'master'} 
            onUpdateAcademyInfo={onUpdateAcademyInfo} 
            noticeDrafts={noticeDrafts}
            onNoticeDraftChange={onNoticeDraftChange}
          />
        )}

        {activeTab === 'holidays' && (
          <HolidayManagement 
            holidays={opSettings.holidays || []} 
            onAddHoliday={handleAddHoliday} 
            onDeleteHoliday={handleDeleteHoliday} 
          />
        )}

        {activeTab === 'exams' && (
          <SchoolExamSettings 
            academyInfo={academyInfo}
            students={students}
            onUpdateAcademyInfo={onUpdateAcademyInfo}
          />
        )}

        {activeTab === 'manual' && (
          <SystemManual />
        )}

        {activeTab === 'teachers' && (
          <TeacherManagement 
            teachers={teachers} 
            onAddTeacher={onAddTeacher} 
            onDeleteTeacher={onDeleteTeacher} 
            onUpdateTeacher={onUpdateTeacher} 
          />
        )}

        {activeTab === 'academy' && (
          <AcademyProfile 
            academyInfo={academyInfo} 
            currentUser={currentUser}
            onUpdateAcademyInfo={onUpdateAcademyInfo} 
            opSettings={opSettings} 
            setOpSettings={setOpSettings} 
            updateOpSetting={updateOpSetting} 
            updateTimerPreset={updateTimerPreset} 
          />
        )}

        {activeTab === 'account' && (
          <AccountSettings 
            currentUser={currentUser} 
            onUpdateCurrentUser={onUpdateCurrentUser} 
            academyInfo={academyInfo} 
            onUpdateAcademyInfo={onUpdateAcademyInfo} 
          />
        )}
      </div>
    </div>
  );
}
