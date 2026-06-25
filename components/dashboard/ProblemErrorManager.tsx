'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ProblemError, TodoItem } from '@/types/dashboard';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, CheckCircle2, Clock, Check, Loader2, RefreshCw, Trash2, Edit3, Save, ExternalLink, Filter, X, Search 
} from 'lucide-react';
import AddProblemErrorModal from './AddProblemErrorModal';

interface ProblemErrorManagerProps {
  academyInfo: any;
  students: any[];
  teachers: any[];
  currentUser: any;
}

export default function ProblemErrorManager({
  academyInfo,
  students = [],
  teachers = [],
  currentUser
}: ProblemErrorManagerProps) {
  const [errors, setErrors] = useState<ProblemError[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedError, setSelectedError] = useState<ProblemError | null>(null);
  
  // 필터 및 검색 상태
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // 상세 작업 동적 상태
  const [todoList, setTodoList] = useState<TodoItem[]>([]);
  const [newTodoLabel, setNewTodoLabel] = useState('');
  const [status, setStatus] = useState<ProblemError['status']>('제보됨');
  const [correctedContent, setCorrectedContent] = useState('');
  const [resolverName, setResolverName] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [description, setDescription] = useState('');
  const [errorType, setErrorType] = useState<string>('');
  const [pageNumber, setPageNumber] = useState('');
  const [problemId, setProblemId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchErrors = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const { data, error } = await supabase
        .from('ams_problem_errors')
        .select('*')
        .eq('academy_id', academyInfo.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setErrors(data || []);

      // 만약 기존에 선택되어 있던 항목이 있다면 업데이트된 상태로 재매핑
      if (selectedError) {
        const updated = (data || []).find(e => e.id === selectedError.id);
        if (updated) {
          setSelectedError(updated);
        }
      }
    } catch (e) {
      console.error('Error fetching problem errors:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, []);

  // ESC 키를 눌렀을 때 상세창 닫기 단축키 바인딩
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 에러 항목 선택 시 로컬 작업 상태 복사
  const handleSelectError = (err: ProblemError) => {
    setSelectedError(err);
    setTodoList(err.todo_list || []);
    setStatus(err.status);
    setCorrectedContent(err.corrected_content || '');
    setResolverName(err.resolver_name || '');
    setReporterName(err.reporter_name || '');
    setDescription(err.description || '');
    setErrorType(err.error_type || '기타');
    setPageNumber(err.page_number || '');
    setProblemId(err.problem_id || '');
  };

  const handleStatusChange = (newStatus: ProblemError['status']) => {
    setStatus(newStatus);
    if (newStatus === '수정완료' && !resolverName.trim() && currentUser?.name) {
      setResolverName(currentUser.name);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedError) return;
    if (!problemId.trim()) {
      alert('문제 번호는 필수 입력 항목입니다.');
      return;
    }
    setIsSaving(true);

    try {
      const updates: any = {
        todo_list: todoList,
        status: status,
        corrected_content: correctedContent.trim() || null,
        resolved_at: status === '수정완료' ? new Date().toISOString() : null,
        resolver_name: resolverName.trim() || null,
        reporter_name: reporterName.trim() || '미명',
        description: description.trim() || '내용 없음',
        error_type: errorType,
        page_number: pageNumber.trim() || null,
        problem_id: problemId.trim()
      };

      const { error } = await supabase
        .from('ams_problem_errors')
        .update(updates)
        .eq('id', selectedError.id);

      if (error) throw error;

      await fetchErrors(true);
      alert('정오표 및 작업 상태가 성공적으로 반영되었습니다.');
    } catch (e: any) {
      console.error('Error updating error report:', e);
      alert('저장 중 문제가 발생했습니다: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteError = async (id: string) => {
    if (!confirm('이 제보 기록을 완전히 삭제하시겠습니까? (복구 불가)')) return;
    try {
      const { error } = await supabase
        .from('ams_problem_errors')
        .delete()
        .eq('id', id);

      if (error) {
        alert('삭제 실패: ' + error.message);
        return;
      }
      
      setSelectedError(null);
      await fetchErrors(true);
      alert('삭제 완료되었습니다.');
    } catch (e: any) {
      console.error('Error deleting error report:', e);
      alert('삭제 중 문제가 발생했습니다: ' + (e.message || e));
    }
  };

  // 필터링 및 검색 적용 목록
  const filteredErrors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return errors.filter(err => {
      const matchStatus = statusFilter === 'all' || err.status === statusFilter;
      const matchType = typeFilter === 'all' || err.error_type === typeFilter;
      
      if (!query) return matchStatus && matchType;
      
      const matchSearch = 
        (err.book_name || '').toLowerCase().includes(query) ||
        (err.problem_id || '').toLowerCase().includes(query) ||
        (err.page_number || '').toLowerCase().includes(query) ||
        (err.description || '').toLowerCase().includes(query) ||
        (err.reporter_name || '').toLowerCase().includes(query) ||
        (err.resolver_name || '').toLowerCase().includes(query);
        
      return matchStatus && matchType && matchSearch;
    });
  }, [errors, statusFilter, typeFilter, searchQuery]);

  const getStatusBadge = (status: ProblemError['status']) => {
    switch (status) {
      case '제보됨':
        return <span className="px-1.5 py-0.5 rounded text-[11px] font-black bg-rose-500/10 border border-rose-500/30 text-rose-400">제보됨</span>;
      case '검토중':
        return <span className="px-1.5 py-0.5 rounded text-[11px] font-black bg-amber-500/10 border border-amber-500/30 text-amber-400">검토중</span>;
      case '수정완료':
        return <span className="px-1.5 py-0.5 rounded text-[11px] font-black bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">수정완료</span>;
      case '보류':
        return <span className="px-1.5 py-0.5 rounded text-[11px] font-black bg-gray-500/20 border border-gray-500/30 text-gray-400">보류</span>;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case '정답 오류':
        return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 whitespace-nowrap">정답 오류</span>;
      case '오타/발문 오류':
        return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 whitespace-nowrap">오타/발문 오류</span>;
      case '그림 오류':
        return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 whitespace-nowrap">그림 오류</span>;
      case '해설/영상 오류':
        return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 whitespace-nowrap">해설/영상 오류</span>;
      default:
        return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-500/15 border border-slate-500/20 text-slate-400 whitespace-nowrap">{type || '기타'}</span>;
    }
  };

  const countDoneTodos = (err: ProblemError) => {
    const list = err.todo_list || [];
    return list.filter(t => t.done).length;
  };

  const getProgressPercent = (err: ProblemError) => {
    const list = err.todo_list || [];
    if (list.length === 0) return 0;
    const done = countDoneTodos(err);
    return Math.round((done / list.length) * 100);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full min-h-0 bg-[#080808] relative overflow-hidden">
      {/* 왼쪽 메인 리스트 영역 */}
      <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 min-h-0 overflow-y-auto custom-scrollbar-v">
        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
          <div className="text-left">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={20} />
              교재 및 기출문제 오류 정오표 관리
            </h2>
            <p className="text-xs text-gray-500 mt-1">학생들이 제보한 오류를 추적하고 HWP/PDF/영상 등 후속 조치를 검토합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsAddModalOpen(true)} 
              className="py-2 px-3.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-all border border-blue-400 flex items-center gap-1.5 text-xs font-bold shadow-lg shadow-blue-900/20"
            >
              ➕ 새 오류 등록
            </button>
            <button 
              onClick={() => fetchErrors(true)} 
              disabled={isRefreshing}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all border border-white/10 flex items-center gap-1.5 text-xs font-bold"
            >
              {isRefreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              새로고침
            </button>
          </div>
        </div>

        {/* 필터 툴바 */}
        <div className="flex flex-wrap items-center gap-4 bg-white/[0.02] border border-white/5 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-1.5 text-xs font-black text-gray-400 uppercase tracking-widest">
            <Filter size={12} />
            Filter:
          </div>
          
          {/* 상태 필터 */}
          <div className="flex flex-wrap gap-1">
            {['all', '제보됨', '검토중', '수정완료', '보류'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-[4px] text-[10px] font-black transition-all ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                {st === 'all' ? '전체 상태' : st}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-white/10 hidden md:block" />

          {/* 종류 필터 */}
          <div className="flex flex-wrap gap-1">
            {['all', '정답 오류', '오타/발문 오류', '그림 오류', '해설/영상 오류', '기타'].map(tp => (
              <button
                key={tp}
                onClick={() => setTypeFilter(tp)}
                className={`px-3 py-1 rounded-[4px] text-[10px] font-black transition-all ${
                  typeFilter === tp
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                {tp === 'all' ? '전체 유형' : tp}
              </button>
            ))}
          </div>

          {/* 실시간 통합 검색창 */}
          <div className="relative flex-1 min-w-[200px] md:max-w-[260px] md:ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
            <input 
              type="text" 
              placeholder="교재명, 문항, 제보자, 조치자 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-[6px] py-1.5 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-blue-500 transition-all font-bold placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* 오류 목록 테이블 */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600 py-20">
            <Loader2 size={32} className="animate-spin mb-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Loading Error Reports...</p>
          </div>
        ) : filteredErrors.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl py-20 text-gray-500">
            <CheckCircle2 size={32} className="text-emerald-500/30 mb-4" />
            <p className="text-sm font-bold">제보된 오류 내역이 없습니다.</p>
            <p className="text-xs text-gray-600 mt-1">모든 문제집과 기출문제가 무결합니다!</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-white/10 rounded-xl bg-black/10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.05] border-b border-white/10 text-[12px] font-bold text-gray-200 tracking-wider divide-x divide-white/10">
                  <th className="py-2 px-2 w-[80px] text-center">상태</th>
                  <th className="py-2 px-2 w-[200px] max-w-[200px] text-center">교재/기출명</th>
                  <th className="py-2 px-2 w-[90px] text-center">위치/문항</th>
                  <th className="py-2 px-2 w-[90px] max-w-[90px] text-center">유형</th>
                  <th className="py-2 px-2 text-center">오류 설명</th>
                  <th className="py-2 px-2 w-[130px] max-w-[130px] text-center">제보자 / 조치자</th>
                  <th className="py-2 px-2 w-[110px] max-w-[110px] text-center">진행현황</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[13px] text-gray-200 font-medium">
                {filteredErrors.map((err) => {
                  const isSelected = selectedError?.id === err.id;
                  const doneCount = countDoneTodos(err);
                  return (
                    <tr 
                      key={err.id}
                      onClick={() => handleSelectError(err)}
                      className={`hover:bg-white/[0.03] cursor-pointer transition-all active:scale-[0.99] divide-x divide-white/5 ${
                        isSelected ? 'bg-blue-600/10 hover:bg-blue-600/15' : ''
                      }`}
                    >
                      <td className="py-1.5 px-2 text-center">{getStatusBadge(err.status)}</td>
                      <td className="py-1.5 px-2 font-bold text-white w-[200px] max-w-[200px] truncate" title={err.book_name}>
                        {err.book_name}
                      </td>
                      <td className="py-1.5 px-2 tabular-nums font-bold">
                        {err.page_number && (
                          <>
                            <span className="text-blue-400">{err.page_number}</span>
                            <span className="text-gray-600 mx-1">/</span>
                          </>
                        )}
                        <span className="text-amber-500">{err.problem_id}번</span>
                      </td>
                      <td className="py-1.5 px-2 w-[90px] max-w-[90px] text-center">
                        {getTypeBadge(err.error_type)}
                      </td>
                      <td className="py-1.5 px-2 truncate max-w-[350px] text-gray-200" title={err.description}>
                        {err.description}
                      </td>
                      <td className="py-1.5 px-2 text-gray-400 font-bold w-[130px] max-w-[130px] whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-[12px]">{err.reporter_name}</span>
                          {err.resolver_name && (
                            <span className="text-[10px] text-emerald-500 font-normal flex items-center gap-0.5 bg-emerald-500/10 border border-emerald-500/30 px-1 py-0.2 rounded">
                              <span>🔧</span> {err.resolver_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 w-[110px] max-w-[110px]">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="flex-1 bg-white/5 h-1.5 rounded-full overflow-hidden min-w-[40px] border border-white/10 shadow-inner">
                            <div 
                              className={`h-full transition-all duration-500 ${
                                err.status === '수정완료' ? 'bg-emerald-500' : 'bg-blue-500'
                              }`} 
                              style={{ width: `${getProgressPercent(err)}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-black text-gray-500 tabular-nums">
                            ({doneCount}/{err.todo_list?.length || 0})
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 오른쪽 상세 및 후속조치 에디터 영역 (오버레이로 덮으면서 서서히 등장) */}
      <AnimatePresence>
        {selectedError && (
          <motion.div 
            initial={{ x: 380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 380, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute right-0 top-0 bottom-0 w-full sm:w-[380px] bg-[#0c0c0e]/95 backdrop-blur-md border-l border-white/10 p-6 flex flex-col shrink-0 overflow-y-auto custom-scrollbar-v z-30 shadow-2xl shadow-black/80"
          >
            <div className="space-y-6 text-left flex-1 flex flex-col">
              <div className="flex items-start justify-between border-b border-white/5 pb-4">
                <div>
                  <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest block mb-1">Error Details</span>
                  <h3 className="text-base font-black text-white">{selectedError.book_name}</h3>
                  <p className="text-xs font-bold mt-1.5 flex items-center tabular-nums text-left">
                    {pageNumber && (
                      <>
                        <span className="text-blue-400">{pageNumber}</span>
                        <span className="text-gray-600 mx-1">/</span>
                      </>
                    )}
                    <span className="text-amber-500">{problemId}번</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setSelectedError(null)}
                    className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg border border-white/10 transition-all hover:scale-105"
                    title="상세창 닫기"
                  >
                    <X size={14} />
                  </button>
                  <button 
                    onClick={() => handleDeleteError(selectedError.id)}
                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-all hover:scale-105"
                    title="제보 기록 완전히 지우기"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

            {/* 제보 정보 요약 */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-2.5 text-[11px] text-gray-400 font-bold">
              <div className="grid grid-cols-2 gap-3 pb-2.5 border-b border-white/5">
                <div className="flex flex-col gap-1 text-left">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider">페이지</span>
                  <input
                    type="text"
                    value={pageNumber}
                    onChange={(e) => setPageNumber(e.target.value)}
                    placeholder="예: 42p (선택)"
                    className="w-full bg-black/35 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none font-bold placeholder:text-gray-600"
                  />
                </div>
                <div className="flex flex-col gap-1 text-left">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider">문제 번호</span>
                  <input
                    type="text"
                    value={problemId}
                    onChange={(e) => setProblemId(e.target.value)}
                    placeholder="예: 5번"
                    className="w-full bg-black/35 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none font-bold placeholder:text-gray-600"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span>제보자</span>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="제보자 이름..."
                  className="bg-black/35 border border-white/10 rounded px-2 py-0.5 text-xs text-white focus:border-blue-500 outline-none text-right font-bold w-[120px] placeholder:text-gray-600"
                />
              </div>
              <div className="flex justify-between items-center gap-2">
                <span>오류 유형</span>
                <select
                  value={errorType}
                  onChange={(e) => setErrorType(e.target.value)}
                  className="bg-black/35 border border-white/10 rounded px-2 py-0.5 text-xs text-amber-500 focus:border-blue-500 outline-none text-right font-bold w-[130px] cursor-pointer"
                >
                  {['정답 오류', '오타/발문 오류', '그림 오류', '해설/영상 오류', '기타'].map(type => (
                    <option key={type} value={type} className="bg-[#121214] text-white text-left font-sans">
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-between">
                <span>제보 일시</span>
                <span className="text-gray-300 tabular-nums">
                  {new Date(selectedError.created_at).toLocaleString('ko-KR', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="pt-2 border-t border-white/5 flex flex-col">
                <span className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">제보 내용</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="제보 내용 수정..."
                  rows={3}
                  className="w-full bg-black/35 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:border-blue-500 outline-none transition-colors resize-none font-medium leading-snug"
                />
              </div>
            </div>

            {/* 상태 변경 */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">진행 상태 설정</label>
              <div className="grid grid-cols-4 gap-1 bg-black/30 p-1 rounded-lg border border-white/5">
                {(['제보됨', '검토중', '수정완료', '보류'] as const).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    className={`py-1.5 rounded-[4px] text-[10px] font-black transition-all ${
                      status === st
                        ? st === '수정완료' ? 'bg-emerald-600 text-white shadow' :
                          st === '검토중' ? 'bg-amber-600 text-white shadow' :
                          st === '제보됨' ? 'bg-rose-600 text-white shadow' : 'bg-gray-600 text-white shadow'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* 수정 완료자 입력란 */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">수정 완료자 (조치 담당)</label>
              <input
                type="text"
                value={resolverName}
                onChange={(e) => setResolverName(e.target.value)}
                placeholder="수정을 완료한 교사 이름 입력..."
                className="w-full bg-black/35 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:border-blue-500 outline-none transition-colors placeholder:text-gray-600 font-bold"
              />
            </div>

            {/* 후속 조치 체크리스트 */}
            <div className="space-y-3 bg-black/20 border border-white/5 rounded-xl p-4">
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-wider flex items-center justify-between">
                <span>🛠️ 후속 조치 체크리스트</span>
                <span className="text-[9px] text-gray-500 tabular-nums">
                  ({todoList.filter(t => t.done).length} / {todoList.length} 완료)
                </span>
              </label>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar-v">
                {todoList.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => {
                      setTodoList(prev => prev.map(t => t.id === item.id ? { ...t, done: !t.done } : t));
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all group ${
                      item.done
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                        : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/[0.08] hover:text-gray-300'
                    }`}
                  >
                    <span className="text-xs font-bold truncate pr-2">{item.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTodoList(prev => prev.filter(t => t.id !== item.id));
                        }}
                        className="p-1 hover:bg-white/10 text-gray-500 hover:text-red-400 rounded transition-all opacity-0 group-hover:opacity-100"
                        title="이 조치 삭제"
                      >
                        <X size={12} />
                      </button>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        item.done ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-gray-600 bg-black/25'
                      }`}>
                        {item.done && <Check size={10} strokeWidth={4} />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 동적 항목 추가 인풋 */}
              <div className="flex gap-2 pt-2 border-t border-white/5">
                <input
                  type="text"
                  value={newTodoLabel}
                  onChange={(e) => setNewTodoLabel(e.target.value)}
                  placeholder="새 후속 작업 직접 추가..."
                  className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-gray-600 outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newTodoLabel.trim()) return;
                    const newId = `custom_${Date.now()}`;
                    setTodoList(prev => [
                      ...prev, 
                      { id: newId, label: newTodoLabel.trim(), done: false }
                    ]);
                    setNewTodoLabel('');
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black rounded border border-white/10 transition-colors"
                >
                  추가
                </button>
              </div>
            </div>

            {/* 정오표 내용 입력 */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">정오표 내용 (학생 노출용)</label>
              <textarea
                value={correctedContent}
                onChange={(e) => setCorrectedContent(e.target.value)}
                placeholder="예: 발문 중 '5cm'를 '6cm'로 수정하여 문제 풀이. 정답 3번 ➡️ 5번으로 정정함."
                rows={3}
                className="w-full bg-black/35 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:border-blue-500 outline-none transition-colors resize-none"
              />
            </div>

            {/* 저장 버튼 */}
            <div className="pt-2 mt-auto">
              <button
                type="button"
                onClick={handleUpdateStatus}
                disabled={isSaving}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black rounded-lg uppercase tracking-widest transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                조치 내역 저장하기
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

      {/* 새 오류 등록 모달 */}
      <AddProblemErrorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        teacherName={currentUser?.name || ''}
        academyId={academyInfo.id}
        onSuccess={() => fetchErrors(true)}
      />
    </div>
  );
}
