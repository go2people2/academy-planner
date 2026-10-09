'use client';

import React from 'react';
import { AcademyModuleOverview, ModuleStatus, ActivationCode } from '@/types/modules';
import { motion } from 'framer-motion';
import { X, Laptop, ShieldCheck, Trash2, Loader2, Ban } from 'lucide-react';
import { HokmaActivationSection } from './HokmaActivationSection';

interface ModuleManageModalProps {
  academy: AcademyModuleOverview | null;
  isOpen: boolean;
  onClose: () => void;
  editAmsStatus: ModuleStatus;
  onEditAmsStatusChange: (status: ModuleStatus) => void;
  editHokmaStatus: ModuleStatus;
  onEditHokmaStatusChange: (status: ModuleStatus) => void;
  editHokmaMaxDevices: number;
  onEditHokmaMaxDevicesChange: (count: number) => void;
  isSavingStatus: boolean;
  onSaveStatus: () => void;
  issuedCodeInfo: { code: string; expires_at: string; prefix: string } | null;
  isIssuingCode: boolean;
  onIssueCode: (forceReissue?: boolean, expectedActiveCodeId?: string) => void;
  activationCodes: ActivationCode[];
  isLoadingCodes: boolean;
  isRevokingCodeId: string | null;
  onRevokeCode: (codeId: string) => void;
  revealingCodeId: string | null;
  onRevealCode: (codeId: string) => Promise<string | null>;
  installUrl: string;
  isInstallUrlConfigured: boolean;
  isRevokingDevice: boolean;
  onRevokeDevice: (deviceId: string) => void;
}

