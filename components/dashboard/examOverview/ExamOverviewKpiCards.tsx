'use client';

import React from 'react';
import { PlayCircle, AlertCircle, Clock, BookOpen, HelpCircle } from 'lucide-react';
import { CardFilterType, KpiCounts } from './types';

interface ExamOverviewKpiCardsProps {
  kpiCounts: KpiCounts;
  activeCardFilter: CardFilterType;
  onToggleCard: (type: CardFilterType) => void;
  isLight?: boolean;
}

export const ExamOverviewKpiCards: React.FC<ExamOverviewKpiCardsProps> = ({
  kpiCounts,
  activeCardFilter,
  onToggleCard,
  isLight = false
}) => {
  const cards: Array<{
    type: CardFilterType;
    label: string;
    count: number;
    subtext: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    accentColor: string;
    activeBorder: string;
    bgHover: string;
  }> = [
    {
      type: 'ongoing',
      label: '시험 진행 중',
      count: kpiCounts.ongoing,
      subtext: '현재 시험 치르는 중',
      icon: PlayCircle,
      accentColor: 'text-purple-400',
      activeBorder: 'border-purple-500 ring-2 ring-purple-500/30',
      bgHover: isLight ? 'hover:bg-purple-50' : 'hover:bg-purple-950/20'
    },
    {
      type: 'd7',
      label: 'D-7 이내',
      count: kpiCounts.d7,
      subtext: '일주일 내 시험 시작',
      icon: AlertCircle,
      accentColor: 'text-rose-400',
      activeBorder: 'border-rose-500 ring-2 ring-rose-500/30',
      bgHover: isLight ? 'hover:bg-rose-50' : 'hover:bg-rose-950/20'
    },
    {
      type: 'd14',
      label: 'D-14 이내',
      count: kpiCounts.d14,
      subtext: '2주 내 집중 대비',
      icon: Clock,
      accentColor: 'text-amber-400',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/30',
      bgHover: isLight ? 'hover:bg-amber-50' : 'hover:bg-amber-950/20'
    },
    {
      type: 'lack_classes',
      label: '잔여 수업 4회 이하',
      count: kpiCounts.lackClasses,
      subtext: '등원 기회 매우 촉박',
      icon: BookOpen,
      accentColor: 'text-orange-400',
      activeBorder: 'border-orange-500 ring-2 ring-orange-500/30',
      bgHover: isLight ? 'hover:bg-orange-50' : 'hover:bg-orange-950/20'
    },
    {
      type: 'no_schedule',
      label: '시험 일정 미등록',
      count: kpiCounts.noSchedule,
      subtext: '학교 시험 일정 추가 필요',
      icon: HelpCircle,
      accentColor: 'text-slate-400',
      activeBorder: 'border-slate-500 ring-2 ring-slate-500/30',
      bgHover: isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800/30'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map(card => {
        const Icon = card.icon;
        const isActive = activeCardFilter === card.type;

        return (
          <button
            key={card.type}
            type="button"
            onClick={() => onToggleCard(card.type)}
            className={`text-left p-3.5 rounded-lg border transition-all cursor-pointer relative overflow-hidden ${
              isActive
                ? `${card.activeBorder} ${isLight ? 'bg-white shadow-md' : 'bg-slate-900 shadow-lg'}`
                : `${isLight ? 'bg-white border-[#e3e2e0] shadow-sm' : 'bg-[#0f0f0f] border-white/10'} ${card.bgHover}`
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold tracking-tight ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                {card.label}
              </span>
              <Icon size={16} className={card.accentColor} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-black tracking-tight ${
                card.count > 0 ? (isLight ? 'text-gray-900' : 'text-white') : (isLight ? 'text-gray-400' : 'text-gray-600')
              }`}>
                {card.count}
              </span>
              <span className={`text-[11px] font-bold ${isLight ? 'text-gray-500' : 'text-gray-500'}`}>명</span>
            </div>
            <p className={`text-[10px] mt-1 font-medium truncate ${isLight ? 'text-gray-500' : 'text-gray-500'}`}>
              {card.subtext}
            </p>
            {isActive && (
              <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
            )}
          </button>
        );
      })}
    </div>
  );
};
