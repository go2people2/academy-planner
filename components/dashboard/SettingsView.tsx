'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserCircle, Shield, Key, Trash2, UserPlus, Save, X, Loader2,
  Lock, Settings as SettingsIcon, Users, Check, Calendar, TrendingUp,
  Clock, AlertTriangle, BookOpen, Hash
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getInitial } from '@/lib/utils';
import SchoolExamSettings from './SchoolExamSettings';
import NoticeSettings from './settings/NoticeSettings';
import HolidayManagement from './settings/HolidayManagement';
import TestManagement from './settings/TestManagement';
import TeacherManagement from './settings/TeacherManagement';
import AcademyProfile from './settings/AcademyProfile';
import AccountSettings from './settings/AccountSettings';
import SystemManual from './settings/SystemManual';

interface SettingsViewProps {
  teachers: any[];
  students: any[]; // 💡 추가
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

// --- Main SettingsView Component ---

export default function SettingsView({ teachers, students, onAddTeacher, onDeleteTeacher, onUpdateTeacher, onUpdateCurrentUser, onUpdateAcademyInfo, academyInfo, currentUser, noticeDrafts, onNoticeDraftChange }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'teachers' | 'academy' | 'account' | 'notices' | 'tests' | 'holidays' | 'exams' | 'manual'>('teachers');

  // 💡 휴일 관리 함수
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

  // 💡 테스트 관리 상태 및 로직은 TestManagement.tsx로 이동됨

  // 학원 운영 설정 로컬 상태 (제어 컴포넌트용)
  const [opSettings, setOpSettings] = useState({
    first_period_time: "",
    late_threshold: 0,
    alert_threshold: 0,
    timer_presets: [] as number[],
    holidays: [] as any[], // 💡 휴일 필드 추가
    homepage_url: "", // 💡 학원 홈페이지
    homepage_title: "", // 💡 학원 홈페이지 버튼 라벨
    naver_cafe_url: "", // 💡 네이버 카페
    naver_cafe_title: "", // 💡 네이버 카페 버튼 라벨
    textbook_categories: [] as string[] // 💡 교재 카테고리 대분류 추가
  });

  // 데이터 로드 여부 추적
  const [isDataInitialized, setIsDataInitialized] = useState(false);

  const DEFAULT_CATEGORIES = useMemo(() => ['초5', '초6', '중1', '중2', '중3', '공수1', '공수2', '대수', '미적분1', '미적분2', '확통', '기하'], []);

  // academyInfo 변경 시 로컬 상태 동기화 (최초 1회 및 편집 전까지만 업데이트)
  useEffect(() => {
    if (!academyInfo) return;
    
    // 1. 운영 설정 초기화 (최초 1회만)
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
          textbook_categories: dbSettings.textbook_categories || DEFAULT_CATEGORIES
        });
      }
    }

    setIsDataInitialized(true);
  }, [academyInfo, isDataInitialized, DEFAULT_CATEGORIES]);

  const updateOpSetting = async (key: string, value: any) => {
    if (!onUpdateAcademyInfo || !academyInfo) return;

    // 💡 동기식으로 즉시 계산하여 React 배치 처리 및 비동기 스케줄링 시 데이터 유실(Race Condition) 방지
    const nextSettings = { ...opSettings, [key]: value };
    setOpSettings(nextSettings);

    // 💡 즉시 계산된 nextSettings를 서버에 저장
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


  // 💡 탭 정의 배열 (권한별 역할(roles) 기반으로 접근 제어 고도화)
  const TABS = useMemo(() => [
    { id: 'notices', label: 'Notices', color: 'text-amber-500', roles: ['admin', 'master'] },
    { id: 'tests', label: 'Tests', color: 'text-blue-500', roles: ['admin', 'master'] },
    { id: 'exams', label: 'Exams', color: 'text-rose-500', roles: ['admin', 'master'] },
    { id: 'teachers', label: 'Teachers', color: 'text-blue-500', roles: ['admin', 'master'] },
    { id: 'holidays', label: 'Holidays', color: 'text-emerald-500', roles: ['admin', 'master'] },
    { id: 'academy', label: 'Academy Info', color: 'text-blue-500', roles: ['admin', 'master'] },
    { id: 'manual', label: 'Manual', color: 'text-purple-500', roles: ['admin', 'master', 'teacher'] },
    // 💡 My Account는 향후 일반 선생님('teacher')에게도 개방 가능하도록 설계
    { id: 'account', label: 'My Account', color: 'text-blue-500', roles: ['admin', 'master', 'teacher'] }
  ], []);

  const userRole = currentUser?.role || 'teacher';
  const availableTabs = useMemo(() => TABS.filter(tab => tab.roles.includes(userRole)), [TABS, userRole]);

  // 💡 [추가] 현재 선택된 탭이 권한 밖의 탭일 경우 첫 번째 가용 탭으로 자동 보정
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(tab => tab.id === activeTab)) {
      setActiveTab(availableTabs[0].id as any);
    }
  }, [availableTabs, activeTab]);

  // 현재 유저가 볼 수 있는 탭이 없으면 권한 없음 처리 (방어 로직)
  if (availableTabs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        권한이 없습니다. (Access Denied)
      </div>
    );
  }

  return (

    <div className="p-8 max-w-6xl mx-auto space-y-10">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-[4px] bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
            <SettingsIcon className="text-blue-500" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">System Settings</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Configure academy operations</p>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-white/10 gap-8">
        {availableTabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`pb-3 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === tab.id ? tab.color : 'text-gray-600 hover:text-gray-400'}`}
          >
            {tab.label}
            {activeTab === tab.id && <motion.div layoutId="tab-underline" className={`absolute bottom-0 left-0 right-0 h-0.5 ${tab.color.replace('text-', 'bg-')}`} />}
          </button>
        ))}
      </div>

      <div className="pt-4">
        {/* 💡 학원 공지 관리 탭 */}
        {activeTab === 'notices' && (
          <NoticeSettings 
            academyInfo={academyInfo} 
            isAdmin={currentUser.role === 'admin' || currentUser.role === 'master'} 
            onUpdateAcademyInfo={onUpdateAcademyInfo} 
            noticeDrafts={noticeDrafts}
            onNoticeDraftChange={onNoticeDraftChange}
          />
        )}

        {/* 💡 학원 휴일 관리 탭 */}
        {activeTab === 'holidays' && (
          <HolidayManagement 
            holidays={opSettings.holidays || []} 
            onAddHoliday={handleAddHoliday} 
            onDeleteHoliday={handleDeleteHoliday} 
          />
        )}

        {/* 학교별 시험 일정 관리 탭 */}

        {activeTab === 'exams' && (
          <SchoolExamSettings 
            academyInfo={academyInfo}
            students={students}
            onUpdateAcademyInfo={onUpdateAcademyInfo}
          />
        )}

        {/* 💡 테스트 및 정답지 관리 탭 */}
        {activeTab === 'tests' && (
          <TestManagement academyId={academyInfo?.id} />
        )}

        {/* 💡 매뉴얼 관리 탭 */}
        {activeTab === 'manual' && (
          <SystemManual />
        )}

        {/* 선생님 계정 관리 탭 */}
        {activeTab === 'teachers' && (
          <TeacherManagement 
            teachers={teachers} 
            onAddTeacher={onAddTeacher} 
            onDeleteTeacher={onDeleteTeacher} 
            onUpdateTeacher={onUpdateTeacher} 
          />
        )}

        {/* 학원 정보 설정 탭 */}
        {activeTab === 'academy' && (
          <AcademyProfile 
            academyInfo={academyInfo} 
            onUpdateAcademyInfo={onUpdateAcademyInfo} 
            opSettings={opSettings} 
            setOpSettings={setOpSettings} 
            updateOpSetting={updateOpSetting} 
            updateTimerPreset={updateTimerPreset} 
          />
        )}

        {/* 내 계정 설정 탭 */}
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
