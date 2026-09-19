'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Sparkles, Calendar, RefreshCw, Loader2, DollarSign, Bot, ArrowUpRight } from 'lucide-react';

interface AiUsageSummary {
  totalCount: number;
  openaiCount: number;
  geminiCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
}

interface AcademyAiStat {
  academy_id: string;
  academy_name: string;
  slug: string;
  totalCount: number;
  openaiCount: number;
  geminiCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latestCreatedAt: string | null;
}

export function AiUsageOverviewTab() {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AiUsageSummary>({
    totalCount: 0,
    openaiCount: 0,
    geminiCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
  });
  const [academyStats, setAcademyStats] = useState<AcademyAiStat[]>([]);
  const [isTablePending, setIsTablePending] = useState(false);

  // 빠른 기간 설정 헬퍼
  const handleQuickPeriod = (type: 'this_month' | 'last_month' | 'last_30') => {
    const now = new Date();
    if (type === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(today);
    } else if (type === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (type === 'last_30') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];
      setStartDate(thirtyDaysAgo);
      setEndDate(today);
    }
  };

  const fetchUsageData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch(`/api/master/ai-usage?startDate=${startDate}&endDate=${endDate}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '사용량 집계 조회 실패');
      }

      setSummary(data.summary || {
        totalCount: 0,
        openaiCount: 0,
        geminiCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUsd: 0,
      });
      setAcademyStats(data.academyStats || []);
      setIsTablePending(data.tablePending === true);
    } catch (err: any) {
      console.error('Fetch AI usage stats error:', err);
      setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  return (
    <div className="space-y-6">
      {/* 1. 기간 선택 컨트롤 바 */}
      <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-black/60 border border-white/10 px-3 py-1.5 rounded-sm text-xs">
            <Calendar size={13} className="text-purple-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-white outline-none text-xs font-bold"
            />
            <span className="text-gray-500">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-white outline-none text-xs font-bold"
            />
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleQuickPeriod('this_month')}
              className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-[11px] font-bold rounded-sm transition-all border border-white/5"
            >
              이번 달
            </button>
            <button
              onClick={() => handleQuickPeriod('last_month')}
              className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-[11px] font-bold rounded-sm transition-all border border-white/5"
            >
              지난 달
            </button>
            <button
              onClick={() => handleQuickPeriod('last_30')}
              className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-[11px] font-bold rounded-sm transition-all border border-white/5"
            >
              최근 30일
            </button>
          </div>
        </div>

        <button
          onClick={fetchUsageData}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-sm text-xs font-bold transition-all ml-auto"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          <span>새로고침</span>
        </button>
      </div>

      {isTablePending && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-sm text-xs text-amber-300 flex items-center gap-2">
          <span>⚠️ DB에 ams_ai_usage_logs 테이블 생성이 필요합니다. 마이그레이션 SQL(sql/20260920_create_ams_ai_usage_logs.sql)을 실행해 주세요.</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-sm text-xs text-red-400 font-bold">
          {error}
        </div>
      )}

      {/* 2. 상단 요약 카드 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-4 space-y-1">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Sparkles size={11} className="text-purple-400" />
            <span>총 브리핑 성공 건수</span>
          </span>
          <div className="text-2xl font-black text-white">
            {summary.totalCount.toLocaleString()} <span className="text-xs text-gray-500 font-normal">건</span>
          </div>
        </div>

        <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-4 space-y-1">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Bot size={11} className="text-emerald-400" />
            <span>OpenAI (GPT-4o)</span>
          </span>
          <div className="text-2xl font-black text-emerald-400">
            {summary.openaiCount.toLocaleString()} <span className="text-xs text-gray-500 font-normal">건</span>
          </div>
        </div>

        <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-4 space-y-1">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Bot size={11} className="text-blue-400" />
            <span>Google Gemini</span>
          </span>
          <div className="text-2xl font-black text-blue-400">
            {summary.geminiCount.toLocaleString()} <span className="text-xs text-gray-500 font-normal">건</span>
          </div>
        </div>

        <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-4 space-y-1">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <DollarSign size={11} className="text-amber-400" />
            <span>추정 API 원가</span>
          </span>
          <div className="text-2xl font-black text-amber-400">
            ${summary.totalCostUsd.toFixed(4)} <span className="text-[10px] text-gray-500 font-normal">USD</span>
          </div>
        </div>
      </div>

      {/* 3. 학원별 사용량 테이블 */}
      <div className="bg-[#111111]/80 border border-white/5 rounded-sm overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span>학원별 AI 브리핑 사용량 및 통계</span>
            </h3>
            <p className="text-[10px] text-gray-500 mt-0.5 font-bold">
              선택한 기간 동안 성공적으로 호출된 AI 브리핑 횟수와 토큰 사용량입니다. (실패 및 미인증 요청 제외)
            </p>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">
            {startDate} ~ {endDate}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-[10px] text-gray-400 font-black uppercase tracking-wider">
                <th className="py-3 px-4">학원명 / 슬러그</th>
                <th className="py-3 px-4 text-center">총 브리핑 횟수</th>
                <th className="py-3 px-4 text-center">OpenAI / Gemini</th>
                <th className="py-3 px-4 text-right">총 사용 토큰 (In / Out)</th>
                <th className="py-3 px-4 text-right">추정 API 원가</th>
                <th className="py-3 px-4 text-right">최근 호출 시각</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <Loader2 size={18} className="animate-spin mx-auto mb-2 text-purple-400" />
                    <span>사용량 집계 데이터를 계산 중입니다...</span>
                  </td>
                </tr>
              ) : academyStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 text-xs">
                    조회된 학원 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                academyStats.map((stat) => (
                  <tr key={stat.academy_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-xs">{stat.academy_name}</div>
                      <div className="text-[10px] text-gray-500 font-mono">/{stat.slug}</div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {stat.totalCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[2px] bg-purple-500/10 text-purple-300 border border-purple-500/20 font-black text-xs">
                          {stat.totalCount}회
                        </span>
                      ) : (
                        <span className="text-gray-600 font-bold">0회</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center text-[11px] text-gray-400">
                      <span className="text-emerald-400 font-bold">{stat.openaiCount}</span>
                      <span className="text-gray-600 mx-1">/</span>
                      <span className="text-blue-400 font-bold">{stat.geminiCount}</span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-[11px] text-gray-300">
                      <div>{(stat.inputTokens + stat.outputTokens).toLocaleString()} tok</div>
                      <div className="text-[9px] text-gray-500">
                        {stat.inputTokens.toLocaleString()} / {stat.outputTokens.toLocaleString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-[11px] text-amber-400 font-bold">
                      ${stat.estimatedCostUsd.toFixed(4)}
                    </td>

                    <td className="py-3.5 px-4 text-right text-[10px] text-gray-500">
                      {stat.latestCreatedAt ? stat.latestCreatedAt.slice(5, 16).replace('T', ' ') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
