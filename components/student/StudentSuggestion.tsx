'use client';

import { MessageSquare, Loader2, Send } from 'lucide-react';

interface StudentSuggestionProps {
  suggestion: string;
  setSuggestion: (value: string) => void;
  selectedDate: string;
  handleSuggestionSubmit: () => void;
  isSaving: boolean;
}

export default function StudentSuggestion({ 
  suggestion, 
  setSuggestion, 
  selectedDate, 
  handleSuggestionSubmit, 
  isSaving 
}: StudentSuggestionProps) {
  return (
    <div className="space-y-6 pt-6 border-t border-white/10">
      <div className="flex items-center gap-2 px-1">
        <MessageSquare size={16} className="text-amber-500" />
        <h3 className="text-[11px] font-black uppercase tracking-widest text-white">선생님께 건의사항</h3>
      </div>
      <div className="relative group">
        <textarea 
          value={suggestion} 
          onChange={(e) => setSuggestion(e.target.value)} 
          placeholder="선생님께 하고 싶은 말이나 건의사항을 적어주세요." 
          className="w-full bg-[#121212] border border-white/15 rounded-lg p-5 text-sm text-white placeholder:text-gray-600 outline-none focus:border-amber-500 transition-all resize-none min-h-[120px]" 
        />
        <div className="absolute bottom-4 right-4 flex items-center gap-3">
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">
            {selectedDate.replace(/-/g, '.')}
          </span>
          <button 
            onClick={handleSuggestionSubmit} 
            disabled={!suggestion.trim() || isSaving} 
            className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-20 text-white text-[11px] font-black rounded uppercase tracking-widest transition-all shadow-lg shadow-amber-900/20 flex items-center gap-2"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} 
            전송하기
          </button>
        </div>
      </div>
    </div>
  );
}
