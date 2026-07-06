'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2, Plus, Loader2 } from 'lucide-react';

interface ChecklistTabProps {
  students: any[];
  academyInfo: any;
}

export function ChecklistTab({ students, academyInfo }: ChecklistTabProps) {
  const [topics, setTopics] = useState<any[]>([]);
  const [items, setItems] = useState<Record<string, Record<string, any>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');

  // 1. 데이터 조회
  const fetchData = async () => {
    if (!academyInfo?.id) return;
    setIsLoading(true);
    try {
      // 1) 주제 조회
      const { data: topicsData, error: err1 } = await supabase
        .from('ams_checklist_topics')
        .select('*')
        .eq('academy_id', academyInfo.id)
        .order('created_at', { ascending: true });

      if (err1) throw err1;
      setTopics(topicsData || []);

      if (topicsData && topicsData.length > 0) {
        const topicIds = topicsData.map(t => t.id);
        
        // 2) 아이템 조회
        const { data: itemsData, error: err2 } = await supabase
          .from('ams_checklist_items')
          .select('*')
          .in('topic_id', topicIds);

        if (err2) throw err2;

        // items 상태 재조합 [studentId][topicId]
        const itemsMap: Record<string, Record<string, any>> = {};
        (itemsData || []).forEach(item => {
          if (!itemsMap[item.student_id]) {
            itemsMap[item.student_id] = {};
          }
          itemsMap[item.student_id][item.topic_id] = item;
        });
        setItems(itemsMap);
      } else {
        setItems({});
      }
    } catch (err) {
      console.error('Checklist Fetch Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [academyInfo?.id]);

  // 2. 체크 토글 핸들러
  const handleToggleCheck = async (studentId: string, topicId: string, currentVal: any) => {
    const nextChecked = !currentVal.is_checked;

    // 1) 로컬 상태 낙관적 갱신
    setItems(prev => {
      const studentMap = { ...(prev[studentId] || {}) };
      studentMap[topicId] = {
        ...currentVal,
        is_checked: nextChecked,
        student_id: studentId,
        topic_id: topicId
      };
      return { ...prev, [studentId]: studentMap };
    });

    // 2) DB Upsert
    try {
      const payload: any = {
        topic_id: topicId,
        student_id: studentId,
        is_checked: nextChecked,
        memo: currentVal.memo || ''
      };
      if (currentVal.id) payload.id = currentVal.id;

      const { data, error } = await supabase
        .from('ams_checklist_items')
        .upsert([payload], { onConflict: 'student_id,topic_id' })
        .select();

      if (error) throw error;
      
      // DB 반환 ID 동기화
      if (data && data[0]) {
        setItems(prev => {
          const studentMap = { ...(prev[studentId] || {}) };
          studentMap[topicId] = data[0];
          return { ...prev, [studentId]: studentMap };
        });
      }
    } catch (err) {
      console.error('Toggle Check Error:', err);
      alert('체크 상태 저장에 실패했습니다.');
      fetchData(); // 롤백 복구
    }
  };

  // 3. 메모 저장 핸들러
  const handleSaveMemo = async (studentId: string, topicId: string, nextMemo: string, currentVal: any) => {
    if ((currentVal.memo || '') === nextMemo) return; // 변경점 없으면 취소

    // 1) 로컬 상태 낙관적 갱신
    setItems(prev => {
      const studentMap = { ...(prev[studentId] || {}) };
      studentMap[topicId] = {
        ...currentVal,
        memo: nextMemo,
        student_id: studentId,
        topic_id: topicId
      };
      return { ...prev, [studentId]: studentMap };
    });

    // 2) DB Upsert
    try {
      const payload: any = {
        topic_id: topicId,
        student_id: studentId,
        is_checked: currentVal.is_checked || false,
        memo: nextMemo
      };
      if (currentVal.id) payload.id = currentVal.id;

      const { data, error } = await supabase
        .from('ams_checklist_items')
        .upsert([payload], { onConflict: 'student_id,topic_id' })
        .select();

      if (error) throw error;
      
      if (data && data[0]) {
        setItems(prev => {
          const studentMap = { ...(prev[studentId] || {}) };
          studentMap[topicId] = data[0];
          return { ...prev, [studentId]: studentMap };
        });
      }
    } catch (err) {
      console.error('Save Memo Error:', err);
      alert('메모 저장에 실패했습니다.');
      fetchData(); // 롤백 복구
    }
  };

  // 4. 주제 추가 핸들러
  const handleAddTopic = async () => {
    if (!newTopicTitle.trim() || !academyInfo?.id) return;
    setIsAddingTopic(true);
    try {
      const { error } = await supabase
        .from('ams_checklist_topics')
        .insert([{
          academy_id: academyInfo.id,
          title: newTopicTitle.trim()
        }]);

      if (error) throw error;
      setNewTopicTitle('');
      await fetchData();
    } catch (err) {
      console.error('Add Topic Error:', err);
      alert('체크 항목 주제 추가에 실패했습니다.');
    } finally {
      setIsAddingTopic(false);
    }
  };

  // 5. 주제 삭제 핸들러
  const handleDeleteTopic = async (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    if (!confirm(`⚠️ "${topic.title}" 체크 항목을 정말 삭제하시겠습니까?\n이 항목에 입력된 모든 학생의 체크 정보와 메모가 완전히 삭제됩니다.`)) return;

    try {
      const { error } = await supabase
        .from('ams_checklist_topics')
        .delete()
        .eq('id', topicId);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Delete Topic Error:', err);
      alert('체크 항목 삭제에 실패했습니다.');
    }
  };

  const [colWidths, setColWidths] = useState<Record<string, number>>({
    name: 90
  });

  const handleResizeStart = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || (colKey.endsWith('-check') ? 35 : colKey.endsWith('-memo') ? 85 : 90);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(colKey.endsWith('-check') ? 25 : colKey.endsWith('-memo') ? 40 : 50, startWidth + deltaX);
      setColWidths(prev => ({
        ...prev,
        [colKey]: newWidth
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getTableWidth = () => {
    const nameW = colWidths.name || 90;
    let sum = nameW + 40;
    topics.forEach(t => {
      sum += (colWidths[`${t.id}-check`] || 35) + (colWidths[`${t.id}-memo`] || 85);
    });
    return sum;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="animate-spin text-blue-500" size={24} />
        <span className="text-xs font-bold text-gray-400">체크리스트 정보 로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 컨트롤 영역 */}
      <div className="flex justify-between items-center bg-[#0d0d0d] border border-white/5 p-3 rounded-[3px] shadow-sm">
        <div className="flex flex-col gap-0.5">
          <h4 className="text-[12px] font-black text-gray-200">📋 실시간 진척도 체크리스트</h4>
          <p className="text-[9px] text-gray-500 font-bold">학생 개별로 기말고사, 오답노트, 안내문 수거 등의 완료 현황을 기록하세요.</p>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="text" 
            value={newTopicTitle}
            onChange={(e) => setNewTopicTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
            placeholder="예: 기말고사 시험지 수거"
            className="bg-[#151515] border border-white/5 rounded-[2px] px-3 py-1.5 text-[11px] font-bold text-white outline-none focus:border-blue-500 transition-all w-[180px]"
            disabled={isAddingTopic}
          />
          <button
            onClick={handleAddTopic}
            disabled={isAddingTopic || !newTopicTitle.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-[2px] text-[10px] font-black hover:bg-blue-500 disabled:bg-gray-700 transition-all shadow-md shadow-blue-500/10 cursor-pointer"
          >
            {isAddingTopic ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            항목 추가
          </button>
        </div>
      </div>

      {/* 테이블 래퍼 */}
      <div className="border border-white/5 rounded-[3px] bg-[#090909] overflow-x-auto shadow-sm custom-scrollbar-h">
        <table style={{ width: getTableWidth() }} className="border-collapse table-fixed text-xs text-left">
          <colgroup>
            <col style={{ width: colWidths.name || 90, minWidth: colWidths.name || 90 }} />
            {topics.map(t => {
              const checkWidth = colWidths[`${t.id}-check`] || 35;
              const memoWidth = colWidths[`${t.id}-memo`] || 85;
              return (
                <React.Fragment key={`col-${t.id}`}>
                  <col style={{ width: checkWidth, minWidth: checkWidth }} />
                  <col style={{ width: memoWidth, minWidth: memoWidth }} />
                </React.Fragment>
              );
            })}
            <col style={{ width: 40, minWidth: 40 }} />
          </colgroup>
          <thead>
            {/* 1단 머지 헤더 */}
            <tr className="border-b border-white/5 bg-[#121212] text-gray-400 uppercase tracking-widest text-[9.5px] font-black">
              <th rowSpan={2} className="py-3 px-3 border-r border-white/5 text-left sticky left-0 bg-[#121212] z-30 shadow-[2px_0_5px_rgba(0,0,0,0.2)] group relative">
                학생 이름
                <div 
                  onMouseDown={(e) => handleResizeStart(e, 'name')}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/10 transition-colors z-40"
                  title="드래그하여 이름 열 너비 조절"
                />
              </th>
              {topics.map(t => (
                <th key={t.id} colSpan={2} className="py-2.5 px-3 border-r border-white/5 text-center group relative">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-gray-100 text-[11px] font-black text-center break-all leading-tight" title={t.title}>
                      {t.title}
                    </span>
                    <button 
                      onClick={() => handleDeleteTopic(t.id)} 
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-400 hover:bg-white/5 transition-all cursor-pointer"
                      title="체크 항목 제거"
                    >
                      <Trash2 size={11} strokeWidth={2.5} />
                    </button>
                  </div>
                </th>
              ))}
              <th rowSpan={2} className="py-3 px-3 text-center"></th>
            </tr>
            {/* 2단 상세 헤더 */}
            <tr className="border-b border-white/5 bg-[#121212] text-gray-500 uppercase tracking-widest text-[8.5px] font-black">
              {topics.map(t => (
                <React.Fragment key={`sub-${t.id}`}>
                  <th className="py-1.5 px-2 border-r border-white/5 text-center group relative">
                    완료
                    <div 
                      onMouseDown={(e) => handleResizeStart(e, `${t.id}-check`)}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/10 transition-colors z-40"
                      title="드래그하여 완료 칸 너비 조절"
                    />
                  </th>
                  <th className="py-1.5 px-2 border-r border-white/5 text-left group relative">
                    메모 / 특이사항
                    <div 
                      onMouseDown={(e) => handleResizeStart(e, `${t.id}-memo`)}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/10 transition-colors z-40"
                      title="드래그하여 메모 칸 너비 조절"
                    />
                  </th>
                </React.Fragment>
              ))}
            </tr>
          </thead>

          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={1 + topics.length * 2 + 1} className="py-12 text-center text-xs text-gray-500 font-bold italic">
                  필터링된 학생이 존재하지 않습니다.
                </td>
              </tr>
            ) : (
              students.map((student, idx) => {
                const rowBg = idx % 2 === 0 ? "bg-[#0f0f0f]" : "bg-[#151515]";
                return (
                  <tr key={student.id} className={`${rowBg} border-b border-white/5 hover:bg-[#1a1a1a] transition-colors align-middle text-[11px]`}>
                    {/* 1열 고정 학생명 */}
                    <td className="py-2.5 px-2 border-r border-white/5 font-black text-gray-200 sticky left-0 bg-inherit z-20 shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                      <div className="flex flex-col gap-0.5 leading-tight">
                        <span className="truncate max-w-[80px]" title={student.name}>{student.name}</span>
                        <span className="text-[9px] text-gray-500 font-bold tracking-tight truncate max-w-[80px]" title={`${student.grade} · ${student.class}`}>
                          {student.grade} · {student.class}
                        </span>
                      </div>
                    </td>

                    {/* 2열 이후 체크/메모 */}
                    {topics.map(t => {
                      const cellData = items[student.id]?.[t.id] || { is_checked: false, memo: '' };
                      return (
                        <React.Fragment key={`${student.id}-${t.id}`}>
                          {/* 체크박스 셀 */}
                          <td className="py-2.5 px-2 border-r border-white/5 text-center">
                            <input 
                              type="checkbox" 
                              checked={cellData.is_checked}
                              onChange={() => handleToggleCheck(student.id, t.id, cellData)}
                              className="w-4 h-4 rounded-[3px] border-white/10 bg-[#151515] text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          {/* 메모 입력 셀 */}
                          <td className="py-1.5 px-2.5 border-r border-white/5 align-middle">
                            <input 
                              type="text"
                              defaultValue={cellData.memo}
                              onBlur={(e) => handleSaveMemo(student.id, t.id, e.target.value, cellData)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              placeholder="-"
                              className="w-full bg-transparent border border-transparent hover:border-white/10 focus:border-blue-500 focus:bg-[#1a1a1a] rounded-[2px] px-1 py-0.5 text-[10px] font-bold text-gray-300 outline-none transition-all"
                            />
                          </td>
                        </React.Fragment>
                      );
                    })}

                    <td className="py-2.5 px-3"></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
