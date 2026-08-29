'use client';

import React from 'react';
import { 
  Library, BookOpen, FileText, AlertTriangle, 
  ArrowLeftRight, Activity, ClipboardCheck 
} from 'lucide-react';

export type PackageType = 'materials' | 'assessment' | 'operations';

interface TabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const PACKAGE_TABS: Record<PackageType, TabItem[]> = {
  materials: [
    { id: 'pdfLibrary', label: '교재 PDF 자료실', icon: Library },
    { id: 'digitalLibrary', label: '디지털 수학 서재', icon: BookOpen },
  ],
  assessment: [
    { id: 'exams', label: '기출문제 관리', icon: FileText },
    { id: 'wrongAnswersAdmin', label: '오답노트 관리', icon: BookOpen },
    { id: 'problemErrors', label: '교재 오류 관리', icon: AlertTriangle },
  ],
  operations: [
    { id: 'progress', label: '교재별진도', icon: Activity },
    { id: 'teacherTask', label: '교사 업무 및 설문', icon: ClipboardCheck },
  ],
};

interface PackageSubNavProps {
  packageType: PackageType;
  currentViewMode: string;
  onSelectViewMode: (mode: string) => void;
  isLight?: boolean;
}

export default function PackageSubNav({
  packageType,
  currentViewMode,
  onSelectViewMode,
  isLight = false
}: PackageSubNavProps) {
  const tabs = PACKAGE_TABS[packageType] || [];

  return (
    <div className={`w-full px-6 py-2.5 flex items-center gap-1.5 border-b shrink-0 ${
      isLight ? 'bg-[#f7f7f5] border-[#edece9]' : 'bg-[#0f0f0f] border-white/10'
    }`}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentViewMode === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectViewMode(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[3px] text-xs font-bold transition-all cursor-pointer ${
              isActive
                ? (isLight 
                    ? 'bg-[#0c73e8] text-white shadow-sm font-black' 
                    : 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-black')
                : (isLight 
                    ? 'text-[#37352f]/70 hover:text-[#37352f] hover:bg-[#edece9]' 
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5')
            }`}
          >
            <Icon size={14} className={isActive ? 'text-white' : (isLight ? 'text-[#37352f]/60' : 'text-gray-400')} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
