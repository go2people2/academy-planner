'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ExamPaper, ExamPaperFormData } from '@/types/exam';

// 하위 컴포넌트 임포트
import ExamPaperList from './ExamPaperListLight';
import ExamPaperForm from './ExamPaperFormLight';
import ExamAnswerKeyEditor from './ExamAnswerKeyEditorLight';

// ── 하위 컴포넌트 렌더링 에러 차단용 ErrorBoundary ──
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('[ExamErrorBoundary Caught]', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px 20px',
          background: '#3a1a1a',
          border: '1.5px dashed #ff4d4d',
          borderRadius: 12,
          color: '#ff4d4d',
          fontFamily: "'Pretendard', sans-serif",
          margin: '20px auto',
          maxWidth: 600,
        }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: 15, fontWeight: 700 }}>⚠️ OMR 시스템 구성 요소 오류 발생</h4>
          <p style={{ margin: 0, fontSize: 13, color: '#ccc' }}>화면 렌더링 중 아래 오류가 발생했습니다:</p>
          <pre style={{
            marginTop: 10,
            padding: 12,
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 6,
            fontSize: 11,
            color: '#ff9999',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
          }}>
            {this.state.error?.stack || this.state.error?.toString() || '알 수 없는 에러'}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

import { useExamPaperManager } from '../hooks/useExamPaperManager';

type ViewState = 'list' | 'create' | 'edit' | 'answer_key' | 'detail';

interface ExamPaperManagerProps {
  academyId: string;
}

export default function ExamPaperManager({ academyId }: ExamPaperManagerProps) {
  const {
    viewState,
    setViewState,
    selectedExam,
    setSelectedExam,
    formData,
    setFormData,
    saving,
    message,
    setMessage,
    handleFormSubmit,
    handleSaveExam,
    handleSelect,
    handleEdit,
    handleEditAnswerKey,
    handleDelete,
    handleCancel: handleBack,
    handleCreateNew,
  } = useExamPaperManager({ academyId });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {viewState !== 'list' && (
          <button onClick={handleBack} style={styles.backBtn}>← 뒤로가기</button>
        )}
        <h2 style={styles.title}>
          {viewState === 'list' && '📋 OMR 기출문제 관리'}
          {viewState === 'create' && '📝 새 시험지 정보 입력'}
          {viewState === 'edit' && '✏️ 시험지 정보 수정'}
          {viewState === 'answer_key' && '🔑 정답 및 배점 설정'}
          {viewState === 'detail' && `📄 ${selectedExam?.title || ''}`}
        </h2>
      </div>

      {message && (
        <div style={{
          ...styles.message,
          background: message.type === 'success' ? '#e8f8f0' : '#fdf3f2',
          borderColor: message.type === 'success' ? '#2ecc71' : '#e74c3c',
          color: message.type === 'success' ? '#27ae60' : '#c0392b',
        }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} style={styles.closeMsg}>✕</button>
        </div>
      )}

      {/* 뷰 렌더링 구획 (ErrorBoundary 적용) */}
      <ErrorBoundary>
        {viewState === 'list' && (
          <ExamPaperList
            academyId={academyId}
            onSelect={handleSelect}
            onEdit={handleEdit}
            onEditAnswerKey={handleEditAnswerKey}
            onDelete={handleDelete}
            onCreateNew={() => setViewState('create')}
          />
        )}

        {(viewState === 'create' || viewState === 'edit') && (
          <ExamPaperForm
            academyId={academyId}
            onSubmit={handleFormSubmit}
            onCancel={handleBack}
            initialData={viewState === 'edit' ? formData || undefined : undefined}
            isEditing={viewState === 'edit'}
          />
        )}

        {viewState === 'answer_key' && formData && (
          <div>
            <div style={styles.saveHeader}>
              {/* 💡 시험지 제목과 문항 수를 노란색 계열로 강조하고 중복 텍스트는 제거 */}
              <span style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>
                {formData.title} ({formData.question_count}문항)
              </span>
              <button
                onClick={() => handleSaveExam(
                  formData.answer_key || {},
                  formData.question_types || {},
                  formData.essay_questions || []
                )}
                disabled={saving}
                style={styles.saveBtn}
              >
                {saving ? '저장 중...' : '💾 최종 저장 완료'}
              </button>
            </div>
            <ExamAnswerKeyEditor
              questionCount={formData.question_count}
              answerKey={formData.answer_key || {}}
              questionTypes={formData.question_types || {}}
              essayQuestions={formData.essay_questions || []}
              onAnswerKeyChange={(key) => setFormData(prev => prev ? { ...prev, answer_key: key } : prev)}
              onQuestionTypesChange={(types) => setFormData(prev => prev ? { ...prev, question_types: types } : prev)}
              onEssayQuestionsChange={(essays) => setFormData(prev => prev ? { ...prev, essay_questions: essays } : prev)}
            />
          </div>
        )}

        {viewState === 'detail' && selectedExam && (
          <ExamPaperDetail
            exam={selectedExam}
            onEdit={() => handleEdit(selectedExam)}
            onEditAnswerKey={() => handleEditAnswerKey(selectedExam)}
            onBack={handleBack}
          />
        )}
      </ErrorBoundary>
    </div>
  );
}

