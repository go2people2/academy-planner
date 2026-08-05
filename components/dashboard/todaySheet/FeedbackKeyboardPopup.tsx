'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle } from 'lucide-react';

interface FeedbackKeyboardPopupProps {
  isOpen: boolean;
  statusMap: Record<string, { label: string; color: string }>;
  onSelectFeedback: (level: 'gradeA' | 'gradeB' | 'gradeC' | 'gradeD' | 'gradeE' | 'gradeF' | 'none') => void;
  onCloseFeedback: () => void;
  isLight?: boolean;
}

export function FeedbackKeyboardPopup({
  isOpen,
  statusMap,
  onSelectFeedback,
  onCloseFeedback,
  isLight = false
}: FeedbackKeyboardPopupProps) {
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setShake(false);
      setErrorMsg(null);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // 이미 다른 입력창(input, textarea 등)에 포커스가 잡혀있지 않을 때만 키보드 단축키 작동
      const targetTag = (e.target as HTMLElement)?.tagName?.toUpperCase();
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') {
        return;
      }

      const key = e.key.toLowerCase();
      const code = e.code;

      const isA = key === 'a' || key === '1' || key === 'ㅁ' || code === 'KeyA' || code === 'Digit1' || code === 'Numpad1';
      const isB = key === 'b' || key === '2' || key === 'ㅠ' || code === 'KeyB' || code === 'Digit2' || code === 'Numpad2';
      const isC = key === 'c' || key === '3' || key === 'ㅊ' || code === 'KeyC' || code === 'Digit3' || code === 'Numpad3';
      const isD = key === 'd' || key === '4' || key === 'ㅇ' || code === 'KeyD' || code === 'Digit4' || code === 'Numpad4';
      const isE = key === 'e' || key === '5' || key === 'ㄷ' || code === 'KeyE' || code === 'Digit5' || code === 'Numpad5';
      const isF = key === 'f' || key === '6' || key === 'ㄹ' || code === 'KeyF' || code === 'Digit6' || code === 'Numpad6';

      if (isA) {
        e.preventDefault();
        e.stopPropagation();
        onSelectFeedback('gradeA');
      } else if (isB) {
        e.preventDefault();
        e.stopPropagation();
        onSelectFeedback('gradeB');
      } else if (isC) {
        e.preventDefault();
        e.stopPropagation();
        onSelectFeedback('gradeC');
      } else if (isD) {
        e.preventDefault();
        e.stopPropagation();
        onSelectFeedback('gradeD');
      } else if (isE) {
        e.preventDefault();
        e.stopPropagation();
        onSelectFeedback('gradeE');
      } else if (isF) {
        e.preventDefault();
        e.stopPropagation();
        onSelectFeedback('gradeF');
      } else if (key === 'escape' || code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseFeedback();
      } else {
        // 💡 올바르지 않은 키 입력 시 좌우 쉐이크 애니메이션 & 경고 문구 표시
        // Shift, Control, Alt, Meta, Process 단독 입력은 무시
        if (['shift', 'control', 'alt', 'meta', 'tab', 'process'].includes(key)) return;

        e.preventDefault();
        e.stopPropagation();
        setShake(true);
        setErrorMsg('A~F 또는 1~6 키를 눌러주세요!');

        setTimeout(() => setShake(false), 300);
        setTimeout(() => setErrorMsg(null), 1600);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onSelectFeedback, onCloseFeedback]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 10, scale: 0.9 }}
        animate={
          shake
            ? { opacity: 1, x: [0, -8, 8, -6, 6, -2, 0], scale: 1 }
            : { opacity: 1, x: 0, scale: 1 }
        }
        exit={{ opacity: 0, x: 10, scale: 0.9 }}
        transition={{ duration: shake ? 0.35 : 0.15 }}
        className={`absolute right-full top-0 mr-2 flex flex-col items-end z-[100]`}
      >
        <div
          className={`flex items-center gap-1 p-1 rounded-md border shadow-2xl ${
            isLight
              ? 'bg-white border-gray-200 shadow-gray-400/20'
              : 'bg-[#1a1a1a] border-white/10 shadow-black/80'
          }`}
        >
          {(['gradeA', 'gradeB', 'gradeC', 'gradeD', 'gradeE', 'gradeF'] as const).map((k, idx) => (
            <button
              key={k}
              onClick={(e) => {
                e.stopPropagation();
                onSelectFeedback(k);
              }}
              title={`${statusMap[k].label} (키보드 ${statusMap[k].label} 또는 ${idx + 1})`}
              className={`w-7 h-7 rounded-[2px] flex flex-col items-center justify-center text-[10px] font-black transition-all hover:scale-110 ${statusMap[k].color} shadow-md relative group`}
            >
              <span>{statusMap[k].label}</span>
              <span className="text-[7px] opacity-60 font-mono -mt-1">{idx + 1}</span>
            </button>
          ))}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCloseFeedback();
            }}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors ml-0.5"
            title="닫기 (Esc)"
          >
            <X size={14} />
          </button>
        </div>

        {/* 💡 유효하지 않은 키 입력 시 시각 피드백 뱃지 */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.9 }}
              animate={{ opacity: 1, y: 4, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.9 }}
              className="mt-1 px-2.5 py-1 rounded bg-rose-600 text-white text-[9.5px] font-black tracking-tight shadow-lg flex items-center gap-1 whitespace-nowrap"
            >
              <AlertCircle size={11} className="text-white animate-pulse" />
              <span>{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
