'use client';

import { MessageSquare, Loader2, Send, CheckCircle2, Clock } from 'lucide-react';

interface StudentSuggestionProps {
  suggestion: string;
  setSuggestion: (value: string) => void;
  selectedDate: string;
  handleSuggestionSubmit: () => void;
  isSaving: boolean;
  mySuggestions?: any[]; // 💡 추가
}

export default function StudentSuggestion({ 
  suggestion, 
  setSuggestion, 
  selectedDate, 
  handleSuggestionSubmit, 
  isSaving,
  mySuggestions = [] 
}: StudentSuggestionProps) {
  return (
    <div className="space-y-4 pt-6 border-t border-white/10">
      <div className="flex items-center gap-2 px-1">
        <MessageSquare size={14} className="text-amber-500" />
        <h3 className="text-[10px] font-black uppercase tracking-widest text-white">선생님께 건의사항</h3>
      </div>
      
      <div className="relative group">
        <textarea 
          value={suggestion} 
          onChange={(e) => setSuggestion(e.target.value)} 
          placeholder="선생님께 하고 싶은 말이나 건의사항을 적어주세요." 
          className="w-full bg-[#121212] border border-white/15 rounded-lg p-4 text-sm text-white placeholder:text-gray-600 outline-none focus:border-amber-500 transition-all resize-none min-h-[80px]" 
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-3">
          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
            {selectedDate.replace(/-/g, '.')}
          </span>
          <button 
            onClick={handleSuggestionSubmit} 
            disabled={!suggestion.trim() || isSaving} 
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-20 text-white text-[10px] font-black rounded uppercase tracking-widest transition-all shadow-lg shadow-amber-900/20 flex items-center gap-2"
          >
            {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />} 
            전송
          </button>
        </div>
      </div>

      {/* 💡 건의 히스토리 리스트 (제목 제거 및 간격 축소) */}
      {mySuggestions.length > 0 && (
        <div className="mt-2 divide-y divide-white/5 border-t border-white/5">
          {mySuggestions.map((sug) => (
            <div key={sug.id} className="py-2 px-1 flex items-start gap-2.5 group transition-colors hover:bg-white/[0.02]">
              <div className="mt-0.5 shrink-0">
                {sug.is_completed ? (
                  <CheckCircle2 size={10} className="text-emerald-500/50" />
                ) : (
                  <Clock size={10} className="text-amber-500/50" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className={`text-[11px] leading-snug break-all ${sug.is_completed ? 'text-gray-600 italic' : 'text-gray-300'}`}>
                    {sug.content}
                  </p>
                  <span className="shrink-0 text-[8px] font-bold text-gray-800 tabular-nums pt-0.5">
                    {new Date(sug.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
