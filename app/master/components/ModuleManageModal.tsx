'use client';

import React, { useState } from 'react';
import { AcademyModuleOverview, ModuleStatus, ActivationCode } from '@/types/modules';
import { motion } from 'framer-motion';
import { X, KeyRound, Laptop, ShieldCheck, Copy, Check, AlertTriangle, Trash2, Loader2, Ban } from 'lucide-react';

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
  onIssueCode: () => void;
  activationCodes: ActivationCode[];
  isLoadingCodes: boolean;
  isRevokingCodeId: string | null;
  onRevokeCode: (codeId: string) => void;
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
  isRevokingDevice,
  onRevokeDevice,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen || !academy) return null;

  const handleCopyCode = () => {
    if (!issuedCodeInfo?.code) return;
    navigator.clipboard.writeText(issuedCodeInfo.code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

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
          
          {/* 섹션 1: 모듈별 사용 권한 상태 */}
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

          {/* 섹션 2: HokmaNote 설치 코드 발급 및 관리 */}
          <div className="space-y-3 bg-white/[0.02] border border-white/5 p-4 rounded-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                <KeyRound size={14} className="text-amber-400" />
                <span>2. HokmaNote Mac 설치 코드 발급</span>
              </span>
              {academy.hokmanote_status === 'active' || academy.hokmanote_status === 'pending_setup' || academy.hokmanote_status === 'trial' ? (
                <button
                  onClick={onIssueCode}
                  disabled={isIssuingCode}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-sm text-xs font-bold transition-all flex items-center gap-1"
                >
                  {isIssuingCode ? <Loader2 size={12} className="animate-spin" /> : null}
                  <span>새 설치 코드 발급</span>
                </button>
              ) : (
                <span className="text-[10px] text-gray-500 italic">HokmaNote 활성 후 발급 가능</span>
              )}
            </div>

            <p className="text-[10px] text-gray-400 leading-relaxed font-normal">
              원장님이 Mac에서 HokmaNote 앱을 처음 실행했을 때 입력할 1회성 설치 코드(HN-XXXX-XXXX)입니다. (발급 후 24시간 동안 유효)
            </p>

            {/* 💡 원문 코드 발급 직후 1회성 노출 카드 */}
            {issuedCodeInfo && (
              <div className="p-3.5 bg-black/80 border border-amber-500/40 rounded-sm space-y-2.5 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider flex items-center gap-1">
                    <KeyRound size={12} />
                    <span>신규 발급된 설치 코드 (1회성)</span>
                  </span>
                  <span className="text-[9px] text-gray-400 font-bold">24시간 후 자동 만료</span>
                </div>
                <div className="flex items-center justify-between bg-black/90 p-2.5 rounded border border-white/10">
                  <code className="text-base font-mono font-black text-amber-300 tracking-wider">
                    {issuedCodeInfo.code}
                  </code>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-black rounded transition-all shadow-sm"
                  >
                    {isCopied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{isCopied ? '복사됨' : '코드 복사'}</span>
                  </button>
                </div>
                <div className="flex items-start gap-1.5 text-[9.5px] text-amber-200/90 leading-normal">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-400" />
                  <span>원문 코드는 보안을 위해 DB에 저장되지 않으며 지금만 확인 가능합니다. 즉시 복사하여 원장님께 전달하세요.</span>
                </div>
              </div>
            )}

            {/* 💡 발급된 코드 이력 및 상태 관리 목록 */}
            <div className="pt-2 border-t border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  최근 발급 코드 내역 ({activationCodes.length}건)
                </span>
                {isLoadingCodes && <Loader2 size={11} className="animate-spin text-gray-500" />}
              </div>

              {activationCodes.length === 0 ? (
                <div className="py-2.5 text-center text-[10px] text-gray-500 bg-black/30 rounded border border-white/[0.03]">
                  발급된 설치 코드가 없습니다.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar-v pr-1">
                  {activationCodes.map((code) => {
                    const isIssued = code.status === 'issued';
                    const isUsed = code.status === 'used';
                    const isExpired = code.status === 'expired';
                    const isRevoked = code.status === 'revoked';

                    return (
                      <div
                        key={code.id}
                        className="p-2 bg-black/40 border border-white/5 rounded flex items-center justify-between gap-2 text-[10.5px]"
                      >
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-bold text-gray-300">
                            {code.code_masked || `${code.code_prefix || 'HN-****'}-****`}
                          </code>
                          
                          {/* 상태 태그 */}
                          {isIssued && (
                            <span className="px-1.5 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">
                              사용 가능
                            </span>
                          )}
                          {isUsed && (
                            <span className="px-1.5 py-0.5 rounded-[2px] bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-bold">
                              사용됨
                            </span>
                          )}
                          {isExpired && (
                            <span className="px-1.5 py-0.5 rounded-[2px] bg-gray-500/10 text-gray-400 border border-white/10 text-[9px] font-bold">
                              만료됨
                            </span>
                          )}
                          {isRevoked && (
                            <span className="px-1.5 py-0.5 rounded-[2px] bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold">
                              폐기됨
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[9.5px] text-gray-500">
                          <span>
                            {code.created_at ? code.created_at.slice(5, 16).replace('T', ' ') : '-'}
                          </span>

                          {isIssued && (
                            <button
                              onClick={() => onRevokeCode(code.id)}
                              disabled={isRevokingCodeId === code.id}
                              className="px-1.5 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-[2px] text-[9.5px] font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                            >
                              {isRevokingCodeId === code.id ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                <Ban size={10} />
                              )}
                              <span>코드 폐기</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 섹션 3: 등록된 Mac 기기 목록 */}
          <div className="space-y-3 bg-white/[0.02] border border-white/5 p-4 rounded-sm">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <Laptop size={14} className="text-emerald-400" />
              <span>3. 등록된 Mac 기기 현황 ({academy.registered_devices.length} / {academy.hokmanote_max_devices}대)</span>
            </span>

            {academy.registered_devices.length === 0 ? (
              <div className="py-4 text-center text-[11px] text-gray-500">
                {academy.is_legacy_installation ? (
                  <div className="space-y-1">
                    <span className="text-indigo-300 font-bold block">기존 설치본 운용 중 (신규 기기 미등록)</span>
                    <span className="text-[10px] text-gray-500 block">
                      다음 버전 앱 업데이트 시 위의 설치 코드를 입력하면 이 목록에 정식 등록됩니다.
                    </span>
                  </div>
                ) : (
                  <span>현재 등록된 Mac 기기가 없습니다.</span>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {academy.registered_devices.map((device) => (
                  <div
                    key={device.id}
                    className="p-3 bg-black/40 border border-white/5 rounded-sm flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Laptop size={13} className="text-emerald-400" />
                        <span className="font-bold text-white text-xs">{device.device_name}</span>
                        <span className="text-[9px] text-gray-500">({device.os_version || 'macOS'})</span>
                      </div>
                      <div className="text-[9px] text-gray-500 flex items-center gap-2">
                        <span>버전: {device.app_version || 'v1.0.0'}</span>
                        <span>•</span>
                        <span>최근 활동: {device.last_seen_at ? device.last_seen_at.slice(0, 16).replace('T', ' ') : '-'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onRevokeDevice(device.id)}
                      disabled={isRevokingDevice}
                      className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-[2px] text-[10px] font-bold transition-all flex items-center gap-1"
                    >
                      <Trash2 size={11} />
                      <span>기기 해제</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* 닫기 버튼 */}
        <div className="border-t border-white/10 px-5 py-3 bg-[#141414] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-sm text-xs font-bold transition-all"
          >
            닫기
          </button>
        </div>
      </motion.div>
    </div>
  );
};
