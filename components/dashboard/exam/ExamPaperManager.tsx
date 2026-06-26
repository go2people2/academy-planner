'use client';

import React, { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ExamPaper, ExamPaperFormData } from '@/types/exam';

// 하위 컴포넌트 임포트
import ExamPaperList from './ExamPaperList';
import ExamPaperForm from './ExamPaperForm';
import ExamAnswerKeyEditor from './ExamAnswerKeyEditor';

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

type ViewState = 'list' | 'create' | 'edit' | 'answer_key' | 'detail';

interface ExamPaperManagerProps {
  academyId: string;
}

export default function ExamPaperManager({ academyId }: ExamPaperManagerProps) {
  const [viewState, setViewState] = useState<ViewState>('list');
  const [selectedExam, setSelectedExam] = useState<ExamPaper | null>(null);
  const [formData, setFormData] = useState<ExamPaperFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 학원 ID 방어 체크
  if (!academyId) {
    return (
      <div style={styles.errorBanner}>
        ⚠️ 학원 정보가 올바르게 로드되지 않았습니다. 새로고침 후 다시 시도해 주세요.
      </div>
    );
  }

  // 폼 정보 등록 핸들러 (기존 시험지 수정 시 즉시 저장, 새 시험지 등록 시 정답 입력 단계로)
  const handleFormSubmit = useCallback(async (data: ExamPaperFormData) => {
    if (viewState === 'edit' && selectedExam) {
      setSaving(true);
      setMessage(null);
      try {
        const payload = {
          exam_code: data.exam_code,
          title: data.title,
          has_error: data.has_error || false,
          error_notes: data.error_notes || '',
          region: data.region,
          school: data.school,
          grade: data.grade,
          subject: data.subject,
          year: data.year,
          semester: data.semester,
          scope: data.scope,
          question_count: data.question_count,
          file_links: data.file_links || [],
          tags: data.tags || [],
          updated_at: new Date().toISOString(),
          // 기존 정답/문항 유형 정보 보존
          answer_key: selectedExam.answer_key || {},
          question_types: selectedExam.question_types || {},
          essay_questions: selectedExam.essay_questions || [],
        };

        const { error } = await supabase
          .from('ams_exam_papers')
          .update(payload)
          .eq('id', selectedExam.id);

        if (error) throw error;

        setMessage({ type: 'success', text: '시험지 정보가 성공적으로 수정되었습니다.' });
        setSelectedExam(null);
        setFormData(null);
        setViewState('list');
      } catch (err: any) {
        console.error('Error updating exam metadata:', err);
        setMessage({ type: 'error', text: `수정 실패: ${err.message}` });
      } finally {
        setSaving(false);
      }
    } else {
      setFormData(data);
      setViewState('answer_key');
    }
  }, [viewState, selectedExam, academyId]);

  // 전체 시험지 데이터 저장 (DB 트랜잭션)
  const handleSaveExam = useCallback(async (
    answerKey: Record<string, number | string | number[]>,
    questionTypes: Record<string, any>,
    essayQuestions: Array<{ q: number; points: number }>
  ) => {
    if (!formData) return;

    // 💡 총 배점 유효성 검증 (부동 소수점 오차 보정 적용 및 미입력 문항은 에디터와 동일하게 0점 처리)
    const rawTotal = Array.from({ length: formData.question_count }, (_, i) => {
      const qNum = i + 1;
      const essayItem = essayQuestions.find((item) => item.q === qNum);
      return essayItem ? essayItem.points : 0; // 에디터와 동일하게 0점 기준 합산
    }).reduce((sum, p) => sum + p, 0);

    const totalPoints = Math.round(rawTotal * 100) / 100;

    if (totalPoints !== 100) {
      const proceed = window.confirm(
        `⚠️ 현재 설정된 문항 배점의 총합이 100점이 아닙니다.\n(현재 합계: ${totalPoints}점)\n\n이대로 저장하시겠습니까?`
      );
      if (!proceed) {
        return;
      }
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        academy_id: academyId,
        exam_code: formData.exam_code,
        title: formData.title,
        has_error: formData.has_error || false,
        error_notes: formData.error_notes || '',
        region: formData.region,
        school: formData.school,
        grade: formData.grade,
        subject: formData.subject,
        year: formData.year,
        semester: formData.semester,
        scope: formData.scope,
        question_count: formData.question_count,
        answer_key: answerKey,
        question_types: questionTypes,
        essay_questions: essayQuestions,
        file_links: formData.file_links || [],
        tags: formData.tags || [],
        updated_at: new Date().toISOString(),
      };

      if (selectedExam) {
        // 기존 시험지 수정
        const { error } = await supabase
          .from('ams_exam_papers')
          .update(payload)
          .eq('id', selectedExam.id);
        if (error) throw error;
        setMessage({ type: 'success', text: '시험지 정보 및 정답이 수정되었습니다.' });
      } else {
        // 새 시험지 추가
        const { error } = await supabase
          .from('ams_exam_papers')
          .insert(payload);
        if (error) throw error;
        setMessage({ type: 'success', text: '새로운 시험지가 성공적으로 등록되었습니다.' });
      }

      setSelectedExam(null);
      setFormData(null);
      setViewState('list');
    } catch (err: any) {
      console.error('Error saving exam:', err);
      setMessage({ type: 'error', text: `저장 중 오류 발생: ${err.message}` });
    } finally {
      setSaving(false);
    }
  }, [formData, selectedExam, academyId]);

  // 시험지 상세 조회 전환
  const handleSelect = useCallback((exam: ExamPaper) => {
    setSelectedExam(exam);
    setViewState('detail');
  }, []);

  // 수정 진입 핸들러
  const handleEdit = useCallback((exam: ExamPaper) => {
    setSelectedExam(exam);
    setFormData({
      exam_code: exam.exam_code,
      title: exam.title,
      has_error: exam.has_error || false,
      error_notes: exam.error_notes || '',
      region: exam.region,
      school: exam.school,
      grade: exam.grade,
      subject: exam.subject,
      year: exam.year,
      semester: exam.semester,
      scope: exam.scope,
      question_count: exam.question_count,
      answer_key: exam.answer_key,
      question_types: exam.question_types as any,
      essay_questions: exam.essay_questions,
      file_links: exam.file_links,
      tags: exam.tags,
    });
    setViewState('edit');
  }, []);

  // 정답 편집 다이렉트 진입 핸들러
  const handleEditAnswerKey = useCallback((exam: ExamPaper) => {
    setSelectedExam(exam);
    setFormData({
      exam_code: exam.exam_code,
      title: exam.title,
      has_error: exam.has_error || false,
      error_notes: exam.error_notes || '',
      region: exam.region,
      school: exam.school,
      grade: exam.grade,
      subject: exam.subject,
      year: exam.year,
      semester: exam.semester,
      scope: exam.scope,
      question_count: exam.question_count,
      answer_key: exam.answer_key,
      question_types: exam.question_types as any,
      essay_questions: exam.essay_questions,
      file_links: exam.file_links,
      tags: exam.tags,
    });
    setViewState('answer_key');
  }, []);

  // 삭제 핸들러
  const handleDelete = useCallback(async (examId: string) => {
    if (!confirm('이 시험지를 삭제하시겠습니까?\n채점 답안 제출 데이터도 함께 지워집니다.')) return;
    try {
      const { error } = await supabase.from('ams_exam_papers').delete().eq('id', examId);
      if (error) throw error;
      setMessage({ type: 'success', text: '시험지가 영구 삭제되었습니다.' });
      setViewState('list');
    } catch (err: any) {
      setMessage({ type: 'error', text: `삭제 실패: ${err.message}` });
    }
  }, []);

  // 뒤로가기 핸들러
  const handleBack = useCallback(() => {
    setSelectedExam(null);
    setFormData(null);
    setViewState('list');
  }, []);

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
          background: message.type === 'success' ? '#1a3a2a' : '#3a1a1a',
          borderColor: message.type === 'success' ? '#2ecc71' : '#e74c3c',
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
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '8px 16px', maxWidth: 1200, margin: '0 auto', fontFamily: "'Pretendard', sans-serif" },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  title: { fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: 0 },
  backBtn: { background: 'transparent', border: '1px solid #475569', color: '#94a3b8', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  message: { padding: '12px 16px', borderRadius: 8, border: '1px solid', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#e2e8f0', fontSize: 13, fontWeight: 500 },
  closeMsg: { background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 },
  saveHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, background: '#16162a', padding: '12px 20px', borderRadius: 12, border: '1px solid #2e2e4a' },
  examSub: { color: '#94a3b8', fontSize: 14, fontWeight: 600 },
  saveBtn: { background: '#4361ee', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 },
  detailCard: { background: '#16162a', borderRadius: 16, padding: 24, border: '1px solid #2e2e4a' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 },
  detailItem: { display: 'flex', flexDirection: 'column', gap: 6, color: '#e2e8f0', fontSize: 14 },
  detailLabel: { fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' },
  fileLink: { color: '#38bdf8', textDecoration: 'none', fontSize: 13, fontWeight: 600 },
  detailActions: { display: 'flex', gap: 10, marginTop: 24 },
  editBtn: { background: '#4361ee', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  answerKeyBtn: { background: '#10b981', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  backBtnAlt: { background: 'transparent', border: '1px solid #475569', color: '#94a3b8', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  errorBanner: { padding: '16px 20px', background: '#3a1a1a', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', fontSize: 13, fontWeight: 600, textAlign: 'center' },
};
