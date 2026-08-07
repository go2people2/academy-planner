'use client';

import { Link2, Plus, Trash2, HelpCircle, FileText, Zap } from 'lucide-react';

export interface ResourceLinkItem {
  id: string;
  type: 'prerequisite' | 'quiz' | 'pdf' | 'tip';
  title: string;
  path: string;
}

interface RelatedResourcesSectionProps {
  resources: ResourceLinkItem[];
  baseServerUrl: string;
  onAddResource: () => void;
  onUpdateResource: (id: string, field: keyof ResourceLinkItem, val: string) => void;
  onDeleteResource: (id: string) => void;
  isLight?: boolean;
}

export default function RelatedResourcesSection({
  resources = [],
  baseServerUrl,
  onAddResource,
  onUpdateResource,
  onDeleteResource,
  isLight = false
}: RelatedResourcesSectionProps) {
  return (
    <div className={`p-3.5 rounded-md border space-y-3 ${
      isLight ? 'bg-amber-50/40 border-amber-200' : 'bg-slate-900 border-amber-500/20'
    }`}>
      <div className="flex items-center justify-between">
        <span className="font-bold text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <Link2 size={14} />
          <span>💡 하단 선행 보충 학습 & 연관 링크 동적 구성</span>
        </span>

        <button
          type="button"
          onClick={onAddResource}
          className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 border transition-all ${
            isLight
              ? 'bg-amber-100 hover:bg-amber-600 hover:text-white text-amber-800 border-amber-300'
              : 'bg-amber-500/20 hover:bg-amber-600 hover:text-white text-amber-300 border-amber-500/30'
          }`}
        >
          <Plus size={12} />
          <span>+ 연계 링크 추가</span>
        </button>
      </div>

      {resources.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic py-2">
          선행 추천 영상이나 퀴즈 링크가 없습니다. 위 [연계 링크 추가] 버튼을 눌러보세요.
        </p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar-v">
          {resources.map((item) => (
            <div 
              key={item.id}
              className={`p-2 rounded border flex flex-col sm:flex-row items-stretch sm:items-center gap-2 ${
                isLight ? 'bg-white border-amber-200' : 'bg-slate-950/60 border-amber-500/20'
              }`}
            >
              {/* 유형 선택 */}
              <select
                value={item.type}
                onChange={(e) => onUpdateResource(item.id, 'type', e.target.value)}
                className={`text-[10px] font-bold px-2 py-1 rounded border outline-none ${
                  isLight ? 'bg-gray-50 border-gray-250 text-gray-800' : 'bg-slate-900 border-slate-700 text-amber-300'
                }`}
              >
                <option value="prerequisite">🔴 선행 보충</option>
                <option value="quiz">🎯 추천 퀴즈</option>
                <option value="pdf">📖 단원 PDF</option>
                <option value="tip">💡 선생님 팁</option>
              </select>

              {/* 링크 제목 */}
              <input
                type="text"
                value={item.title}
                onChange={(e) => onUpdateResource(item.id, 'title', e.target.value)}
                placeholder="예: 기초 부족시? 중1-1 방정식 개념 보충"
                className={`text-xs font-bold px-2.5 py-1 rounded border outline-none flex-1 ${
                  isLight ? 'bg-gray-50 border-gray-200 text-gray-800' : 'bg-black/30 border-slate-700 text-white'
                }`}
              />

              {/* 상대 경로 */}
              <input
                type="text"
                value={item.path}
                onChange={(e) => onUpdateResource(item.id, 'path', e.target.value)}
                placeholder="/video/basic_lecture.mp4"
                className={`text-xs font-mono px-2.5 py-1 rounded border outline-none w-full sm:w-48 ${
                  isLight ? 'bg-gray-50 border-gray-200 text-gray-800' : 'bg-black/30 border-slate-700 text-white'
                }`}
              />

              {/* 삭제 버튼 */}
              <button
                type="button"
                onClick={() => onDeleteResource(item.id)}
                className={`p-1.5 rounded transition-all border shrink-0 text-red-500 hover:bg-red-500 hover:text-white ${
                  isLight ? 'border-red-200 bg-red-50/50' : 'border-red-500/30 bg-red-500/10'
                }`}
                title="삭제"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
