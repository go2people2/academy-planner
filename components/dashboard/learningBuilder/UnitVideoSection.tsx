'use client';

import { Video, Film } from 'lucide-react';

interface UnitVideoSectionProps {
  unitIdx: number;
  unitName: string;
  customUnitName?: string;
  videoPath: string;
  baseServerUrl: string;
  onChangeUnitName: (name: string) => void;
  onChangeVideoPath: (path: string) => void;
  isLight?: boolean;
}

export default function UnitVideoSection({
  unitIdx,
  unitName,
  customUnitName = '',
  videoPath,
  baseServerUrl,
  onChangeUnitName,
  onChangeVideoPath,
  isLight = false
}: UnitVideoSectionProps) {
  return (
    <div className={`p-3.5 rounded-md border space-y-2.5 ${
      isLight ? 'bg-indigo-50/40 border-indigo-150' : 'bg-slate-900 border-indigo-500/20'
    }`}>
      {/* 단원 이름 커스텀 수정 */}
      <div className="flex items-center gap-2">
        <span className="font-bold text-xs text-indigo-600 dark:text-indigo-300 flex items-center gap-1.5 shrink-0">
          <Film size={14} />
          <span>{unitIdx + 1}단원 명칭:</span>
        </span>
        <input
          type="text"
          value={customUnitName !== undefined ? customUnitName : unitName}
          onChange={(e) => onChangeUnitName(e.target.value)}
          placeholder={unitName || `단원 ${unitIdx + 1} 명칭`}
          className={`flex-1 px-2.5 py-1 text-xs rounded border outline-none font-bold ${
            isLight ? 'bg-white border-indigo-200 text-gray-800' : 'bg-black/30 border-indigo-500/30 text-white'
          }`}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-indigo-500 shrink-0 flex items-center gap-1">
          <Video size={12} />
          <span>영상 상대경로:</span>
        </span>

        <div className="flex items-center flex-1 rounded border overflow-hidden">
          <span className={`px-2.5 py-1 text-[10px] font-mono border-r opacity-70 shrink-0 ${
            isLight ? 'bg-gray-100 border-gray-250 text-gray-700' : 'bg-slate-800 border-white/10 text-slate-400'
          }`}>
            {baseServerUrl}
          </span>
          <input 
            type="text"
            value={videoPath}
            onChange={(e) => onChangeVideoPath(e.target.value)}
            placeholder="/video/m_concept/unit1_lecture.mp4"
            className={`w-full px-2.5 py-1 text-xs outline-none font-bold placeholder:text-gray-400 font-mono ${
              isLight ? 'bg-white text-gray-800' : 'bg-black/30 text-white'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
