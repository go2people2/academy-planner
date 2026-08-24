'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, ClipboardList, Plus, Trash2, Check, Percent } from 'lucide-react';
import { useModalEsc } from '@/hooks/useModalEsc';

interface TestItem {
  name: string;
  score: string;
}

interface TestEditorProps {
  title?: string;
  testData: string; // "Test A(80), Test B(90)" 형태의 문자열
  onUpdate: (formattedText: string, averageScore: number | null) => void;
  onClose: () => void;
}

export default function TestEditor({
  title = "Smart Test Editor", testData, onUpdate, onClose
}: TestEditorProps) {
  const [mounted, setMounted] = useState(false);

  // 💡 [Esc 닫기 공통 적용]
  useModalEsc({
    isOpen: true,
    onClose
  });
  const [tests, setTests] = useState<TestItem[]>([]);

  useEffect(() => {
    setMounted(true);
    // 💡 기존 문자열 파싱: "Test A(80), Test B(90)" -> [{name: "Test A", score: "80"}, ...]
    if (testData) {
      const items = testData.split(',').map(item => {
        const match = item.trim().match(/^(.*?)\s*\((\d+)\)$/);
        if (match) return { name: match[1], score: match[2] };
        return { name: item.trim(), score: '' };
      });
      setTests(items);
    } else {
      setTests([{ name: '', score: '' }]);
    }
  }, [testData]);

  if (!mounted) return null;

  const handleSave = () => {
    const validTests = tests.filter(t => t.name.trim());
    if (validTests.length === 0) {
      onUpdate('', null);
      onClose();
      return;
    }

    // 💡 텍스트 합치기
    // 💡 데일리 시트 셀 자체에는 순수 시험명 목록만 저장하여 옆 칸의 점수와 중복 노출되는 문제 해결
    const formattedText = validTests.map(t => t.name.trim()).join(', ');

    // 💡 평균 점수 계산
    const scores = validTests.map(t => parseInt(t.score)).filter(s => !isNaN(s));
    const average = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    onUpdate(formattedText, average);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="pointer-events-auto relative w-full max-w-[400px] bg-[#0a0a0a]/95 backdrop-blur-2xl border border-emerald-500/30 rounded-sm shadow-[0_40px_100px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden"
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/10 p-5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[2px] bg-emerald-600/30 flex items-center justify-center">
              <ClipboardList size={16} className="text-emerald-400" />
            </div>
            <div>
              <h4 className="font-black text-[12px] uppercase tracking-widest text-white">{title}</h4>
              <p className="text-[8px] text-emerald-400/60 font-bold uppercase mt-0.5">Multi-Test Performance Tracker</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-all"><X size={18} /></button>
        </div>

        {/* 리스트 */}
        <div className="p-6 space-y-4">
          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar-v">
            {tests.map((test, idx) => (
              <div key={idx} className="flex items-center gap-2 group">
                <div className="flex-1 bg-white/[0.03] border border-white/5 rounded-[2px] flex items-center px-3 py-2 group-hover:border-emerald-500/30 transition-all">
                  <input
                    type="text"
                    value={test.name}
                    placeholder="테스트 명칭"
                    onChange={(e) => {
                      const newTests = [...tests];
                      newTests[idx].name = e.target.value;
                      setTests(newTests);
                    }}
                    className="flex-1 bg-transparent border-none outline-none text-white text-[12px] font-bold"
                  />
                  <div className="w-px h-3 bg-white/10 mx-2" />
                  <div className="flex items-center gap-1 w-16">
                    <input
                      type="text"
                      value={test.score}
                      placeholder="점수"
                      onChange={(e) => {
                        const newTests = [...tests];
                        newTests[idx].score = e.target.value.replace(/[^0-9]/g, '');
                        setTests(newTests);
                      }}
                      className="w-full bg-transparent border-none outline-none text-emerald-400 text-[12px] font-black text-right"
                    />
                    <span className="text-[10px] font-bold text-gray-600">점</span>
                  </div>
                </div>
                <button
                  onClick={() => setTests(tests.filter((_, i) => i !== idx))}
                  className="w-8 h-8 flex items-center justify-center text-gray-700 hover:text-red-500 transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <button
              onClick={() => setTests([...tests, { name: '', score: '' }])}
              className="w-full py-3 border border-dashed border-white/10 rounded-[2px] text-[10px] font-black uppercase text-gray-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={14} /> Add Another Test
            </button>
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-emerald-600 py-4 rounded-sm font-black text-[12px] uppercase tracking-widest text-white shadow-xl shadow-emerald-900/20 hover:bg-emerald-500 transition-all flex items-center justify-center gap-2"
          >
            <Check size={16} strokeWidth={3} /> Save All Scores
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
