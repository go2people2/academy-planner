'use client';

import React from 'react';
import { AcademyModuleOverview } from '@/types/modules';
import { Loader2, RefreshCw, Laptop, CheckCircle2, AlertCircle, Clock, Settings2 } from 'lucide-react';

interface ModuleOverviewTabProps {
  moduleOverviews: AcademyModuleOverview[];
  isLoading: boolean;
  error?: string;
  onRefresh: () => void;
  filterModule: 'all' | 'hokma_active' | 'hokma_pending';
  onFilterModuleChange: (val: 'all' | 'hokma_active' | 'hokma_pending') => void;
  filterStatus: 'all' | 'active' | 'inactive';
  onFilterStatusChange: (val: 'all' | 'active' | 'inactive') => void;
  summaryStats: {
    total: number;
    amsActive: number;
    hokmaActive: number;
    hokmaPending: number;
  };
  onOpenManageModal: (academy: AcademyModuleOverview) => void;
}

export const ModuleOverviewTab: React.FC<ModuleOverviewTabProps> = ({
  moduleOverviews,
  isLoading,
  error,
  onRefresh,
  filterModule,
  onFilterModuleChange,
  filterStatus,
  onFilterStatusChange,
  summaryStats,
  onOpenManageModal,
}) => {
  return (
    <div className="space-y-6">
      {/* 1. 상단 요약 카드 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-4 space-y-1">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">실운영 학원</span>
          <div className="text-xl font-black text-white">{summaryStats.total} <span className="text-xs text-gray-500 font-normal">개원</span></div>
        </div>

        <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-4 space-y-1">
          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">AMS 정상 사용</span>
          <div className="text-xl font-black text-blue-400">{summaryStats.amsActive} <span className="text-xs text-gray-500 font-normal">개소</span></div>
        </div>

        <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-4 space-y-1">
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">HokmaNote 활성</span>
          <div className="text-xl font-black text-emerald-400">{summaryStats.hokmaActive} <span className="text-xs text-gray-500 font-normal">개소</span></div>
        </div>

        <div className="bg-[#111111]/80 border border-white/5 rounded-sm p-4 space-y-1">
          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">HokmaNote 설치 대기</span>
          <div className="text-xl font-black text-amber-400">{summaryStats.hokmaPending} <span className="text-xs text-gray-500 font-normal">개소</span></div>
        </div>
      </div>

      {/* 2. 컨트롤 바 & 필터 */}
      <div className="bg-[#111111]/60 border border-white/5 rounded-sm p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mr-1">필터:</span>
          
          {/* 모듈 필터 */}
          <select
            value={filterModule}
            onChange={(e) => onFilterModuleChange(e.target.value as any)}
            className="bg-black/60 border border-white/10 rounded-sm px-2.5 py-1.5 text-xs text-white outline-none font-bold"
          >
            <option value="all">모듈 전체</option>
            <option value="hokma_active">HokmaNote 사용 학원</option>
            <option value="hokma_pending">HokmaNote 설치 대기</option>
          </select>

          {/* 상태 필터 */}
          <select
            value={filterStatus}
            onChange={(e) => onFilterStatusChange(e.target.value as any)}
            className="bg-black/60 border border-white/10 rounded-sm px-2.5 py-1.5 text-xs text-white outline-none font-bold"
          >
            <option value="all">상태 전체</option>
            <option value="active">AMS 정상 사용 학원</option>
            <option value="inactive">미사용/테스트 학원</option>
          </select>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-sm text-xs font-bold transition-all"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          <span>새로고침</span>
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-sm font-bold flex items-center gap-2">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* 3. 통합 현황 테이블 */}
      <div className="bg-[#111111]/80 border border-white/5 rounded-sm shadow-2xl overflow-hidden">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center text-gray-500 gap-2">
            <Loader2 size={24} className="animate-spin text-gray-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider">모듈 현황 불러오는 중...</span>
          </div>
        ) : moduleOverviews.length === 0 ? (
          <div className="py-20 text-center text-xs text-gray-500 font-bold">
            조건에 부합하는 학원 모듈 데이터가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 text-[9px] font-black text-gray-500 uppercase tracking-widest bg-black/40">
                  <th className="py-3 px-4">학원명 / 슬러그</th>
                  <th className="py-3 px-3">AMS 플래너</th>
                  <th className="py-3 px-3">HokmaNote 조판기</th>
                  <th className="py-3 px-3">Mac 기기 상태</th>
                  <th className="py-3 px-3">최근 활동</th>
                  <th className="py-3 px-4 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {moduleOverviews.map((ac) => {
                  const isTestAcademy = ac.slug === 'hplan';
                  return (
                    <tr
                      key={ac.id}
                      className={`border-b transition-all font-bold group ${
                        isTestAcademy
                          ? 'bg-white/[0.01] text-gray-500 border-white/[0.02]'
                          : 'text-white/90 hover:bg-white/[0.02] border-white/[0.03]'
                      }`}
                    >
                      {/* 학원명 / 슬러그 */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isTestAcademy
                                ? 'bg-gray-600'
                                : ac.ams_status === 'active'
                                ? 'bg-blue-500'
                                : 'bg-red-500'
                            }`}
                          />
                          <span className={isTestAcademy ? 'text-gray-500' : 'text-white font-bold'}>
                            {ac.academy_name}
                          </span>
                          {isTestAcademy && (
                            <span className="px-1.5 py-0.2 rounded-[2px] bg-white/5 border border-white/10 text-gray-500 text-[8px] font-bold">
                              테스트
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono block mt-0.5">/{ac.slug}</span>
                      </td>

                      {/* AMS 플래너 상태 */}
                      <td className="py-3.5 px-3">
                        {ac.ams_status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">
                            <CheckCircle2 size={10} /> 사용 중
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-gray-500/10 text-gray-500 border border-white/5 text-[10px] font-bold">
                            미사용
                          </span>
                        )}
                      </td>

                      {/* HokmaNote 상태 */}
                      <td className="py-3.5 px-3">
                        {ac.hokmanote_status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                            <CheckCircle2 size={10} /> 사용 중
                          </span>
                        ) : ac.hokmanote_status === 'pending_setup' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                            <Clock size={10} /> 설치 대기
                          </span>
                        ) : ac.hokmanote_status === 'trial' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold">
                            체험 중
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-gray-500/10 text-gray-500 border border-white/5 text-[10px] font-bold">
                            미사용
                          </span>
                        )}
                      </td>

                      {/* Mac 기기 등록 현황 */}
                      <td className="py-3.5 px-3">
                        {ac.active_device_count > 0 ? (
                          <div className="flex items-center gap-1.5 text-xs text-white/90">
                            <Laptop size={13} className="text-emerald-400" />
                            <span>{ac.active_device_count}대 등록됨</span>
                          </div>
                        ) : ac.is_legacy_installation ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[9px] font-bold">
                            기존 설치본 사용 중
                          </span>
                        ) : ac.hokmanote_status === 'pending_setup' ? (
                          <span className="text-[10px] text-amber-400 font-bold">코드 입력 대기</span>
                        ) : (
                          <span className="text-[10px] text-gray-600">-</span>
                        )}
                      </td>

                      {/* 최근 활동 */}
                      <td className="py-3.5 px-3">
                        <span className="text-[11px] text-gray-400 font-medium">
                          {ac.latest_activity.display}
                        </span>
                      </td>

                      {/* 관리 버튼 */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onOpenManageModal(ac)}
                          className="px-2.5 py-1.5 bg-white/5 hover:bg-blue-600 hover:text-white border border-white/10 text-gray-300 rounded-[2px] text-[11px] font-bold transition-all flex items-center gap-1.5 ml-auto"
                        >
                          <Settings2 size={12} />
                          <span>모듈 / 기기 관리</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