export const ModuleManageModal: React.FC<ModuleManageModalProps> = ({
  academy,
  isOpen,
  onClose,
  editAmsStatus,
  onEditAmsStatusChange,
  editHokmaStatus,
  onEditHokmaStatusChange,
  editHokmaMaxDevices,
  onEditHokmaMaxDevicesChange,
  isSavingStatus,
  onSaveStatus,
  issuedCodeInfo,
  isIssuingCode,
  onIssueCode,
  activationCodes,
  isLoadingCodes,
  isRevokingCodeId,
  onRevokeCode,
  revealingCodeId,
  onRevealCode,
  installUrl,
  isInstallUrlConfigured,
  isRevokingDevice,
  onRevokeDevice,
}) => {
  if (!isOpen || !academy) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#121212] border border-white/10 rounded-sm max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-white"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-[#141414]">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span>{academy.academy_name}</span>
              <span className="text-xs text-gray-500 font-mono font-normal">/{academy.slug}</span>
            </h3>
            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block mt-0.5">
              Hokma 제품군 모듈 및 기기 관리
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar-v text-xs">
          {/* 섹션 1: 모듈별 사용 권한 설정 */}
          <div className="space-y-3 bg-white/[0.02] border border-white/5 p-4 rounded-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-blue-400" />
                <span>1. 모듈별 사용 권한 설정</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* AMS 플래너 */}
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold block">AMS 학원 플래너</label>
                <select
                  value={editAmsStatus}
                  onChange={(e) => onEditAmsStatusChange(e.target.value as ModuleStatus)}
                  className="w-full bg-black/60 border border-white/10 rounded-sm py-2 px-2.5 text-xs text-white outline-none focus:border-blue-500 font-bold"
                >
                  <option value="active">✅ 정상 사용 (Active)</option>
                  <option value="inactive">❌ 미사용 (Inactive)</option>
                  <option value="suspended">⏸️ 이용 중지 (Suspended)</option>
                </select>
              </div>

              {/* HokmaNote */}
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold block">HokmaNote 조판기</label>
                <select
                  value={editHokmaStatus}
                  onChange={(e) => onEditHokmaStatusChange(e.target.value as ModuleStatus)}
                  className="w-full bg-black/60 border border-white/10 rounded-sm py-2 px-2.5 text-xs text-white outline-none focus:border-blue-500 font-bold"
                >
                  <option value="active">✅ 정상 사용 (Active)</option>
                  <option value="pending_setup">⏳ 설치 대기 (Pending)</option>
                  <option value="trial">🎁 체험 사용 (Trial)</option>
                  <option value="grace">⚠️ 유예 사용 (Grace)</option>
                  <option value="inactive">❌ 미사용 (Inactive)</option>
                  <option value="suspended">⏸️ 이용 중지 (Suspended)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 font-bold">HokmaNote 허용 기기 수:</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={editHokmaMaxDevices}
                  onChange={(e) => onEditHokmaMaxDevicesChange(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 bg-black/60 border border-white/10 rounded-sm py-1 px-2 text-xs text-center font-bold"
                />
                <span className="text-[10px] text-gray-500">대</span>
              </div>

              <button
                onClick={onSaveStatus}
                disabled={isSavingStatus}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-sm text-xs font-bold transition-all flex items-center gap-1"
              >
                {isSavingStatus ? <Loader2 size={12} className="animate-spin" /> : null}
                <span>권한 변경 저장</span>
              </button>
            </div>
          </div>

          {/* 💡 섹션 2: HokmaNote 설치 코드 발급 및 관리 (HokmaActivationSection 위임) */}
          <HokmaActivationSection
            academy={academy}
            issuedCodeInfo={issuedCodeInfo}
            isIssuingCode={isIssuingCode}
            onIssueCode={onIssueCode}
            activationCodes={activationCodes}
            isLoadingCodes={isLoadingCodes}
            isRevokingCodeId={isRevokingCodeId}
            onRevokeCode={onRevokeCode}
            revealingCodeId={revealingCodeId}
            onRevealCode={onRevealCode}
            installUrl={installUrl}
            isInstallUrlConfigured={isInstallUrlConfigured}
          />

          {/* 섹션 3: 등록된 Mac 기기 현황 및 원격 제어 */}
          <div className="space-y-3 bg-white/[0.02] border border-white/5 p-4 rounded-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                <Laptop size={14} className="text-purple-400" />
                <span>3. 등록 승인된 Mac 기기 ({academy.registered_devices?.length || 0}대 / 최대 {academy.hokmanote_max_devices}대)</span>
              </span>
            </div>

            {(!academy.registered_devices || academy.registered_devices.length === 0) ? (
              <div className="py-4 text-center text-xs text-gray-500 bg-black/20 rounded border border-white/[0.03]">
                등록된 Mac 기기가 없습니다. 원장님이 설치 코드로 첫 인증을 완료하면 자동으로 기기가 등록됩니다.
              </div>
            ) : (
              <div className="space-y-2">
                {academy.registered_devices.map((device) => {
                  const isActive = device.status === 'active';
                  return (
                    <div
                      key={device.id}
                      className="p-3 bg-black/40 border border-white/5 rounded flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{device.device_name}</span>
                          <span className="text-[10px] font-mono text-gray-400 uppercase">
                            ({device.platform} {device.os_version || ''})
                          </span>
                          {isActive ? (
                            <span className="px-1.5 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">
                              연결 정상
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-[2px] bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold">
                              차단됨
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-2">
                          <span>최근 접속: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString('ko-KR') : '기록 없음'}</span>
                          <span>•</span>
                          <span>앱 버전: {device.app_version || '알 수 없음'}</span>
                        </div>
                      </div>

                      {isActive && (
                        <button
                          onClick={() => onRevokeDevice(device.id)}
                          disabled={isRevokingDevice}
                          className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded text-[10px] font-bold transition-all flex items-center gap-1"
                        >
                          <Ban size={11} />
                          <span>기기 해제</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-white/10 bg-[#141414]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded text-xs font-bold transition-all"
          >
            닫기
          </button>
        </div>
      </motion.div>
    </div>
  );
};
