'use client';

import { useState, useEffect, useMemo } from 'react';
import { Library, Layers, Wrench, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import TextbookModuleBuilder from './learningBuilder/TextbookModuleBuilder';
import StudentBookDrawer from './studentPortal/StudentBookDrawer';
import StudentCoursePlayer from './studentPortal/StudentCoursePlayer';
import { UnitModuleData } from './learningBuilder/TextbookModuleBuilder';

interface DigitalMathLibraryViewProps {
  masterTextbooks: any[];
  academyInfo: any;
  currentUser?: any;
  isLight?: boolean;
}

export default function DigitalMathLibraryView({
  masterTextbooks = [],
  academyInfo,
  currentUser,
  isLight = false
}: DigitalMathLibraryViewProps) {
  const [activeTab, setActiveTab] = useState<'portal' | 'builder'>('portal');
  const [selectedBookcode, setSelectedBookcode] = useState<string | null>(null);
  const [builtModules, setBuiltModules] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  // 내부망 기본 서버 주소
  const baseServerUrl = useMemo(() => {
    if (academyInfo?.operation_settings?.base_server_url) {
      return academyInfo.operation_settings.base_server_url;
    }
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ams_base_server_url') || 'http://192.168.0.207:8080';
    }
    return 'http://192.168.0.207:8080';
  }, [academyInfo]);

  // 학습 모듈 불러오기
  useEffect(() => {
    const loadModules = async () => {
      if (!academyInfo?.id) return;
      setIsLoading(true);
      try {
        const session = await supabase.auth.getSession();
        const token = session.data?.session?.access_token;
        if (!token) return;

        const res = await fetch(`/api/learning-hub?academyId=${academyInfo.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          setBuiltModules(data.modules || {});
        }
      } catch (e) {
        console.error('Failed to load learning modules:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadModules();
  }, [academyInfo?.id]);

  // 첫 번째 교재 자동 선택
  useEffect(() => {
    if (!selectedBookcode && masterTextbooks.length > 0) {
      setSelectedBookcode(masterTextbooks[0].bookcode);
    }
  }, [masterTextbooks, selectedBookcode]);

  // 선택된 교재 객체
  const currentBook = useMemo(() => {
    return masterTextbooks.find(b => b.bookcode === selectedBookcode);
  }, [masterTextbooks, selectedBookcode]);

  // 단원 목록
  const units = useMemo(() => {
    if (!currentBook) return [];
    if (Array.isArray(currentBook.units) && currentBook.units.length > 0) return currentBook.units;
    if (Array.isArray(currentBook.unit_list) && currentBook.unit_list.length > 0) return currentBook.unit_list;
    return Array.from({ length: 8 }, (_, i) => ({ title: `단원 ${i + 1}` }));
  }, [currentBook]);

  const unitsData = builtModules[selectedBookcode || ''] || {};

  // 학생 서재 포털에 노출할 빌드 완료(영상 연동) 교재 목록
  const portalBooks = useMemo(() => {
    const builtOnly = masterTextbooks.filter(b => {
      const moduleData = builtModules[b.bookcode];
      if (!moduleData) return false;
      if (moduleData.units) {
        const hasUnitVid = Object.values(moduleData.units).some((u: any) => !!u?.videoPath);
        if (hasUnitVid) return true;
      }
      if (moduleData.pages) {
        const hasPageVid = Object.values(moduleData.pages).some((p: any) => p?.problems?.some((pr: any) => !!pr?.videoPath));
        if (hasPageVid) return true;
      }
      return false;
    });
    return builtOnly.length > 0 ? builtOnly : masterTextbooks;
  }, [masterTextbooks, builtModules]);

  return (
    <div className={`p-6 space-y-5 min-h-screen ${
      isLight ? 'bg-[#f7f6f3] text-gray-800' : 'bg-[#0f172a] text-gray-100'
    }`}>
      {/* 🏛️ 상단 타이틀 & 탭 컨트롤 */}
      <div className={`p-5 rounded-md border shadow-sm ${
        isLight ? 'bg-white border-gray-200' : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-md bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <Library size={24} />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight flex items-center gap-2">
                <span>📚 디지털 수학 서재</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  LMS Hub
                </span>
              </h1>
              <p className="text-xs opacity-75 mt-0.5">
                학생 교재 서랍을 통한 원스톱 동영상 시청, 타임스탬프 파트 바로가기 및 선생님 연계 보충 링크
              </p>
            </div>
          </div>

          {/* 탭 버튼 */}
          <div className="flex items-center gap-1.5 p-1 rounded-md bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('portal')}
              className={`px-3.5 py-1.5 rounded text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'portal'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Layers size={14} />
              <span>📚 학생 서재 포털</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('builder')}
              className={`px-3.5 py-1.5 rounded text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'builder'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Wrench size={14} />
              <span>🛠️ 교재 빌더 (선생님)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 탭 1: 학생 서재 포털 */}
      {activeTab === 'portal' && (
        <div className="space-y-5">
          <StudentBookDrawer
            assignedBooks={portalBooks}
            builtModules={builtModules}
            selectedBookcode={selectedBookcode}
            onSelectBook={(code: string) => setSelectedBookcode(code)}
            isLight={isLight}
          />

          {isLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-xs font-bold text-gray-400">
              <Loader2 size={18} className="animate-spin text-indigo-500" />
              <span>교재 학습장 불러오는 중...</span>
            </div>
          ) : !selectedBookcode ? (
            <div className="text-center py-16 text-xs text-gray-400 font-bold italic">
              상단 서랍에서 공부할 교재를 선택해 주세요.
            </div>
          ) : (
            <StudentCoursePlayer
              bookTitle={currentBook?.title || '교재'}
              units={units}
              bookModule={builtModules[selectedBookcode || ''] || {}}
              baseServerUrl={baseServerUrl}
              isLight={isLight}
            />
          )}
        </div>
      )}

      {/* 탭 2: 선생님 저작 빌더 */}
      {activeTab === 'builder' && (
        <TextbookModuleBuilder
          masterTextbooks={masterTextbooks}
          academyInfo={academyInfo}
          isLight={isLight}
        />
      )}
    </div>
  );
}
