import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ExamPaper, ExamSubmission } from '@/types/exam';

export interface UseStudentExamSubmissionProps {
  academyId: string;
  studentId: string;
  studentName: string;
  studentGrade?: string;
  assignedExamId?: string;
  sessionDate?: string;
}

// 일지 내 시험 코드 및 점수 업데이트 헬퍼 유틸리티
export function updateTestStatusWithScore(currentStatus: string, examCode: string, autoScore: number): string {
  if (!currentStatus || currentStatus.trim() === '') {
    return `${examCode}(${autoScore}점)`;
  }
  
  if (currentStatus.includes(examCode)) {
    const regex = new RegExp(`${examCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\(\\d+점\\))?`, 'g');
    return currentStatus.replace(regex, `${examCode}(${autoScore}점)`);
  }
  
  return `${currentStatus}, ${examCode}(${autoScore}점)`;
}

export function useStudentExamSubmission({
  academyId,
  studentId,
  studentName,
  studentGrade,
  assignedExamId,
  sessionDate,
}: UseStudentExamSubmissionProps) {
  const [exams, setExams] = useState<ExamPaper[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamPaper | null>(null);
  const [answers, setAnswers] = useState<Record<string, number | string | number[]>>({});
  const [backupAnswers, setBackupAnswers] = useState<Record<string, number | string | number[]> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExams, setLoadingExams] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState(studentGrade || 'All');

  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directFileInputRef = useRef<HTMLInputElement>(null);

  const [submission, setSubmission] = useState<ExamSubmission | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [incorrectResolved, setIncorrectResolved] = useState<Record<string, boolean>>({});
  const [examStats, setExamStats] = useState<{
    average: number;
    min: number;
    max: number;
    stdDev: number;
    count: number;
  } | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'papers' | 'history'>('papers');
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);

  const fetchExamStats = useCallback(async (examId: string) => {
    try {
      const { data, error } = await supabase
        .from('ams_exam_submissions')
        .select('total_score')
        .eq('exam_id', examId);

      if (error) throw error;
      if (data && data.length > 0) {
        const scores = data.map(d => Number(d.total_score || 0));
        const count = scores.length;
        const sum = scores.reduce((a, b) => a + b, 0);
        const average = Number((sum / count).toFixed(1));
        const max = Math.max(...scores);
        const min = Math.min(...scores);

        const variance = scores.reduce((a, b) => a + Math.pow(b - average, 2), 0) / count;
        const stdDev = Number(Math.sqrt(variance).toFixed(1));

        setExamStats({ average, min, max, stdDev, count });
      } else {
        setExamStats(null);
      }
    } catch (err) {
      console.error('Error fetching exam stats:', err);
      setExamStats(null);
    }
  }, []);

  useEffect(() => {
    if (selectedExam) {
      fetchExamStats(selectedExam.id);
    } else {
      setExamStats(null);
    }
  }, [selectedExam, submission, fetchExamStats]);

  useEffect(() => {
    if (submission) {
      try {
        const saved = localStorage.getItem(`ams_resolved_submissions_${submission.id}`);
        if (saved) {
          setIncorrectResolved(JSON.parse(saved));
        } else {
          setIncorrectResolved({});
        }
      } catch (e) {
        setIncorrectResolved({});
      }
    } else {
      setIncorrectResolved({});
    }
  }, [submission]);

  const toggleIncorrectResolved = (qNum: number) => {
    if (!submission) return;
    const qKey = qNum.toString();
    setIncorrectResolved(prev => {
      const updated = {
        ...prev,
        [qKey]: !prev[qKey]
      };
      try {
        localStorage.setItem(`ams_resolved_submissions_${submission.id}`, JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving incorrect resolved status:', e);
      }
      return updated;
    });
  };

  const handleClearAnswers = () => {
    if (Object.keys(answers).length === 0) {
      alert('초기화할 마킹 정보가 없습니다.');
      return;
    }
    if (confirm('작성 중인 OMR 마킹 정보가 초기화됩니다. 계속하시겠습니까?')) {
      setBackupAnswers(answers);
      setAnswers({});
    }
  };

  const handleRestoreAnswers = () => {
    if (backupAnswers) {
      setAnswers(backupAnswers);
      setBackupAnswers(null);
    }
  };

  const handleDirectOmrScan = async (file: File) => {
    setIsScanning(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('autoMatch', 'true');
      formData.append('academyId', academyId);
      formData.append('studentId', studentId);
      formData.append('studentName', studentName);

      const response = await fetch('/api/exam/scan-omr', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '스캔 분석 실패');
      }

      const data = await response.json();
      if (data.success && data.submission && data.exam) {
        setSelectedExam(data.exam);
        setSubmission(data.submission);
        setAnswers(data.answers || {});
        alert(`[${data.exam.title}] 시험지가 확인되어 채점 및 제출이 완료되었습니다!`);
      } else {
        throw new Error(data.error || '시험지 번호를 판독하지 못했거나 일치하는 시험지가 없습니다.');
      }
    } catch (err: any) {
      console.error(err);
      alert(`OMR 사진 판독 실패: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleOmrScan = async (file: File) => {
    if (!selectedExam) return;
    setIsScanning(true);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('questionCount', selectedExam.question_count.toString());

      const response = await fetch('/api/exam/scan-omr', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '스캔 분석 실패');
      }

      const data = await response.json();
      if (data.success && data.answers) {
        const newAnswers = { ...answers };
        Object.keys(data.answers).forEach((key) => {
          const val = data.answers[key];
          if (val !== null && val !== undefined) {
            newAnswers[key] = val;
          }
        });

        setBackupAnswers(answers);
        setAnswers(newAnswers);
        alert('AI OMR 사진 스캔 판독이 완료되었습니다! 입력된 번호에 누락되거나 틀린 곳이 없는지 눈으로 확인하신 후 [최종 제출]을 눌러주세요.');
      } else {
        throw new Error('마킹 판독 결과를 가져오지 못했습니다.');
      }
    } catch (err: any) {
      console.error(err);
      alert(`OMR 사진 판독 중 에러가 발생했습니다: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleOmrScan(file);
    }
    e.target.value = '';
  };

  const handleDirectFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleDirectOmrScan(file);
    }
    e.target.value = '';
  };

  const fetchExams = useCallback(async () => {
    if (!assignedExamId) {
      setExams([]);
      setLoadingExams(false);
      return;
    }
    setLoadingExams(true);
    
    let queryText = assignedExamId.trim();
    const codeMatch = queryText.match(/#[a-zA-Z0-9_-]+/);
    if (codeMatch) {
      queryText = codeMatch[0];
    }
    
    try {
      let { data, error } = await supabase
        .from('ams_exam_papers')
        .select('*')
        .eq('academy_id', academyId)
        .eq('exam_code', queryText)
        .maybeSingle();

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!data && uuidRegex.test(queryText)) {
        const { data: uuidData, error: uuidErr } = await supabase
          .from('ams_exam_papers')
          .select('*')
          .eq('id', queryText)
          .maybeSingle();
        if (!uuidErr && uuidData) {
          data = uuidData;
        }
      }

      if (!data) {
        const { data: titleData, error: titleErr } = await supabase
          .from('ams_exam_papers')
          .select('*')
          .eq('academy_id', academyId)
          .ilike('title', `%${queryText}%`)
          .limit(1);
        
        if (!titleErr && titleData && titleData.length > 0) {
          data = titleData[0];
        }
      }

      if (data) {
        setExams([data]);
        setSelectedExam(data);
      } else {
        setExams([]);
      }
    } catch (err) {
      console.error('Error fetching assigned exam:', err);
      setExams([]);
    } finally {
      setLoadingExams(false);
    }
  }, [academyId, assignedExamId]);

  const fetchMySubmissions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ams_exam_submissions')
        .select(`
          *,
          ams_exam_papers (
            exam_code, region, school, grade, subject, scope, year, semester, question_count,
            answer_key, question_types, essay_questions, file_links, has_error, error_notes, created_at
          )
        `)
        .eq('student_id', studentId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setMySubmissions(data || []);
    } catch (err) {
      console.error('Error fetching my submissions:', err);
    }
  }, [studentId]);

  const checkExistingSubmission = useCallback(async (examId: string) => {
    setCheckingStatus(true);
    try {
      const { data, error } = await supabase
        .from('ams_exam_submissions')
        .select('*')
        .eq('exam_id', examId)
        .eq('student_id', studentId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSubmission(data as ExamSubmission);
        setAnswers(data.answers || {});
      } else {
        setSubmission(null);
        setAnswers({});
      }
    } catch (err) {
      console.error('Error checking submission:', err);
    } finally {
      setCheckingStatus(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchExams();
    fetchMySubmissions();
  }, [fetchExams, fetchMySubmissions]);

  useEffect(() => {
    if (selectedExam) {
      checkExistingSubmission(selectedExam.id);
    } else {
      setSubmission(null);
      setAnswers({});
    }
  }, [selectedExam, checkExistingSubmission]);

  const handleRefreshStatus = async () => {
    if (!selectedExam) return;
    await checkExistingSubmission(selectedExam.id);
  };

  const handleSelectSubmission = (sub: any) => {
    const paper = sub.ams_exam_papers;
    const examPaper: ExamPaper = {
      id: sub.exam_id,
      academy_id: sub.academy_id,
      exam_code: paper?.exam_code || '',
      title: paper?.title || `${paper?.year}년 ${paper?.semester || ''} ${paper?.subject || '시험지'}`,
      region: paper?.region || '',
      school: paper?.school || '',
      grade: paper?.grade || '',
      subject: paper?.subject || '',
      scope: paper?.scope || '',
      year: paper?.year || 2026,
      semester: paper?.semester || '',
      question_count: paper?.question_count || 0,
      answer_key: paper?.answer_key || {},
      question_types: paper?.question_types || {},
      essay_questions: paper?.essay_questions || [],
      file_links: paper?.file_links || [],
      has_error: paper?.has_error || false,
      error_notes: paper?.error_notes || '',
      tags: paper?.tags || [],
      created_by: paper?.created_by || '',
      updated_at: paper?.updated_at || '',
      created_at: paper?.created_at || ''
    };
    
    setSelectedExam(examPaper);
    setSubmission(sub);
    setAnswers(sub.answers || {});
  };

  const filteredExams = useMemo(() => {
    return exams.filter(exam => {
      const matchesSearch = exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (exam.school && exam.school.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            (exam.exam_code && exam.exam_code.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesGrade = selectedGrade === 'All' || exam.grade === selectedGrade;
      
      return matchesSearch && matchesGrade;
    });
  }, [exams, searchTerm, selectedGrade]);

  const gradeOptions = useMemo(() => {
    const grades = new Set<string>();
    exams.forEach(e => { if (e.grade) grades.add(e.grade); });
    return ['All', ...Array.from(grades)];
  }, [exams]);

  const handleMark = (qNum: number, choice: number, isMulti: boolean) => {
    if (submission) return;
    const qKey = qNum.toString();
    const currentVal = answers[qKey];

    if (isMulti) {
      let newVal: number[] = [];
      if (Array.isArray(currentVal)) {
        if (currentVal.includes(choice)) {
          newVal = currentVal.filter(c => c !== choice);
        } else {
          newVal = [...currentVal, choice].sort((a, b) => a - b);
        }
      } else if (typeof currentVal === 'number') {
        newVal = [currentVal, choice].sort((a, b) => a - b);
      } else {
        newVal = [choice];
      }
      setAnswers(prev => ({ ...prev, [qKey]: newVal }));
    } else {
      setAnswers(prev => ({ ...prev, [qKey]: currentVal === choice ? 0 : choice }));
    }
  };

  const handleShortAnswerChange = (qNum: number, val: string) => {
    if (submission) return;
    setAnswers(prev => ({ ...prev, [qNum.toString()]: val }));
  };

  const handleSubmitAnswers = async () => {
    if (!selectedExam || submitting) return;

    const unanswered: number[] = [];
    for (let i = 1; i <= selectedExam.question_count; i++) {
      const val = answers[i.toString()];
      if (val === undefined || val === '' || val === 0 || (Array.isArray(val) && val.length === 0)) {
        unanswered.push(i);
      }
    }

    if (unanswered.length > 0) {
      const confirmSubmit = window.confirm(
        `⚠️ 마킹하지 않은 문항이 ${unanswered.length}개 있습니다.\n(미마킹 문항: ${unanswered.join(', ')}번)\n\n이대로 제출하시겠습니까?`
      );
      if (!confirmSubmit) return;
    } else {
      const confirmSubmit = window.confirm('답안을 최종 제출하시겠습니까?\n제출 후에는 수정할 수 없습니다.');
      if (!confirmSubmit) return;
    }

    setSubmitting(true);
    try {
      let correctCount = 0;
      let gradableCount = 0;
      const wrongQuestions: number[] = [];
      const answerKey = selectedExam.answer_key || {};
      const questionTypes = selectedExam.question_types || {};

      for (let i = 1; i <= selectedExam.question_count; i++) {
        const qKey = i.toString();
        const type = questionTypes[qKey] || 'multiple_choice';
        const studentAns = answers[qKey];
        const correctAns = answerKey[qKey];

        if (type === 'essay') {
          continue;
        }

        gradableCount++;

        if (type === 'multiple_choice') {
          if (Number(studentAns) === Number(correctAns)) {
            correctCount++;
          } else {
            wrongQuestions.push(i);
          }
        } else if (type === 'multiple_choice_multi') {
          const sArr = Array.isArray(studentAns) ? studentAns.map(Number).sort() : [Number(studentAns)];
          const cArr = Array.isArray(correctAns) ? correctAns.map(Number).sort() : [Number(correctAns)];
          
          if (JSON.stringify(sArr) === JSON.stringify(cArr)) {
            correctCount++;
          } else {
            wrongQuestions.push(i);
          }
        } else if (type === 'short_answer') {
          const sStr = String(studentAns || '').trim().toLowerCase().replace(/\s+/g, '');
          const cStr = String(correctAns || '').trim().toLowerCase().replace(/\s+/g, '');

          if (sStr === cStr && cStr !== '') {
            correctCount++;
          } else {
            wrongQuestions.push(i);
          }
        }
      }

      const autoScore = gradableCount > 0 ? Math.round((correctCount / gradableCount) * 100) : 0;

      const payload = {
        exam_id: selectedExam.id,
        academy_id: academyId,
        student_id: studentId,
        student_name: studentName,
        answers: answers,
        input_method: 'digital',
        auto_score: autoScore,
        total_score: autoScore,
        wrong_questions: wrongQuestions,
        submitted_at: new Date().toISOString(),
        reveal_answers: false
      };

      const { data, error } = await supabase
        .from('ams_exam_submissions')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      if (sessionDate) {
        const { data: existingLog, error: logGetErr } = await supabase
          .from('ams_session_logs')
          .select('*')
          .eq('student_id', studentId)
          .eq('session_date', sessionDate)
          .maybeSingle();

        if (logGetErr) {
          throw new Error(`일지 조회 실패: ${logGetErr.message}`);
        }

        const examCodeRaw = selectedExam.exam_code || selectedExam.id.substring(0, 4);
        const examCode = examCodeRaw.startsWith('#') ? examCodeRaw : `#${examCodeRaw}`;

        if (existingLog) {
          const currentStatus = existingLog.test_status || '';
          const updatedStatus = updateTestStatusWithScore(currentStatus, examCode, autoScore);

          const { error: updateErr } = await supabase
            .from('ams_session_logs')
            .update({
              test_status: updatedStatus,
              test_score: autoScore
            })
            .eq('id', existingLog.id);

          if (updateErr) {
            throw new Error(`일지 업데이트 실패: ${updateErr.message}`);
          }
        } else {
          const newStatus = `${examCode}(${autoScore}점)`;
          const { error: insertErr } = await supabase
            .from('ams_session_logs')
            .insert({
              student_id: studentId,
              student_name: studentName,
              academy_id: academyId,
              session_date: sessionDate,
              course_name: '정규',
              test_status: newStatus,
              test_score: autoScore
            });

          if (insertErr) {
            throw new Error(`일지 생성 및 반영 실패: ${insertErr.message}`);
          }
        }
      }

      setSubmission(data as ExamSubmission);
      alert(`채점이 완료되었습니다! 점수: ${autoScore}점`);
      fetchMySubmissions();
    } catch (err: any) {
      console.error('Error submitting exam:', err);
      alert(`답안 제출 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    exams,
    selectedExam,
    setSelectedExam,
    answers,
    setAnswers,
    backupAnswers,
    submitting,
    loadingExams,
    searchTerm,
    setSearchTerm,
    selectedGrade,
    setSelectedGrade,
    isScanning,
    fileInputRef,
    directFileInputRef,
    handleFileChange,
    handleDirectFileChange,
    submission,
    setSubmission,
    checkingStatus,
    incorrectResolved,
    examStats,
    activeSubTab,
    setActiveSubTab,
    mySubmissions,
    handleClearAnswers,
    handleRestoreAnswers,
    toggleIncorrectResolved,
    handleRefreshStatus,
    handleSelectSubmission,
    filteredExams,
    gradeOptions,
    handleMark,
    handleShortAnswerChange,
    handleSubmitAnswers,
    fetchExams,
    fetchMySubmissions,
  };
}
