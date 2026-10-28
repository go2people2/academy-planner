'use client';

import { useState } from 'react';
import TextbookMasterTab from './TextbookMasterTab';
import TextbookUnitTab from './TextbookUnitTab';
import TextbookPdfSettings from '../TextbookPdfSettings';

interface TextbookManagementViewProps {
  academyInfo: any;
  masterTextbooks: any[];
  onUpdateAcademyInfo?: (updates: any) => Promise<void> | void;
  isLight?: boolean;
}

export default function TextbookManagementView({
  academyInfo,
  masterTextbooks = [],
  onUpdateAcademyInfo,
  isLight = false,
}: TextbookManagementViewProps) {
  const [subTab, setSubTab] = useState<'master' | 'units' | 'pdfs'>('master');
  const [targetBookcodeForUnits, setTargetBookcodeForUnits] = useState<string | null>(null);

  const handleNavigateToUnits = (bookcode: string) => {
    setTargetBookcodeForUnits(bookcode);
    setSubTab('units');
  };

  return (
    <div className="space-y-6">
      {/* 1. 상단 서브 탭 바 */}
      <div className="flex items-center gap-1 border-b border-gray-800 pb-2">
        <button
          onClick={() => setSubTab('master')}
          className={`px-3 py-1.5 text-xs font-bold rounded-t transition-colors ${
            subTab === 'master'
              ? 'bg-indigo-600 text-white border-b-2 border-indigo-400'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
          }`}
        >
          📚 교재 목록 & 사용 설정
        </button>
        <button
          onClick={() => setSubTab('units')}
          className={`px-3 py-1.5 text-xs font-bold rounded-t transition-colors ${
            subTab === 'units'
              ? 'bg-indigo-600 text-white border-b-2 border-indigo-400'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
          }`}
        >
          📑 단원 및 페이지 관리
        </button>
        <button
          onClick={() => setSubTab('pdfs')}
          className={`px-3 py-1.5 text-xs font-bold rounded-t transition-colors ${
            subTab === 'pdfs'
              ? 'bg-indigo-600 text-white border-b-2 border-indigo-400'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
          }`}
        >
          🔗 교재 PDF / 퀴즈 링크
        </button>
      </div>

      {/* 2. 서브 탭별 뷰 렌더링 */}
      <div>
        {subTab === 'master' && (
          <TextbookMasterTab
            academyInfo={academyInfo}
            masterTextbooks={masterTextbooks}
            isLight={isLight}
            onRefresh={() => onUpdateAcademyInfo?.({})}
            onNavigateToUnits={handleNavigateToUnits}
          />
        )}

        {subTab === 'units' && (
          <TextbookUnitTab
            academyInfo={academyInfo}
            masterTextbooks={masterTextbooks}
            isLight={isLight}
            initialBookcode={targetBookcodeForUnits || undefined}
          />
        )}

        {subTab === 'pdfs' && (
          <TextbookPdfSettings
            academyInfo={academyInfo}
            masterTextbooks={masterTextbooks}
            onUpdateAcademyInfo={onUpdateAcademyInfo}
            isLight={isLight}
          />
        )}
      </div>
    </div>
  );
}
