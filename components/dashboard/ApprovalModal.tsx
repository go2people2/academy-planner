import { useState } from 'react';
import { X, Check, CheckSquare, Square, XCircle } from 'lucide-react';

export default function ApprovalModal({
  pendingStudents,
  onClose,
  onApprove,
  onReject
}: {
  pendingStudents: any[];
  onClose: () => void;
  onApprove: (studentIds: string[]) => Promise<void>;
  onReject: (studentIds: string[]) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(pendingStudents.map(s => s.id));
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleAll = () => {
    if (selectedIds.length === pendingStudents.length) setSelectedIds([]);
    else setSelectedIds(pendingStudents.map(s => s.id));
  };

  const toggleStudent = (id: string) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(x => x !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const handleApprove = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);
    await onApprove(selectedIds);
    setIsProcessing(false);
  };

  const handleReject = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm("선택한 학생의 제출을 반려하시겠습니까? (학생이 다시 수정할 수 있게 됩니다)")) return;
    setIsProcessing(true);
    await onReject(selectedIds);
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Check className="text-emerald-400" />
              학생 제출 검사 대기록
            </h2>
            <p className="text-[11px] text-gray-400 mt-1">총 {pendingStudents.length}명의 학생이 제출했습니다.</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2">
          <button onClick={toggleAll} className="flex items-center gap-2 mb-4 text-emerald-400 text-[11px] font-black uppercase hover:text-emerald-300">
            {selectedIds.length === pendingStudents.length ? <CheckSquare size={16} /> : <Square size={16} />}
            전체 선택
          </button>
          
          {pendingStudents.map(s => {
            const isSelected = selectedIds.includes(s.id);
            return (
              <div 
                key={s.id} 
                onClick={() => toggleStudent(s.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-4 ${
                  isSelected ? 'bg-emerald-600/10 border-emerald-500/30' : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className={`shrink-0 ${isSelected ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                </div>
                <div>
                  <h3 className="text-[14px] font-black text-white">{s.name}</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">{s.school} {s.course}</p>
                </div>
                <div className="ml-auto text-right text-[11px]">
                  <p className="text-gray-400">선택해서 상세 확인 가능</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 sm:p-6 border-t border-white/10 flex gap-3">
          <button 
            onClick={handleReject} 
            disabled={selectedIds.length === 0 || isProcessing}
            className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black rounded-xl transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <XCircle size={18} />
            선택 반려 (퇴짜)
          </button>
          <button 
            onClick={handleApprove} 
            disabled={selectedIds.length === 0 || isProcessing}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <Check size={18} />
            {selectedIds.length}명 일괄 검사 완료
          </button>
        </div>
      </div>
    </div>
  );
}
