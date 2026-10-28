'use client';

import React from 'react';
import { BookOpen, Globe, School, CheckCircle2, AlertCircle, Layers } from 'lucide-react';

export interface MasterTextbookStatsData {
  total_count: number;
  public_count: number;
  custom_count: number;
  active_count: number;
  inactive_count: number;
  total_units: number;
}

interface MasterTextbookStatsProps {
  stats: MasterTextbookStatsData | null;
  isLoading: boolean;
}

export function MasterTextbookStats({ stats, isLoading }: MasterTextbookStatsProps) {
  const cards = [
    {
      label: '총 등록 교재',
      value: stats?.total_count ?? 0,
      sub: `총 ${stats?.total_units?.toLocaleString() ?? 0}개 단원 등록`,
      icon: BookOpen,
      color: 'text-indigo-400',
      bg: 'bg-indigo-950/20 border-indigo-800/30',
    },
    {
      label: '공용 교재 (전체 가맹)',
      value: stats?.public_count ?? 0,
      sub: stats?.total_count ? `${Math.round(((stats.public_count || 0) / stats.total_count) * 100)}% 본사 공용 공급` : '0%',
      icon: Globe,
      color: 'text-blue-400',
      bg: 'bg-blue-950/20 border-blue-800/30',
    },
    {
      label: '학원 자체 교재',
      value: stats?.custom_count ?? 0,
      sub: stats?.total_count ? `${Math.round(((stats.custom_count || 0) / stats.total_count) * 100)}% 학원 전용` : '0%',
      icon: School,
      color: 'text-purple-400',
      bg: 'bg-purple-950/20 border-purple-800/30',
    },
    {
      label: '활성 운영 교재',
      value: stats?.active_count ?? 0,
      sub: '학원 대시보드 노출 가능',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/20 border-emerald-800/30',
    },
    {
      label: '보관 (비활성 교재)',
      value: stats?.inactive_count ?? 0,
      sub: '단종·구판 아카이빙',
      icon: AlertCircle,
      color: 'text-amber-400',
      bg: 'bg-amber-950/20 border-amber-800/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div key={i} className={`p-4 rounded border ${c.bg} flex flex-col justify-between`}>
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span className="font-bold">{c.label}</span>
              <Icon size={16} className={c.color} />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-white">
                {isLoading ? '-' : `${c.value}권`}
              </div>
              <div className="text-[10px] text-gray-400 font-medium mt-1 truncate">
                {c.sub}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
