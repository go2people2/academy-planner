import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ExamPaper, ExamPaperFormData } from '@/types/exam';

export type ViewState = 'list' | 'create' | 'edit' | 'answer_key' | 'detail';

export interface UseExamPaperManagerProps {
  academyId: string;
}

export function useExamPaperManager({ academyId }: UseExamPaperManagerProps) {
  const [viewState, setViewState] = useState<ViewState>('list');
  const [selectedExam, setSelectedExam] = useState<ExamPaper | null>(null);
  const [formData, setFormData] = useState<ExamPaperFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
  }, [viewState, selectedExam]);

  // 전체 시험지 데이터 저장
  const handleSaveExam = useCallback(async (
    answerKey: Record<string, number | string | number[]>,
    questionTypes: Record<string, any>,
    essayQuestions: Array<{ q: number; points: number }>
  ) => {
    if (!formData) return;

    const rawTotal = Array.from({ length: formData.question_count }, (_, i) => {
      const qNum = i + 1;
      const essayItem = essayQuestions.find((item) => item.q === qNum);
      return essayItem ? essayItem.points : 0;
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
        const { error } = await supabase
          .from('ams_exam_papers')
          .update(payload)
          .eq('id', selectedExam.id);
        if (error) throw error;
        setMessage({ type: 'success', text: '시험지 정보 및 정답이 수정되었습니다.' });
      } else {
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

  const handleSelect = useCallback((exam: ExamPaper) => {
    setSelectedExam(exam);
    setViewState('detail');
  }, []);

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

  const handleDelete = useCallback(async (examId: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from('ams_exam_papers')
        .delete()
        .eq('id', examId);

      if (error) throw error;

      setMessage({ type: 'success', text: '시험지가 삭제되었습니다.' });
      setSelectedExam(null);
      setFormData(null);
      setViewState('list');
    } catch (err: any) {
      console.error('Error deleting exam:', err);
      setMessage({ type: 'error', text: `삭제 실패: ${err.message}` });
    } finally {
      setSaving(false);
    }
  }, []);

  const handleCancel = useCallback(() => {
    setSelectedExam(null);
    setFormData(null);
    setViewState('list');
  }, []);

  const handleCreateNew = useCallback(() => {
    setSelectedExam(null);
    setFormData(null);
    setViewState('create');
  }, []);

  return {
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
    handleCancel,
    handleCreateNew,
  };
}
