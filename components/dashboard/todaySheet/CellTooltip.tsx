'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, MessageSquare } from 'lucide-react';

export type StudentSuggestion = {
  id?: string | number;
  start_date?: string | null;
  is_completed?: boolean | null;
  content?: string | null;
};

interface CellTooltipProps {
  activeTooltip: 'note' | 'suggestion' | null;
  tooltipCoords: { top: number; left: number; right: number; bottom: number };
  managementNotes?: string;
  suggestions?: StudentSuggestion[];
}

export const CellTooltip: React.FC<CellTooltipProps> = ({
  activeTooltip,
  tooltipCoords,
  managementNotes,
  suggestions,
}) => {
  if (!activeTooltip || typeof window === 'undefined') return null;

  return (
    <>
      {activeTooltip === 'note' && managementNotes && createPortal(
        <AnimatePresence mode="wait">
          <motion.div 
            initial={{ opacity: 0, y: tooltipCoords.top < 350 ? 10 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ 
              position: 'fixed',
              top: tooltipCoords.top < 350 ? tooltipCoords.bottom + 8 : 'auto',
              bottom: tooltipCoords.top < 350 ? 'auto' : (window.innerHeight - tooltipCoords.top) + 8,
              left: Math.max(16, Math.min(tooltipCoords.right - 320, window.innerWidth - 336)),
              zIndex: 9999
            }}
            className="w-80 p-5 bg-amber-50 text-amber-950 text-[13px] font-normal rounded-lg shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-2 border-amber-200 ring-4 ring-black/20 pointer-events-none"
          >
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-200">
              <AlertTriangle size={14} className="text-amber-600 animate-bounce" />
              <span className="text-[10px] uppercase tracking-widest text-amber-600 font-normal">Student Management Alert</span>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed text-[14px]">"{managementNotes}"</p>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {activeTooltip === 'suggestion' && suggestions && suggestions.length > 0 && createPortal(
        <AnimatePresence mode="wait">
          <motion.div 
            initial={{ opacity: 0, y: tooltipCoords.top < 350 ? 10 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ 
              position: 'fixed',
              top: tooltipCoords.top < 350 ? tooltipCoords.bottom + 8 : 'auto',
              bottom: tooltipCoords.top < 350 ? 'auto' : (window.innerHeight - tooltipCoords.top) + 8,
              left: Math.max(16, Math.min(tooltipCoords.right - 320, window.innerWidth - 336)),
              zIndex: 9999
            }}
            className="w-80 p-5 bg-blue-950/95 text-blue-100 text-[13px] font-normal rounded-lg shadow-[0_30px_60px_rgba(0,0,0,0.6)] border-2 border-blue-500/50 backdrop-blur-md pointer-events-none"
          >
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-800/60">
              <MessageSquare size={14} className="text-blue-400" />
              <span className="text-[10px] uppercase tracking-widest text-blue-400 font-normal">학생 건의사항 / 의견</span>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar">
              {suggestions.map((sug: StudentSuggestion, idx: number) => (
                <div key={sug.id || idx} className="bg-blue-900/40 p-2.5 rounded border border-blue-800/40">
                  <div className="flex justify-between items-center text-[10px] text-blue-300 font-normal mb-1">
                    <span>{sug.start_date || '날짜미상'}</span>
                    <span>{sug.is_completed ? '✅ 조치완료' : '⏳ 미조치'}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-blue-100">{sug.content}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default CellTooltip;
