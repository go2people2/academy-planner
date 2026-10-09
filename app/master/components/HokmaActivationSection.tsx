'use client';

import React, { useState } from 'react';
import { ActivationCode, AcademyModuleOverview } from '@/types/modules';
import {
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  Trash2,
  Loader2,
  Mail,
  FileText,
  Eye,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { HokmaMailDraftModal } from './HokmaMailDraftModal';

interface HokmaActivationSectionProps {
  academy: AcademyModuleOverview;
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
}

// 💡 Asia/Seoul (KST) 기준 날짜/시간 포맷터
function formatKstDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${formatter.format(date)} KST`;
  } catch {
    return isoString;
  }
}

export const HokmaActivationSection: React.FC<HokmaActivationSectionProps> = ({
  academy,
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
}) => {
  const [copiedState, setCopiedState] = useState<string | null>(null);
  const [isMailModalOpen, setIsMailModalOpen] = useState(false);

  // 현재 유효한(issued & 미만료) 최신 코드 찾기
  const now = Date.now();
  const activeCode = activationCodes.find(
    (c) => c.status === 'issued' && new Date(c.expires_at).getTime() > now
  );

  // 복사 피드백 헬퍼
  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedState(key);
    setTimeout(() => setCopiedState(null), 2000);
  };

  // 특정 코드 복사 (원문이 이미 있으면 즉시 복사, 없으면 복호화 후 복사)
  const handleCopyCodeAction = async (codeItem: ActivationCode) => {
    if (codeItem.plain_code) {
      handleCopyText(`code-${codeItem.id}`, codeItem.plain_code);
      return;
    }
    if (issuedCodeInfo?.code && codeItem.code_prefix === issuedCodeInfo.prefix) {
      handleCopyText(`code-${codeItem.id}`, issuedCodeInfo.code);
      return;
    }

    const revealed = await onRevealCode(codeItem.id);
    if (revealed) {
      handleCopyText(`code-${codeItem.id}`, revealed);
    }
  };

  // 상단 카드 복사 액션
  const handleActiveCardCopy = async () => {
    if (issuedCodeInfo?.code) {
      handleCopyText('active-card-code', issuedCodeInfo.code);
      return;
    }
    if (activeCode) {
      await handleCopyCodeAction(activeCode);
    }
  };

  // 전체 설치 안내문 복사
  const handleCopyNotice = async () => {
    if (!isInstallUrlConfigured) {
      alert('설치 링크(HOKMANOTE_INSTALL_URL)가 설정되지 않아 전체 안내문을 완성할 수 없습니다. 설치 코드는 개별 복사 가능합니다.');
      return;
    }

    let targetCode = issuedCodeInfo?.code || activeCode?.plain_code;
    if (!targetCode && activeCode) {
      targetCode = (await onRevealCode(activeCode.id)) || '';
    }

    if (!targetCode) {
      alert('유효한 설치 코드를 확인할 수 없습니다.');
      return;
    }

    const expiresKst = formatKstDateTime(issuedCodeInfo?.expires_at || activeCode?.expires_at || '');
    const noticeText = `[HokmaNote 설치 안내]
- 학원명: ${academy.academy_name}
- 다운로드 링크: ${installUrl}
- 설치 코드: ${targetCode}
- 사용 기한: ${expiresKst}
※ Mac 1대 최초 1회 인증용 코드입니다.`;

    handleCopyText('notice-copy', noticeText);
  };

  // 메일 초안에 전달할 코드 값
  const currentDisplayCode =
    issuedCodeInfo?.code ||
    activeCode?.plain_code ||
    (activeCode ? `${activeCode.code_prefix}-****-****-****` : '');

  const currentExpiresKst = formatKstDateTime(
    issuedCodeInfo?.expires_at || activeCode?.expires_at || new Date().toISOString()
  );

  return (
    <div className="space-y-4 bg-white/[0.02] border border-white/5 p-4 rounded-sm">
      {/* 섹션 타이틀 및 발급 버튼 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <KeyRound size={15} className="text-amber-400" />
          <span className="text-[11px] font-black uppercase tracking-wider text-gray-200">
            2. HokmaNote Mac 설치 코드 발급 및 관리
          </span>
        </div>

        {/* 발급/재발급 액션 버튼 */}
        <div className="flex items-center gap-2">
          {activeCode ? (
            <button
              onClick={() => onIssueCode(true, activeCode.id)}
              disabled={isIssuingCode}
              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-sm text-[11px] font-bold transition-all flex items-center gap-1"
              title="기존 유효 코드를 즉시 폐기하고 새 코드를 발급합니다."
            >
              {isIssuingCode ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              <span>기존 코드 폐기 후 재발급</span>
            </button>
          ) : (
            <button
              onClick={() => onIssueCode(false)}
              disabled={isIssuingCode}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black rounded-sm text-[11px] font-black transition-all flex items-center gap-1 shadow-sm disabled:opacity-50"
            >
              {isIssuingCode ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
              <span>신규 오답노트 설치 코드 발급</span>
            </button>
          )}
        </div>
      </div>

      {/* 설치 링크 상태 배너 */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/40 border border-white/5 rounded text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 font-bold">HokmaNote 설치 링크:</span>
          {isInstallUrlConfigured ? (
            <span className="text-emerald-400 font-mono text-[10.5px] truncate max-w-[240px]">
              {installUrl}
            </span>
          ) : (
            <span className="text-amber-400 font-medium text-[10.5px] flex items-center gap-1">
              <AlertTriangle size={12} />
              <span>미설정 (HOKMANOTE_INSTALL_URL 필요)</span>
            </span>
          )}
        </div>
        {isInstallUrlConfigured && (
          <a
            href={installUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-gray-400 hover:text-white flex items-center gap-0.5 transition-colors"
          >
            <span>확인</span>
            <ExternalLink size={10} />
          </a>
        )}
      </div>

      {/* 💡 유효 활성 코드 카드 (현재 유효한 코드가 있거나 방금 발급된 경우) */}
      {(issuedCodeInfo || activeCode) && (
        <div className="p-4 bg-black/80 border border-amber-500/40 rounded-sm space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-amber-400 font-black uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound size={13} />
              <span>현재 사용 가능한 설치 코드 (1회성)</span>
            </span>
            <span className="text-[10px] text-gray-400 font-medium">
              만료: {formatKstDateTime(issuedCodeInfo?.expires_at || activeCode?.expires_at || '')}
            </span>
          </div>

          {/* 코드 표시 및 개별 복사 */}
          <div className="flex items-center justify-between bg-black/90 p-3 rounded border border-white/10 gap-3">
            <code className="text-base font-mono font-black text-amber-300 tracking-wider select-all">
              {issuedCodeInfo?.code || activeCode?.plain_code || activeCode?.code_masked || 'HN-****-****-****-****'}
            </code>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* 원문이 아직 복호화되지 않은 경우 복호화 보기 버튼 */}
              {!issuedCodeInfo?.code && !activeCode?.plain_code && activeCode?.can_reveal && (
                <button
                  onClick={() => activeCode && onRevealCode(activeCode.id)}
                  disabled={revealingCodeId === activeCode?.id}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold rounded transition-all"
                  title="서버에서 코드를 복호화하여 확인합니다."
                >
                  {revealingCodeId === activeCode?.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Eye size={12} />
                  )}
                  <span>코드 보기</span>
                </button>
              )}

              <button
                onClick={handleActiveCardCopy}
                disabled={revealingCodeId === activeCode?.id}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-black rounded transition-all shadow-sm"
              >
                {copiedState === 'active-card-code' ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedState === 'active-card-code' ? '복사됨' : '설치 코드 복사'}</span>
              </button>
            </div>
          </div>

          {/* 추가 편의 액션 버튼 모음 */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
            <div className="flex items-center gap-2">
              {/* 안내문 복사 */}
              <button
                onClick={handleCopyNotice}
                disabled={!isInstallUrlConfigured}
                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 border border-white/10 rounded text-[10.5px] font-bold transition-all flex items-center gap-1"
                title={!isInstallUrlConfigured ? '설치 링크가 미설정되어 안내문 복사가 제한됩니다.' : '설치 안내문 전체를 복사합니다.'}
              >
                {copiedState === 'notice-copy' ? <Check size={11} className="text-emerald-400" /> : <FileText size={11} />}
                <span>{copiedState === 'notice-copy' ? '안내문 복사됨' : '설치 안내문 복사'}</span>
              </button>

              {/* 메일 초안 보기 */}
              <button
                onClick={() => setIsMailModalOpen(true)}
                className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded text-[10.5px] font-bold transition-all flex items-center gap-1"
              >
                <Mail size={11} />
                <span>메일 초안 보기</span>
              </button>
            </div>

            {/* 유효 코드 폐기 버튼 */}
            {activeCode && (
              <button
                onClick={() => onRevokeCode(activeCode.id)}
                disabled={isRevokingCodeId === activeCode.id}
                className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors font-medium"
              >
                {isRevokingCodeId === activeCode.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                <span>코드 폐기</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 💡 발급된 코드 전체 이력 목록 */}
      <div className="pt-2 border-t border-white/5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            발급 이력 ({activationCodes.length}건)
          </span>
          {isLoadingCodes && <Loader2 size={11} className="animate-spin text-gray-500" />}
        </div>

        {activationCodes.length === 0 ? (
          <div className="py-3 text-center text-[10.5px] text-gray-500 bg-black/30 rounded border border-white/[0.03]">
            발급된 설치 코드가 없습니다.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar-v pr-1">
            {activationCodes.map((codeItem) => {
              const isIssued = codeItem.status === 'issued';
              const isUsed = codeItem.status === 'used';
              const isExpired = codeItem.status === 'expired';
              const isRevoked = codeItem.status === 'revoked';

              return (
                <div
                  key={codeItem.id}
                  className="p-2.5 bg-black/40 border border-white/5 rounded flex items-center justify-between gap-3 text-[11px]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <code className="font-mono font-bold text-gray-200">
                      {codeItem.plain_code || codeItem.code_masked || `${codeItem.code_prefix}-****-****-****`}
                    </code>

                    {/* 상태 뱃지 */}
                    {isIssued && (
                      <span className="px-1.5 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9.5px] font-bold">
                        사용 가능
                      </span>
                    )}
                    {isUsed && (
                      <span className="px-1.5 py-0.5 rounded-[2px] bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9.5px] font-bold">
                        사용 완료
                      </span>
                    )}
                    {isExpired && (
                      <span className="px-1.5 py-0.5 rounded-[2px] bg-gray-500/10 text-gray-400 border border-gray-500/20 text-[9.5px] font-bold">
                        만료됨
                      </span>
                    )}
                    {isRevoked && (
                      <span className="px-1.5 py-0.5 rounded-[2px] bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9.5px] font-bold">
                        폐기됨
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[9.5px] text-gray-500">
                      만료: {formatKstDateTime(codeItem.expires_at)}
                    </span>

                    {/* 액션 버튼 */}
                    {isIssued ? (
                      <div className="flex items-center gap-1.5">
                        {codeItem.can_reveal ? (
                          <button
                            onClick={() => handleCopyCodeAction(codeItem)}
                            disabled={revealingCodeId === codeItem.id}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                            title="설치 코드 복사"
                          >
                            {copiedState === `code-${codeItem.id}` ? (
                              <Check size={12} className="text-emerald-400" />
                            ) : revealingCodeId === codeItem.id ? (
                              <Loader2 size={12} className="animate-spin text-gray-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        ) : (
                          <span
                            className="text-[9px] text-amber-500/80 cursor-help"
                            title="암호문이 없는 구형 발급 코드로 원문 재확인이 불가합니다. 필요 시 폐기 후 재발급해 주세요."
                          >
                            원문 확인 불가
                          </span>
                        )}

                        <button
                          onClick={() => onRevokeCode(codeItem.id)}
                          disabled={isRevokingCodeId === codeItem.id}
                          className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                          title="설치 코드 즉시 폐기"
                        >
                          {isRevokingCodeId === codeItem.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-[9.5px] text-gray-600 italic">복사 불가</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 메일 초안 팝업 모달 */}
      <HokmaMailDraftModal
        isOpen={isMailModalOpen}
        onClose={() => setIsMailModalOpen(false)}
        academyName={academy.academy_name}
        code={currentDisplayCode}
        expiresAtKst={currentExpiresKst}
        installUrl={installUrl}
        isInstallUrlConfigured={isInstallUrlConfigured}
      />
    </div>
  );
};
