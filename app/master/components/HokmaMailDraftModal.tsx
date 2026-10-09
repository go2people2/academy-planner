'use client';

import React, { useState } from 'react';
import { X, Copy, Check, AlertTriangle, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HokmaMailDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  academyName: string;
  code: string;
  expiresAtKst: string;
  installUrl: string;
  isInstallUrlConfigured: boolean;
}

export const HokmaMailDraftModal: React.FC<HokmaMailDraftModalProps> = ({
  isOpen,
  onClose,
  academyName,
  code,
  expiresAtKst,
  installUrl,
  isInstallUrlConfigured,
}) => {
  const [copiedField, setCopiedField] = useState<'subject' | 'body' | null>(null);

  if (!isOpen) return null;

  const mailSubject = `[HokmaNote] ${academyName} 설치 안내`;

  const mailBody = `원장님, 안녕하세요.
${academyName}의 HokmaNote 설치를 안내드립니다.

1. 아래 링크에서 앱을 다운로드해 주세요.
   설치 링크: ${isInstallUrlConfigured ? installUrl : '(설치 링크 환경변수 미설정)'}

2. 다운로드한 앱을 설치하고 실행해 주세요.

3. 설치 코드 입력 화면에 아래 코드를 입력해 주세요.
   설치 코드: ${code}
   사용 기한: ${expiresAtKst}

4. 인증이 완료되면 안내에 따라
   학원 관리자 아이디와 비밀번호를 설정해 주세요.

이 코드는 Mac 1대를 최초 등록하는 데 사용하는 1회용 코드입니다.
사용 기한이 지났거나 등록할 Mac이 변경된 경우에는 연락해 주세요.`;

  const handleCopySubject = () => {
    navigator.clipboard.writeText(mailSubject);
    setCopiedField('subject');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyBody = () => {
    if (!isInstallUrlConfigured) {
      alert('설치 링크(HOKMANOTE_INSTALL_URL)가 설정되지 않아 본문을 복사할 수 없습니다. 서버 환경변수를 먼저 설정해 주세요.');
      return;
    }
    navigator.clipboard.writeText(mailBody);
    setCopiedField('body');
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#161616] border border-white/10 rounded-sm max-w-lg w-full flex flex-col shadow-2xl overflow-hidden text-white"
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 bg-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-amber-400" />
              <h4 className="text-xs font-black tracking-wider uppercase">
                HokmaNote 원장님 전달용 메일 초안
              </h4>
            </div>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* 본문 영역 */}
          <div className="p-5 space-y-4 text-xs">
            {/* 💡 주의 배너 */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-sm flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 text-amber-400 mt-0.5" />
              <div className="text-[11px] leading-relaxed text-amber-200/90 font-medium">
                <span className="font-bold text-amber-300 block">앱 인증 연동 확인 전 — 고객 전달 전 확인 필요</span>
                현재 단계는 서버의 설치 코드 발급 기능만 구현된 상태입니다. 실제 Mac 앱의 활성화 화면 연동을 확인한 후 원장님께 안내해 주세요.
              </div>
            </div>

            {/* 수신자 안내 */}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-bold block">수신자 (To)</label>
              <div className="p-2 bg-black/50 border border-white/10 rounded text-[11px] text-gray-400 font-mono">
                (원장님 이메일 주소를 직접 입력해 주세요)
              </div>
            </div>

            {/* 메일 제목 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-gray-400 font-bold">제목</label>
                <button
                  onClick={handleCopySubject}
                  className="flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {copiedField === 'subject' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span>{copiedField === 'subject' ? '복사됨' : '제목 복사'}</span>
                </button>
              </div>
              <div className="p-2.5 bg-black/60 border border-white/10 rounded font-bold text-[12px] text-white select-all">
                {mailSubject}
              </div>
            </div>

            {/* 메일 본문 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-gray-400 font-bold">본문 초안</label>
                <button
                  onClick={handleCopyBody}
                  disabled={!isInstallUrlConfigured}
                  className="flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                  {copiedField === 'body' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span>{copiedField === 'body' ? '복사됨' : '본문 복사'}</span>
                </button>
              </div>
              {!isInstallUrlConfigured && (
                <div className="text-[10px] text-red-400 font-medium">
                  ⚠️ 서버에 HOKMANOTE_INSTALL_URL이 설정되지 않아 본문 복사가 제한됩니다.
                </div>
              )}
              <pre className="p-3 bg-black/70 border border-white/10 rounded text-[11px] font-sans text-gray-300 leading-relaxed whitespace-pre-wrap select-all max-h-56 overflow-y-auto custom-scrollbar-v">
                {mailBody}
              </pre>
            </div>
          </div>

          {/* 푸터 */}
          <div className="flex items-center justify-end px-5 py-3 border-t border-white/10 bg-[#141414]">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded text-xs font-bold transition-all"
            >
              닫기
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
