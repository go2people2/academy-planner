'use client';

import { ExternalLink, HelpCircle, FileText, Zap, Lightbulb } from 'lucide-react';
import { ResourceLinkItem } from '../learningBuilder/RelatedResourcesSection';

interface StudentResourceLinksProps {
  resources: ResourceLinkItem[];
  baseServerUrl: string;
  onOpenResource: (fullUrl: string, title: string) => void;
  isLight?: boolean;
}

export default function StudentResourceLinks({
  resources = [],
  baseServerUrl,
  onOpenResource,
  isLight = false
}: StudentResourceLinksProps) {
  if (!resources || resources.length === 0) return null;

  const getFullUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = (baseServerUrl || '').replace(/\/+$/, '');
    const rel = path.startsWith('/') ? path : `/${path}`;
    return `${base}${rel}`;
  };

  return (
    <div className={`p-4 rounded-md border space-y-2.5 ${
      isLight ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-900/80 border-amber-500/20'
    }`}>
      <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
        <Lightbulb size={15} />
        <span>💡 선생님이 추천하는 연계 보충 학습 & 관련 자료</span>
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {resources.map((item) => {
          const fullUrl = getFullUrl(item.path);
          const isPrereq = item.type === 'prerequisite';
          const isQuiz = item.type === 'quiz';
          const isPdf = item.type === 'pdf';

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenResource(fullUrl, item.title)}
              className={`p-2.5 rounded text-left transition-all border flex items-center justify-between gap-2 shadow-sm ${
                isPrereq
                  ? isLight ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-900' : 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-300'
                  : isQuiz
                    ? isLight ? 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-900' : 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30 text-purple-300'
                    : isPdf
                      ? isLight ? 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-900' : 'bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/30 text-sky-300'
                      : isLight ? 'bg-amber-100/60 hover:bg-amber-200/60 border-amber-250 text-amber-900' : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300'
              }`}
            >
              <div className="space-y-0.5">
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-white/40 dark:bg-black/40 shrink-0">
                  {isPrereq ? '🔴 선행보충' : isQuiz ? '🎯 추천퀴즈' : isPdf ? '📖 단원PDF' : '💡 선생님팁'}
                </span>
                <p className="text-xs font-bold line-clamp-1">{item.title || '연관 학습 자료'}</p>
              </div>
              <ExternalLink size={13} className="shrink-0 opacity-70" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