/** 시험지 상세 정보 컴포넌트 */
function ExamPaperDetail({ exam, onEdit, onEditAnswerKey, onBack }: {
  exam: ExamPaper; onEdit: () => void; onEditAnswerKey: () => void; onBack: () => void;
}) {
  const answerCount = Object.keys(exam.answer_key || {}).length;
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);

  // 💡 일괄 공개/비공개 처리를 위한 선택 상태
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);

  // 💡 조회 기간 설정을 위한 상태 (기본값: 올해 1월 1일 ~ 오늘)
  const getYearStart = () => {
    const year = new Date().getFullYear();
    return `${year}-01-01`;
  };
  const getTodayStr = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState<string>(getYearStart());
  const [endDate, setEndDate] = useState<string>(getTodayStr());

  // 💡 이번 주 월요일 구하기 (오늘 기준)
  const getThisWeekStart = () => {
    const now = new Date();
    const day = now.getDay(); // 0(일) ~ 6(토)
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // 월요일로 매칭
    const monday = new Date(now.setDate(diff));
    const offset = monday.getTimezoneOffset() * 60000;
    return new Date(monday.getTime() - offset).toISOString().split('T')[0];
  };

  // 💡 이번 달 1일 구하기 (오늘 기준)
  const getThisMonthStart = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  const fetchSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      let query = supabase
        .from('ams_exam_submissions')
        .select('*')
        .eq('exam_id', exam.id);

      // 시작일과 종료일 조건 적용
      if (startDate) {
        query = query.gte('submitted_at', `${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        query = query.lte('submitted_at', `${endDate}T23:59:59.999Z`);
      }

      const { data, error } = await query.order('submitted_at', { ascending: false });
      
      if (error) throw error;
      setSubmissions(data || []);
    } catch (err) {
      console.error('Error fetching submissions:', err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [exam.id, startDate, endDate]);

  const handleToggleReveal = async (subId: string, currentReveal: boolean) => {
    try {
      const { error } = await supabase
        .from('ams_exam_submissions')
        .update({ reveal_answers: !currentReveal })
        .eq('id', subId);

      if (error) throw error;
      
      // 로컬 상태 즉시 갱신
      setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, reveal_answers: !currentReveal } : s));
    } catch (err: any) {
      alert(`상태 업데이트 실패: ${err.message}`);
    }
  };

  // 💡 오늘 테스트 텍스트에서 점수를 지우고 쉼표 형태만 남기는 헬퍼 함수
  const clearScoreFromTestStatus = (currentStatus: string, examCode: string) => {
    const cleanStatus = String(currentStatus || '').trim();
    if (!cleanStatus) return '';
    
    const lines = cleanStatus.split('\n');
    const updatedLines = lines.map(line => {
      if (line.includes(examCode)) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const beforeColon = line.substring(0, colonIdx + 1); // "- #4448 :"
          const afterColon = line.substring(colonIdx + 1);
          const commaIdx = afterColon.indexOf(',');
          
          if (commaIdx !== -1) {
            const memo = afterColon.substring(commaIdx); // ", 메모"
            return `${beforeColon} ${memo}`; // "- #4448 : , 메모"
          } else {
            return `${beforeColon} `;
          }
        }
      }
      return line;
    });
    return updatedLines.join('\n');
  };

  // 💡 개별 학생의 시험 제출 이력 삭제
  const handleDeleteSubmission = async (sub: any) => {
    const confirmMsg = `${sub.student_name} 학생의 시험 제출 이력을 정말로 삭제하시겠습니까?\nTodaySheet(일지)의 테스트 결과와 점수도 함께 초기화됩니다.`;
    if (!confirm(confirmMsg)) return;

    try {
      // 1. ams_exam_submissions 테이블에서 삭제
      const { error: deleteErr } = await supabase
        .from('ams_exam_submissions')
        .delete()
        .eq('id', sub.id);

      if (deleteErr) throw deleteErr;

      // 2. Daily Sheet(ams_session_logs) 테이블 연동 초기화
      // 💡 날짜 불일치 문제를 해결하기 위해, 제출 날짜 대신 해당 학생의 일지 중 시험 코드가 텍스트에 들어있는 일지를 직접 검색하여 초기화합니다.
      const examCodeRaw = exam.exam_code || exam.id.substring(0, 4);
      const examCode = examCodeRaw.startsWith('#') ? examCodeRaw : `#${examCodeRaw}`;

      const { data: matchedLogs, error: logGetErr } = await supabase
        .from('ams_session_logs')
        .select('*')
        .eq('student_id', sub.student_id)
        .like('test_status', `%${examCode}%`);

      if (!logGetErr && matchedLogs && matchedLogs.length > 0) {
        for (const log of matchedLogs) {
          const currentStatus = log.test_status || '';
          const updatedStatus = clearScoreFromTestStatus(currentStatus, examCode);

          const { error: logUpdateErr } = await supabase
            .from('ams_session_logs')
            .update({
              test_status: updatedStatus,
              test_score: null
            })
            .eq('id', log.id);

          if (logUpdateErr) {
            console.error('Error clearing ams_session_logs score:', logUpdateErr);
          }
        }
      }

      // 3. 로컬 상태 즉시 갱신
      setSubmissions(prev => prev.filter(s => s.id !== sub.id));
      alert('제출 이력이 성공적으로 삭제되었습니다.');
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // 💡 선택 학생 일괄 정답 공개/비공개
  const handleBatchToggleReveal = async (reveal: boolean) => {
    if (selectedSubIds.length === 0) return;
    
    try {
      const { error } = await supabase
        .from('ams_exam_submissions')
        .update({ reveal_answers: reveal })
        .in('id', selectedSubIds);

      if (error) throw error;

      setSubmissions(prev => 
        prev.map(s => 
          selectedSubIds.includes(s.id) 
            ? { ...s, reveal_answers: reveal } 
            : s
        )
      );
      setSelectedSubIds([]); // 선택 초기화
      alert(`선택한 ${selectedSubIds.length}명 학생의 정답을 일괄 ${reveal ? '공개' : '비공개'} 처리했습니다.`);
    } catch (err: any) {
      alert(`일괄 업데이트 실패: ${err.message}`);
    }
  };

  // 💡 현재 필터링 조회된 전체 학생 일괄 정답 공개/비공개
  const handleAllToggleReveal = async (reveal: boolean) => {
    if (submissions.length === 0) return;
    
    const allIds = submissions.map(s => s.id);
    const confirmMsg = `현재 조회된 ${allIds.length}명 전체 학생의 정답을 일괄 ${reveal ? '공개' : '비공개'} 처리하시겠습니까?`;
    
    if (confirm(confirmMsg)) {
      try {
        const { error } = await supabase
          .from('ams_exam_submissions')
          .update({ reveal_answers: reveal })
          .in('id', allIds);

        if (error) throw error;

        setSubmissions(prev => 
          prev.map(s => ({ ...s, reveal_answers: reveal }))
        );
        setSelectedSubIds([]);
        alert(`전체 ${allIds.length}명 학생의 정답을 일괄 ${reveal ? '공개' : '비공개'} 처리했습니다.`);
      } catch (err: any) {
        alert(`전체 업데이트 실패: ${err.message}`);
      }
    }
  };

  return (
    <div style={styles.detailCard}>
      {exam.has_error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid #ef4444',
          borderRadius: 8,
          color: '#ef4444',
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 6
        }}>
          <div>⚠️ 주의: 이 시험지는 수정되지 않은 오류가 있습니다.</div>
          {exam.error_notes && (
            <div style={{ fontSize: 12, color: '#ffb3b3', fontWeight: 500, background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: 6, width: '100%', marginTop: 2, boxSizing: 'border-box' }}>
              📝 오류 내용: {exam.error_notes}
            </div>
          )}
        </div>
      )}
      <div style={styles.detailGrid}>
        <div style={styles.detailItem}><span style={styles.detailLabel}>시험지 코드</span><span style={{ fontWeight: 700, color: '#38bdf8' }}>{exam.exam_code || '-'}</span></div>
        <div style={styles.detailItem}><span style={styles.detailLabel}>지역/학교</span><span>{exam.region || '-'} / {exam.school || '미정'}</span></div>
        <div style={styles.detailItem}><span style={styles.detailLabel}>학년/과목</span><span>{exam.grade || '-'} / {exam.subject || '-'}</span></div>
        <div style={styles.detailItem}><span style={styles.detailLabel}>년도/학기</span><span>{exam.year}년 {exam.semester || '-'}</span></div>
        <div style={styles.detailItem}><span style={styles.detailLabel}>시험 범위</span><span>{exam.scope || '-'}</span></div>
        <div style={styles.detailItem}><span style={styles.detailLabel}>문항 구성</span><span>총 {exam.question_count}문항 (정답지: {answerCount}개 완료)</span></div>
      </div>

      {exam.file_links && exam.file_links.filter(Boolean).length > 0 && (
        <div style={{ marginTop: 20 }}>
          <span style={styles.detailLabel}>첨부된 원본 파일 (클릭 시 다운로드/열기)</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {exam.file_links.filter(Boolean).map((link, i) => {
              const getOriginalFilename = (url: string) => {
                try {
                  const parsedUrl = new URL(url);
                  const filenameParam = parsedUrl.searchParams.get('filename');
                  if (filenameParam) {
                    return decodeURIComponent(filenameParam);
                  }
                  const decoded = decodeURIComponent(url);
                  const parts = decoded.split('/');
                  const last = parts[parts.length - 1].split('?')[0];
                  return last.replace(/^\d+_/, '');
                } catch {
                  try {
                    const decoded = decodeURIComponent(url);
                    const parts = decoded.split('/');
                    const last = parts[parts.length - 1];
                    return last.replace(/^\d+_/, '');
                  } catch {
                    return `첨부 파일 ${i + 1}`;
                  }
                }
              };
              return (
                <a key={i} href={link} target="_blank" rel="noopener noreferrer" style={styles.fileLink}>
                  📎 {getOriginalFilename(link)}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {onEdit && (
        <div style={styles.detailActions}>
          <button onClick={onEdit} style={styles.editBtn}>✏️ 정보 수정</button>
          <button onClick={onEditAnswerKey} style={styles.answerKeyBtn}>🔑 정답 및 배점 수정</button>
          <button onClick={onBack} style={styles.backBtnAlt}>목록으로</button>
        </div>
      )}

      {/* 💡 학생 답안 제출 및 채점 현황 목록 추가 */}
      <div style={{ marginTop: 28, borderTop: '1px solid #2e2e4a', paddingTop: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', margin: '0 0 12px 0' }}>
          📝 학생 답안 제출 및 채점 현황
        </h3>

        {/* 📅 기간 필터 UI 추가 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          flexWrap: 'wrap',
          gap: 10, 
          marginBottom: 16, 
          background: 'rgba(255,255,255,0.02)', 
          padding: '10px 14px', 
          borderRadius: 8, 
          border: '1px solid rgba(255,255,255,0.05)' 
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>📅 조회 기간 설정</span>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            onClick={(e) => { try { e.currentTarget.showPicker(); } catch(err) {} }}
            onFocus={(e) => { try { e.currentTarget.showPicker(); } catch(err) {} }}
            style={{ background: '#000', border: '1px solid #3b82f6', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#fff', outline: 'none', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12, color: '#475569' }}>~</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            onClick={(e) => { try { e.currentTarget.showPicker(); } catch(err) {} }}
            onFocus={(e) => { try { e.currentTarget.showPicker(); } catch(err) {} }}
            style={{ background: '#000', border: '1px solid #3b82f6', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#fff', outline: 'none', cursor: 'pointer' }}
          />

          {/* ⚡ 퀵 프리셋 단축 버튼 추가 */}
          <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
            <button
              onClick={() => {
                const today = getTodayStr();
                setStartDate(today);
                setEndDate(today);
              }}
              style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#94a3b8', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#475569'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#334155'; }}
            >
              오늘
            </button>
            <button
              onClick={() => {
                setStartDate(getThisWeekStart());
                setEndDate(getTodayStr());
              }}
              style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#94a3b8', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#475569'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#334155'; }}
            >
              이번주
            </button>
            <button
              onClick={() => {
                setStartDate(getThisMonthStart());
                setEndDate(getTodayStr());
              }}
              style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#94a3b8', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#475569'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#334155'; }}
            >
              이번달
            </button>
          </div>

          <button 
            onClick={() => { setStartDate(''); setEndDate(''); }}
            style={{ background: '#334155', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer', marginLeft: 'auto' }}
          >
            전체 기간 보기
          </button>
        </div>

        {/* ⚡ 일괄 처리 바 추가 */}
        {submissions.length > 0 && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            flexWrap: 'wrap',
            gap: 12, 
            marginBottom: 16, 
            background: 'rgba(255,255,255,0.01)', 
            padding: '10px 14px', 
            borderRadius: 8, 
            border: '1px solid rgba(255,255,255,0.04)' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={selectedSubIds.length === submissions.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedSubIds(submissions.map(s => s.id));
                  } else {
                    setSelectedSubIds([]);
                  }
                }}
                style={{ width: 15, height: 15, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>
                전체선택 ({selectedSubIds.length}명 선택됨)
              </span>
            </div>

            <button
              onClick={() => handleBatchToggleReveal(true)}
              disabled={selectedSubIds.length === 0}
              style={{ background: selectedSubIds.length > 0 ? '#10b981' : '#1e293b', color: selectedSubIds.length > 0 ? '#fff' : '#4b5563', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: selectedSubIds.length > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
            >
              🔓 선택 정답공개
            </button>
            <button
              onClick={() => handleBatchToggleReveal(false)}
              disabled={selectedSubIds.length === 0}
              style={{ background: selectedSubIds.length > 0 ? '#ef4444' : '#1e293b', color: selectedSubIds.length > 0 ? '#fff' : '#4b5563', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: selectedSubIds.length > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
            >
              🔒 선택 정답비공개
            </button>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button
                onClick={() => handleAllToggleReveal(true)}
                style={{ background: 'transparent', border: '1px solid #10b981', color: '#10b981', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                전체 공개
              </button>
              <button
                onClick={() => handleAllToggleReveal(false)}
                style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                전체 비공개
              </button>
            </div>
          </div>
        )}

        {loadingSubmissions ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
            제출 이력 로딩 중...
          </div>
        ) : submissions.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: 13, background: 'rgba(0,0,0,0.1)', borderRadius: 8 }}>
            선택한 조회 기간 내에 답안을 제출한 학생이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {submissions.map((sub) => (
              <div 
                key={sub.id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid #2e2e4a', 
                  borderRadius: 10, 
                  padding: '12px 18px',
                  flexWrap: 'wrap',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* 💡 개별 체크박스 */}
                  <input 
                    type="checkbox" 
                    checked={selectedSubIds.includes(sub.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSubIds(prev => [...prev, sub.id]);
                      } else {
                        setSelectedSubIds(prev => prev.filter(id => id !== sub.id));
                      }
                    }}
                    style={{ width: 15, height: 15, cursor: 'pointer' }}
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{sub.student_name}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8', background: '#1e293b', padding: '2px 6px', borderRadius: 4 }}>
                        {sub.input_method === 'digital' ? '디지털 마킹' : 'OMR 스캔'}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      제출일시: {new Date(sub.submitted_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>자동 채점 결과</span>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>
                      {sub.total_score}점 
                      <span style={{ fontSize: 12, color: '#ef4444', marginLeft: 6 }}>
                        (오답: {sub.wrong_questions?.length || 0}개)
                      </span>
                    </div>
                  </div>

                  {/* 💡 정답/해설 공개 토글 버튼 */}
                  <button
                    onClick={() => handleToggleReveal(sub.id, sub.reveal_answers)}
                    style={{
                      background: sub.reveal_answers ? '#10b981' : '#334155',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                      transition: 'all 0.2s',
                      boxShadow: sub.reveal_answers ? '0 4px 12px rgba(16,185,129,0.2)' : 'none'
                    }}
                  >
                    {sub.reveal_answers ? '🔓 정답 공개 중' : '🔒 정답 비공개'}
                  </button>

                  {/* 💡 [신규] 제출 이력 삭제 버튼 */}
                  <button
                    onClick={() => handleDeleteSubmission(sub)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      padding: '8px 14px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#ef4444';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                  >
                    🗑️ 제출 삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '8px 16px', maxWidth: 1200, margin: '0 auto', fontFamily: "'Pretendard', sans-serif" },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  title: { fontSize: 20, fontWeight: 800, color: '#37352f', margin: 0 },
  backBtn: { background: '#f3f4f6', border: '1px solid #edece9', color: '#4b5563', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  message: { padding: '12px 16px', borderRadius: 8, border: '1px solid', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#37352f', fontSize: 13, fontWeight: 500 },
  closeMsg: { background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 },
  saveHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, background: '#f9fafb', padding: '12px 20px', borderRadius: 12, border: '1px solid #e3e2e0' },
  examSub: { color: '#6b7280', fontSize: 14, fontWeight: 600 },
  saveBtn: { background: '#0c73e8', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 },
  detailCard: { background: '#ffffff', borderRadius: 16, padding: 24, border: '1px solid #e3e2e0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 },
  detailItem: { display: 'flex', flexDirection: 'column', gap: 6, color: '#37352f', fontSize: 14 },
  detailLabel: { fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' },
  fileLink: { color: '#0c73e8', textDecoration: 'none', fontSize: 13, fontWeight: 600 },
  detailActions: { display: 'flex', gap: 10, marginTop: 24 },
  editBtn: { background: '#0c73e8', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  answerKeyBtn: { background: '#10b981', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  backBtnAlt: { background: '#f3f4f6', border: '1px solid #edece9', color: '#4b5563', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  errorBanner: { padding: '16px 20px', background: '#fdf3f2', border: '1px solid #ef4444', borderRadius: 8, color: '#c0392b', fontSize: 13, fontWeight: 600, textAlign: 'center' },
};
